import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];

const activitySchema = z.object({
  type: z.enum(['NOTIFICATION', 'APPEL', 'EMAIL', 'SMS', 'REUNION', 'VISITE', 'TASK', 'RAPPEL', 'DOCUMENT']),
  subject: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['EN_ATTENTE', 'EN_TRAITEMENT', 'TRAITE', 'ANNULE']).default('EN_ATTENTE'),
  dueDate: z.string().optional(),
  completedAt: z.string().optional(),
  userId: z.number().int().positive().optional(),
  prospectId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  ownerId: z.number().int().positive().optional(),
  propertyId: z.number().int().positive().optional(),
  conventionId: z.number().int().positive().optional(),
  lotissementId: z.number().int().positive().optional(),
  terrainId: z.number().int().positive().optional(),
  programmeId: z.number().int().positive().optional(),
  invoiceId: z.number().int().positive().optional(),
  installmentId: z.number().int().positive().optional(),
});

export function registerCrmIPC(): void {

  ipcMain.handle('crm:listActivities', async (_event, { token, filters = {}, page = 1, limit = 30 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ALL_ROLES);
      const db = getDb();
      const where: any = {};
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      if (filters.userId) where.userId = filters.userId;
      if (filters.clientId) where.clientId = filters.clientId;
      if (filters.prospectId) where.prospectId = filters.prospectId;
      if (filters.propertyId) where.propertyId = filters.propertyId;
      if (filters.conventionId) where.conventionId = filters.conventionId;
      if (filters.dueBefore) where.dueDate = { ...(where.dueDate ?? {}), lte: new Date(filters.dueBefore) };
      if (filters.dueAfter) where.dueDate = { ...(where.dueDate ?? {}), gte: new Date(filters.dueAfter) };
      if (filters.search) {
        where.OR = [
          { subject: { contains: filters.search } },
          { description: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.crmActivity.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
            prospect: { select: { id: true, firstName: true, lastName: true } },
            owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
            property: { select: { id: true, reference: true, address: true } },
            convention: { select: { id: true, reference: true } },
            lotissement: { select: { id: true, reference: true, nom: true } },
            terrain: { select: { id: true, reference: true } },
            programme: { select: { id: true, reference: true, nom: true } },
            invoice: { select: { id: true, reference: true } },
            installment: { select: { id: true, installmentNumber: true, convention: { select: { reference: true } } } },
          },
        }),
        db.crmActivity.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('crm:listActivities error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('crm:getActivity', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ALL_ROLES);
      const db = getDb();
      const activity = await db.crmActivity.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
          prospect: { select: { id: true, firstName: true, lastName: true } },
          owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          property: { select: { id: true, reference: true, address: true } },
          convention: { select: { id: true, reference: true } },
          lotissement: { select: { id: true, reference: true, nom: true } },
          terrain: { select: { id: true, reference: true } },
          programme: { select: { id: true, reference: true, nom: true } },
          invoice: { select: { id: true, reference: true } },
          installment: { select: { id: true, installmentNumber: true, convention: { select: { reference: true } } } },
        },
      });
      if (!activity) return { success: false, error: 'Activité introuvable' };
      return { success: true, data: activity };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('crm:createActivity', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = activitySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      const activity = await db.crmActivity.create({
        data: {
          type: d.type,
          subject: d.subject,
          description: d.description,
          status: d.status,
          dueDate: d.dueDate ? new Date(d.dueDate) : null,
          completedAt: d.completedAt ? new Date(d.completedAt) : null,
          userId: d.userId ?? null,
          prospectId: d.prospectId ?? null,
          clientId: d.clientId ?? null,
          ownerId: d.ownerId ?? null,
          propertyId: d.propertyId ?? null,
          conventionId: d.conventionId ?? null,
          lotissementId: d.lotissementId ?? null,
          terrainId: d.terrainId ?? null,
          programmeId: d.programmeId ?? null,
          invoiceId: d.invoiceId ?? null,
          installmentId: d.installmentId ?? null,
        } as any,
      });
      logger.info(`CRM activity created: ${activity.id}`);
      return { success: true, data: activity };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('crm:updateActivity', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = activitySchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data as any;
      if (d.dueDate) d.dueDate = new Date(d.dueDate);
      if (d.completedAt) d.completedAt = new Date(d.completedAt);
      const activity = await db.crmActivity.update({ where: { id }, data: d });
      return { success: true, data: activity };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('crm:deleteActivity', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const db = getDb();
      await db.crmActivity.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('crm:completeActivity', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const activity = await db.crmActivity.update({
        where: { id },
        data: { status: 'TRAITE', completedAt: new Date() },
      });
      return { success: true, data: activity };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('crm:getStats', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ALL_ROLES);
      const db = getDb();
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

      const [total, pending, overdue, todayCount] = await db.$transaction([
        db.crmActivity.count({ where: { status: { not: 'ANNULE' } } }),
        db.crmActivity.count({ where: { status: 'EN_ATTENTE' } }),
        db.crmActivity.count({
          where: {
            status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] },
            dueDate: { lt: now },
          },
        }),
        db.crmActivity.count({
          where: {
            dueDate: { gte: startOfDay, lte: endOfDay },
            status: { not: 'ANNULE' },
          },
        }),
      ]);
      return { success: true, data: { total, pending, overdue, todayCount } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
