import { getDb } from './db.service';
import { getAmlRiskThresholds } from './aml-risk-engine.service';
import logger from '../utils/logger';

type Db = ReturnType<typeof getDb>;

async function nextDsteReference(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.amlDsteRecord.findFirst({
    where: { reference: { startsWith: `DSTE-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `DSTE-${year}-${String(seq).padStart(4, '0')}`;
}

/** Même convention « Nom + Prénoms » que le reste de l'application (cf. Module Communication). */
function clientLabel(
  c: { type: string; firstName: string | null; lastName: string | null; entreprise: string | null } | null,
): string {
  if (!c) return 'Client non identifié';
  if (c.type === 'ENTREPRISE' && c.entreprise) return c.entreprise;
  const name = `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim();
  return name || 'Client non identifié';
}

export interface CashTransactionInput {
  amount: number;
  transactionDate: Date;
  clientId?: number | null;
  description: string;
  /** "PAYMENT" | "INSTALLMENT" — clé de déduplication avec `sourceId`. */
  sourceType: string;
  sourceId: number;
}

/**
 * Auto-recense une transaction en espèces dans la Grille DSTE (Registres
 * LBC/FT) dès qu'elle dépasse le seuil paramétrable (Paramètres → Conformité
 * LBC/FT → Seuils de scoring, `dsteThreshold`). Appelée en fire-and-forget
 * depuis `accounting.ipc.ts` (`addPayment`/`payInstallment`) — n'échoue
 * jamais l'encaissement lui-même (erreurs journalisées par l'appelant).
 *
 * Dédoublonnée sur (`sourceType`, `sourceId`) : un nouvel appel décrivant la
 * même source (ex. relance de la même requête réseau) ne crée pas de ligne
 * en double — la contrainte unique en base fait autorité finale.
 */
export async function autoRecordDste(input: CashTransactionInput, db: Db = getDb()): Promise<void> {
  if (!(input.amount > 0)) return;
  const thresholds = await getAmlRiskThresholds(db);
  if (input.amount < thresholds.dsteThreshold) return;

  const existing = await db.amlDsteRecord.findFirst({
    where: { sourceType: input.sourceType, sourceId: input.sourceId },
    select: { id: true },
  });
  if (existing) return;

  const client = input.clientId
    ? await db.client.findUnique({
        where: { id: input.clientId },
        select: { type: true, firstName: true, lastName: true, entreprise: true },
      })
    : null;

  const reference = await nextDsteReference(db);
  try {
    await db.amlDsteRecord.create({
      data: {
        reference,
        transactionDate: input.transactionDate,
        subjectLabel: clientLabel(client),
        amount: input.amount as any,
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    });
    logger.info(`DSTE auto-recensée : ${reference} (${input.sourceType} #${input.sourceId}, ${input.amount} FCFA)`);
  } catch (error: any) {
    // Violation de contrainte unique (P2002) = appel concurrent sur la même
    // source : déjà recensée entre-temps, rien à faire.
    if (error?.code !== 'P2002') throw error;
  }
}
