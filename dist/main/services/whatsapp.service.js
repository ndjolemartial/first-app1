"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWhatsappConfig = loadWhatsappConfig;
exports.sendWhatsapp = sendWhatsapp;
exports.sendTestWhatsapp = sendTestWhatsapp;
const settings_service_1 = require("./settings.service");
const sms_service_1 = require("./sms.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Préfixe `whatsapp:` après normalisation E.164. Utilisé côté Twilio uniquement.
 */
function withWhatsappPrefix(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return '';
    if (trimmed.toLowerCase().startsWith('whatsapp:'))
        return trimmed;
    return `whatsapp:${(0, sms_service_1.toE164)(trimmed)}`;
}
/** Nettoie le numéro pour Infobip : E.164 sans `+` (Infobip attend `225...`). */
function toInfobipNumber(value) {
    return (0, sms_service_1.toE164)(value).replace(/^\+/, '');
}
/** Normalise une base URL Infobip : retire un éventuel `https://` ou `/` final. */
function cleanBaseUrl(value) {
    return value
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '');
}
/** Lit la configuration WhatsApp courante. */
async function loadWhatsappConfig() {
    const map = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.whatsappEnabled,
        settings_service_1.SettingsKeys.whatsappProvider,
        settings_service_1.SettingsKeys.whatsappFrom,
        settings_service_1.SettingsKeys.smsAccountSid,
        settings_service_1.SettingsKeys.whatsappInfobipBaseUrl,
        settings_service_1.SettingsKeys.whatsappInfobipFrom,
    ]);
    const [twilioAuthToken, infobipApiKey] = await Promise.all([
        (0, settings_service_1.getSecret)(settings_service_1.SettingsKeys.smsAuthToken),
        (0, settings_service_1.getSecret)(settings_service_1.SettingsKeys.whatsappInfobipApiKey),
    ]);
    // Défaut historique : si aucun provider explicite n'est défini, on
    // conserve le comportement Twilio (compat avec les configurations
    // existantes avant l'ajout d'Infobip).
    const provider = map[settings_service_1.SettingsKeys.whatsappProvider] ?? 'twilio';
    return {
        enabled: map[settings_service_1.SettingsKeys.whatsappEnabled] === 'true',
        provider,
        twilio: {
            accountSid: map[settings_service_1.SettingsKeys.smsAccountSid] ?? '',
            authToken: twilioAuthToken,
            from: withWhatsappPrefix(map[settings_service_1.SettingsKeys.whatsappFrom] ?? ''),
        },
        infobip: {
            baseUrl: cleanBaseUrl(map[settings_service_1.SettingsKeys.whatsappInfobipBaseUrl] ?? ''),
            apiKey: infobipApiKey,
            from: (map[settings_service_1.SettingsKeys.whatsappInfobipFrom] ?? '').trim(),
        },
    };
}
/** Envoie un message WhatsApp via Twilio. */
async function sendViaTwilio(cfg, to, body) {
    const { accountSid, authToken, from } = cfg.twilio;
    if (!accountSid || !authToken)
        throw new Error('Twilio : identifiants manquants (paramétrer dans SMS Twilio)');
    if (!from)
        throw new Error('WhatsApp Twilio : numéro émetteur (from) manquant');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams({
        To: withWhatsappPrefix(to),
        From: from,
        Body: body,
    });
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Twilio WhatsApp HTTP ${res.status} : ${text}`);
    }
}
/**
 * Envoie un message WhatsApp via l'API Infobip.
 *
 * Endpoint texte simple : POST `https://{baseUrl}/whatsapp/1/message/text`.
 * Authentification : header `Authorization: App {apiKey}`.
 *
 * Le sender doit être un numéro WhatsApp Business approuvé et enregistré
 * dans le portail Infobip (format E.164 sans `+`). Les destinataires sont
 * également en E.164 sans `+`.
 */
async function sendViaInfobip(cfg, to, body) {
    const { baseUrl, apiKey, from } = cfg.infobip;
    if (!baseUrl)
        throw new Error('Infobip : base URL manquante (ex. xxxxx.api.infobip.com)');
    if (!apiKey)
        throw new Error('Infobip : API key manquante');
    if (!from)
        throw new Error('WhatsApp Infobip : numéro émetteur (from) manquant');
    const url = `https://${baseUrl}/whatsapp/1/message/text`;
    const payload = {
        from: toInfobipNumber(from),
        to: toInfobipNumber(to),
        content: { text: body },
    };
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `App ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Infobip WhatsApp HTTP ${res.status} : ${text}`);
    }
}
/** Envoie un message WhatsApp via le provider configuré. */
async function sendWhatsapp(to, body) {
    if (!to)
        throw new Error('Destinataire manquant');
    if (!body)
        throw new Error('Message vide');
    const cfg = await loadWhatsappConfig();
    if (!cfg.enabled)
        throw new Error('WhatsApp désactivé dans les paramètres');
    switch (cfg.provider) {
        case 'twilio': return sendViaTwilio(cfg, to, body);
        case 'infobip': return sendViaInfobip(cfg, to, body);
        default: throw new Error(`Fournisseur WhatsApp inconnu : ${cfg.provider}`);
    }
}
/** Envoie un WhatsApp de test. */
async function sendTestWhatsapp(toNumber) {
    await sendWhatsapp(toNumber, 'Afrikimmo — test de configuration WhatsApp. Si vous recevez ce message, la configuration est opérationnelle.');
    logger_1.default.info(`WhatsApp de test envoyé à ${toNumber}`);
    return { ok: true };
}
