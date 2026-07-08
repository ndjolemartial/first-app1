import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { sendEmail } from '../services/email.service';
import { sendSms } from '../services/sms.service';
import { sendWhatsapp } from '../services/whatsapp.service';
import { renderMessage, loadCompanyVariables } from '../services/templating.service';
import { getSettings, SettingsKeys, getSetting, setSetting } from '../services/settings.service';
import logger from '../utils/logger';
import { z } from 'zod';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
// Clé AppSetting : URL de base du pixel de suivi d'ouverture des emails.
const COMM_TRACKING_KEY = 'communication.tracking.baseUrl';
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];

// Rôles qui voient l'intégralité de l'historique de communication.
// ASSISTANTE_DIRECTION est traité comme MANAGER (équivalence centralisée dans
// auth.service). Les autres rôles (AGENT, READONLY) sont restreints à leurs
// propres envois et aux messages adressés à un client qui leur est rattaché.
const FULL_HISTORY_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];

// Rôles qui peuvent cibler n'importe quel client. Les autres ne peuvent cibler
// que leurs clients référents (aligné sur `hasFullView` / clients:list). Note :
// ASSISTANTE_DIRECTION est volontairement exclue (restreinte à ses clients).
const CLIENT_FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

const templateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
  subject: z.string().optional(),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
  // Catégorie d'usage : AUTO (relances automatiques) ou MANUEL (envois manuels).
  usageType: z.enum(['AUTO', 'MANUEL']).default('MANUEL'),
  isActive: z.boolean().default(true),
});

// Rôles voyant tous les modèles (auto + manuel). Les autres ne voient que les
// modèles « manuel » dans l'envoi de message. Test de rôle exact (ASSISTANTE_DIRECTION exclue).
const TEMPLATE_FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

// Cibles entité optionnelles — passées par le formulaire d'envoi ciblé pour
// stamper Communication.{clientId, ownerId, conventionId}. Quand l'envoi se
// fait par cible, le `to` reste obligatoire (rempli depuis l'entité côté UI).
const targetFields = {
  clientId:     z.number().int().positive().optional(),
  ownerId:      z.number().int().positive().optional(),
  conventionId: z.number().int().positive().optional(),
};

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Envoi « en tant que » l'utilisateur connecté (mode Particulier) : l'adresse
  // d'envoi et le nom d'expéditeur deviennent ceux de l'utilisateur, et sa
  // signature personnelle est ajoutée au message.
  senderSelf: z.boolean().optional(),
  // Pièces jointes (mode Particulier) : chemins de fichiers locaux à joindre.
  attachments: z.array(z.object({
    path: z.string().min(1),
    name: z.string().min(1),
  })).optional(),
  // Destinataires en copie (CC) / copie cachée (BCC) — listes séparées par , ; ou espace.
  cc: z.string().optional(),
  bcc: z.string().optional(),
  ...targetFields,
});

/** Découpe une liste d'adresses (séparateurs , ; espaces) et valide le format. */
function parseEmailList(raw: string | undefined): { list: string[]; invalid: string[] } {
  const list = (raw ?? '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const invalid = list.filter((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
  return { list, invalid };
}

/** Taille totale maximale autorisée pour les pièces jointes d'un email (25 Mo). */
const MAX_ATTACHMENTS_BYTES = 25 * 1024 * 1024;

const sendSmsSchema = z.object({
  to: z.string().min(8),
  body: z.string().min(1),
  templateId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ...targetFields,
});

const sendWhatsappSchema = z.object({
  to: z.string().min(8),
  body: z.string().min(1),
  templateId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ...targetFields,
});

const resolveTargetSchema = z.object({
  entityType: z.enum(['CLIENT', 'OWNER', 'CONVENTION']),
  entityId:   z.number().int().positive(),
  channel:    z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
});

const CONVENTION_TYPE_LABELS: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Bail non meublé',
  RENTAL_FURNISHED:   'Bail meublé',
  SALE:               'Vente',
  MANAGEMENT:         'Mandat de gestion',
  COMMERCIAL_LEASE:   'Bail commercial',
};

const fmtDate = (d: Date | null | undefined): string =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '';
const fmtAmount = (a: unknown): string =>
  a === null || a === undefined ? '' : Number(a).toLocaleString('fr-FR');

/**
 * Variables communes à tout envoi : variables d'entreprise (paramètres),
 * agence, agent connecté et date du jour. Réutilisées pour la substitution
 * immédiate des modèles dans le formulaire d'envoi.
 */
