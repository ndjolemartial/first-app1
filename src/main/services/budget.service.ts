import { Prisma } from '@prisma/client';
import { getDb } from './db.service';

type Db = ReturnType<typeof getDb>;
type DbOrTx = Db | Prisma.TransactionClient;

/** Rôles incompatibles avec la fonction de gestionnaire de ligne budgétaire. */
export const FORBIDDEN_MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

/** Rôles disposant d'un accès complet aux lignes budgétaires (passage d'opérations imputées). */
export const BUDGET_FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

/**
 * Génère la prochaine référence de budget : BUDG-YYYY-NNNN
 */
export async function nextBudgetRef(db: DbOrTx): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.budget.findFirst({
    where: { reference: { startsWith: `BUDG-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `BUDG-${year}-${String(seq).padStart(4, '0')}`;
}

export interface BudgetLineEvolution {
  /** Total des sorties (non supprimées) imputées à la ligne. */
  spent: number;
  /** Nombre d'opérations imputées. */
  operationsCount: number;
  /** Solde disponible : alloué − dépensé. */
  remaining: number;
  /** Taux de consommation (0–1, peut dépasser 1 en cas de dépassement). */
  consumptionRate: number;
}

/**
 * Calcule l'évolution (dépensé, restant, taux) de chaque ligne budgétaire.
 *
 * @param lineIds restreint le calcul à ces lignes ; sinon toutes les lignes actives.
 * @returns une Map indexée par identifiant de ligne, contenant les agrégats.
 */
export async function computeLineEvolutions(
  db: Db,
  lineIds?: number[],
): Promise<Map<number, BudgetLineEvolution>> {
  const lineWhere: Prisma.BudgetLineWhereInput = { deletedAt: null };
  if (lineIds && lineIds.length > 0) lineWhere.id = { in: lineIds };

  const lines = await db.budgetLine.findMany({
    where: lineWhere,
    select: { id: true, allocatedAmount: true },
  });

  const opWhere: Prisma.TreasuryOperationWhereInput = {
    deletedAt: null,
    direction: 'SORTIE',
    budgetLineId: { not: null },
  };
  if (lineIds && lineIds.length > 0) opWhere.budgetLineId = { in: lineIds };

  const grouped = await db.treasuryOperation.groupBy({
    by: ['budgetLineId'],
    where: opWhere,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const result = new Map<number, BudgetLineEvolution>();
  for (const line of lines) {
    const allocated = Number(line.allocatedAmount);
    result.set(line.id, {
      spent: 0,
      operationsCount: 0,
      remaining: allocated,
      consumptionRate: 0,
    });
  }
  for (const g of grouped) {
    if (g.budgetLineId == null) continue;
    const entry = result.get(g.budgetLineId);
    if (!entry) continue;
    const spent = Number(g._sum.amount ?? 0);
    const allocated = Number(lines.find((l) => l.id === g.budgetLineId)?.allocatedAmount ?? 0);
    entry.spent = spent;
    entry.operationsCount = g._count._all;
    entry.remaining = allocated - spent;
    entry.consumptionRate = allocated > 0 ? spent / allocated : 0;
  }
  return result;
}

export interface BudgetSummary {
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  linesCount: number;
  operationsCount: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Calcule le récapitulatif global d'un budget : alloué, dépensé, restant.
 */
export async function computeBudgetSummary(db: Db, budgetId: number): Promise<BudgetSummary> {
  const budget = await db.budget.findUnique({
    where: { id: budgetId },
    select: { periodStart: true, periodEnd: true },
  });
  if (!budget) throw new Error('Budget introuvable');

  const lines = await db.budgetLine.findMany({
    where: { budgetId, deletedAt: null },
    select: { id: true, allocatedAmount: true },
  });
  const evolutions = await computeLineEvolutions(db, lines.map((l) => l.id));

  let totalAllocated = 0;
  let totalSpent = 0;
  let operationsCount = 0;
  for (const line of lines) {
    totalAllocated += Number(line.allocatedAmount);
    const ev = evolutions.get(line.id);
    if (ev) {
      totalSpent += ev.spent;
      operationsCount += ev.operationsCount;
    }
  }

  return {
    totalAllocated,
    totalSpent,
    totalRemaining: totalAllocated - totalSpent,
    linesCount: lines.length,
    operationsCount,
    periodStart: budget.periodStart,
    periodEnd: budget.periodEnd,
  };
}

export interface AccessSession {
  userId: number;
  role: string;
}

/**
 * Indique si la session peut imputer une opération à la ligne donnée.
 * Le gestionnaire désigné ou un administrateur (ADMIN/SUPER_ADMIN) y a droit.
 */
export function canOperateOnLine(
  session: AccessSession,
  line: { managerId: number | null },
): boolean {
  if ((BUDGET_FULL_ACCESS_ROLES as readonly string[]).includes(session.role)) return true;
  return line.managerId != null && line.managerId === session.userId;
}

/**
 * Construit le snapshot figé d'un budget au moment de sa clôture.
 * Le snapshot inclut le récapitulatif global et le détail par ligne.
 */
export async function buildClosingSnapshot(db: Db, budgetId: number) {
  const summary = await computeBudgetSummary(db, budgetId);
  const lines = await db.budgetLine.findMany({
    where: { budgetId, deletedAt: null },
    include: { manager: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: { id: 'asc' },
  });
  const evolutions = await computeLineEvolutions(db, lines.map((l) => l.id));

  return {
    closedAt: new Date().toISOString(),
    summary: {
      totalAllocated: summary.totalAllocated,
      totalSpent: summary.totalSpent,
      totalRemaining: summary.totalRemaining,
      linesCount: summary.linesCount,
      operationsCount: summary.operationsCount,
      periodStart: summary.periodStart.toISOString(),
      periodEnd: summary.periodEnd.toISOString(),
    },
    lines: lines.map((l) => {
      const ev = evolutions.get(l.id);
      return {
        id: l.id,
        code: l.code,
        label: l.label,
        allocatedAmount: Number(l.allocatedAmount),
        spent: ev?.spent ?? 0,
        remaining: ev?.remaining ?? Number(l.allocatedAmount),
        consumptionRate: ev?.consumptionRate ?? 0,
        operationsCount: ev?.operationsCount ?? 0,
        manager: l.manager
          ? { id: l.manager.id, firstName: l.manager.firstName, lastName: l.manager.lastName, role: l.manager.role }
          : null,
      };
    }),
  };
}
