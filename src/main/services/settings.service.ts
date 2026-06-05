import { safeStorage } from 'electron';
import { getDb } from './db.service';
import logger from '../utils/logger';

/**
 * Service de paramétrage applicatif.
 *
 * Toutes les valeurs sont persistées en base via le modèle `AppSetting`
 * (clé → valeur). Les secrets (mots de passe SMTP/SMS, jetons API) sont
 * chiffrés via `safeStorage` Electron avant d'être insérés et déchiffrés
 * uniquement côté main process. Les champs marqués comme secrets ne sont
 * jamais renvoyés en clair au renderer.
 */

/** Convention : préfixe « enc: » devant la valeur indique un secret chiffré. */
const ENC_PREFIX = 'enc:';

/** Marqueur renvoyé au renderer pour indiquer qu'un secret est défini sans le révéler. */
export const SECRET_MASK = '••••••••';

/** Vrai si l'environnement supporte le chiffrement safeStorage. */
function canEncrypt(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/** Chiffre une chaîne avant stockage (no-op si safeStorage indisponible). */
function encrypt(plain: string): string {
  if (!plain) return '';
  if (!canEncrypt()) {
    logger.warn('safeStorage indisponible — secret stocké en clair');
    return plain;
  }
  return ENC_PREFIX + safeStorage.encryptString(plain).toString('base64');
}

/** Déchiffre une valeur (retourne la chaîne brute si non chiffrée). */
function decrypt(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  if (!canEncrypt()) {
    logger.warn('safeStorage indisponible — impossible de déchiffrer un secret');
    return '';
  }
  try {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
    return safeStorage.decryptString(buf);
  } catch (err: any) {
    logger.error('safeStorage decryptString error', err.message);
    return '';
  }
}

// ── API publique ─────────────────────────────────────────────────────────────

/** Lit une valeur brute de l'AppSetting (chaîne). */
export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const row = await db.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Lit un secret (déchiffré). */
export async function getSecret(key: string): Promise<string> {
  const raw = await getSetting(key);
  return raw ? decrypt(raw) : '';
}

/** Indique si un secret est défini (sans le révéler). */
export async function hasSecret(key: string): Promise<boolean> {
  const raw = await getSetting(key);
  return !!raw && raw.length > 0;
}

/** Lit plusieurs valeurs en une requête, retourne un dictionnaire { key → value | null }. */
export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const db = getDb();
  const rows = await db.appSetting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string | null> = {};
  for (const k of keys) map[k] = null;
  for (const r of rows) map[r.key] = r.value;
  return map;
}

/** Écrit ou crée une valeur AppSetting. */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Écrit un secret (chiffré). Une chaîne vide supprime la valeur. */
export async function setSecret(key: string, plain: string): Promise<void> {
  if (!plain) {
    const db = getDb();
    await db.appSetting.deleteMany({ where: { key } });
    return;
  }
  await setSetting(key, encrypt(plain));
}

/** Écrit plusieurs paires en une transaction. */
export async function setSettings(entries: Array<{ key: string; value: string }>): Promise<void> {
  if (entries.length === 0) return;
  const db = getDb();
  await db.$transaction(
    entries.map((e) =>
      db.appSetting.upsert({
        where: { key: e.key },
        create: { key: e.key, value: e.value },
        update: { value: e.value },
      }),
    ),
  );
}

// ── Clés et helpers de groupage ──────────────────────────────────────────────

export const SettingsKeys = {
  // Entreprise
  companyName:            'company.name',
  companySlogan:          'company.slogan',
  companyLogo:            'company.logoPath',         // chemin relatif dans STORAGE_PATH
  companyRegistre:        'company.registreCommerce',
  companyContribuable:    'company.compteContribuable',
  companyPhoneFixed:      'company.phone.fixed',
  companyPhoneMobile1:    'company.phone.mobile1',
  companyPhoneMobile2:    'company.phone.mobile2',
  companyWebsite:         'company.website',
  companyAddress:         'company.address',

  // Stockage
  storagePath:            'storage.path',
  storageMaxFileSizeMb:   'storage.maxFileSizeMb',

  // Email (SMTP)
  emailHost:              'email.smtp.host',
  emailPort:              'email.smtp.port',
  emailSecure:            'email.smtp.secure',         // 'true' | 'false'
  emailUser:              'email.smtp.user',
  emailPassword:          'email.smtp.password',       // secret
  emailFromAddress:       'email.from.address',
  emailFromName:          'email.from.name',
  emailSignature:         'email.signature',           // HTML — bloc de signature ajouté en pied via {{signature}}

  // SMS
  smsProvider:            'sms.provider',              // twilio | ovh | brevo
  smsAccountSid:          'sms.twilio.accountSid',
  smsAuthToken:           'sms.twilio.authToken',      // secret
  smsFrom:                'sms.from',
  smsApiLogin:            'sms.api.login',             // OVH/Brevo
  smsApiPassword:         'sms.api.password',          // secret OVH/Brevo

  // WhatsApp — deux providers supportés :
  //   - twilio  : réutilise sms.twilio.accountSid/authToken, sender préfixé `whatsapp:`
  //   - infobip : credentials dédiés (base URL d'API + API key + sender E.164)
  whatsappEnabled:           'whatsapp.enabled',                // 'true' | 'false'
  whatsappProvider:          'whatsapp.provider',               // 'twilio' | 'infobip'
  whatsappFrom:              'whatsapp.from',                   // sender Twilio (`whatsapp:+...`) ou numéro approuvé
  whatsappInfobipBaseUrl:    'whatsapp.infobip.baseUrl',        // ex. 'xxxxx.api.infobip.com' (sans https://)
  whatsappInfobipApiKey:     'whatsapp.infobip.apiKey',         // secret
  whatsappInfobipFrom:       'whatsapp.infobip.from',           // sender Infobip (numéro E.164 sans `whatsapp:`)

  // Slideshow dashboard (JSON array)
  dashboardSlideshow:     'dashboard.slideshow',
  // Rôles autorisés à voir le slideshow du tableau de bord (JSON array de UserRole)
  dashboardSlideshowRoles: 'dashboard.slideshow.allowedRoles',

  // Politique de relance (communication automatique)
  remindersEnabled:        'reminders.enabled',           // 'true' | 'false'
  remindersQuietStart:     'reminders.quietHours.start',  // 'HH:MM' (par défaut 08:00)
  remindersQuietEnd:       'reminders.quietHours.end',    // 'HH:MM' (par défaut 20:00)
  remindersQuietDays:      'reminders.quietDays',         // JSON array de 0..6 (0=dimanche)

  // Partage de localisation GPS — modèles de message pour Lotissement / Terrain / Bien.
  // Un seul modèle par canal couvre les 3 types d'entités : les variables qui ne
  // s'appliquent pas à l'entité courante sont substituées par chaîne vide.
  shareLocationEmailSubject:  'share.location.email.subject',
  shareLocationEmailBody:     'share.location.email.body',
  shareLocationWhatsappBody:  'share.location.whatsapp.body',
} as const;

/** Liste des clés correspondant à des secrets chiffrés. */
export const SECRET_KEYS = new Set<string>([
  SettingsKeys.emailPassword,
  SettingsKeys.smsAuthToken,
  SettingsKeys.smsApiPassword,
  SettingsKeys.whatsappInfobipApiKey,
]);
