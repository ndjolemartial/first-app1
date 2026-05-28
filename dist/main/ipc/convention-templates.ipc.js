"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConventionTemplatesIPC = registerConventionTemplatesIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
const CONVENTION_TYPES = [
    'RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT',
    'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION',
];
const templateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nom requis'),
    type: zod_1.z.enum(CONVENTION_TYPES),
    amendmentType: zod_1.z.preprocess((v) => (v === '' || v === null ? undefined : v), zod_1.z.enum(['PROLONGATION_DELAI', 'TRANSFERT_PROPRIETE', 'TRANSFERT_SITE']).optional()),
    souscriptionType: zod_1.z.preprocess((v) => (v === '' || v === null ? undefined : v), zod_1.z.enum(['STANDARD', 'AVEC_ACD', 'FINANCEMENT_PROJET']).optional()),
    // En-tête monobloc — texte et/ou image ; toute image insérée occupe 100 %
    // de la largeur du bloc (CSS du rendu PDF).
    header: zod_1.z.string().optional(),
    headerWidth: zod_1.z.number().int().min(20).max(100).default(100),
    headerHeight: zod_1.z.number().int().min(40).max(800).default(140),
    body: zod_1.z.string().default(''),
    footer: zod_1.z.string().optional(),
    footerWidth: zod_1.z.number().int().min(20).max(100).default(100),
    footerHeight: zod_1.z.number().int().min(40).max(800).default(140),
    // Couleur de fond du footer : `#rrggbb`, `transparent`, ou null/undefined
    // pour conserver la valeur par défaut historique (#dc2626).
    footerBgColor: zod_1.z.preprocess((v) => (v === '' || v === null ? null : v), zod_1.z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/, 'Couleur invalide').nullable().optional()),
    endOfDocument: zod_1.z.string().optional(),
    endOfDocumentWidth: zod_1.z.number().int().min(20).max(100).default(100),
    endOfDocumentHeight: zod_1.z.number().int().min(40).max(800).default(140),
    endOfDocumentBgColor: zod_1.z.preprocess((v) => (v === '' || v === null ? null : v), zod_1.z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/, 'Couleur invalide').nullable().optional()),
    isActive: zod_1.z.boolean().default(true),
    isDefault: zod_1.z.boolean().default(false),
});
/**
 * Enregistre les handlers IPC pour les modèles de convention enrichis.
 */
function registerConventionTemplatesIPC() {
    electron_1.ipcMain.handle('conventionTemplates:list', async (_event, { token, filters = {}, page = 1, limit = 100 }) => {
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
                db.conventionTemplate.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: [{ type: 'asc' }, { name: 'asc' }],
                }),
                db.conventionTemplate.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('conventionTemplates:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventionTemplates:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const template = await db.conventionTemplate.findUnique({ where: { id } });
            if (!template || template.deletedAt)
                return { success: false, error: 'Modèle introuvable' };
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventionTemplates:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = templateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = { ...parsed.data };
            // Les sous-types ne s'appliquent qu'à leur type respectif
            if (d.type !== 'AVENANT')
                d.amendmentType = undefined;
            if (d.type !== 'SOUSCRIPTION')
                d.souscriptionType = undefined;
            // Un seul modèle par défaut par couple (type, sous-type) — un modèle
            // sans sous-type couvre toutes les natures de son type.
            if (d.isDefault) {
                await db.conventionTemplate.updateMany({
                    where: {
                        type: d.type, deletedAt: null,
                        amendmentType: d.amendmentType ?? null,
                        souscriptionType: d.souscriptionType ?? null,
                    },
                    data: { isDefault: false },
                });
            }
            const template = await db.conventionTemplate.create({ data: d });
            logger_1.default.info(`ConventionTemplate created: ${template.name}`);
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventionTemplates:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = templateSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = { ...parsed.data };
            // Nettoie les sous-types incohérents avec le type de convention
            if (d.type && d.type !== 'AVENANT')
                d.amendmentType = null;
            if (d.type && d.type !== 'SOUSCRIPTION')
                d.souscriptionType = null;
            if (d.isDefault && d.type) {
                await db.conventionTemplate.updateMany({
                    where: {
                        type: d.type, deletedAt: null, id: { not: id },
                        amendmentType: d.amendmentType ?? null,
                        souscriptionType: d.souscriptionType ?? null,
                    },
                    data: { isDefault: false },
                });
            }
            const template = await db.conventionTemplate.update({ where: { id }, data: d });
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventionTemplates:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.conventionTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
