import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Catalogue de prestations / produits.
 *
 * Lecture : tous les rôles authentifiés (le catalogue alimente les lignes de
 * devis et de factures). Écriture (gestion du référentiel) : réservée aux
 * administrateurs, MANAGER et ACCOUNTANT (comptable). Liste vérifiée
 * explicitement — sans passer par l'équivalence ASSISTANTE_DIRECTION→MANAGER de
 * `checkRole` — afin d'exclure l'assistante de direction.
 */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const READ_ROLES = [
  ...WRITE_ROLES, 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY',
];

function checkCatalogWrite(session: { role: string }): void {
  if (!WRITE_ROLES.includes(session.role)) {
    throw new Error(
      'Permission insuffisante : seuls les administrateurs, managers et comptables '
      + 'peuvent modifier le catalogue',
    );
  }
}

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const schema = z.object({
  type: z.enum(['PRESTATION', 'PRODUIT']).default('PRESTATION'),
  designation: z.string().min(1, 'Désignation requise'),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  unitPrice: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export function registerCatalogIPC(): void {
  ipcMain.handle('catalog:list', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (!filters.includeInactive) where.isActive = true;
      if (filters.type) where.type = filters.type;
      if (filters.search) {
        where.OR = [
          { designation: { contains: filters.search } },
          { category: { contains: filters.search } },
          { description: { contains: filters.search } },
        ];
      }
      const data = await db.catalogItem.findMany({
        where,
        orderBy: [{ type: 'asc' }, { designation: 'asc' }],
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('catalog:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('catalog:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const item = await db.catalogItem.findUnique({ where: { id: Number(id) } });
      if (!item || item.deletedAt) return { success: false, error: 'Article introuvable' };
      return { success: true, data: ser(item) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('catalog:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCatalogWrite(session);
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();
      const item = await db.catalogItem.create({
        data: {
          type: d.type,
          designation: d.designation,
          description: d.description ?? null,
          category: d.category ?? null,
          unit: d.unit ?? null,
          unitPrice: String(d.unitPrice) as never,
          isActive: d.isActive,
        },
      });
      logger.info(`CatalogItem created: ${item.designation}`);
      return { success: true, data: ser(item) };
    } catch (error: any) {
      logger.error('catalog:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('catalog:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCatalogWrite(session);
      const parsed = schema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const data: any = { ...d };
      if (d.unitPrice !== undefined) data.unitPrice = String(d.unitPrice) as never;
      const db = getDb();
      const item = await db.catalogItem.update({ where: { id: Number(id) }, data });
      return { success: true, data: ser(item) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('catalog:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCatalogWrite(session);
      const db = getDb();
      await db.catalogItem.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
