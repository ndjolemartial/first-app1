"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPermitLibraryIPC = registerPermitLibraryIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
/**
 * Bibliothèque technique du moteur de devis de permis de construire
 * (Module 18) : communes, catalogue de prestations/frais/taxes
 * (`PermitFeeItem`), surcharges de taux, tranches de surface.
 *
 * Mêmes règles d'accès que le module Devis construction (Module 17) :
 * lecture ouverte aux rôles impliqués dans la production de devis, écriture
 * ouverte à **SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT** (rôle EXACT, sans les
 * équivalences de `checkRole`) — le module Permis n'ayant pas d'équivalent
 * de la « Bibliothèque d'ouvrages » du Module 17 (recettes complexes,
 * réservées SUPER_ADMIN/ADMIN uniquement côté Construction), l'ensemble de
 * sa bibliothèque technique (communes, catalogue de prestations, surcharges,
 * tranches) est traité au niveau le plus permissif de la matrice Construction.
 */
const LIB_EXTENDED_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const LIB_READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION', 'READONLY'];
function checkLibExtendedWrite(session) {
    if (!LIB_EXTENDED_WRITE_ROLES.includes(session.role))
        throw new Error('Permission insuffisante');
}
const ser = (v) => JSON.parse(JSON.stringify(v));
const dec = (v) => (v == null ? null : String(v));
const ZONE_TYPES = ['URBAINE', 'RURALE'];
const NATURES = ['VILLA', 'IMMEUBLE', 'COMMERCE', 'BUREAU', 'HOTEL', 'USINE', 'ENTREPOT'];
const STANDINGS = ['ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE'];
const CATEGORIES = [
    'ARCHITECTE', 'BET_STRUCTURE', 'BET_FLUIDES', 'BET_ELECTRICITE', 'BET_VRD', 'BET_GEOTECHNIQUE',
    'GEOMETRE', 'ETUDE_SOL', 'ETUDE_HYDROLOGIE', 'ETUDE_ENVIRONNEMENT', 'ETUDE_INCENDIE',
    'FRAIS_ADMINISTRATIF', 'TAXE',
];
const CALC_MODES = ['POURCENTAGE_COUT_TRAVAUX', 'FORFAIT', 'PAR_M2_TERRAIN', 'PAR_M2_BATI', 'BAREME_SURFACE'];
const MISSION_PHASES = ['ESQUISSE', 'APS', 'APD', 'PLANS_EXECUTION', 'SUIVI_CHANTIER', 'RECEPTION'];
const communeSchema = zod_1.z.object({
    nom: zod_1.z.string().min(1, 'Nom de la commune requis'),
    district: zod_1.z.string().nullable().optional(),
    region: zod_1.z.string().nullable().optional(),
    zoneType: zod_1.z.enum(ZONE_TYPES).default('URBAINE'),
    isActive: zod_1.z.boolean().optional(),
});
const feeItemSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    category: zod_1.z.enum(CATEGORIES),
    label: zod_1.z.string().min(1),
    description: zod_1.z.string().nullable().optional(),
    calcMode: zod_1.z.enum(CALC_MODES),
    missionPhase: zod_1.z.enum(MISSION_PHASES).nullable().optional(),
    defaultValue: zod_1.z.number().min(0),
    unit: zod_1.z.string().nullable().optional(),
    applicabilityRule: zod_1.z.any().nullable().optional(),
    sortOrder: zod_1.z.number().int().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const rateOverrideSchema = zod_1.z.object({
    feeItemId: zod_1.z.number().int().positive(),
    nature: zod_1.z.enum(NATURES).nullable().optional(),
    standing: zod_1.z.enum(STANDINGS).nullable().optional(),
    communeId: zod_1.z.number().int().positive().nullable().optional(),
    value: zod_1.z.number().min(0),
});
const surfaceBracketSchema = zod_1.z.object({
    feeItemId: zod_1.z.number().int().positive(),
    minSurface: zod_1.z.number().min(0),
    maxSurface: zod_1.z.number().min(0).nullable().optional(),
    value: zod_1.z.number().min(0),
    label: zod_1.z.string().nullable().optional(),
    sortOrder: zod_1.z.number().int().optional(),
});
function registerPermitLibraryIPC() {
    // ── Communes ─────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('permits:communes:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().permitCommune.findMany({ where, orderBy: { nom: 'asc' } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:communes:upsert', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = communeSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const data = id
                ? await db.permitCommune.update({ where: { id: Number(id) }, data: parsed.data })
                : await db.permitCommune.create({ data: parsed.data });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('permits:communes:upsert error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:communes:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            await (0, db_service_1.getDb)().permitCommune.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Catalogue de prestations/frais/taxes ────────────────────────────
    electron_1.ipcMain.handle('permits:feeItems:list', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const where = { deletedAt: null };
            if (!filters.includeInactive)
                where.isActive = true;
            if (filters.category)
                where.category = filters.category;
            if (filters.search) {
                where.OR = [{ code: { contains: filters.search } }, { label: { contains: filters.search } }];
            }
            const data = await (0, db_service_1.getDb)().permitFeeItem.findMany({
                where, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
                include: { _count: { select: { rateOverrides: true, surfaceBrackets: true } } },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:feeItems:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const data = await (0, db_service_1.getDb)().permitFeeItem.findUnique({
                where: { id: Number(id) },
                include: {
                    rateOverrides: { include: { commune: true } },
                    surfaceBrackets: { orderBy: { minSurface: 'asc' } },
                },
            });
            if (!data || data.deletedAt)
                return { success: false, error: 'Prestation introuvable' };
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:feeItems:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = feeItemSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const d = parsed.data;
            const data = await (0, db_service_1.getDb)().permitFeeItem.create({
                data: {
                    code: d.code, category: d.category, label: d.label, description: d.description ?? null,
                    calcMode: d.calcMode, missionPhase: d.missionPhase ?? null, defaultValue: dec(d.defaultValue),
                    unit: d.unit ?? null, applicabilityRule: d.applicabilityRule ?? null,
                    sortOrder: d.sortOrder ?? 0, isActive: d.isActive ?? true,
                },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('permits:feeItems:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:feeItems:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = feeItemSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const d = parsed.data;
            const values = { ...d };
            if (d.defaultValue != null)
                values.defaultValue = dec(d.defaultValue);
            const data = await (0, db_service_1.getDb)().permitFeeItem.update({ where: { id: Number(id) }, data: values });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('permits:feeItems:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:feeItems:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            await (0, db_service_1.getDb)().permitFeeItem.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Surcharges de taux ──────────────────────────────────────────────
    electron_1.ipcMain.handle('permits:rateOverrides:list', async (_event, { token, feeItemId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const data = await (0, db_service_1.getDb)().permitFeeRateOverride.findMany({
                where: { feeItemId: Number(feeItemId) }, include: { commune: true }, orderBy: { id: 'asc' },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:rateOverrides:upsert', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = rateOverrideSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const d = parsed.data;
            const values = {
                feeItemId: d.feeItemId, nature: d.nature ?? null, standing: d.standing ?? null,
                communeId: d.communeId ?? null, value: dec(d.value),
            };
            const db = (0, db_service_1.getDb)();
            const data = id
                ? await db.permitFeeRateOverride.update({ where: { id: Number(id) }, data: values })
                : await db.permitFeeRateOverride.create({ data: values });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('permits:rateOverrides:upsert error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:rateOverrides:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            await (0, db_service_1.getDb)().permitFeeRateOverride.delete({ where: { id: Number(id) } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Tranches de surface (BAREME_SURFACE) ────────────────────────────
    electron_1.ipcMain.handle('permits:surfaceBrackets:list', async (_event, { token, feeItemId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LIB_READ_ROLES);
            const data = await (0, db_service_1.getDb)().permitFeeSurfaceBracket.findMany({
                where: { feeItemId: Number(feeItemId) }, orderBy: { minSurface: 'asc' },
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:surfaceBrackets:upsert', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            const parsed = surfaceBracketSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const d = parsed.data;
            const values = {
                feeItemId: d.feeItemId, minSurface: dec(d.minSurface),
                maxSurface: d.maxSurface != null ? dec(d.maxSurface) : null,
                value: dec(d.value), label: d.label ?? null, sortOrder: d.sortOrder ?? 0,
            };
            const db = (0, db_service_1.getDb)();
            const data = id
                ? await db.permitFeeSurfaceBracket.update({ where: { id: Number(id) }, data: values })
                : await db.permitFeeSurfaceBracket.create({ data: values });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('permits:surfaceBrackets:upsert error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:surfaceBrackets:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkLibExtendedWrite(session);
            await (0, db_service_1.getDb)().permitFeeSurfaceBracket.delete({ where: { id: Number(id) } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
