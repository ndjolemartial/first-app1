import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

// ── Schéma ───────────────────────────────────────────────────────────────────

const clientSchema = z.object({
  type: z.enum(['INDIVIDUEL', 'ENTREPRISE']).default('INDIVIDUEL'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  civilite: z.enum(['MONSIEUR', 'MADAME', 'MADEMOISELLE']).optional(),
  statutConjugal: z.enum(['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE']).optional(),
  entreprise: z.string().optional(),
  registre_de_commerce: z.string().optional(),
  compte_contribuable: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('CI'),
  nationality: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  birthPlace: z.string().optional(),
  idNumber: z.string().optional(),
  fatherFirstName: z.string().optional(),
  fatherLastName: z.string().optional(),
  motherFirstName: z.string().optional(),
  motherLastName: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['ACTIF', 'INACTIF', 'VIP', 'SUSPENDU']).optional(),
  assignedToId: z.number().int().nullable().optional(),
  referrerId: z.number().int().nullable().optional(),
});

// ── Rôles ────────────────────────────────────────────────────────────────────

/** Création / modification / changement d'affectation : MANAGER, ADMIN, SUPER_ADMIN
 *  (ACCOUNTANT hérite des droits MANAGER via checkRole). */
const WRITE_ROLES  = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES   = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
const ASSIGN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Rôles disposant d'une vue globale sur tous les clients (pas de filtrage). */
// Exception à l'équivalence ACCOUNTANT/MANAGER : ASSISTANTE_DIRECTION dispose
// uniquement des droits d'un AGENT sur le module Clients (lecture filtrée,
// pas d'écriture ni d'affectation).
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

function hasFullView(role: string): boolean {
  return FULL_VIEW_ROLES.includes(role);
}

/**
 * Vérifie le rôle pour les écritures et l'affectation sur les clients.
 *
 * ASSISTANTE_DIRECTION est explicitement exclu (réduit au niveau AGENT sur ce
 * module) malgré l'équivalence MANAGER appliquée par checkRole.
 */
function checkClientWriteRole(session: { role: string }, allowedRoles: string[]): void {
  if (session.role === 'ASSISTANTE_DIRECTION') {
    throw new Error('Permission insuffisante');
  }
  checkRole(session as any, allowedRoles);
}

/**
 * Filtre de visibilité appliqué aux requêtes clients :
 *   — un MANAGER / ADMIN / SUPER_ADMIN / ACCOUNTANT voit tout ;
 *   — les autres rôles ne voient que les clients qui leur sont affectés
 *     (`assignedToId`) ou ceux issus d'un prospect qui leur était affecté
 *     (`prospect.assignedToId === userId`).
 */
function buildVisibilityWhere(session: { userId: number; role: string }): any {
  if (hasFullView(session.role)) return {};
  return {
    OR: [
      { assignedToId: session.userId },
      { prospect: { is: { assignedToId: session.userId } } },
    ],
  };
}

// Sélection légère pour les relations utilisateur / apporteur incluses.
const USER_BRIEF_SELECT = {
  id: true, firstName: true, lastName: true, email: true, role: true,
} as const;

const REFERRER_BRIEF_SELECT = {
  id: true, firstName: true, lastName: true, companyName: true, email: true,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convertit les chaînes vides en undefined pour éviter les échecs Zod sur les enums. */
function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === '' ? undefined : v])
  );
}

/** Sérialise les objets Prisma (notamment Decimal) pour le canal IPC. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Enregistre les handlers IPC pour la gestion des clients.
 */
