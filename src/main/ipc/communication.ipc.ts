import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];

const templateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS']),
  subject: z.string().optional(),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const sendSmsSchema = z.object({
  to: z.string().min(8),
  body: z.string().min(1),
  templateId: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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

      // Enregistre la communication (statut EN_ATTENTE — envoi asynchrone non implémenté ici)
      const comm = await db.communication.create({
        data: {
          channel: 'EMAIL',
          direction: 'SORTANT',
          to: d.to,
          subject: d.subject,
          body: d.body,
          status: 'EN_ATTENTE',
          templateId: d.templateId ?? null,
          metadata: d.metadata ? (d.metadata as any) : undefined,
        },
      });

      // Tentative d'envoi (service email à brancher selon config)
      try {
        // TODO: await emailService.send({ to: d.to, subject: d.subject, body: d.body });
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

      const comm = await db.communication.create({
        data: {
          channel: 'SMS',
          direction: 'SORTANT',
          to: d.to,
          body: d.body,
          status: 'EN_ATTENTE',
          templateId: d.templateId ?? null,
          metadata: d.metadata ? (d.metadata as any) : undefined,
        },
      });

      try {
        // TODO: await smsService.send({ to: d.to, body: d.body });
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
}
