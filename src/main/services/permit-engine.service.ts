import type { PrismaClient } from '@prisma/client';
import { isApplicable, type ApplicabilityRule } from './applicability-rule';

/**
 * Moteur de calcul du devis de permis de construire (Module 18).
 *
 * Pur vis-à-vis de la persistance : lit le catalogue de prestations/frais/
 * taxes (`PermitFeeItem`) et calcule un résultat en mémoire
 * (`GeneratedPermitEstimate`). L'appelant (permit-projects.ipc.ts) décide de
 * la persister (`PermitEstimate` + `PermitEstimateLine`).
 *
 * Conception (décisions retenues pour rester cohérent avec le reste de
 * l'application) :
 * - **Automatisation intelligente** (§3 du cahier des charges — « si R+4 ou
 *   plus, ajouter étude structure approfondie… ») : implémentée en
 *   réutilisant tel quel le moteur de règle d'applicabilité déclaratif
 *   partagé avec le Module 17 (`applicability-rule.ts`), posé directement
 *   sur `PermitFeeItem.applicabilityRule` — plutôt qu'un second système de
 *   « règles métier » dédié. Un item conditionnel (ex. « Contrôle technique »)
 *   est un `PermitFeeItem` normal dont la règle porte sur `levels`,
 *   `terrainSurface`, `hasPiscine`, `hasForage`, `nombreBatiments`, `nature`…
 * - **Barème** (`calcMode`) résolu dans cet ordre pour chaque item :
 *   surcharge la plus spécifique (`PermitFeeRateOverride` — commune+nature+
 *   standing > 2 dimensions > 1 dimension) → `PermitFeeItem.defaultValue`.
 * - **TVA** : appliquée uniquement aux prestations intellectuelles
 *   (architecte, BET, géomètre, études) — les frais administratifs et taxes
 *   sont des débours versés à l'administration pour le compte du client,
 *   non assujettis. `totalTVA` se calcule donc sur
 *   `totalArchitecte+totalBET+totalGeometre+totalEtudes` uniquement, jamais
 *   sur `totalFraisAdministratifs+totalTaxes` — traitement fiscal standard
 *   pour ce type de prestation, distinct d'un devis de travaux classique.
 */

export interface PermitProjectInputs {
  nature: string;
  standing: string;
  communeId: number | null;
  zoneType: string | null;
  terrainSurface: number | null;
  surfaceBatie: number;
  levels: number;
  hasSousSol: boolean;
  nombreBatiments: number;
  coutPrevisionnelTravaux: number | null;
  hasPiscine: boolean;
  hasAscenseur: boolean;
  hasGroupeElectrogene: boolean;
  hasForage: boolean;
  hasCloture: boolean;
  hasVoirieInterieure: boolean;
  missionPhases: string[];
}

export interface GeneratedPermitLine {
  feeItemId: number;
  feeItemCode: string;
  category: string;
  label: string;
  calcMode: string;
  baseAmount: number | null;
  rateValue: number;
  montantHT: number;
  trace: string;
  order: number;
}

export interface GeneratedPermitEstimate {
  lines: GeneratedPermitLine[];
  totalArchitecte: number;
  totalBET: number;
  totalGeometre: number;
  totalEtudes: number;
  totalFraisAdministratifs: number;
  totalTaxes: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  tvaPct: number;
  coutPrevisionnelTravauxSnapshot: number | null;
  warnings: string[];
}

const round = (v: number, dp = 2): number => Math.round(v * 10 ** dp) / 10 ** dp;

// Catégories dont les honoraires sont assujettis à la TVA (prestations
// intellectuelles) — le reste (FRAIS_ADMINISTRATIF, TAXE) en est exclu.
const VAT_LIABLE_CATEGORIES = new Set([
  'ARCHITECTE', 'BET_STRUCTURE', 'BET_FLUIDES', 'BET_ELECTRICITE', 'BET_VRD', 'BET_GEOTECHNIQUE',
  'GEOMETRE', 'ETUDE_SOL', 'ETUDE_HYDROLOGIE', 'ETUDE_ENVIRONNEMENT', 'ETUDE_INCENDIE',
]);

function categoryBucket(category: string): keyof Omit<GeneratedPermitEstimate, 'lines' | 'totalHT' | 'totalTVA' | 'totalTTC' | 'tvaPct' | 'coutPrevisionnelTravauxSnapshot' | 'warnings'> {
  if (category === 'ARCHITECTE') return 'totalArchitecte';
  if (category.startsWith('BET_')) return 'totalBET';
  if (category === 'GEOMETRE') return 'totalGeometre';
  if (category.startsWith('ETUDE_')) return 'totalEtudes';
  if (category === 'FRAIS_ADMINISTRATIF') return 'totalFraisAdministratifs';
  return 'totalTaxes';
}

