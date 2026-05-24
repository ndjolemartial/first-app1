import { Prisma } from '@prisma/client';
import { getDb } from './db.service';

type Db = ReturnType<typeof getDb>;
/** Accepte le client Prisma complet ou un client de transaction (`tx`). */
type DbOrTx = Db | Prisma.TransactionClient;

export type TreasuryDirection = 'ENTREE' | 'SORTIE';
export type TreasurySource = 'MANUEL' | 'FACTURE' | 'ECHEANCE' | 'COMMISSION';

/**
 * Génère la prochaine référence d'opération de trésorerie : OPT-YYYY-NNNN
 */
export async function nextOperationRef(db: DbOrTx): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.treasuryOperation.findFirst({
    where: { reference: { startsWith: `OPT-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `OPT-${year}-${String(seq).padStart(4, '0')}`;
}

export interface RecordOperationParams {
  bankAccountId: number;
  direction: TreasuryDirection;
  amount: number;
  label: string;
  operationDate?: Date;
  categoryId?: number | null;
  paymentMethod?: string;
  paymentRef?: string | null;
  source?: TreasurySource;
  paymentId?: number | null;
  installmentId?: number | null;
  commissionId?: number | null;
  budgetLineId?: number | null;
  // Imputation analytique : au plus un seul des trois (exclusivité contrôlée par l'appelant).
  projectId?: number | null;
  lotissementId?: number | null;
  programmeId?: number | null;
  createdById?: number | null;
  notes?: string | null;
}

/**
 * Enregistre un mouvement de trésorerie sur un compte. Utilisable directement
 * ou au sein d'une transaction Prisma (passer le `tx` comme premier argument)
 * afin d'être atomique avec l'encaissement / le paiement qui le déclenche.
 *
 * @returns l'opération de trésorerie créée.
 */
export async function recordTreasuryOperation(db: DbOrTx, params: RecordOperationParams) {
  const reference = await nextOperationRef(db);
  return db.treasuryOperation.create({
    data: {
      reference,
      bankAccountId: params.bankAccountId,
      direction: params.direction,
      amount: params.amount as never,
      operationDate: params.operationDate ?? new Date(),
      categoryId: params.categoryId ?? null,
      label: params.label,
      paymentMethod: (params.paymentMethod ?? 'ESPECE') as never,
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

export interface AccountBalance {
  /** Solde courant : solde initial + entrées − sorties. */
  balance: number;
  /** Cumul des entrées enregistrées. */
  totalIn: number;
  /** Cumul des sorties enregistrées. */
  totalOut: number;
}

/**
 * Calcule le solde de chaque compte de trésorerie : solde initial augmenté des
 * entrées et diminué des sorties (opérations non supprimées).
 *
 * @param accountIds restreint le calcul à ces comptes ; sinon tous les comptes actifs.
 * @returns une Map indexée par identifiant de compte.
 */
export async function computeBalances(
  db: Db,
  accountIds?: number[],
): Promise<Map<number, AccountBalance>> {
  const accountWhere: Prisma.BankAccountWhereInput = { deletedAt: null };
  if (accountIds && accountIds.length > 0) accountWhere.id = { in: accountIds };

  const accounts = await db.bankAccount.findMany({
    where: accountWhere,
    select: { id: true, initialBalance: true },
  });

  const opWhere: Prisma.TreasuryOperationWhereInput = { deletedAt: null };
  if (accountIds && accountIds.length > 0) opWhere.bankAccountId = { in: accountIds };

  const grouped = await db.treasuryOperation.groupBy({
    by: ['bankAccountId', 'direction'],
    where: opWhere,
    _sum: { amount: true },
  });

  const result = new Map<number, AccountBalance>();
  for (const acc of accounts) {
    result.set(acc.id, { balance: Number(acc.initialBalance), totalIn: 0, totalOut: 0 });
  }
  for (const g of grouped) {
    const entry = result.get(g.bankAccountId);
    if (!entry) continue;
    const sum = Number(g._sum.amount ?? 0);
    if (g.direction === 'ENTREE') {
      entry.totalIn += sum;
      entry.balance += sum;
    } else {
      entry.totalOut += sum;
      entry.balance -= sum;
    }
  }
  return result;
}
