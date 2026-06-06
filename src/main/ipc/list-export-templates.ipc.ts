import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

type Db = ReturnType<typeof getDb>;

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/** Sérialise pour l'IPC (les DateTime ne sont pas clonables tels quels). */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Modèle d'export de listes livré par défaut. */
const SEED_TEMPLATE = {
  name: 'Modèle par défaut',
  orientation: 'PAYSAGE',
  accentColor: '#1E3A5F',
  headerHtml: '<p><strong style="font-size:16px">AFRIKIMMO</strong> — Gestion immobilière</p>',
  footerHtml: '<p>Document généré par Afrikimmo-App.</p>',
};

/**
 * S'assure qu'au moins un modèle d'export de listes existe (création unique au
 * premier appel).
 * @returns la liste des modèles, triés par id.
 */
export async function ensureListExportTemplates(db: Db) {
  const count = await db.listExportTemplate.count();
  if (count === 0) {
    await db.listExportTemplate.create({ data: SEED_TEMPLATE as any });
    logger.info('List export template seeded');
  }
  return db.listExportTemplate.findMany({ orderBy: { id: 'asc' } });
}

/**
 * Résout le modèle d'export de listes à appliquer : le premier modèle actif,
 * sinon le premier modèle. Renvoie `null` si aucun (sécurité).
 */
export async function resolveListExportTemplate(db: Db) {
  const templates = await ensureListExportTemplates(db);
  if (templates.length === 0) return null;
  return templates.find((t) => t.isActive) ?? templates[0];
}

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  orientation: z.enum(['PORTRAIT', 'PAYSAGE']).optional(),
  accentColor: z.string().optional(),
  headerHtml: z.string().optional(),
  footerHtml: z.string().optional(),
  endOfDocument: z.string().optional(),
  showLogo: z.boolean().optional(),
  showGeneratedAt: z.boolean().optional(),
  showRowCount: z.boolean().optional(),
});

/**
 * Enregistre les handlers IPC pour les modèles d'export de listes.
 */
export function registerListExportTemplatesIPC(): void {
  ipcMain.handle('listExportTemplates:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const templates = await ensureListExportTemplates(db);
      return ser({ success: true, data: { templates } });
    } catch (error: any) {
      logger.error('listExportTemplates:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('listExportTemplates:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = updateTemplateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const template = await db.listExportTemplate.update({ where: { id }, data: parsed.data });
      logger.info(`List export template updated: id=${id}`);
      return ser({ success: true, data: template });
    } catch (error: any) {
      logger.error('listExportTemplates:update error', error.message);
      return { success: false, error: error.message };
    }
  });
}
