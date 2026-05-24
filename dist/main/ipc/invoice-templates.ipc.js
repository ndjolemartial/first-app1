"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVOICE_TYPES = void 0;
exports.ensureInvoiceTemplates = ensureInvoiceTemplates;
exports.getInvoiceTemplateDefaults = getInvoiceTemplateDefaults;
exports.resolveInvoiceTemplate = resolveInvoiceTemplate;
exports.registerInvoiceTemplatesIPC = registerInvoiceTemplatesIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
/** Types de facture pris en charge pour l'assignation d'un modèle par défaut. */
exports.INVOICE_TYPES = [
    'VENTE', 'ECHEANCE_VENTE', 'FRAIS_AGENCE', 'FRAIS_DE_GESTION', 'FRAIS_DEMARCHES_ACD',
    'AVANCE', 'CAUTION', 'OTHER',
];
/** Préfixe des clés AppSetting de correspondance type de facture → modèle. */
const SETTING_PREFIX = 'invoice.template.';
/** Sérialise pour l'IPC (les DateTime ne sont pas clonables tels quels). */
const ser = (v) => JSON.parse(JSON.stringify(v));
/** Les 3 modèles de facture livrés par défaut. */
const SEED_TEMPLATES = [
    {
        name: 'Classique',
        layout: 'CLASSIQUE',
        accentColor: '#1E3A5F',
        headerHtml: '<p><strong style="font-size:18px">AFRIKIMMO</strong><br>Gestion immobilière</p>',
        footerHtml: '<p>Merci de votre confiance. Règlement à réception de facture.</p>',
    },
    {
        name: 'Moderne',
        layout: 'MODERNE',
        accentColor: '#2563EB',
        headerHtml: '<p><strong style="font-size:18px">AFRIKIMMO</strong><br>Votre partenaire immobilier</p>',
        footerHtml: '<p>Document à valeur indicative — merci de votre confiance.</p>',
    },
    {
        name: 'Compact',
        layout: 'COMPACT',
        accentColor: '#0F766E',
        headerHtml: '<p><strong>AFRIKIMMO</strong> — Gestion immobilière</p>',
        footerHtml: '<p>Merci de votre confiance.</p>',
    },
];
/**
 * S'assure que les 3 modèles de facture existent (création unique au premier appel).
 * @returns la liste des modèles, triés par id.
 */
async function ensureInvoiceTemplates(db) {
    const count = await db.invoiceTemplate.count();
    if (count === 0) {
        for (const t of SEED_TEMPLATES) {
            await db.invoiceTemplate.create({ data: t });
        }
        logger_1.default.info('Invoice templates seeded (3 modèles)');
    }
    return db.invoiceTemplate.findMany({ orderBy: { id: 'asc' } });
}
/** Lit la correspondance type de facture → identifiant de modèle. */
async function getInvoiceTemplateDefaults(db) {
    const keys = exports.INVOICE_TYPES.map((t) => SETTING_PREFIX + t);
    const settings = await db.appSetting.findMany({ where: { key: { in: keys } } });
    const map = {};
    for (const s of settings) {
        const type = s.key.slice(SETTING_PREFIX.length);
        const id = Number(s.value);
        if (Number.isFinite(id))
            map[type] = id;
    }
    return map;
}
/**
 * Résout le modèle de facture à appliquer pour un type de facture donné :
 * le modèle par défaut configuré pour ce type, sinon le premier modèle.
 */
async function resolveInvoiceTemplate(db, invoiceType) {
    const templates = await ensureInvoiceTemplates(db);
    if (templates.length === 0)
        return null;
    const defaults = await getInvoiceTemplateDefaults(db);
    const defaultId = defaults[invoiceType];
    return templates.find((t) => t.id === defaultId) ?? templates[0];
}
const updateTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    layout: zod_1.z.enum(['CLASSIQUE', 'MODERNE', 'COMPACT']).optional(),
    headerHtml: zod_1.z.string().optional(),
    footerHtml: zod_1.z.string().optional(),
    accentColor: zod_1.z.string().optional(),
});
/**
 * Enregistre les handlers IPC pour les modèles de facture.
 */
function registerInvoiceTemplatesIPC() {
    electron_1.ipcMain.handle('invoiceTemplates:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const templates = await ensureInvoiceTemplates(db);
            const defaults = await getInvoiceTemplateDefaults(db);
            return ser({ success: true, data: { templates, defaults } });
        }
        catch (error) {
            logger_1.default.error('invoiceTemplates:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('invoiceTemplates:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = updateTemplateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const template = await db.invoiceTemplate.update({ where: { id }, data: parsed.data });
            logger_1.default.info(`Invoice template updated: id=${id}`);
            return ser({ success: true, data: template });
        }
        catch (error) {
            logger_1.default.error('invoiceTemplates:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('invoiceTemplates:setDefaults', async (_event, { token, defaults }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const entries = Object.entries(defaults ?? {});
            for (const [type, templateId] of entries) {
                if (!exports.INVOICE_TYPES.includes(type))
                    continue;
                const id = Number(templateId);
                if (!Number.isFinite(id) || id <= 0)
                    continue;
                const key = SETTING_PREFIX + type;
                await db.appSetting.upsert({
                    where: { key },
                    create: { key, value: String(id) },
                    update: { value: String(id) },
                });
            }
            logger_1.default.info(`Invoice template defaults updated by user=${session.userId}`);
            return { success: true, data: await getInvoiceTemplateDefaults(db) };
        }
        catch (error) {
            logger_1.default.error('invoiceTemplates:setDefaults error', error.message);
            return { success: false, error: error.message };
        }
    });
}
