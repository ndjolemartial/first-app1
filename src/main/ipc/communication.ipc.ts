import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { sendEmail } from '../services/email.service';
import { sendSms } from '../services/sms.service';
import { sendWhatsapp } from '../services/whatsapp.service';
import { renderMessage } from '../services/templating.service';
import { getSettings, SettingsKeys } from '../services/settings.service';
import logger from '../utils/logger';
import { z } from 'zod';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];

// Rôles qui voient l'intégralité de l'historique de communication.
// ASSISTANTE_DIRECTION est traité comme MANAGER (équivalence centralisée dans
// auth.service). Les autres rôles (AGENT, READONLY) sont restreints à leurs
// propres envois et aux messages adressés à un client qui leur est rattaché.
const FULL_HISTORY_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];

const templateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
  subject: z.string().optional(),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

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
  ...targetFields,
});

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

      // Résout les variables d'entreprise ({{companyName}}, {{companyPhoneFixed}}, …)
      // côté serveur — les valeurs ne transitent pas par le renderer.
      const rendered = await renderMessage(
        { subject: d.subject, body: d.body },
        (d.metadata as any) ?? {},
      );
      const finalSubject = rendered.subject ?? d.subject;
      const finalBody    = rendered.body;

      const comm = await db.communication.create({
        data: {
          channel: 'EMAIL',
          direction: 'SORTANT',
          to: d.to,
          subject: finalSubject,
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

      // Envoi via Nodemailer (SMTP) — paramétré côté AppSetting.
      try {
        await sendEmail({ to: d.to, subject: finalSubject, body: finalBody });
        await db.communication.update({
          where: { id: comm.id },
          data: { status: 'ENVOYE', sentAt: new Date() },
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

      // Sélectionne la propriété adresse selon le canal.
      // EMAIL → email ; SMS/WHATSAPP → mobile puis phone en repli.
      const pickRecipient = (rec: { email?: string | null; phone?: string | null; mobile?: string | null }): string | null => {
        if (channel === 'EMAIL') return rec.email?.trim() || null;
        return (rec.mobile?.trim() || rec.phone?.trim()) || null;
      };

      if (entityType === 'CLIENT') {
        const c = await db.client.findUnique({
          where: { id: entityId },
          select: { id: true, firstName: true, lastName: true, entreprise: true, type: true, email: true, phone: true, mobile: true, deletedAt: true },
        });
        if (!c || c.deletedAt) return { success: false, error: 'Client introuvable' };
        const to = pickRecipient(c);
        if (!to) return { success: false, error: `Le client n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
        const label = c.type === 'ENTREPRISE' ? (c.entreprise ?? `Client #${c.id}`) : `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
        return { success: true, data: { to, label, targets: { clientId: c.id } } };
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
        return { success: true, data: { to, label, targets: { ownerId: o.id } } };
      }

      // CONVENTION → client principal de la convention.
      const conv = await db.convention.findUnique({
        where: { id: entityId },
        select: {
          id: true, reference: true, deletedAt: true,
          client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true, email: true, phone: true, mobile: true } },
        },
      });
      if (!conv || conv.deletedAt) return { success: false, error: 'Convention introuvable' };
      if (!conv.client) return { success: false, error: 'Convention sans client principal' };
      const to = pickRecipient(conv.client);
      if (!to) return { success: false, error: `Le client principal de la convention n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
      const clientLabel = conv.client.type === 'ENTREPRISE'
        ? (conv.client.entreprise ?? `Client #${conv.client.id}`)
        : `${conv.client.firstName ?? ''} ${conv.client.lastName ?? ''}`.trim();
      return {
        success: true,
        data: { to, label: `${conv.reference} — ${clientLabel}`, targets: { clientId: conv.client.id, conventionId: conv.id } },
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
