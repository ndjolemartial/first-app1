import { useEffect, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import { usePermitQuickEstimate } from '../hooks/usePermitProjects';
import { formatCurrency } from '../../../shared/utils/format';
import { Gauge, AlertTriangle } from 'lucide-react';

const BUCKET_LABELS: Record<string, string> = {
  totalArchitecte: 'Honoraires Architecte',
  totalBET: 'Honoraires BET',
  totalGeometre: 'Honoraires Géomètre',
  totalEtudes: 'Études',
  totalFraisAdministratifs: 'Frais administratifs',
  totalTaxes: 'Taxes',
};

/**
 * Panneau « Estimation rapide », mis à jour en direct pendant la saisie du
 * formulaire (debounce) — même moteur que la génération persistée, la
 * fourchette affichée ici ne peut donc jamais contredire l'estimation
 * générée ensuite.
 */
export default function PermitQuickEstimatePanel({ characteristics }: { characteristics: Record<string, unknown> }) {
  const [debounced, setDebounced] = useState(characteristics);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(characteristics), 500);
    return () => clearTimeout(t);
  }, [JSON.stringify(characteristics)]);

  const surfaceBatie = Number(debounced.surfaceBatie) || 0;
  const { data: res, isFetching } = usePermitQuickEstimate({ characteristics: debounced }, surfaceBatie > 0);
  const data = res?.data;

  if (surfaceBatie <= 0) return null;

  return (
    <Card className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-slate-900">Estimation rapide</h3>
      </div>

      {!res?.success ? (
        <div className="text-sm text-red-500">{res?.error ? String(res.error) : 'Calcul en cours…'}</div>
      ) : data ? (
        <>
          <div className="text-center py-2">
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.totalTTC)}</div>
            <div className="text-xs text-slate-500 mt-1">
              TTC · soit {formatCurrency(data.totalHT)} HT + {formatCurrency(data.totalTVA)} TVA ({data.tvaPct}%)
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {Object.entries(BUCKET_LABELS).filter(([k]) => Number(data[k]) > 0).map(([k, label]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-40 truncate text-slate-600">{label}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${data.totalHT > 0 ? Math.min(100, (Number(data[k]) / data.totalHT) * 100) : 0}%` }} />
                </div>
                <span className="w-24 text-right text-slate-500">{formatCurrency(Number(data[k]))}</span>
              </div>
            ))}
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
