import { X } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';

/**
 * Teinte reprise de RegistersTabs.tsx (Notifications=amber, Échanges=sky,
 * DSTE=emerald, Opérations suspectes=rose) — même repère visuel entre la
 * barre d'onglets et la fenêtre de détail d'une ligne.
 */
export type RegisterAccent = 'amber' | 'sky' | 'emerald' | 'rose';

const ACCENTS: Record<RegisterAccent, {
  headerBg: string; headerBorder: string; headerText: string; headerSubtext: string;
  iconBg: string; fieldIconBg: string; fieldIconText: string;
  highlightBg: string; highlightBorder: string;
}> = {
  amber: {
    headerBg: 'bg-amber-50', headerBorder: 'border-amber-200', headerText: 'text-amber-900', headerSubtext: 'text-amber-600',
    iconBg: 'bg-amber-500', fieldIconBg: 'bg-amber-100', fieldIconText: 'text-amber-600',
    highlightBg: 'bg-amber-50/70', highlightBorder: 'border-amber-400',
  },
  sky: {
    headerBg: 'bg-sky-50', headerBorder: 'border-sky-200', headerText: 'text-sky-900', headerSubtext: 'text-sky-600',
    iconBg: 'bg-sky-500', fieldIconBg: 'bg-sky-100', fieldIconText: 'text-sky-600',
    highlightBg: 'bg-sky-50/70', highlightBorder: 'border-sky-400',
  },
  emerald: {
    headerBg: 'bg-emerald-50', headerBorder: 'border-emerald-200', headerText: 'text-emerald-900', headerSubtext: 'text-emerald-600',
    iconBg: 'bg-emerald-500', fieldIconBg: 'bg-emerald-100', fieldIconText: 'text-emerald-600',
    highlightBg: 'bg-emerald-50/70', highlightBorder: 'border-emerald-400',
  },
  rose: {
    headerBg: 'bg-rose-50', headerBorder: 'border-rose-200', headerText: 'text-rose-900', headerSubtext: 'text-rose-600',
    iconBg: 'bg-rose-500', fieldIconBg: 'bg-rose-100', fieldIconText: 'text-rose-600',
    highlightBg: 'bg-rose-50/70', highlightBorder: 'border-rose-400',
  },
};

export interface RegisterDetailField {
  key: string;
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Occupe toute la largeur, rendu dans un bloc mis en évidence (texte long : description, notes…). */
  full?: boolean;
}

interface RegisterDetailModalProps {
  open: boolean;
  onClose: () => void;
  accent: RegisterAccent;
  icon: React.ReactNode;
  eyebrow: string;
  reference?: string | null;
  badge?: React.ReactNode;
  fields: RegisterDetailField[];
}

export default function RegisterDetailModal({
  open, onClose, accent, icon, eyebrow, reference, badge, fields,
}: RegisterDetailModalProps) {
  if (!open) return null;
  const c = ACCENTS[accent];
  const compact = fields.filter((f) => !f.full);
  const full = fields.filter((f) => f.full);

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className={`-mx-6 -mt-4 mb-5 flex items-center justify-between gap-3 rounded-t-xl border-b px-6 py-4 ${c.headerBg} ${c.headerBorder}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${c.iconBg}`}>
            {icon}
          </span>
          <div className="min-w-0">
            <div className={`text-xs font-semibold uppercase tracking-wider ${c.headerSubtext}`}>{eyebrow}</div>
            <div className={`truncate text-lg font-bold ${c.headerText}`}>{reference || '—'}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/70 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {compact.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {compact.map((f) => (
            <div key={f.key} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              {f.icon && (
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.fieldIconBg} ${c.fieldIconText}`}>
                  {f.icon}
                </span>
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{f.label}</div>
                <div className="mt-0.5 break-words text-sm font-medium text-slate-800">
                  {f.value || <span className="font-normal text-slate-300">—</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {full.length > 0 && (
        <div className="mt-3 space-y-3">
          {full.map((f) => (
            <div key={f.key} className={`rounded-xl border-l-4 p-3.5 ${c.highlightBorder} ${c.highlightBg}`}>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {f.icon}
                {f.label}
              </div>
              <div className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">
                {f.value || <span className="text-slate-300">—</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
