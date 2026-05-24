"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSmtpConfig = loadSmtpConfig;
exports.createTransporter = createTransporter;
exports.sendTestEmail = sendTestEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const settings_service_1 = require("./settings.service");
const logger_1 = __importDefault(require("../utils/logger"));
/** Lit la configuration SMTP courante (mot de passe en clair en mémoire). */
async function loadSmtpConfig() {
    const map = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.emailHost,
        settings_service_1.SettingsKeys.emailPort,
        settings_service_1.SettingsKeys.emailSecure,
        settings_service_1.SettingsKeys.emailUser,
        settings_service_1.SettingsKeys.emailFromAddress,
        settings_service_1.SettingsKeys.emailFromName,
    ]);
    const password = await (0, settings_service_1.getSecret)(settings_service_1.SettingsKeys.emailPassword);
    return {
        host: map[settings_service_1.SettingsKeys.emailHost] ?? '',
        port: Number(map[settings_service_1.SettingsKeys.emailPort] ?? 587),
        secure: (map[settings_service_1.SettingsKeys.emailSecure] ?? 'false') === 'true',
        user: map[settings_service_1.SettingsKeys.emailUser] ?? '',
        password,
        fromAddress: map[settings_service_1.SettingsKeys.emailFromAddress] ?? '',
        fromName: map[settings_service_1.SettingsKeys.emailFromName] ?? '',
    };
}
/** Construit le transporteur Nodemailer à partir de la config courante. */
async function createTransporter() {
    const cfg = await loadSmtpConfig();
    if (!cfg.host)
        throw new Error('SMTP non configuré (host manquant)');
    return nodemailer_1.default.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    });
}
/** Envoie un email de test à l'adresse fournie. */
async function sendTestEmail(toAddress) {
    const cfg = await loadSmtpConfig();
    if (!cfg.host)
        throw new Error('SMTP non configuré (host manquant)');
    if (!toAddress)
        throw new Error('Adresse destinataire manquante');
    const transporter = await createTransporter();
    const fromHeader = cfg.fromName
        ? `"${cfg.fromName}" <${cfg.fromAddress || cfg.user}>`
        : (cfg.fromAddress || cfg.user);
    const info = await transporter.sendMail({
        from: fromHeader,
        to: toAddress,
        subject: 'Afrikimmo — test de configuration SMTP',
        text: "Ceci est un message de test envoyé depuis le module Paramètres de l'application Afrikimmo. Si vous le recevez, la configuration SMTP est opérationnelle.",
        html: "<p>Ceci est un message de test envoyé depuis le module Paramètres de l'application <strong>Afrikimmo</strong>.</p><p>Si vous le recevez, la configuration SMTP est opérationnelle.</p>",
    });
    logger_1.default.info(`SMTP test envoyé à ${toAddress} (messageId=${info.messageId})`);
    return { ok: true, messageId: info.messageId };
}
