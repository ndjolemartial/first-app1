"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUDGET_FULL_ACCESS_ROLES = exports.FORBIDDEN_MANAGER_ROLES = void 0;
exports.nextBudgetRef = nextBudgetRef;
exports.computeLineEvolutions = computeLineEvolutions;
exports.computeBudgetSummary = computeBudgetSummary;
exports.canOperateOnLine = canOperateOnLine;
exports.buildClosingSnapshot = buildClosingSnapshot;
/** Rôles incompatibles avec la fonction de gestionnaire de ligne budgétaire. */
exports.FORBIDDEN_MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN'];
/** Rôles disposant d'un accès complet aux lignes budgétaires (passage d'opérations imputées). */
exports.BUDGET_FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN'];
/**
 * Génère la prochaine référence de budget : BUDG-YYYY-NNNN
 */
async function nextBudgetRef(db) {
    const year = new Date().getFullYear();
    const last = await db.budget.findFirst({
        where: { reference: { startsWith: `BUDG-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `BUDG-${year}-${String(seq).padStart(4, '0')}`;
}
/**
 * Calcule l'évolution (dépensé, restant, taux) de chaque ligne budgétaire.
 *
 * @param lineIds restreint le calcul à ces lignes ; sinon toutes les lignes actives.
 * @returns une Map indexée par identifiant de ligne, contenant les agrégats.
 */
async function computeLineEvolutions(db, lineIds) {
    const lineWhere = { deletedAt: null };
    if (lineIds && lineIds.length > 0)
        lineWhere.id = { in: lineIds };
    const lines = await db.budgetLine.findMany({
        where: lineWhere,
        select: { id: true, allocatedAmount: true },
    });
    const opWhere = {
        deletedAt: null,
        direction: 'SORTIE',
        budgetLineId: { not: null },
    };
    if (lineIds && lineIds.length > 0)
        opWhere.budgetLineId = { in: lineIds };
    const grouped = await db.treasuryOperation.groupBy({
        by: ['budgetLineId'],
        where: opWhere,
        _sum: { amount: true },
        _count: { _all: true },
    });
    const result = new Map();
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
        if (g.budgetLineId == null)
            continue;
        const entry = result.get(g.budgetLineId);
        if (!entry)
            continue;
        const spent = Number(g._sum.amount ?? 0);
        const allocated = Number(lines.find((l) => l.id === g.budgetLineId)?.allocatedAmount ?? 0);
        entry.spent = spent;
        entry.operationsCount = g._count._all;
        entry.remaining = allocated - spent;
        entry.consumptionRate = allocated > 0 ? spent / allocated : 0;
    }
    return result;
}
/**
 * Calcule le récapitulatif global d'un budget : alloué, dépensé, restant.
 */
async function computeBudgetSummary(db, budgetId) {
    const budget = await db.budget.findUnique({
        where: { id: budgetId },
        select: { periodStart: true, periodEnd: true },
    });
    if (!budget)
        throw new Error('Budget introuvable');
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
/**
 * Indique si la session peut imputer une opération à la ligne donnée.
 * Le gestionnaire désigné ou un administrateur (ADMIN/SUPER_ADMIN) y a droit.
 */
function canOperateOnLine(session, line) {
    if (exports.BUDGET_FULL_ACCESS_ROLES.includes(session.role))
        return true;
    return line.managerId != null && line.managerId === session.userId;
}
/**
 * Construit le snapshot figé d'un budget au moment de sa clôture.
 * Le snapshot inclut le récapitulatif global et le détail par ligne.
 */
async function buildClosingSnapshot(db, budgetId) {
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