async function buildCommonVariables(
  db: ReturnType<typeof getDb>,
  userId: number,
): Promise<Record<string, string>> {
  const company = await loadCompanyVariables();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  const agentName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
  return {
    ...company,
    agencyName: company.companyName ?? '',
    agentName,
    date: new Date().toLocaleDateString('fr-FR'),
  };
}

/** Retire les balises HTML pour produire une version texte brut (alternative email). */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Variables « destinataire » à partir d'un client / propriétaire. */
function recipientVariables(rec: any): Record<string, string> {
  const isCompany = rec.type === 'ENTREPRISE';
  const fullName = isCompany
    ? (rec.entreprise ?? rec.companyName ?? '')
    : `${rec.firstName ?? ''} ${rec.lastName ?? ''}`.trim();
  return {
    civilite:  rec.civilite ?? '',
    firstName: rec.firstName ?? '',
    lastName:  rec.lastName ?? '',
    fullName,
    email:     rec.email ?? '',
    phone:     rec.mobile ?? rec.phone ?? '',
  };
}

// Partage de localisation GPS depuis Lotissement / Terrain / Bien vers
// Client / Prospect / Apporteur d'affaires. Le template est lu côté serveur
// (paramètre AppSetting) — il n'est pas modifiable depuis le formulaire de
// partage : l'utilisateur doit passer par Paramètres → Partage de localisation
// pour éditer le modèle. Garantit que tous les envois suivent la version
// approuvée du modèle.
const shareLocationSchema = z.object({
  entityType:   z.enum(['LOTISSEMENT', 'TERRAIN', 'PROPERTY']),
  entityId:     z.number().int().positive(),
  recipientType: z.enum(['CLIENT', 'PROSPECT', 'REFERRER']),
  recipientId:  z.number().int().positive(),
  channel:      z.enum(['EMAIL', 'WHATSAPP']),
});

type ShareLocationContext = {
  to: string;
  finalSubject: string;
  finalBody: string;
  entityTitle: string;
  entityFK: { propertyId?: number };
  recipientFK: { clientId?: number };
};

/**
 * Charge l'entité + le destinataire, lit le template depuis Paramètres et
 * applique les substitutions de variables ({{latitude}}, {{googleMapsUrl}}…).
 * Retourne un message prêt à envoyer — sans rien envoyer ni persister.
 *
 * Centralise la logique partagée entre `communication:shareLocation` (envoi
 * réel) et `communication:previewShareLocation` (aperçu côté UI).
 */
