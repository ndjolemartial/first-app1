import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Module Gestion des appels (entrants / sortants).
 *
 * Accès réservé à SUPER_ADMIN, ADMIN, MANAGER, ASSISTANTE_DIRECTION et
 * ACCOUNTANT (Comptable). Vue complète (tous les appels) réservée à
 * SUPER_ADMIN, ADMIN et MANAGER ; ASSISTANTE_DIRECTION et ACCOUNTANT ne
 * voient que les appels qu'ils ont eux-mêmes enregistrés.
 */

const CALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Contrôle de rôle EXACT pour le module appels (sans les équivalences de `checkRole`). */
function checkCallRole(session: { role: string }, allowed: string[]): void {
  if (!allowed.includes(session.role)) throw new Error('Permission insuffisante');
}

function hasFullView(role: string): boolean {
  return FULL_VIEW_ROLES.includes(role);
}

/** Fragment `where` limitant les appels à ceux enregistrés par l'utilisateur (rôles restreints). */
function buildVisibilityWhere(session: { userId: number; role: string }): Record<string, unknown> {
  return hasFullView(session.role) ? {} : { createdById: session.userId };
}

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v);

const callBaseSchema = z.object({
  direction: z.enum(['ENTRANT', 'SORTANT']),
  ligne: z.preprocess(emptyToUndef, z.string().optional()),
  firstName: z.preprocess(emptyToUndef, z.string().optional()),
  lastName: z.preprocess(emptyToUndef, z.string().optional()),
  company: z.preprocess(emptyToUndef, z.string().optional()),
  phone: z.string().min(1, 'Numéro de téléphone requis'),
  email: z.preprocess(emptyToUndef, z.string().email('Email invalide').optional()),
  objet: z.string().min(1, "Objet de l'appel requis"),
  details: z.preprocess(emptyToUndef, z.string().optional()),
  duration: z.preprocess(emptyToUndef, z.coerce.number().int().min(0).optional()),
  status: z.enum(['ABOUTI', 'MANQUE', 'OCCUPE', 'MESSAGE_LAISSE']).default('ABOUTI'),
  calledAt: z.preprocess(emptyToUndef, z.coerce.date().optional()),
  clientId: z.preprocess(emptyToUndef, z.coerce.number().int().positive().optional()),
  prospectId: z.preprocess(emptyToUndef, z.coerce.number().int().positive().optional()),
});

/** Un appel ne peut être rattaché à la fois à un client ET à un prospect. */
const mutuallyExclusive = (data: { clientId?: number; prospectId?: number }, ctx: z.RefinementCtx): void => {
  if (data.clientId != null && data.prospectId != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['prospectId'],
      message: 'Un appel ne peut pas être rattaché à la fois à un client et à un prospect.',
    });
  }
};

const callSchema = callBaseSchema.superRefine(mutuallyExclusive);
const callUpdateSchema = callBaseSchema.partial().superRefine(mutuallyExclusive);

const USER_BRIEF_SELECT = { id: true, firstName: true, lastName: true } as const;

