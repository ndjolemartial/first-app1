import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];

const templateSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  header: z.string().optional(),
  headerWidth: z.number().int().min(20).max(100).default(100),
  headerHeight: z.number().int().min(40).max(800).default(140),
  body: z.string().default(''),
  footer: z.string().optional(),
  footerWidth: z.number().int().min(20).max(100).default(100),
  footerHeight: z.number().int().min(40).max(800).default(140),
  footerBgColor: z.preprocess(
    (v) => (v === '' || v === null ? null : v),
    z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/, 'Couleur invalide').nullable().optional(),
  ),
  endOfDocument: z.string().optional(),
  endOfDocumentWidth: z.number().int().min(20).max(100).default(100),
  endOfDocumentHeight: z.number().int().min(40).max(800).default(140),
  endOfDocumentBgColor: z.preprocess(
    (v) => (v === '' || v === null ? null : v),
    z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/, 'Couleur invalide').nullable().optional(),
  ),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

/** Modèles de devis (un seul modèle par défaut). */
export function registerQuoteTemplatesIPC(): void {
  ipcMain.handle('quoteTemplates:list', async (_event, { token, filters = {}, page = 1, limit = 100 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.search) where.name = { contains: filters.search };
      const [data, total] = await db.$transaction([
        db.quoteTemplate.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
        db.quoteTemplate.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('quoteTemplates:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('quoteTemplates:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const template = await db.quoteTemplate.findUnique({ where: { id: Number(id) } });
      if (!template || template.deletedAt) return { success: false, error: 'Modèle introuvable' };
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('quoteTemplates:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = templateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      if (d.isDefault) {
        await db.quoteTemplate.updateMany({ where: { deletedAt: null }, data: { isDefault: false } });
      }
      const template = await db.quoteTemplate.create({ data: d });
      logger.info(`QuoteTemplate created: ${template.name}`);
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('quoteTemplates:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = templateSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      if (d.isDefault) {
        await db.quoteTemplate.updateMany({ where: { deletedAt: null, id: { not: Number(id) } }, data: { isDefault: false } });
      }
      const template = await db.quoteTemplate.update({ where: { id: Number(id) }, data: d });
      return { success: true, data: template };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('quoteTemplates:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      await db.quoteTemplate.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
