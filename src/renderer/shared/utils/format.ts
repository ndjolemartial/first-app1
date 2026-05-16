import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr });
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = 'XOF'
): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('fr-CI', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(Number(amount));
}

export function fullName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = '—'
): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : fallback;
}
