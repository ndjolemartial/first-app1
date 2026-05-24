"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCrmIPC = registerCrmIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const activitySchema = zod_1.z.object({
    type: zod_1.z.enum(['NOTIFICATION', 'APPEL', 'EMAIL', 'SMS', 'REUNION', 'VISITE', 'TASK', 'RAPPEL', 'DOCUMENT']),
    subject: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    status: zod_1.z.enum(['EN_ATTENTE', 'EN_TRAITEMENT', 'TRAITE', 'ANNULE']).default('EN_ATTENTE'),
    dueDate: zod_1.z.string().optional(),
    completedAt: zod_1.z.string().optional(),
    userId: zod_1.z.number().int().positive().optional(),
    prospectId: zod_1.z.number().int().positive().optional(),
    clientId: zod_1.z.number().int().positive().optional(),
    ownerId: zod_1.z.number().int().positive().optional(),
    propertyId: zod_1.z.number().int().positive().optional(),
    conventionId: zod_1.z.number().int().positive().optional(),
    lotissementId: zod_1.z.number().int().positive().optional(),
    terrainId: zod_1.z.number().int().positive().optional(),
    programmeId: zod_1.z.number().int().positive().optional(),
    invoiceId: zod_1.z.number().int().positive().optional(),
    installmentId: zod_1.z.number().int().positive().optional(),
});
function registerCrmIPC() {
    electron_1.ipcMain.handle('crm:listActivities', async (_event, { token, filters = {}, page = 1, limit = 30 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = {};
            if (filters.type)
                where.type = filters.type;
            if (filters.status)
                where.status = filters.status;
            if (filters.userId)
                where.userId = filters.userId;
            if (filters.clientId)
                where.clientId = filters.clientId;
            if (filters.prospectId)
                where.prospectId = filters.prospectId;
            if (filters.propertyId)
                where.propertyId = filters.propertyId;
            if (filters.conventionId)
                where.conventionId = filters.conventionId;
            if (filters.dueBefore)
                where.dueDate = { ...(where.dueDate ?? {}), lte: new Date(filters.dueBefore) };
            if (filters.dueAfter)
                where.dueDate = { ...(where.dueDate ?? {}), gte: new Date(filters.dueAfter) };
            if (filters.search) {
                where.OR = [
                    { subject: { contains: filters.search } },
                    { description: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.crmActivity.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } },
                        client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                        prospect: { select: { id: true, firstName: true, lastName: true } },
                        owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                        property: { select: { id: true, reference: true, address: true } },
                        convention: { select: { id: true, reference: true } },
                        lotissement: { select: { id: true, reference: true, nom: true } },
                        terrain: { select: { id: true, reference: true } },
                        programme: { select: { id: true, reference: true, nom: true } },
                        invoice: { select: { id: true, reference: true } },
                        installment: { select: { id: true, installmentNumber: true, convention: { select: { reference: true } } } },
                    },
                }),
                db.crmActivity.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('crm:listActivities error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:getActivity', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const activity = await db.crmActivity.findUnique({
                where: { id },
                include: {
                    user: { select: { id: true, firstName: true, lastName: true } },
                    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                    prospect: { select: { id: true, firstName: true, lastName: true } },
                    owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                    property: { select: { id: true, reference: true, address: true } },
                    convention: { select: { id: true, reference: true } },
                    lotissement: { select: { id: true, reference: true, nom: true } },
                    terrain: { select: { id: true, reference: true } },
                    programme: { select: { id: true, reference: true, nom: true } },
                    invoice: { select: { id: true, reference: true } },
                    installment: { select: { id: true, installmentNumber: true, convention: { select: { reference: true } } } },
                },
            });
            if (!activity)
                return { success: false, error: 'Activité introuvable' };
            return { success: true, data: activity };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:createActivity', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = activitySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const activity = await db.crmActivity.create({
                data: {
                    type: d.type,
                    subject: d.subject,
                    description: d.description,
                    status: d.status,
                    dueDate: d.dueDate ? new Date(d.dueDate) : null,
                    completedAt: d.completedAt ? new Date(d.completedAt) : null,
                    userId: d.userId ?? null,
                    prospectId: d.prospectId ?? null,
                    clientId: d.clientId ?? null,
                    ownerId: d.ownerId ?? null,
                    propertyId: d.propertyId ?? null,
                    conventionId: d.conventionId ?? null,
                    lotissementId: d.lotissementId ?? null,
                    terrainId: d.terrainId ?? null,
                    programmeId: d.programmeId ?? null,
                    invoiceId: d.invoiceId ?? null,
                    installmentId: d.installmentId ?? null,
                },
            });
            logger_1.default.info(`CRM activity created: ${activity.id}`);
            return { success: true, data: activity };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:updateActivity', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = activitySchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            if (d.dueDate)
                d.dueDate = new Date(d.dueDate);
            if (d.completedAt)
                d.completedAt = new Date(d.completedAt);
            const activity = await db.crmActivity.update({ where: { id }, data: d });
            return { success: true, data: activity };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:deleteActivity', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.crmActivity.delete({ where: { id } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:completeActivity', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const activity = await db.crmActivity.update({
                where: { id },
                data: { status: 'TRAITE', completedAt: new Date() },
            });
            return { success: true, data: activity };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:getStats', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);
            const [total, pending, overdue, todayCount] = await db.$transaction([
                db.crmActivity.count({ where: { status: { not: 'ANNULE' } } }),
                db.crmActivity.count({ where: { status: 'EN_ATTENTE' } }),
                db.crmActivity.count({
                    where: {
                        status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] },
                        dueDate: { lt: now },
                    },
                }),
                db.crmActivity.count({
                    where: {
                        dueDate: { gte: startOfDay, lte: endOfDay },
                        status: { not: 'ANNULE' },
                    },
                }),
            ]);
            return { success: true, data: { total, pending, overdue, todayCount } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