export function registerClientsIPC(): void {
  // ── Liste ──────────────────────────────────────────────────────────────────
  ipcMain.handle('clients:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();

      const visibility = buildVisibilityWhere(session);
      const where: any = { deletedAt: null, ...visibility };

      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.assignedToId !== undefined) {
        where.assignedToId = filters.assignedToId === null ? null : Number(filters.assignedToId);
      }
      if (filters.referrerId !== undefined) {
        where.referrerId = filters.referrerId === null ? null : Number(filters.referrerId);
      }
      if (filters.search) {
        const orSearch = [
          { firstName: { contains: filters.search } },
          { lastName:  { contains: filters.search } },
          { entreprise:{ contains: filters.search } },
          { email:     { contains: filters.search } },
          { phone:     { contains: filters.search } },
        ];
        // Combine la visibilité (où il y a déjà un OR) avec la recherche via AND.
        if (visibility.OR) {
          where.AND = [{ OR: visibility.OR }, { OR: orSearch }];
          delete where.OR;
        } else {
          where.OR = orSearch;
        }
      }

      const [data, total] = await db.$transaction([
        db.client.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count:     { select: { conventions: true } },
            assignedTo: { select: USER_BRIEF_SELECT },
            referrer:   { select: REFERRER_BRIEF_SELECT },
          },
        }),
        db.client.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('clients:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Détail ─────────────────────────────────────────────────────────────────
  ipcMain.handle('clients:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const client = await db.client.findUnique({
        where: { id, deletedAt: null },
        include: {
          conventions: {
            where: { deletedAt: null },
            include: {
              properties: {
                orderBy: { order: 'asc' },
                include: { property: { select: { reference: true, address: true, city: true } } },
              },
              terrains: {
                orderBy: { order: 'asc' },
                include: { terrain: { select: { reference: true, numeroIlot: true, numeroParcelle: true } } },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          documents: { orderBy: { uploadedAt: 'desc' } },
          activities: { orderBy: { createdAt: 'desc' }, take: 20 },
          invoices: { where: { deletedAt: null }, orderBy: { issueDate: 'desc' }, take: 10 },
          prospect: { select: { id: true, status: true, assignedToId: true } },
          assignedTo: { select: USER_BRIEF_SELECT },
          referrer:   { select: REFERRER_BRIEF_SELECT },
        },
      });
      if (!client) return { success: false, error: 'Client introuvable' };

      // Contrôle de visibilité fine pour les rôles restreints.
      if (!hasFullView(session.role)) {
        const visible =
          client.assignedToId === session.userId ||
          client.prospect?.assignedToId === session.userId;
        if (!visible) return { success: false, error: 'Client inaccessible' };
      }

      return { success: true, data: ser(client) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Création ───────────────────────────────────────────────────────────────
  ipcMain.handle('clients:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkClientWriteRole(session, WRITE_ROLES);
      const cleaned = stripEmpty(payload);
      const parsed = clientSchema.safeParse(cleaned);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data: any = { ...parsed.data };
      if (data.birthDate) data.birthDate = new Date(data.birthDate);
      const client = await db.client.create({ data });
      logger.info(`Client created: id=${client.id}`);
      return { success: true, data: client };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Mise à jour ────────────────────────────────────────────────────────────
  ipcMain.handle('clients:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkClientWriteRole(session, WRITE_ROLES);
      const cleaned = stripEmpty(payload);
      const parsed = clientSchema.partial().safeParse(cleaned);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data: any = { ...parsed.data };
      if (data.birthDate) data.birthDate = new Date(data.birthDate);
      const client = await db.client.update({ where: { id, deletedAt: null }, data });
      return { success: true, data: client };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Suppression (soft delete) ──────────────────────────────────────────────
  ipcMain.handle('clients:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkClientWriteRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const db = getDb();
      await db.client.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Toggle actif ───────────────────────────────────────────────────────────
  ipcMain.handle('clients:toggleActive', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkClientWriteRole(session, WRITE_ROLES);
      const db = getDb();
      const client = await db.client.findUnique({ where: { id }, select: { isActive: true } });
      if (!client) return { success: false, error: 'Client introuvable' };
      const updated = await db.client.update({
        where: { id },
        data: { isActive: !client.isActive },
        select: { id: true, isActive: true },
      });
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Changement de statut ───────────────────────────────────────────────────
  ipcMain.handle('clients:updateStatus', async (_event, { token, id, status }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkClientWriteRole(session, WRITE_ROLES);
      const parsed = z.enum(['ACTIF', 'INACTIF', 'VIP', 'SUSPENDU']).safeParse(status);
      if (!parsed.success) return { success: false, error: 'Statut invalide' };
      const db = getDb();
      const updated = await db.client.update({
        where: { id, deletedAt: null },
        data: { status: parsed.data },
        select: { id: true, status: true },
      });
      logger.info(`Client #${id} status updated to ${parsed.data}`);
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Affectation utilisateur ────────────────────────────────────────────────
  /**
   * Affecte ou désaffecte un client à un utilisateur (suivi commercial interne).
   * Réservé aux rôles MANAGER, ADMIN et SUPER_ADMIN (ACCOUNTANT hérite via checkRole).
   * Passer `assignedToId: null` pour désaffecter.
   */
  ipcMain.handle('clients:assign', async (_event, { token, id, assignedToId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkClientWriteRole(session, ASSIGN_ROLES);

      const parsedId = z.number().int().positive().nullable().safeParse(
        assignedToId === null || assignedToId === undefined ? null : Number(assignedToId)
      );
      if (!parsedId.success) return { success: false, error: 'Utilisateur invalide' };

      const db = getDb();

      // Vérifie que l'utilisateur cible existe et est actif (lorsqu'on affecte).
      if (parsedId.data !== null) {
        const user = await db.user.findUnique({
          where: { id: parsedId.data, deletedAt: null },
          select: { id: true, isActive: true },
        });
        if (!user || !user.isActive) {
          return { success: false, error: 'Utilisateur introuvable ou inactif' };
        }
      }

      const client = await db.client.update({
        where: { id, deletedAt: null },
        data: { assignedToId: parsedId.data },
        include: {
          assignedTo: { select: USER_BRIEF_SELECT },
          referrer:   { select: REFERRER_BRIEF_SELECT },
        },
      });
      logger.info(
        parsedId.data === null
          ? `Client #${id} désaffecté`
          : `Client #${id} affecté à l'utilisateur #${parsedId.data}`
      );
      return { success: true, data: client };
    } catch (error: any) {
      logger.error('clients:assign', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Affectation apporteur ──────────────────────────────────────────────────
  /**
   * Affecte ou désaffecte un apporteur d'affaire (BusinessReferrer) à un client.
   * Réservé aux rôles d'affectation. `referrerId: null` pour retirer l'apporteur.
   */
  ipcMain.handle('clients:setReferrer', async (_event, { token, id, referrerId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkClientWriteRole(session, ASSIGN_ROLES);

      const parsedId = z.number().int().positive().nullable().safeParse(
        referrerId === null || referrerId === undefined ? null : Number(referrerId)
      );
      if (!parsedId.success) return { success: false, error: 'Apporteur invalide' };

      const db = getDb();

      if (parsedId.data !== null) {
        const ref = await db.businessReferrer.findUnique({
          where: { id: parsedId.data, deletedAt: null },
          select: { id: true, isActive: true },
        });
        if (!ref || !ref.isActive) {
          return { success: false, error: 'Apporteur introuvable ou inactif' };
        }
      }

      const client = await db.client.update({
        where: { id, deletedAt: null },
        data: { referrerId: parsedId.data },
        include: {
          assignedTo: { select: USER_BRIEF_SELECT },
          referrer:   { select: REFERRER_BRIEF_SELECT },
        },
      });
      logger.info(
        parsedId.data === null
          ? `Client #${id} : apporteur retiré`
          : `Client #${id} : apporteur #${parsedId.data} affecté`
      );
      return { success: true, data: client };
    } catch (error: any) {
      logger.error('clients:setReferrer', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Liste des utilisateurs assignables ─────────────────────────────────────
  /**
   * Liste les utilisateurs actifs candidats à l'affectation d'un client.
   * Réservé aux rôles d'assignation.
   */
  ipcMain.handle('clients:listAssignableUsers', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkClientWriteRole(session, ASSIGN_ROLES);

      const db = getDb();
      const users = await db.user.findMany({
        where:   { deletedAt: null, isActive: true },
        select:  USER_BRIEF_SELECT,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      return { success: true, data: users };
    } catch (error: any) {
      logger.error('clients:listAssignableUsers', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Liste des apporteurs ───────────────────────────────────────────────────
  /**
   * Liste les apporteurs d'affaire actifs candidats au rattachement d'un client.
   * Réservé aux rôles d'assignation.
   */
  ipcMain.handle('clients:listReferrers', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkClientWriteRole(session, ASSIGN_ROLES);

      const db = getDb();
      const referrers = await db.businessReferrer.findMany({
        where:   { deletedAt: null, isActive: true },
        select:  REFERRER_BRIEF_SELECT,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      return { success: true, data: referrers };
    } catch (error: any) {
      logger.error('clients:listReferrers', error.message);
      return { success: false, error: error.message };
    }
  });
}
