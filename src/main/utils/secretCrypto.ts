import crypto from 'crypto';
import logger from './logger';

/**
 * Primitive de chiffrement portable partagée par tous les secrets applicatifs
 * (mots de passe SMTP/SMS/IMAP, jetons API…), qu'ils soient stockés dans
 * `AppSetting` (cf. settings.service.ts) ou dans une table dédiée (ex.
 * `MailAccount.imapPasswordEnc`).
 *
 * Extrait de settings.service.ts pour être réutilisable par du code qui n'est
 * pas un simple couple clé/valeur `AppSetting` (ex. plusieurs comptes email,
 * un par utilisateur) — la clé et l'algorithme restent strictement identiques,
 * donc un secret chiffré par l'un est déchiffrable par l'autre.
 *
 * IMPORTANT — chiffrement PORTABLE (voir settings.service.ts pour le contexte
 * complet) : dérivé d'un secret applicatif commun (`APP_SECRET_KEY`, repli sur
 * une constante intégrée), déchiffrable depuis n'importe quel poste relié à la
 * même base — contrairement à `safeStorage` (DPAPI, lié à la machine).
 */

// Import paresseux : `electron` n'a pas besoin d'être présent quand ce module
// est chargé hors runtime Electron (script autonome, cf. run-reminders-once.ts
// / run-mailbox-poll-once.ts).
let safeStorage: typeof import('electron').safeStorage | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  safeStorage = require('electron').safeStorage;
} catch {
  safeStorage = undefined;
}

/** Ancien préfixe — secret chiffré via safeStorage (lié à la machine). Lecture seule. */
const ENC_PREFIX = 'enc:';
/** Préfixe courant — secret chiffré portable (AES-256-GCM, clé applicative commune). */
const ENC_PORTABLE_PREFIX = 'encp:';

let cachedKey: Buffer | null = null;
const PORTABLE_KEY_FALLBACK = 'afrikimmo-app::portable-secret-key::v1';
const APP_SECRET_PLACEHOLDERS = new Set([
  'change-me-in-production',
  'your-secret-key-here',
]);
function getPortableKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = (process.env.APP_SECRET_KEY ?? '').trim();
  const material = (raw && !APP_SECRET_PLACEHOLDERS.has(raw)) ? raw : PORTABLE_KEY_FALLBACK;
  cachedKey = crypto.scryptSync(material, 'afrikimmo.settings.secret.salt.v1', 32);
  return cachedKey;
}

/** Chiffre une chaîne (AES-256-GCM portable). Format : encp:base64(iv|tag|ciphertext). */
export function encryptSecret(plain: string): string {
  if (!plain) return '';
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getPortableKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ENC_PORTABLE_PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
  } catch (err: any) {
    logger.error('encryptSecret (portable) error', err.message);
    // Repli : ne jamais perdre la valeur silencieusement.
    return plain;
  }
}

function decryptPortable(stored: string): string {
  try {
    const data = Buffer.from(stored.slice(ENC_PORTABLE_PREFIX.length), 'base64');
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const enc = data.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getPortableKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch (err: any) {
    logger.error('decryptSecret (portable) error', err.message);
    return '';
  }
}

/** Déchiffre un ancien secret safeStorage (enc:) — ne fonctionne que sur le poste d'origine. */
function decryptLegacy(stored: string): string {
  try {
    // `safeStorage` est `undefined` hors runtime Electron — on ne suppose
    // jamais sa présence avant de l'appeler.
    if (typeof safeStorage?.isEncryptionAvailable !== 'function' || !safeStorage.isEncryptionAvailable()) {
      logger.warn('safeStorage indisponible — ancien secret enc: indéchiffrable sur ce poste');
      return '';
    }
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
    return safeStorage.decryptString(buf);
  } catch (err: any) {
    logger.error('safeStorage decryptString error', err.message);
    return '';
  }
}

/** Déchiffre une valeur (retourne la chaîne brute si non chiffrée). */
export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (stored.startsWith(ENC_PORTABLE_PREFIX)) return decryptPortable(stored);
  if (stored.startsWith(ENC_PREFIX)) return decryptLegacy(stored);
  return stored;
}

/** Vrai si la valeur stockée est un ancien secret safeStorage (enc:), candidat à la migration portable. */
export function isLegacySecret(stored: string): boolean {
  return stored.startsWith(ENC_PREFIX);
}
