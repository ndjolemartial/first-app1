/** Constantes et helpers d'affichage du module Commissions. */
import { formatPersonName } from '../../../shared/utils/format';

/** Rôles autorisés à créer / payer / annuler des commissions. */
// Écriture commissions : AD est explicitement exclue (consultation de ses propres commissions uniquement).
export const COMMISSION_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/**
 * Rôles disposant de la vue complète (non filtrée) de la liste des apporteurs
 * d'affaire — coïncide avec `COMMISSION_WRITE_ROLES` (droits de modification).
 * Les autres rôles n'accèdent, en lecture seule, qu'aux apporteurs dont ils
 * sont l'utilisateur référent (filtrage appliqué côté IPC).
 */
export const COMMISSION_REFERRERS_FULL_VIEW_ROLES = COMMISSION_WRITE_ROLES;

/** Rôles autorisés à supprimer un apporteur d'affaire (ACCOUNTANT en est exclu). */
export const COMMISSION_REFERRERS_DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Rôles autorisés à exporter / imprimer la liste des apporteurs d'affaire (ACCOUNTANT en est exclu). */
export const COMMISSION_REFERRERS_EXPORT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Rôles autorisés à gérer les paramètres de commission (taux par défaut). */
export const COMMISSION_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export const COMMISSION_STATUS_LABEL: Record<string, string> = {
  A_PAYER: 'À payer',
  PAYEE: 'Payée',
  ANNULEE: 'Annulée',
};

export const COMMISSION_STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  A_PAYER: 'warning',
  PAYEE: 'success',
  ANNULEE: 'default',
};

export const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  VENTE: 'Vente',
  LOCATION: 'Location',
  SOUSCRIPTION: 'Souscription',
  FRAIS_DOSSIER: 'Frais d\'ouverture de dossier',
  FRAIS_DEMARCHES_ACD: 'Frais de démarches ACD',
};

/**
 * Libellé de la colonne « Transaction » d'une commission. Une commission issue
 * d'une facture d'apport initial est affichée « Apport initial » (plutôt que le
 * libellé du type de transaction sous-jacent, ex. « Souscription »).
 */
export function transactionLabel(commission: { transactionType: string; invoice?: { type?: string } | null }): string {
  if (commission.invoice?.type === 'APPORT_INITIAL') return 'Apport initial';
  return TRANSACTION_TYPE_LABEL[commission.transactionType] ?? commission.transactionType;
}

export const SOURCE_LABEL: Record<string, string> = {
  MANUEL: 'Manuelle',
  AUTOMATIQUE: 'Automatique',
};

export const BENEFICIARY_TYPE_LABEL: Record<string, string> = {
  USER: 'Utilisateur',
  REFERRER: 'Apporteur d\'affaire',
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

export const PAYMENT_METHOD_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.label]),
);

/** Nom affichable d'un client (personne physique ou morale). */
export function clientName(client: any): string {
  if (!client) return '—';
  if (client.type === 'INDIVIDUEL') {
    return `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() || '—';
  }
  return client.entreprise ?? '—';
}

/** Nom affichable du bénéficiaire d'une commission. */
export function beneficiaryName(commission: any): string {
  if (!commission) return '—';
  if (commission.beneficiaryType === 'USER') {
    return formatPersonName(commission.user);
  }
  return referrerName(commission.referrer);
}

/** Nom affichable d'un apporteur d'affaire. */
export function referrerName(referrer: any): string {
  if (!referrer) return '—';
  return referrer.companyName || formatPersonName(referrer);
}

/**
 * Totaux d'un ensemble de commissions : nombre de lignes, somme des assiettes
 * et somme des montants. Utilisé pour la ligne de total des exports/impressions.
 */
export function commissionTotals(rows: any[]): { count: number; base: number; amount: number } {
  return (rows ?? []).reduce(
    (acc, c) => ({
      count: acc.count + 1,
      base: acc.base + (Number(c.baseAmount) || 0),
      amount: acc.amount + (Number(c.amount) || 0),
    }),
    { count: 0, base: 0, amount: 0 },
  );
}
