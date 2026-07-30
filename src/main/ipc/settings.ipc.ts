import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getSession, checkRole } from '../services/auth.service';
import { getDb } from '../services/db.service';
import logger from '../utils/logger';
import {
  getSetting, getSettings, setSetting, setSettings, setSecret, hasSecret,
  SettingsKeys, SECRET_MASK,
} from '../services/settings.service';
import {
  storageRoot, setStorageRootOverride, writeLogoFile, writeSlideshowFile,
  resolveStoragePath, removeStorageFile,
} from '../services/storage.service';
import os from 'os';
import { sendTestEmail } from '../services/email.service';
import { sendTestSms } from '../services/sms.service';
import { sendTestWhatsapp } from '../services/whatsapp.service';

/** Adresses IPv4 locales (hors loopback) — pour suggérer l'URL du QR. */
function getLocalIps(): string[] {
  const ips: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

/** Paramètres applicatifs : réservés aux administrateurs. */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// ── Schémas Zod ──────────────────────────────────────────────────────────────

const companySchema = z.object({
  name:               z.string().optional(),
  denomination:       z.string().optional(),
  legalRepEmployeeId: z.string().optional(),
  slogan:             z.string().optional(),
  registreCommerce:   z.string().optional(),
  compteContribuable: z.string().optional(),
  phoneFixed:         z.string().optional(),
  phoneMobile1:       z.string().optional(),
  phoneMobile2:       z.string().optional(),
  website:            z.string().optional(),
  address:            z.string().optional(),
});

const storageSchema = z.object({
  path:           z.string().optional(),
  maxFileSizeMb:  z.coerce.number().int().positive().optional(),
});

const payrollAccountSchema = z.object({
  // null / absent = aucun compte par défaut
  accountId: z.number().int().positive().nullable().optional(),
});

const emailSchema = z.object({
  host:        z.string().optional(),
  port:        z.coerce.number().int().min(1).max(65535).optional(),
  secure:      z.boolean().optional(),
  user:        z.string().optional(),
  password:    z.string().optional(),
  fromAddress: z.string().optional(),
  fromName:    z.string().optional(),
  signature:   z.string().optional(),  // HTML — inséré via la variable {{signature}}
});

const smsSchema = z.object({
  provider:    z.enum(['twilio', 'ovh', 'brevo', 'orange', 'mtn', '']).optional(),
  accountSid:  z.string().optional(),
  authToken:   z.string().optional(),
  from:        z.string().optional(),
  apiLogin:    z.string().optional(),
  apiPassword: z.string().optional(),
  // WhatsApp — provider dédié (twilio ou infobip), avec credentials côte à côte.
  whatsappEnabled:        z.boolean().optional(),
  whatsappProvider:       z.enum(['twilio', 'infobip']).optional(),
  whatsappFrom:           z.string().optional(),
  whatsappInfobipBaseUrl: z.string().optional(),
  whatsappInfobipApiKey:  z.string().optional(),
  whatsappInfobipFrom:    z.string().optional(),
});

const slideshowItemSchema = z.object({
  type:       z.enum(['image', 'video']),
  src:        z.string().min(1),
  caption:    z.string().optional(),
  durationMs: z.number().int().positive().optional(),
});

const slideshowSchema = z.array(slideshowItemSchema);

const USER_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'ASSISTANTE_DIRECTION',
  'AGENT',
  'AGENT_TECHNIQUE',
  'READONLY',
] as const;

const slideshowVisibilitySchema = z.object({
  allowedRoles: z.array(z.enum(USER_ROLES)),
});

// Partage de localisation : un seul modèle global par canal, utilisé pour
// Lotissement / Terrain / Bien. Les variables non pertinentes pour l'entité
// courante sont substituées par une chaîne vide.
const shareLocationSchema = z.object({
  emailSubject:  z.string().optional(),
  emailBody:     z.string().optional(),
  whatsappBody:  z.string().optional(),
});

