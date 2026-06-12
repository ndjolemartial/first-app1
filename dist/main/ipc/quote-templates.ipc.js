"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerQuoteTemplatesIPC = registerQuoteTemplatesIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
const templateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nom requis'),
    header: zod_1.z.string().optional(),
    headerWidth: zod_1.z.number().int().min(20).max(100).default(100),
    headerHeight: zod_1.z.number().int().min(40).max(800).default(140),
    body: zod_1.z.string().default(''),
    footer: zod_1.z.string().optional(),
    footerWidth: zod_1.z.number().int().min(20).max(100).default(100),
    footerHeight: zod_1.z.number().int().min(40).max(800).default(140),
    footerBgColor: zod_1.z.preprocess((v) => (v === '' || v === null ? null : v), zod_1.z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/, 'Couleur invalide').nullable().optional()),
    endOfDocument: zod_1.z.string().optional(),
    endOfDocumentWidth: zod_1.z.number().int().min(20).max(100).default(100),
    endOfDocumentHeight: zod_1.z.number().int().min(40).max(800).default(140),
    endOfDocumentBgColor: zod_1.z.preprocess((v) => (v === '' || v === null ? null : v), zod_1.z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/, 'Couleur invalide').nullable().optional()),
    isActive: zod_1.z.boolean().default(true),
    isDefault: zod_1.z.boolean().default(false),
});
/** Modèles de devis (un seul modèle par défaut). */
function registerQuoteTemplatesIPC() {
    electron_1.ipcMain.handle('quoteTemplates:list', async (_event, { token, filters = {}, page = 1, limit = 100 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.search)
                where.name = { contains: filters.search };
            const [data, total] = await db.$transaction([
                db.quoteTemplate.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
                db.quoteTemplate.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('quoteTemplates:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('quoteTemplates:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const template = await db.quoteTemplate.findUnique({ where: { id: Number(id) } });
            if (!template || template.deletedAt)
                return { success: false, error: 'Modèle introuvable' };
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('quoteTemplates:create', async (_event, { token, payload }) => {
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
            if (d.isDefault) {
                await db.quoteTemplate.updateMany({ where: { deletedAt: null }, data: { isDefault: false } });
            }
            const template = await db.quoteTemplate.create({ data: d });
            logger_1.default.info(`QuoteTemplate created: ${template.name}`);
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('quoteTemplates:update', async (_event, { token, id, payload }) => {
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
            if (d.isDefault) {
                await db.quoteTemplate.updateMany({ where: { deletedAt: null, id: { not: Number(id) } }, data: { isDefault: false } });
            }
            const template = await db.quoteTemplate.update({ where: { id: Number(id) }, data: d });
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('quoteTemplates:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.quoteTemplate.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
