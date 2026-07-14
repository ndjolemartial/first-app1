import { FilePlus, RefreshCw, Pencil, CheckSquare, Banknote, FileText } from 'lucide-react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import { formatDateTime, formatCurrency } from '../utils/format';

export interface TimelineItem {
  date: string;
  category: 'CREATION' | 'STATUS_CHANGE' | 'MODIFICATION' | 'CRM_ACTIVITY' | 'PAYMENT' | 'CONVENTION' | 'DOCUMENT';
  title: string;
  description?: string | null;
  amount?: number | null;
  user?: { id: number; firstName: string; lastName: string } | null;
  meta?: Record<string, any>;
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  CREATION: <FilePlus className="h-4 w-4" />,
  STATUS_CHANGE: <RefreshCw className="h-4 w-4" />,
  MODIFICATION: <Pencil className="h-4 w-4" />,
  CRM_ACTIVITY: <CheckSquare className="h-4 w-4" />,
  PAYMENT: <Banknote className="h-4 w-4" />,
  CONVENTION: <FileText className="h-4 w-4" />,
  DOCUMENT: <FileText className="h-4 w-4" />,
};

const CATEGORY_ICON_BG: Record<string, string> = {
  CREATION: 'bg-slate-100 text-slate-600',
  STATUS_CHANGE: 'bg-blue-100 text-blue-600',
  MODIFICATION: 'bg-amber-100 text-amber-600',
  CRM_ACTIVITY: 'bg-purple-100 text-purple-600',
  PAYMENT: 'bg-green-100 text-green-600',
  CONVENTION: 'bg-indigo-100 text-indigo-600',
  DOCUMENT: 'bg-slate-100 text-slate-600',
};

const CATEGORY_BADGE_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'purple' | 'success'> = {
  CREATION: 'default',
  STATUS_CHANGE: 'info',
  MODIFICATION: 'warning',
  CRM_ACTIVITY: 'purple',
  PAYMENT: 'success',
  CONVENTION: 'info',
  DOCUMENT: 'default',
};

export const CATEGORY_LABEL: Record<string, string> = {
  CREATION: 'Création',
  STATUS_CHANGE: 'Statut',
  MODIFICATION: 'Modification',
  CRM_ACTIVITY: 'Activité CRM',
  PAYMENT: 'Paiement',
  CONVENTION: 'Convention',
  DOCUMENT: 'Document',
};

interface Props {
  items: TimelineItem[];
  isLoading?: boolean;
}

/**
 * Fiche de suivi chronologique : agrège en une seule frise, du plus récent
 * au plus ancien, les changements de statut, les modifications de fiche,
 * les activités CRM, les documents importés et — pour un client — les
 * paiements reçus et les conventions liées (création/signature).
 */
export default function EntityTimeline({ items, isLoading }: Props) {
  if (isLoading) {
    return <Card><p className="text-sm text-slate-500">Chargement de la fiche de suivi…</p></Card>;
  }
  if (!items.length) {
    return (
      <EmptyState
        title="Aucune activité enregistrée"
        description="Rien à afficher pour le moment sur cette fiche."
      />
    );
  }
  return (
    <Card>
      <div>
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 pb-6 last:pb-0 relative">
            {i < items.length - 1 && (
              <div className="absolute left-4 top-9 bottom-0 w-px bg-slate-200" />
            )}
            <div className={`relative z-10 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${CATEGORY_ICON_BG[item.category] ?? 'bg-slate-100 text-slate-600'}`}>
              {CATEGORY_ICON[item.category]}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={CATEGORY_BADGE_VARIANT[item.category] ?? 'default'}>
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </Badge>
                <span className="text-xs text-slate-400">{formatDateTime(item.date)}</span>
              </div>
              <p className="text-sm font-medium text-slate-900 mt-1">{item.title}</p>
              {item.description && (
                <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{item.description}</p>
              )}
              {item.amount != null && (
                <p className="text-sm font-semibold text-green-700 mt-0.5">{formatCurrency(item.amount)}</p>
              )}
              {item.user && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Par {item.user.lastName} {item.user.firstName}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
