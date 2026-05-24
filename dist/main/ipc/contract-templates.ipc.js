"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerContractTemplatesIPC = registerContractTemplatesIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
const CONTRACT_TYPES = [
    'RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT',
    'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION',
];
const templateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nom requis'),
    type: zod_1.z.enum(CONTRACT_TYPES),
    header: zod_1.z.string().optional(),
    body: zod_1.z.string().default(''),
    footer: zod_1.z.string().optional(),
    headerWidth: zod_1.z.number().int().min(20).max(100).default(100),
    footerWidth: zod_1.z.number().int().min(20).max(100).default(100),
    headerHeight: zod_1.z.number().int().min(40).max(800).default(140),
    footerHeight: zod_1.z.number().int().min(40).max(800).default(140),
    isActive: zod_1.z.boolean().default(true),
    isDefault: zod_1.z.boolean().default(false),
});
/**
 * Enregistre les handlers IPC pour les modèles de contrat enrichis.
 */
function registerContractTemplatesIPC() {
    electron_1.ipcMain.handle('contractTemplates:list', async (_event, { token, filters = {}, page = 1, limit = 100 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.type)
                where.type = filters.type;
            if (filters.search)
                where.name = { contains: filters.search };
            const [data, total] = await db.$transaction([
                db.contractTemplate.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: [{ type: 'asc' }, { name: 'asc' }],
                }),
                db.contractTemplate.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('contractTemplates:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('contractTemplates:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const template = await db.contractTemplate.findUnique({ where: { id } });
            if (!template || template.deletedAt)
                return { success: false, error: 'Modèle introuvable' };
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('contractTemplates:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = templateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            // Un seul modèle par défaut par type de contrat
            if (d.isDefault) {
                await db.contractTemplate.updateMany({
                    where: { type: d.type, deletedAt: null },
                    data: { isDefault: false },
                });
            }
            const template = await db.contractTemplate.create({ data: d });
            logger_1.default.info(`ContractTemplate created: ${template.name}`);
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('contractTemplates:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = templateSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            if (d.isDefault && d.type) {
                await db.contractTemplate.updateMany({
                    where: { type: d.type, deletedAt: null, id: { not: id } },
                    data: { isDefault: false },
                });
            }
            const template = await db.contractTemplate.update({ where: { id }, data: d });
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('contractTemplates:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.contractTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
