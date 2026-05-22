import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const programmeSchema = z.object({
  nom: z.string().min(1),
  type: z.enum(['RESIDENTIEL', 'COMMERCIAL', 'MIXTE']).default('RESIDENTIEL'),
  promoteur: z.string().optional(),
  commune: z.string().optional(),
  quartier: z.string().optional(),
  ville: z.string().min(1),
  pays: z.string().default('CI'),
  surface: z.coerce.number().positive().optional(),
  nombreLogements: z.coerce.number().int().positive().optional(),
  dateDebut: z.coerce.date().optional(),
  dateLivraisonPrevue: z.coerce.date().optional(),
  statut: z
    .enum(['EN_PROJET', 'EN_CONSTRUCTION', 'EN_COMMERCIALISATION', 'LIVRE', 'CLOTURE'])
    .default('EN_PROJET'),
  description: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

// Module Programmes immobiliers : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES  = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Sérialise pour l'IPC : les Decimal/Date Prisma ne sont pas clonables par Electron. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Génère la prochaine référence de programme : PROG-YYYY-NNNN.
 */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.programmeImmobilier.findFirst({
    where: { reference: { startsWith: `PROG-${year}-` } },
    orderBy: { reference: 'desc' },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `PROG-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Enregistre les handlers IPC pour la gestion des programmes immobiliers.
 */
export function registerProgrammesIPC(): void {
  ipcMain.handle('programmes:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.statut) where.statut = filters.statut;
      if (filters.type) where.type = filters.type;
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
        db.programmeImmobilier.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                properties: { where: { deletedAt: null } },
                terrains: { where: { deletedAt: null } },
              },
            },
          },
        }),
        db.programmeImmobilier.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('programmes:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('programmes:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const programme = await db.programmeImmobilier.findUnique({
        where: { id, deletedAt: null },
        include: {
          properties: {
            where: { deletedAt: null },
            select: {
              id: true, reference: true, type: true, status: true,
              city: true, surface: true, rentPrice: true, salePrice: true,
            },
            orderBy: { reference: 'asc' },
          },
          terrains: {
            where: { deletedAt: null },
            select: {
              id: true, reference: true, numeroParcelle: true, numeroIlot: true,
              statut: true, surface: true, prixVente: true,
            },
            orderBy: { reference: 'asc' },
          },
          documents: { orderBy: { uploadedAt: 'desc' } },
        },
      });
      if (!programme) return { success: false, error: 'Programme immobilier introuvable' };
      return ser({ success: true, data: programme });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('programmes:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = programmeSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db);
      const programme = await db.programmeImmobilier.create({ data: { ...parsed.data, reference } });
      logger.info(`Programme immobilier créé: ${programme.reference}`);
      return ser({ success: true, data: programme });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('programmes:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = programmeSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const programme = await db.programmeImmobilier.update({
        where: { id, deletedAt: null },
        data: parsed.data,
      });
      return ser({ success: true, data: programme });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('programmes:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const db = getDb();
      await db.programmeImmobilier.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
