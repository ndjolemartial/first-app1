"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureListExportTemplates = ensureListExportTemplates;
exports.resolveListExportTemplate = resolveListExportTemplate;
exports.registerListExportTemplatesIPC = registerListExportTemplatesIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
/** Sérialise pour l'IPC (les DateTime ne sont pas clonables tels quels). */
const ser = (v) => JSON.parse(JSON.stringify(v));
/** Modèle d'export de listes livré par défaut. */
const SEED_TEMPLATE = {
    name: 'Modèle par défaut',
    orientation: 'PAYSAGE',
    accentColor: '#1E3A5F',
    headerHtml: '<p><strong style="font-size:16px">AFRIKIMMO</strong> — Gestion immobilière</p>',
    footerHtml: '<p>Document généré par Afrikimmo-App.</p>',
};
/**
 * S'assure qu'au moins un modèle d'export de listes existe (création unique au
 * premier appel).
 * @returns la liste des modèles, triés par id.
 */
async function ensureListExportTemplates(db) {
    const count = await db.listExportTemplate.count();
    if (count === 0) {
        await db.listExportTemplate.create({ data: SEED_TEMPLATE });
        logger_1.default.info('List export template seeded');
    }
    return db.listExportTemplate.findMany({ orderBy: { id: 'asc' } });
}
/**
 * Résout le modèle d'export de listes à appliquer : le premier modèle actif,
 * sinon le premier modèle. Renvoie `null` si aucun (sécurité).
 */
async function resolveListExportTemplate(db) {
    const templates = await ensureListExportTemplates(db);
    if (templates.length === 0)
        return null;
    return templates.find((t) => t.isActive) ?? templates[0];
}
const updateTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    orientation: zod_1.z.enum(['PORTRAIT', 'PAYSAGE']).optional(),
    accentColor: zod_1.z.string().optional(),
    headerHtml: zod_1.z.string().optional(),
    footerHtml: zod_1.z.string().optional(),
    endOfDocument: zod_1.z.string().optional(),
    showLogo: zod_1.z.boolean().optional(),
    showGeneratedAt: zod_1.z.boolean().optional(),
    showRowCount: zod_1.z.boolean().optional(),
});
/**
 * Enregistre les handlers IPC pour les modèles d'export de listes.
 */
function registerListExportTemplatesIPC() {
    electron_1.ipcMain.handle('listExportTemplates:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const templates = await ensureListExportTemplates(db);
            return ser({ success: true, data: { templates } });
        }
        catch (error) {
            logger_1.default.error('listExportTemplates:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('listExportTemplates:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = updateTemplateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const template = await db.listExportTemplate.update({ where: { id }, data: parsed.data });
            logger_1.default.info(`List export template updated: id=${id}`);
            return ser({ success: true, data: template });
        }
        catch (error) {
            logger_1.default.error('listExportTemplates:update error', error.message);
            return { success: false, error: error.message };
        }
    });
}
