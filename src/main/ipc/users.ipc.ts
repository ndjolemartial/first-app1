import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { hashPassword } from '../utils/crypto';
import logger from '../utils/logger';
import { z } from 'zod';

const createUserSchema = z.object({
  matricule: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  login: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY']),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  fonction: z.string().optional(),
  nomCommercial: z.string().optional(),
  idNumber: z.string().optional(),
  civilite: z.enum(['MONSIEUR', 'MADAME', 'MADEMOISELLE']).optional(),
  statutConjugal: z.enum(['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE', 'DIVORCE', 'VEUF']).optional(),
  hireDate: z.string().optional(),
  cnpsNumber: z.string().optional(),
  residence: z.string().optional(),
  // Comptes de trésorerie par défaut (préremplis dans le formulaire d'opération).
  defaultAccountEntreeId: z.number().int().positive().nullable().optional(),
  defaultAccountSortieId: z.number().int().positive().nullable().optional(),
});

const updateUserSchema = createUserSchema
  .omit({ password: true })
  .extend({ isActive: z.boolean().optional() })
  .partial();

/**
 * Traduit une erreur Prisma en message lisible pour l'utilisateur.
 * Cible en particulier les violations de contrainte d'unicité (P2002) sur
 * `email` et `login`, qui surviennent lorsqu'on tente d'attribuer une valeur
 * déjà utilisée par un autre compte.
 */
function friendlyUserError(error: any): string {
  if (error?.code === 'P2002') {
    const target = String(error?.meta?.target ?? '').toLowerCase();
    if (target.includes('email')) return 'Cet email est déjà utilisé par un autre utilisateur.';
    if (target.includes('login')) return "Cet identifiant de connexion (login) est déjà utilisé par un autre utilisateur.";
    return 'Une valeur unique est déjà utilisée par un autre utilisateur.';
  }
  return error?.message ?? 'Erreur inconnue';
}

/**
 * Normalise les champs optionnels à contrainte d'unicité : une chaîne vide
 * doit être stockée comme `null` (et non `''`), sinon l'index unique sur
 * `login` rejetterait un second compte sans login.
 */
function normalizeUniqueFields(data: Record<string, any>): void {
  if (data.login === '') data.login = null;
}

