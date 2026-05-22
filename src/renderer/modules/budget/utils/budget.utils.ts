import type { BudgetStatus } from '../types/budget.types';

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  OUVERT: 'Ouvert',
  CLOTURE: 'Clôturé',
};

export const BUDGET_STATUS_VARIANT: Record<BudgetStatus, 'success' | 'default'> = {
  OUVERT: 'success',
  CLOTURE: 'default',
};

export const BUDGET_STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'OUVERT', label: 'Ouvert' },
  { value: 'CLOTURE', label: 'Clôturé' },
];

/** Rôles autorisés à consulter le module budget. */
export const BUDGET_READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'READONLY'];
/**
 * Administration du module budget : création, modification, clôture, suppression
 * des budgets et des lignes. Les non-admin n'ont qu'un accès en lecture aux lignes
 * dont ils sont gestionnaires (cf. backend `budget.ipc.ts`).
 */
export const BUDGET_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN'];
/** Alias historique : équivalent à BUDGET_WRITE_ROLES, conservé pour lisibilité. */
export const BUDGET_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/** Variante de couleur indiquant le niveau de consommation d'une ligne. */
export function consumptionVariant(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 1) return 'danger';
  if (rate >= 0.8) return 'warning';
  return 'success';
}

/** Couleur Tailwind de la barre de progression selon le taux de consommation. */
export function consumptionBarClass(rate: number): string {
  if (rate >= 1) return 'bg-red-500';
  if (rate >= 0.8) return 'bg-amber-500';
  return 'bg-emerald-500';
}
