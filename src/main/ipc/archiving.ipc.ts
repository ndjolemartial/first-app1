import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

// Module Archivage : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module.
const READ_ROLES    = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const WRITE_ROLES   = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const RESTORE_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const archiveSchema = z.object({
  entityType: z.enum(['CLIENT', 'PROSPECT', 'OWNER', 'PROPERTY', 'CONVENTION', 'INVOICE', 'DOCUMENT']),
  entityId: z.number().int().positive(),
  entityRef: z.string().min(1),
  snapshot: z.record(z.string(), z.unknown()),
  reason: z.enum(['MANUEL', 'CONVENTION_TERMINEE', 'CLIENT_INACTIF', 'BIEN_VENDU', 'POLITIQUE_AUTOMATIQUE', 'DEMANDE_RGPD', 'AUTRE']).default('MANUEL'),
  reasonDetail: z.string().optional(),
  retentionDate: z.string().optional(),
  notes: z.string().optional(),
});

const policySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  entityType: z.enum(['CLIENT', 'PROSPECT', 'OWNER', 'PROPERTY', 'CONVENTION', 'INVOICE', 'DOCUMENT']),
  triggerCondition: z.record(z.string(), z.unknown()),
  retentionDays: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

export function registerArchivingIPC(): void {

  // ── Archives ───────────────────────────────────────────────────────────────

  ipcMain.handle('archiving:list', async (_event, { token, filters = {}, page = 1, limit = 30 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = {};
      if (filters.entityType) where.entityType = filters.entityType;
      if (filters.status) where.status = filters.status;
      else where.status = { not: 'SUPPRIME_DEFINITIVEMENT' };
      if (filters.reason) where.reason = filters.reason;
      if (filters.search) {
        where.OR = [
          { entityRef: { contains: filters.search } },
          { notes: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.archiveRecord.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { archivedAt: 'desc' },
          include: {
            archivedBy: { select: { id: true, firstName: true, lastName: true } },
            restoredBy: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        db.archiveRecord.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('archiving:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('archiving:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const record = await db.archiveRecord.findUnique({
        where: { id },
        include: {
          archivedBy: { select: { id: true, firstName: true, lastName: true } },
          restoredBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      if (!record) return { success: false, error: 'Archive introuvable' };
      return { success: true, data: record };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('archiving:archive', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = archiveSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      const record = await db.archiveRecord.create({
        data: {
          entityType: d.entityType,
          entityId: d.entityId,
          entityRef: d.entityRef,
          snapshot: d.snapshot as any,
          reason: d.reason,
          reasonDetail: d.reasonDetail,
          archivedById: session.userId,
          retentionDate: d.retentionDate ? new Date(d.retentionDate) : null,
          notes: d.notes,
          status: 'ARCHIVE',
        } as any,
      });
      logger.info(`Archived ${d.entityType} #${d.entityId} (ref: ${d.entityRef})`);
      return { success: true, data: record };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('archiving:restore', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, RESTORE_ROLES);
      const db = getDb();
      const existing = await db.archiveRecord.findUnique({ where: { id } });
      if (!existing) return { success: false, error: 'Archive introuvable' };
      if (existing.status === 'SUPPRIME_DEFINITIVEMENT') {
        return { success: false, error: 'Impossible de restaurer un enregistrement supprimé définitivement' };
      }
      const record = await db.archiveRecord.update({
        where: { id },
        data: {
          status: 'RESTAURE',
          restoredById: session.userId,
          restoredAt: new Date(),
        } as any,
      });
      logger.info(`Restored archive #${id}`);
      return { success: true, data: record };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('archiving:permanentDelete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN']);
      const db = getDb();
      await db.archiveRecord.update({
        where: { id },
        data: { status: 'SUPPRIME_DEFINITIVEMENT' } as any,
      });
      logger.info(`Permanent delete archive #${id}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('archiving:getStats', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const now = new Date();

      const [totalArchived, totalRestored, expiringCount] = await db.$transaction([
        db.archiveRecord.count({ where: { status: 'ARCHIVE' } }),
        db.archiveRecord.count({ where: { status: 'RESTAURE' } }),
        db.archiveRecord.count({
          where: {
            status: 'ARCHIVE',
            retentionDate: { lte: new Date(now.getTime() + 30 * 86400000) },
          },
        }),
      ]);

      // Par type d'entité
      const byType = await db.archiveRecord.groupBy({
        by: ['entityType'],
        where: { status: 'ARCHIVE' },
        _count: { id: true },
      });

      return {
        success: true,
        data: {
          totalArchived,
          totalRestored,
          expiringCount,
          byType: byType.map((b: any) => ({ entityType: b.entityType, count: b._count.id })),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Politiques d'archivage ─────────────────────────────────────────────────

  ipcMain.handle('archiving:listPolicies', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const db = getDb();
      const data = await db.archivePolicy.findMany({ orderBy: { entityType: 'asc' } });
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('archiving:createPolicy', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const parsed = policySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      const policy = await db.archivePolicy.create({
        data: {
          name: d.name,
          description: d.description,
          entityType: d.entityType,
          triggerCondition: d.triggerCondition as any,
          retentionDays: d.retentionDays ?? null,
          isActive: d.isActive,
        } as any,
      });
      return { success: true, data: policy };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('archiving:updatePolicy', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const parsed = policySchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const policy = await db.archivePolicy.update({ where: { id }, data: parsed.data as any });
      return { success: true, data: policy };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('archiving:deletePolicy', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN']);
      const db = getDb();
      await db.archivePolicy.delete({ where: { id } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
