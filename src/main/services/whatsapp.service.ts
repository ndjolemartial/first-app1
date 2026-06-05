import { getSettings, getSecret, SettingsKeys } from './settings.service';
import { toE164 } from './sms.service';
import logger from '../utils/logger';

/**
 * Service d'envoi WhatsApp — deux providers optionnels :
 *
 *   - `twilio`  : WhatsApp Business via Twilio. Réutilise les credentials SMS
 *                 Twilio (`sms.twilio.accountSid` / `sms.twilio.authToken`).
 *                 Le sender est de la forme `whatsapp:+E164` (sandbox ou
 *                 numéro Business approuvé).
 *   - `infobip` : WhatsApp Business via Infobip. Endpoint propre à chaque
 *                 compte (sous-domaine unique), API key dédiée, sender = numéro
 *                 WhatsApp Business enregistré côté Infobip en format E.164.
 *
 * L'appel utilise `fetch` natif (Node ≥ 18). La configuration peut changer à
 * chaud — relue à chaque envoi.
 */

export type WhatsappProvider = 'twilio' | 'infobip';

export interface WhatsappConfig {
  enabled:  boolean;
  provider: WhatsappProvider;
  // ── Twilio ───────────────────────────────────────────────────────────────
  twilio: {
    accountSid: string;
    authToken:  string;
    from:       string;  // toujours préfixé `whatsapp:`
  };
  // ── Infobip ──────────────────────────────────────────────────────────────
  infobip: {
    baseUrl: string;     // ex. 'xxxxx.api.infobip.com' (sans https://)
    apiKey:  string;
    from:    string;     // numéro E.164 sans `whatsapp:`
  };
}

/**
 * Préfixe `whatsapp:` après normalisation E.164. Utilisé côté Twilio uniquement.
 */
function withWhatsappPrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().startsWith('whatsapp:')) return trimmed;
  return `whatsapp:${toE164(trimmed)}`;
}

/** Nettoie le numéro pour Infobip : E.164 sans `+` (Infobip attend `225...`). */
function toInfobipNumber(value: string): string {
  return toE164(value).replace(/^\+/, '');
}

/** Normalise une base URL Infobip : retire un éventuel `https://` ou `/` final. */
function cleanBaseUrl(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

/** Lit la configuration WhatsApp courante. */
export async function loadWhatsappConfig(): Promise<WhatsappConfig> {
  const map = await getSettings([
    SettingsKeys.whatsappEnabled,
    SettingsKeys.whatsappProvider,
    SettingsKeys.whatsappFrom,
    SettingsKeys.smsAccountSid,
    SettingsKeys.whatsappInfobipBaseUrl,
    SettingsKeys.whatsappInfobipFrom,
  ]);
  const [twilioAuthToken, infobipApiKey] = await Promise.all([
    getSecret(SettingsKeys.smsAuthToken),
    getSecret(SettingsKeys.whatsappInfobipApiKey),
  ]);
  // Défaut historique : si aucun provider explicite n'est défini, on
  // conserve le comportement Twilio (compat avec les configurations
  // existantes avant l'ajout d'Infobip).
  const provider = (map[SettingsKeys.whatsappProvider] as WhatsappProvider | null) ?? 'twilio';
  return {
    enabled:  map[SettingsKeys.whatsappEnabled] === 'true',
    provider,
    twilio: {
      accountSid: map[SettingsKeys.smsAccountSid] ?? '',
      authToken:  twilioAuthToken,
      from:       withWhatsappPrefix(map[SettingsKeys.whatsappFrom] ?? ''),
    },
    infobip: {
      baseUrl: cleanBaseUrl(map[SettingsKeys.whatsappInfobipBaseUrl] ?? ''),
      apiKey:  infobipApiKey,
      from:    (map[SettingsKeys.whatsappInfobipFrom] ?? '').trim(),
    },
  };
}

/** Envoie un message WhatsApp via Twilio. */
async function sendViaTwilio(cfg: WhatsappConfig, to: string, body: string): Promise<void> {
  const { accountSid, authToken, from } = cfg.twilio;
  if (!accountSid || !authToken) throw new Error('Twilio : identifiants manquants (paramétrer dans SMS Twilio)');
  if (!from) throw new Error('WhatsApp Twilio : numéro émetteur (from) manquant');

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams({
    To:   withWhatsappPrefix(to),
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
async function sendViaInfobip(cfg: WhatsappConfig, to: string, body: string): Promise<void> {
  const { baseUrl, apiKey, from } = cfg.infobip;
  if (!baseUrl) throw new Error('Infobip : base URL manquante (ex. xxxxx.api.infobip.com)');
  if (!apiKey)  throw new Error('Infobip : API key manquante');
  if (!from)    throw new Error('WhatsApp Infobip : numéro émetteur (from) manquant');

  const url = `https://${baseUrl}/whatsapp/1/message/text`;
  const payload = {
    from:    toInfobipNumber(from),
    to:      toInfobipNumber(to),
    content: { text: body },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:  `App ${apiKey}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Infobip WhatsApp HTTP ${res.status} : ${text}`);
  }
}

/** Envoie un message WhatsApp via le provider configuré. */
export async function sendWhatsapp(to: string, body: string): Promise<void> {
  if (!to) throw new Error('Destinataire manquant');
  if (!body) throw new Error('Message vide');
  const cfg = await loadWhatsappConfig();
  if (!cfg.enabled) throw new Error('WhatsApp désactivé dans les paramètres');
  switch (cfg.provider) {
    case 'twilio':  return sendViaTwilio(cfg, to, body);
    case 'infobip': return sendViaInfobip(cfg, to, body);
    default: throw new Error(`Fournisseur WhatsApp inconnu : ${cfg.provider}`);
  }
}

/** Envoie un WhatsApp de test. */
export async function sendTestWhatsapp(toNumber: string): Promise<{ ok: true }> {
  await sendWhatsapp(toNumber, 'Afrikimmo — test de configuration WhatsApp. Si vous recevez ce message, la configuration est opérationnelle.');
  logger.info(`WhatsApp de test envoyé à ${toNumber}`);
  return { ok: true };
}
