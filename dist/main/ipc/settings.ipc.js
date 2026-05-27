"use strict";
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
const email_service_1 = require("../services/email.service");
const sms_service_1 = require("../services/sms.service");
/** Paramètres applicatifs : réservés aux administrateurs. */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
// ── Schémas Zod ──────────────────────────────────────────────────────────────
const companySchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    slogan: zod_1.z.string().optional(),
    registreCommerce: zod_1.z.string().optional(),
    compteContribuable: zod_1.z.string().optional(),
});
const storageSchema = zod_1.z.object({
    path: zod_1.z.string().optional(),
    maxFileSizeMb: zod_1.z.coerce.number().int().positive().optional(),
});
const emailSchema = zod_1.z.object({
    host: zod_1.z.string().optional(),
    port: zod_1.z.coerce.number().int().min(1).max(65535).optional(),
    secure: zod_1.z.boolean().optional(),
    user: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
    fromAddress: zod_1.z.string().optional(),
    fromName: zod_1.z.string().optional(),
});
const smsSchema = zod_1.z.object({
    provider: zod_1.z.enum(['twilio', 'ovh', 'brevo', '']).optional(),
    accountSid: zod_1.z.string().optional(),
    authToken: zod_1.z.string().optional(),
    from: zod_1.z.string().optional(),
    apiLogin: zod_1.z.string().optional(),
    apiPassword: zod_1.z.string().optional(),
});
const slideshowItemSchema = zod_1.z.object({
    type: zod_1.z.enum(['image', 'video']),
    src: zod_1.z.string().min(1),
    caption: zod_1.z.string().optional(),
    durationMs: zod_1.z.number().int().positive().optional(),
});
const slideshowSchema = zod_1.z.array(slideshowItemSchema);
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
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const map = await (0, settings_service_1.getSettings)([
                settings_service_1.SettingsKeys.companyName,
                settings_service_1.SettingsKeys.companySlogan,
                settings_service_1.SettingsKeys.companyLogo,
                settings_service_1.SettingsKeys.companyRegistre,
                settings_service_1.SettingsKeys.companyContribuable,
            ]);
            return {
                success: true,
                data: {
                    name: map[settings_service_1.SettingsKeys.companyName] ?? '',
                    slogan: map[settings_service_1.SettingsKeys.companySlogan] ?? '',
                    logoPath: map[settings_service_1.SettingsKeys.companyLogo] ?? '',
                    registreCommerce: map[settings_service_1.SettingsKeys.companyRegistre] ?? '',
                    compteContribuable: map[settings_service_1.SettingsKeys.companyContribuable] ?? '',
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
            if (parsed.data.slogan !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companySlogan, value: parsed.data.slogan });
            if (parsed.data.registreCommerce !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyRegistre, value: parsed.data.registreCommerce });
            if (parsed.data.compteContribuable !== undefined)
                entries.push({ key: settings_service_1.SettingsKeys.companyContribuable, value: parsed.data.compteContribuable });
            await (0, settings_service_1.setSettings)(entries);
            logger_1.default.info('Paramètres entreprise mis à jour');
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('settings:updateCompany', err.message);
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
            ]);
            const [authTokenSet, apiPasswordSet] = await Promise.all([
                (0, settings_service_1.hasSecret)(settings_service_1.SettingsKeys.smsAuthToken),
                (0, settings_service_1.hasSecret)(settings_service_1.SettingsKeys.smsApiPassword),
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
            await (0, settings_service_1.setSettings)(entries);
            if (d.authToken !== undefined && d.authToken !== settings_service_1.SECRET_MASK) {
                await (0, settings_service_1.setSecret)(settings_service_1.SettingsKeys.smsAuthToken, d.authToken);
            }
            if (d.apiPassword !== undefined && d.apiPassword !== settings_service_1.SECRET_MASK) {
                await (0, settings_service_1.setSecret)(settings_service_1.SettingsKeys.smsApiPassword, d.apiPassword);
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
