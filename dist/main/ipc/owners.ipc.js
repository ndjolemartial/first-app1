"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOwnersIPC = registerOwnersIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const ownerSchema = zod_1.z.object({
    type: zod_1.z.enum(['INDIVIDUEL', 'ENTREPRISE']).default('INDIVIDUEL'),
    // Particulier
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    idNumber: zod_1.z.string().optional(),
    // Entreprise
    companyName: zod_1.z.string().optional(),
    registreCommerce: zod_1.z.string().optional(),
    legalRepFirstName: zod_1.z.string().optional(),
    legalRepLastName: zod_1.z.string().optional(),
    legalRepPhone: zod_1.z.string().optional(),
    legalRepIdNumber: zod_1.z.string().optional(),
    // Commun
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    mobile: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    country: zod_1.z.string().default('CI'),
    bankIban: zod_1.z.string().optional(),
    bankBic: zod_1.z.string().optional(),
    compte_contribuable: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];
/**
 * Enregistre les handlers IPC pour la gestion des propriétaires.
 */
function registerOwnersIPC() {
    electron_1.ipcMain.handle('owners:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.type)
                where.type = filters.type;
            if (filters.isActive !== undefined)
                where.isActive = filters.isActive;
            if (filters.search) {
                where.OR = [
                    { firstName: { contains: filters.search } },
                    { lastName: { contains: filters.search } },
                    { companyName: { contains: filters.search } },
                    { email: { contains: filters.search } },
                    { phone: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.owner.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { _count: { select: { properties: true } } },
                }),
                db.owner.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('owners:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('owners:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const owner = await db.owner.findUnique({
                where: { id, deletedAt: null },
                include: {
                    properties: {
                        where: { deletedAt: null },
                        select: {
                            id: true, reference: true, type: true, status: true,
                            address: true, city: true, rentPrice: true, salePrice: true,
                        },
                    },
                    documents: { orderBy: { uploadedAt: 'desc' } },
                    activities: { orderBy: { createdAt: 'desc' }, take: 20 },
                },
            });
            if (!owner)
                return { success: false, error: 'Propriétaire introuvable' };
            return { success: true, data: owner };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('owners:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = ownerSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            if (data.email === '')
                data.email = undefined;
            const owner = await db.owner.create({ data });
            logger_1.default.info(`Owner created: id=${owner.id}`);
            return { success: true, data: owner };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('owners:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = ownerSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            if (data.email === '')
                data.email = undefined;
            const owner = await db.owner.update({ where: { id, deletedAt: null }, data });
            return { success: true, data: owner };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('owners:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.owner.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('owners:portfolio', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const properties = await db.property.findMany({
                where: { ownerId: id, deletedAt: null },
                include: {
                    contracts: {
                        where: { deletedAt: null, status: 'ACTIVE' },
                        select: { rentAmount: true, type: true },
                    },
                },
            });
            const totalRentIncome = properties.reduce((sum, p) => {
                const rent = p.contracts.reduce((s, c) => s + Number(c.rentAmount ?? 0), 0);
                return sum + rent;
            }, 0);
            return { success: true, data: { properties, totalRentIncome } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
