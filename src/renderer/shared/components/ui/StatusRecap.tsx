import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

export interface StatusRecapItem {
  /** Valeur de filtre transmise à `onSelect` (ex. 'DISPONIBLE'). */
  key: string;
  label: string;
  icon: LucideIcon;
  /** Classes Tailwind pour la pastille (fond + texte de l'icône). */
  iconBg: string;
  iconColor: string;
  /** Couleur d'accent appliquée au chiffre quand la carte est active. */
  activeColor: string;
}

interface StatusRecapProps {
  items: StatusRecapItem[];
  stats: Record<string, number> | undefined;
  /** Valeur courante du filtre statut (chaîne vide = aucun filtre). */
  activeKey: string;
  /** Appelé avec la nouvelle valeur de filtre — chaîne vide pour réinitialiser. */
  onSelect: (key: string) => void;
  /** Total optionnel à afficher dans le bouton « Tous ». */
  total?: number;
}

/**
 * Récapitulatif horizontal d'un jeu d'entités par statut. Chaque carte est
 * cliquable et bascule le filtre courant (un second clic réinitialise).
 */
export default function StatusRecap({ items, stats, activeKey, onSelect, total }: StatusRecapProps) {
  const allActive = activeKey === '';
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
      <button
        type="button"
        onClick={() => onSelect('')}
        title="Total — toutes les entrées (cliquer pour réinitialiser le filtre statut)"
        className={clsx(
          'flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all',
          allActive
            ? 'border-slate-400 bg-slate-50'
            : 'border-slate-200 bg-white hover:bg-slate-50',
        )}
      >
        <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-slate-600">Σ</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 truncate">Total</p>
          <p className="text-xl font-semibold text-slate-900">{total ?? '—'}</p>
        </div>
      </button>
      {items.map(({ key, label, icon: Icon, iconBg, iconColor, activeColor }) => {
        const count = stats?.[key] ?? 0;
        const isActive = activeKey === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isActive ? '' : key)}
            title={`${label} — ${count} (cliquer pour filtrer)`}
            className={clsx(
              'flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all',
              isActive
                ? 'border-slate-400 bg-slate-50 shadow-sm'
                : 'border-slate-200 bg-white hover:bg-slate-50',
            )}
          >
            <div className={clsx('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
              <Icon className={clsx('h-5 w-5', iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate" title={label}>{label}</p>
              <p className={clsx('text-xl font-semibold', isActive ? activeColor : 'text-slate-900')}>
                {count}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