async function buildShareLocationContext(
  payload: z.infer<typeof shareLocationSchema>,
): Promise<{ success: true; data: ShareLocationContext } | { success: false; error: string }> {
  const db = getDb();
  const d = payload;

  // 1. Entité source : fournit la référence, l'adresse et les coordonnées GPS.
  let entityVars: Record<string, string> = {};
  let entityTitle = '';
  let entityFK: { propertyId?: number } = {};
  if (d.entityType === 'LOTISSEMENT') {
    const lot = await db.lotissement.findUnique({
      where: { id: d.entityId },
      select: {
        id: true, reference: true, nom: true, commune: true, quartier: true, ville: true, pays: true,
        latitude: true, longitude: true, deletedAt: true,
      },
    });
    if (!lot || lot.deletedAt) return { success: false, error: 'Lotissement introuvable' };
    entityTitle = lot.nom;
    entityVars = {
      reference: lot.reference,
      entityTitle: lot.nom,
      entityType: 'Lotissement',
      nom:      lot.nom,
      commune:  lot.commune ?? '',
      quartier: lot.quartier ?? '',
      ville:    lot.ville,
      pays:     lot.pays ?? '',
      address:  [lot.quartier, lot.commune, lot.ville, lot.pays].filter(Boolean).join(', '),
      latitude:  lot.latitude != null ? String(lot.latitude) : '',
      longitude: lot.longitude != null ? String(lot.longitude) : '',
    };
  } else if (d.entityType === 'TERRAIN') {
    const t = await db.terrain.findUnique({
      where: { id: d.entityId },
      select: {
        id: true, reference: true, numeroIlot: true, numeroParcelle: true,
        latitude: true, longitude: true, deletedAt: true,
        lotissement: { select: { nom: true, commune: true, quartier: true, ville: true, pays: true, latitude: true, longitude: true } },
      },
    });
    if (!t || t.deletedAt) return { success: false, error: 'Terrain introuvable' };
    // Si le terrain n'a pas ses propres coords, on retombe sur celles du lotissement.
    const lat = t.latitude ?? t.lotissement?.latitude ?? null;
    const lng = t.longitude ?? t.lotissement?.longitude ?? null;
    const parcelle = [t.numeroIlot && `Îlot ${t.numeroIlot}`, t.numeroParcelle && `Lot ${t.numeroParcelle}`].filter(Boolean).join(' · ');
    entityTitle = [t.lotissement?.nom, parcelle].filter(Boolean).join(' — ') || t.reference;
    entityVars = {
      reference: t.reference,
      entityTitle,
      entityType: 'Terrain',
      nom:      t.lotissement?.nom ?? '',
      commune:  t.lotissement?.commune ?? '',
      quartier: t.lotissement?.quartier ?? '',
      ville:    t.lotissement?.ville ?? '',
      pays:     t.lotissement?.pays ?? '',
      address:  [parcelle, t.lotissement?.quartier, t.lotissement?.commune, t.lotissement?.ville, t.lotissement?.pays].filter(Boolean).join(', '),
      latitude:  lat != null ? String(lat) : '',
      longitude: lng != null ? String(lng) : '',
    };
  } else {
    const p = await db.property.findUnique({
      where: { id: d.entityId },
      select: {
        id: true, reference: true, type: true, address: true, addressLine2: true,
        city: true, postalCode: true, country: true, latitude: true, longitude: true, deletedAt: true,
      },
    });
    if (!p || p.deletedAt) return { success: false, error: 'Bien introuvable' };
    entityTitle = `${p.type} — ${p.address}`;
    entityFK = { propertyId: p.id };
    entityVars = {
      reference: p.reference,
      entityTitle,
      entityType: 'Bien',
      nom:      '',
      commune:  '',
      quartier: '',
      ville:    p.city,
      pays:     p.country ?? '',
      address:  [p.address, p.addressLine2, p.postalCode, p.city, p.country].filter(Boolean).join(', '),
      latitude:  p.latitude != null ? String(p.latitude) : '',
      longitude: p.longitude != null ? String(p.longitude) : '',
    };
  }

  if (!entityVars.latitude || !entityVars.longitude) {
    return { success: false, error: "Aucune coordonnée GPS renseignée sur l'entité — partage impossible." };
  }

  // 2. Destinataire — Client / Prospect / Apporteur.
  const pickRecipient = (rec: { email?: string | null; phone?: string | null; mobile?: string | null }): string | null => {
    if (d.channel === 'EMAIL') return rec.email?.trim() || null;
    return (rec.mobile?.trim() || rec.phone?.trim()) || null;
  };
  let to: string | null = null;
  let recipientName = '';
  let recipientFirstName = '';
  let recipientLastName = '';
  let recipientFK: { clientId?: number } = {};
  if (d.recipientType === 'CLIENT') {
    const c = await db.client.findUnique({
      where: { id: d.recipientId },
      select: { id: true, firstName: true, lastName: true, entreprise: true, type: true, email: true, phone: true, mobile: true, deletedAt: true },
    });
    if (!c || c.deletedAt) return { success: false, error: 'Client introuvable' };
    to = pickRecipient(c);
    recipientFirstName = c.firstName ?? '';
    recipientLastName  = c.lastName ?? '';
    recipientName = c.type === 'ENTREPRISE'
      ? (c.entreprise ?? `Client #${c.id}`)
      : `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    recipientFK = { clientId: c.id };
  } else if (d.recipientType === 'PROSPECT') {
    const p = await db.prospect.findUnique({
      where: { id: d.recipientId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, deletedAt: true },
    });
    if (!p || p.deletedAt) return { success: false, error: 'Prospect introuvable' };
    to = pickRecipient(p);
    recipientFirstName = p.firstName ?? '';
    recipientLastName  = p.lastName ?? '';
    recipientName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  } else {
    const r = await db.businessReferrer.findUnique({
      where: { id: d.recipientId },
      select: { id: true, firstName: true, lastName: true, companyName: true, email: true, phone: true, mobile: true, deletedAt: true },
    });
    if (!r || r.deletedAt) return { success: false, error: "Apporteur d'affaires introuvable" };
    to = pickRecipient(r);
    recipientFirstName = r.firstName;
    recipientLastName  = r.lastName;
    recipientName = r.companyName ?? `${r.firstName} ${r.lastName}`.trim();
  }
  if (!to) {
    return {
      success: false,
      error: `Le destinataire n'a pas de ${d.channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné`,
    };
  }

  // 3. Template depuis Paramètres (non éditable côté UI de partage).
  const settingsMap = await getSettings([
    SettingsKeys.shareLocationEmailSubject,
    SettingsKeys.shareLocationEmailBody,
    SettingsKeys.shareLocationWhatsappBody,
  ]);
  let templateSubject: string | undefined;
  let templateBody: string;
  if (d.channel === 'EMAIL') {
    templateSubject = settingsMap[SettingsKeys.shareLocationEmailSubject] ?? 'Localisation — {{entityTitle}}';
    templateBody    = settingsMap[SettingsKeys.shareLocationEmailBody]    ?? '{{entityTitle}} ({{reference}})\nGPS : {{latitude}}, {{longitude}}\n{{googleMapsUrl}}';
  } else {
    templateBody    = settingsMap[SettingsKeys.shareLocationWhatsappBody] ?? '{{entityTitle}} ({{reference}})\nGPS : {{latitude}}, {{longitude}}\n{{googleMapsUrl}}';
  }

  // 4. URLs cartographiques (le `/search/…` Google Earth pose une épingle rouge).
  const lat = entityVars.latitude;
  const lng = entityVars.longitude;
  const locationVars: Record<string, string> = {
    ...entityVars,
    recipientName,
    recipientFirstName,
    recipientLastName,
    googleMapsUrl:  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    googleEarthUrl: `https://earth.google.com/web/search/${lat},${lng}/@${lat},${lng},150a,1000d,35y,0h,0t,0r`,
    osmUrl:         `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
  };

  const rendered = await renderMessage({ subject: templateSubject, body: templateBody }, locationVars);
  return {
    success: true,
    data: {
      to,
      finalSubject: rendered.subject ?? templateSubject ?? '',
      finalBody:    rendered.body,
      entityTitle,
      entityFK,
      recipientFK,
    },
  };
}

export function registerCommunicationIPC(): void {

  // ── Templates ──────────────────────────────────────────────────────────────

  ipcMain.handle('communication:listTemplates', async (_event, { token, channel }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = {};
      if (channel) where.channel = channel;
      // Les rôles non privilégiés ne voient que les modèles « manuel ».
      if (!TEMPLATE_FULL_ACCESS_ROLES.includes(session.role)) where.usageType = 'MANUEL';
      const data = await db.commTemplate.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      return { success: true, data };
    } catch (error: any) {
      logger.error('communication:listTemplates error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('communication:getTemplate', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const template = await db.commTemplate.findUnique({ where: { id } });
      if (!template) return { success: false, error: 'Template introuvable' };
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('communication:createTemplate', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const parsed = templateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      const template = await db.commTemplate.create({
        data: {
          name: d.name,
          channel: d.channel,
          subject: d.subject,
          body: d.body,
          variables: d.variables ? (d.variables as any) : undefined,
          usageType: d.usageType,
          isActive: d.isActive,
        },
      });
      logger.info(`CommTemplate created: ${template.name}`);
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('communication:updateTemplate', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const parsed = templateSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data as any;
      if (d.variables !== undefined) d.variables = d.variables;
      const template = await db.commTemplate.update({ where: { id }, data: d });
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('communication:deleteTemplate', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const db = getDb();
      await db.commTemplate.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Historique des communications ──────────────────────────────────────────

  ipcMain.handle('communication:getHistory', async (_event, { token, filters = {}, page = 1, limit = 30 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = {};
      if (filters.channel) where.channel = filters.channel;
      if (filters.status) where.status = filters.status;
      if (filters.direction) where.direction = filters.direction;
      if (filters.search) {
        where.OR = [
          { to: { contains: filters.search } },
          { subject: { contains: filters.search } },
          { body: { contains: filters.search } },
        ];
      }
      // Visibilité restreinte pour les rôles non privilégiés : ne montrer
      // que les messages envoyés par l'utilisateur lui-même OU adressés à
      // un client qui lui est rattaché (Client.assignedToId).
      if (!FULL_HISTORY_ROLES.includes(session.role)) {
        where.AND = [
          ...(where.AND ?? []),
          {
            OR: [
              { senderId: session.userId },
              { client: { assignedToId: session.userId } },
            ],
          },
        ];
      }
      const [data, total] = await db.$transaction([
        db.communication.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { template: { select: { id: true, name: true } } },
        }),
        db.communication.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('communication:getHistory error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Configuration du suivi d'ouverture des emails (URL de base du pixel).
  ipcMain.handle('communication:getTracking', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const baseUrl = (await getSetting(COMM_TRACKING_KEY)) ?? '';
      return { success: true, data: { baseUrl } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('communication:updateTracking', async (_event, { token, baseUrl }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const url = String(baseUrl ?? '').trim();
      if (url && !/^https?:\/\//i.test(url)) {
        return { success: false, error: "L'URL de suivi doit commencer par http:// ou https://" };
      }
      await setSetting(COMM_TRACKING_KEY, url);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Envoi Email ────────────────────────────────────────────────────────────

  ipcMain.handle('communication:sendEmail', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = sendEmailSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;

      // Envoi « en tant que » l'utilisateur connecté (mode Particulier) :
      // adresse + nom d'expéditeur de l'utilisateur, et sa signature personnelle
      // (HTML, avec logo optionnel) ajoutée au corps du message.
      let fromOverride: { fromName?: string; fromAddress?: string } = {};
      let bodyWithSignature = d.body;
      let senderSelfHtml = false;
      if (d.senderSelf) {
        const me = await db.user.findUnique({
          where: { id: session.userId },
          select: {
            firstName: true, lastName: true, email: true, nomCommercial: true,
            messageSignature: true,
          },
        });
        if (me) {
          const senderName = (me.nomCommercial || `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim()) || undefined;
          fromOverride = { fromName: senderName, fromAddress: me.email };
          // Signature HTML personnelle.
          const sigHtml = (me.messageSignature ?? '').trim();
          if (sigHtml) {
            // Le corps (provenant de l'éditeur riche) est déjà du HTML : on
            // assemble corps + signature en HTML et on enverra en HTML.
            bodyWithSignature = `${d.body}<br><br>${sigHtml}`;
            senderSelfHtml = true;
          }
        }
      }

      // Destinataires en copie (CC) / copie cachée (BCC).
      const cc = parseEmailList(d.cc);
      const bcc = parseEmailList(d.bcc);
      const badAddrs = [...cc.invalid, ...bcc.invalid];
      if (badAddrs.length) {
        return { success: false, error: `Adresse(s) invalide(s) en copie : ${badAddrs.join(', ')}` };
      }

      // Pièces jointes (mode Particulier) : valide l'existence et la taille totale
      // (≤ 25 Mo), puis prépare les attachements Nodemailer (lecture par chemin).
      let mailAttachments: Array<{ filename: string; path: string }> | undefined;
      if (d.attachments && d.attachments.length) {
        let totalBytes = 0;
        for (const att of d.attachments) {
          if (!fs.existsSync(att.path)) {
            return { success: false, error: `Pièce jointe introuvable : ${att.name}` };
          }
          totalBytes += fs.statSync(att.path).size;
        }
        if (totalBytes > MAX_ATTACHMENTS_BYTES) {
          return { success: false, error: 'Pièces jointes : taille totale supérieure à 25 Mo.' };
        }
        mailAttachments = d.attachments.map((att) => ({
          filename: att.name || path.basename(att.path),
          path: att.path,
        }));
      }

      // Résout les variables d'entreprise ({{companyName}}, {{companyPhoneFixed}}, …)
      // côté serveur — les valeurs ne transitent pas par le renderer.
      const rendered = await renderMessage(
        { subject: d.subject, body: bodyWithSignature },
        (d.metadata as any) ?? {},
      );
      const finalSubject = rendered.subject ?? d.subject;
      const finalBody    = rendered.body;
      // Corps historisé : en mode senderSelf, le HTML peut contenir un logo en
      // base64 (volumineux) → on stocke une version texte pour rester sous la
      // limite de la colonne et garder l'historique lisible.
      const storedBody  = senderSelfHtml ? htmlToPlainText(finalBody) : finalBody;

      const comm = await db.communication.create({
        data: {
          channel: 'EMAIL',
          direction: 'SORTANT',
          to: d.to,
          subject: finalSubject,
          body: storedBody,
          status: 'EN_ATTENTE',
          templateId: d.templateId ?? null,
          senderId: session.userId,
          clientId:     d.clientId ?? null,
          ownerId:      d.ownerId ?? null,
          conventionId: d.conventionId ?? null,
          metadata: d.metadata ? (d.metadata as any) : undefined,
        },
      });

      // Pixel de suivi d'ouverture : injecté si une URL de suivi est configurée.
      const trackBase = (await getSetting(COMM_TRACKING_KEY))?.trim() || '';
      const trackingPixelUrl = trackBase
        ? `${trackBase}${trackBase.includes('?') ? '&' : '?'}c=${comm.id}`
        : undefined;

      // Envoi via Nodemailer (SMTP) — paramétré côté AppSetting.
      try {
        const info = await sendEmail({
          to: d.to,
          subject: finalSubject,
          body: storedBody,
          // Signature HTML : on fournit explicitement le HTML (corps + signature
          // + logo) pour un rendu fidèle, sinon comportement par défaut.
          ...(senderSelfHtml ? { html: finalBody } : {}),
          ...(mailAttachments ? { attachments: mailAttachments } : {}),
          ...(cc.list.length ? { cc: cc.list } : {}),
          ...(bcc.list.length ? { bcc: bcc.list } : {}),
          ...(trackingPixelUrl ? { trackingPixelUrl } : {}),
          ...fromOverride,
        });
        // « Remis » : le serveur SMTP a accepté le destinataire principal.
        const delivered = info.accepted.some((a) => a.toLowerCase() === d.to.toLowerCase());
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ENVOYE', sentAt: new Date(), deliveredAt: delivered ? new Date() : null },
        });
        logger.info(`Email sent to ${d.to}`);
        return { success: true, data: { ...comm, status: 'ENVOYE' } };
      } catch (sendErr: any) {
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ECHEC', errorMsg: sendErr.message },
        });
        return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
      }
    } catch (error: any) {
      logger.error('communication:sendEmail error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Envoi SMS ──────────────────────────────────────────────────────────────

  ipcMain.handle('communication:sendSms', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = sendSmsSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;

      // Résout les variables d'entreprise dans le corps avant transmission.
      const rendered = await renderMessage({ body: d.body }, (d.metadata as any) ?? {});
      const finalBody = rendered.body;

      const comm = await db.communication.create({
        data: {
          channel: 'SMS',
          direction: 'SORTANT',
          to: d.to,
          body: finalBody,
          status: 'EN_ATTENTE',
          templateId: d.templateId ?? null,
          senderId: session.userId,
          clientId:     d.clientId ?? null,
          ownerId:      d.ownerId ?? null,
          conventionId: d.conventionId ?? null,
          metadata: d.metadata ? (d.metadata as any) : undefined,
        },
      });

      // Envoi via le fournisseur SMS paramétré (Twilio / OVH / Brevo).
      try {
        await sendSms(d.to, finalBody);
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ENVOYE', sentAt: new Date() },
        });
        logger.info(`SMS sent to ${d.to}`);
        return { success: true, data: { ...comm, status: 'ENVOYE' } };
      } catch (sendErr: any) {
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ECHEC', errorMsg: sendErr.message },
        });
        return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
      }
    } catch (error: any) {
      logger.error('communication:sendSms error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Envoi WhatsApp ─────────────────────────────────────────────────────────

  ipcMain.handle('communication:sendWhatsapp', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = sendWhatsappSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;

      const rendered = await renderMessage({ body: d.body }, (d.metadata as any) ?? {});
      const finalBody = rendered.body;

      const comm = await db.communication.create({
        data: {
          channel: 'WHATSAPP',
          direction: 'SORTANT',
          to: d.to,
          body: finalBody,
          status: 'EN_ATTENTE',
          templateId: d.templateId ?? null,
          senderId: session.userId,
          clientId:     d.clientId ?? null,
          ownerId:      d.ownerId ?? null,
          conventionId: d.conventionId ?? null,
          metadata: d.metadata ? (d.metadata as any) : undefined,
        },
      });

      try {
        await sendWhatsapp(d.to, finalBody);
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ENVOYE', sentAt: new Date() },
        });
        logger.info(`WhatsApp sent to ${d.to}`);
        return { success: true, data: { ...comm, status: 'ENVOYE' } };
      } catch (sendErr: any) {
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ECHEC', errorMsg: sendErr.message },
        });
        return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
      }
    } catch (error: any) {
      logger.error('communication:sendWhatsapp error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Renvoi d'un message en échec ────────────────────────────────────────────
  // Réessaie l'envoi d'une Communication existante dont le statut est ECHEC.
  // Met à jour la même ligne (statut + sentAt + errorMsg) — pas de doublon dans
  // l'historique, et le dedupeKey éventuel (relance automatique) est préservé.

  ipcMain.handle('communication:resend', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const comm = await db.communication.findUnique({ where: { id } });
      if (!comm) return { success: false, error: 'Message introuvable' };
      if (comm.status !== 'ECHEC') {
        return { success: false, error: 'Seuls les messages en échec peuvent être renvoyés' };
      }

      // Statut intermédiaire pour refléter la tentative en cours dans l'UI.
      await db.communication.update({
        where: { id: comm.id },
        data: { status: 'EN_ATTENTE', errorMsg: null },
      });

      try {
        if (comm.channel === 'EMAIL') {
          await sendEmail({ to: comm.to, subject: comm.subject ?? '', body: comm.body });
        } else if (comm.channel === 'SMS') {
          await sendSms(comm.to, comm.body);
        } else if (comm.channel === 'WHATSAPP') {
          await sendWhatsapp(comm.to, comm.body);
        } else {
          throw new Error(`Canal non supporté : ${comm.channel}`);
        }
        const updated = await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ENVOYE', sentAt: new Date(), errorMsg: null },
        });
        logger.info(`Communication ${comm.id} renvoyée avec succès (${comm.channel} → ${comm.to})`);
        return { success: true, data: updated };
      } catch (sendErr: any) {
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ECHEC', errorMsg: sendErr.message },
        });
        return { success: false, error: `Renvoi échoué : ${sendErr.message}` };
      }
    } catch (error: any) {
      logger.error('communication:resend error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Suppression d'un message en échec uniquement (les envois réussis sont conservés).
  ipcMain.handle('communication:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const comm = await db.communication.findUnique({ where: { id } });
      if (!comm) return { success: false, error: 'Message introuvable' };
      if (comm.status !== 'ECHEC') {
        return { success: false, error: "Seuls les messages dont l'envoi a échoué peuvent être supprimés" };
      }
      await db.communication.delete({ where: { id } });
      logger.info(`Communication ${id} supprimée (échec, ${comm.channel} → ${comm.to})`);
      return { success: true };
    } catch (error: any) {
      logger.error('communication:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Résolution d'une cible (Client / Owner / Convention) ────────────────────
  // Retourne le destinataire à utiliser pour un canal donné et les FK à stamper
  // sur Communication. Le destinataire est calculé côté serveur pour garantir
  // que clientId/ownerId/conventionId restent cohérents avec la chaîne `to`.

  ipcMain.handle('communication:resolveTarget', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const parsed = resolveTargetSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const { entityType, entityId, channel } = parsed.data;
      // Variables communes (entreprise / agence / agent / date) résolues une fois.
      const commonVars = await buildCommonVariables(db, session.userId);

      // Sélectionne la propriété adresse selon le canal.
      // EMAIL → email ; SMS/WHATSAPP → mobile puis phone en repli.
      const pickRecipient = (rec: { email?: string | null; phone?: string | null; mobile?: string | null }): string | null => {
        if (channel === 'EMAIL') return rec.email?.trim() || null;
        return (rec.mobile?.trim() || rec.phone?.trim()) || null;
      };

      if (entityType === 'CLIENT') {
        const c = await db.client.findUnique({
          where: { id: entityId },
          select: { id: true, civilite: true, firstName: true, lastName: true, entreprise: true, type: true, email: true, phone: true, mobile: true, deletedAt: true, assignedToId: true, prospect: { select: { assignedToId: true } } },
        });
        if (!c || c.deletedAt) return { success: false, error: 'Client introuvable' };
        // Visibilité restreinte : hors rôles à vue complète, on ne peut cibler
        // qu'un client dont on est l'utilisateur référent (ou issu d'un prospect affecté).
        if (!CLIENT_FULL_VIEW_ROLES.includes(session.role)) {
          const visible =
            c.assignedToId === session.userId || c.prospect?.assignedToId === session.userId;
          if (!visible) return { success: false, error: 'Client inaccessible' };
        }
        const to = pickRecipient(c);
        if (!to) return { success: false, error: `Le client n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
        const label = c.type === 'ENTREPRISE' ? (c.entreprise ?? `Client #${c.id}`) : `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
        const variables = { ...commonVars, ...recipientVariables(c) };
        return { success: true, data: { to, label, targets: { clientId: c.id }, variables } };
      }

      if (entityType === 'OWNER') {
        const o = await db.owner.findUnique({
          where: { id: entityId },
          select: { id: true, firstName: true, lastName: true, companyName: true, type: true, email: true, phone: true, mobile: true, deletedAt: true },
        });
        if (!o || o.deletedAt) return { success: false, error: 'Propriétaire introuvable' };
        const to = pickRecipient(o);
        if (!to) return { success: false, error: `Le propriétaire n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
        const label = o.type === 'ENTREPRISE' ? (o.companyName ?? `Propriétaire #${o.id}`) : `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim();
        const variables = { ...commonVars, ...recipientVariables(o) };
        return { success: true, data: { to, label, targets: { ownerId: o.id }, variables } };
      }

      // CONVENTION → client principal de la convention.
      const conv = await db.convention.findUnique({
        where: { id: entityId },
        select: {
          id: true, reference: true, type: true, startDate: true, endDate: true, rentAmount: true, deletedAt: true,
          client: { select: { id: true, civilite: true, firstName: true, lastName: true, entreprise: true, type: true, email: true, phone: true, mobile: true } },
        },
      });
      if (!conv || conv.deletedAt) return { success: false, error: 'Convention introuvable' };
      if (!conv.client) return { success: false, error: 'Convention sans client principal' };
      const to = pickRecipient(conv.client);
      if (!to) return { success: false, error: `Le client principal de la convention n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
      const clientLabel = conv.client.type === 'ENTREPRISE'
        ? (conv.client.entreprise ?? `Client #${conv.client.id}`)
        : `${conv.client.firstName ?? ''} ${conv.client.lastName ?? ''}`.trim();
      const variables = {
        ...commonVars,
        ...recipientVariables(conv.client),
        conventionRef:  conv.reference ?? '',
        conventionType: CONVENTION_TYPE_LABELS[conv.type as string] ?? String(conv.type ?? ''),
        startDate:      fmtDate(conv.startDate),
        endDate:        fmtDate(conv.endDate),
        rentAmount:     fmtAmount(conv.rentAmount),
      };
      return {
        success: true,
        data: { to, label: `${conv.reference} — ${clientLabel}`, targets: { clientId: conv.client.id, conventionId: conv.id }, variables },
      };
    } catch (error: any) {
      logger.error('communication:resolveTarget error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Partage de localisation GPS ─────────────────────────────────────────────
  // Lotissement / Terrain / Bien → Client / Prospect / Apporteur d'affaires.
  // Le template est lu côté serveur depuis Paramètres (non éditable dans l'UI
  // de partage). Deux handlers partagent la même logique de rendu :
  //   - previewShareLocation : renvoie le message rendu pour l'aperçu UI ;
  //   - shareLocation        : envoie le message et trace dans Communication.

  ipcMain.handle('communication:previewShareLocation', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = shareLocationSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const ctx = await buildShareLocationContext(parsed.data);
      if (!ctx.success) return ctx;
      return {
        success: true,
        data: {
          to:      ctx.data.to,
          subject: ctx.data.finalSubject,
          body:    ctx.data.finalBody,
          entityTitle: ctx.data.entityTitle,
        },
      };
    } catch (error: any) {
      logger.error('communication:previewShareLocation error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('communication:shareLocation', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = shareLocationSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const ctx = await buildShareLocationContext(parsed.data);
      if (!ctx.success) return ctx;
      const db = getDb();
      const d = parsed.data;
      const { to, finalSubject, finalBody, entityTitle, entityFK, recipientFK } = ctx.data;

      // Trace puis envoie via le canal demandé.
      const comm = await db.communication.create({
        data: {
          channel: d.channel,
          direction: 'SORTANT',
          to,
          subject: d.channel === 'EMAIL' ? finalSubject : null,
          body: finalBody,
          status: 'EN_ATTENTE',
          senderId: session.userId,
          clientId: recipientFK.clientId ?? null,
          metadata: {
            kind: 'SHARE_LOCATION',
            entityType: d.entityType,
            entityId: d.entityId,
            recipientType: d.recipientType,
            recipientId: d.recipientId,
            ...entityFK,
          } as any,
        },
      });

      try {
        if (d.channel === 'EMAIL') {
          await sendEmail({ to, subject: finalSubject, body: finalBody });
        } else {
          await sendWhatsapp(to, finalBody);
        }
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ENVOYE', sentAt: new Date() },
        });
        logger.info(`Partage de localisation envoyé (${d.channel} → ${to}, ${d.entityType}#${d.entityId})`);
        return { success: true, data: { ...comm, status: 'ENVOYE', to, subject: finalSubject, body: finalBody, entityTitle } };
      } catch (sendErr: any) {
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ECHEC', errorMsg: sendErr.message },
        });
        return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
      }
    } catch (error: any) {
      logger.error('communication:shareLocation error', error.message);
      return { success: false, error: error.message };
    }
  });
}
