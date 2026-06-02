import { SettingsKeys, getSettings } from './settings.service';

/**
 * Helpers de rendu pour les messages (emails, SMS, rappels).
 *
 * Centralise :
 *   - le chargement des variables d'entreprise (nom, contacts, site, adresse…)
 *     depuis les AppSetting ;
 *   - la substitution `{{cle}}` → valeur avec un dictionnaire arbitraire.
 *
 * Toute communication sortante (envoi manuel ou relance automatique) passe par
 * `renderMessage` pour résoudre ces variables avant transmission au transport.
 */

export type TemplateVars = Record<string, string | number | null | undefined>;

/** Lit les variables d'entreprise + signature depuis les paramètres applicatifs. */
export async function loadCompanyVariables(): Promise<Record<string, string>> {
  const map = await getSettings([
    SettingsKeys.companyName,
    SettingsKeys.companySlogan,
    SettingsKeys.companyRegistre,
    SettingsKeys.companyContribuable,
    SettingsKeys.companyPhoneFixed,
    SettingsKeys.companyPhoneMobile1,
    SettingsKeys.companyPhoneMobile2,
    SettingsKeys.companyWebsite,
    SettingsKeys.companyAddress,
    SettingsKeys.emailSignature,
  ]);
  return {
    companyName:         map[SettingsKeys.companyName] ?? '',
    companySlogan:       map[SettingsKeys.companySlogan] ?? '',
    companyRegistre:     map[SettingsKeys.companyRegistre] ?? '',
    companyContribuable: map[SettingsKeys.companyContribuable] ?? '',
    companyPhoneFixed:   map[SettingsKeys.companyPhoneFixed] ?? '',
    companyPhoneMobile1: map[SettingsKeys.companyPhoneMobile1] ?? '',
    companyPhoneMobile2: map[SettingsKeys.companyPhoneMobile2] ?? '',
    companyWebsite:      map[SettingsKeys.companyWebsite] ?? '',
    companyAddress:      map[SettingsKeys.companyAddress] ?? '',
    signature:           map[SettingsKeys.emailSignature] ?? '',
  };
}

/** Substitue les jetons `{{cle}}` par leur valeur (chaîne vide si absente). */
export function renderTemplate(template: string, vars: TemplateVars): string {
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
export async function renderMessage(
  parts: { subject?: string | null; body: string },
  extra: TemplateVars = {},
): Promise<{ subject?: string; body: string }> {
  const company = await loadCompanyVariables();
  const vars: TemplateVars = { ...company, ...extra };
  return {
    subject: parts.subject ? renderTemplate(parts.subject, vars) : undefined,
    body:    renderTemplate(parts.body, vars),
  };
}
