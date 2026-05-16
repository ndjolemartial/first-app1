"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerArchivingIPC = registerArchivingIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'ACCOUNTANT'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const RESTORE_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const archiveSchema = zod_1.z.object({
    entityType: zod_1.z.enum(['CLIENT', 'PROSPECT', 'OWNER', 'PROPERTY', 'CONTRACT', 'INVOICE', 'DOCUMENT']),
    entityId: zod_1.z.number().int().positive(),
    entityRef: zod_1.z.string().min(1),
    snapshot: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    reason: zod_1.z.enum(['MANUEL', 'CONTRAT_TERMINE', 'CLIENT_INACTIF', 'BIEN_VENDU', 'POLITIQUE_AUTOMATIQUE', 'DEMANDE_RGPD', 'AUTRE']).default('MANUEL'),
    reasonDetail: zod_1.z.string().optional(),
    retentionDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
const policySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    entityType: zod_1.z.enum(['CLIENT', 'PROSPECT', 'OWNER', 'PROPERTY', 'CONTRACT', 'INVOICE', 'DOCUMENT']),
    triggerCondition: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    retentionDays: zod_1.z.number().int().positive().optional(),
    isActive: zod_1.z.boolean().default(true),
});
function registerArchivingIPC() {
    // ── Archives ───────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('archiving:list', async (_event, { token, filters = {}, page = 1, limit = 30 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = {};
            if (filters.entityType)
                where.entityType = filters.entityType;
            if (filters.status)
                where.status = filters.status;
            else
                where.status = { not: 'SUPPRIME_DEFINITIVEMENT' };
            if (filters.reason)
                where.reason = filters.reason;
            if (filters.search) {
                where.OR = [
                    { entityRef: { contains: filters.search } },
                    { notes: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.archiveRecord.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { archivedAt: 'desc' },
                    include: {
                        archivedBy: { select: { id: true, firstName: true, lastName: true } },
                        restoredBy: { select: { id: true, firstName: true, lastName: true } },
                    },
                }),
                db.archiveRecord.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('archiving:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('archiving:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const record = await db.archiveRecord.findUnique({
                where: { id },
                include: {
                    archivedBy: { select: { id: true, firstName: true, lastName: true } },
                    restoredBy: { select: { id: true, firstName: true, lastName: true } },
                },
            });
            if (!record)
                return { success: false, error: 'Archive introuvable' };
            return { success: true, data: record };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('archiving:archive', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = archiveSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const record = await db.archiveRecord.create({
                data: {
                    entityType: d.entityType,
                    entityId: d.entityId,
                    entityRef: d.entityRef,
                    snapshot: d.snapshot,
                    reason: d.reason,
                    reasonDetail: d.reasonDetail,
                    archivedById: session.userId,
                    retentionDate: d.retentionDate ? new Date(d.retentionDate) : null,
                    notes: d.notes,
                    status: 'ARCHIVE',
                },
            });
            logger_1.default.info(`Archived ${d.entityType} #${d.entityId} (ref: ${d.entityRef})`);
            return { success: true, data: record };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('archiving:restore', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, RESTORE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.archiveRecord.findUnique({ where: { id } });
            if (!existing)
                return { success: false, error: 'Archive introuvable' };
            if (existing.status === 'SUPPRIME_DEFINITIVEMENT') {
                return { success: false, error: 'Impossible de restaurer un enregistrement supprimé définitivement' };
            }
            const record = await db.archiveRecord.update({
                where: { id },
                data: {
                    status: 'RESTAURE',
                    restoredById: session.userId,
                    restoredAt: new Date(),
                },
            });
            logger_1.default.info(`Restored archive #${id}`);
            return { success: true, data: record };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('archiving:permanentDelete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN']);
            const db = (0, db_service_1.getDb)();
            await db.archiveRecord.update({
                where: { id },
                data: { status: 'SUPPRIME_DEFINITIVEMENT' },
            });
            logger_1.default.info(`Permanent delete archive #${id}`);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('archiving:getStats', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const [totalArchived, totalRestored, expiringCount] = await db.$transaction([
                db.archiveRecord.count({ where: { status: 'ARCHIVE' } }),
                db.archiveRecord.count({ where: { status: 'RESTAURE' } }),
                db.archiveRecord.count({
                    where: {
                        status: 'ARCHIVE',
                        retentionDate: { lte: new Date(now.getTime() + 30 * 86400000) },
                    },
                }),
            ]);
            // Par type d'entité
            const byType = await db.archiveRecord.groupBy({
                by: ['entityType'],
                where: { status: 'ARCHIVE' },
                _count: { id: true },
            });
            return {
                success: true,
                data: {
                    totalArchived,
                    totalRestored,
                    expiringCount,
                    byType: byType.map((b) => ({ entityType: b.entityType, count: b._count.id })),
                },
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Politiques d'archivage ─────────────────────────────────────────────────
    electron_1.ipcMain.handle('archiving:listPolicies', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const db = (0, db_service_1.getDb)();
            const data = await db.archivePolicy.findMany({ orderBy: { entityType: 'asc' } });
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('archiving:createPolicy', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const parsed = policySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const policy = await db.archivePolicy.create({
                data: {
                    name: d.name,
                    description: d.description,
                    entityType: d.entityType,
                    triggerCondition: d.triggerCondition,
                    retentionDays: d.retentionDays ?? null,
                    isActive: d.isActive,
                },
            });
            return { success: true, data: policy };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('archiving:updatePolicy', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const parsed = policySchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const policy = await db.archivePolicy.update({ where: { id }, data: parsed.data });
            return { success: true, data: policy };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('archiving:deletePolicy', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN']);
            const db = (0, db_service_1.getDb)();
            await db.archivePolicy.delete({ where: { id } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
