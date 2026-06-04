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
 * Préfixe `whatsapp:` après normalisation E.164. Accepte les saisies locales
 * ivoiriennes (`0701020304`), internationales (`+2250701020304`) ou déjà
 * préfixées (`whatsapp:+2250701020304`).
 */
function withWhatsappPrefix(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return '';
    if (trimmed.toLowerCase().startsWith('whatsapp:'))
        return trimmed;
    return `whatsapp:${(0, sms_service_1.toE164)(trimmed)}`;
}
/** Lit la configuration WhatsApp courante. */
async function loadWhatsappConfig() {
    const map = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.whatsappEnabled,
        settings_service_1.SettingsKeys.whatsappFrom,
        settings_service_1.SettingsKeys.smsAccountSid,
    ]);
    const authToken = await (0, settings_service_1.getSecret)(settings_service_1.SettingsKeys.smsAuthToken);
    return {
        enabled: map[settings_service_1.SettingsKeys.whatsappEnabled] === 'true',
        accountSid: map[settings_service_1.SettingsKeys.smsAccountSid] ?? '',
        authToken,
        from: withWhatsappPrefix(map[settings_service_1.SettingsKeys.whatsappFrom] ?? ''),
    };
}
/** Envoie un message WhatsApp via Twilio. */
async function sendWhatsapp(to, body) {
    if (!to)
        throw new Error('Destinataire manquant');
    if (!body)
        throw new Error('Message vide');
    const cfg = await loadWhatsappConfig();
    if (!cfg.enabled)
        throw new Error('WhatsApp désactivé dans les paramètres');
    if (!cfg.accountSid || !cfg.authToken)
        throw new Error('Twilio : identifiants manquants (paramétrer dans SMS Twilio)');
    if (!cfg.from)
        throw new Error('WhatsApp : numéro émetteur (from) manquant');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`;
    const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
    const params = new URLSearchParams({
        To: withWhatsappPrefix(to),
        From: cfg.from,
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
/** Envoie un WhatsApp de test. */
async function sendTestWhatsapp(toNumber) {
    await sendWhatsapp(toNumber, 'Afrikimmo — test de configuration WhatsApp. Si vous recevez ce message, la configuration est opérationnelle.');
    logger_1.default.info(`WhatsApp de test envoyé à ${toNumber}`);
    return { ok: true };
}
