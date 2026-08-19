"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initStorageOverride = initStorageOverride;
exports.registerSettingsIPC = registerSettingsIPC;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const auth_service_1 = require("../services/auth.service");
const db_service_1 = require("../services/db.service");
const logger_1 = __importDefault(require("../utils/logger"));
const settings_service_1 = require("../services/settings.service");
const storage_service_1 = require("../services/storage.service");
const os_1 = __importDefault(require("os"));
const email_service_1 = require("../services/email.service");
const sms_service_1 = require("../services/sms.service");
const whatsapp_service_1 = require("../services/whatsapp.service");
const secretCrypto_1 = require("../utils/secretCrypto");
const imapError_1 = require("../utils/imapError");
const imapflow_1 = require("imapflow");
/** Adresses IPv4 locales (hors loopback) — pour suggérer l'URL du QR. */
function getLocalIps() {
    const ips = [];
    const ifaces = os_1.default.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] ?? []) {
            if (iface.family === 'IPv4' && !iface.internal)
                ips.push(iface.address);
        }
    }
    return ips;
}
/** Paramètres applicatifs : réservés aux administrateurs. */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
// ── Schémas Zod ──────────────────────────────────────────────────────────────
const companySchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    denomination: zod_1.z.string().optional(),
    legalRepEmployeeId: zod_1.z.string().optional(),
    slogan: zod_1.z.string().optional(),
    registreCommerce: zod_1.z.string().optional(),
    compteContribuable: zod_1.z.string().optional(),
    phoneFixed: zod_1.z.string().optional(),
    phoneMobile1: zod_1.z.string().optional(),
    phoneMobile2: zod_1.z.string().optional(),
    website: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
});
const storageSchema = zod_1.z.object({
    path: zod_1.z.string().optional(),
    maxFileSizeMb: zod_1.z.coerce.number().int().positive().optional(),
});
const payrollAccountSchema = zod_1.z.object({
    // null / absent = aucun compte par défaut
    accountId: zod_1.z.number().int().positive().nullable().optional(),
});
const emailSchema = zod_1.z.object({
    host: zod_1.z.string().optional(),
    port: zod_1.z.coerce.number().int().min(1).max(65535).optional(),
    secure: zod_1.z.boolean().optional(),
    user: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
    fromAddress: zod_1.z.string().optional(),
    fromName: zod_1.z.string().optional(),
    signature: zod_1.z.string().optional(), // HTML — inséré via la variable {{signature}}
});
// Réception (IMAP) — boîte système partagée des relances (MailAccount.userId = null).
const imapSchema = zod_1.z.object({
    host: zod_1.z.string().optional(),
    port: zod_1.z.coerce.number().int().min(1).max(65535).optional(),
    secure: zod_1.z.boolean().optional(),
    user: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
    folder: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const smsSchema = zod_1.z.object({
    provider: zod_1.z.enum(['twilio', 'ovh', 'brevo', 'orange', 'mtn', '']).optional(),
    accountSid: zod_1.z.string().optional(),
    authToken: zod_1.z.string().optional(),
    from: zod_1.z.string().optional(),
    apiLogin: zod_1.z.string().optional(),
    apiPassword: zod_1.z.string().optional(),
    // WhatsApp — provider dédié (twilio ou infobip), avec credentials côte à côte.
    whatsappEnabled: zod_1.z.boolean().optional(),
    whatsappProvider: zod_1.z.enum(['twilio', 'infobip']).optional(),
    whatsappFrom: zod_1.z.string().optional(),
    whatsappInfobipBaseUrl: zod_1.z.string().optional(),
    whatsappInfobipApiKey: zod_1.z.string().optional(),
    whatsappInfobipFrom: zod_1.z.string().optional(),
});
const slideshowItemSchema = zod_1.z.object({
    type: zod_1.z.enum(['image', 'video']),
    src: zod_1.z.string().min(1),
    caption: zod_1.z.string().optional(),
    durationMs: zod_1.z.number().int().positive().optional(),
});
const slideshowSchema = zod_1.z.array(slideshowItemSchema);
const USER_ROLES = [
    'SUPER_ADMIN',
    'ADMIN',
    'MANAGER',
    'ACCOUNTANT',
    'ASSISTANTE_DIRECTION',
    'AGENT',
    'AGENT_TECHNIQUE',
    'READONLY',
];
const slideshowVisibilitySchema = zod_1.z.object({
    allowedRoles: zod_1.z.array(zod_1.z.enum(USER_ROLES)),
});
// Partage de localisation : un seul modèle global par canal, utilisé pour
// Lotissement / Terrain / Bien. Les variables non pertinentes pour l'entité
// courante sont substituées par une chaîne vide.
const shareLocationSchema = zod_1.z.object({
    emailSubject: zod_1.z.string().optional(),
    emailBody: zod_1.z.string().optional(),
    whatsappBody: zod_1.z.string().optional(),
});
const SHARE_LOCATION_DEFAULTS = {
    emailSubject: 'Localisation — {{entityTitle}}',
    emailBody: [
        'Bonjour {{recipientName}},',
        '',
        'Vous trouverez ci-dessous la localisation de {{entityTitle}} ({{reference}}) :',
        '',
        'Adresse : {{address}}',
        'Ville : {{ville}}',
        'Commune : {{commune}}',
        'Quartier : {{quartier}}',
        '',
        'Coordonnées GPS : {{latitude}}, {{longitude}}',
        'Carte Google Maps : {{googleMapsUrl}}',
        'Vue Google Earth : {{googleEarthUrl}}',
        '',
        'Cordialement,',
        '{{companyName}}',
        '{{signature}}',
    ].join('\n'),
    whatsappBody: [
        'Bonjour {{recipientName}}, voici la localisation de *{{entityTitle}}* ({{reference}}) :',
        '',
        'Adresse : {{address}}',
        'GPS : {{latitude}}, {{longitude}}',
        'Carte : {{googleMapsUrl}}',
        '',
        '— {{companyName}}',
    ].join('\n'),
};
const fileUploadSchema = zod_1.z.object({
    fileName: zod_1.z.string().min(1),
    fileType: zod_1.z.string().min(1),
    fileSize: zod_1.z.number().int().positive(),
    fileData: zod_1.z.string().min(1), // base64
});
// ── Helpers ──────────────────────────────────────────────────────────────────
/** Décode un payload base64 et vérifie la taille. Retourne le buffer. */
function decodeBase64(payload, maxBytes) {
    if (payload.fileSize > maxBytes) {
        throw new Error(`Fichier trop volumineux (max ${Math.round(maxBytes / 1024 / 1024)} Mo)`);
    }
    const buf = Buffer.from(payload.fileData, 'base64');
    if (buf.length === 0)
        throw new Error('Fichier vide ou base64 invalide');
    return buf;
}
/** Lecture initiale de `storage.path` au démarrage pour propager au storage.service. */
async function initStorageOverride() {
    try {
        const root = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.storagePath);
        if (root)
            (0, storage_service_1.setStorageRootOverride)(root);
    }
    catch (err) {
        logger_1.default.warn('initStorageOverride', err.message);
    }
}
// ── Enregistrement des handlers ──────────────────────────────────────────────
function registerSettingsIPC() {
    // ── Entreprise ─────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('settings:getCompany', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Lecture ouverte à tout utilisateur authentifié : les coordonnées de
            // l'entreprise (raison sociale, adresse, téléphones, RCCM…) sont des
            // informations publiques imprimées sur les documents clients (devis,
            // factures, attestations). La restriction admin ne s'applique qu'à
            // l'écriture (`settings:updateCompany`, logo). Sans cela, l'en-tête
            // entreprise ne s'affichait que pour les comptes SUPER_ADMIN / ADMIN.
            const map = await (0, settings_service_1.getSettings)([
                settings_service_1.SettingsKeys.companyName,
                settings_service_1.SettingsKeys.companyDenomination,
                settings_service_1.SettingsKeys.companyLegalRepEmployeeId,
                settings_service_1.SettingsKeys.companySlogan,
                settings_service_1.SettingsKeys.companyLogo,
                settings_service_1.SettingsKeys.companyRegistre,
                settings_service_1.SettingsKeys.companyContribuable,
                settings_service_1.SettingsKeys.companyPhoneFixed,
                settings_service_1.SettingsKeys.companyPhoneMobile1,
                settings_service_1.SettingsKeys.companyPhoneMobile2,
                settings_service_1.SettingsKeys.companyWebsite,
                settings_service_1.SettingsKeys.companyAddress,
                settings_service_1.SettingsKeys.companyEmail,
            ]);
            return {
                success: true,
                data: {
                    name: map[settings_service_1.SettingsKeys.companyName] ?? '',
                    denomination: map[settings_service_1.SettingsKeys.companyDenomination] ?? '',
                    legalRepEmployeeId: map[settings_service_1.SettingsKeys.companyLegalRepEmployeeId] ?? '',
                    slogan: map[settings_service_1.SettingsKeys.companySlogan] ?? '',
                    logoPath: map[settings_service_1.SettingsKeys.companyLogo] ?? '',
                    registreCommerce: map[settings_service_1.SettingsKeys.companyRegistre] ?? '',
                    compteContribuable: map[settings_service_1.SettingsKeys.companyContribuable] ?? '',
                    phoneFixed: map[settings_service_1.SettingsKeys.companyPhoneFixed] ?? '',
                    phoneMobile1: map[settings_service_1.SettingsKeys.companyPhoneMobile1] ?? '',
                    phoneMobile2: map[settings_service_1.SettingsKeys.companyPhoneMobile2] ?? '',
                    website: map[settings_service_1.SettingsKeys.companyWebsite] ?? '',
                    address: map[settings_service_1.SettingsKeys.companyAddress] ?? '',
                    email: map[settings_service_1.SettingsKeys.companyEmail] ?? '',
                },
            };
        }
        catch (err) {
            logger_1.default.error('settings:getCompany', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateCompany', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = companySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const entries = [];
            if (parsed.data.name !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyName, value: parsed.data.name });
            if (parsed.data.denomination !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyDenomination, value: parsed.data.denomination });
            if (parsed.data.legalRepEmployeeId !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyLegalRepEmployeeId, value: parsed.data.legalRepEmployeeId });
            if (parsed.data.slogan !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companySlogan, value: parsed.data.slogan });
            if (parsed.data.registreCommerce !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyRegistre, value: parsed.data.registreCommerce });
            if (parsed.data.compteContribuable !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyContribuable, value: parsed.data.compteContribuable });
            if (parsed.data.phoneFixed !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyPhoneFixed, value: parsed.data.phoneFixed });
            if (parsed.data.phoneMobile1 !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyPhoneMobile1, value: parsed.data.phoneMobile1 });
            if (parsed.data.phoneMobile2 !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyPhoneMobile2, value: parsed.data.phoneMobile2 });
            if (parsed.data.website !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyWebsite, value: parsed.data.website });
            if (parsed.data.address !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyAddress, value: parsed.data.address });
            if (parsed.data.email !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyEmail, value: parsed.data.email });
            await (0, settings_service_1.setSettings)(entries);
            logger_1.default.info('Paramètres entreprise mis à jour');
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateCompany', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Règlement intérieur (document GED ciblé par l'admin) ─────────────────────
    electron_1.ipcMain.handle('settings:getReglementInterieur', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.hrReglementInterieurDocId);
            const id = raw ? Number(raw) : null;
            let document = null;
            if (id) {
                document = await (0, db_service_1.getDb)().document.findFirst({
                    where: { id, deletedAt: null },
                    select: { id: true, name: true, type: true, numeroArchive: true },
                });
            }
            return { success: true, data: { documentId: document ? id : null, document } };
        }
        catch (err) {
            logger_1.default.error('settings:getReglementInterieur', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:setReglementInterieur', async (_event, { token, documentId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const value = documentId != null && documentId !== '' ? String(Number(documentId)) : '';
            await (0, settings_service_1.setSettings)([{ key: settings_service_1.SettingsKeys.hrReglementInterieurDocId, value }]);
            logger_1.default.info(`Règlement intérieur : document ${value || '(aucun)'}`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:setReglementInterieur', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Logo entreprise ────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('settings:uploadLogo', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = fileUploadSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            // Logo : max 5 Mo et format image attendu.
            const buf = decodeBase64(parsed.data, 5 * 1024 * 1024);
            const { relativePath } = (0, storage_service_1.writeLogoFile)(buf, parsed.data.fileName);
            await (0, settings_service_1.setSettings)([{ key: settings_service_1.SettingsKeys.companyLogo, value: relativePath }]);
            logger_1.default.info(`Logo entreprise mis à jour : ${relativePath}`);
            return { success: true, data: { relativePath } };
        }
        catch (err) {
            logger_1.default.error('settings:uploadLogo', err.message);
            return { success: false, error: err.message };
        }
    });
    /**
     * Supprime le logo entreprise : retire l'entrée AppSetting et le fichier
     * physique. Idempotent — ne fait rien si aucun logo n'est configuré.
     */
    electron_1.ipcMain.handle('settings:deleteLogo', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const rel = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.companyLogo);
            if (rel)
                (0, storage_service_1.removeStorageFile)(rel);
            // Vide la clé AppSetting (chaîne vide = pas de logo).
            await (0, settings_service_1.setSettings)([{ key: settings_service_1.SettingsKeys.companyLogo, value: '' }]);
            logger_1.default.info('Logo entreprise supprimé');
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:deleteLogo', err.message);
            return { success: false, error: err.message };
        }
    });
    /**
     * Renvoie le fichier logo en base64 pour affichage côté renderer.
     *
     * Accessible sans authentification : le logo apparaît également sur la page
     * de connexion (avant qu'un utilisateur n'ait ouvert de session).
     */
    electron_1.ipcMain.handle('settings:getLogoData', async (_event, _payload) => {
        try {
            const rel = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.companyLogo);
            if (!rel)
                return { success: true, data: null };
            const abs = (0, storage_service_1.resolveStoragePath)(rel);
            if (!fs_1.default.existsSync(abs))
                return { success: true, data: null };
            const buf = fs_1.default.readFileSync(abs);
            const ext = path_1.default.extname(rel).toLowerCase().replace('.', '') || 'png';
            const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            return { success: true, data: { base64: buf.toString('base64'), mimeType: mime } };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    /**
     * Logo de la page de connexion — lu DIRECTEMENT depuis le répertoire
     * `<storage>/logo/` (aucun accès base de données), pour un affichage immédiat
     * au démarrage à froid : la page de connexion n'attend plus une requête DB.
     * Accessible sans session.
     */
    electron_1.ipcMain.handle('settings:getLoginLogoData', async () => {
        try {
            const dir = path_1.default.join((0, storage_service_1.storageRoot)(), 'logo');
            if (!fs_1.default.existsSync(dir))
                return { success: true, data: null };
            const images = fs_1.default.readdirSync(dir).filter((f) => /\.(png|jpe?g|svg|webp|gif)$/i.test(f));
            if (images.length === 0)
                return { success: true, data: null };
            // Privilégie « company-logo.* » s'il existe, sinon la première image trouvée.
            const file = images.find((f) => /^company-logo\./i.test(f)) ?? images[0];
            const buf = fs_1.default.readFileSync(path_1.default.join(dir, file));
            const ext = path_1.default.extname(file).toLowerCase().replace('.', '') || 'png';
            const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            return { success: true, data: { base64: buf.toString('base64'), mimeType: mime } };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    // ── Stockage ───────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('settings:getStorage', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const map = await (0, settings_service_1.getSettings)([settings_service_1.SettingsKeys.storagePath, settings_service_1.SettingsKeys.storageMaxFileSizeMb]);
            return {
                success: true,
                data: {
                    path: map[settings_service_1.SettingsKeys.storagePath] ?? '',
                    maxFileSizeMb: map[settings_service_1.SettingsKeys.storageMaxFileSizeMb] ? Number(map[settings_service_1.SettingsKeys.storageMaxFileSizeMb]) : 10,
                    resolvedPath: (0, storage_service_1.storageRoot)(),
                },
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateStorage', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = storageSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            // Vérifie l'accessibilité du chemin avant de sauvegarder.
            if (parsed.data.path) {
                try {
                    fs_1.default.mkdirSync(parsed.data.path, { recursive: true });
                    // Test d'écriture : crée un fichier témoin puis le supprime.
                    const probe = path_1.default.join(parsed.data.path, '.afrikimmo-write-test');
                    fs_1.default.writeFileSync(probe, '');
                    fs_1.default.unlinkSync(probe);
                }
                catch (e) {
                    return { success: false, error: `Chemin de stockage inaccessible : ${e.message}` };
                }
            }
            const entries = [];
            if (parsed.data.path !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.storagePath, value: parsed.data.path });
            if (parsed.data.maxFileSizeMb !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.storageMaxFileSizeMb, value: String(parsed.data.maxFileSizeMb) });
            await (0, settings_service_1.setSettings)(entries);
            // Propage la nouvelle racine au storage.service.
            if (parsed.data.path !== undefined)
                (0, storage_service_1.setStorageRootOverride)(parsed.data.path || null);
            logger_1.default.info('Paramètres de stockage mis à jour');
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateStorage', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Paie : compte par défaut à débiter pour les salaires ─────────────────────
    electron_1.ipcMain.handle('settings:getPayrollAccount', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.payrollDefaultAccountId);
            const accountId = raw ? Number(raw) : null;
            // Liste des comptes communs actifs (débitables pour un salaire) pour le sélecteur
            const db = (0, db_service_1.getDb)();
            const accounts = await db.bankAccount.findMany({
                where: { deletedAt: null, isActive: true, linkedUserId: null },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, type: true },
            });
            // Le compte enregistré n'est plus valide (supprimé / désactivé / privé) → null
            const valid = accountId != null && accounts.some((a) => a.id === accountId) ? accountId : null;
            return { success: true, data: { accountId: valid, accounts } };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updatePayrollAccount', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = payrollAccountSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const id = parsed.data.accountId ?? null;
            if (id != null) {
                const db = (0, db_service_1.getDb)();
                const account = await db.bankAccount.findFirst({ where: { id, deletedAt: null } });
                if (!account)
                    return { success: false, error: 'Compte introuvable' };
                if (account.linkedUserId != null) {
                    return { success: false, error: 'Le compte de paie doit être un compte commun (non rattaché à un utilisateur).' };
                }
                if (!account.isActive)
                    return { success: false, error: 'Ce compte est inactif.' };
            }
            await (0, settings_service_1.setSettings)([{ key: settings_service_1.SettingsKeys.payrollDefaultAccountId, value: id != null ? String(id) : '' }]);
            logger_1.default.info(`Compte de paie par défaut : ${id ?? '(aucun)'}`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updatePayrollAccount', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Email (SMTP) ───────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('settings:getEmail', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const map = await (0, settings_service_1.getSettings)([
                settings_service_1.SettingsKeys.emailHost, settings_service_1.SettingsKeys.emailPort, settings_service_1.SettingsKeys.emailSecure,
                settings_service_1.SettingsKeys.emailUser, settings_service_1.SettingsKeys.emailFromAddress, settings_service_1.SettingsKeys.emailFromName,
                settings_service_1.SettingsKeys.emailSignature,
            ]);
            const passwordSet = await (0, settings_service_1.hasSecret)(settings_service_1.SettingsKeys.emailPassword);
            return {
                success: true,
                data: {
                    host: map[settings_service_1.SettingsKeys.emailHost] ?? '',
                    port: map[settings_service_1.SettingsKeys.emailPort] ? Number(map[settings_service_1.SettingsKeys.emailPort]) : 587,
                    secure: (map[settings_service_1.SettingsKeys.emailSecure] ?? 'false') === 'true',
                    user: map[settings_service_1.SettingsKeys.emailUser] ?? '',
                    password: passwordSet ? settings_service_1.SECRET_MASK : '',
                    passwordSet,
                    fromAddress: map[settings_service_1.SettingsKeys.emailFromAddress] ?? '',
                    fromName: map[settings_service_1.SettingsKeys.emailFromName] ?? '',
                    signature: map[settings_service_1.SettingsKeys.emailSignature] ?? '',
                },
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateEmail', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = emailSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const entries = [];
            const d = parsed.data;
            if (d.host !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.emailHost, value: d.host });
            if (d.port !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.emailPort, value: String(d.port) });
            if (d.secure !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.emailSecure, value: d.secure ? 'true' : 'false' });
            if (d.user !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.emailUser, value: d.user });
            if (d.fromAddress !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.emailFromAddress, value: d.fromAddress });
            if (d.fromName !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.emailFromName, value: d.fromName });
            if (d.signature !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.emailSignature, value: d.signature });
            await (0, settings_service_1.setSettings)(entries);
            // Mot de passe : ne change que si une nouvelle valeur explicite est fournie.
            if (d.password !== undefined && d.password !== settings_service_1.SECRET_MASK) {
                await (0, settings_service_1.setSecret)(settings_service_1.SettingsKeys.emailPassword, d.password);
            }
            logger_1.default.info('Paramètres SMTP mis à jour');
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateEmail', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:testEmail', async (_event, { token, to }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = zod_1.z.string().email().safeParse(to);
            if (!parsed.success)
                return { success: false, error: 'Adresse email invalide' };
            const r = await (0, email_service_1.sendTestEmail)(parsed.data);
            return { success: true, data: r };
        }
        catch (err) {
            logger_1.default.error('settings:testEmail', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Réception (IMAP) — boîte système partagée des relances ────────────────
    electron_1.ipcMain.handle('settings:getImap', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            const account = await db.mailAccount.findFirst({ where: { userId: null } });
            return {
                success: true,
                data: {
                    host: account?.imapHost ?? '',
                    port: account?.imapPort ?? 993,
                    secure: account?.imapSecure ?? true,
                    user: account?.imapUser ?? '',
                    password: account ? settings_service_1.SECRET_MASK : '',
                    passwordSet: !!account,
                    folder: account?.folder ?? 'INBOX',
                    isActive: account?.isActive ?? true,
                    lastPolledAt: account?.lastPolledAt ?? null,
                    lastError: account?.lastError ?? null,
                },
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateImap', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = imapSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const existing = await db.mailAccount.findFirst({ where: { userId: null } });
            const data = {};
            if (d.host !== undefined)
                data.imapHost = d.host;
            if (d.port !== undefined)
                data.imapPort = d.port;
            if (d.secure !== undefined)
                data.imapSecure = d.secure;
            if (d.user !== undefined)
                data.imapUser = d.user;
            if (d.folder !== undefined)
                data.folder = d.folder;
            if (d.isActive !== undefined)
                data.isActive = d.isActive;
            if (d.password !== undefined && d.password !== settings_service_1.SECRET_MASK) {
                data.imapPasswordEnc = (0, secretCrypto_1.encryptSecret)(d.password);
            }
            if (existing) {
                await db.mailAccount.update({ where: { id: existing.id }, data });
            }
            else {
                if (!data.imapHost || !data.imapUser || !data.imapPasswordEnc) {
                    return { success: false, error: 'Hôte, utilisateur et mot de passe requis pour créer la boîte de réception.' };
                }
                await db.mailAccount.create({
                    data: {
                        userId: null,
                        label: 'Boîte système — relances',
                        imapHost: data.imapHost,
                        imapPort: data.imapPort ?? 993,
                        imapSecure: data.imapSecure ?? true,
                        imapUser: data.imapUser,
                        imapPasswordEnc: data.imapPasswordEnc,
                        folder: data.folder ?? 'INBOX',
                        isActive: data.isActive ?? true,
                    },
                });
            }
            logger_1.default.info('Paramètres IMAP (boîte système) mis à jour');
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateImap', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:testImap', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            const account = await db.mailAccount.findFirst({ where: { userId: null } });
            if (!account)
                return { success: false, error: "Boîte de réception non configurée." };
            const { decryptSecret } = await Promise.resolve().then(() => __importStar(require('../utils/secretCrypto')));
            const password = decryptSecret(account.imapPasswordEnc);
            const client = new imapflow_1.ImapFlow({
                host: account.imapHost, port: account.imapPort, secure: account.imapSecure,
                auth: { user: account.imapUser, pass: password }, logger: false,
            });
            try {
                await client.connect();
                await client.logout();
            }
            finally {
                try {
                    client.close();
                }
                catch { /* déjà fermé */ }
            }
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:testImap', err.message);
            return { success: false, error: `Connexion IMAP échouée : ${(0, imapError_1.describeImapError)(err)}` };
        }
    });
    // ── SMS ────────────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('settings:getSms', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const map = await (0, settings_service_1.getSettings)([
                settings_service_1.SettingsKeys.smsProvider, settings_service_1.SettingsKeys.smsAccountSid, settings_service_1.SettingsKeys.smsFrom,
                settings_service_1.SettingsKeys.smsApiLogin,
                settings_service_1.SettingsKeys.whatsappEnabled, settings_service_1.SettingsKeys.whatsappProvider, settings_service_1.SettingsKeys.whatsappFrom,
                settings_service_1.SettingsKeys.whatsappInfobipBaseUrl, settings_service_1.SettingsKeys.whatsappInfobipFrom,
            ]);
            const [authTokenSet, apiPasswordSet, whatsappInfobipApiKeySet] = await Promise.all([
                (0, settings_service_1.hasSecret)(settings_service_1.SettingsKeys.smsAuthToken),
                (0, settings_service_1.hasSecret)(settings_service_1.SettingsKeys.smsApiPassword),
                (0, settings_service_1.hasSecret)(settings_service_1.SettingsKeys.whatsappInfobipApiKey),
            ]);
            return {
                success: true,
                data: {
                    provider: map[settings_service_1.SettingsKeys.smsProvider] ?? '',
                    accountSid: map[settings_service_1.SettingsKeys.smsAccountSid] ?? '',
                    authToken: authTokenSet ? settings_service_1.SECRET_MASK : '',
                    authTokenSet,
                    from: map[settings_service_1.SettingsKeys.smsFrom] ?? '',
                    apiLogin: map[settings_service_1.SettingsKeys.smsApiLogin] ?? '',
                    apiPassword: apiPasswordSet ? settings_service_1.SECRET_MASK : '',
                    apiPasswordSet,
                    whatsappEnabled: map[settings_service_1.SettingsKeys.whatsappEnabled] === 'true',
                    // Défaut historique = twilio (compatibilité avec configs existantes).
                    whatsappProvider: map[settings_service_1.SettingsKeys.whatsappProvider] ?? 'twilio',
                    whatsappFrom: map[settings_service_1.SettingsKeys.whatsappFrom] ?? '',
                    whatsappInfobipBaseUrl: map[settings_service_1.SettingsKeys.whatsappInfobipBaseUrl] ?? '',
                    whatsappInfobipFrom: map[settings_service_1.SettingsKeys.whatsappInfobipFrom] ?? '',
                    whatsappInfobipApiKey: whatsappInfobipApiKeySet ? settings_service_1.SECRET_MASK : '',
                    whatsappInfobipApiKeySet,
                },
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateSms', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = smsSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const d = parsed.data;
            const entries = [];
            if (d.provider !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.smsProvider, value: d.provider });
            if (d.accountSid !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.smsAccountSid, value: d.accountSid });
            if (d.from !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.smsFrom, value: d.from });
            if (d.apiLogin !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.smsApiLogin, value: d.apiLogin });
            if (d.whatsappEnabled !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.whatsappEnabled, value: d.whatsappEnabled ? 'true' : 'false' });
            if (d.whatsappProvider !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.whatsappProvider, value: d.whatsappProvider });
            if (d.whatsappFrom !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.whatsappFrom, value: d.whatsappFrom });
            if (d.whatsappInfobipBaseUrl !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.whatsappInfobipBaseUrl, value: d.whatsappInfobipBaseUrl });
            if (d.whatsappInfobipFrom !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.whatsappInfobipFrom, value: d.whatsappInfobipFrom });
            await (0, settings_service_1.setSettings)(entries);
            if (d.authToken !== undefined && d.authToken !== settings_service_1.SECRET_MASK) {
                await (0, settings_service_1.setSecret)(settings_service_1.SettingsKeys.smsAuthToken, d.authToken);
            }
            if (d.apiPassword !== undefined && d.apiPassword !== settings_service_1.SECRET_MASK) {
                await (0, settings_service_1.setSecret)(settings_service_1.SettingsKeys.smsApiPassword, d.apiPassword);
            }
            if (d.whatsappInfobipApiKey !== undefined && d.whatsappInfobipApiKey !== settings_service_1.SECRET_MASK) {
                await (0, settings_service_1.setSecret)(settings_service_1.SettingsKeys.whatsappInfobipApiKey, d.whatsappInfobipApiKey);
            }
            logger_1.default.info('Paramètres SMS mis à jour');
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateSms', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:testSms', async (_event, { token, to }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            if (!to || typeof to !== 'string')
                return { success: false, error: 'Numéro destinataire manquant' };
            const r = await (0, sms_service_1.sendTestSms)(to);
            return { success: true, data: r };
        }
        catch (err) {
            logger_1.default.error('settings:testSms', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:testWhatsapp', async (_event, { token, to }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            if (!to || typeof to !== 'string')
                return { success: false, error: 'Numéro destinataire manquant' };
            const r = await (0, whatsapp_service_1.sendTestWhatsapp)(to);
            return { success: true, data: r };
        }
        catch (err) {
            logger_1.default.error('settings:testWhatsapp', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Conditions particulières (conventions héritées) ─────────────────────────
    // Lecture accessible à toute session valide : le formulaire de convention en a
    // besoin pour alimenter le sélecteur, quel que soit le rôle de l'utilisateur.
    electron_1.ipcMain.handle('settings:getConditionsParticulieres', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.conventionConditionsParticulieres);
            let items = [];
            if (raw) {
                try {
                    const p = JSON.parse(raw);
                    if (Array.isArray(p)) {
                        // Rétrocompatibilité : anciennes entrées stockées comme simples chaînes.
                        items = p
                            .map((x) => (typeof x === 'string'
                            ? { title: '', text: x }
                            : { title: String(x?.title ?? ''), text: String(x?.text ?? '') }))
                            .filter((x) => x.text.length > 0);
                    }
                }
                catch {
                    items = [];
                }
            }
            return { success: true, data: items };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateConditionsParticulieres', async (_event, { token, items }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Édition ouverte aux managers et comptables (ACCOUNTANT hérite de MANAGER).
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']);
            const parsed = zod_1.z.array(zod_1.z.object({ title: zod_1.z.string(), text: zod_1.z.string() })).safeParse(items);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            // Nettoyage : on retire les entrées sans texte et on déduplique par texte.
            const seen = new Set();
            const cleaned = [];
            for (const it of parsed.data.map((it) => ({ title: it.title.trim(), text: it.text.trim() }))) {
                if (!it.text || seen.has(it.text))
                    continue;
                seen.add(it.text);
                cleaned.push(it);
            }
            await (0, settings_service_1.setSettings)([{ key: settings_service_1.SettingsKeys.conventionConditionsParticulieres, value: JSON.stringify(cleaned) }]);
            logger_1.default.info(`Informations particulières mises à jour (${cleaned.length} éléments)`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateConditionsParticulieres', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Slideshow ──────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('settings:getSlideshow', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.dashboardSlideshow);
            let items = [];
            if (raw) {
                try {
                    items = JSON.parse(raw);
                    if (!Array.isArray(items))
                        items = [];
                }
                catch {
                    items = [];
                }
            }
            return { success: true, data: items };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateSlideshow', async (_event, { token, items }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = slideshowSchema.safeParse(items);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            // Nettoyage des médias orphelins (présents avant et absents maintenant).
            const previousRaw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.dashboardSlideshow);
            const previous = previousRaw ? (() => { try {
                return JSON.parse(previousRaw);
            }
            catch {
                return [];
            } })() : [];
            const newSrcs = new Set(parsed.data.map((i) => i.src));
            for (const prev of previous) {
                if (prev?.src?.startsWith('slideshow/') && !newSrcs.has(prev.src)) {
                    (0, storage_service_1.removeStorageFile)(prev.src);
                }
            }
            await (0, settings_service_1.setSettings)([{ key: settings_service_1.SettingsKeys.dashboardSlideshow, value: JSON.stringify(parsed.data) }]);
            logger_1.default.info(`Slideshow mis à jour (${parsed.data.length} éléments)`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateSlideshow', err.message);
            return { success: false, error: err.message };
        }
    });
    /** Upload d'un média (image ou vidéo) du slideshow ; retourne le chemin relatif. */
    electron_1.ipcMain.handle('settings:uploadSlideshowMedia', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = fileUploadSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            // Slideshow : max 50 Mo (vidéos courtes).
            const buf = decodeBase64(parsed.data, 50 * 1024 * 1024);
            const { relativePath, size } = (0, storage_service_1.writeSlideshowFile)(buf, parsed.data.fileName);
            const type = parsed.data.fileType.startsWith('video/') ? 'video' : 'image';
            logger_1.default.info(`Slideshow média ajouté : ${relativePath} (${size} octets)`);
            return { success: true, data: { relativePath, type } };
        }
        catch (err) {
            logger_1.default.error('settings:uploadSlideshowMedia', err.message);
            return { success: false, error: err.message };
        }
    });
    /**
     * Lit la liste des rôles autorisés à voir le slideshow sur le tableau de bord.
     * Tableau vide = personne n'y a accès.
     */
    electron_1.ipcMain.handle('settings:getSlideshowVisibility', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.dashboardSlideshowRoles);
            let allowedRoles = [];
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed))
                        allowedRoles = parsed.filter((r) => typeof r === 'string');
                }
                catch {
                    allowedRoles = [];
                }
            }
            return { success: true, data: { allowedRoles } };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    /** Met à jour la liste des rôles autorisés à voir le slideshow. */
    electron_1.ipcMain.handle('settings:updateSlideshowVisibility', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = slideshowVisibilitySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const unique = Array.from(new Set(parsed.data.allowedRoles));
            await (0, settings_service_1.setSettings)([{ key: settings_service_1.SettingsKeys.dashboardSlideshowRoles, value: JSON.stringify(unique) }]);
            logger_1.default.info(`Visibilité du slideshow mise à jour (${unique.length} rôle(s) autorisé(s))`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateSlideshowVisibility', err.message);
            return { success: false, error: err.message };
        }
    });
    /** Lit un média du slideshow en base64 pour affichage côté renderer. */
    electron_1.ipcMain.handle('settings:getSlideshowMediaData', async (_event, { token, relativePath }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Lecture libre (le dashboard est consultable par tous les rôles connectés).
            if (typeof relativePath !== 'string' || !relativePath.startsWith('slideshow/')) {
                return { success: false, error: 'Chemin invalide' };
            }
            const abs = (0, storage_service_1.resolveStoragePath)(relativePath);
            if (!fs_1.default.existsSync(abs))
                return { success: false, error: 'Fichier introuvable' };
            const buf = fs_1.default.readFileSync(abs);
            const ext = path_1.default.extname(relativePath).toLowerCase().replace('.', '');
            const isVideo = ['mp4', 'webm', 'mov', 'm4v'].includes(ext);
            const mime = isVideo
                ? `video/${ext === 'mov' ? 'quicktime' : ext}`
                : `image/${ext === 'jpg' ? 'jpeg' : ext || 'png'}`;
            return { success: true, data: { base64: buf.toString('base64'), mimeType: mime } };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    // ── Partage de localisation GPS ─────────────────────────────────────────────
    /** Lit les modèles de message du partage de localisation (sujet/corps email + corps WhatsApp). */
    electron_1.ipcMain.handle('settings:getShareLocation', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const map = await (0, settings_service_1.getSettings)([
                settings_service_1.SettingsKeys.shareLocationEmailSubject,
                settings_service_1.SettingsKeys.shareLocationEmailBody,
                settings_service_1.SettingsKeys.shareLocationWhatsappBody,
            ]);
            return {
                success: true,
                data: {
                    emailSubject: map[settings_service_1.SettingsKeys.shareLocationEmailSubject] ?? SHARE_LOCATION_DEFAULTS.emailSubject,
                    emailBody: map[settings_service_1.SettingsKeys.shareLocationEmailBody] ?? SHARE_LOCATION_DEFAULTS.emailBody,
                    whatsappBody: map[settings_service_1.SettingsKeys.shareLocationWhatsappBody] ?? SHARE_LOCATION_DEFAULTS.whatsappBody,
                    defaults: SHARE_LOCATION_DEFAULTS,
                },
            };
        }
        catch (err) {
            logger_1.default.error('settings:getShareLocation', err.message);
            return { success: false, error: err.message };
        }
    });
    /** Met à jour les modèles de message de partage de localisation. */
    electron_1.ipcMain.handle('settings:updateShareLocation', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = shareLocationSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const entries = [];
            if (parsed.data.emailSubject !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.shareLocationEmailSubject, value: parsed.data.emailSubject });
            if (parsed.data.emailBody !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.shareLocationEmailBody, value: parsed.data.emailBody });
            if (parsed.data.whatsappBody !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.shareLocationWhatsappBody, value: parsed.data.whatsappBody });
            await (0, settings_service_1.setSettings)(entries);
            logger_1.default.info('Modèles de partage de localisation mis à jour');
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateShareLocation', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Pointage par QR Code ────────────────────────────────────────────────────
    /** Lit la configuration du pointage par QR (URL de l'app web + seuils horaires). */
    electron_1.ipcMain.handle('settings:getAttendanceQr', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const map = await (0, settings_service_1.getSettings)([
                settings_service_1.SettingsKeys.attendanceQrEnabled, settings_service_1.SettingsKeys.attendanceQrBaseUrl,
                settings_service_1.SettingsKeys.attendanceQrAllowedRoles, settings_service_1.SettingsKeys.attendanceQrModel,
                settings_service_1.SettingsKeys.attendanceExpectedArrival, settings_service_1.SettingsKeys.attendanceExpectedDeparture,
            ]);
            let allowedRoles = [];
            const rawRoles = map[settings_service_1.SettingsKeys.attendanceQrAllowedRoles];
            if (rawRoles) {
                try {
                    const p = JSON.parse(rawRoles);
                    if (Array.isArray(p))
                        allowedRoles = p.filter((r) => typeof r === 'string');
                }
                catch {
                    allowedRoles = [];
                }
            }
            const model = ['1', '2', '3'].includes(map[settings_service_1.SettingsKeys.attendanceQrModel] ?? '') ? map[settings_service_1.SettingsKeys.attendanceQrModel] : '1';
            return {
                success: true,
                data: {
                    enabled: map[settings_service_1.SettingsKeys.attendanceQrEnabled] === 'true',
                    baseUrl: map[settings_service_1.SettingsKeys.attendanceQrBaseUrl] ?? '',
                    allowedRoles,
                    model,
                    expectedArrival: map[settings_service_1.SettingsKeys.attendanceExpectedArrival] || '08:00',
                    expectedDeparture: map[settings_service_1.SettingsKeys.attendanceExpectedDeparture] || '17:00',
                    localIps: getLocalIps(),
                },
            };
        }
        catch (err) {
            logger_1.default.error('settings:getAttendanceQr', err.message);
            return { success: false, error: err.message };
        }
    });
    /**
     * Met à jour la config du pointage QR. Le pointage est servi par l'app web
     * autonome (dossier `web/` déposé sur le serveur web local) ; l'application ne
     * stocke que l'URL du QR, les rôles autorisés et les seuils horaires (ces
     * derniers lus par l'app web depuis AppSetting).
     */
    electron_1.ipcMain.handle('settings:updateAttendanceQr', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const hhmm = zod_1.z.string().regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, 'Format HH:MM attendu');
            const schema = zod_1.z.object({
                enabled: zod_1.z.boolean(),
                baseUrl: zod_1.z.string().trim().max(300).optional().default(''),
                allowedRoles: zod_1.z.array(zod_1.z.string()).default([]),
                model: zod_1.z.enum(['1', '2', '3']).default('1'),
                expectedArrival: hhmm,
                expectedDeparture: hhmm,
            });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const d = parsed.data;
            await (0, settings_service_1.setSettings)([
                { key: settings_service_1.SettingsKeys.attendanceQrEnabled, value: d.enabled ? 'true' : 'false' },
                { key: settings_service_1.SettingsKeys.attendanceQrBaseUrl, value: d.baseUrl },
                { key: settings_service_1.SettingsKeys.attendanceQrAllowedRoles, value: JSON.stringify(Array.from(new Set(d.allowedRoles))) },
                { key: settings_service_1.SettingsKeys.attendanceQrModel, value: d.model },
                { key: settings_service_1.SettingsKeys.attendanceExpectedArrival, value: d.expectedArrival },
                { key: settings_service_1.SettingsKeys.attendanceExpectedDeparture, value: d.expectedDeparture },
            ]);
            logger_1.default.info(`Pointage QR mis à jour (activé=${d.enabled})`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateAttendanceQr', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Modèles de messages — utilisateurs désignés (accès manuel) ──────────────
    /**
     * Liste des ids d'utilisateurs désignés, en plus de SUPER_ADMIN/ADMIN, pour
     * consulter/créer/modifier les modèles de messages de type « manuel »
     * (jamais les modèles « auto ») dans l'interface « Modèles de messages ».
     * Réservé aux administrateurs (paramétrage).
     */
    electron_1.ipcMain.handle('settings:getManualTemplateEditors', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.commTemplateManualEditorIds);
            let userIds = [];
            if (raw) {
                try {
                    const p = JSON.parse(raw);
                    if (Array.isArray(p))
                        userIds = p.filter((n) => Number.isInteger(n));
                }
                catch {
                    userIds = [];
                }
            }
            return { success: true, data: { userIds } };
        }
        catch (err) {
            logger_1.default.error('settings:getManualTemplateEditors', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateManualTemplateEditors', async (_event, { token, userIds }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const ids = Array.isArray(userIds)
                ? Array.from(new Set(userIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)))
                : [];
            const db = (0, db_service_1.getDb)();
            // Ne conserve que des utilisateurs existants et actifs.
            const validUsers = ids.length
                ? await db.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
                : [];
            const validIds = validUsers.map((u) => u.id);
            await (0, settings_service_1.setSetting)(settings_service_1.SettingsKeys.commTemplateManualEditorIds, JSON.stringify(validIds));
            logger_1.default.info(`Utilisateurs désignés (modèles manuels) mis à jour (${validIds.length} utilisateur(s))`);
            return { success: true, data: { userIds: validIds } };
        }
        catch (err) {
            logger_1.default.error('settings:updateManualTemplateEditors', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Fiche KYC (Clients, Propriétaires, Apporteurs d'affaire) — accès individuel ──
    // Rôles exclus par défaut des boutons « Fiche KYC » / « Fiche KYC non
    // renseignée » — accès individuel possible via la liste ci-dessous. Test de
    // rôle EXACT (pas d'équivalence checkRole) : tous les autres rôles gardent
    // un accès complet par défaut.
    const KYC_RESTRICTED_ROLES = ['AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION', 'READONLY'];
    async function kycAuthorizedUserIds() {
        const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.kycAuthorizedUserIds);
        if (!raw)
            return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
        }
        catch {
            return [];
        }
    }
    /**
     * Liste des ids d'utilisateurs individuellement autorisés à utiliser les
     * boutons « Fiche KYC » alors que leur rôle en est par défaut exclu. Réservé
     * aux administrateurs (paramétrage).
     */
    electron_1.ipcMain.handle('settings:getKycAuthorizedUsers', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const userIds = await kycAuthorizedUserIds();
            return { success: true, data: { userIds } };
        }
        catch (err) {
            logger_1.default.error('settings:getKycAuthorizedUsers', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateKycAuthorizedUsers', async (_event, { token, userIds }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const ids = Array.isArray(userIds)
                ? Array.from(new Set(userIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)))
                : [];
            const db = (0, db_service_1.getDb)();
            const validUsers = ids.length
                ? await db.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
                : [];
            const validIds = validUsers.map((u) => u.id);
            await (0, settings_service_1.setSetting)(settings_service_1.SettingsKeys.kycAuthorizedUserIds, JSON.stringify(validIds));
            logger_1.default.info(`Utilisateurs désignés (accès Fiche KYC) mis à jour (${validIds.length} utilisateur(s))`);
            return { success: true, data: { userIds: validIds } };
        }
        catch (err) {
            logger_1.default.error('settings:updateKycAuthorizedUsers', err.message);
            return { success: false, error: err.message };
        }
    });
    /**
     * Indique à l'utilisateur connecté s'il peut utiliser les boutons « Fiche
     * KYC » (Clients, Propriétaires, Apporteurs d'affaire) — utilisé côté
     * renderer pour afficher (ou non) ces boutons. Accessible à tout utilisateur
     * authentifié (pas réservé aux admins, contrairement à la gestion de la liste).
     */
    electron_1.ipcMain.handle('settings:myKycAccess', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const isRestricted = KYC_RESTRICTED_ROLES.includes(session.role);
            let hasAccess = !isRestricted;
            if (isRestricted) {
                const ids = await kycAuthorizedUserIds();
                hasAccess = ids.includes(session.userId);
            }
            return { success: true, data: { hasAccess } };
        }
        catch (err) {
            logger_1.default.error('settings:myKycAccess', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Retards & Départs précipités ────────────────────────────────────────────
    /** Limite de tolérance par défaut (minutes) si aucune valeur n'est encore paramétrée. */
    const DEFAULT_LATENESS_TOLERANCE_MINUTES = 15;
    // Lecture élargie à MANAGER : la page « Retards & Départs précipités » a
    // besoin de la limite de tolérance pour proposer l'action « Tolérer »
    // (réservée à SUPER_ADMIN/ADMIN/MANAGER), même si l'onglet Paramètres reste
    // masqué pour ce rôle. L'écriture (`updateLatenessSettings`) reste ADMIN_ROLES.
    const LATENESS_SETTINGS_READ_ROLES = [...ADMIN_ROLES, 'MANAGER'];
    /** Lit les paramètres de « Retards & Départs précipités » (inclusion management + limite de tolérance). */
    electron_1.ipcMain.handle('settings:getLatenessSettings', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, LATENESS_SETTINGS_READ_ROLES);
            const map = await (0, settings_service_1.getSettings)([settings_service_1.SettingsKeys.latenessIncludeManagementRoles, settings_service_1.SettingsKeys.latenessToleranceMinutes]);
            const rawTolerance = Number(map[settings_service_1.SettingsKeys.latenessToleranceMinutes]);
            return {
                success: true,
                data: {
                    includeManagementRoles: map[settings_service_1.SettingsKeys.latenessIncludeManagementRoles] === 'true',
                    toleranceMinutes: Number.isFinite(rawTolerance) && rawTolerance >= 0 ? rawTolerance : DEFAULT_LATENESS_TOLERANCE_MINUTES,
                },
            };
        }
        catch (err) {
            logger_1.default.error('settings:getLatenessSettings', err.message);
            return { success: false, error: err.message };
        }
    });
    /**
     * Met à jour les paramètres de « Retards & Départs précipités » :
     *  - inclusion des employés liés à un compte SUPER_ADMIN/ADMIN/MANAGER
     *    (exclus par défaut, aussi bien du calcul que de l'affichage) ;
     *  - limite de tolérance (minutes) en deçà de laquelle une journée peut être
     *    marquée « Tolérée » par SUPER_ADMIN/ADMIN/MANAGER.
     */
    electron_1.ipcMain.handle('settings:updateLatenessSettings', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const schema = zod_1.z.object({ includeManagementRoles: zod_1.z.boolean(), toleranceMinutes: zod_1.z.number().int().min(0).max(1440) });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            await (0, settings_service_1.setSettings)([
                { key: settings_service_1.SettingsKeys.latenessIncludeManagementRoles, value: parsed.data.includeManagementRoles ? 'true' : 'false' },
                { key: settings_service_1.SettingsKeys.latenessToleranceMinutes, value: String(parsed.data.toleranceMinutes) },
            ]);
            logger_1.default.info(`Retards & Départs précipités — inclusion SUPER_ADMIN/ADMIN/MANAGER : ${parsed.data.includeManagementRoles}, tolérance : ${parsed.data.toleranceMinutes} min`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateLatenessSettings', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── QR Visiteurs (app web autonome) ─────────────────────────────────────────
    /** Lit la configuration du QR Visiteurs (URL de l'app web + rôles + modèle). */
    electron_1.ipcMain.handle('settings:getVisitorQr', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const map = await (0, settings_service_1.getSettings)([
                settings_service_1.SettingsKeys.visitorQrEnabled, settings_service_1.SettingsKeys.visitorQrBaseUrl,
                settings_service_1.SettingsKeys.visitorQrAllowedRoles, settings_service_1.SettingsKeys.visitorQrModel,
            ]);
            let allowedRoles = [];
            const rawRoles = map[settings_service_1.SettingsKeys.visitorQrAllowedRoles];
            if (rawRoles) {
                try {
                    const p = JSON.parse(rawRoles);
                    if (Array.isArray(p))
                        allowedRoles = p.filter((r) => typeof r === 'string');
                }
                catch {
                    allowedRoles = [];
                }
            }
            const model = ['1', '2', '3'].includes(map[settings_service_1.SettingsKeys.visitorQrModel] ?? '') ? map[settings_service_1.SettingsKeys.visitorQrModel] : '1';
            return {
                success: true,
                data: {
                    enabled: map[settings_service_1.SettingsKeys.visitorQrEnabled] === 'true',
                    baseUrl: map[settings_service_1.SettingsKeys.visitorQrBaseUrl] ?? '',
                    allowedRoles,
                    model,
                    localIps: getLocalIps(),
                },
            };
        }
        catch (err) {
            logger_1.default.error('settings:getVisitorQr', err.message);
            return { success: false, error: err.message };
        }
    });
    /** Met à jour la config du QR Visiteurs (servi par l'app web `web-visiteurs/`). */
    electron_1.ipcMain.handle('settings:updateVisitorQr', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const schema = zod_1.z.object({
                enabled: zod_1.z.boolean(),
                baseUrl: zod_1.z.string().trim().max(300).optional().default(''),
                allowedRoles: zod_1.z.array(zod_1.z.string()).default([]),
                model: zod_1.z.enum(['1', '2', '3']).default('1'),
            });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const d = parsed.data;
            await (0, settings_service_1.setSettings)([
                { key: settings_service_1.SettingsKeys.visitorQrEnabled, value: d.enabled ? 'true' : 'false' },
                { key: settings_service_1.SettingsKeys.visitorQrBaseUrl, value: d.baseUrl },
                { key: settings_service_1.SettingsKeys.visitorQrAllowedRoles, value: JSON.stringify(Array.from(new Set(d.allowedRoles))) },
                { key: settings_service_1.SettingsKeys.visitorQrModel, value: d.model },
            ]);
            logger_1.default.info(`QR Visiteurs mis à jour (activé=${d.enabled})`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateVisitorQr', err.message);
            return { success: false, error: err.message };
        }
    });
    // ── Types de pièces d'identité ──────────────────────────────────────────────
    /** Liste les types de pièces d'identité (lecture ouverte à tout utilisateur connecté). */
    electron_1.ipcMain.handle('settings:listIdTypes', async (_event, { token, includeInactive = false }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const data = await db.idDocumentType.findMany({
                where: {
                    deletedAt: null,
                    ...(includeInactive ? {} : { isActive: true }),
                },
                orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
            });
            return { success: true, data };
        }
        catch (err) {
            logger_1.default.error('settings:listIdTypes', err.message);
            return { success: false, error: err.message };
        }
    });
    const idTypeCreateSchema = zod_1.z.object({
        code: zod_1.z.string().min(1, 'Code requis').regex(/^[A-Z0-9_]+$/i, 'Code invalide (lettres, chiffres, underscore)'),
        label: zod_1.z.string().min(1, 'Libellé requis'),
        isDefault: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    /** Crée un nouveau type de pièce d'identité (ADMIN). */
    electron_1.ipcMain.handle('settings:createIdType', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = idTypeCreateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const db = (0, db_service_1.getDb)();
            const data = parsed.data;
            // Un seul type par défaut : on retire le flag des autres si demandé.
            if (data.isDefault) {
                await db.idDocumentType.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
            }
            const created = await db.idDocumentType.create({ data: { ...data, code: data.code.toUpperCase() } });
            return { success: true, data: created };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    const idTypeUpdateSchema = zod_1.z.object({
        code: zod_1.z.string().min(1).regex(/^[A-Z0-9_]+$/i).optional(),
        label: zod_1.z.string().min(1).optional(),
        isDefault: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    /** Met à jour un type de pièce d'identité (ADMIN). */
    electron_1.ipcMain.handle('settings:updateIdType', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = idTypeUpdateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data, ...(parsed.data.code ? { code: parsed.data.code.toUpperCase() } : {}) };
            if (data.isDefault) {
                await db.idDocumentType.updateMany({
                    where: { isDefault: true, NOT: { id: Number(id) } },
                    data: { isDefault: false },
                });
            }
            const updated = await db.idDocumentType.update({ where: { id: Number(id) }, data });
            return { success: true, data: updated };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    /** Archive (soft delete) un type de pièce d'identité (ADMIN). */
    electron_1.ipcMain.handle('settings:deleteIdType', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            const target = await db.idDocumentType.findUnique({ where: { id: Number(id) } });
            if (!target)
                return { success: false, error: 'Type introuvable' };
            if (target.isDefault)
                return { success: false, error: 'Impossible de supprimer le type par défaut' };
            await db.idDocumentType.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    // ── Natures de titres de lotissement ────────────────────────────────────────
    /** Liste les natures de titres (lecture ouverte à tout utilisateur connecté). */
    electron_1.ipcMain.handle('settings:listTitleTypes', async (_event, { token, includeInactive = false }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const data = await db.lotissementTitleType.findMany({
                where: {
                    deletedAt: null,
                    ...(includeInactive ? {} : { isActive: true }),
                },
                orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
            });
            return { success: true, data };
        }
        catch (err) {
            logger_1.default.error('settings:listTitleTypes', err.message);
            return { success: false, error: err.message };
        }
    });
    const titleTypeCreateSchema = zod_1.z.object({
        code: zod_1.z.string().min(1, 'Code requis').regex(/^[A-Z0-9_]+$/i, 'Code invalide'),
        label: zod_1.z.string().min(1, 'Libellé requis'),
        documentsLivres: zod_1.z.string().optional().nullable(),
        isDefault: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('settings:createTitleType', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = titleTypeCreateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const db = (0, db_service_1.getDb)();
            const data = parsed.data;
            if (data.isDefault) {
                await db.lotissementTitleType.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
            }
            const created = await db.lotissementTitleType.create({ data: { ...data, code: data.code.toUpperCase() } });
            return { success: true, data: created };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    const titleTypeUpdateSchema = zod_1.z.object({
        code: zod_1.z.string().min(1).regex(/^[A-Z0-9_]+$/i).optional(),
        label: zod_1.z.string().min(1).optional(),
        documentsLivres: zod_1.z.string().optional().nullable(),
        isDefault: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('settings:updateTitleType', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = titleTypeUpdateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data, ...(parsed.data.code ? { code: parsed.data.code.toUpperCase() } : {}) };
            if (data.isDefault) {
                await db.lotissementTitleType.updateMany({
                    where: { isDefault: true, NOT: { id: Number(id) } },
                    data: { isDefault: false },
                });
            }
            const updated = await db.lotissementTitleType.update({ where: { id: Number(id) }, data });
            return { success: true, data: updated };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:deleteTitleType', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            const target = await db.lotissementTitleType.findUnique({ where: { id: Number(id) } });
            if (!target)
                return { success: false, error: 'Type introuvable' };
            if (target.isDefault)
                return { success: false, error: 'Impossible de supprimer le type par défaut' };
            await db.lotissementTitleType.update({
                where: { id: Number(id) },
                data: { deletedAt: new Date(), isActive: false },
            });
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
}
