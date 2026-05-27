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

/**
 * Formate une valeur de civilité stockée en majuscules (`MONSIEUR`,
 * `MADAME`, `MADEMOISELLE`) pour l'affichage : première lettre en majuscule,
 * reste en minuscules (« Monsieur », « Madame », « Mademoiselle »).
 * Retourne une chaîne vide pour une valeur absente.
 */
export function formatCivilite(value?: string | null): string {
  if (!value) return '';
  const v = String(value).trim();
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

export function fullName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = '—'
): string {
  const parts = [lastName, firstName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : fallback;
}

/**
 * Formate le nom d'une personne (client, propriétaire, prospect, apporteur
 * d'affaires, utilisateur) au format « Nom Prénom » pour l'affichage dans
 * les sélecteurs. Gère également les personnes morales (entreprise /
 * raison sociale) et retombe sur le fallback si rien n'est renseigné.
 */
export function formatPersonName(
  person: {
    firstName?: string | null;
    lastName?: string | null;
    entreprise?: string | null;
    companyName?: string | null;
    type?: string | null;
  } | null | undefined,
  fallback = '—',
): string {
  if (!person) return fallback;
  // Personne morale : on privilégie la raison sociale.
  const business = person.entreprise || person.companyName;
  if (person.type === 'ENTREPRISE' && business) return business;
  const parts = [person.lastName, person.firstName].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return business || fallback;
}
