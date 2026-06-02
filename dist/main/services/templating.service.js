"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCompanyVariables = loadCompanyVariables;
exports.renderTemplate = renderTemplate;
exports.renderMessage = renderMessage;
const settings_service_1 = require("./settings.service");
/** Lit les variables d'entreprise + signature depuis les paramètres applicatifs. */
async function loadCompanyVariables() {
    const map = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.companyName,
        settings_service_1.SettingsKeys.companySlogan,
        settings_service_1.SettingsKeys.companyRegistre,
        settings_service_1.SettingsKeys.companyContribuable,
        settings_service_1.SettingsKeys.companyPhoneFixed,
        settings_service_1.SettingsKeys.companyPhoneMobile1,
        settings_service_1.SettingsKeys.companyPhoneMobile2,
        settings_service_1.SettingsKeys.companyWebsite,
        settings_service_1.SettingsKeys.companyAddress,
        settings_service_1.SettingsKeys.emailSignature,
    ]);
    return {
        companyName: map[settings_service_1.SettingsKeys.companyName] ?? '',
        companySlogan: map[settings_service_1.SettingsKeys.companySlogan] ?? '',
        companyRegistre: map[settings_service_1.SettingsKeys.companyRegistre] ?? '',
        companyContribuable: map[settings_service_1.SettingsKeys.companyContribuable] ?? '',
        companyPhoneFixed: map[settings_service_1.SettingsKeys.companyPhoneFixed] ?? '',
        companyPhoneMobile1: map[settings_service_1.SettingsKeys.companyPhoneMobile1] ?? '',
        companyPhoneMobile2: map[settings_service_1.SettingsKeys.companyPhoneMobile2] ?? '',
        companyWebsite: map[settings_service_1.SettingsKeys.companyWebsite] ?? '',
        companyAddress: map[settings_service_1.SettingsKeys.companyAddress] ?? '',
        signature: map[settings_service_1.SettingsKeys.emailSignature] ?? '',
    };
}
/** Substitue les jetons `{{cle}}` par leur valeur (chaîne vide si absente). */
function renderTemplate(template, vars) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
        const v = vars[k];
        return v === null || v === undefined ? '' : String(v);
    });
}
/**
 * Rend un message (sujet + corps) en chargeant les variables d'entreprise et
 * en les fusionnant avec les variables additionnelles fournies. Les variables
 * passées en `extra` ont la priorité sur celles de l'entreprise.
 */
async function renderMessage(parts, extra = {}) {
    const company = await loadCompanyVariables();
    const vars = { ...company, ...extra };
    return {
        subject: parts.subject ? renderTemplate(parts.subject, vars) : undefined,
        body: renderTemplate(parts.body, vars),
    };
}
