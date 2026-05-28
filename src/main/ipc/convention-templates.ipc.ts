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
  amendmentType: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.enum(['PROLONGATION_DELAI', 'TRANSFERT_PROPRIETE', 'TRANSFERT_SITE']).optional(),
  ),
  souscriptionType: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.enum(['STANDARD', 'AVEC_ACD', 'FINANCEMENT_PROJET']).optional(),
  ),
  // En-tête monobloc — texte et/ou image ; toute image insérée occupe 100 %
  // de la largeur du bloc (CSS du rendu PDF).
  header:       z.string().optional(),
  headerWidth:  z.number().int().min(20).max(100).default(100),
  headerHeight: z.number().int().min(40).max(800).default(140),
  body: z.string().default(''),
  footer: z.string().optional(),
  footerWidth: z.number().int().min(20).max(100).default(100),
  footerHeight: z.number().int().min(40).max(800).default(140),
  // Couleur de fond du footer : `#rrggbb`, `transparent`, ou null/undefined
  // pour conserver la valeur par défaut historique (#dc2626).
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
      const d = { ...parsed.data };
      // Les sous-types ne s'appliquent qu'à leur type respectif
      if (d.type !== 'AVENANT') d.amendmentType = undefined;
      if (d.type !== 'SOUSCRIPTION') d.souscriptionType = undefined;
      // Un seul modèle par défaut par couple (type, sous-type) — un modèle
      // sans sous-type couvre toutes les natures de son type.
      if (d.isDefault) {
        await db.conventionTemplate.updateMany({
          where: {
            type: d.type, deletedAt: null,
            amendmentType: d.amendmentType ?? null,
            souscriptionType: d.souscriptionType ?? null,
          },
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
      const d = { ...parsed.data };
      // Nettoie les sous-types incohérents avec le type de convention
      if (d.type && d.type !== 'AVENANT') d.amendmentType = null as any;
      if (d.type && d.type !== 'SOUSCRIPTION') d.souscriptionType = null as any;
      if (d.isDefault && d.type) {
        await db.conventionTemplate.updateMany({
          where: {
            type: d.type, deletedAt: null, id: { not: id },
            amendmentType: d.amendmentType ?? null,
            souscriptionType: d.souscriptionType ?? null,
          },
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
