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

  // SMS
  smsProvider:            'sms.provider',              // twilio | ovh | brevo
  smsAccountSid:          'sms.twilio.accountSid',
  smsAuthToken:           'sms.twilio.authToken',      // secret
  smsFrom:                'sms.from',
  smsApiLogin:            'sms.api.login',             // OVH/Brevo
  smsApiPassword:         'sms.api.password',          // secret OVH/Brevo

  // Slideshow dashboard (JSON array)
  dashboardSlideshow:     'dashboard.slideshow',
  // Rôles autorisés à voir le slideshow du tableau de bord (JSON array de UserRole)
  dashboardSlideshowRoles: 'dashboard.slideshow.allowedRoles',
} as const;

/** Liste des clés correspondant à des secrets chiffrés. */
export const SECRET_KEYS = new Set<string>([
  SettingsKeys.emailPassword,
  SettingsKeys.smsAuthToken,
  SettingsKeys.smsApiPassword,
]);
