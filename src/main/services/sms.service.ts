import { getSettings, getSecret, SettingsKeys } from './settings.service';
import logger from '../utils/logger';

/**
 * Service d'envoi de SMS — paramètres lus depuis les AppSetting.
 *
 * Trois fournisseurs supportés :
 *   - `twilio` : Account SID + Auth Token + numéro émetteur
 *   - `ovh`    : login + password + nom d'émetteur (`from`)
 *   - `brevo`  : login (API key) + nom d'émetteur (`from`)
 *
 * L'appel réseau utilise `fetch` natif Node (Node ≥ 18), ce qui évite d'ajouter
 * une dépendance lourde côté SDK fournisseur. La configuration peut changer à
 * chaud : on relit les settings à chaque envoi.
 */

export type SmsProvider = 'twilio' | 'ovh' | 'brevo';

export interface SmsConfig {
  provider:    SmsProvider | '';
  accountSid:  string;
  authToken:   string;
  from:        string;
  apiLogin:    string;
  apiPassword: string;
}

/** Lit la configuration SMS courante. */
export async function loadSmsConfig(): Promise<SmsConfig> {
  const map = await getSettings([
    SettingsKeys.smsProvider,
    SettingsKeys.smsAccountSid,
    SettingsKeys.smsFrom,
    SettingsKeys.smsApiLogin,
  ]);
  const [authToken, apiPassword] = await Promise.all([
    getSecret(SettingsKeys.smsAuthToken),
    getSecret(SettingsKeys.smsApiPassword),
  ]);
  return {
    provider:    (map[SettingsKeys.smsProvider] as SmsProvider | null) ?? '',
    accountSid:  map[SettingsKeys.smsAccountSid] ?? '',
    authToken,
    from:        map[SettingsKeys.smsFrom] ?? '',
    apiLogin:    map[SettingsKeys.smsApiLogin] ?? '',
    apiPassword,
  };
}

/** Envoie un SMS via Twilio (REST API). */
async function sendViaTwilio(cfg: SmsConfig, to: string, body: string): Promise<void> {
  if (!cfg.accountSid || !cfg.authToken) throw new Error('Twilio : identifiants manquants');
  if (!cfg.from) throw new Error('Twilio : numéro émetteur (from) manquant');
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
async function sendViaOvh(cfg: SmsConfig, to: string, body: string): Promise<void> {
  if (!cfg.apiLogin || !cfg.apiPassword) throw new Error('OVH : identifiants manquants');
  if (!cfg.from) throw new Error('OVH : nom émetteur (from) manquant');
  // Endpoint générique OVH SMS — l'URL exacte dépend du compte ; on utilise ici
  // l'API de simulation. À adapter selon la convention OVH du client.
  const url = `https://www.ovh.com/cgi-bin/sms/http2sms.cgi`;
  const params = new URLSearchParams({
    account: cfg.apiLogin,
    login:   cfg.apiLogin,
    password: cfg.apiPassword,
    from:    cfg.from,
    to,
    message: body,
    noStop:  '1',
    contentType: 'text/json',
  });
  const res = await fetch(`${url}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OVH HTTP ${res.status} : ${text}`);
  }
}

/** Envoie un SMS via Brevo (anciennement Sendinblue). */
async function sendViaBrevo(cfg: SmsConfig, to: string, body: string): Promise<void> {
  if (!cfg.apiLogin) throw new Error('Brevo : clé API manquante');
  if (!cfg.from) throw new Error('Brevo : nom émetteur (from) manquant');
  const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: {
      'api-key':     cfg.apiLogin,
      'Content-Type':'application/json',
      'Accept':      'application/json',
    },
    body: JSON.stringify({
      sender:    cfg.from,
      recipient: to,
      content:   body,
      type:      'transactional',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo HTTP ${res.status} : ${text}`);
  }
}

/** Envoie un SMS via le fournisseur configuré. */
export async function sendSms(to: string, body: string): Promise<void> {
  if (!to) throw new Error('Destinataire manquant');
  if (!body) throw new Error('Message vide');
  const cfg = await loadSmsConfig();
  if (!cfg.provider) throw new Error('SMS non configuré (fournisseur manquant)');
  switch (cfg.provider) {
    case 'twilio': return sendViaTwilio(cfg, to, body);
    case 'ovh':    return sendViaOvh(cfg, to, body);
    case 'brevo':  return sendViaBrevo(cfg, to, body);
    default: throw new Error(`Fournisseur SMS inconnu : ${cfg.provider}`);
  }
}

/** Envoie un SMS de test au numéro fourni. */
export async function sendTestSms(toNumber: string): Promise<{ ok: true }> {
  await sendSms(toNumber, 'Afrikimmo — test de configuration SMS. Si vous recevez ce message, la configuration est opérationnelle.');
  logger.info(`SMS de test envoyé à ${toNumber}`);
  return { ok: true };
}
