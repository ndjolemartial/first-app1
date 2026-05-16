import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convertit les chaînes vides en undefined pour éviter les échecs Zod sur les enums. */
function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === '' ? undefined : v])
  );
}

/** Rend un prospect sérialisable par Electron (convertit Prisma.Decimal → number). */
function serialize(p: any): any {
  if (!p) return p;
  return { ...p, budget: p.budget != null ? Number(p.budget) : null };
}

// ── Schémas Zod ──────────────────────────────────────────────────────────────

const SOURCES = [
  'SITE_WEB_AFRIKIMMO', 'RECOMMENDATION', 'TELEPHONE', 'RESEAUX_SOCIAUX',
  'EMAIL', 'CONTACT_PERSONNEL', 'AUTRE', 'PROSPECTION',
] as const;

const STATUSES = [
  'NOUVEAU', 'CONTACTE', 'QUALIFIE', 'ENVOI_PROPOSITION',
  'NEGOCIATION_EN_COURS', 'CONVERTI', 'PERDU',
] as const;

const prospectSchema = z.object({
  firstName:   z.string().min(1, 'Prénom requis'),
  lastName:    z.string().min(1, 'Nom requis'),
  email:       z.string().email('Email invalide').optional(),
  phone:       z.string().optional(),
  mobile:      z.string().optional(),
  source:      z.enum(SOURCES).optional().default('PROSPECTION'),
  status:      z.enum(STATUSES).optional().default('NOUVEAU'),
  budget:      z.number().positive().optional(),
  notes:       z.string().optional(),
  assignedToId: z.number().int().optional(),
});

// ── Rôles ────────────────────────────────────────────────────────────────────

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES  = [...WRITE_ROLES, 'READONLY'];

// ── Enregistrement des handlers ───────────────────────────────────────────────

/**
 * Enregistre les handlers IPC pour la gestion des prospects.
 */
export function registerProspectsIPC(): void {

  // ── Liste ──────────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);

      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.status) where.status = filters.status;
      if (filters.source) where.source = filters.source;
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search } },
          { lastName:  { contains: filters.search } },
          { email:     { contains: filters.search } },
          { phone:     { contains: filters.search } },
          { mobile:    { contains: filters.search } },
        ];
      }

      const [data, total] = await db.$transaction([
        db.prospect.findMany({
          where,
          include: { tags: { include: { tag: true } } },
          skip:    (page - 1) * limit,
          take:    limit,
          orderBy: { createdAt: 'desc' },
        }),
        db.prospect.count({ where }),
      ]);

      return { success: true, data: data.map(serialize), total };
    } catch (error: any) {
      logger.error('prospects:list', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Détail ─────────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);

      const db = getDb();
      const prospect = await db.prospect.findUnique({
        where: { id, deletedAt: null },
        include: {
          tags:       { include: { tag: true } },
          activities: { orderBy: { createdAt: 'desc' }, take: 20 },
          client:     true,
        },
      });

      if (!prospect) return { success: false, error: 'Prospect introuvable' };
      return { success: true, data: serialize(prospect) };
    } catch (error: any) {
      logger.error('prospects:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Création ───────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const cleaned = stripEmpty(payload ?? {});
      const parsed  = prospectSchema.safeParse(cleaned);
      if (!parsed.success) {
        logger.warn('prospects:create validation', JSON.stringify(parsed.error.issues));
        return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      }

      const db = getDb();
      const data: any = { ...parsed.data };
      if (data.budget !== undefined) data.budget = String(data.budget);

      const prospect = await db.prospect.create({ data });
      logger.info(`Prospect créé : #${prospect.id} ${prospect.firstName} ${prospect.lastName}`);
      return { success: true, data: serialize(prospect) };
    } catch (error: any) {
      logger.error('prospects:create', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Mise à jour ────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const cleaned = stripEmpty(payload ?? {});
      const parsed  = prospectSchema.partial().safeParse(cleaned);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      }

      const db = getDb();
      const data: any = { ...parsed.data };
      if (data.budget !== undefined) data.budget = String(data.budget);

      const prospect = await db.prospect.update({ where: { id, deletedAt: null }, data });
      logger.info(`Prospect mis à jour : #${id}`);
      return { success: true, data: serialize(prospect) };
    } catch (error: any) {
      logger.error('prospects:update', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Suppression (soft delete) ──────────────────────────────────────────────
  ipcMain.handle('prospects:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);

      const db = getDb();
      await db.prospect.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Prospect supprimé (soft) : #${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('prospects:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Changement de statut ───────────────────────────────────────────────────
  ipcMain.handle('prospects:updateStatus', async (_event, { token, id, status }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const parsed = z.enum(STATUSES).safeParse(status);
      if (!parsed.success) return { success: false, error: 'Statut invalide' };

      const db = getDb();
      const prospect = await db.prospect.update({
        where: { id, deletedAt: null },
        data:  { status: parsed.data },
      });
      return { success: true, data: prospect };
    } catch (error: any) {
      logger.error('prospects:updateStatus', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Conversion en client ───────────────────────────────────────────────────
  ipcMain.handle('prospects:convertToClient', async (_event, { token, id, clientData }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const db = getDb();
      const prospect = await db.prospect.findUnique({ where: { id, deletedAt: null } });
      if (!prospect) return { success: false, error: 'Prospect introuvable' };
      if (prospect.status === 'CONVERTI') return { success: false, error: 'Prospect déjà converti' };

      const result = await db.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            firstName: clientData?.firstName ?? prospect.firstName,
            lastName:  clientData?.lastName  ?? prospect.lastName,
            email:     clientData?.email  ?? prospect.email  ?? undefined,
            phone:     clientData?.phone  ?? prospect.phone  ?? undefined,
            mobile:    clientData?.mobile ?? prospect.mobile ?? undefined,
            type:      clientData?.type   ?? 'INDIVIDUEL',
          },
        });
        const updated = await tx.prospect.update({
          where: { id },
          data:  { status: 'CONVERTI', convertedAt: new Date(), clientId: client.id },
        });
        return { client, prospect: updated };
      });

      logger.info(`Prospect #${id} converti en client #${result.client.id}`);
      return { success: true, data: result };
    } catch (error: any) {
      logger.error('prospects:convertToClient', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Vue Kanban ─────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:kanban', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);

      const db = getDb();
      const prospects = await db.prospect.findMany({
        where:   { deletedAt: null, status: { not: 'CONVERTI' } },
        include: { tags: { include: { tag: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      const columns: Record<string, any[]> = {
        NOUVEAU: [], CONTACTE: [], QUALIFIE: [],
        ENVOI_PROPOSITION: [], NEGOCIATION_EN_COURS: [], PERDU: [],
      };
      for (const p of prospects) {
        if (columns[p.status]) columns[p.status].push(serialize(p));
      }

      return { success: true, data: columns };
    } catch (error: any) {
      logger.error('prospects:kanban', error.message);
      return { success: false, error: error.message };
    }
  });
}