interface FeeItemWithRelations {
  id: number;
  code: string;
  category: string;
  label: string;
  calcMode: string;
  missionPhase: string | null;
  defaultValue: unknown;
  unit: string | null;
  applicabilityRule: unknown;
  sortOrder: number;
  rateOverrides: Array<{ nature: string | null; standing: string | null; communeId: number | null; value: unknown }>;
  surfaceBrackets: Array<{ minSurface: unknown; maxSurface: unknown; value: unknown; label: string | null }>;
}

/** Sélectionne la surcharge de taux la plus spécifique (le plus de dimensions renseignées qui matchent). */
function resolveRate(item: FeeItemWithRelations, inputs: PermitProjectInputs): { value: number; isOverride: boolean } {
  let best: { value: number; score: number } | null = null;
  for (const o of item.rateOverrides) {
    if (o.nature != null && o.nature !== inputs.nature) continue;
    if (o.standing != null && o.standing !== inputs.standing) continue;
    if (o.communeId != null && o.communeId !== inputs.communeId) continue;
    const score = (o.nature != null ? 1 : 0) + (o.standing != null ? 1 : 0) + (o.communeId != null ? 1 : 0);
    if (!best || score > best.score) best = { value: Number(o.value), score };
  }
  if (best) return { value: best.value, isOverride: true };
  return { value: Number(item.defaultValue), isOverride: false };
}

/** Résout le forfait par tranche de surface (calcMode = BAREME_SURFACE). */
function resolveBracket(item: FeeItemWithRelations, surface: number): { value: number; label: string | null } | null {
  const sorted = [...item.surfaceBrackets].sort((a, b) => Number(a.minSurface) - Number(b.minSurface));
  for (const b of sorted) {
    const min = Number(b.minSurface);
    const max = b.maxSurface != null ? Number(b.maxSurface) : null;
    if (surface >= min && (max == null || surface <= max)) return { value: Number(b.value), label: b.label };
  }
  return null;
}

/**
 * Calcule le devis de permis de construire à partir des caractéristiques du
 * projet — charge le catalogue actif, filtre par applicabilité (phase de
 * mission pour les items ARCHITECTE, règle déclarative pour tous), résout
 * taux/tranche, agrège par catégorie.
 */
