import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const terrainSchema = z.object({
  lotissementId: z.coerce.number().int().positive('Lotissement requis'),
  programmeId: z.coerce.number().int().positive().optional().nullable(),
  ownerId: z.coerce.number().int().positive().optional().nullable(),
  clientId: z.coerce.number().int().positive().optional().nullable(),
  numeroIlot: z.string().optional(),
  numeroParcelle: z.string().optional(),
  statut: z.enum(['DISPONIBLE', 'RESERVE', 'VENDU', 'SOUS_OPTION']).default('DISPONIBLE'),
  surface: z.coerce.number().positive().optional().nullable(),
  prixVente: z.coerce.number().positive().optional().nullable(),
  viabilise: z.boolean().default(false),
  numeroADU: z.string().optional(),
  numeroAttestationAttribution: z.string().optional(),
  numeroAttestationCession: z.string().optional(),
  numeroDM: z.string().optional(),
  titreFoncier: z.string().optional(),
  numeroACD: z.string().optional(),
  description: z.string().optional(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
});

// Module Terrains : MANAGER+ (ACCOUNTANT inclus via checkRole) ont un accès complet.
// AGENT et READONLY peuvent consulter uniquement les terrains DISPONIBLE (lecture seule).
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES  = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
/** Rôles disposant d'une vue globale (sans filtrage par statut). */
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
function hasFullView(role: string): boolean {
  return FULL_VIEW_ROLES.includes(role);
}

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Génère la prochaine référence TER-YYYY-NNNN.
 */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.terrain.findFirst({
    where: { reference: { startsWith: `TER-${year}-` } },
    orderBy: { reference: 'desc' },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `TER-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Enregistre les handlers IPC pour la gestion des terrains.
 */
export function registerTerrainsIPC(): void {
  ipcMain.handle('terrains:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.lotissementId) where.lotissementId = Number(filters.lotissementId);
      if (filters.programmeId) where.programmeId = Number(filters.programmeId);
      if (filters.statut) where.statut = filters.statut;
      if (filters.viabilise !== undefined) where.viabilise = filters.viabilise;
      if (filters.clientId) where.clientId = Number(filters.clientId);
      // AGENT / READONLY ne voient que les terrains DISPONIBLE (statut imposé).
      if (!hasFullView(session.role)) where.statut = 'DISPONIBLE';
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { numeroParcelle: { contains: filters.search } },
          { numeroIlot: { contains: filters.search } },
          { titreFoncier: { contains: filters.search } },
          { client: { firstName: { contains: filters.search } } },
          { client: { lastName: { contains: filters.search } } },
          { client: { entreprise: { contains: filters.search } } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.terrain.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ lotissementId: 'asc' }, { numeroIlot: 'asc' }, { numeroParcelle: 'asc' }],
          include: {
            lotissement: { select: { id: true, reference: true, nom: true, ville: true } },
            programme: { select: { id: true, reference: true, nom: true } },
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
          },
        }),
        db.terrain.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('terrains:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('terrains:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const terrain = await db.terrain.findUnique({
        where: { id, deletedAt: null },
        include: {
          lotissement: true,
          programme: true,
          owner: true,
          client: true,
          documents: { orderBy: { uploadedAt: 'desc' } },
          photos: { orderBy: { order: 'asc' } },
          activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });
      if (!terrain) return { success: false, error: 'Terrain introuvable' };
      // AGENT / READONLY ne peuvent consulter qu'un terrain DISPONIBLE.
      if (!hasFullView(session.role) && terrain.statut !== 'DISPONIBLE') {
        return { success: false, error: 'Terrain inaccessible' };
      }
      return ser({ success: true, data: terrain });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('terrains:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = terrainSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db);
      const data: any = { ...parsed.data, reference };
      if (data.ownerId === null || data.ownerId === undefined) delete data.ownerId;
      if (data.clientId === null || data.clientId === undefined) delete data.clientId;
      if (data.programmeId === null || data.programmeId === undefined) delete data.programmeId;
      if (data.prixVente === null) delete data.prixVente;
      const terrain = await db.terrain.create({ data });
      logger.info(`Terrain créé: ${terrain.reference}`);
      return ser({ success: true, data: terrain });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('terrains:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = terrainSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data: any = { ...parsed.data };
      const terrain = await db.terrain.update({ where: { id, deletedAt: null }, data });
      return ser({ success: true, data: terrain });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('terrains:updateStatut', async (_event, { token, id, statut }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const terrain = await db.terrain.update({ where: { id }, data: { statut } });
      return ser({ success: true, data: terrain });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('terrains:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const db = getDb();
      await db.terrain.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