export function registerCallsIPC(): void {
  ipcMain.handle('calls:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null, ...buildVisibilityWhere(session) };
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { company: { contains: filters.search } },
          { objet: { contains: filters.search } },
          { phone: { contains: filters.search } },
          { email: { contains: filters.search } },
        ];
      }
      if (filters.direction) where.direction = filters.direction;
      if (filters.status) where.status = filters.status;
      if (filters.dateFrom || filters.dateTo) {
        where.calledAt = {};
        if (filters.dateFrom) where.calledAt.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.calledAt.lte = new Date(filters.dateTo);
      }
      const [data, total] = await db.$transaction([
        db.phoneCall.findMany({
          where,
          include: {
            createdBy: { select: USER_BRIEF_SELECT },
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
            prospect: { select: { id: true, firstName: true, lastName: true } },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { calledAt: 'desc' },
        }),
        db.phoneCall.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('calls:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calls:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const db = getDb();
      const call = await db.phoneCall.findFirst({
        where: { id, deletedAt: null, ...buildVisibilityWhere(session) },
        include: {
          createdBy: { select: USER_BRIEF_SELECT },
          client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
          prospect: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      if (!call) return { success: false, error: 'Appel introuvable' };
      return ser({ success: true, data: call });
    } catch (error: any) {
      logger.error('calls:getById error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calls:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const parsed = callSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const db = getDb();
      const call = await db.phoneCall.create({
        data: { ...parsed.data, createdById: session.userId },
      });
      logger.info(`Appel enregistré : id=${call.id}`);
      return ser({ success: true, data: call });
    } catch (error: any) {
      logger.error('calls:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calls:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const db = getDb();
      const existing = await db.phoneCall.findFirst({ where: { id, deletedAt: null, ...buildVisibilityWhere(session) }, select: { id: true } });
      if (!existing) return { success: false, error: 'Appel introuvable' };
      const parsed = callUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const call = await db.phoneCall.update({ where: { id }, data: parsed.data });
      return ser({ success: true, data: call });
    } catch (error: any) {
      logger.error('calls:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calls:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // Suppression réservée à SUPER_ADMIN/ADMIN/MANAGER — les autres rôles
      // autorisés sur le module (ACCOUNTANT, ASSISTANTE_DIRECTION) ne peuvent
      // que consulter/créer/modifier.
      checkCallRole(session, FULL_VIEW_ROLES);
      const db = getDb();
      const existing = await db.phoneCall.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!existing) return { success: false, error: 'Appel introuvable' };
      await db.phoneCall.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Appel archivé (soft delete) : id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('calls:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calls:stats', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const db = getDb();
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const scope = buildVisibilityWhere(session);
      const [total, today, month, entrant, sortant] = await db.$transaction([
        db.phoneCall.count({ where: { deletedAt: null, ...scope } }),
        db.phoneCall.count({ where: { deletedAt: null, calledAt: { gte: startOfDay }, ...scope } }),
        db.phoneCall.count({ where: { deletedAt: null, calledAt: { gte: startOfMonth }, ...scope } }),
        db.phoneCall.count({ where: { deletedAt: null, direction: 'ENTRANT', ...scope } }),
        db.phoneCall.count({ where: { deletedAt: null, direction: 'SORTANT', ...scope } }),
      ]);
      return { success: true, data: { total, today, month, entrant, sortant } };
    } catch (error: any) {
      logger.error('calls:stats error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Recherche client / prospect pour le rattachement (« Client concerné » /
  // « Prospect concerné ») ────────────────────────────────────────────────────
  // Volontairement NON filtrée par affectation (assignedToId) : quel que soit
  // le rôle connecté, la recherche porte sur l'ensemble des clients/prospects
  // — l'appel est un simple rattachement de contexte, pas une action de suivi
  // commercial nécessitant le périmètre habituel de visibilité.

  ipcMain.handle('calls:searchClients', async (_event, { token, search = '' }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (search) {
        where.OR = [
          { reference: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { entreprise: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ];
      }
      const data = await db.client.findMany({
        where,
        select: { id: true, reference: true, firstName: true, lastName: true, entreprise: true, type: true },
        orderBy: { createdAt: 'desc' },
        take: 15,
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('calls:searchClients error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calls:searchProspects', async (_event, { token, search = '' }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (search) {
        where.OR = [
          { reference: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ];
      }
      const data = await db.prospect.findMany({
        where,
        select: { id: true, reference: true, firstName: true, lastName: true },
        orderBy: { createdAt: 'desc' },
        take: 15,
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('calls:searchProspects error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Lignes téléphoniques (référentiel du champ « Ligne téléphonique ») ────

  const phoneLineSchema = z.object({
    label: z.string().min(1, 'Libellé requis'),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('calls:phoneLines:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await db.phoneLine.findMany({ where, orderBy: { label: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('calls:phoneLines:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calls:phoneLines:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const parsed = phoneLineSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const db = getDb();
      const label = parsed.data.label.trim();
      // Réactive une ligne homonyme précédemment supprimée plutôt que d'échouer sur l'unicité.
      const existing = await db.phoneLine.findUnique({ where: { label } });
      if (existing) {
        const data = await db.phoneLine.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
        return ser({ success: true, data });
      }
      const data = await db.phoneLine.create({ data: { label, isActive: parsed.data.isActive ?? true } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('calls:phoneLines:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calls:phoneLines:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const parsed = phoneLineSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const db = getDb();
      const data: any = { ...parsed.data };
      if (typeof data.label === 'string') data.label = data.label.trim();
      const updated = await db.phoneLine.update({ where: { id }, data });
      return ser({ success: true, data: updated });
    } catch (error: any) {
      logger.error('calls:phoneLines:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('calls:phoneLines:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkCallRole(session, CALL_ROLES);
      const db = getDb();
      await db.phoneLine.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('calls:phoneLines:delete error', error.message);
      return { success: false, error: error.message };
    }
  });
}
