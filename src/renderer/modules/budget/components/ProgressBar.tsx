import { clsx } from 'clsx';
import { consumptionBarClass } from '../utils/budget.utils';

interface ProgressBarProps {
  /** Taux de consommation entre 0 et 1 (peut excéder 1 en cas de dépassement). */
  rate: number;
  /** Affiche le pourcentage à droite de la barre. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Barre de progression colorée selon le niveau de consommation budgétaire
 * (vert < 80%, ambre 80–100%, rouge ≥ 100%).
 */
export default function ProgressBar({ rate, showLabel = true, className }: ProgressBarProps) {
  const clamped = Math.min(Math.max(rate, 0), 1);
  const pct = Math.round(clamped * 100);
  const realPct = Math.round(rate * 100);
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full transition-all', consumptionBarClass(rate))}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-slate-600 w-10 text-right">{realPct}%</span>
      )}
    </div>
  );
}
