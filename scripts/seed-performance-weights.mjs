/**
 * Seed idempotent des profils de pondération de performance (par poste).
 *
 * Pour chaque poste déjà créé (référentiel `JobPosition`), on crée / met à jour
 * un profil `PerformanceWeightProfile` + ses lignes `PerformanceWeightLine`, avec
 * des poids reflétant les fonctions, responsabilités et exigences du poste et les
 * pratiques usuelles d'une agence immobilière (Côte d'Ivoire).
 *
 * - Poids exprimés en % (somme = 100 par profil) ; le moteur les ramène de toute
 *   façon à 100 % relativement aux KPI réellement mesurés.
 * - Rapprochement poste → modèle par mots-clés (tolérant aux variantes/typos).
 * - Idempotent : réexécutable sans doublon (mise à jour du profil existant du
 *   même poste). N'écrase que les profils qu'il gère (nom préfixé « Pondération »).
 *
 * Usage : node scripts/seed-performance-weights.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Modèles de pondération par famille de poste (clé KPI → poids %).
const TEMPLATES = {
  DG: {
    ENCAISSEMENT_AMOUNT: 30, SALES_AMOUNT: 25, PROSPECT_CONVERSION_RATE: 12,
    SALES_COUNT: 10, RESILIATION_COUNT: 10, ATTENDANCE_RATE: 13,
  },
  DIR_MARKETING: {
    SALES_AMOUNT: 25, ENCAISSEMENT_AMOUNT: 20, PROSPECT_CONVERSION_RATE: 15,
    SALES_COUNT: 10, CRM_ACTIVITIES_DONE: 10, RESILIATION_COUNT: 8, ATTENDANCE_RATE: 12,
  },
  COMMERCIAL: {
    SALES_AMOUNT: 25, SALES_COUNT: 15, PROSPECT_CONVERSION_RATE: 15, CRM_VISITS: 12,
    ENCAISSEMENT_AMOUNT: 10, CRM_ACTIVITIES_DONE: 8, ATTENDANCE_RATE: 10, RESILIATION_COUNT: 5,
  },
  COMPTABLE: {
    ENCAISSEMENT_AMOUNT: 45, ATTENDANCE_RATE: 25, CRM_ACTIVITIES_DONE: 15, ABSENCE_DAYS: 15,
  },
  TECHNIQUE: {
    CRM_VISITS: 30, CRM_ACTIVITIES_DONE: 25, ATTENDANCE_RATE: 25, ABSENCE_DAYS: 20,
  },
  ASSISTANTE: {
    CRM_ACTIVITIES_DONE: 30, ATTENDANCE_RATE: 30, ABSENCE_DAYS: 20,
    PROSPECT_CONVERSION_RATE: 10, CRM_VISITS: 10,
  },
  // Assistant(e) commercial(e) : support de la force de vente — qualification /
  // suivi des prospects, activité CRM, visites, contribution (partielle) aux
  // ventes et à l'encaissement, sans signer directement au même niveau qu'un
  // commercial. Entre l'assistante de direction et le commercial.
  ASSISTANT_COMMERCIAL: {
    CRM_ACTIVITIES_DONE: 25, PROSPECT_CONVERSION_RATE: 20, CRM_VISITS: 15,
    SALES_AMOUNT: 10, ENCAISSEMENT_AMOUNT: 10, ATTENDANCE_RATE: 15, ABSENCE_DAYS: 5,
  },
  INFOGRAPHE_CM: {
    CRM_ACTIVITIES_DONE: 35, ATTENDANCE_RATE: 25, PROSPECT_CONVERSION_RATE: 20, ABSENCE_DAYS: 20,
  },
  // Directrice/Directeur des opérations : pilotage de l'exécution opérationnelle
  // (livraison → encaissement), coordination et supervision terrain, qualité
  // (maîtrise des résiliations), sans signature de ventes au premier plan.
  DIR_OPERATIONS: {
    ENCAISSEMENT_AMOUNT: 25, CRM_ACTIVITIES_DONE: 20, SALES_AMOUNT: 15, CRM_VISITS: 12,
    RESILIATION_COUNT: 10, ATTENDANCE_RATE: 10, PROSPECT_CONVERSION_RATE: 8,
  },
  // Responsable du service juridique : traitement des dossiers/actes (activité),
  // maîtrise du contentieux (résiliations, LOWER), appui au recouvrement,
  // assiduité. Pas d'attribution commerciale directe.
  JURIDIQUE: {
    CRM_ACTIVITIES_DONE: 30, ATTENDANCE_RATE: 25, RESILIATION_COUNT: 15,
    ENCAISSEMENT_AMOUNT: 15, ABSENCE_DAYS: 15,
  },
  // Responsable commercial : pilote la force de vente — volume et montant des
  // ventes, conversion des prospects, CA, avec pénalité sur les résiliations.
  RESP_COMMERCIAL: {
    SALES_AMOUNT: 22, PROSPECT_CONVERSION_RATE: 18, SALES_COUNT: 15,
    ENCAISSEMENT_AMOUNT: 15, RESILIATION_COUNT: 10, ATTENDANCE_RATE: 12, CRM_ACTIVITIES_DONE: 8,
  },
  // Technicien chantier : présence et suivi sur site (visites), tâches/rapports
  // (activité), assiduité, faibles absences. Pas de KPI commerciaux.
  TECHNICIEN_CHANTIER: {
    CRM_VISITS: 35, CRM_ACTIVITIES_DONE: 25, ATTENDANCE_RATE: 25, ABSENCE_DAYS: 15,
  },
  // Topographe : relevés/visites terrain et livrables techniques (dossiers,
  // plans), assiduité, faibles absences.
  TOPOGRAPHE: {
    CRM_VISITS: 30, CRM_ACTIVITIES_DONE: 30, ATTENDANCE_RATE: 25, ABSENCE_DAYS: 15,
  },
  // Repli pour tout poste non reconnu : assiduité + activité opérationnelle.
  GENERIC: {
    CRM_ACTIVITIES_DONE: 35, ATTENDANCE_RATE: 35, ABSENCE_DAYS: 30,
  },
};

/** Normalise un libellé (majuscules, sans accents) pour le rapprochement. */
function norm(s) {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().trim();
}

