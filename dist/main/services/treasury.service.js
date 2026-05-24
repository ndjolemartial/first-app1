"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextOperationRef = nextOperationRef;
exports.recordTreasuryOperation = recordTreasuryOperation;
exports.computeBalances = computeBalances;
/**
 * Génère la prochaine référence d'opération de trésorerie : OPT-YYYY-NNNN
 */
async function nextOperationRef(db) {
    const year = new Date().getFullYear();
    const last = await db.treasuryOperation.findFirst({
        where: { reference: { startsWith: `OPT-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `OPT-${year}-${String(seq).padStart(4, '0')}`;
}
/**
 * Enregistre un mouvement de trésorerie sur un compte. Utilisable directement
 * ou au sein d'une transaction Prisma (passer le `tx` comme premier argument)
 * afin d'être atomique avec l'encaissement / le paiement qui le déclenche.
 *
 * @returns l'opération de trésorerie créée.
 */
async function recordTreasuryOperation(db, params) {
    const reference = await nextOperationRef(db);
    return db.treasuryOperation.create({
        data: {
            reference,
            bankAccountId: params.bankAccountId,
            direction: params.direction,
            amount: params.amount,
            operationDate: params.operationDate ?? new Date(),
            categoryId: params.categoryId ?? null,
            label: params.label,
            paymentMethod: (params.paymentMethod ?? 'ESPECE'),
            paymentRef: params.paymentRef ?? null,
            source: params.source ?? 'MANUEL',
            paymentId: params.paymentId ?? null,
            installmentId: params.installmentId ?? null,
            commissionId: params.commissionId ?? null,
            budgetLineId: params.budgetLineId ?? null,
            projectId: params.projectId ?? null,
            lotissementId: params.lotissementId ?? null,
            programmeId: params.programmeId ?? null,
            createdById: params.createdById ?? null,
            notes: params.notes ?? null,
        },
    });
}
/**
 * Calcule le solde de chaque compte de trésorerie : solde initial augmenté des
 * entrées et diminué des sorties (opérations non supprimées).
 *
 * @param accountIds restreint le calcul à ces comptes ; sinon tous les comptes actifs.
 * @returns une Map indexée par identifiant de compte.
 */
async function computeBalances(db, accountIds) {
    const accountWhere = { deletedAt: null };
    if (accountIds && accountIds.length > 0)
        accountWhere.id = { in: accountIds };
    const accounts = await db.bankAccount.findMany({
        where: accountWhere,
        select: { id: true, initialBalance: true },
    });
    const opWhere = { deletedAt: null };
    if (accountIds && accountIds.length > 0)
        opWhere.bankAccountId = { in: accountIds };
    const grouped = await db.treasuryOperation.groupBy({
        by: ['bankAccountId', 'direction'],
        where: opWhere,
        _sum: { amount: true },
    });
    const result = new Map();
    for (const acc of accounts) {
        result.set(acc.id, { balance: Number(acc.initialBalance), totalIn: 0, totalOut: 0 });
    }
    for (const g of grouped) {
        const entry = result.get(g.bankAccountId);
        if (!entry)
            continue;
        const sum = Number(g._sum.amount ?? 0);
        if (g.direction === 'ENTREE') {
            entry.totalIn += sum;
            entry.balance += sum;
        }
        else {
            entry.totalOut += sum;
            entry.balance -= sum;
        }
    }
    return result;
}
