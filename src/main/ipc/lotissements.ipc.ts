import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const lotissementSchema = z.object({
  nom: z.string().min(1),
  commune: z.string().optional(),
  quartier: z.string().optional(),
  ville: z.string().min(1),
  pays: z.string().default('CI'),
  surface: z.coerce.number().positive().optional(),
  nombreParcelles: z.coerce.number().int().positive().optional(),
  promoteur: z.string().optional(),
  statut: z.enum(['EN_COURS_LOTISSEMENT', 'EN_COURS', 'OUVERT', 'PARTIELLEMENT_VENDU', 'COMPLET', 'FERME']).default('EN_COURS_LOTISSEMENT'),
  description: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  // Montant standard des frais de démarches ACD applicable sur ce lotissement.
  fraisDemarchesAcdStandard: z.coerce.number().nonnegative().optional().nullable(),
});

// Module Lotissements : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES  = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Génère la prochaine référence LOT-YYYY-NNNN.
 */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.lotissement.findFirst({
    where: { reference: { startsWith: `LOT-${year}-` } },
    orderBy: { reference: 'desc' },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `LOT-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Enregistre les handlers IPC pour la gestion des lotissements.
 */
export function registerLotissementsIPC(): void {
  ipcMain.handle('lotissements:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.statut) where.statut = filters.statut;
      if (filters.ville) where.ville = { contains: filters.ville };
      if (filters.search) {
        where.OR = [
          { nom: { contains: filters.search } },
          { reference: { contains: filters.search } },
          { commune: { contains: filters.search } },
          { quartier: { contains: filters.search } },
          { promoteur: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.lotissement.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { terrains: true } } },
        }),
        db.lotissement.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('lotissements:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lotissements:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const lot = await db.lotissement.findUnique({
        where: { id, deletedAt: null },
        include: {
          terrains: {
            where: { deletedAt: null },
            select: {
              id: true, reference: true, numeroParcelle: true, numeroIlot: true,
              statut: true, surface: true, prixVente: true, viabilise: true,
            },
            orderBy: { reference: 'asc' },
          },
          documents: { orderBy: { uploadedAt: 'desc' } },
        },
      });
      if (!lot) return { success: false, error: 'Lotissement introuvable' };
      return ser({ success: true, data: lot });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lotissements:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = lotissementSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db);
      const lot = await db.lotissement.create({ data: { ...parsed.data, reference } });
      logger.info(`Lotissement créé: ${lot.reference}`);
      return ser({ success: true, data: lot });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lotissements:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = lotissementSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const lot = await db.lotissement.update({ where: { id, deletedAt: null }, data: parsed.data });
      return ser({ success: true, data: lot });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lotissements:statusStats', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.ville) where.ville = { contains: filters.ville };
      if (filters.search) {
        where.OR = [
          { nom: { contains: filters.search } },
          { reference: { contains: filters.search } },
          { commune: { contains: filters.search } },
          { quartier: { contains: filters.search } },
          { promoteur: { contains: filters.search } },
        ];
      }
      const rows = await db.lotissement.groupBy({
        by: ['statut'],
        where,
        _count: { _all: true },
      });
      const stats: Record<string, number> = {
        EN_COURS_LOTISSEMENT: 0, EN_COURS: 0, OUVERT: 0,
        PARTIELLEMENT_VENDU: 0, COMPLET: 0, FERME: 0,
      };
      let total = 0;
      for (const r of rows) {
        const n = r._count?._all ?? 0;
        stats[r.statut as string] = n;
        total += n;
      }
      return { success: true, data: { ...stats, total } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lotissements:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const db = getDb();
      await db.lotissement.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
