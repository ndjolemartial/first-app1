import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import {
  getSetting, getSettings, setSettings, setSecret, hasSecret,
  SettingsKeys, SECRET_MASK,
} from '../services/settings.service';
import {
  storageRoot, setStorageRootOverride, writeLogoFile, writeSlideshowFile,
  resolveStoragePath, removeStorageFile,
} from '../services/storage.service';
import { sendTestEmail } from '../services/email.service';
import { sendTestSms } from '../services/sms.service';

/** Paramètres applicatifs : réservés aux administrateurs. */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// ── Schémas Zod ──────────────────────────────────────────────────────────────

const companySchema = z.object({
  name:               z.string().optional(),
  slogan:             z.string().optional(),
  registreCommerce:   z.string().optional(),
  compteContribuable: z.string().optional(),
});

const storageSchema = z.object({
  path:           z.string().optional(),
  maxFileSizeMb:  z.coerce.number().int().positive().optional(),
});

const emailSchema = z.object({
  host:        z.string().optional(),
  port:        z.coerce.number().int().min(1).max(65535).optional(),
  secure:      z.boolean().optional(),
  user:        z.string().optional(),
  password:    z.string().optional(),
  fromAddress: z.string().optional(),
  fromName:    z.string().optional(),
});

const smsSchema = z.object({
  provider:    z.enum(['twilio', 'ovh', 'brevo', '']).optional(),
  accountSid:  z.string().optional(),
  authToken:   z.string().optional(),
  from:        z.string().optional(),
  apiLogin:    z.string().optional(),
  apiPassword: z.string().optional(),
});

const slideshowItemSchema = z.object({
  type:       z.enum(['image', 'video']),
  src:        z.string().min(1),
  caption:    z.string().optional(),
  durationMs: z.number().int().positive().optional(),
});

const slideshowSchema = z.array(slideshowItemSchema);

const fileUploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
  fileData: z.string().min(1), // base64
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Décode un payload base64 et vérifie la taille. Retourne le buffer. */
function decodeBase64(payload: z.infer<typeof fileUploadSchema>, maxBytes: number): Buffer {
  if (payload.fileSize > maxBytes) {
    throw new Error(`Fichier trop volumineux (max ${Math.round(maxBytes / 1024 / 1024)} Mo)`);
  }
  const buf = Buffer.from(payload.fileData, 'base64');
  if (buf.length === 0) throw new Error('Fichier vide ou base64 invalide');
  return buf;
}

/** Lecture initiale de `storage.path` au démarrage pour propager au storage.service. */
export async function initStorageOverride(): Promise<void> {
  try {
    const root = await getSetting(SettingsKeys.storagePath);
    if (root) setStorageRootOverride(root);
  } catch (err: any) {
    logger.warn('initStorageOverride', err.message);
  }
}

// ── Enregistrement des handlers ──────────────────────────────────────────────

