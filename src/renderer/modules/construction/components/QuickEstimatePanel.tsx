import { useEffect, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import { useQuickEstimate } from '../hooks/useConstructionProjects';
import { formatCurrency } from '../../../shared/utils/format';
import { LOT_PHASE_LABELS } from '../utils/constructionLabels';
import { Gauge, AlertTriangle } from 'lucide-react';

/**
 * Panneau « Niveau 1 — Estimation rapide », mis à jour en direct pendant la
 * saisie du formulaire (debounce). Utilise le même moteur que le Niveau 2 —
 * la fourchette affichée ne peut donc jamais contredire le devis détaillé
 * généré ensuite.
 */
export default function QuickEstimatePanel({ characteristics }: { characteristics: Record<string, unknown> }) {
  const [debounced, setDebounced] = useState(characteristics);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(characteristics), 500);
    return () => clearTimeout(t);
  }, [JSON.stringify(characteristics)]);

  const surface = Number(debounced.surfaceHabitable) || 0;
  const { data: res, isFetching } = useQuickEstimate({ characteristics: debounced }, surface > 0);
  const data = res?.data;

  // Tant que la surface habitable n'est pas renseignée, l'invite correspondante
  // est affichée en bannière en haut du formulaire (ConstructionProjectFormPage),
  // pas ici — ce panneau reste vide.
  if (surface <= 0) {
    return null;
  }

  return (
    <Card className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-slate-900">Estimation rapide (Niveau 1)</h3>
      </div>

      {!res?.success ? (
        <div className="text-sm text-red-500">{res?.error ? String(res.error) : 'Calcul en cours…'}</div>
      ) : data ? (
        <>
          <div className="text-center py-2">
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(data.budgetMin)} — {formatCurrency(data.budgetMax)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Budget prévisionnel (±{data.toleranceRangePct}%) · soit {formatCurrency(data.totalHT)} HT
            </div>
            {data.prixMoyenM2 != null && (
              <div className="text-xs text-slate-400 mt-0.5">≈ {formatCurrency(data.prixMoyenM2)} / m²</div>
            )}
          </div>

          <div className="mt-3 space-y-1.5">
            {data.byPhase.map((p: any) => (
              <div key={p.phase} className="flex items-center gap-2 text-xs">
                <span className="w-28 truncate text-slate-600">{LOT_PHASE_LABELS[p.phase] ?? p.phase}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, p.pct)}%` }} />
                </div>
                <span className="w-12 text-right text-slate-500">{p.pct}%</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>Couverture bibliothèque</span>
            <span className={data.coveragePct < 60 ? 'text-amber-600 font-medium' : 'text-slate-700'}>{data.coveragePct}%</span>
          </div>

          {data.warnings?.length > 0 && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{data.warnings.length} avertissement(s) — voir le détail après génération de l’estimation.</span>
            </div>
          )}
        </>
      ) : null}
    </Card>
  );
}
