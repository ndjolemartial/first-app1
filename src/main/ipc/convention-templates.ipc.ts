import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];

const CONVENTION_TYPES = [
  'RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT',
  'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION',
] as const;

const templateSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  type: z.enum(CONVENTION_TYPES),
  header: z.string().optional(),
  body: z.string().default(''),
  footer: z.string().optional(),
  headerWidth: z.number().int().min(20).max(100).default(100),
  footerWidth: z.number().int().min(20).max(100).default(100),
  headerHeight: z.number().int().min(40).max(800).default(140),
  footerHeight: z.number().int().min(40).max(800).default(140),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

/**
 * Enregistre les handlers IPC pour les modèles de convention enrichis.
 */
export function registerConventionTemplatesIPC(): void {
  ipcMain.handle('conventionTemplates:list', async (_event, { token, filters = {}, page = 1, limit = 100 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.type) where.type = filters.type;
      if (filters.search) where.name = { contains: filters.search };
      const [data, total] = await db.$transaction([
        db.conventionTemplate.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ type: 'asc' }, { name: 'asc' }],
        }),
        db.conventionTemplate.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('conventionTemplates:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('conventionTemplates:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const template = await db.conventionTemplate.findUnique({ where: { id } });
      if (!template || template.deletedAt) return { success: false, error: 'Modèle introuvable' };
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('conventionTemplates:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = templateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      // Un seul modèle par défaut par type de convention
      if (d.isDefault) {
        await db.conventionTemplate.updateMany({
          where: { type: d.type, deletedAt: null },
          data: { isDefault: false },
        });
      }
      const template = await db.conventionTemplate.create({ data: d });
      logger.info(`ConventionTemplate created: ${template.name}`);
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('conventionTemplates:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = templateSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      if (d.isDefault && d.type) {
        await db.conventionTemplate.updateMany({
          where: { type: d.type, deletedAt: null, id: { not: id } },
          data: { isDefault: false },
        });
      }
      const template = await db.conventionTemplate.update({ where: { id }, data: d });
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('conventionTemplates:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      await db.conventionTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
