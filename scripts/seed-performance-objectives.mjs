/**
 * (Ré)initialise les objectifs de performance PAR POSTE.
 *
 * 1) Vide la table `PerformanceObjective` (aucune référence attendue).
 * 2) Pour chaque poste doté d'un profil de pondération actif
 *    (`PerformanceWeightProfile`), crée un objectif ANNUEL par KPI du profil :
 *      - measureType = AUTO (le KPI est calculé automatiquement) ;
 *      - weight = poids du KPI dans la pondération du poste (fidélité au modèle) ;
 *      - targetValue = cible réaliste calibrée par rôle (voir BASE/OVERRIDES).
 *
 * Cibles ANNUELLES (agence immobilière, Côte d'Ivoire ; montants en FCFA) — ce
 * sont des valeurs de départ à calibrer selon l'historique réel de l'entreprise.
 *
 * Idempotent : réexécutable (vide puis recrée). Usage :
 *   node scripts/seed-performance-objectives.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const YEAR = 2026;

// ── Rapprochement poste → famille (identique au seed des pondérations) ─────────
function norm(s) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}
function pickTemplateKey(label) {
  const n = norm(label);
  const isCommercial = n.includes('COMMERCIAL') || n.includes('COMERCIAL');
  if (n.includes('MARKETING')) return 'DIR_MARKETING';
  if (n.includes('OPERATION')) return 'DIR_OPERATIONS';
  if (n.includes('DIRECT') && /GEN[ER]*RAL/.test(n)) return 'DG';
  if (n.includes('JURID')) return 'JURIDIQUE';
  if (n.includes('COMPTABL')) return 'COMPTABLE';
  if (n.includes('CHANTIER')) return 'TECHNICIEN_CHANTIER';
  if (n.includes('TOPOGRAPH')) return 'TOPOGRAPHE';
  if (n.includes('TECHNIQUE')) return 'TECHNIQUE';
  if (n.includes('INFOGRAPH') || n.includes('COMMUNITY')) return 'INFOGRAPHE_CM';
  if (n.includes('ASSISTANT') && isCommercial) return 'ASSISTANT_COMMERCIAL';
  if (n.includes('ASSISTANT')) return 'ASSISTANTE';
  if (n.includes('RESPONSABLE') && isCommercial) return 'RESP_COMMERCIAL';
  if (isCommercial) return 'COMMERCIAL';
  return 'GENERIC';
}

// ── Cibles annuelles ──────────────────────────────────────────────────────────
// Valeurs par défaut par KPI (code) ; l'unité provient du KpiDefinition.
const BASE = {
  SALES_COUNT: 12,
  SALES_AMOUNT: 150_000_000,
  COMMISSION_AMOUNT: 9_000_000,
  ENCAISSEMENT_AMOUNT: 120_000_000,
  CRM_ACTIVITIES_DONE: 240,
  CRM_VISITS: 96,
  ATTENDANCE_RATE: 95,
  ABSENCE_DAYS: 6,             // plafond (LOWER_BETTER)
  PROSPECT_CONVERSION_RATE: 25,
  RESILIATION_COUNT: 3,        // plafond (LOWER_BETTER)
};

// Surcharges par famille de poste (ne renseigner que ce qui diffère de BASE).
const OVERRIDES = {
  DG:                  { SALES_AMOUNT: 350_000_000, SALES_COUNT: 15, ENCAISSEMENT_AMOUNT: 500_000_000, PROSPECT_CONVERSION_RATE: 30, RESILIATION_COUNT: 4 },
  DIR_MARKETING:       { SALES_AMOUNT: 300_000_000, SALES_COUNT: 20, ENCAISSEMENT_AMOUNT: 250_000_000, PROSPECT_CONVERSION_RATE: 30, RESILIATION_COUNT: 4 },
  DIR_OPERATIONS:      { SALES_AMOUNT: 120_000_000, ENCAISSEMENT_AMOUNT: 300_000_000, CRM_VISITS: 120, PROSPECT_CONVERSION_RATE: 25, RESILIATION_COUNT: 4 },
  RESP_COMMERCIAL:     { SALES_AMOUNT: 250_000_000, SALES_COUNT: 18, ENCAISSEMENT_AMOUNT: 200_000_000, PROSPECT_CONVERSION_RATE: 30, RESILIATION_COUNT: 4 },
  COMMERCIAL:          { RESILIATION_COUNT: 2 },
  ASSISTANT_COMMERCIAL:{ SALES_AMOUNT: 60_000_000, ENCAISSEMENT_AMOUNT: 50_000_000, CRM_VISITS: 72, PROSPECT_CONVERSION_RATE: 20 },
  COMPTABLE:           { ENCAISSEMENT_AMOUNT: 400_000_000, CRM_ACTIVITIES_DONE: 300 },
  JURIDIQUE:           { ENCAISSEMENT_AMOUNT: 60_000_000, CRM_ACTIVITIES_DONE: 300, RESILIATION_COUNT: 5 },
  TECHNIQUE:           { CRM_VISITS: 120, CRM_ACTIVITIES_DONE: 200 },
  TECHNICIEN_CHANTIER: { CRM_VISITS: 150, CRM_ACTIVITIES_DONE: 200 },
  TOPOGRAPHE:          { CRM_VISITS: 150, CRM_ACTIVITIES_DONE: 220 },
  ASSISTANTE:          { CRM_ACTIVITIES_DONE: 300, CRM_VISITS: 60, PROSPECT_CONVERSION_RATE: 15 },
  INFOGRAPHE_CM:       { CRM_ACTIVITIES_DONE: 320, PROSPECT_CONVERSION_RATE: 20 },
};

function targetFor(code, tplKey) {
  const o = OVERRIDES[tplKey];
  if (o && o[code] != null) return o[code];
  return BASE[code] ?? null;
}

async function main() {
  const profiles = await db.performanceWeightProfile.findMany({
    where: { deletedAt: null, isActive: true },
    include: { lines: { include: { kpiDefinition: true } } },
    orderBy: { poste: 'asc' },
  });
  if (profiles.length === 0) {
    console.log('Aucun profil de pondération actif — lancez d’abord seed-performance-weights.mjs.');
    return;
  }

  // 1) Vider la table des objectifs.
  const del = await db.performanceObjective.deleteMany({});
  console.log(`Table PerformanceObjective vidée : ${del.count} objectif(s) supprimé(s).\n`);

  // 2) Recréer par poste.
  let created = 0;
  for (const p of profiles) {
    const tplKey = pickTemplateKey(p.poste);
    const rows = [];
    for (const l of p.lines) {
      const kpi = l.kpiDefinition;
      if (!kpi) continue;
      const target = targetFor(kpi.code, tplKey);
      rows.push({
        poste: p.poste,
        employeeId: null,
        cycleType: 'ANNUEL',
        year: YEAR,
        quarter: null,
        title: kpi.label,
        description: `Objectif annuel ${YEAR} — ${p.poste} · pondération ${Number(l.weight)}% (mesure automatique du KPI).`,
        weight: Number(l.weight),
        targetValue: target,
        unit: kpi.unit ?? null,
        kpiDefinitionId: kpi.id,
        measureType: 'AUTO',
        progress: 0,
        status: 'EN_COURS',
        createdById: null,
      });
    }
    if (rows.length) {
      await db.performanceObjective.createMany({ data: rows });
      created += rows.length;
    }
    console.log(`  ✓ ${p.poste} (${tplKey}) → ${rows.length} objectif(s)`);
  }
  console.log(`\nTerminé : ${created} objectif(s) créé(s) pour ${profiles.length} poste(s), année ${YEAR}.`);
}

main()
  .catch((e) => { console.error('ERREUR:', e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
