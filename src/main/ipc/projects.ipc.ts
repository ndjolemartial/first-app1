import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const PROJECT_STATUS = ['EN_PROJET', 'EN_COURS', 'SUSPENDU', 'TERMINE', 'ANNULE'] as const;

const projectSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  typeId: z.coerce.number().int().positive('Type de projet requis'),
  statut: z.enum(PROJECT_STATUS).default('EN_PROJET'),
  clientId: z.coerce.number().int().positive().optional().nullable(),
  ownerId: z.coerce.number().int().positive().optional().nullable(),
  terrainId: z.coerce.number().int().positive().optional().nullable(),
  lotissementId: z.coerce.number().int().positive().optional().nullable(),
  programmeId: z.coerce.number().int().positive().optional().nullable(),
  adresse: z.string().optional().nullable(),
  commune: z.string().optional().nullable(),
  quartier: z.string().optional().nullable(),
  ville: z.string().optional().nullable(),
  pays: z.string().optional(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  dateDebutPrevu: z.coerce.date().optional().nullable(),
  dateDebutReel: z.coerce.date().optional().nullable(),
  dateFinPrevue: z.coerce.date().optional().nullable(),
  dateFinReelle: z.coerce.date().optional().nullable(),
  avancement: z.coerce.number().int().min(0).max(100).default(0),
  budgetPrevu: z.coerce.number().nonnegative().optional().nullable(),
  budgetRealise: z.coerce.number().nonnegative().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const projectTypeSchema = z.object({
  code: z.string().min(1, 'Code requis').regex(/^[A-Z0-9_]+$/, 'Format CODE_EN_MAJUSCULES'),
  label: z.string().min(1, 'Libellé requis'),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Module Projets : mêmes règles que Programmes (MANAGER+, ACCOUNTANT inclus
// via checkRole). Les types de projets sont gérés par ADMIN/SUPER_ADMIN
// depuis l'écran Paramètres.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const TYPES_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/** Sérialise pour l'IPC : les Decimal/Date Prisma ne sont pas clonables par Electron. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Génère la prochaine référence de projet : PROJ-YYYY-NNNN. */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.project.findFirst({
    where: { reference: { startsWith: `PROJ-${year}-` } },
    orderBy: { reference: 'desc' },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `PROJ-${year}-${String(seq).padStart(4, '0')}`;
}

/** Convertit les chaînes vides / undefined en null pour les colonnes nullable. */
function normalizePayload(input: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = v === '' || v === undefined ? null : v;
  }
  return out;
}

export function registerProjectsIPC(): void {
  // ── PROJETS ─────────────────────────────────────────────────────

  ipcMain.handle('projects:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.statut) where.statut = filters.statut;
      if (filters.typeId) where.typeId = Number(filters.typeId);
      if (filters.clientId) where.clientId = Number(filters.clientId);
      if (filters.ownerId) where.ownerId = Number(filters.ownerId);
      if (filters.terrainId) where.terrainId = Number(filters.terrainId);
      if (filters.lotissementId) where.lotissementId = Number(filters.lotissementId);
      if (filters.programmeId) where.programmeId = Number(filters.programmeId);
      if (filters.ville) where.ville = { contains: filters.ville };
      if (filters.search) {
        where.OR = [
          { nom: { contains: filters.search } },
          { reference: { contains: filters.search } },
          { commune: { contains: filters.search } },
          { quartier: { contains: filters.search } },
          { adresse: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.project.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            type: { select: { id: true, code: true, label: true, color: true } },
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true } },
            owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
            terrain: { select: { id: true, reference: true } },
            lotissement: { select: { id: true, reference: true, nom: true } },
            programme: { select: { id: true, reference: true, nom: true } },
          },
        }),
        db.project.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('projects:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('projects:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const project = await db.project.findUnique({
        where: { id, deletedAt: null },
        include: {
          type: true,
          client: { select: { id: true, firstName: true, lastName: true, entreprise: true, phone: true, email: true } },
          owner: { select: { id: true, firstName: true, lastName: true, companyName: true, phone: true, email: true } },
          terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } },
          lotissement: { select: { id: true, reference: true, nom: true } },
          programme: { select: { id: true, reference: true, nom: true } },
          photos: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
          documents: { orderBy: { uploadedAt: 'desc' } },
        },
      });
      if (!project) return { success: false, error: 'Projet introuvable' };
      return ser({ success: true, data: project });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('projects:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = projectSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db);
      const project = await db.project.create({
        data: { ...normalizePayload(parsed.data), reference },
      });
      logger.info(`Projet créé: ${project.reference}`);
      return ser({ success: true, data: project });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('projects:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = projectSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const project = await db.project.update({
        where: { id, deletedAt: null },
        data: normalizePayload(parsed.data),
      });
      return ser({ success: true, data: project });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('projects:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      await db.project.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('projects:statusStats', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.typeId) where.typeId = Number(filters.typeId);
      if (filters.ville) where.ville = { contains: filters.ville };
      if (filters.search) {
        where.OR = [
          { nom: { contains: filters.search } },
          { reference: { contains: filters.search } },
          { commune: { contains: filters.search } },
          { quartier: { contains: filters.search } },
          { adresse: { contains: filters.search } },
        ];
      }
      const rows = await db.project.groupBy({
        by: ['statut'],
        where,
        _count: { _all: true },
      });
      const stats: Record<string, number> = {
        EN_PROJET: 0, EN_COURS: 0, SUSPENDU: 0, TERMINE: 0, ANNULE: 0,
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

  // ── TYPES DE PROJETS ────────────────────────────────────────────

  ipcMain.handle('projects:listTypes', async (_event, { token, includeInactive = false }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // Lecture ouverte aux mêmes rôles que les projets (utilisée pour les selects).
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const types = await db.projectType.findMany({
        where,
        orderBy: { label: 'asc' },
        include: { _count: { select: { projects: { where: { deletedAt: null } } } } },
      });
      return ser({ success: true, data: types });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('projects:createType', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, TYPES_WRITE_ROLES);
      const parsed = projectTypeSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const type = await db.projectType.create({ data: parsed.data });
      logger.info(`Type de projet créé: ${type.code}`);
      return ser({ success: true, data: type });
    } catch (error: any) {
      // Erreur d'unicité (code déjà utilisé)
      if (error.code === 'P2002') return { success: false, error: 'Ce code est déjà utilisé' };
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('projects:updateType', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, TYPES_WRITE_ROLES);
      const parsed = projectTypeSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const type = await db.projectType.update({ where: { id, deletedAt: null }, data: parsed.data });
      return ser({ success: true, data: type });
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, error: 'Ce code est déjà utilisé' };
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('projects:deleteType', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, TYPES_WRITE_ROLES);
      const db = getDb();
      // Bloque la suppression si des projets actifs utilisent ce type.
      const count = await db.project.count({ where: { typeId: id, deletedAt: null } });
      if (count > 0) {
        return {
          success: false,
          error: `Impossible de supprimer ce type : ${count} projet(s) y sont rattaché(s). Désactivez-le plutôt.`,
        };
      }
      await db.projectType.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
