import type { ExportColumn } from '../components/ExportMenu';
import type { TimelineItem } from '../components/EntityTimeline';
import { CATEGORY_LABEL } from '../components/EntityTimeline';
import { formatDateTime, formatCurrency } from './format';

/** Colonnes d'export/impression communes à la fiche de suivi Client et Prospect. */
export const TIMELINE_EXPORT_COLUMNS: ExportColumn<TimelineItem>[] = [
  { header: 'Date', cell: (i) => formatDateTime(i.date) },
  { header: 'Catégorie', cell: (i) => CATEGORY_LABEL[i.category] ?? i.category },
  { header: 'Titre', cell: (i) => i.title },
  { header: 'Détail', cell: (i) => i.description ?? '' },
  { header: 'Montant', cell: (i) => (i.amount != null ? formatCurrency(i.amount) : '') },
  { header: 'Utilisateur', cell: (i) => (i.user ? `${i.user.lastName} ${i.user.firstName}` : '') },
];