/** Génère la prochaine référence d'utilisateur : USR-YYYY-NNNN. */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.user.findFirst({
    where: { reference: { startsWith: `USR-${year}-` } },
    orderBy: { reference: 'desc' },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `USR-${year}-${String(seq).padStart(4, '0')}`;
}

// Rôles qu'un AGENT_TECHNIQUE est autorisé à créer / modifier.
const AGENT_TECHNIQUE_MANAGED_ROLES = ['AGENT', 'AGENT_TECHNIQUE', 'READONLY'];

/**
 * Contrôle d'accès à la gestion des utilisateurs.
 *  - SUPER_ADMIN / ADMIN : accès complet (renvoie 'full') ;
 *  - AGENT_TECHNIQUE : accès limité aux comptes AGENT / AGENT_TECHNIQUE /
 *    READONLY (renvoie 'limited') ;
 *  - autres rôles : refus.
 */
function userMgmtScope(session: { role: string }): 'full' | 'limited' {
  if (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN') return 'full';
  if (session.role === 'AGENT_TECHNIQUE') return 'limited';
  throw new Error('Permission insuffisante');
}

/**
 * Enregistre les handlers IPC pour la gestion des utilisateurs.
 */
export function registerUsersIPC(): void {
  ipcMain.handle('users:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const scope = userMgmtScope(session);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.role) where.role = filters.role;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      // AGENT_TECHNIQUE : ne voit que les comptes qu'il peut gérer.
      if (scope === 'limited') {
        where.role = (filters.role && AGENT_TECHNIQUE_MANAGED_ROLES.includes(filters.role))
          ? filters.role
          : { in: AGENT_TECHNIQUE_MANAGED_ROLES };
      }
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { email: { contains: filters.search } },
          { matricule: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.user.findMany({
          where,
          select: {
            id: true, uuid: true, reference: true, matricule: true, firstName: true, lastName: true,
            email: true, role: true, isActive: true, avatar: true, phone: true,
            mobile: true, lastLoginAt: true, createdAt: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          // Tri par défaut : plus récents d'abord (liste de gestion). Les champs de
          // sélection/recherche d'utilisateurs demandent un tri par id croissant.
          orderBy: filters.sort === 'idAsc' ? { id: 'asc' } : { createdAt: 'desc' },
        }),
        db.user.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('users:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const scope = userMgmtScope(session);
      const db = getDb();
      const user = await db.user.findUnique({
        where: { id, deletedAt: null },
        select: {
          id: true, uuid: true, reference: true, matricule: true, firstName: true, lastName: true,
          email: true, login: true, role: true, isActive: true, avatar: true, phone: true,
          mobile: true, fonction: true, nomCommercial: true, idNumber: true, civilite: true,
          statutConjugal: true, hireDate: true, cnpsNumber: true, residence: true,
          defaultAccountEntreeId: true, defaultAccountSortieId: true,
          lastLoginAt: true, createdAt: true, updatedAt: true,
          linkedDocuments: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } },
        },
      });
      if (!user) return { success: false, error: 'Utilisateur introuvable' };
      if (scope === 'limited' && !AGENT_TECHNIQUE_MANAGED_ROLES.includes(user.role)) {
        return { success: false, error: 'Utilisateur inaccessible' };
      }
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const scope = userMgmtScope(session);
      const parsed = createUserSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      // AGENT_TECHNIQUE : ne peut créer que des comptes AGENT / AGENT_TECHNIQUE / READONLY.
      if (scope === 'limited' && !AGENT_TECHNIQUE_MANAGED_ROLES.includes(parsed.data.role)) {
        return { success: false, error: 'Vous ne pouvez créer que des utilisateurs Agent, Agent Technique ou Read Only.' };
      }
      const db = getDb();
      const { password, hireDate, ...rest } = parsed.data;
      const data: any = { ...rest };
      normalizeUniqueFields(data);
      const hashed = await hashPassword(password);
      const reference = await nextReference(db);
      const user = await db.user.create({
        data: { ...data, reference, password: hashed, hireDate: hireDate ? new Date(hireDate) : null },
        select: {
          id: true, uuid: true, reference: true, matricule: true, firstName: true, lastName: true,
          email: true, role: true, isActive: true,
        },
      });
      logger.info(`User created: ${user.email}`);
      return { success: true, data: user };
    } catch (error: any) {
      logger.error('users:create error', error.message);
      return { success: false, error: friendlyUserError(error) };
    }
  });

  ipcMain.handle('users:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const scope = userMgmtScope(session);
      const parsed = updateUserSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      // AGENT_TECHNIQUE : le compte cible (rôle actuel) ET le nouveau rôle
      // éventuel doivent appartenir aux rôles gérés.
      if (scope === 'limited') {
        const target = await db.user.findUnique({ where: { id, deletedAt: null }, select: { role: true } });
        if (!target) return { success: false, error: 'Utilisateur introuvable' };
        if (!AGENT_TECHNIQUE_MANAGED_ROLES.includes(target.role)) {
          return { success: false, error: 'Utilisateur inaccessible' };
        }
        if (parsed.data.role && !AGENT_TECHNIQUE_MANAGED_ROLES.includes(parsed.data.role)) {
          return { success: false, error: 'Vous ne pouvez attribuer que les rôles Agent, Agent Technique ou Read Only.' };
        }
      }
      const { hireDate, ...rest } = parsed.data;
      const data: any = { ...rest };
      normalizeUniqueFields(data);
      if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null;
      const user = await db.user.update({
        where: { id, deletedAt: null },
        data,
        select: {
          id: true, uuid: true, firstName: true, lastName: true, email: true,
          role: true, isActive: true,
        },
      });
      return { success: true, data: user };
    } catch (error: any) {
      logger.error('users:update error', error.message);
      return { success: false, error: friendlyUserError(error) };
    }
  });

  ipcMain.handle('users:resetPassword', async (_event, { token, id, newPassword }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const scope = userMgmtScope(session);
      if (!newPassword || newPassword.length < 6)
        return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' };
      const db = getDb();
      if (scope === 'limited') {
        const target = await db.user.findUnique({ where: { id }, select: { role: true } });
        if (!target || !AGENT_TECHNIQUE_MANAGED_ROLES.includes(target.role)) {
          return { success: false, error: 'Utilisateur inaccessible' };
        }
      }
      const hashed = await hashPassword(newPassword);
      await db.user.update({ where: { id }, data: { password: hashed } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:toggleActive', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const scope = userMgmtScope(session);
      const db = getDb();
      const user = await db.user.findUnique({ where: { id }, select: { isActive: true, role: true } });
      if (!user) return { success: false, error: 'Utilisateur introuvable' };
      if (scope === 'limited' && !AGENT_TECHNIQUE_MANAGED_ROLES.includes(user.role)) {
        return { success: false, error: 'Utilisateur inaccessible' };
      }
      const updated = await db.user.update({
        where: { id },
        data: { isActive: !user.isActive },
        select: { id: true, isActive: true },
      });
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Suppression (soft delete) d'un utilisateur — réservée au SUPER_ADMIN.
   *
   * Conformément à la règle soft-delete du projet, l'utilisateur n'est jamais
   * supprimé physiquement (il est référencé par de nombreuses entités :
   * conventions, activités CRM, commissions, documents…). On positionne
   * `deletedAt` et on désactive le compte ; il disparaît alors de toutes les
   * listes (filtrées sur `deletedAt: null`). Un super admin ne peut pas
   * supprimer son propre compte (protection contre le verrouillage).
   */
  ipcMain.handle('users:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN']);

      const targetId = Number(id);
      if (session.userId === targetId) {
        return { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' };
      }

      const db = getDb();
      const target = await db.user.findUnique({
        where: { id: targetId, deletedAt: null },
        select: { id: true, email: true },
      });
      if (!target) return { success: false, error: 'Utilisateur introuvable' };

      await db.user.update({
        where: { id: targetId },
        data: { deletedAt: new Date(), isActive: false },
      });
      logger.info(`User soft-deleted: #${targetId} (${target.email}) by #${session.userId}`);
      return { success: true };
    } catch (error: any) {
      logger.error('users:delete error', error.message);
      return { success: false, error: error.message };
    }
  });
}
