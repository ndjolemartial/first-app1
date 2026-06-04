import { getSettings, getSecret, SettingsKeys } from './settings.service';
import logger from '../utils/logger';

/**
 * Service d'envoi de SMS — paramètres lus depuis les AppSetting.
 *
 * Cinq fournisseurs supportés :
 *   - `twilio` : Account SID + Auth Token + numéro émetteur
 *   - `ovh`    : login + password + nom d'émetteur (`from`)
 *   - `brevo`  : login (API key) + nom d'émetteur (`from`)
 *   - `orange` : client_id + client_secret + numéro émetteur (API Orange CI,
 *                OAuth2 client_credentials, endpoint SMS Messaging v1)
 *   - `mtn`    : login + password + nom d'émetteur (API MTN CI SMS PRO,
 *                Basic Auth, POST JSON sur l'endpoint SMS PRO)
 *
 * L'appel réseau utilise `fetch` natif Node (Node ≥ 18), ce qui évite d'ajouter
 * une dépendance lourde côté SDK fournisseur. La configuration peut changer à
 * chaud : on relit les settings à chaque envoi.
 */

export type SmsProvider = 'twilio' | 'ovh' | 'brevo' | 'orange' | 'mtn';

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
  const params = new URLSearchParams({ To: toE164(to), From: toE164(cfg.from), Body: body });
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

// ── Orange CI — cache OAuth2 + envoi ─────────────────────────────────────────
// Le token Orange est obtenu par client_credentials et a une durée de vie de
// l'ordre de l'heure. On le garde en mémoire avec une marge de 60s pour éviter
// de re-payer une requête OAuth à chaque SMS. La clé inclut un préfixe du
// client_secret pour invalider le cache si les credentials changent.

interface OrangeTokenCache {
  token:     string;
  expiresAt: number;  // epoch ms
  cacheKey:  string;  // empreinte client_id + secret
}
let orangeTokenCache: OrangeTokenCache | null = null;

async function getOrangeAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const cacheKey = `${clientId}:${clientSecret.slice(0, 8)}`;
  const now = Date.now();
  if (orangeTokenCache && orangeTokenCache.cacheKey === cacheKey && orangeTokenCache.expiresAt - 60_000 > now) {
    return orangeTokenCache.token;
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://api.orange.com/oauth/v3/token', {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept:         'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Orange OAuth HTTP ${res.status} : ${text}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('Orange OAuth : access_token absent de la réponse');
  orangeTokenCache = {
    token:     json.access_token,
    expiresAt: now + Number(json.expires_in ?? 3600) * 1000,
    cacheKey,
  };
  return json.access_token;
}

/**
 * Normalise un numéro en E.164 strict.
 *
 * Règles, dans l'ordre :
 *   1. Conserve un numéro déjà en E.164 (`+225…`).
 *   2. Convertit le préfixe international `00` en `+` (`00225…` → `+225…`).
 *   3. Numéro local ivoirien à 10 chiffres commençant par 0
 *      (formats actuels 01/05/07-XXXXXXXX) → `+225` + numéro sans le 0 initial.
 *   4. Numéro déjà préfixé du code pays sans `+` (ex. `2250101020304`) → `+`.
 *   5. Sinon, ajoute `+` en tête (meilleur effort).
 *
 * L'application étant principalement déployée en Côte d'Ivoire (cf. `country`
 * par défaut `"CI"` sur les fiches clients), assumer +225 sur les numéros
 * locaux à 10 chiffres évite des rejets « préfixe pays inconnu » côté Orange.
 */
export function toE164(raw: string): string {
  // Conserve uniquement chiffres + `+` initial. Élimine espaces, tirets,
  // parenthèses et autres séparateurs qui font échouer les APIs strictes.
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  // Mobile CI local : 10 chiffres commençant par 0.
  if (/^0\d{9}$/.test(cleaned)) return `+225${cleaned.slice(1)}`;
  // Déjà préfixé du code pays sans le `+` (ex. 2250101020304).
  if (cleaned.startsWith('225') && cleaned.length === 13) return `+${cleaned}`;
  return `+${cleaned}`;
}

/** Envoie un SMS via l'API Orange CI (SMS Messaging v1). */
async function sendViaOrange(cfg: SmsConfig, to: string, body: string): Promise<void> {
  if (!cfg.apiLogin)    throw new Error('Orange : Client ID manquant');
  if (!cfg.apiPassword) throw new Error('Orange : Client Secret manquant');
  if (!cfg.from)        throw new Error('Orange : numéro émetteur (from) manquant');

  const senderTel = toE164(cfg.from);
  const senderPath = encodeURIComponent(`tel:${senderTel}`);
  const url = `https://api.orange.com/smsmessaging/v1/outbound/${senderPath}/requests`;
  const payload = {
    outboundSMSMessageRequest: {
      address:                `tel:${toE164(to)}`,
      senderAddress:          `tel:${senderTel}`,
      outboundSMSTextMessage: { message: body },
    },
  };

  const doPost = async (token: string) => fetch(url, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify(payload),
  });

  let token = await getOrangeAccessToken(cfg.apiLogin, cfg.apiPassword);
  let res = await doPost(token);
  // 401 → token invalidé côté Orange (ex. rotation). On purge le cache et on
  // retente une fois avec un token fraîchement émis.
  if (res.status === 401) {
    orangeTokenCache = null;
    token = await getOrangeAccessToken(cfg.apiLogin, cfg.apiPassword);
    res = await doPost(token);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Orange SMS HTTP ${res.status} : ${text}`);
  }
}

/**
 * Envoie un SMS via l'API MTN CI SMS PRO.
 *
 * Authentification : Basic Auth (login : mot de passe du compte SMS PRO).
 * Endpoint cible par défaut : `https://api.smspro.mtn.ci/api/v1/sms/send`.
 *
 * Si le contrat SMS PRO de votre compte expose une URL différente (variante
 * `/sms/send`, `/messages`, instance privée…), modifiez la constante
 * `MTN_SMSPRO_ENDPOINT` ci-dessous. Le format de payload retenu — `{ sender,
 * recipient, message }` — couvre la majorité des intégrations MTN ; ajustez
 * les noms de champs si votre fiche technique en diffère.
 */
const MTN_SMSPRO_ENDPOINT = 'https://api.smspro.mtn.ci/api/v1/sms/send';

async function sendViaMtn(cfg: SmsConfig, to: string, body: string): Promise<void> {
  if (!cfg.apiLogin)    throw new Error('MTN SMS PRO : identifiant manquant');
  if (!cfg.apiPassword) throw new Error('MTN SMS PRO : mot de passe manquant');
  if (!cfg.from)        throw new Error('MTN SMS PRO : nom émetteur (from) manquant');

  const auth = Buffer.from(`${cfg.apiLogin}:${cfg.apiPassword}`).toString('base64');
  const payload = {
    sender:    cfg.from,
    recipient: toE164(to),
    message:   body,
  };
  const res = await fetch(MTN_SMSPRO_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MTN SMS PRO HTTP ${res.status} : ${text}`);
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
    case 'orange': return sendViaOrange(cfg, to, body);
    case 'mtn':    return sendViaMtn(cfg, to, body);
    default: throw new Error(`Fournisseur SMS inconnu : ${cfg.provider}`);
  }
}

/** Envoie un SMS de test au numéro fourni. */
export async function sendTestSms(toNumber: string): Promise<{ ok: true }> {
  await sendSms(toNumber, 'Afrikimmo — test de configuration SMS. Si vous recevez ce message, la configuration est opérationnelle.');
  logger.info(`SMS de test envoyé à ${toNumber}`);
  return { ok: true };
}
