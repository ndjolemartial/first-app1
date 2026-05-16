import { getDb } from './db.service';
import logger from '../utils/logger';

type Db = ReturnType<typeof getDb>;

/** Clés AppSetting des taux de commission par défaut. */
export const SETTING_RATE_SALE = 'commission.defaultRateSale';
export const SETTING_RATE_RENTAL = 'commission.defaultRateRental';
export const SETTING_RATE_DOSSIER = 'commission.defaultRateDossier';

/** Taux par défaut appliqués si aucun paramètre n'est défini en base. */
const FALLBACK_RATE_SALE = 5;
const FALLBACK_RATE_RENTAL = 50;
const FALLBACK_RATE_DOSSIER = 10;

/** Types de contrats de location éligibles à une commission. */
const RENTAL_CONTRACT_TYPES = ['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'COMMERCIAL_LEASE'];

/** Vrai si le type de contrat est éligible à une commission (vente ou location). */
export function isCommissionEligibleContract(type: string): boolean {
  return type === 'SALE' || RENTAL_CONTRACT_TYPES.includes(type);
}

export interface DefaultRates {
  saleRate: number;
  rentalRate: number;
  /** Taux applicable aux frais d'ouverture de dossier. */
  dossierRate: number;
}

/**
 * Génère la prochaine référence de commission : COM-YYYY-NNNN
 */
export async function nextCommissionRef(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.commission.findFirst({
    where: { reference: { startsWith: `COM-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `COM-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Récupère les taux de commission par défaut configurés (vente / location).
 */
export async function getDefaultRates(db: Db): Promise<DefaultRates> {
  const settings = await db.appSetting.findMany({
    where: { key: { in: [SETTING_RATE_SALE, SETTING_RATE_RENTAL, SETTING_RATE_DOSSIER] } },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const saleRate = Number(map.get(SETTING_RATE_SALE));
  const rentalRate = Number(map.get(SETTING_RATE_RENTAL));
  const dossierRate = Number(map.get(SETTING_RATE_DOSSIER));
  return {
    saleRate: Number.isFinite(saleRate) ? saleRate : FALLBACK_RATE_SALE,
    rentalRate: Number.isFinite(rentalRate) ? rentalRate : FALLBACK_RATE_RENTAL,
    dossierRate: Number.isFinite(dossierRate) ? dossierRate : FALLBACK_RATE_DOSSIER,
  };
}

/**
 * Enregistre les taux de commission par défaut.
 */
export async function setDefaultRates(db: Db, rates: DefaultRates): Promise<void> {
  await db.$transaction([
    db.appSetting.upsert({
      where: { key: SETTING_RATE_SALE },
      create: { key: SETTING_RATE_SALE, value: String(rates.saleRate) },
      update: { value: String(rates.saleRate) },
    }),
    db.appSetting.upsert({
      where: { key: SETTING_RATE_RENTAL },
      create: { key: SETTING_RATE_RENTAL, value: String(rates.rentalRate) },
      update: { value: String(rates.rentalRate) },
    }),
    db.appSetting.upsert({
      where: { key: SETTING_RATE_DOSSIER },
      create: { key: SETTING_RATE_DOSSIER, value: String(rates.dossierRate) },
      update: { value: String(rates.dossierRate) },
    }),
  ]);
}

/**
 * Détermine l'assiette de commission d'un contrat selon son type.
 * - Vente (SALE)         → assiette = prix de vente
 * - Location (RENTAL_*)  → assiette = un mois de loyer
 * - Gestion (MANAGEMENT) → non éligible
 */
export function getCommissionBase(contract: {
  type: string;
  saleAmount: unknown;
  rentAmount: unknown;
}): { transactionType: 'VENTE' | 'LOCATION'; baseAmount: number } | null {
  if (contract.type === 'SALE') {
    const base = Number(contract.saleAmount ?? 0);
    if (base <= 0) return null;
    return { transactionType: 'VENTE', baseAmount: base };
  }
  if (RENTAL_CONTRACT_TYPES.includes(contract.type)) {
    const base = Number(contract.rentAmount ?? 0);
    if (base <= 0) return null;
    return { transactionType: 'LOCATION', baseAmount: base };
  }
  return null;
}

/** Calcule un montant de commission arrondi à 2 décimales. */
export function computeCommissionAmount(baseAmount: number, rate: number): number {
  return Math.round(baseAmount * (rate / 100) * 100) / 100;
}

/**
 * Génère automatiquement la commission de l'agent à l'activation d'un contrat.
 *
 * La commission n'est créée que si le contrat possède un agent, qu'il est
 * éligible (vente ou location) et qu'aucune commission active n'existe déjà
 * pour cet agent sur ce contrat. Toute erreur est journalisée sans être
 * propagée, afin de ne jamais bloquer l'activation du contrat.
 *
 * @returns la commission créée, ou null si aucune génération n'a eu lieu.
 */
export async function autoGenerateContractCommission(
  db: Db,
  contractId: number,
): Promise<{ id: number; reference: string } | null> {
  try {
    const contract = await db.contract.findUnique({
      where: { id: contractId },
      select: { id: true, type: true, agentId: true, saleAmount: true, rentAmount: true },
    });
    if (!contract || !contract.agentId) return null;

    const base = getCommissionBase(contract);
    if (!base) return null;

    // Évite les doublons : une seule commission auto par agent et par contrat.
    const existing = await db.commission.findFirst({
      where: {
        contractId,
        userId: contract.agentId,
        beneficiaryType: 'USER',
        status: { not: 'ANNULEE' },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) return null;

    const rates = await getDefaultRates(db);
    const rate = base.transactionType === 'VENTE' ? rates.saleRate : rates.rentalRate;
    const amount = computeCommissionAmount(base.baseAmount, rate);
    const reference = await nextCommissionRef(db);

    const commission = await db.commission.create({
      data: {
        reference,
        contractId,
        beneficiaryType: 'USER',
        userId: contract.agentId,
        transactionType: base.transactionType,
        baseAmount: base.baseAmount as never,
        rate: rate as never,
        amount: amount as never,
        status: 'A_PAYER',
        source: 'AUTOMATIQUE',
      },
      select: { id: true, reference: true },
    });
    logger.info(`Commission auto-générée: ${commission.reference} (contrat #${contractId})`);
    return commission;
  } catch (error: any) {
    logger.error('autoGenerateContractCommission error', error?.message ?? error);
    return null;
  }
}
