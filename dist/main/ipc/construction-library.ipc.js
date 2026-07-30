"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConstructionLibraryIPC = registerConstructionLibraryIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
/**
 * Bibliothèque technique du moteur de devis de construction (Module 17) :
 * lots, bordereau de prix (ressources), ouvrages (recettes), catalogue et
 * profils de coefficients.
 *
 * Lecture : rôles impliqués dans la production de devis de construction.
 * Écriture : réservée à SUPER_ADMIN/ADMIN (même principe que le catalogue KPI
 * du module Performances) — rôle EXACT, sans les équivalences de `checkRole`.
 */
const LIB_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const LIB_READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'AGENT_TECHNIQUE'];
// Lots de travaux, Bordereau des prix (ressources) et Localités : ouverts en
// écriture à MANAGER et ACCOUNTANT au même titre que les admins — contrairement
// à la Bibliothèque d'ouvrages, au Catalogue des coefficients et aux Profils de
// coefficients, qui restent réservés à LIB_ADMIN_ROLES.
const LIB_EXTENDED_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
function checkLibWrite(session) {
    if (!LIB_ADMIN_ROLES.includes(session.role))
        throw new Error('Permission insuffisante');
}
function checkLibExtendedWrite(session) {
    if (!LIB_EXTENDED_WRITE_ROLES.includes(session.role))
        throw new Error('Permission insuffisante');
}
const ser = (v) => JSON.parse(JSON.stringify(v));
/** Sérialise un nombre en Decimal Prisma (chaîne — contourne le typage Decimal côté IPC). */
const dec = (v) => (v == null ? null : String(v));
const LOT_PHASES = ['GROS_OEUVRE', 'SECOND_OEUVRE', 'ELECTRICITE', 'PLOMBERIE', 'FINITIONS', 'VRD', 'AMENAGEMENTS'];
const RESOURCE_TYPES = ['MATERIAU', 'MAIN_OEUVRE', 'TRANSPORT', 'MATERIEL', 'SOUS_TRAITANCE'];
const BUILDING_TYPES = ['VILLA_BASSE', 'VILLA_DUPLEX', 'VILLA_TRIPLEX', 'MAISON_ECONOMIQUE', 'IMMEUBLE_R_PLUS', 'BUREAU', 'COMMERCE', 'ENTREPOT_HANGAR', 'AUTRE'];
const STANDINGS = ['ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE'];
const labelSchema = zod_1.z.object({ label: zod_1.z.string().min(1, 'Libellé requis'), isActive: zod_1.z.boolean().optional() });
const lotSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    numero: zod_1.z.number().int().positive(),
    label: zod_1.z.string().min(1),
    phase: zod_1.z.enum(LOT_PHASES).default('GROS_OEUVRE'),
    description: zod_1.z.string().nullable().optional(),
    sortOrder: zod_1.z.number().int().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const localitySchema = zod_1.z.object({
    label: zod_1.z.string().min(1),
    region: zod_1.z.string().nullable().optional(),
    priceCoefficient: zod_1.z.number().positive().default(1),
    isActive: zod_1.z.boolean().optional(),
});
const resourceSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    label: zod_1.z.string().min(1),
    type: zod_1.z.enum(RESOURCE_TYPES).default('MATERIAU'),
    family: zod_1.z.string().nullable().optional(),
    unit: zod_1.z.string().min(1),
    quality: zod_1.z.string().nullable().optional(),
    unitPrice: zod_1.z.number().min(0).default(0),
    supplierName: zod_1.z.string().nullable().optional(),
    referenceCity: zod_1.z.string().nullable().optional(),
    description: zod_1.z.string().nullable().optional(),
    notes: zod_1.z.string().nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const updatePriceSchema = zod_1.z.object({
    unitPrice: zod_1.z.number().min(0),
    localityId: zod_1.z.number().int().positive().nullable().optional(),
    effectiveDate: zod_1.z.string().nullable().optional(),
    supplierName: zod_1.z.string().nullable().optional(),
    quality: zod_1.z.string().nullable().optional(),
    source: zod_1.z.string().nullable().optional(),
    note: zod_1.z.string().nullable().optional(),
});
const componentSchema = zod_1.z.object({
    resourceId: zod_1.z.number().int().positive(),
    quantityPerUnit: zod_1.z.number().min(0),
    wastageRate: zod_1.z.number().min(0).default(0),
    note: zod_1.z.string().nullable().optional(),
    sortOrder: zod_1.z.number().int().optional(),
});
const workItemSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    lotId: zod_1.z.number().int().positive(),
    designation: zod_1.z.string().min(1),
    description: zod_1.z.string().nullable().optional(),
    unit: zod_1.z.string().min(1),
    formulaCode: zod_1.z.string().nullable().optional(),
    fixedQuantity: zod_1.z.number().nullable().optional(),
    quantityMultiplier: zod_1.z.number().positive().default(1),
    applicabilityRule: zod_1.z.any().nullable().optional(),
    percentOfTotalPct: zod_1.z.number().nullable().optional(),
    deboursSecOverride: zod_1.z.number().nullable().optional(),
    sortOrder: zod_1.z.number().int().optional(),
    isActive: zod_1.z.boolean().optional(),
    components: zod_1.z.array(componentSchema).default([]),
});
const ratioDefSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    label: zod_1.z.string().min(1),
    category: zod_1.z.string().nullable().optional(),
    unit: zod_1.z.string().nullable().optional(),
    defaultValue: zod_1.z.number().default(0),
    minValue: zod_1.z.number().nullable().optional(),
    maxValue: zod_1.z.number().nullable().optional(),
    description: zod_1.z.string().nullable().optional(),
    sortOrder: zod_1.z.number().int().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const ratioValueSchema = zod_1.z.object({
    ratioDefinitionId: zod_1.z.number().int().positive(),
    value: zod_1.z.number(),
    note: zod_1.z.string().nullable().optional(),
});
const ratioProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    buildingType: zod_1.z.enum(BUILDING_TYPES),
    standing: zod_1.z.enum(STANDINGS),
    description: zod_1.z.string().nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
    values: zod_1.z.array(ratioValueSchema).default([]),
});
function registerConstructionLibraryIPC() {
    // ── Lots ─────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('construction:lots:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().constructionLot.findMany({
                where, orderBy: { numero: 'asc' }, include: { _count: { select: { workItems: true } } },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:lots:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:lots:upsert', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = lotSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const data = id
                ? await db.constructionLot.update({ where: { id: Number(id) }, data: parsed.data })
                : await db.constructionLot.create({ data: parsed.data });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:lots:upsert error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:lots:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            await (0, db_service_1.getDb)().constructionLot.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('construction:lots:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Familles de ressources ──────────────────────────────────────────
    electron_1.ipcMain.handle('construction:resourceFamilies:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().constructionResourceFamily.findMany({ where, orderBy: { label: 'asc' } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:resourceFamilies:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            const parsed = labelSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const label = parsed.data.label.trim();
            const existing = await db.constructionResourceFamily.findUnique({ where: { label } });
            if (existing) {
                const data = await db.constructionResourceFamily.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
                return { success: true, data: ser(data) };
            }
            const data = await db.constructionResourceFamily.create({ data: { label, isActive: parsed.data.isActive ?? true } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:resourceFamilies:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            await (0, db_service_1.getDb)().constructionResourceFamily.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Localités ────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('construction:localities:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().constructionLocality.findMany({ where, orderBy: { label: 'asc' } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:localities:upsert', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = localitySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const values = { ...parsed.data, priceCoefficient: dec(parsed.data.priceCoefficient) };
            const data = id
                ? await db.constructionLocality.update({ where: { id: Number(id) }, data: values })
                : await db.constructionLocality.create({ data: values });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:localities:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            await (0, db_service_1.getDb)().constructionLocality.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Ressources (bordereau de prix) ──────────────────────────────────
    electron_1.ipcMain.handle('construction:resources:list', async (_event, { token, filters = {}, page = 1, limit = 100 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const where = { deletedAt: null };
            if (!filters.includeInactive)
                where.isActive = true;
            if (filters.type)
                where.type = filters.type;
            if (filters.family)
                where.family = filters.family;
            if (filters.search) {
                where.OR = [
                    { code: { contains: filters.search } },
                    { label: { contains: filters.search } },
                    { family: { contains: filters.search } },
                ];
            }
            const [data, total] = await (0, db_service_1.getDb)().$transaction([
                (0, db_service_1.getDb)().constructionResource.findMany({ where, orderBy: [{ family: 'asc' }, { label: 'asc' }], skip: (page - 1) * limit, take: limit }),
                (0, db_service_1.getDb)().constructionResource.count({ where }),
            ]);
            return { success: true, data: ser(data), total };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:resources:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const [resource, priceHistory, priceVariants] = await Promise.all([
                db.constructionResource.findUnique({ where: { id: Number(id) } }),
                db.constructionResourcePriceHistory.findMany({ where: { resourceId: Number(id) }, orderBy: { effectiveDate: 'desc' }, take: 20 }),
                db.constructionResourcePriceVariant.findMany({ where: { resourceId: Number(id) }, include: { locality: true } }),
            ]);
            if (!resource || resource.deletedAt)
                return { success: false, error: 'Ressource introuvable' };
            return { success: true, data: ser({ ...resource, priceHistory, priceVariants }) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:resources:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = resourceSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const data = await db.constructionResource.create({
                data: { ...parsed.data, unitPrice: dec(parsed.data.unitPrice) },
            });
            if (Number(parsed.data.unitPrice) > 0) {
                await db.constructionResourcePriceHistory.create({
                    data: {
                        resourceId: data.id, previousPrice: null, unitPrice: dec(parsed.data.unitPrice),
                        source: 'Création', changedById: session.userId,
                    },
                });
            }
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:resources:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:resources:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = resourceSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const existing = await db.constructionResource.findUnique({ where: { id: Number(id) } });
            if (!existing)
                return { success: false, error: 'Ressource introuvable' };
            const values = { ...parsed.data };
            const priceChanged = parsed.data.unitPrice != null && Number(parsed.data.unitPrice) !== Number(existing.unitPrice);
            if (parsed.data.unitPrice != null)
                values.unitPrice = dec(parsed.data.unitPrice);
            if (priceChanged)
                values.priceIsIndicative = false;
            const data = await db.constructionResource.update({ where: { id: Number(id) }, data: values });
            if (priceChanged) {
                await db.constructionResourcePriceHistory.create({
                    data: {
                        resourceId: data.id, previousPrice: dec(Number(existing.unitPrice)), unitPrice: dec(parsed.data.unitPrice),
                        source: 'Modification manuelle', changedById: session.userId,
                    },
                });
            }
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:resources:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:resources:updatePrice', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = updatePriceSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const resource = await db.constructionResource.findUnique({ where: { id: Number(id) } });
            if (!resource)
                return { success: false, error: 'Ressource introuvable' };
            const d = parsed.data;
            if (d.localityId) {
                // Dérogation ponctuelle par ville — n'affecte pas le prix de référence.
                const existingVariant = await db.constructionResourcePriceVariant.findUnique({
                    where: { resourceId_localityId: { resourceId: Number(id), localityId: d.localityId } },
                });
                const variant = existingVariant
                    ? await db.constructionResourcePriceVariant.update({
                        where: { id: existingVariant.id },
                        data: { unitPrice: dec(d.unitPrice), supplierName: d.supplierName, quality: d.quality, note: d.note, priceDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date() },
                    })
                    : await db.constructionResourcePriceVariant.create({
                        data: {
                            resourceId: Number(id), localityId: d.localityId, unitPrice: dec(d.unitPrice),
                            supplierName: d.supplierName, quality: d.quality, note: d.note, priceDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date(),
                        },
                    });
                await db.constructionResourcePriceHistory.create({
                    data: {
                        resourceId: Number(id), localityId: d.localityId, previousPrice: existingVariant ? dec(Number(existingVariant.unitPrice)) : null,
                        unitPrice: dec(d.unitPrice), supplierName: d.supplierName, quality: d.quality, source: d.source ?? 'Relevé fournisseur',
                        note: d.note, changedById: session.userId, effectiveDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date(),
                    },
                });
                return { success: true, data: ser(variant) };
            }
            const previousPrice = Number(resource.unitPrice);
            const updated = await db.constructionResource.update({
                where: { id: Number(id) },
                data: {
                    unitPrice: dec(d.unitPrice), priceDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date(),
                    supplierName: d.supplierName ?? resource.supplierName, priceIsIndicative: false,
                },
            });
            await db.constructionResourcePriceHistory.create({
                data: {
                    resourceId: Number(id), previousPrice: dec(previousPrice), unitPrice: dec(d.unitPrice),
                    supplierName: d.supplierName, quality: d.quality, source: d.source ?? 'Relevé fournisseur', note: d.note,
                    changedById: session.userId, effectiveDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date(),
                },
            });
            const impactedWorkItems = await db.constructionWorkItemComponent.count({ where: { resourceId: Number(id) } });
            return { success: true, data: ser(updated), impacted: { workItems: impactedWorkItems } };
        }
        catch (error) {
            logger_1.default.error('construction:resources:updatePrice error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:resources:priceHistory', async (_event, { token, id, limit = 30 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const data = await (0, db_service_1.getDb)().constructionResourcePriceHistory.findMany({
                where: { resourceId: Number(id) }, orderBy: { effectiveDate: 'desc' }, take: limit,
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:resources:whereUsed', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const data = await (0, db_service_1.getDb)().constructionWorkItemComponent.findMany({
                where: { resourceId: Number(id) },
                include: { workItem: { include: { lot: true } } },
                orderBy: { workItem: { code: 'asc' } },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:resources:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const db = (0, db_service_1.getDb)();
            const usageCount = await db.constructionWorkItemComponent.count({ where: { resourceId: Number(id) } });
            if (usageCount > 0) {
                return { success: false, error: `Cette ressource est utilisée par ${usageCount} ouvrage(s) — retirez-la des recettes avant suppression.` };
            }
            await db.constructionResource.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Ouvrages (bibliothèque) ──────────────────────────────────────────
    electron_1.ipcMain.handle('construction:workItems:list', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const where = { deletedAt: null };
            if (!filters.includeInactive)
                where.isActive = true;
            if (filters.lotId)
                where.lotId = Number(filters.lotId);
            if (filters.search) {
                where.OR = [{ code: { contains: filters.search } }, { designation: { contains: filters.search } }];
            }
            const data = await (0, db_service_1.getDb)().constructionWorkItem.findMany({
                where, include: { lot: true, _count: { select: { components: true } } },
                orderBy: [{ lot: { numero: 'asc' } }, { sortOrder: 'asc' }],
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:workItems:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const data = await (0, db_service_1.getDb)().constructionWorkItem.findUnique({
                where: { id: Number(id) },
                include: { lot: true, components: { include: { resource: true }, orderBy: { sortOrder: 'asc' } } },
            });
            if (!data || data.deletedAt)
                return { success: false, error: 'Ouvrage introuvable' };
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:workItems:upsert', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            const parsed = workItemSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const header = {
                code: d.code, lotId: d.lotId, designation: d.designation, description: d.description ?? null,
                unit: d.unit, formulaCode: d.formulaCode ?? null,
                fixedQuantity: d.fixedQuantity != null ? dec(d.fixedQuantity) : null,
                quantityMultiplier: dec(d.quantityMultiplier),
                applicabilityRule: d.applicabilityRule ?? null,
                percentOfTotalPct: d.percentOfTotalPct != null ? dec(d.percentOfTotalPct) : null,
                deboursSecOverride: d.deboursSecOverride != null ? dec(d.deboursSecOverride) : null,
                sortOrder: d.sortOrder ?? 0, isActive: d.isActive ?? true,
            };
            const data = await db.$transaction(async (tx) => {
                const workItem = id
                    ? await tx.constructionWorkItem.update({ where: { id: Number(id) }, data: header })
                    : await tx.constructionWorkItem.create({ data: header });
                await tx.constructionWorkItemComponent.deleteMany({ where: { workItemId: workItem.id } });
                if (d.components.length) {
                    await tx.constructionWorkItemComponent.createMany({
                        data: d.components.map((c, i) => ({
                            workItemId: workItem.id, resourceId: c.resourceId, quantityPerUnit: dec(c.quantityPerUnit),
                            wastageRate: dec(c.wastageRate), note: c.note ?? null, sortOrder: c.sortOrder ?? i,
                        })),
                    });
                }
                return tx.constructionWorkItem.findUnique({
                    where: { id: workItem.id }, include: { lot: true, components: { include: { resource: true } } },
                });
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:workItems:upsert error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:workItems:duplicate', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            const db = (0, db_service_1.getDb)();
            const source = await db.constructionWorkItem.findUnique({ where: { id: Number(id) }, include: { components: true } });
            if (!source)
                return { success: false, error: 'Ouvrage introuvable' };
            const data = await db.constructionWorkItem.create({
                data: {
                    code: `${source.code}_COPIE`, lotId: source.lotId, designation: `${source.designation} (copie)`,
                    description: source.description, unit: source.unit, formulaCode: source.formulaCode,
                    fixedQuantity: source.fixedQuantity, quantityMultiplier: source.quantityMultiplier,
                    applicabilityRule: source.applicabilityRule, percentOfTotalPct: source.percentOfTotalPct,
                    deboursSecOverride: source.deboursSecOverride, sortOrder: source.sortOrder, isActive: true,
                    components: {
                        create: source.components.map((c) => ({
                            resourceId: c.resourceId, quantityPerUnit: c.quantityPerUnit, wastageRate: c.wastageRate, note: c.note, sortOrder: c.sortOrder,
                        })),
                    },
                },
                include: { lot: true, components: { include: { resource: true } } },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:workItems:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            await (0, db_service_1.getDb)().constructionWorkItem.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Catalogue des coefficients/ratios ───────────────────────────────
    electron_1.ipcMain.handle('construction:ratioDefs:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().constructionRatioDefinition.findMany({ where, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }] });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:ratioDefs:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            const parsed = ratioDefSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const d = parsed.data;
            const data = await (0, db_service_1.getDb)().constructionRatioDefinition.create({
                data: {
                    code: d.code, label: d.label, category: d.category ?? null, unit: d.unit ?? null,
                    defaultValue: dec(d.defaultValue), minValue: d.minValue != null ? dec(d.minValue) : null,
                    maxValue: d.maxValue != null ? dec(d.maxValue) : null, description: d.description ?? null,
                    sortOrder: d.sortOrder ?? 0, isActive: d.isActive ?? true,
                },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:ratioDefs:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:ratioDefs:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            const parsed = ratioDefSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const d = parsed.data;
            const values = { ...d };
            if (d.defaultValue != null)
                values.defaultValue = dec(d.defaultValue);
            if (d.minValue !== undefined)
                values.minValue = d.minValue != null ? dec(d.minValue) : null;
            if (d.maxValue !== undefined)
                values.maxValue = d.maxValue != null ? dec(d.maxValue) : null;
            const data = await (0, db_service_1.getDb)().constructionRatioDefinition.update({ where: { id: Number(id) }, data: values });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:ratioDefs:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:ratioDefs:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            await (0, db_service_1.getDb)().constructionRatioDefinition.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Profils de coefficients ──────────────────────────────────────────
    electron_1.ipcMain.handle('construction:ratioProfiles:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const data = await (0, db_service_1.getDb)().constructionRatioProfile.findMany({
                orderBy: [{ buildingType: 'asc' }, { standing: 'asc' }], include: { _count: { select: { values: true } } },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:ratioProfiles:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const data = await (0, db_service_1.getDb)().constructionRatioProfile.findUnique({
                where: { id: Number(id) }, include: { values: { include: { ratioDefinition: true } } },
            });
            if (!data)
                return { success: false, error: 'Profil introuvable' };
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:ratioProfiles:upsert', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            const parsed = ratioProfileSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const header = { name: d.name, buildingType: d.buildingType, standing: d.standing, description: d.description ?? null, isActive: d.isActive ?? true };
            const data = await db.$transaction(async (tx) => {
                const profile = id
                    ? await tx.constructionRatioProfile.update({ where: { id: Number(id) }, data: header })
                    : await tx.constructionRatioProfile.create({ data: header });
                await tx.constructionRatioValue.deleteMany({ where: { profileId: profile.id } });
                if (d.values.length) {
                    await tx.constructionRatioValue.createMany({
                        data: d.values.map((v) => ({
                            profileId: profile.id, ratioDefinitionId: v.ratioDefinitionId, value: dec(v.value), note: v.note ?? null,
                        })),
                    });
                }
                return tx.constructionRatioProfile.findUnique({ where: { id: profile.id }, include: { values: { include: { ratioDefinition: true } } } });
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:ratioProfiles:upsert error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:ratioProfiles:duplicate', async (_event, { token, id, target }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            const db = (0, db_service_1.getDb)();
            const source = await db.constructionRatioProfile.findUnique({ where: { id: Number(id) }, include: { values: true } });
            if (!source)
                return { success: false, error: 'Profil introuvable' };
            const buildingType = target?.buildingType ?? source.buildingType;
            const standing = target?.standing ?? source.standing;
            const existing = await db.constructionRatioProfile.findUnique({ where: { buildingType_standing: { buildingType, standing } } });
            if (existing)
                return { success: false, error: `Un profil existe déjà pour ${buildingType} × ${standing}.` };
            const data = await db.constructionRatioProfile.create({
                data: {
                    name: target?.name ?? `${source.name} (copie)`, buildingType, standing, description: source.description, isActive: true,
                    values: { create: source.values.map((v) => ({ ratioDefinitionId: v.ratioDefinitionId, value: v.value, note: v.note })) },
                },
                include: { values: { include: { ratioDefinition: true } } },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:ratioProfiles:duplicate error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:ratioProfiles:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibWrite(session);
            // Hard delete : `@@unique([buildingType, standing])` sans soft delete
            // (cf. schema.prisma) — un soft delete empêcherait de recréer le couple.
            // Les estimations passées gardent un ratioSnapshot JSON figé, non affecté.
            await (0, db_service_1.getDb)().constructionRatioProfile.delete({ where: { id: Number(id) } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Santé de la bibliothèque ──────────────────────────────────────────
    electron_1.ipcMain.handle('construction:library:health', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const [lots, resourcesIndicatives, resourcesTotal, profiles] = await Promise.all([
                db.constructionLot.findMany({ where: { isActive: true, deletedAt: null }, include: { _count: { select: { workItems: true } } } }),
                db.constructionResource.count({ where: { isActive: true, deletedAt: null, priceIsIndicative: true } }),
                db.constructionResource.count({ where: { isActive: true, deletedAt: null } }),
                db.constructionRatioProfile.count({ where: { isActive: true } }),
            ]);
            const lotsSansOuvrage = lots.filter((l) => l._count.workItems === 0).map((l) => l.label);
            const couverturePct = lots.length > 0 ? Math.round(((lots.length - lotsSansOuvrage.length) / lots.length) * 100) : 0;
            return {
                success: true,
                data: { lotsSansOuvrage, ressourcesIndicatives: resourcesIndicatives, ressourcesTotal: resourcesTotal, profilsCount: profiles, couverturePct },
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
