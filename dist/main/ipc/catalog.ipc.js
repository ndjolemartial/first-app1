"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCatalogIPC = registerCatalogIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
/**
 * Catalogue de prestations / produits.
 *
 * Lecture : tous les rôles authentifiés (le catalogue alimente les lignes de
 * devis et de factures). Écriture (gestion du référentiel) : réservée aux
 * administrateurs, MANAGER et ACCOUNTANT (comptable). Liste vérifiée
 * explicitement — sans passer par l'équivalence ASSISTANTE_DIRECTION→MANAGER de
 * `checkRole` — afin d'exclure l'assistante de direction.
 */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const READ_ROLES = [
    ...WRITE_ROLES, 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY',
];
function checkCatalogWrite(session) {
    if (!WRITE_ROLES.includes(session.role)) {
        throw new Error('Permission insuffisante : seuls les administrateurs, managers et comptables '
            + 'peuvent modifier le catalogue');
    }
}
const ser = (v) => JSON.parse(JSON.stringify(v));
const schema = zod_1.z.object({
    type: zod_1.z.enum(['PRESTATION', 'PRODUIT']).default('PRESTATION'),
    designation: zod_1.z.string().min(1, 'Désignation requise'),
    reference: zod_1.z.string().nullable().optional(),
    description: zod_1.z.string().nullable().optional(),
    category: zod_1.z.string().nullable().optional(),
    unit: zod_1.z.string().nullable().optional(),
    unitPrice: zod_1.z.number().min(0).default(0),
    isActive: zod_1.z.boolean().default(true),
});
function registerCatalogIPC() {
    electron_1.ipcMain.handle('catalog:list', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (!filters.includeInactive)
                where.isActive = true;
            if (filters.type)
                where.type = filters.type;
            if (filters.search) {
                where.OR = [
                    { designation: { contains: filters.search } },
                    { category: { contains: filters.search } },
                    { description: { contains: filters.search } },
                ];
            }
            const data = await db.catalogItem.findMany({
                where,
                orderBy: [{ type: 'asc' }, { designation: 'asc' }],
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('catalog:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const item = await db.catalogItem.findUnique({ where: { id: Number(id) } });
            if (!item || item.deletedAt)
                return { success: false, error: 'Article introuvable' };
            return { success: true, data: ser(item) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCatalogWrite(session);
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const item = await db.catalogItem.create({
                data: {
                    type: d.type,
                    designation: d.designation,
                    reference: d.reference ?? null,
                    description: d.description ?? null,
                    category: d.category ?? null,
                    unit: d.unit ?? null,
                    unitPrice: String(d.unitPrice),
                    isActive: d.isActive,
                },
            });
            logger_1.default.info(`CatalogItem created: ${item.designation}`);
            return { success: true, data: ser(item) };
        }
        catch (error) {
            logger_1.default.error('catalog:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCatalogWrite(session);
            const parsed = schema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const data = { ...d };
            if (d.unitPrice !== undefined)
                data.unitPrice = String(d.unitPrice);
            const db = (0, db_service_1.getDb)();
            const item = await db.catalogItem.update({ where: { id: Number(id) }, data });
            return { success: true, data: ser(item) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCatalogWrite(session);
            const db = (0, db_service_1.getDb)();
            await db.catalogItem.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /* ─── Unités de mesure (référentiel partagé `KpiUnit`) ──────────────
     * Réutilise le même référentiel que « Nouvel objectif » et les lignes de
     * devis, afin que la liste proposée sur les articles du catalogue soit
     * cohérente avec le reste de l'application. */
    const labelSchema = zod_1.z.object({ label: zod_1.z.string().min(1, 'Libellé requis'), isActive: zod_1.z.boolean().optional() });
    electron_1.ipcMain.handle('catalog:listUnits', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().kpiUnit.findMany({ where, orderBy: { label: 'asc' } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('catalog:listUnits error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:createUnit', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCatalogWrite(session);
            const parsed = labelSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const label = parsed.data.label.trim();
            const existing = await db.kpiUnit.findUnique({ where: { label } });
            if (existing) {
                const data = await db.kpiUnit.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
                return { success: true, data: ser(data) };
            }
            const data = await db.kpiUnit.create({ data: { label, isActive: parsed.data.isActive ?? true } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('catalog:createUnit error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:updateUnit', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCatalogWrite(session);
            const parsed = labelSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const data = { ...parsed.data };
            if (typeof data.label === 'string')
                data.label = data.label.trim();
            const updated = await (0, db_service_1.getDb)().kpiUnit.update({ where: { id: Number(id) }, data });
            return { success: true, data: ser(updated) };
        }
        catch (error) {
            logger_1.default.error('catalog:updateUnit error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:deleteUnit', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCatalogWrite(session);
            await (0, db_service_1.getDb)().kpiUnit.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('catalog:deleteUnit error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Catégories (référentiel `CatalogCategory`) ────────────────────
     * Alimente le sélecteur « Catégorie » du formulaire « Nouvel article »
     * (avec création à la volée), même principe que le référentiel d'unités. */
    electron_1.ipcMain.handle('catalog:listCategories', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().catalogCategory.findMany({ where, orderBy: { label: 'asc' } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('catalog:listCategories error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:createCategory', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCatalogWrite(session);
            const parsed = labelSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const label = parsed.data.label.trim().toUpperCase();
            const existing = await db.catalogCategory.findUnique({ where: { label } });
            if (existing) {
                const data = await db.catalogCategory.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
                return { success: true, data: ser(data) };
            }
            const data = await db.catalogCategory.create({ data: { label, isActive: parsed.data.isActive ?? true } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('catalog:createCategory error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:updateCategory', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCatalogWrite(session);
            const parsed = labelSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const data = { ...parsed.data };
            if (typeof data.label === 'string')
                data.label = data.label.trim().toUpperCase();
            const updated = await (0, db_service_1.getDb)().catalogCategory.update({ where: { id: Number(id) }, data });
            return { success: true, data: ser(updated) };
        }
        catch (error) {
            logger_1.default.error('catalog:updateCategory error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('catalog:deleteCategory', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCatalogWrite(session);
            await (0, db_service_1.getDb)().catalogCategory.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('catalog:deleteCategory error', error.message);
            return { success: false, error: error.message };
        }
    });
}
