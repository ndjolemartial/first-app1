/**
 * Seed idempotent du module Conformité LBC/FT/FP (Module 19) : catalogue des
 * facteurs de risque (checklist pondérée utilisée par le moteur de scoring,
 * `aml-risk-engine.service.ts`) et seuils de scoring par défaut.
 *
 * ⚠️ Les facteurs, leurs poids et les seuils livrés ici sont des valeurs de
 * référence INDICATIVES — à valider avec le chargé de conformité désigné
 * avant toute exploitation commerciale, cf. CLAUDE.md Module 19.
 *
 * Le référentiel de vigilance (`AmlWatchlist`) est volontairement laissé
 * VIDE : aucune liste réelle de sanctions/PPE n'est disponible via une API
 * locale fiable — il doit être alimenté manuellement par la personne en
 * charge de la conformité à partir des listes publiées (ONU, UE, GIABA,
 * liste nationale). Ne jamais fabriquer de nom fictif qui pourrait être
 * confondu avec une vraie donnée réglementaire.
 *
 * Idempotent : réexécutable sans doublon (upsert par `code` unique pour le
 * catalogue, upsert par `key` pour les seuils).
 * Usage : node scripts/seed-aml.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// [code, label, category, weight, isAutoDetected, description]
const RISK_FACTORS = [
  ['CLIENT_ENTREPRISE', 'Client de type personne morale', 'Client', 2, true,
    'Une personne morale nécessite l’identification des bénéficiaires effectifs.'],
  ['STRUCTURE_PROPRIETE_COMPLEXE', 'Structure de propriété complexe ou opaque', 'Client', 3, false,
    'Chaîne de détention difficile à établir, bénéficiaires effectifs multiples ou peu clairs.'],
  ['PEP', 'Personne politiquement exposée (PPE)', 'PPE', 4, true,
    'Le client ou le bénéficiaire effectif exerce ou a exercé une fonction politique importante.'],
  ['PEP_PROCHE', 'Proche ou associé connu d’une PPE', 'PPE', 3, false,
    'Lien familial ou professionnel étroit avec une personne politiquement exposée.'],
  ['MONTANT_ELEVE', 'Montant de transaction élevé', 'Transaction', 2, true,
    'Montant dépassant le seuil paramétrable (Paramètres → Conformité LBC/FT/FP → Seuils de scoring).'],
  ['PAIEMENT_ESPECES', 'Paiement en espèces', 'Transaction', 2, true,
    'Mode de paiement présentant un risque de traçabilité plus faible.'],
  ['VIREMENTS_INTERNATIONAUX_FREQUENTS', 'Virements internationaux fréquents ou inhabituels', 'Transaction', 2, false,
    'Multiplicité de virements transfrontaliers sans justification économique claire.'],
  ['URGENCE_INHABITUELLE', 'Urgence inhabituelle de la transaction', 'Comportemental', 2, false,
    'Pression pour conclure rapidement, sans égard aux modalités habituelles.'],
  ['RETICENCE_DOCUMENTS', 'Réticence à fournir des documents ou justificatifs', 'Comportemental', 3, false,
    'Le client évite ou retarde la production des pièces demandées.'],
  ['PAYS_A_RISQUE', 'Lien avec un pays à risque', 'Géographique', 3, true,
    'Résidence, nationalité ou origine des fonds liée à un pays à risque (liste GAFI, sanctions…).'],
  ['VENTE_A_DISTANCE', 'Relation à distance, sans rencontre physique', 'Produit-Canal', 1, false,
    'Absence de face-à-face pouvant limiter la vérification d’identité.'],
  ['WATCHLIST_MATCH_CONFIRME', 'Correspondance confirmée sur une liste de vigilance', 'Watchlist', 10, true,
    'Rapprochement positif et confirmé contre le référentiel de vigilance (sanctions/PPE).'],
];

async function seedRiskFactors() {
  for (const [code, label, category, weight, isAutoDetected, description] of RISK_FACTORS) {
    await db.amlRiskFactorCatalog.upsert({
      where: { code },
      create: { code, label, category, weight, isAutoDetected, description },
      update: { label, category, weight, isAutoDetected, description },
    });
  }
  console.log(`✓ ${RISK_FACTORS.length} facteurs de risque`);
}

const THRESHOLDS_KEY = 'aml.riskThresholds';
const DEFAULT_THRESHOLDS = { faibleMax: 3, moyenMax: 7, amountThreshold: 5_000_000 };

async function seedThresholds() {
  const existing = await db.appSetting.findUnique({ where: { key: THRESHOLDS_KEY } });
  if (existing) { console.log('✓ Seuils de scoring déjà configurés (inchangés)'); return; }
  await db.appSetting.create({ data: { key: THRESHOLDS_KEY, value: JSON.stringify(DEFAULT_THRESHOLDS) } });
  console.log('✓ Seuils de scoring par défaut créés');
}

async function main() {
  console.log('Seed du module Conformité LBC/FT/FP (Module 19)…');
  await seedRiskFactors();
  await seedThresholds();
  console.log('Référentiel de vigilance (AmlWatchlist) laissé vide par conception — à alimenter manuellement.');
  console.log('Terminé. Valeurs INDICATIVES — à vérifier avant exploitation commerciale.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
