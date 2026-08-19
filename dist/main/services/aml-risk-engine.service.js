"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAmlRiskThresholds = getAmlRiskThresholds;
exports.setAmlRiskThresholds = setAmlRiskThresholds;
exports.levelFromScore = levelFromScore;
exports.detectAutoFactors = detectAutoFactors;
exports.recomputeProfileRisk = recomputeProfileRisk;
const db_service_1 = require("./db.service");
const DEFAULT_THRESHOLDS = {
    faibleMax: 3,
    moyenMax: 7,
    amountThreshold: 5_000_000,
};
const THRESHOLDS_KEY = 'aml.riskThresholds';
/** Récupère les seuils de scoring (AppSetting `aml.riskThresholds`), repli sur les défauts. */
async function getAmlRiskThresholds(db = (0, db_service_1.getDb)()) {
    const row = await db.appSetting.findUnique({ where: { key: THRESHOLDS_KEY } });
    if (!row?.value)
        return DEFAULT_THRESHOLDS;
    try {
        const parsed = JSON.parse(row.value);
        return { ...DEFAULT_THRESHOLDS, ...parsed };
    }
    catch {
        return DEFAULT_THRESHOLDS;
    }
}
/** Enregistre les seuils de scoring. */
async function setAmlRiskThresholds(thresholds, db = (0, db_service_1.getDb)()) {
    await db.appSetting.upsert({
        where: { key: THRESHOLDS_KEY },
        create: { key: THRESHOLDS_KEY, value: JSON.stringify(thresholds) },
        update: { value: JSON.stringify(thresholds) },
    });
}
function levelFromScore(score, thresholds) {
    if (score <= thresholds.faibleMax)
        return 'FAIBLE';
    if (score <= thresholds.moyenMax)
        return 'MOYEN';
    return 'ELEVE';
}
/** Détecte les codes de AmlRiskFactorCatalog applicables automatiquement à partir des données réelles. */
async function detectAutoFactors(db, input) {
    const codes = [];
    const subject = input.subjectType === 'CLIENT'
        ? await db.client.findFirst({ where: { id: input.subjectId }, select: { type: true } })
        : await db.owner.findFirst({ where: { id: input.subjectId }, select: { type: true } });
    if (subject?.type && subject.type !== 'INDIVIDUEL')
        codes.push('CLIENT_ENTREPRISE');
    if (input.isPep)
        codes.push('PEP');
    if (input.hasRiskyCountryLink)
        codes.push('PAYS_A_RISQUE');
    if (input.confirmedWatchlistMatch)
        codes.push('WATCHLIST_MATCH_CONFIRME');
    if (input.transaction) {
        const thresholds = input.thresholds ?? await getAmlRiskThresholds(db);
        if (input.transaction.amount != null && input.transaction.amount > thresholds.amountThreshold) {
            codes.push('MONTANT_ELEVE');
        }
        if (input.transaction.paymentMethod === 'ESPECE')
            codes.push('PAIEMENT_ESPECES');
    }
    return codes;
}
/**
 * Recalcule et persiste riskScore/riskLevel/lastScoredAt d'un profil :
 * réécrit les liens AUTO (ajoute les manquants, retire les obsolètes), ne
 * touche jamais les liens MANUEL, puis applique les seuils configurés.
 */
async function recomputeProfileRisk(db, profileId, txContext) {
    const profile = await db.amlProfile.findUniqueOrThrow({ where: { id: profileId } });
    const thresholds = await getAmlRiskThresholds(db);
    const confirmedWatchlistMatch = (await db.amlWatchlistMatch.count({
        where: { profileId, status: 'CONFIRME' },
    })) > 0;
    const autoCodes = await detectAutoFactors(db, {
        subjectType: profile.subjectType,
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
                data: toCreate.map((riskFactorId) => ({ profileId, riskFactorId, source: 'AUTO' })),
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
