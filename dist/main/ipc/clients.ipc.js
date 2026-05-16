"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClientsIPC = registerClientsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const clientSchema = zod_1.z.object({
    type: zod_1.z.enum(['INDIVIDUEL', 'ENTREPRISE']).default('INDIVIDUEL'),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    civilite: zod_1.z.enum(['MONSIEUR', 'MADAME', 'MADEMOISELLE']).optional(),
    statutConjugal: zod_1.z.enum(['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE']).optional(),
    entreprise: zod_1.z.string().optional(),
    registre_de_commerce: zod_1.z.string().optional(),
    compte_contribuable: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    mobile: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    country: zod_1.z.string().default('CI'),
    nationality: zod_1.z.string().optional(),
    birthDate: zod_1.z.string().datetime().optional(),
    idNumber: zod_1.z.string().optional(),
    fatherFirstName: zod_1.z.string().optional(),
    fatherLastName: zod_1.z.string().optional(),
    motherFirstName: zod_1.z.string().optional(),
    motherLastName: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    status: zod_1.z.enum(['ACTIF', 'INACTIF', 'VIP', 'SUSPENDU']).optional(),
});
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];
/** Convertit les chaînes vides en undefined pour éviter les échecs de validation Zod sur les enums */
function stripEmpty(obj) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? undefined : v]));
}
/**
 * Enregistre les handlers IPC pour la gestion des clients.
 */
function registerClientsIPC() {
    electron_1.ipcMain.handle('clients:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.type)
                where.type = filters.type;
            if (filters.status)
                where.status = filters.status;
            if (filters.isActive !== undefined)
                where.isActive = filters.isActive;
            if (filters.search) {
                where.OR = [
                    { firstName: { contains: filters.search } },
                    { lastName: { contains: filters.search } },
                    { entreprise: { contains: filters.search } },
                    { email: { contains: filters.search } },
                    { phone: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.client.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { _count: { select: { contracts: true } } },
                }),
                db.client.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('clients:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('clients:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const client = await db.client.findUnique({
                where: { id, deletedAt: null },
                include: {
                    contracts: {
                        where: { deletedAt: null },
                        include: { property: { select: { reference: true, address: true, city: true } } },
                        orderBy: { createdAt: 'desc' },
                    },
                    documents: { orderBy: { uploadedAt: 'desc' } },
                    activities: { orderBy: { createdAt: 'desc' }, take: 20 },
                    invoices: { where: { deletedAt: null }, orderBy: { issueDate: 'desc' }, take: 10 },
                    prospect: { select: { id: true, status: true } },
                },
            });
            if (!client)
                return { success: false, error: 'Client introuvable' };
            return { success: true, data: client };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('clients:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const cleaned = stripEmpty(payload);
            const parsed = clientSchema.safeParse(cleaned);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            if (data.birthDate)
                data.birthDate = new Date(data.birthDate);
            const client = await db.client.create({ data });
            logger_1.default.info(`Client created: id=${client.id}`);
            return { success: true, data: client };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('clients:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const cleaned = stripEmpty(payload);
            const parsed = clientSchema.partial().safeParse(cleaned);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            if (data.birthDate)
                data.birthDate = new Date(data.birthDate);
            const client = await db.client.update({ where: { id, deletedAt: null }, data });
            return { success: true, data: client };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('clients:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.client.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('clients:toggleActive', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const client = await db.client.findUnique({ where: { id }, select: { isActive: true } });
            if (!client)
                return { success: false, error: 'Client introuvable' };
            const updated = await db.client.update({
                where: { id },
                data: { isActive: !client.isActive },
                select: { id: true, isActive: true },
            });
            return { success: true, data: updated };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('clients:updateStatus', async (_event, { token, id, status }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = zod_1.z.enum(['ACTIF', 'INACTIF', 'VIP', 'SUSPENDU']).safeParse(status);
            if (!parsed.success)
                return { success: false, error: 'Statut invalide' };
            const db = (0, db_service_1.getDb)();
            const updated = await db.client.update({
                where: { id, deletedAt: null },
                data: { status: parsed.data },
                select: { id: true, status: true },
            });
            logger_1.default.info(`Client #${id} status updated to ${parsed.data}`);
            return { success: true, data: updated };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
