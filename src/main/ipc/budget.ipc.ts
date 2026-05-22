import { ipcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import {
  BUDGET_FULL_ACCESS_ROLES,
  FORBIDDEN_MANAGER_ROLES,
  buildClosingSnapshot,
  canOperateOnLine,
  computeBudgetSummary,
  computeLineEvolutions,
  nextBudgetRef,
} from '../services/budget.service';
import logger from '../utils/logger';

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'];
// Administration du module budget (création/modification/clôture/suppression de budgets
// et lignes) : réservée aux administrateurs. Les gestionnaires non-admin n'ont qu'un
// accès en lecture aux lignes qui leur sont allouées.
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Vérifie le rôle pour l'accès au module Budget.
 *
 * Exception à l'équivalence ACCOUNTANT/MANAGER : ASSISTANTE_DIRECTION, qui
 * hérite normalement des permissions MANAGER, n'a pas accès au module
 * Budget (décision produit).
 */
function checkBudgetRole(session: { role: string }, allowedRoles: string[]): void {
  if (session.role === 'ASSISTANTE_DIRECTION') {
    throw new Error('Permission insuffisante');
  }
  checkRole(session as any, allowedRoles);
}

/** Sérialise pour l'IPC (les Decimal Prisma ne sont pas clonables par Electron). */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const managerSelect = {
  select: { id: true, firstName: true, lastName: true, role: true, matricule: true },
} as const;

/** Indique si la session dispose d'un accès complet au module (admin/super-admin). */
function isAdminSession(session: { role: string }): boolean {
  return (BUDGET_FULL_ACCESS_ROLES as readonly string[]).includes(session.role);
}

/* ─── Schémas Zod ──────────────────────────────────────────────────── */

const budgetSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  periodStart: z.string().datetime().or(z.string().min(8)),
  periodEnd: z.string().datetime().or(z.string().min(8)),
  totalAllocated: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const lineSchema = z.object({
  budgetId: z.number().int().positive(),
  code: z.string().optional(),
  label: z.string().min(1, 'Libellé requis'),
  description: z.string().optional(),
  allocatedAmount: z.number().nonnegative(),
  managerId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

/** Vérifie qu'un utilisateur peut être désigné gestionnaire d'une ligne. */
async function assertCanBeManager(db: ReturnType<typeof getDb>, userId: number): Promise<void> {
  const user = await db.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new Error('Utilisateur gestionnaire introuvable');
  if ((FORBIDDEN_MANAGER_ROLES as readonly string[]).includes(user.role)) {
    throw new Error('Un administrateur ne peut pas être désigné gestionnaire de ligne budgétaire');
  }
  if (!user.isActive) throw new Error("L'utilisateur gestionnaire est désactivé");
}

/**
 * Enregistre les handlers IPC du module de gestion budgétaire.
 */
export function registerBudgetIPC(): void {

  /* ─── Tableau de bord budgétaire ─────────────────────────────────── */

  ipcMain.handle('budget:getDashboard', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, READ_ROLES);
      const db = getDb();
      const admin = isAdminSession(session);

      // Lignes visibles : toutes pour les admins, uniquement les siennes sinon.
      const lineWhere: any = { deletedAt: null };
      if (!admin) lineWhere.managerId = session.userId;

      const lines = await db.budgetLine.findMany({
        where: lineWhere,
        include: {
          manager: managerSelect,
          budget: { select: { id: true, reference: true, name: true, status: true } },
        },
        orderBy: [{ isActive: 'desc' }, { label: 'asc' }],
      });
      const evolutions = await computeLineEvolutions(db, lines.map((l) => l.id));
      const linesWithStats = lines.map((l) => ({
        ...l,
        ...(evolutions.get(l.id) ?? {
          spent: 0,
          remaining: Number(l.allocatedAmount),
          consumptionRate: 0,
          operationsCount: 0,
        }),
      }));

      // Budgets : visibles uniquement par les administrateurs.
      let budgetsWithStats: any[] = [];
      let budgetsCount = 0;
      let openBudgets = 0;
      let closedBudgets = 0;
      if (admin) {
        const budgets = await db.budget.findMany({
          where: { deletedAt: null },
          orderBy: [{ status: 'asc' }, { periodStart: 'desc' }],
          include: { lines: { where: { deletedAt: null } } },
        });
        budgetsWithStats = budgets.map((b) => {
          let allocated = 0;
          let spent = 0;
          for (const l of b.lines) {
            allocated += Number(l.allocatedAmount);
            const ev = evolutions.get(l.id);
            if (ev) spent += ev.spent;
          }
          return {
            ...b,
            totalLines: b.lines.length,
            activeLines: b.lines.filter((l) => l.isActive).length,
            totalAllocated: allocated,
            totalSpent: spent,
            totalRemaining: allocated - spent,
            consumptionRate: allocated > 0 ? spent / allocated : 0,
          };
        });
        budgetsCount = budgets.length;
        openBudgets = budgets.filter((b) => b.status === 'OUVERT').length;
        closedBudgets = budgets.filter((b) => b.status === 'CLOTURE').length;
      }

      // Totaux : calculés sur les lignes visibles (toutes pour admin, siennes pour non-admin).
      const totalAllocated = linesWithStats.reduce((s, l) => s + Number(l.allocatedAmount), 0);
      const totalSpent = linesWithStats.reduce((s, l) => s + (l.spent ?? 0), 0);

      return ser({
        success: true,
        data: {
          budgets: budgetsWithStats,
          lines: linesWithStats,
          stats: {
            budgetsCount,
            openBudgets,
            closedBudgets,
            linesCount: lines.length,
            activeLines: lines.filter((l) => l.isActive).length,
            totalAllocated,
            totalSpent,
            totalRemaining: totalAllocated - totalSpent,
          },
        },
      });
    } catch (error: any) {
      logger.error('budget:getDashboard error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Budgets (CRUD) ─────────────────────────────────────────────── */

  ipcMain.handle('budget:list', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // Les listes de budgets ne sont accessibles qu'aux administrateurs.
      // Les gestionnaires non-admin n'ont accès qu'à leurs lignes (cf. budget:listLines).
      checkBudgetRole(session, ADMIN_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { name: { contains: filters.search } },
        ];
      }

      const budgets = await db.budget.findMany({
        where,
        orderBy: [{ status: 'asc' }, { periodStart: 'desc' }],
        include: { lines: { where: { deletedAt: null } } },
      });
      const allLineIds = budgets.flatMap((b) => b.lines.map((l) => l.id));
      const evolutions = await computeLineEvolutions(db, allLineIds);
      const data = budgets.map((b) => {
        let allocated = 0;
        let spent = 0;
        for (const l of b.lines) {
          allocated += Number(l.allocatedAmount);
          spent += evolutions.get(l.id)?.spent ?? 0;
        }
        return {
          ...b,
          totalLines: b.lines.length,
          totalAllocated: allocated,
          totalSpent: spent,
          totalRemaining: allocated - spent,
        };
      });
      return ser({ success: true, data, total: data.length });
    } catch (error: any) {
      logger.error('budget:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // La fiche d'un budget n'est accessible qu'aux administrateurs.
      // Les gestionnaires non-admin consultent uniquement leurs lignes via budget:getLineById.
      checkBudgetRole(session, ADMIN_ROLES);
      const db = getDb();

      const budget = await db.budget.findUnique({
        where: { id },
        include: {
          closedBy: managerSelect,
          lines: {
            where: { deletedAt: null },
            include: { manager: managerSelect },
            orderBy: { id: 'asc' },
          },
        },
      });
      if (!budget || budget.deletedAt) return { success: false, error: 'Budget introuvable' };

      const evolutions = await computeLineEvolutions(db, budget.lines.map((l) => l.id));
      const linesWithStats = budget.lines.map((l) => ({
        ...l,
        ...(evolutions.get(l.id) ?? {
          spent: 0,
          remaining: Number(l.allocatedAmount),
          consumptionRate: 0,
          operationsCount: 0,
        }),
      }));

      const summary = await computeBudgetSummary(db, id);

      return ser({
        success: true,
        data: { ...budget, lines: linesWithStats, summary },
      });
    } catch (error: any) {
      logger.error('budget:getById error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const parsed = budgetSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const start = new Date(d.periodStart);
      const end = new Date(d.periodEnd);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return { success: false, error: 'Dates de période invalides' };
      }
      if (end < start) return { success: false, error: 'La date de fin doit être postérieure à la date de début' };

      const db = getDb();
      const reference = await nextBudgetRef(db);
      const budget = await db.budget.create({
        data: {
          reference,
          name: d.name,
          description: d.description,
          periodStart: start,
          periodEnd: end,
          totalAllocated: d.totalAllocated != null ? (d.totalAllocated as never) : null,
          notes: d.notes,
        },
      });
      logger.info(`Budget créé: ${budget.reference} (${budget.name})`);
      return ser({ success: true, data: budget });
    } catch (error: any) {
      logger.error('budget:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const parsed = budgetSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();
      const existing = await db.budget.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Budget introuvable' };
      if (existing.status === 'CLOTURE') {
        return { success: false, error: 'Un budget clôturé ne peut pas être modifié' };
      }
      const data: any = { ...d };
      if (d.periodStart !== undefined) data.periodStart = new Date(d.periodStart);
      if (d.periodEnd !== undefined) data.periodEnd = new Date(d.periodEnd);
      if (d.totalAllocated !== undefined) data.totalAllocated = d.totalAllocated as never;
      if (data.periodStart && data.periodEnd && data.periodEnd < data.periodStart) {
        return { success: false, error: 'La date de fin doit être postérieure à la date de début' };
      }
      const budget = await db.budget.update({ where: { id }, data });
      return ser({ success: true, data: budget });
    } catch (error: any) {
      logger.error('budget:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:close', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const db = getDb();
      const existing = await db.budget.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Budget introuvable' };
      if (existing.status === 'CLOTURE') return { success: false, error: 'Budget déjà clôturé' };

      const snapshot = await buildClosingSnapshot(db, id);
      const budget = await db.budget.update({
        where: { id },
        data: {
          status: 'CLOTURE',
          closedAt: new Date(),
          closedById: session.userId,
          closingSnapshot: snapshot as never,
        },
      });
      logger.info(`Budget clôturé: ${existing.reference}`);
      return ser({ success: true, data: budget });
    } catch (error: any) {
      logger.error('budget:close error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:reopen', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const db = getDb();
      const existing = await db.budget.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Budget introuvable' };
      if (existing.status !== 'CLOTURE') return { success: false, error: 'Budget non clôturé' };

      const budget = await db.budget.update({
        where: { id },
        data: { status: 'OUVERT', closedAt: null, closedById: null, closingSnapshot: undefined },
      });
      logger.info(`Budget rouvert: ${existing.reference}`);
      return ser({ success: true, data: budget });
    } catch (error: any) {
      logger.error('budget:reopen error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const db = getDb();
      const existing = await db.budget.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Budget introuvable' };
      // On bloque la suppression si une ligne du budget porte des opérations rattachées.
      const opCount = await db.treasuryOperation.count({
        where: { deletedAt: null, budgetLine: { budgetId: id } },
      });
      if (opCount > 0) {
        return { success: false, error: 'Impossible de supprimer : des opérations sont imputées à ce budget' };
      }
      await db.$transaction([
        db.budgetLine.updateMany({ where: { budgetId: id, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } }),
        db.budget.update({ where: { id }, data: { deletedAt: new Date() } }),
      ]);
      logger.info(`Budget supprimé: ${existing.reference}`);
      return { success: true };
    } catch (error: any) {
      logger.error('budget:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Lignes budgétaires (CRUD) ──────────────────────────────────── */

  ipcMain.handle('budget:listLines', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.budgetId) where.budgetId = filters.budgetId;
      if (filters.managerId) where.managerId = filters.managerId;
      if (filters.isActive !== undefined && filters.isActive !== '') {
        where.isActive = filters.isActive === true || filters.isActive === 'true';
      }
      if (filters.search) {
        where.OR = [
          { label: { contains: filters.search } },
          { code: { contains: filters.search } },
        ];
      }
      // Non-admin : restreint à ses propres lignes.
      if (!isAdminSession(session)) where.managerId = session.userId;
      const lines = await db.budgetLine.findMany({
        where,
        include: {
          manager: managerSelect,
          budget: { select: { id: true, reference: true, name: true, status: true } },
        },
        orderBy: [{ isActive: 'desc' }, { label: 'asc' }],
      });
      const evolutions = await computeLineEvolutions(db, lines.map((l) => l.id));
      const data = lines.map((l) => ({
        ...l,
        ...(evolutions.get(l.id) ?? {
          spent: 0,
          remaining: Number(l.allocatedAmount),
          consumptionRate: 0,
          operationsCount: 0,
        }),
      }));
      return ser({ success: true, data, total: data.length });
    } catch (error: any) {
      logger.error('budget:listLines error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:getLineById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, READ_ROLES);
      const db = getDb();
      const line = await db.budgetLine.findUnique({
        where: { id },
        include: {
          manager: managerSelect,
          budget: { select: { id: true, reference: true, name: true, status: true, periodStart: true, periodEnd: true } },
        },
      });
      if (!line || line.deletedAt) return { success: false, error: 'Ligne budgétaire introuvable' };
      // Non-admin : la ligne doit lui être assignée pour être visible.
      if (!isAdminSession(session) && line.managerId !== session.userId) {
        return { success: false, error: 'Ligne budgétaire introuvable' };
      }
      const evolutions = await computeLineEvolutions(db, [id]);
      const operations = await db.treasuryOperation.findMany({
        where: { deletedAt: null, budgetLineId: id },
        orderBy: { operationDate: 'desc' },
        take: 50,
        include: {
          bankAccount: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          category: { select: { id: true, label: true, accountingCode: true } },
        },
      });
      return ser({
        success: true,
        data: {
          ...line,
          ...(evolutions.get(id) ?? {
            spent: 0,
            remaining: Number(line.allocatedAmount),
            consumptionRate: 0,
            operationsCount: 0,
          }),
          operations,
        },
      });
    } catch (error: any) {
      logger.error('budget:getLineById error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:createLine', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const parsed = lineSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();

      const budget = await db.budget.findUnique({ where: { id: d.budgetId } });
      if (!budget || budget.deletedAt) return { success: false, error: 'Budget introuvable' };
      if (budget.status === 'CLOTURE') {
        return { success: false, error: 'Impossible d\'ajouter une ligne à un budget clôturé' };
      }
      if (d.managerId != null) {
        await assertCanBeManager(db, d.managerId);
      }
      const line = await db.budgetLine.create({
        data: {
          budgetId: d.budgetId,
          code: d.code,
          label: d.label,
          description: d.description,
          allocatedAmount: d.allocatedAmount as never,
          managerId: d.managerId ?? null,
          isActive: d.isActive ?? true,
          notes: d.notes,
        },
      });
      logger.info(`Ligne budgétaire créée: id=${line.id} (${line.label})`);
      return ser({ success: true, data: line });
    } catch (error: any) {
      logger.error('budget:createLine error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:updateLine', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const parsed = lineSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();
      const existing = await db.budgetLine.findUnique({
        where: { id },
        include: { budget: { select: { status: true } } },
      });
      if (!existing || existing.deletedAt) return { success: false, error: 'Ligne budgétaire introuvable' };
      if (existing.budget.status === 'CLOTURE') {
        return { success: false, error: 'Impossible de modifier la ligne d\'un budget clôturé' };
      }
      if (d.managerId != null) {
        await assertCanBeManager(db, d.managerId);
      }
      const data: any = { ...d };
      if (d.allocatedAmount !== undefined) data.allocatedAmount = d.allocatedAmount as never;
      // Empêche le rattachement vers un autre budget : géré séparément via la fiche.
      delete data.budgetId;
      const line = await db.budgetLine.update({ where: { id }, data });
      return ser({ success: true, data: line });
    } catch (error: any) {
      logger.error('budget:updateLine error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:toggleLineActive', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const db = getDb();
      const existing = await db.budgetLine.findUnique({
        where: { id },
        include: { budget: { select: { status: true } } },
      });
      if (!existing || existing.deletedAt) return { success: false, error: 'Ligne budgétaire introuvable' };
      if (existing.budget.status === 'CLOTURE') {
        return { success: false, error: 'Impossible de modifier la ligne d\'un budget clôturé' };
      }
      const line = await db.budgetLine.update({
        where: { id },
        data: { isActive: !existing.isActive },
      });
      return ser({ success: true, data: line });
    } catch (error: any) {
      logger.error('budget:toggleLineActive error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('budget:deleteLine', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const db = getDb();
      const existing = await db.budgetLine.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Ligne budgétaire introuvable' };
      const opCount = await db.treasuryOperation.count({
        where: { deletedAt: null, budgetLineId: id },
      });
      if (opCount > 0) {
        return { success: false, error: 'Impossible de supprimer : des opérations sont imputées à cette ligne' };
      }
      await db.budgetLine.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      logger.info(`Ligne budgétaire supprimée: id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('budget:deleteLine error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Auxiliaires ────────────────────────────────────────────────── */

  /**
   * Liste des utilisateurs éligibles comme gestionnaires de ligne budgétaire.
   * Exclut les ADMIN et SUPER_ADMIN ainsi que les comptes inactifs/supprimés.
   */
  ipcMain.handle('budget:listEligibleManagers', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, ADMIN_ROLES);
      const db = getDb();
      const users = await db.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          role: { notIn: [...FORBIDDEN_MANAGER_ROLES] },
        },
        select: { id: true, firstName: true, lastName: true, role: true, matricule: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      });
      return { success: true, data: users };
    } catch (error: any) {
      logger.error('budget:listEligibleManagers error', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Lignes budgétaires que la session peut utiliser pour imputer une opération
   * de sortie. Filtre par budget ouvert + ligne active + (gestionnaire ou admin).
   */
  ipcMain.handle('budget:listAccessibleLines', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkBudgetRole(session, READ_ROLES);
      const db = getDb();
      const isAdmin = (BUDGET_FULL_ACCESS_ROLES as readonly string[]).includes(session.role);
      const where: any = {
        deletedAt: null,
        isActive: true,
        budget: { status: 'OUVERT', deletedAt: null },
      };
      if (!isAdmin) where.managerId = session.userId;
      const lines = await db.budgetLine.findMany({
        where,
        include: {
          budget: { select: { id: true, reference: true, name: true } },
          manager: managerSelect,
        },
        orderBy: [{ label: 'asc' }],
      });
      const evolutions = await computeLineEvolutions(db, lines.map((l) => l.id));
      const data = lines.map((l) => ({
        ...l,
        ...(evolutions.get(l.id) ?? {
          spent: 0,
          remaining: Number(l.allocatedAmount),
          consumptionRate: 0,
          operationsCount: 0,
        }),
      }));
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('budget:listAccessibleLines error', error.message);
      return { success: false, error: error.message };
    }
  });
}
