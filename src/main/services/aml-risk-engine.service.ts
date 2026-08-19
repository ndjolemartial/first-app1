import { Prisma } from '@prisma/client';
import { getDb } from './db.service';

type Db = ReturnType<typeof getDb>;
type DbOrTx = Db | Prisma.TransactionClient;

/**
 * Moteur de scoring LBC/FT — volontairement simple (checklist de facteurs
 * pondérés, pas un moteur de règles déclaratif à la Construction/Permis).
 *
 * ⚠️ Les seuils par défaut sont des valeurs de référence PARAMÉTRABLES
 * (Paramètres → Conformité LBC/FT → Seuils de scoring). À vérifier avec le
 * chargé de conformité désigné avant toute exploitation.
 */

export interface AmlRiskThresholds {
  /** Score <= faibleMax → FAIBLE. */
  faibleMax: number;
  /** Score <= moyenMax (et > faibleMax) → MOYEN, sinon ELEVE. */
  moyenMax: number;
  /** Montant (FCFA) au-delà duquel le facteur MONTANT_ELEVE se déclenche. */
  amountThreshold: number;
}

const DEFAULT_THRESHOLDS: AmlRiskThresholds = {
  faibleMax: 3,
  moyenMax: 7,
  amountThreshold: 5_000_000,
};

const THRESHOLDS_KEY = 'aml.riskThresholds';

/** Récupère les seuils de scoring (AppSetting `aml.riskThresholds`), repli sur les défauts. */
export async function getAmlRiskThresholds(db: DbOrTx = getDb()): Promise<AmlRiskThresholds> {
  const row = await db.appSetting.findUnique({ where: { key: THRESHOLDS_KEY } });
  if (!row?.value) return DEFAULT_THRESHOLDS;
  try {
    const parsed = JSON.parse(row.value);
    return { ...DEFAULT_THRESHOLDS, ...parsed };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

/** Enregistre les seuils de scoring. */
export async function setAmlRiskThresholds(thresholds: AmlRiskThresholds, db: Db = getDb()): Promise<void> {
  await db.appSetting.upsert({
    where: { key: THRESHOLDS_KEY },
    create: { key: THRESHOLDS_KEY, value: JSON.stringify(thresholds) },
    update: { value: JSON.stringify(thresholds) },
  });
}

export function levelFromScore(score: number, thresholds: AmlRiskThresholds): 'FAIBLE' | 'MOYEN' | 'ELEVE' {
  if (score <= thresholds.faibleMax) return 'FAIBLE';
  if (score <= thresholds.moyenMax) return 'MOYEN';
  return 'ELEVE';
}

export interface AutoFactorInput {
  subjectType: 'CLIENT' | 'OWNER';
  subjectId: number;
  isPep: boolean;
  hasRiskyCountryLink: boolean;
  confirmedWatchlistMatch: boolean;
  transaction?: { amount: number | null; paymentMethod: string | null } | null;
  thresholds?: AmlRiskThresholds;
}

/** Détecte les codes de AmlRiskFactorCatalog applicables automatiquement à partir des données réelles. */
export async function detectAutoFactors(db: DbOrTx, input: AutoFactorInput): Promise<string[]> {
  const codes: string[] = [];

  const subject = input.subjectType === 'CLIENT'
    ? await db.client.findFirst({ where: { id: input.subjectId }, select: { type: true } })
    : await db.owner.findFirst({ where: { id: input.subjectId }, select: { type: true } });
  if (subject?.type && subject.type !== 'INDIVIDUEL') codes.push('CLIENT_ENTREPRISE');

  if (input.isPep) codes.push('PEP');
  if (input.hasRiskyCountryLink) codes.push('PAYS_A_RISQUE');
  if (input.confirmedWatchlistMatch) codes.push('WATCHLIST_MATCH_CONFIRME');

  if (input.transaction) {
    const thresholds = input.thresholds ?? await getAmlRiskThresholds(db);
    if (input.transaction.amount != null && input.transaction.amount > thresholds.amountThreshold) {
      codes.push('MONTANT_ELEVE');
    }
    if (input.transaction.paymentMethod === 'ESPECE') codes.push('PAIEMENT_ESPECES');
  }

  return codes;
}

/**
 * Recalcule et persiste riskScore/riskLevel/lastScoredAt d'un profil :
 * réécrit les liens AUTO (ajoute les manquants, retire les obsolètes), ne
 * touche jamais les liens MANUEL, puis applique les seuils configurés.
 */
export async function recomputeProfileRisk(
  db: Db,
  profileId: number,
  txContext?: { amount: number | null; paymentMethod: string | null } | null,
) {
  const profile = await db.amlProfile.findUniqueOrThrow({ where: { id: profileId } });
  const thresholds = await getAmlRiskThresholds(db);

  const confirmedWatchlistMatch = (await db.amlWatchlistMatch.count({
    where: { profileId, status: 'CONFIRME' },
  })) > 0;

  const autoCodes = await detectAutoFactors(db, {
    subjectType: profile.subjectType as 'CLIENT' | 'OWNER',
    subjectId: profile.subjectId,
    isPep: profile.isPep,
    hasRiskyCountryLink: profile.hasRiskyCountryLink,
    confirmedWatchlistMatch,
    transaction: txContext,
    thresholds,
  });

  const catalogEntries = autoCodes.length
    ? await db.amlRiskFactorCatalog.findMany({
      where: { code: { in: autoCodes }, isActive: true, deletedAt: null },
      select: { id: true },
    })
    : [];
  const desiredFactorIds = new Set(catalogEntries.map((c) => c.id));

  return db.$transaction(async (tx) => {
    const existingLinks = await tx.amlProfileRiskFactor.findMany({ where: { profileId } });
    const toDelete = existingLinks.filter((l) => l.source === 'AUTO' && !desiredFactorIds.has(l.riskFactorId));
    if (toDelete.length) {
      await tx.amlProfileRiskFactor.deleteMany({ where: { id: { in: toDelete.map((l) => l.id) } } });
    }
    const existingFactorIds = new Set(existingLinks.map((l) => l.riskFactorId));
    const toCreate = [...desiredFactorIds].filter((id) => !existingFactorIds.has(id));
    if (toCreate.length) {
      await tx.amlProfileRiskFactor.createMany({
        data: toCreate.map((riskFactorId) => ({ profileId, riskFactorId, source: 'AUTO' as const })),
      });
    }

    const allLinks = await tx.amlProfileRiskFactor.findMany({
      where: { profileId },
      include: { riskFactor: true },
    });
    const score = allLinks
      .filter((l) => l.riskFactor.isActive && !l.riskFactor.deletedAt)
      .reduce((sum, l) => sum + l.riskFactor.weight, 0);
    const riskLevel = levelFromScore(score, thresholds);

    return tx.amlProfile.update({
      where: { id: profileId },
      data: { riskScore: score, riskLevel, lastScoredAt: new Date() },
    });
  });
}
