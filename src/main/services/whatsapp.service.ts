import { getSettings, getSecret, SettingsKeys } from './settings.service';
import { toE164 } from './sms.service';
import logger from '../utils/logger';

/**
 * Service d'envoi WhatsApp — Twilio WhatsApp Business API.
 *
 * Réutilise les credentials Twilio déjà configurés pour le SMS
 * (`smsAccountSid` / `smsAuthToken`). Le numéro émetteur WhatsApp est
 * en revanche distinct (`whatsappFrom`) : ce doit être soit le numéro
 * sandbox Twilio (`whatsapp:+14155238886`) en développement, soit un
 * numéro WhatsApp Business approuvé en production. Twilio attend les
 * adresses WhatsApp sous la forme `whatsapp:+E164` — on préfixe
 * automatiquement si l'utilisateur a fourni un simple numéro.
 *
 * Comme pour le SMS, l'appel utilise `fetch` natif (Node ≥ 18). La
 * configuration peut changer à chaud — relue à chaque envoi.
 */

export interface WhatsappConfig {
  enabled:    boolean;
  accountSid: string;
  authToken:  string;
  from:       string;  // toujours préfixé `whatsapp:`
}

/**
 * Préfixe `whatsapp:` après normalisation E.164. Accepte les saisies locales
 * ivoiriennes (`0701020304`), internationales (`+2250701020304`) ou déjà
 * préfixées (`whatsapp:+2250701020304`).
 */
function withWhatsappPrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().startsWith('whatsapp:')) return trimmed;
  return `whatsapp:${toE164(trimmed)}`;
}

/** Lit la configuration WhatsApp courante. */
export async function loadWhatsappConfig(): Promise<WhatsappConfig> {
  const map = await getSettings([
    SettingsKeys.whatsappEnabled,
    SettingsKeys.whatsappFrom,
    SettingsKeys.smsAccountSid,
  ]);
  const authToken = await getSecret(SettingsKeys.smsAuthToken);
  return {
    enabled:    map[SettingsKeys.whatsappEnabled] === 'true',
    accountSid: map[SettingsKeys.smsAccountSid] ?? '',
    authToken,
    from:       withWhatsappPrefix(map[SettingsKeys.whatsappFrom] ?? ''),
  };
}

/** Envoie un message WhatsApp via Twilio. */
export async function sendWhatsapp(to: string, body: string): Promise<void> {
  if (!to) throw new Error('Destinataire manquant');
  if (!body) throw new Error('Message vide');
  const cfg = await loadWhatsappConfig();
  if (!cfg.enabled) throw new Error('WhatsApp désactivé dans les paramètres');
  if (!cfg.accountSid || !cfg.authToken) throw new Error('Twilio : identifiants manquants (paramétrer dans SMS Twilio)');
  if (!cfg.from) throw new Error('WhatsApp : numéro émetteur (from) manquant');

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`;
  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
  const params = new URLSearchParams({
    To:   withWhatsappPrefix(to),
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
export async function sendTestWhatsapp(toNumber: string): Promise<{ ok: true }> {
  await sendWhatsapp(toNumber, 'Afrikimmo — test de configuration WhatsApp. Si vous recevez ce message, la configuration est opérationnelle.');
  logger.info(`WhatsApp de test envoyé à ${toNumber}`);
  return { ok: true };
}
