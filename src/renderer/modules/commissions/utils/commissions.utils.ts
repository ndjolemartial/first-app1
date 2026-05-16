/** Constantes et helpers d'affichage du module Commissions. */

/** Rôles autorisés à créer / payer / annuler des commissions. */
export const COMMISSION_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/** Rôles autorisés à gérer les paramètres et supprimer un apporteur. */
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
  FRAIS_DOSSIER: 'Frais d\'ouverture de dossier',
};

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
    const u = commission.user;
    return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '—' : '—';
  }
  const r = commission.referrer;
  if (!r) return '—';
  return r.companyName || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || '—';
}

/** Nom affichable d'un apporteur d'affaire. */
export function referrerName(referrer: any): string {
  if (!referrer) return '—';
  return referrer.companyName || `${referrer.firstName ?? ''} ${referrer.lastName ?? ''}`.trim() || '—';
}
