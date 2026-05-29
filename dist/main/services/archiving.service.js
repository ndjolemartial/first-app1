"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultArchivePolicies = seedDefaultArchivePolicies;
exports.applyActiveArchivePolicies = applyActiveArchivePolicies;
exports.scheduleAutoArchiving = scheduleAutoArchiving;
const db_service_1 = require("./db.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Politiques d'archivage prédéfinies créées au premier démarrage. Chaque
 * politique est identifiée par son `name` — la création est idempotente (on
 * ne recrée pas si une politique du même nom existe déjà, même désactivée).
 *
 * Trois mois ≈ 90 jours. Le `triggerCondition` est interprété par
 * `applyActiveArchivePolicies` : `status` (statut métier de l'entité) et
 * `olderThanDays` (ancienneté de `updatedAt`).
 */
const DEFAULT_POLICIES = [
    {
        name: 'Auto-archivage des conventions en brouillon (> 3 mois)',
        description: 'Archive automatiquement les conventions restées en statut Brouillon depuis plus de 90 jours sans modification.',
        entityType: 'CONVENTION',
        triggerCondition: { status: 'BROUILLON', olderThanDays: 90 },
    },
    {
        name: 'Auto-archivage des factures en brouillon (> 3 mois)',
        description: 'Archive automatiquement les factures restées en statut Brouillon depuis plus de 90 jours sans modification.',
        entityType: 'INVOICE',
        triggerCondition: { status: 'BROUILLON', olderThanDays: 90 },
    },
];
/**
 * Insère les politiques par défaut si elles n'existent pas encore. À appeler
 * une fois au démarrage de l'application — c'est idempotent.
 */
async function seedDefaultArchivePolicies() {
    const db = (0, db_service_1.getDb)();
    for (const p of DEFAULT_POLICIES) {
        const existing = await db.archivePolicy.findFirst({ where: { name: p.name } });
        if (existing)
            continue;
        await db.archivePolicy.create({
            data: {
                name: p.name,
                description: p.description,
                entityType: p.entityType,
                triggerCondition: p.triggerCondition,
                isActive: true,
            },
        });
        logger_1.default.info(`Default archive policy created: ${p.name}`);
    }
}
/** Sérialise une ligne Prisma en JSON (Decimal → string, BigInt → number). */
function toJsonSnapshot(row) {
    return JSON.parse(JSON.stringify(row, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
}
/**
 * Parcourt les politiques actives et archive les entités éligibles.
 *
 * Pour chaque entité matchée :
 *   1. Création d'un `ArchiveRecord` (snapshot JSON + raison `POLITIQUE_AUTOMATIQUE`).
 *   2. Soft-delete de la source (`deletedAt = now()`) — l'entité disparaît
 *      des listes habituelles mais reste restaurable depuis l'archive.
 *
 * Retourne le nombre d'entités archivées. Les erreurs par politique sont
 * journalisées sans interrompre les autres.
 */
async function applyActiveArchivePolicies() {
    const db = (0, db_service_1.getDb)();
    const policies = await db.archivePolicy.findMany({ where: { isActive: true } });
    let totalArchived = 0;
    for (const policy of policies) {
        const cond = (policy.triggerCondition ?? {});
        const status = cond?.status;
        const olderThanDays = Number(cond?.olderThanDays);
        if (!status || !Number.isFinite(olderThanDays) || olderThanDays <= 0)
            continue;
        const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
        const retentionDate = policy.retentionDays
            ? new Date(Date.now() + Number(policy.retentionDays) * 86_400_000)
            : null;
        try {
            if (policy.entityType === 'CONVENTION') {
                const items = await db.convention.findMany({
                    where: {
                        status: status,
                        deletedAt: null,
                        updatedAt: { lt: cutoff },
                    },
                });
                for (const it of items) {
                    await db.$transaction([
                        db.archiveRecord.create({
                            data: {
                                entityType: 'CONVENTION',
                                entityId: it.id,
                                entityRef: it.reference,
                                snapshot: toJsonSnapshot(it),
                                reason: 'POLITIQUE_AUTOMATIQUE',
                                reasonDetail: `Politique « ${policy.name} »`,
                                status: 'ARCHIVE',
                                retentionDate,
                            },
                        }),
                        db.convention.update({ where: { id: it.id }, data: { deletedAt: new Date() } }),
                    ]);
                    totalArchived++;
                    logger_1.default.info(`Auto-archived CONVENTION ${it.reference} (policy: ${policy.name})`);
                }
            }
            else if (policy.entityType === 'INVOICE') {
                const items = await db.invoice.findMany({
                    where: {
                        status: status,
                        deletedAt: null,
                        updatedAt: { lt: cutoff },
                    },
                });
                for (const it of items) {
                    await db.$transaction([
                        db.archiveRecord.create({
                            data: {
                                entityType: 'INVOICE',
                                entityId: it.id,
                                entityRef: it.reference,
                                snapshot: toJsonSnapshot(it),
                                reason: 'POLITIQUE_AUTOMATIQUE',
                                reasonDetail: `Politique « ${policy.name} »`,
                                status: 'ARCHIVE',
                                retentionDate,
                            },
                        }),
                        db.invoice.update({ where: { id: it.id }, data: { deletedAt: new Date() } }),
                    ]);
                    totalArchived++;
                    logger_1.default.info(`Auto-archived INVOICE ${it.reference} (policy: ${policy.name})`);
                }
            }
        }
        catch (err) {
            logger_1.default.error(`Archive policy "${policy.name}" failed: ${err.message}`);
        }
    }
    if (totalArchived > 0) {
        logger_1.default.info(`Auto-archiving run completed: ${totalArchived} entity(ies) archived`);
    }
    return { archived: totalArchived };
}
/** Fréquence d'exécution de la passe d'archivage automatique (24 h). */
const ARCHIVE_INTERVAL_MS = 24 * 60 * 60 * 1000;
let scheduledHandle = null;
/**
 * Démarre la passe initiale + planifie une exécution quotidienne tant que le
 * processus principal est vivant. À appeler une fois au démarrage.
 */
function scheduleAutoArchiving() {
    // Passe initiale en fire-and-forget pour ne pas bloquer le démarrage.
    applyActiveArchivePolicies().catch((e) => logger_1.default.error(`Initial auto-archiving pass failed: ${e.message}`));
    if (scheduledHandle)
        return;
    scheduledHandle = setInterval(() => {
        applyActiveArchivePolicies().catch((e) => logger_1.default.error(`Scheduled auto-archiving pass failed: ${e.message}`));
    }, ARCHIVE_INTERVAL_MS);
}