export async function computePermitEstimate(
  db: PrismaClient,
  inputs: PermitProjectInputs,
): Promise<GeneratedPermitEstimate> {
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);

  const items = await db.permitFeeItem.findMany({
    where: { isActive: true },
    include: { rateOverrides: true, surfaceBrackets: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  }) as unknown as FeeItemWithRelations[];

  const missionPhaseSet = new Set(inputs.missionPhases);
  const ruleInputs = inputs as unknown as Record<string, unknown>;

  const lines: GeneratedPermitLine[] = [];
  let order = 0;

  for (const item of items) {
    // Un item ARCHITECTE lié à une phase de mission n'apparaît que si cette
    // phase est sélectionnée sur le projet (mission Esquisse/APS/APD/…).
    if (item.missionPhase && !missionPhaseSet.has(item.missionPhase)) continue;
    if (!isApplicable(item.applicabilityRule as ApplicabilityRule | null, ruleInputs)) continue;

    const { value: rateValue } = resolveRate(item, inputs);
    let baseAmount: number | null = null;
    let montantHT = 0;
    let trace = '';

    switch (item.calcMode) {
      case 'POURCENTAGE_COUT_TRAVAUX': {
        baseAmount = inputs.coutPrevisionnelTravaux;
        if (baseAmount == null || baseAmount <= 0) {
          warn(`« ${item.label} » : coût prévisionnel des travaux non renseigné — ligne ignorée.`);
          continue;
        }
        montantHT = round(baseAmount * (rateValue / 100));
        trace = `${round(baseAmount)} FCFA × ${rateValue}% = ${montantHT} FCFA`;
        break;
      }
      case 'FORFAIT': {
        montantHT = round(rateValue);
        trace = `Forfait = ${montantHT} FCFA`;
        break;
      }
      case 'PAR_M2_TERRAIN': {
        baseAmount = inputs.terrainSurface;
        if (baseAmount == null || baseAmount <= 0) {
          warn(`« ${item.label} » : superficie du terrain non renseignée — ligne ignorée.`);
          continue;
        }
        montantHT = round(baseAmount * rateValue);
        trace = `${baseAmount} m² × ${rateValue} FCFA/m² = ${montantHT} FCFA`;
        break;
      }
      case 'PAR_M2_BATI': {
        baseAmount = inputs.surfaceBatie;
        if (baseAmount == null || baseAmount <= 0) {
          warn(`« ${item.label} » : surface bâtie non renseignée — ligne ignorée.`);
          continue;
        }
        montantHT = round(baseAmount * rateValue);
        trace = `${baseAmount} m² × ${rateValue} FCFA/m² = ${montantHT} FCFA`;
        break;
      }
      case 'BAREME_SURFACE': {
        // Le géomètre travaille sur la superficie du terrain (levé, bornage,
        // implantation) ; les autres catégories en barème de surface (frais
        // administratifs par tranche) portent sur la surface bâtie.
        const surface = item.category === 'GEOMETRE'
          ? (inputs.terrainSurface ?? inputs.surfaceBatie)
          : inputs.surfaceBatie;
        baseAmount = surface;
        const bracket = resolveBracket(item, surface);
        if (!bracket) {
          warn(`« ${item.label} » : aucune tranche de surface définie pour ${surface} m² — ligne ignorée.`);
          continue;
        }
        montantHT = round(bracket.value);
        trace = `Tranche ${bracket.label ?? `${surface} m²`} = ${montantHT} FCFA`;
        break;
      }
      default:
        continue;
    }

    if (montantHT <= 0) continue;

    lines.push({
      feeItemId: item.id, feeItemCode: item.code, category: item.category, label: item.label,
      calcMode: item.calcMode, baseAmount, rateValue, montantHT, trace, order: order++,
    });
  }

  const totals: Record<string, number> = {
    totalArchitecte: 0, totalBET: 0, totalGeometre: 0, totalEtudes: 0,
    totalFraisAdministratifs: 0, totalTaxes: 0,
  };
  let totalAssujetti = 0;
  for (const l of lines) {
    const bucket = categoryBucket(l.category);
    totals[bucket] += l.montantHT;
    if (VAT_LIABLE_CATEGORIES.has(l.category)) totalAssujetti += l.montantHT;
  }
  for (const k of Object.keys(totals)) totals[k] = round(totals[k]);

  const totalHT = round(lines.reduce((s, l) => s + l.montantHT, 0));
  const tvaPct = 18;
  const totalTVA = round(totalAssujetti * (tvaPct / 100));
  const totalTTC = round(totalHT + totalTVA);

  if (lines.length === 0) {
    warn('Aucune prestation applicable — vérifier le catalogue et les caractéristiques du projet (phases de mission notamment).');
  }

  return {
    lines,
    totalArchitecte: totals.totalArchitecte,
    totalBET: totals.totalBET,
    totalGeometre: totals.totalGeometre,
    totalEtudes: totals.totalEtudes,
    totalFraisAdministratifs: totals.totalFraisAdministratifs,
    totalTaxes: totals.totalTaxes,
    totalHT,
    totalTVA,
    totalTTC,
    tvaPct,
    coutPrevisionnelTravauxSnapshot: inputs.coutPrevisionnelTravaux,
    warnings: [...new Set(warnings)],
  };
}

/** Construit un `PermitProjectInputs` normalisé à partir d'un enregistrement PermitProject (Decimal Prisma → number). */
export function toPermitProjectInputs(project: Record<string, unknown>): PermitProjectInputs {
  const num = (v: unknown, fallback = 0): number => (v == null ? fallback : Number(v));
  return {
    nature: String(project.nature),
    standing: String(project.standing),
    communeId: project.communeId != null ? Number(project.communeId) : null,
    zoneType: project.zoneType != null ? String(project.zoneType) : null,
    terrainSurface: project.terrainSurface != null ? num(project.terrainSurface) : null,
    surfaceBatie: num(project.surfaceBatie, 0),
    levels: num(project.levels, 1),
    hasSousSol: Boolean(project.hasSousSol),
    nombreBatiments: num(project.nombreBatiments, 1),
    coutPrevisionnelTravaux: project.coutPrevisionnelTravaux != null ? num(project.coutPrevisionnelTravaux) : null,
    hasPiscine: Boolean(project.hasPiscine),
    hasAscenseur: Boolean(project.hasAscenseur),
    hasGroupeElectrogene: Boolean(project.hasGroupeElectrogene),
    hasForage: Boolean(project.hasForage),
    hasCloture: Boolean(project.hasCloture),
    hasVoirieInterieure: Boolean(project.hasVoirieInterieure),
    missionPhases: Array.isArray(project.missionPhases) ? (project.missionPhases as string[]) : [],
  };
}