export function registerSettingsIPC(): void {
  // ── Entreprise ─────────────────────────────────────────────────────────────
  ipcMain.handle('settings:getCompany', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const map = await getSettings([
        SettingsKeys.companyName,
        SettingsKeys.companySlogan,
        SettingsKeys.companyLogo,
        SettingsKeys.companyRegistre,
        SettingsKeys.companyContribuable,
      ]);
      return {
        success: true,
        data: {
          name:               map[SettingsKeys.companyName] ?? '',
          slogan:             map[SettingsKeys.companySlogan] ?? '',
          logoPath:           map[SettingsKeys.companyLogo] ?? '',
          registreCommerce:   map[SettingsKeys.companyRegistre] ?? '',
          compteContribuable: map[SettingsKeys.companyContribuable] ?? '',
        },
      };
    } catch (err: any) {
      logger.error('settings:getCompany', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updateCompany', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = companySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const entries: Array<{ key: string; value: string }> = [];
      if (parsed.data.name !== undefined)               entries.push({ key: SettingsKeys.companyName, value: parsed.data.name });
      if (parsed.data.slogan !== undefined)             entries.push({ key: SettingsKeys.companySlogan, value: parsed.data.slogan });
      if (parsed.data.registreCommerce !== undefined)   entries.push({ key: SettingsKeys.companyRegistre, value: parsed.data.registreCommerce });
      if (parsed.data.compteContribuable !== undefined) entries.push({ key: SettingsKeys.companyContribuable, value: parsed.data.compteContribuable });
      await setSettings(entries);
      logger.info('Paramètres entreprise mis à jour');
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateCompany', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Logo entreprise ────────────────────────────────────────────────────────
  ipcMain.handle('settings:uploadLogo', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = fileUploadSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      // Logo : max 5 Mo et format image attendu.
      const buf = decodeBase64(parsed.data, 5 * 1024 * 1024);
      const { relativePath } = writeLogoFile(buf, parsed.data.fileName);
      await setSettings([{ key: SettingsKeys.companyLogo, value: relativePath }]);
      logger.info(`Logo entreprise mis à jour : ${relativePath}`);
      return { success: true, data: { relativePath } };
    } catch (err: any) {
      logger.error('settings:uploadLogo', err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * Supprime le logo entreprise : retire l'entrée AppSetting et le fichier
   * physique. Idempotent — ne fait rien si aucun logo n'est configuré.
   */
  ipcMain.handle('settings:deleteLogo', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const rel = await getSetting(SettingsKeys.companyLogo);
      if (rel) removeStorageFile(rel);
      // Vide la clé AppSetting (chaîne vide = pas de logo).
      await setSettings([{ key: SettingsKeys.companyLogo, value: '' }]);
      logger.info('Logo entreprise supprimé');
      return { success: true };
    } catch (err: any) {
      logger.error('settings:deleteLogo', err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * Renvoie le fichier logo en base64 pour affichage côté renderer.
   *
   * Accessible sans authentification : le logo apparaît également sur la page
   * de connexion (avant qu'un utilisateur n'ait ouvert de session).
   */
  ipcMain.handle('settings:getLogoData', async (_event, _payload: any) => {
    try {
      const rel = await getSetting(SettingsKeys.companyLogo);
      if (!rel) return { success: true, data: null };
      const abs = resolveStoragePath(rel);
      if (!fs.existsSync(abs)) return { success: true, data: null };
      const buf = fs.readFileSync(abs);
      const ext = path.extname(rel).toLowerCase().replace('.', '') || 'png';
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      return { success: true, data: { base64: buf.toString('base64'), mimeType: mime } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Stockage ───────────────────────────────────────────────────────────────
  ipcMain.handle('settings:getStorage', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const map = await getSettings([SettingsKeys.storagePath, SettingsKeys.storageMaxFileSizeMb]);
      return {
        success: true,
        data: {
          path:          map[SettingsKeys.storagePath] ?? '',
          maxFileSizeMb: map[SettingsKeys.storageMaxFileSizeMb] ? Number(map[SettingsKeys.storageMaxFileSizeMb]) : 10,
          resolvedPath:  storageRoot(),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updateStorage', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = storageSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };

      // Vérifie l'accessibilité du chemin avant de sauvegarder.
      if (parsed.data.path) {
        try {
          fs.mkdirSync(parsed.data.path, { recursive: true });
          // Test d'écriture : crée un fichier témoin puis le supprime.
          const probe = path.join(parsed.data.path, '.afrikimmo-write-test');
          fs.writeFileSync(probe, '');
          fs.unlinkSync(probe);
        } catch (e: any) {
          return { success: false, error: `Chemin de stockage inaccessible : ${e.message}` };
        }
      }

      const entries: Array<{ key: string; value: string }> = [];
      if (parsed.data.path !== undefined)          entries.push({ key: SettingsKeys.storagePath, value: parsed.data.path });
      if (parsed.data.maxFileSizeMb !== undefined) entries.push({ key: SettingsKeys.storageMaxFileSizeMb, value: String(parsed.data.maxFileSizeMb) });
      await setSettings(entries);

      // Propage la nouvelle racine au storage.service.
      if (parsed.data.path !== undefined) setStorageRootOverride(parsed.data.path || null);

      logger.info('Paramètres de stockage mis à jour');
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateStorage', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Email (SMTP) ───────────────────────────────────────────────────────────
  ipcMain.handle('settings:getEmail', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const map = await getSettings([
        SettingsKeys.emailHost, SettingsKeys.emailPort, SettingsKeys.emailSecure,
        SettingsKeys.emailUser, SettingsKeys.emailFromAddress, SettingsKeys.emailFromName,
      ]);
      const passwordSet = await hasSecret(SettingsKeys.emailPassword);
      return {
        success: true,
        data: {
          host:        map[SettingsKeys.emailHost] ?? '',
          port:        map[SettingsKeys.emailPort] ? Number(map[SettingsKeys.emailPort]) : 587,
          secure:      (map[SettingsKeys.emailSecure] ?? 'false') === 'true',
          user:        map[SettingsKeys.emailUser] ?? '',
          password:    passwordSet ? SECRET_MASK : '',
          passwordSet,
          fromAddress: map[SettingsKeys.emailFromAddress] ?? '',
          fromName:    map[SettingsKeys.emailFromName] ?? '',
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updateEmail', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = emailSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const entries: Array<{ key: string; value: string }> = [];
      const d = parsed.data;
      if (d.host !== undefined)        entries.push({ key: SettingsKeys.emailHost, value: d.host });
      if (d.port !== undefined)        entries.push({ key: SettingsKeys.emailPort, value: String(d.port) });
      if (d.secure !== undefined)      entries.push({ key: SettingsKeys.emailSecure, value: d.secure ? 'true' : 'false' });
      if (d.user !== undefined)        entries.push({ key: SettingsKeys.emailUser, value: d.user });
      if (d.fromAddress !== undefined) entries.push({ key: SettingsKeys.emailFromAddress, value: d.fromAddress });
      if (d.fromName !== undefined)    entries.push({ key: SettingsKeys.emailFromName, value: d.fromName });
      await setSettings(entries);
      // Mot de passe : ne change que si une nouvelle valeur explicite est fournie.
      if (d.password !== undefined && d.password !== SECRET_MASK) {
        await setSecret(SettingsKeys.emailPassword, d.password);
      }
      logger.info('Paramètres SMTP mis à jour');
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateEmail', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:testEmail', async (_event, { token, to }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = z.string().email().safeParse(to);
      if (!parsed.success) return { success: false, error: 'Adresse email invalide' };
      const r = await sendTestEmail(parsed.data);
      return { success: true, data: r };
    } catch (err: any) {
      logger.error('settings:testEmail', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── SMS ────────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:getSms', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const map = await getSettings([
        SettingsKeys.smsProvider, SettingsKeys.smsAccountSid, SettingsKeys.smsFrom,
        SettingsKeys.smsApiLogin,
      ]);
      const [authTokenSet, apiPasswordSet] = await Promise.all([
        hasSecret(SettingsKeys.smsAuthToken),
        hasSecret(SettingsKeys.smsApiPassword),
      ]);
      return {
        success: true,
        data: {
          provider:       map[SettingsKeys.smsProvider] ?? '',
          accountSid:     map[SettingsKeys.smsAccountSid] ?? '',
          authToken:      authTokenSet ? SECRET_MASK : '',
          authTokenSet,
          from:           map[SettingsKeys.smsFrom] ?? '',
          apiLogin:       map[SettingsKeys.smsApiLogin] ?? '',
          apiPassword:    apiPasswordSet ? SECRET_MASK : '',
          apiPasswordSet,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updateSms', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = smsSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const d = parsed.data;
      const entries: Array<{ key: string; value: string }> = [];
      if (d.provider !== undefined)   entries.push({ key: SettingsKeys.smsProvider, value: d.provider });
      if (d.accountSid !== undefined) entries.push({ key: SettingsKeys.smsAccountSid, value: d.accountSid });
      if (d.from !== undefined)       entries.push({ key: SettingsKeys.smsFrom, value: d.from });
      if (d.apiLogin !== undefined)   entries.push({ key: SettingsKeys.smsApiLogin, value: d.apiLogin });
      await setSettings(entries);
      if (d.authToken !== undefined && d.authToken !== SECRET_MASK) {
        await setSecret(SettingsKeys.smsAuthToken, d.authToken);
      }
      if (d.apiPassword !== undefined && d.apiPassword !== SECRET_MASK) {
        await setSecret(SettingsKeys.smsApiPassword, d.apiPassword);
      }
      logger.info('Paramètres SMS mis à jour');
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateSms', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:testSms', async (_event, { token, to }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      if (!to || typeof to !== 'string') return { success: false, error: 'Numéro destinataire manquant' };
      const r = await sendTestSms(to);
      return { success: true, data: r };
    } catch (err: any) {
      logger.error('settings:testSms', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Slideshow ──────────────────────────────────────────────────────────────
  ipcMain.handle('settings:getSlideshow', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const raw = await getSetting(SettingsKeys.dashboardSlideshow);
      let items: any[] = [];
      if (raw) {
        try { items = JSON.parse(raw); if (!Array.isArray(items)) items = []; }
        catch { items = []; }
      }
      return { success: true, data: items };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updateSlideshow', async (_event, { token, items }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = slideshowSchema.safeParse(items);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };

      // Nettoyage des médias orphelins (présents avant et absents maintenant).
      const previousRaw = await getSetting(SettingsKeys.dashboardSlideshow);
      const previous: any[] = previousRaw ? (() => { try { return JSON.parse(previousRaw); } catch { return []; } })() : [];
      const newSrcs = new Set(parsed.data.map((i) => i.src));
      for (const prev of previous) {
        if (prev?.src?.startsWith('slideshow/') && !newSrcs.has(prev.src)) {
          removeStorageFile(prev.src);
        }
      }

      await setSettings([{ key: SettingsKeys.dashboardSlideshow, value: JSON.stringify(parsed.data) }]);
      logger.info(`Slideshow mis à jour (${parsed.data.length} éléments)`);
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateSlideshow', err.message);
      return { success: false, error: err.message };
    }
  });

  /** Upload d'un média (image ou vidéo) du slideshow ; retourne le chemin relatif. */
  ipcMain.handle('settings:uploadSlideshowMedia', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = fileUploadSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      // Slideshow : max 50 Mo (vidéos courtes).
      const buf = decodeBase64(parsed.data, 50 * 1024 * 1024);
      const { relativePath, size } = writeSlideshowFile(buf, parsed.data.fileName);
      const type: 'image' | 'video' = parsed.data.fileType.startsWith('video/') ? 'video' : 'image';
      logger.info(`Slideshow média ajouté : ${relativePath} (${size} octets)`);
      return { success: true, data: { relativePath, type } };
    } catch (err: any) {
      logger.error('settings:uploadSlideshowMedia', err.message);
      return { success: false, error: err.message };
    }
  });

  /** Lit un média du slideshow en base64 pour affichage côté renderer. */
  ipcMain.handle('settings:getSlideshowMediaData', async (_event, { token, relativePath }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // Lecture libre (le dashboard est consultable par tous les rôles connectés).
      if (typeof relativePath !== 'string' || !relativePath.startsWith('slideshow/')) {
        return { success: false, error: 'Chemin invalide' };
      }
      const abs = resolveStoragePath(relativePath);
      if (!fs.existsSync(abs)) return { success: false, error: 'Fichier introuvable' };
      const buf = fs.readFileSync(abs);
      const ext = path.extname(relativePath).toLowerCase().replace('.', '');
      const isVideo = ['mp4', 'webm', 'mov', 'm4v'].includes(ext);
      const mime = isVideo
        ? `video/${ext === 'mov' ? 'quicktime' : ext}`
        : `image/${ext === 'jpg' ? 'jpeg' : ext || 'png'}`;
      return { success: true, data: { base64: buf.toString('base64'), mimeType: mime } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
