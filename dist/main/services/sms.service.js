"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSmsConfig = loadSmsConfig;
exports.sendSms = sendSms;
exports.sendTestSms = sendTestSms;
const settings_service_1 = require("./settings.service");
const logger_1 = __importDefault(require("../utils/logger"));
/** Lit la configuration SMS courante. */
async function loadSmsConfig() {
    const map = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.smsProvider,
        settings_service_1.SettingsKeys.smsAccountSid,
        settings_service_1.SettingsKeys.smsFrom,
        settings_service_1.SettingsKeys.smsApiLogin,
    ]);
    const [authToken, apiPassword] = await Promise.all([
        (0, settings_service_1.getSecret)(settings_service_1.SettingsKeys.smsAuthToken),
        (0, settings_service_1.getSecret)(settings_service_1.SettingsKeys.smsApiPassword),
    ]);
    return {
        provider: map[settings_service_1.SettingsKeys.smsProvider] ?? '',
        accountSid: map[settings_service_1.SettingsKeys.smsAccountSid] ?? '',
        authToken,
        from: map[settings_service_1.SettingsKeys.smsFrom] ?? '',
        apiLogin: map[settings_service_1.SettingsKeys.smsApiLogin] ?? '',
        apiPassword,
    };
}
/** Envoie un SMS via Twilio (REST API). */
async function sendViaTwilio(cfg, to, body) {
    if (!cfg.accountSid || !cfg.authToken)
        throw new Error('Twilio : identifiants manquants');
    if (!cfg.from)
        throw new Error('Twilio : numéro émetteur (from) manquant');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`;
    const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: cfg.from, Body: body });
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Twilio HTTP ${res.status} : ${text}`);
    }
}
/** Envoie un SMS via OVH (API key/secret simulés ici via login/password basic). */
async function sendViaOvh(cfg, to, body) {
    if (!cfg.apiLogin || !cfg.apiPassword)
        throw new Error('OVH : identifiants manquants');
    if (!cfg.from)
        throw new Error('OVH : nom émetteur (from) manquant');
    // Endpoint générique OVH SMS — l'URL exacte dépend du compte ; on utilise ici
    // l'API de simulation. À adapter selon la convention OVH du client.
    const url = `https://www.ovh.com/cgi-bin/sms/http2sms.cgi`;
    const params = new URLSearchParams({
        account: cfg.apiLogin,
        login: cfg.apiLogin,
        password: cfg.apiPassword,
        from: cfg.from,
        to,
        message: body,
        noStop: '1',
        contentType: 'text/json',
    });
    const res = await fetch(`${url}?${params.toString()}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`OVH HTTP ${res.status} : ${text}`);
    }
}
/** Envoie un SMS via Brevo (anciennement Sendinblue). */
async function sendViaBrevo(cfg, to, body) {
    if (!cfg.apiLogin)
        throw new Error('Brevo : clé API manquante');
    if (!cfg.from)
        throw new Error('Brevo : nom émetteur (from) manquant');
    const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
        method: 'POST',
        headers: {
            'api-key': cfg.apiLogin,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            sender: cfg.from,
            recipient: to,
            content: body,
            type: 'transactional',
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Brevo HTTP ${res.status} : ${text}`);
    }
}
/** Envoie un SMS via le fournisseur configuré. */
async function sendSms(to, body) {
    if (!to)
        throw new Error('Destinataire manquant');
    if (!body)
        throw new Error('Message vide');
    const cfg = await loadSmsConfig();
    if (!cfg.provider)
        throw new Error('SMS non configuré (fournisseur manquant)');
    switch (cfg.provider) {
        case 'twilio': return sendViaTwilio(cfg, to, body);
        case 'ovh': return sendViaOvh(cfg, to, body);
        case 'brevo': return sendViaBrevo(cfg, to, body);
        default: throw new Error(`Fournisseur SMS inconnu : ${cfg.provider}`);
    }
}
/** Envoie un SMS de test au numéro fourni. */
async function sendTestSms(toNumber) {
    await sendSms(toNumber, 'Afrikimmo — test de configuration SMS. Si vous recevez ce message, la configuration est opérationnelle.');
    logger_1.default.info(`SMS de test envoyé à ${toNumber}`);
    return { ok: true };
}
