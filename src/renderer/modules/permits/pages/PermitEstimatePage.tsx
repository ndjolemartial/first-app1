import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { usePermitEstimate, useDeletePermitEstimate, useSetPermitEstimateStatus } from '../hooks/usePermitProjects';
import PermitConvertToQuoteModal from '../components/PermitConvertToQuoteModal';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { FEE_CATEGORY_LABELS, ESTIMATE_STATUS_LABELS } from '../utils/permitLabels';
import { ArrowRight, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

export default function PermitEstimatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const estimateId = Number(id);
  const { data: res, isLoading } = usePermitEstimate(estimateId);
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const role = useAuthStore((s) => s.user?.role);
  const canDelete = !!role && DELETE_ROLES.includes(role);
  const canWrite = !!role && WRITE_ROLES.includes(role);
  const deleteEstimate = useDeletePermitEstimate();
  const setStatus = useSetPermitEstimateStatus();

  const estimate = res?.data;

  const grouped = useMemo(() => {
    if (!estimate) return [];
    const map = new Map<string, { category: string; lines: any[]; total: number }>();
    for (const l of estimate.lines ?? []) {
      const key = l.category;
      if (!map.has(key)) map.set(key, { category: key, lines: [], total: 0 });
      const g = map.get(key)!;
      g.lines.push(l);
      g.total += Number(l.montantHT);
    }
    return [...map.values()];
  }, [estimate]);

  if (isLoading || !estimate) {
    return <PageLayout title="Estimation" breadcrumbs={[{ label: 'Devis permis de construire', to: '/permits' }]}><div className="p-6 text-slate-400">Chargement…</div></PageLayout>;
  }

  return (
    <PageLayout
      title={estimate.reference}
      breadcrumbs={[
        { label: 'Devis permis de construire', to: '/permits' },
        { label: estimate.project?.nom ?? '', to: `/permits/projects/${estimate.projectId}` },
        { label: estimate.reference },
      ]}
      actions={<>
        {canWrite && estimate.status === 'BROUILLON' && (
          <Button variant="secondary" icon={<CheckCircle2 className="h-4 w-4" />} loading={setStatus.isPending}
            onClick={() => setStatus.mutate({ id: estimate.id, status: 'VALIDE' })}>Valider</Button>
        )}
        {canWrite && !estimate.quoteId && (
          <Button icon={<ArrowRight className="h-4 w-4" />} onClick={() => setConvertOpen(true)}>Créer le devis commercial</Button>
        )}
        {estimate.quoteId && (
          <Button variant="secondary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate(`/quotes/${estimate.quoteId}`)}>Voir le devis {estimate.quoteReference}</Button>
        )}
        {canDelete && (
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>Supprimer</Button>
        )}
      </>}
    >
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">Version {estimate.version}</span>
              <Badge variant={estimate.status === 'CONVERTI' ? 'success' : 'default'}>{ESTIMATE_STATUS_LABELS[estimate.status]}</Badge>
            </div>
            <span className="text-xs text-slate-400">Générée le {formatDate(estimate.generatedAt)}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><div className="text-xs text-slate-400">Honoraires Architecte</div><div className="font-semibold">{formatCurrency(Number(estimate.totalArchitecte))}</div></div>
            <div><div className="text-xs text-slate-400">Honoraires BET</div><div className="font-semibold">{formatCurrency(Number(estimate.totalBET))}</div></div>
            <div><div className="text-xs text-slate-400">Honoraires Géomètre</div><div className="font-semibold">{formatCurrency(Number(estimate.totalGeometre))}</div></div>
            <div><div className="text-xs text-slate-400">Études</div><div className="font-semibold">{formatCurrency(Number(estimate.totalEtudes))}</div></div>
            <div><div className="text-xs text-slate-400">Frais administratifs</div><div className="font-semibold">{formatCurrency(Number(estimate.totalFraisAdministratifs))}</div></div>
            <div><div className="text-xs text-slate-400">Taxes</div><div className="font-semibold">{formatCurrency(Number(estimate.totalTaxes))}</div></div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
            <div><div className="text-xs text-slate-400">Total HT</div><div className="text-lg font-bold text-slate-900">{formatCurrency(Number(estimate.totalHT))}</div></div>
            <div><div className="text-xs text-slate-400">TVA ({Number(estimate.tvaPct)}%)</div><div className="text-lg font-bold text-slate-900">{formatCurrency(Number(estimate.totalTVA))}</div></div>
            <div><div className="text-xs text-slate-400">Total TTC</div><div className="text-lg font-bold text-indigo-600">{formatCurrency(Number(estimate.totalTTC))}</div></div>
          </div>
          {estimate.warnings?.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {estimate.warnings.map((w: string, i: number) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {grouped.map((g) => (
          <Card key={g.category} className="!p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{FEE_CATEGORY_LABELS[g.category] ?? g.category}</h3>
              <span className="text-sm font-semibold text-slate-700">{formatCurrency(g.total)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {g.lines.map((l: any) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5 text-slate-700">{l.label}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs" title={l.trace ?? ''}>{l.trace}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(Number(l.montantHT))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>

      <PermitConvertToQuoteModal open={convertOpen} onClose={() => setConvertOpen(false)} estimate={estimate} />

      <ConfirmDialog open={deleteOpen} title="Supprimer l'estimation"
        message={`Supprimer l'estimation ${estimate.reference} ?`}
        confirmLabel="Supprimer" loading={deleteEstimate.isPending}
        onConfirm={async () => { const r = await deleteEstimate.mutateAsync(estimate.id); if (r.success) navigate(`/permits/projects/${estimate.projectId}`); }}
        onClose={() => setDeleteOpen(false)} />
    </PageLayout>
  );
}
