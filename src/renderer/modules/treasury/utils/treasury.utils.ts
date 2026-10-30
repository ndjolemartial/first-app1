/** Constantes et helpers d'affichage du module Trésorerie. */

/** Rôles autorisés à créer / modifier des comptes et des opérations. */
export const TREASURY_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];

/** Rôles autorisés à corriger/modifier une opération existante (rôle exact, MANAGER exclu). */
export const TREASURY_OPERATION_EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

/** Origines d'opération modifiables / supprimables à la main. */
export const TREASURY_EDITABLE_SOURCES = ['MANUEL', 'TRANSFERT'];

/** Rôles autorisés à supprimer un compte ou un objet d'opération. */
export const TREASURY_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export const ACCOUNT_TYPE_OPTIONS = [
  { value: 'BANQUE', label: 'Compte bancaire' },
  { value: 'CAISSE', label: 'Caisse espèces' },
  { value: 'CAISSE_CENTRALE', label: 'Caisse interne' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

export const ACCOUNT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ACCOUNT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export const ACCOUNT_TYPE_VARIANT: Record<string, 'info' | 'success' | 'purple' | 'warning'> = {
  BANQUE: 'info',
  CAISSE: 'success',
  CAISSE_CENTRALE: 'warning',
  MOBILE_MONEY: 'purple',
};

export const DIRECTION_OPTIONS = [
  { value: 'ENTREE', label: 'Entrée' },
  { value: 'SORTIE', label: 'Sortie' },
];

export const DIRECTION_LABEL: Record<string, string> = {
  ENTREE: 'Entrée',
  SORTIE: 'Sortie',
};

export const SOURCE_LABEL: Record<string, string> = {
  MANUEL: 'Manuelle',
  FACTURE: 'Encaissement facture',
  ECHEANCE: 'Règlement échéance',
  COMMISSION: 'Paiement commission',
  PAIE: 'Paie',
  CHARGE: 'Charge',
  TRANSFERT: 'Transfert',
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'PRELEVEMENT', label: 'Prélèvement bancaire' },
];

export const PAYMENT_METHOD_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.label]),
);

/** Libellé d'un objet d'opération avec son numéro de compte comptable. */
export function categoryLabel(category: any): string {
  if (!category) return '—';
  return category.accountingCode
    ? `${category.label} (${category.accountingCode})`
    : category.label;
}
