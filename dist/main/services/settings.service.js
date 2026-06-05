"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECRET_KEYS = exports.SettingsKeys = exports.SECRET_MASK = void 0;
exports.getSetting = getSetting;
exports.getSecret = getSecret;
exports.hasSecret = hasSecret;
exports.getSettings = getSettings;
exports.setSetting = setSetting;
exports.setSecret = setSecret;
exports.setSettings = setSettings;
const electron_1 = require("electron");
const db_service_1 = require("./db.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Service de paramétrage applicatif.
 *
 * Toutes les valeurs sont persistées en base via le modèle `AppSetting`
 * (clé → valeur). Les secrets (mots de passe SMTP/SMS, jetons API) sont
 * chiffrés via `safeStorage` Electron avant d'être insérés et déchiffrés
 * uniquement côté main process. Les champs marqués comme secrets ne sont
 * jamais renvoyés en clair au renderer.
 */
/** Convention : préfixe « enc: » devant la valeur indique un secret chiffré. */
const ENC_PREFIX = 'enc:';
/** Marqueur renvoyé au renderer pour indiquer qu'un secret est défini sans le révéler. */
exports.SECRET_MASK = '••••••••';
/** Vrai si l'environnement supporte le chiffrement safeStorage. */
function canEncrypt() {
    try {
        return electron_1.safeStorage.isEncryptionAvailable();
    }
    catch {
        return false;
    }
}
/** Chiffre une chaîne avant stockage (no-op si safeStorage indisponible). */
function encrypt(plain) {
    if (!plain)
        return '';
    if (!canEncrypt()) {
        logger_1.default.warn('safeStorage indisponible — secret stocké en clair');
        return plain;
    }
    return ENC_PREFIX + electron_1.safeStorage.encryptString(plain).toString('base64');
}
/** Déchiffre une valeur (retourne la chaîne brute si non chiffrée). */
function decrypt(stored) {
    if (!stored)
        return '';
    if (!stored.startsWith(ENC_PREFIX))
        return stored;
    if (!canEncrypt()) {
        logger_1.default.warn('safeStorage indisponible — impossible de déchiffrer un secret');
        return '';
    }
    try {
        const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
        return electron_1.safeStorage.decryptString(buf);
    }
    catch (err) {
        logger_1.default.error('safeStorage decryptString error', err.message);
        return '';
    }
}
// ── API publique ─────────────────────────────────────────────────────────────
/** Lit une valeur brute de l'AppSetting (chaîne). */
async function getSetting(key) {
    const db = (0, db_service_1.getDb)();
    const row = await db.appSetting.findUnique({ where: { key } });
    return row?.value ?? null;
}
/** Lit un secret (déchiffré). */
async function getSecret(key) {
    const raw = await getSetting(key);
    return raw ? decrypt(raw) : '';
}
/** Indique si un secret est défini (sans le révéler). */
async function hasSecret(key) {
    const raw = await getSetting(key);
    return !!raw && raw.length > 0;
}
/** Lit plusieurs valeurs en une requête, retourne un dictionnaire { key → value | null }. */
async function getSettings(keys) {
    const db = (0, db_service_1.getDb)();
    const rows = await db.appSetting.findMany({ where: { key: { in: keys } } });
    const map = {};
    for (const k of keys)
        map[k] = null;
    for (const r of rows)
        map[r.key] = r.value;
    return map;
}
/** Écrit ou crée une valeur AppSetting. */
async function setSetting(key, value) {
    const db = (0, db_service_1.getDb)();
    await db.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
    });
}
/** Écrit un secret (chiffré). Une chaîne vide supprime la valeur. */
async function setSecret(key, plain) {
    if (!plain) {
        const db = (0, db_service_1.getDb)();
        await db.appSetting.deleteMany({ where: { key } });
        return;
    }
    await setSetting(key, encrypt(plain));
}
/** Écrit plusieurs paires en une transaction. */
async function setSettings(entries) {
    if (entries.length === 0)
        return;
    const db = (0, db_service_1.getDb)();
    await db.$transaction(entries.map((e) => db.appSetting.upsert({
        where: { key: e.key },
        create: { key: e.key, value: e.value },
        update: { value: e.value },
    })));
}
// ── Clés et helpers de groupage ──────────────────────────────────────────────
exports.SettingsKeys = {
    // Entreprise
    companyName: 'company.name',
    companySlogan: 'company.slogan',
    companyLogo: 'company.logoPath', // chemin relatif dans STORAGE_PATH
    companyRegistre: 'company.registreCommerce',
    companyContribuable: 'company.compteContribuable',
    companyPhoneFixed: 'company.phone.fixed',
    companyPhoneMobile1: 'company.phone.mobile1',
    companyPhoneMobile2: 'company.phone.mobile2',
    companyWebsite: 'company.website',
    companyAddress: 'company.address',
    // Stockage
    storagePath: 'storage.path',
    storageMaxFileSizeMb: 'storage.maxFileSizeMb',
    // Email (SMTP)
    emailHost: 'email.smtp.host',
    emailPort: 'email.smtp.port',
    emailSecure: 'email.smtp.secure', // 'true' | 'false'
    emailUser: 'email.smtp.user',
    emailPassword: 'email.smtp.password', // secret
    emailFromAddress: 'email.from.address',
    emailFromName: 'email.from.name',
    emailSignature: 'email.signature', // HTML — bloc de signature ajouté en pied via {{signature}}
    // SMS
    smsProvider: 'sms.provider', // twilio | ovh | brevo
    smsAccountSid: 'sms.twilio.accountSid',
    smsAuthToken: 'sms.twilio.authToken', // secret
    smsFrom: 'sms.from',
    smsApiLogin: 'sms.api.login', // OVH/Brevo
    smsApiPassword: 'sms.api.password', // secret OVH/Brevo
    // WhatsApp — deux providers supportés :
    //   - twilio  : réutilise sms.twilio.accountSid/authToken, sender préfixé `whatsapp:`
    //   - infobip : credentials dédiés (base URL d'API + API key + sender E.164)
    whatsappEnabled: 'whatsapp.enabled', // 'true' | 'false'
    whatsappProvider: 'whatsapp.provider', // 'twilio' | 'infobip'
    whatsappFrom: 'whatsapp.from', // sender Twilio (`whatsapp:+...`) ou numéro approuvé
    whatsappInfobipBaseUrl: 'whatsapp.infobip.baseUrl', // ex. 'xxxxx.api.infobip.com' (sans https://)
    whatsappInfobipApiKey: 'whatsapp.infobip.apiKey', // secret
    whatsappInfobipFrom: 'whatsapp.infobip.from', // sender Infobip (numéro E.164 sans `whatsapp:`)
    // Slideshow dashboard (JSON array)
    dashboardSlideshow: 'dashboard.slideshow',
    // Rôles autorisés à voir le slideshow du tableau de bord (JSON array de UserRole)
    dashboardSlideshowRoles: 'dashboard.slideshow.allowedRoles',
    // Politique de relance (communication automatique)
    remindersEnabled: 'reminders.enabled', // 'true' | 'false'
    remindersQuietStart: 'reminders.quietHours.start', // 'HH:MM' (par défaut 08:00)
    remindersQuietEnd: 'reminders.quietHours.end', // 'HH:MM' (par défaut 20:00)
    remindersQuietDays: 'reminders.quietDays', // JSON array de 0..6 (0=dimanche)
    // Partage de localisation GPS — modèles de message pour Lotissement / Terrain / Bien.
    // Un seul modèle par canal couvre les 3 types d'entités : les variables qui ne
    // s'appliquent pas à l'entité courante sont substituées par chaîne vide.
    shareLocationEmailSubject: 'share.location.email.subject',
    shareLocationEmailBody: 'share.location.email.body',
    shareLocationWhatsappBody: 'share.location.whatsapp.body',
};
/** Liste des clés correspondant à des secrets chiffrés. */
exports.SECRET_KEYS = new Set([
    exports.SettingsKeys.emailPassword,
    exports.SettingsKeys.smsAuthToken,
    exports.SettingsKeys.smsApiPassword,
    exports.SettingsKeys.whatsappInfobipApiKey,
]);