const SHARE_LOCATION_DEFAULTS = {
  emailSubject: 'Localisation — {{entityTitle}}',
  emailBody: [
    'Bonjour {{recipientName}},',
    '',
    'Vous trouverez ci-dessous la localisation de {{entityTitle}} ({{reference}}) :',
    '',
    'Adresse : {{address}}',
    'Ville : {{ville}}',
    'Commune : {{commune}}',
    'Quartier : {{quartier}}',
    '',
    'Coordonnées GPS : {{latitude}}, {{longitude}}',
    'Carte Google Maps : {{googleMapsUrl}}',
    'Vue Google Earth : {{googleEarthUrl}}',
    '',
    'Cordialement,',
    '{{companyName}}',
    '{{signature}}',
  ].join('\n'),
  whatsappBody: [
    'Bonjour {{recipientName}}, voici la localisation de *{{entityTitle}}* ({{reference}}) :',
    '',
    'Adresse : {{address}}',
    'GPS : {{latitude}}, {{longitude}}',
    'Carte : {{googleMapsUrl}}',
    '',
    '— {{companyName}}',
  ].join('\n'),
};

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
      // Lecture ouverte à tout utilisateur authentifié : les coordonnées de
      // l'entreprise (raison sociale, adresse, téléphones, RCCM…) sont des
      // informations publiques imprimées sur les documents clients (devis,
      // factures, attestations). La restriction admin ne s'applique qu'à
      // l'écriture (`settings:updateCompany`, logo). Sans cela, l'en-tête
      // entreprise ne s'affichait que pour les comptes SUPER_ADMIN / ADMIN.
      const map = await getSettings([
        SettingsKeys.companyName,
        SettingsKeys.companyDenomination,
        SettingsKeys.companyLegalRepEmployeeId,
        SettingsKeys.companySlogan,
        SettingsKeys.companyLogo,
        SettingsKeys.companyRegistre,
        SettingsKeys.companyContribuable,
        SettingsKeys.companyPhoneFixed,
        SettingsKeys.companyPhoneMobile1,
        SettingsKeys.companyPhoneMobile2,
        SettingsKeys.companyWebsite,
        SettingsKeys.companyAddress,
      ]);
      return {
        success: true,
        data: {
          name:               map[SettingsKeys.companyName] ?? '',
          denomination:       map[SettingsKeys.companyDenomination] ?? '',
          legalRepEmployeeId: map[SettingsKeys.companyLegalRepEmployeeId] ?? '',
          slogan:             map[SettingsKeys.companySlogan] ?? '',
          logoPath:           map[SettingsKeys.companyLogo] ?? '',
          registreCommerce:   map[SettingsKeys.companyRegistre] ?? '',
          compteContribuable: map[SettingsKeys.companyContribuable] ?? '',
          phoneFixed:         map[SettingsKeys.companyPhoneFixed] ?? '',
          phoneMobile1:       map[SettingsKeys.companyPhoneMobile1] ?? '',
          phoneMobile2:       map[SettingsKeys.companyPhoneMobile2] ?? '',
          website:            map[SettingsKeys.companyWebsite] ?? '',
          address:            map[SettingsKeys.companyAddress] ?? '',
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
      if (parsed.data.denomination !== undefined)       entries.push({ key: SettingsKeys.companyDenomination, value: parsed.data.denomination });
      if (parsed.data.legalRepEmployeeId !== undefined) entries.push({ key: SettingsKeys.companyLegalRepEmployeeId, value: parsed.data.legalRepEmployeeId });
      if (parsed.data.slogan !== undefined)             entries.push({ key: SettingsKeys.companySlogan, value: parsed.data.slogan });
      if (parsed.data.registreCommerce !== undefined)   entries.push({ key: SettingsKeys.companyRegistre, value: parsed.data.registreCommerce });
      if (parsed.data.compteContribuable !== undefined) entries.push({ key: SettingsKeys.companyContribuable, value: parsed.data.compteContribuable });
      if (parsed.data.phoneFixed !== undefined)         entries.push({ key: SettingsKeys.companyPhoneFixed, value: parsed.data.phoneFixed });
      if (parsed.data.phoneMobile1 !== undefined)       entries.push({ key: SettingsKeys.companyPhoneMobile1, value: parsed.data.phoneMobile1 });
      if (parsed.data.phoneMobile2 !== undefined)       entries.push({ key: SettingsKeys.companyPhoneMobile2, value: parsed.data.phoneMobile2 });
      if (parsed.data.website !== undefined)            entries.push({ key: SettingsKeys.companyWebsite, value: parsed.data.website });
      if (parsed.data.address !== undefined)            entries.push({ key: SettingsKeys.companyAddress, value: parsed.data.address });
      await setSettings(entries);
      logger.info('Paramètres entreprise mis à jour');
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateCompany', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Règlement intérieur (document GED ciblé par l'admin) ─────────────────────
  ipcMain.handle('settings:getReglementInterieur', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const raw = await getSetting(SettingsKeys.hrReglementInterieurDocId);
      const id = raw ? Number(raw) : null;
      let document: any = null;
      if (id) {
        document = await getDb().document.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, name: true, type: true, numeroArchive: true },
        });
      }
      return { success: true, data: { documentId: document ? id : null, document } };
    } catch (err: any) {
      logger.error('settings:getReglementInterieur', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:setReglementInterieur', async (_event, { token, documentId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const value = documentId != null && documentId !== '' ? String(Number(documentId)) : '';
      await setSettings([{ key: SettingsKeys.hrReglementInterieurDocId, value }]);
      logger.info(`Règlement intérieur : document ${value || '(aucun)'}`);
      return { success: true };
    } catch (err: any) {
      logger.error('settings:setReglementInterieur', err.message);
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

  /**
   * Logo de la page de connexion — lu DIRECTEMENT depuis le répertoire
   * `<storage>/logo/` (aucun accès base de données), pour un affichage immédiat
   * au démarrage à froid : la page de connexion n'attend plus une requête DB.
   * Accessible sans session.
   */
  ipcMain.handle('settings:getLoginLogoData', async () => {
    try {
      const dir = path.join(storageRoot(), 'logo');
      if (!fs.existsSync(dir)) return { success: true, data: null };
      const images = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|svg|webp|gif)$/i.test(f));
      if (images.length === 0) return { success: true, data: null };
      // Privilégie « company-logo.* » s'il existe, sinon la première image trouvée.
      const file = images.find((f) => /^company-logo\./i.test(f)) ?? images[0];
      const buf = fs.readFileSync(path.join(dir, file));
      const ext = path.extname(file).toLowerCase().replace('.', '') || 'png';
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

  // ── Paie : compte par défaut à débiter pour les salaires ─────────────────────
  ipcMain.handle('settings:getPayrollAccount', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const raw = await getSetting(SettingsKeys.payrollDefaultAccountId);
      const accountId = raw ? Number(raw) : null;
      // Liste des comptes communs actifs (débitables pour un salaire) pour le sélecteur
      const db = getDb();
      const accounts = await db.bankAccount.findMany({
        where: { deletedAt: null, isActive: true, linkedUserId: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, type: true },
      });
      // Le compte enregistré n'est plus valide (supprimé / désactivé / privé) → null
      const valid = accountId != null && accounts.some((a) => a.id === accountId) ? accountId : null;
      return { success: true, data: { accountId: valid, accounts } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updatePayrollAccount', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = payrollAccountSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const id = parsed.data.accountId ?? null;
      if (id != null) {
        const db = getDb();
        const account = await db.bankAccount.findFirst({ where: { id, deletedAt: null } });
        if (!account) return { success: false, error: 'Compte introuvable' };
        if (account.linkedUserId != null) {
          return { success: false, error: 'Le compte de paie doit être un compte commun (non rattaché à un utilisateur).' };
        }
        if (!account.isActive) return { success: false, error: 'Ce compte est inactif.' };
      }
      await setSettings([{ key: SettingsKeys.payrollDefaultAccountId, value: id != null ? String(id) : '' }]);
      logger.info(`Compte de paie par défaut : ${id ?? '(aucun)'}`);
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updatePayrollAccount', err.message);
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
        SettingsKeys.emailSignature,
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
          signature:   map[SettingsKeys.emailSignature] ?? '',
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
      if (d.signature !== undefined)   entries.push({ key: SettingsKeys.emailSignature, value: d.signature });
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
        SettingsKeys.whatsappEnabled, SettingsKeys.whatsappProvider, SettingsKeys.whatsappFrom,
        SettingsKeys.whatsappInfobipBaseUrl, SettingsKeys.whatsappInfobipFrom,
      ]);
      const [authTokenSet, apiPasswordSet, whatsappInfobipApiKeySet] = await Promise.all([
        hasSecret(SettingsKeys.smsAuthToken),
        hasSecret(SettingsKeys.smsApiPassword),
        hasSecret(SettingsKeys.whatsappInfobipApiKey),
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
          whatsappEnabled:  map[SettingsKeys.whatsappEnabled] === 'true',
          // Défaut historique = twilio (compatibilité avec configs existantes).
          whatsappProvider: (map[SettingsKeys.whatsappProvider] as 'twilio' | 'infobip' | null) ?? 'twilio',
          whatsappFrom:     map[SettingsKeys.whatsappFrom] ?? '',
          whatsappInfobipBaseUrl: map[SettingsKeys.whatsappInfobipBaseUrl] ?? '',
          whatsappInfobipFrom:    map[SettingsKeys.whatsappInfobipFrom] ?? '',
          whatsappInfobipApiKey:  whatsappInfobipApiKeySet ? SECRET_MASK : '',
          whatsappInfobipApiKeySet,
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
      if (d.whatsappEnabled !== undefined)        entries.push({ key: SettingsKeys.whatsappEnabled,        value: d.whatsappEnabled ? 'true' : 'false' });
      if (d.whatsappProvider !== undefined)       entries.push({ key: SettingsKeys.whatsappProvider,       value: d.whatsappProvider });
      if (d.whatsappFrom !== undefined)           entries.push({ key: SettingsKeys.whatsappFrom,           value: d.whatsappFrom });
      if (d.whatsappInfobipBaseUrl !== undefined) entries.push({ key: SettingsKeys.whatsappInfobipBaseUrl, value: d.whatsappInfobipBaseUrl });
      if (d.whatsappInfobipFrom !== undefined)    entries.push({ key: SettingsKeys.whatsappInfobipFrom,    value: d.whatsappInfobipFrom });
      await setSettings(entries);
      if (d.authToken !== undefined && d.authToken !== SECRET_MASK) {
        await setSecret(SettingsKeys.smsAuthToken, d.authToken);
      }
      if (d.apiPassword !== undefined && d.apiPassword !== SECRET_MASK) {
        await setSecret(SettingsKeys.smsApiPassword, d.apiPassword);
      }
      if (d.whatsappInfobipApiKey !== undefined && d.whatsappInfobipApiKey !== SECRET_MASK) {
        await setSecret(SettingsKeys.whatsappInfobipApiKey, d.whatsappInfobipApiKey);
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

  ipcMain.handle('settings:testWhatsapp', async (_event, { token, to }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      if (!to || typeof to !== 'string') return { success: false, error: 'Numéro destinataire manquant' };
      const r = await sendTestWhatsapp(to);
      return { success: true, data: r };
    } catch (err: any) {
      logger.error('settings:testWhatsapp', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Conditions particulières (conventions héritées) ─────────────────────────
  // Lecture accessible à toute session valide : le formulaire de convention en a
  // besoin pour alimenter le sélecteur, quel que soit le rôle de l'utilisateur.
  ipcMain.handle('settings:getConditionsParticulieres', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const raw = await getSetting(SettingsKeys.conventionConditionsParticulieres);
      let items: Array<{ title: string; text: string }> = [];
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (Array.isArray(p)) {
            // Rétrocompatibilité : anciennes entrées stockées comme simples chaînes.
            items = p
              .map((x: any) => (typeof x === 'string'
                ? { title: '', text: x }
                : { title: String(x?.title ?? ''), text: String(x?.text ?? '') }))
              .filter((x) => x.text.length > 0);
          }
        } catch { items = []; }
      }
      return { success: true, data: items };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updateConditionsParticulieres', async (_event, { token, items }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // Édition ouverte aux managers et comptables (ACCOUNTANT hérite de MANAGER).
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']);
      const parsed = z.array(z.object({ title: z.string(), text: z.string() })).safeParse(items);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      // Nettoyage : on retire les entrées sans texte et on déduplique par texte.
      const seen = new Set<string>();
      const cleaned: Array<{ title: string; text: string }> = [];
      for (const it of parsed.data.map((it) => ({ title: it.title.trim(), text: it.text.trim() }))) {
        if (!it.text || seen.has(it.text)) continue;
        seen.add(it.text);
        cleaned.push(it);
      }
      await setSettings([{ key: SettingsKeys.conventionConditionsParticulieres, value: JSON.stringify(cleaned) }]);
      logger.info(`Informations particulières mises à jour (${cleaned.length} éléments)`);
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateConditionsParticulieres', err.message);
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

  /**
   * Lit la liste des rôles autorisés à voir le slideshow sur le tableau de bord.
   * Tableau vide = personne n'y a accès.
   */
  ipcMain.handle('settings:getSlideshowVisibility', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const raw = await getSetting(SettingsKeys.dashboardSlideshowRoles);
      let allowedRoles: string[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) allowedRoles = parsed.filter((r) => typeof r === 'string');
        } catch { allowedRoles = []; }
      }
      return { success: true, data: { allowedRoles } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  /** Met à jour la liste des rôles autorisés à voir le slideshow. */
  ipcMain.handle('settings:updateSlideshowVisibility', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = slideshowVisibilitySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const unique = Array.from(new Set(parsed.data.allowedRoles));
      await setSettings([{ key: SettingsKeys.dashboardSlideshowRoles, value: JSON.stringify(unique) }]);
      logger.info(`Visibilité du slideshow mise à jour (${unique.length} rôle(s) autorisé(s))`);
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateSlideshowVisibility', err.message);
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

  // ── Partage de localisation GPS ─────────────────────────────────────────────

  /** Lit les modèles de message du partage de localisation (sujet/corps email + corps WhatsApp). */
  ipcMain.handle('settings:getShareLocation', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const map = await getSettings([
        SettingsKeys.shareLocationEmailSubject,
        SettingsKeys.shareLocationEmailBody,
        SettingsKeys.shareLocationWhatsappBody,
      ]);
      return {
        success: true,
        data: {
          emailSubject: map[SettingsKeys.shareLocationEmailSubject] ?? SHARE_LOCATION_DEFAULTS.emailSubject,
          emailBody:    map[SettingsKeys.shareLocationEmailBody]    ?? SHARE_LOCATION_DEFAULTS.emailBody,
          whatsappBody: map[SettingsKeys.shareLocationWhatsappBody] ?? SHARE_LOCATION_DEFAULTS.whatsappBody,
          defaults:     SHARE_LOCATION_DEFAULTS,
        },
      };
    } catch (err: any) {
      logger.error('settings:getShareLocation', err.message);
      return { success: false, error: err.message };
    }
  });

  /** Met à jour les modèles de message de partage de localisation. */
  ipcMain.handle('settings:updateShareLocation', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = shareLocationSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const entries: Array<{ key: string; value: string }> = [];
      if (parsed.data.emailSubject !== undefined)  entries.push({ key: SettingsKeys.shareLocationEmailSubject, value: parsed.data.emailSubject });
      if (parsed.data.emailBody !== undefined)     entries.push({ key: SettingsKeys.shareLocationEmailBody,    value: parsed.data.emailBody });
      if (parsed.data.whatsappBody !== undefined)  entries.push({ key: SettingsKeys.shareLocationWhatsappBody, value: parsed.data.whatsappBody });
      await setSettings(entries);
      logger.info('Modèles de partage de localisation mis à jour');
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateShareLocation', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Pointage par QR Code ────────────────────────────────────────────────────

  /** Lit la configuration du pointage par QR (URL de l'app web + seuils horaires). */
  ipcMain.handle('settings:getAttendanceQr', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const map = await getSettings([
        SettingsKeys.attendanceQrEnabled, SettingsKeys.attendanceQrBaseUrl,
        SettingsKeys.attendanceQrAllowedRoles, SettingsKeys.attendanceQrModel,
        SettingsKeys.attendanceExpectedArrival, SettingsKeys.attendanceExpectedDeparture,
      ]);
      let allowedRoles: string[] = [];
      const rawRoles = map[SettingsKeys.attendanceQrAllowedRoles];
      if (rawRoles) {
        try { const p = JSON.parse(rawRoles); if (Array.isArray(p)) allowedRoles = p.filter((r) => typeof r === 'string'); }
        catch { allowedRoles = []; }
      }
      const model = ['1', '2', '3'].includes(map[SettingsKeys.attendanceQrModel] ?? '') ? map[SettingsKeys.attendanceQrModel]! : '1';
      return {
        success: true,
        data: {
          enabled: map[SettingsKeys.attendanceQrEnabled] === 'true',
          baseUrl: map[SettingsKeys.attendanceQrBaseUrl] ?? '',
          allowedRoles,
          model,
          expectedArrival: map[SettingsKeys.attendanceExpectedArrival] || '08:00',
          expectedDeparture: map[SettingsKeys.attendanceExpectedDeparture] || '17:00',
          localIps: getLocalIps(),
        },
      };
    } catch (err: any) {
      logger.error('settings:getAttendanceQr', err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * Met à jour la config du pointage QR. Le pointage est servi par l'app web
   * autonome (dossier `web/` déposé sur le serveur web local) ; l'application ne
   * stocke que l'URL du QR, les rôles autorisés et les seuils horaires (ces
   * derniers lus par l'app web depuis AppSetting).
   */
  ipcMain.handle('settings:updateAttendanceQr', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const hhmm = z.string().regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, 'Format HH:MM attendu');
      const schema = z.object({
        enabled: z.boolean(),
        baseUrl: z.string().trim().max(300).optional().default(''),
        allowedRoles: z.array(z.string()).default([]),
        model: z.enum(['1', '2', '3']).default('1'),
        expectedArrival: hhmm,
        expectedDeparture: hhmm,
      });
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const d = parsed.data;
      await setSettings([
        { key: SettingsKeys.attendanceQrEnabled, value: d.enabled ? 'true' : 'false' },
        { key: SettingsKeys.attendanceQrBaseUrl, value: d.baseUrl },
        { key: SettingsKeys.attendanceQrAllowedRoles, value: JSON.stringify(Array.from(new Set(d.allowedRoles))) },
        { key: SettingsKeys.attendanceQrModel, value: d.model },
        { key: SettingsKeys.attendanceExpectedArrival, value: d.expectedArrival },
        { key: SettingsKeys.attendanceExpectedDeparture, value: d.expectedDeparture },
      ]);
      logger.info(`Pointage QR mis à jour (activé=${d.enabled})`);
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateAttendanceQr', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Modèles de messages — utilisateurs désignés (accès manuel) ──────────────

  /**
   * Liste des ids d'utilisateurs désignés, en plus de SUPER_ADMIN/ADMIN, pour
   * consulter/créer/modifier les modèles de messages de type « manuel »
   * (jamais les modèles « auto ») dans l'interface « Modèles de messages ».
   * Réservé aux administrateurs (paramétrage).
   */
  ipcMain.handle('settings:getManualTemplateEditors', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const raw = await getSetting(SettingsKeys.commTemplateManualEditorIds);
      let userIds: number[] = [];
      if (raw) {
        try { const p = JSON.parse(raw); if (Array.isArray(p)) userIds = p.filter((n: any) => Number.isInteger(n)); }
        catch { userIds = []; }
      }
      return { success: true, data: { userIds } };
    } catch (err: any) {
      logger.error('settings:getManualTemplateEditors', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:updateManualTemplateEditors', async (_event, { token, userIds }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const ids = Array.isArray(userIds)
        ? Array.from(new Set(userIds.map((v: any) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0)))
        : [];
      const db = getDb();
      // Ne conserve que des utilisateurs existants et actifs.
      const validUsers = ids.length
        ? await db.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
        : [];
      const validIds = validUsers.map((u) => u.id);
      await setSetting(SettingsKeys.commTemplateManualEditorIds, JSON.stringify(validIds));
      logger.info(`Utilisateurs désignés (modèles manuels) mis à jour (${validIds.length} utilisateur(s))`);
      return { success: true, data: { userIds: validIds } };
    } catch (err: any) {
      logger.error('settings:updateManualTemplateEditors', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Retards & Départs précipités ────────────────────────────────────────────

  /** Limite de tolérance par défaut (minutes) si aucune valeur n'est encore paramétrée. */
  const DEFAULT_LATENESS_TOLERANCE_MINUTES = 15;
  // Lecture élargie à MANAGER : la page « Retards & Départs précipités » a
  // besoin de la limite de tolérance pour proposer l'action « Tolérer »
  // (réservée à SUPER_ADMIN/ADMIN/MANAGER), même si l'onglet Paramètres reste
  // masqué pour ce rôle. L'écriture (`updateLatenessSettings`) reste ADMIN_ROLES.
  const LATENESS_SETTINGS_READ_ROLES = [...ADMIN_ROLES, 'MANAGER'];

  /** Lit les paramètres de « Retards & Départs précipités » (inclusion management + limite de tolérance). */
  ipcMain.handle('settings:getLatenessSettings', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LATENESS_SETTINGS_READ_ROLES);
      const map = await getSettings([SettingsKeys.latenessIncludeManagementRoles, SettingsKeys.latenessToleranceMinutes]);
      const rawTolerance = Number(map[SettingsKeys.latenessToleranceMinutes]);
      return {
        success: true,
        data: {
          includeManagementRoles: map[SettingsKeys.latenessIncludeManagementRoles] === 'true',
          toleranceMinutes: Number.isFinite(rawTolerance) && rawTolerance >= 0 ? rawTolerance : DEFAULT_LATENESS_TOLERANCE_MINUTES,
        },
      };
    } catch (err: any) {
      logger.error('settings:getLatenessSettings', err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * Met à jour les paramètres de « Retards & Départs précipités » :
   *  - inclusion des employés liés à un compte SUPER_ADMIN/ADMIN/MANAGER
   *    (exclus par défaut, aussi bien du calcul que de l'affichage) ;
   *  - limite de tolérance (minutes) en deçà de laquelle une journée peut être
   *    marquée « Tolérée » par SUPER_ADMIN/ADMIN/MANAGER.
   */
  ipcMain.handle('settings:updateLatenessSettings', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const schema = z.object({ includeManagementRoles: z.boolean(), toleranceMinutes: z.number().int().min(0).max(1440) });
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      await setSettings([
        { key: SettingsKeys.latenessIncludeManagementRoles, value: parsed.data.includeManagementRoles ? 'true' : 'false' },
        { key: SettingsKeys.latenessToleranceMinutes, value: String(parsed.data.toleranceMinutes) },
      ]);
      logger.info(`Retards & Départs précipités — inclusion SUPER_ADMIN/ADMIN/MANAGER : ${parsed.data.includeManagementRoles}, tolérance : ${parsed.data.toleranceMinutes} min`);
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateLatenessSettings', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── QR Visiteurs (app web autonome) ─────────────────────────────────────────

  /** Lit la configuration du QR Visiteurs (URL de l'app web + rôles + modèle). */
  ipcMain.handle('settings:getVisitorQr', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const map = await getSettings([
        SettingsKeys.visitorQrEnabled, SettingsKeys.visitorQrBaseUrl,
        SettingsKeys.visitorQrAllowedRoles, SettingsKeys.visitorQrModel,
      ]);
      let allowedRoles: string[] = [];
      const rawRoles = map[SettingsKeys.visitorQrAllowedRoles];
      if (rawRoles) {
        try { const p = JSON.parse(rawRoles); if (Array.isArray(p)) allowedRoles = p.filter((r) => typeof r === 'string'); }
        catch { allowedRoles = []; }
      }
      const model = ['1', '2', '3'].includes(map[SettingsKeys.visitorQrModel] ?? '') ? map[SettingsKeys.visitorQrModel]! : '1';
      return {
        success: true,
        data: {
          enabled: map[SettingsKeys.visitorQrEnabled] === 'true',
          baseUrl: map[SettingsKeys.visitorQrBaseUrl] ?? '',
          allowedRoles,
          model,
          localIps: getLocalIps(),
        },
      };
    } catch (err: any) {
      logger.error('settings:getVisitorQr', err.message);
      return { success: false, error: err.message };
    }
  });

  /** Met à jour la config du QR Visiteurs (servi par l'app web `web-visiteurs/`). */
  ipcMain.handle('settings:updateVisitorQr', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const schema = z.object({
        enabled: z.boolean(),
        baseUrl: z.string().trim().max(300).optional().default(''),
        allowedRoles: z.array(z.string()).default([]),
        model: z.enum(['1', '2', '3']).default('1'),
      });
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const d = parsed.data;
      await setSettings([
        { key: SettingsKeys.visitorQrEnabled, value: d.enabled ? 'true' : 'false' },
        { key: SettingsKeys.visitorQrBaseUrl, value: d.baseUrl },
        { key: SettingsKeys.visitorQrAllowedRoles, value: JSON.stringify(Array.from(new Set(d.allowedRoles))) },
        { key: SettingsKeys.visitorQrModel, value: d.model },
      ]);
      logger.info(`QR Visiteurs mis à jour (activé=${d.enabled})`);
      return { success: true };
    } catch (err: any) {
      logger.error('settings:updateVisitorQr', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Types de pièces d'identité ──────────────────────────────────────────────

  /** Liste les types de pièces d'identité (lecture ouverte à tout utilisateur connecté). */
  ipcMain.handle('settings:listIdTypes', async (_event, { token, includeInactive = false }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const data = await db.idDocumentType.findMany({
        where: {
          deletedAt: null,
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
      });
      return { success: true, data };
    } catch (err: any) {
      logger.error('settings:listIdTypes', err.message);
      return { success: false, error: err.message };
    }
  });

  const idTypeCreateSchema = z.object({
    code:      z.string().min(1, 'Code requis').regex(/^[A-Z0-9_]+$/i, 'Code invalide (lettres, chiffres, underscore)'),
    label:     z.string().min(1, 'Libellé requis'),
    isDefault: z.boolean().optional(),
    isActive:  z.boolean().optional(),
  });

  /** Crée un nouveau type de pièce d'identité (ADMIN). */
  ipcMain.handle('settings:createIdType', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = idTypeCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const db = getDb();
      const data = parsed.data;
      // Un seul type par défaut : on retire le flag des autres si demandé.
      if (data.isDefault) {
        await db.idDocumentType.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      const created = await db.idDocumentType.create({ data: { ...data, code: data.code.toUpperCase() } });
      return { success: true, data: created };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  const idTypeUpdateSchema = z.object({
    code:      z.string().min(1).regex(/^[A-Z0-9_]+$/i).optional(),
    label:     z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
    isActive:  z.boolean().optional(),
  });

  /** Met à jour un type de pièce d'identité (ADMIN). */
  ipcMain.handle('settings:updateIdType', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = idTypeUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const db = getDb();
      const data = { ...parsed.data, ...(parsed.data.code ? { code: parsed.data.code.toUpperCase() } : {}) };
      if (data.isDefault) {
        await db.idDocumentType.updateMany({
          where: { isDefault: true, NOT: { id: Number(id) } },
          data: { isDefault: false },
        });
      }
      const updated = await db.idDocumentType.update({ where: { id: Number(id) }, data });
      return { success: true, data: updated };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  /** Archive (soft delete) un type de pièce d'identité (ADMIN). */
  ipcMain.handle('settings:deleteIdType', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const db = getDb();
      const target = await db.idDocumentType.findUnique({ where: { id: Number(id) } });
      if (!target) return { success: false, error: 'Type introuvable' };
      if (target.isDefault) return { success: false, error: 'Impossible de supprimer le type par défaut' };
      await db.idDocumentType.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Natures de titres de lotissement ────────────────────────────────────────

  /** Liste les natures de titres (lecture ouverte à tout utilisateur connecté). */
  ipcMain.handle('settings:listTitleTypes', async (_event, { token, includeInactive = false }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const data = await db.lotissementTitleType.findMany({
        where: {
          deletedAt: null,
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
      });
      return { success: true, data };
    } catch (err: any) {
      logger.error('settings:listTitleTypes', err.message);
      return { success: false, error: err.message };
    }
  });

  const titleTypeCreateSchema = z.object({
    code:            z.string().min(1, 'Code requis').regex(/^[A-Z0-9_]+$/i, 'Code invalide'),
    label:           z.string().min(1, 'Libellé requis'),
    documentsLivres: z.string().optional().nullable(),
    isDefault:       z.boolean().optional(),
    isActive:        z.boolean().optional(),
  });

  ipcMain.handle('settings:createTitleType', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = titleTypeCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const db = getDb();
      const data = parsed.data;
      if (data.isDefault) {
        await db.lotissementTitleType.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      const created = await db.lotissementTitleType.create({ data: { ...data, code: data.code.toUpperCase() } });
      return { success: true, data: created };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  const titleTypeUpdateSchema = z.object({
    code:            z.string().min(1).regex(/^[A-Z0-9_]+$/i).optional(),
    label:           z.string().min(1).optional(),
    documentsLivres: z.string().optional().nullable(),
    isDefault:       z.boolean().optional(),
    isActive:        z.boolean().optional(),
  });

  ipcMain.handle('settings:updateTitleType', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = titleTypeUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const db = getDb();
      const data = { ...parsed.data, ...(parsed.data.code ? { code: parsed.data.code.toUpperCase() } : {}) };
      if (data.isDefault) {
        await db.lotissementTitleType.updateMany({
          where: { isDefault: true, NOT: { id: Number(id) } },
          data: { isDefault: false },
        });
      }
      const updated = await db.lotissementTitleType.update({ where: { id: Number(id) }, data });
      return { success: true, data: updated };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:deleteTitleType', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const db = getDb();
      const target = await db.lotissementTitleType.findUnique({ where: { id: Number(id) } });
      if (!target) return { success: false, error: 'Type introuvable' };
      if (target.isDefault) return { success: false, error: 'Impossible de supprimer le type par défaut' };
      await db.lotissementTitleType.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date(), isActive: false },
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
