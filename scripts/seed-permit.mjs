/**
 * Seed idempotent de la bibliothèque du moteur de devis de permis de
 * construire (Module 18) : communes/districts de Côte d'Ivoire, catalogue de
 * prestations (honoraires architecte par phase de mission, BET, géomètre,
 * études, frais administratifs, taxes), tranches de surface (barèmes) et
 * quelques surcharges de taux par commune (démonstration du mécanisme).
 *
 * ⚠️ Les taux, forfaits et barèmes livrés ici sont des valeurs de référence
 * INDICATIVES (ordre de grandeur, pratique courante en Côte d'Ivoire) — à
 * vérifier et ajuster (barèmes officiels des ordres professionnels, mairies,
 * ministères concernés) avant toute exploitation commerciale, cf. CLAUDE.md
 * Module 18. Même principe que le seed du Module 17 (devis construction).
 *
 * Idempotent : réexécutable sans doublon (upsert par code unique pour le
 * catalogue de prestations ; recherche par nom pour les communes, sans
 * contrainte unique en base — doublon possible seulement si le nom est
 * modifié entre deux exécutions).
 * Usage : node scripts/seed-permit.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// ── 1. Communes & districts (Côte d'Ivoire) ─────────────────────────────
// [nom, district, région, zoneType]
const COMMUNES = [
  ['Cocody', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Plateau', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Marcory', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Treichville', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Yopougon', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Abobo', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Adjamé', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Koumassi', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Port-Bouët', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Attécoubé', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Bingerville', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Anyama', 'Abidjan', 'Lagunes', 'URBAINE'],
  ['Songon', 'Abidjan', 'Lagunes', 'RURALE'],
  ['Grand-Bassam', 'Sud-Comoé', 'Comoé', 'URBAINE'],
  ['Assinie', 'Sud-Comoé', 'Comoé', 'URBAINE'],
  ['Jacqueville', 'Grands-Ponts', 'Grands-Ponts', 'URBAINE'],
  ['Dabou', 'Grands-Ponts', 'Grands-Ponts', 'URBAINE'],
  ['Azaguié', 'Agnéby-Tiassa', 'Agnéby-Tiassa', 'RURALE'],
  ['Agboville', 'Agnéby-Tiassa', 'Agnéby-Tiassa', 'URBAINE'],
  ['Alépé', 'La Mé', 'La Mé', 'URBAINE'],
  ['Yamoussoukro', 'Yamoussoukro', 'Lacs', 'URBAINE'],
  ['Bouaké', 'Gbêkê', 'Vallée du Bandama', 'URBAINE'],
  ['Daloa', 'Haut-Sassandra', 'Sassandra', 'URBAINE'],
  ['San-Pédro', 'San-Pédro', 'Bas-Sassandra', 'URBAINE'],
  ['Korhogo', 'Poro', 'Savanes', 'URBAINE'],
  ['Man', 'Tonkpi', 'Montagnes', 'URBAINE'],
  ['Gagnoa', 'Gôh', 'Gôh-Djiboua', 'URBAINE'],
  ['Divo', 'Lôh-Djiboua', 'Gôh-Djiboua', 'RURALE'],
];

// ── 2. Catalogue de prestations, frais et taxes ─────────────────────────
// Barème interne indicatif — honoraires architecte au pourcentage du coût
// prévisionnel des travaux, ventilés par phase de mission (les 6 phases
// couvrent ~10,5 % au total, ordre de grandeur courant en pratique
// francophone pour une mission complète).
// [code, category, label, calcMode, missionPhase, defaultValue, unit, description, applicabilityRule]
const FEE_ITEMS = [
  // ── Honoraires Architecte, par phase de mission ────────────────────
  ['ARCH_ESQUISSE', 'ARCHITECTE', 'Honoraires — Esquisse', 'POURCENTAGE_COUT_TRAVAUX', 'ESQUISSE', 1.0, '%', 'Étude préliminaire, parti architectural.', null],
  ['ARCH_APS', 'ARCHITECTE', 'Honoraires — Avant-Projet Sommaire (APS)', 'POURCENTAGE_COUT_TRAVAUX', 'APS', 1.5, '%', null, null],
  ['ARCH_APD', 'ARCHITECTE', 'Honoraires — Avant-Projet Détaillé (APD)', 'POURCENTAGE_COUT_TRAVAUX', 'APD', 2.5, '%', null, null],
  ['ARCH_PLANS_EXEC', 'ARCHITECTE', "Honoraires — Plans d'exécution", 'POURCENTAGE_COUT_TRAVAUX', 'PLANS_EXECUTION', 3.0, '%', null, null],
  ['ARCH_SUIVI_CHANTIER', 'ARCHITECTE', 'Honoraires — Suivi de chantier', 'POURCENTAGE_COUT_TRAVAUX', 'SUIVI_CHANTIER', 2.0, '%', null, null],
  ['ARCH_RECEPTION', 'ARCHITECTE', 'Honoraires — Réception des travaux', 'POURCENTAGE_COUT_TRAVAUX', 'RECEPTION', 0.5, '%', null, null],
  // Prestation complémentaire déclenchée automatiquement (règle métier §3 du cahier des charges).
  ['ARCH_PLANS_PISCINE', 'ARCHITECTE', 'Plans spécifiques — Piscine', 'FORFAIT', null, 350000, 'FCFA', 'Ajouté automatiquement si le projet prévoit une piscine.', { all: [{ field: 'hasPiscine', eq: true }] }],

  // ── Honoraires BET ──────────────────────────────────────────────────
  ['BET_STRUCTURE', 'BET_STRUCTURE', 'BET Structure', 'POURCENTAGE_COUT_TRAVAUX', null, 1.0, '%', null, null],
  ['BET_STRUCT_APPROFONDIE', 'BET_STRUCTURE', 'BET Structure — étude approfondie (R+4 et plus)', 'POURCENTAGE_COUT_TRAVAUX', null, 0.4, '%', 'Ajouté automatiquement à partir de R+4 (règle métier §3).', { all: [{ field: 'levels', gte: 4 }] }],
  ['BET_FLUIDES', 'BET_FLUIDES', 'BET Fluides', 'POURCENTAGE_COUT_TRAVAUX', null, 0.5, '%', null, null],
  ['BET_ELECTRICITE', 'BET_ELECTRICITE', 'BET Électricité', 'POURCENTAGE_COUT_TRAVAUX', null, 0.5, '%', null, null],
  ['BET_VRD', 'BET_VRD', 'BET VRD', 'POURCENTAGE_COUT_TRAVAUX', null, 0.5, '%', 'Ajouté automatiquement pour un immeuble collectif (règle métier §3).', { all: [{ field: 'nature', eq: 'IMMEUBLE' }] }],
  ['BET_GEOTECHNIQUE', 'BET_GEOTECHNIQUE', 'BET Géotechnique', 'POURCENTAGE_COUT_TRAVAUX', null, 0.4, '%', null, null],

  // ── Honoraires Géomètre ─────────────────────────────────────────────
  ['GEO_LEVE', 'GEOMETRE', 'Levé topographique', 'BAREME_SURFACE', null, 0, 'FCFA', 'Forfait par tranche de superficie du terrain — voir tranches.', null],
  ['GEO_LEVE_COMPLET', 'GEOMETRE', 'Levé topographique complet', 'FORFAIT', null, 400000, 'FCFA', 'Ajouté automatiquement si le terrain dépasse 5 000 m² (règle métier §3), en complément du levé standard.', { all: [{ field: 'terrainSurface', gt: 5000 }] }],
  ['GEO_BORNAGE', 'GEOMETRE', 'Bornage', 'FORFAIT', null, 250000, 'FCFA', null, null],
  ['GEO_IMPLANTATION', 'GEOMETRE', 'Implantation', 'FORFAIT', null, 150000, 'FCFA', null, null],

  // ── Études ──────────────────────────────────────────────────────────
  ['ETUDE_SOL', 'ETUDE_SOL', 'Étude de sol', 'FORFAIT', null, 500000, 'FCFA', null, null],
  ['ETUDE_HYDROLOGIE', 'ETUDE_HYDROLOGIE', 'Étude hydraulique', 'FORFAIT', null, 300000, 'FCFA', 'Ajoutée automatiquement si terrain > 5 000 m² ou piscine prévue (règle métier §3).', { any: [{ field: 'terrainSurface', gt: 5000 }, { field: 'hasPiscine', eq: true }] }],
  ['ETUDE_HYDROGEOLOGIQUE', 'ETUDE_HYDROLOGIE', 'Étude hydrogéologique', 'FORFAIT', null, 450000, 'FCFA', 'Ajoutée automatiquement si un forage est prévu (règle métier §3).', { all: [{ field: 'hasForage', eq: true }] }],
  ['ETUDE_ENVIRONNEMENT', 'ETUDE_ENVIRONNEMENT', "Étude d'impact environnemental", 'FORFAIT', null, 800000, 'FCFA', 'Exigée en pratique pour les projets de plus grande envergure.', { any: [{ field: 'nature', in: ['IMMEUBLE', 'USINE', 'ENTREPOT', 'HOTEL', 'COMMERCE'] }] }],
  ['ETUDE_ASSAINISSEMENT', 'ETUDE_ENVIRONNEMENT', "Étude d'assainissement", 'FORFAIT', null, 350000, 'FCFA', 'Ajoutée automatiquement pour un immeuble collectif (règle métier §3).', { all: [{ field: 'nature', eq: 'IMMEUBLE' }] }],
  ['ETUDE_CIRCULATION', 'ETUDE_ENVIRONNEMENT', 'Étude de circulation', 'FORFAIT', null, 350000, 'FCFA', 'Ajoutée automatiquement pour un immeuble collectif (règle métier §3).', { all: [{ field: 'nature', eq: 'IMMEUBLE' }] }],
  ['ETUDE_INCENDIE', 'ETUDE_INCENDIE', 'Étude sécurité incendie', 'FORFAIT', null, 400000, 'FCFA', 'Ajoutée automatiquement à partir de R+4, ou pour les ERP (hôtel/commerce) (règle métier §3).', { any: [{ field: 'levels', gte: 4 }, { field: 'nature', in: ['HOTEL', 'COMMERCE'] }] }],

  // ── Frais administratifs (commune / ministère / superficie / type) ──
  ['FRAIS_PERMIS_CONSTRUIRE', 'FRAIS_ADMINISTRATIF', 'Frais de délivrance du permis de construire', 'BAREME_SURFACE', null, 0, 'FCFA', 'Forfait par tranche de surface bâtie (barème communal indicatif).', null],
  ['FRAIS_DOSSIER', 'FRAIS_ADMINISTRATIF', 'Frais de constitution du dossier', 'FORFAIT', null, 75000, 'FCFA', null, null],
  ['FRAIS_VOIRIE', 'FRAIS_ADMINISTRATIF', "Autorisation de voirie", 'FORFAIT', null, 120000, 'FCFA', 'Ajoutée automatiquement si une voirie intérieure est prévue.', { all: [{ field: 'hasVoirieInterieure', eq: true }] }],
  ['CONTROLE_TECHNIQUE', 'FRAIS_ADMINISTRATIF', 'Contrôle technique', 'POURCENTAGE_COUT_TRAVAUX', null, 0.6, '%', 'Ajouté automatiquement à partir de R+4 (règle métier §3).', { all: [{ field: 'levels', gte: 4 }] }],

  // ── Taxes ────────────────────────────────────────────────────────────
  ['TAXE_TIMBRE', 'TAXE', 'Droits de timbre', 'PAR_M2_BATI', null, 500, 'FCFA/m²', null, null],
  ['TAXE_REDEVANCE', 'TAXE', 'Redevance de construction', 'FORFAIT', null, 100000, 'FCFA', null, null],
  ['TAXE_COMMUNALE', 'TAXE', 'Taxe communale de construction', 'PAR_M2_BATI', null, 300, 'FCFA/m²', 'Variable selon la commune — voir surcharges de taux.', null],
];

// ── 3. Tranches de surface (BAREME_SURFACE) ─────────────────────────────
// [feeItemCode, [[minSurface, maxSurface|null, value, label], ...]]
const SURFACE_BRACKETS = [
  ['FRAIS_PERMIS_CONSTRUIRE', [
    [0, 150, 150000, '0 – 150 m²'],
    [150, 300, 300000, '150 – 300 m²'],
    [300, 500, 500000, '300 – 500 m²'],
    [500, 1000, 900000, '500 – 1 000 m²'],
    [1000, null, 1500000, '> 1 000 m²'],
  ]],
  ['GEO_LEVE', [
    [0, 500, 150000, '0 – 500 m²'],
    [500, 1000, 250000, '500 – 1 000 m²'],
    [1000, 5000, 450000, '1 000 – 5 000 m²'],
    [5000, null, 800000, '> 5 000 m²'],
  ]],
];

// ── 4. Surcharges de taux par commune (démonstration du mécanisme) ─────
// Taxe communale plus élevée dans les communes d'affaires, plus basse en périphérie.
const RATE_OVERRIDES = [
  ['TAXE_COMMUNALE', 'Cocody', 450],
  ['TAXE_COMMUNALE', 'Plateau', 500],
  ['TAXE_COMMUNALE', 'Marcory', 400],
  ['TAXE_COMMUNALE', 'Yopougon', 250],
  ['TAXE_COMMUNALE', 'Abobo', 200],
];

async function seedCommunes() {
  for (const [nom, district, region, zoneType] of COMMUNES) {
    const existing = await db.permitCommune.findFirst({ where: { nom, deletedAt: null } });
    if (existing) {
      await db.permitCommune.update({ where: { id: existing.id }, data: { district, region, zoneType } });
    } else {
      await db.permitCommune.create({ data: { nom, district, region, zoneType, isActive: true } });
    }
  }
  console.log(`✓ ${COMMUNES.length} communes`);
}

async function seedFeeItems() {
  let sortOrder = 0;
  const idByCode = new Map();
  for (const [code, category, label, calcMode, missionPhase, defaultValue, unit, description, applicabilityRule] of FEE_ITEMS) {
    const data = {
      category, label, calcMode, missionPhase, defaultValue: String(defaultValue), unit,
      description, applicabilityRule, sortOrder: sortOrder++, isActive: true,
    };
    const item = await db.permitFeeItem.upsert({
      where: { code }, create: { code, ...data }, update: data,
    });
    idByCode.set(code, item.id);
  }
  console.log(`✓ ${FEE_ITEMS.length} prestations du catalogue`);
  return idByCode;
}

async function seedSurfaceBrackets(idByCode) {
  let total = 0;
  for (const [code, brackets] of SURFACE_BRACKETS) {
    const feeItemId = idByCode.get(code);
    if (!feeItemId) continue;
    await db.permitFeeSurfaceBracket.deleteMany({ where: { feeItemId } });
    await db.permitFeeSurfaceBracket.createMany({
      data: brackets.map(([minSurface, maxSurface, value, label], i) => ({
        feeItemId, minSurface: String(minSurface), maxSurface: maxSurface != null ? String(maxSurface) : null,
        value: String(value), label, sortOrder: i,
      })),
    });
    total += brackets.length;
  }
  console.log(`✓ ${total} tranches de surface`);
}

async function seedRateOverrides(idByCode) {
  let count = 0;
  for (const [feeItemCode, communeNom, value] of RATE_OVERRIDES) {
    const feeItemId = idByCode.get(feeItemCode);
    if (!feeItemId) continue;
    const commune = await db.permitCommune.findFirst({ where: { nom: communeNom, deletedAt: null } });
    if (!commune) continue;
    // Upsert manuel : la clé composite `@@unique([feeItemId, nature, standing, communeId])`
    // ne peut pas être utilisée telle quelle dans `where` de `upsert` dès que
    // nature/standing valent `null` (Prisma refuse `null` dans une clé composite).
    const existing = await db.permitFeeRateOverride.findFirst({
      where: { feeItemId, nature: null, standing: null, communeId: commune.id },
    });
    if (existing) {
      await db.permitFeeRateOverride.update({ where: { id: existing.id }, data: { value: String(value) } });
    } else {
      await db.permitFeeRateOverride.create({ data: { feeItemId, communeId: commune.id, value: String(value) } });
    }
    count++;
  }
  console.log(`✓ ${count} surcharges de taux`);
}

async function main() {
  console.log('Seed du moteur de devis de permis de construire (Module 18)…');
  await seedCommunes();
  const idByCode = await seedFeeItems();
  await seedSurfaceBrackets(idByCode);
  await seedRateOverrides(idByCode);
  console.log('Terminé. Valeurs INDICATIVES — à vérifier avant exploitation commerciale.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