/** Choisit la famille de modèle selon les mots-clés du libellé de poste.
 *  L'ordre compte : les postes de direction/marketing avant le commercial simple. */
function pickTemplateKey(label) {
  const n = norm(label);
  const isCommercial = n.includes('COMMERCIAL') || n.includes('COMERCIAL');
  if (n.includes('MARKETING')) return 'DIR_MARKETING';           // Directrice marketing & commerciale
  if (n.includes('OPERATION')) return 'DIR_OPERATIONS';          // Directrice des opérations
  if (n.includes('DIRECT') && /GEN[ER]*RAL/.test(n)) return 'DG'; // Directeur général (tolère « GENRAL »)
  if (n.includes('JURID')) return 'JURIDIQUE';                   // Responsable service juridique
  if (n.includes('COMPTABL')) return 'COMPTABLE';
  if (n.includes('CHANTIER')) return 'TECHNICIEN_CHANTIER';      // Technicien chantier
  if (n.includes('TOPOGRAPH')) return 'TOPOGRAPHE';             // Topographe
  if (n.includes('TECHNIQUE')) return 'TECHNIQUE';              // Responsable technique
  if (n.includes('INFOGRAPH') || n.includes('COMMUNITY')) return 'INFOGRAPHE_CM';
  // Assistant(e) commercial(e) AVANT l'assistante de direction (contient ASSISTANT).
  if (n.includes('ASSISTANT') && isCommercial) return 'ASSISTANT_COMMERCIAL';
  if (n.includes('ASSISTANT')) return 'ASSISTANTE';
  // Responsable commercial AVANT le commercial simple (agent).
  if (n.includes('RESPONSABLE') && isCommercial) return 'RESP_COMMERCIAL';
  if (isCommercial) return 'COMMERCIAL'; // agent commercial
  return 'GENERIC';
}

async function main() {
  const kpis = await db.kpiDefinition.findMany({ where: { deletedAt: null, isActive: true } });
  const kpiIdByCode = new Map(kpis.map((k) => [k.code, k.id]));

  const postes = await db.jobPosition.findMany({ where: { deletedAt: null }, orderBy: { label: 'asc' } });
  if (postes.length === 0) {
    console.log('Aucun poste (JobPosition) trouvé — rien à faire.');
    return;
  }

  let created = 0, updated = 0;
  for (const jp of postes) {
    const tplKey = pickTemplateKey(jp.label);
    const tpl = TEMPLATES[tplKey];
    // Résout les lignes en ignorant les KPI absents du catalogue.
    const lines = [];
    for (const [code, weight] of Object.entries(tpl)) {
      const kpiId = kpiIdByCode.get(code);
      if (kpiId) lines.push({ kpiDefinitionId: kpiId, weight });
      else console.warn(`  ⚠ KPI "${code}" absent du catalogue — ignoré pour « ${jp.label} »`);
    }
    const name = `Pondération ${jp.label}`;

    const existing = await db.performanceWeightProfile.findFirst({
      where: { deletedAt: null, poste: jp.label },
      orderBy: { updatedAt: 'desc' },
    });

    await db.$transaction(async (tx) => {
      let profileId;
      if (existing) {
        await tx.performanceWeightProfile.update({
          where: { id: existing.id },
          data: { name, isActive: true },
        });
        await tx.performanceWeightLine.deleteMany({ where: { profileId: existing.id } });
        profileId = existing.id;
        updated++;
      } else {
        const p = await tx.performanceWeightProfile.create({
          data: { poste: jp.label, name, isActive: true },
        });
        profileId = p.id;
        created++;
      }
      if (lines.length) {
        await tx.performanceWeightLine.createMany({
          data: lines.map((l) => ({ profileId, kpiDefinitionId: l.kpiDefinitionId, weight: l.weight })),
        });
      }
    });

    const sum = lines.reduce((s, l) => s + l.weight, 0);
    console.log(`  ${existing ? '↻' : '✓'} « ${jp.label} » → ${tplKey} (${lines.length} KPI, total ${sum}%)`);
  }

  console.log(`\nTerminé : ${created} profil(s) créé(s), ${updated} mis à jour.`);
}

main()
  .catch((e) => { console.error('ERREUR:', e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
