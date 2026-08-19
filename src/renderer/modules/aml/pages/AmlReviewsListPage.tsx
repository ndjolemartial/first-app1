import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { formatDate } from '../../../shared/utils/format';
import { useAmlReviews, useAmlPendingCandidates, useCreateAmlReview } from '../hooks/useAml';
import { REVIEW_STATUS_LABEL, REVIEW_STATUS_VARIANT, REVIEW_TRIGGER_LABEL, reviewSourceLabel, reviewSourceBadgeVariant, subjectDisplayName } from '../utils/aml.utils';
import Button from '../../../shared/components/ui/Button';
import { Radar } from 'lucide-react';
import type { AmlReviewCandidate } from '../types/aml.types';

export default function AmlReviewsListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useAmlReviews({ status: status || undefined }, 1, 50);
  const { data: candidatesData } = useAmlPendingCandidates();
  const createReview = useCreateAmlReview();

  const reviews = data?.data ?? [];
  const candidates: AmlReviewCandidate[] = candidatesData?.data ?? [];

  // Seul critère de candidature automatique désormais : le montant dépasse
  // le seuil « élevé » paramétrable (cf. aml:reviews:pendingCandidates).
  const openFromCandidate = async (c: AmlReviewCandidate) => {
    const res: any = await createReview.mutateAsync({
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      conventionId: c.conventionId ?? undefined,
      sourceLabel: c.label,
      subjectType: 'CLIENT',
      subjectId: c.clientId,
      triggerReason: 'SEUIL_MONTANT',
      amount: c.amount,
      paymentMethod: c.paymentMethod,
    });
    if (res.success) navigate(`/aml/reviews/${res.data.id}`);
  };

  return (
    <PageLayout title="Revues de transaction" breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Revues de transaction' }]}>
      {candidates.length > 0 && (
        <Card className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Encaissements candidats (non encore en revue)</h3>
          <ul className="space-y-1.5">
            {candidates.map((c) => (
              <li key={`${c.sourceType}-${c.sourceId}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant={reviewSourceBadgeVariant(c)}>{reviewSourceLabel(c)}</Badge>
                  {c.label} — {subjectDisplayName(c.client)} — {c.amount.toLocaleString('fr-FR')} FCFA {c.paymentMethod === 'ESPECE' ? '(espèces)' : ''}
                </span>
                <Button size="sm" variant="secondary" onClick={() => openFromCandidate(c)}>Ouvrir une revue</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-4 w-52">
        <Select label="Statut" placeholder="Tous statuts"
          options={Object.entries(REVIEW_STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          value={status} onChange={(e) => setStatus(e.target.value)} />
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : reviews.length === 0 ? (
          <EmptyState icon={<Radar className="h-10 w-10" />} title="Aucune revue de transaction" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Source</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Motif</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Montant</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Créée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reviews.map((r: any) => (
                <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/aml/reviews/${r.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.reference}</td>
                  <td className="px-4 py-3 text-slate-700">{r.sourceLabel ?? reviewSourceLabel(r)}</td>
                  <td className="px-4 py-3 text-slate-600">{REVIEW_TRIGGER_LABEL[r.triggerReason]}</td>
                  <td className="px-4 py-3 text-slate-600">{r.amount ? Number(r.amount).toLocaleString('fr-FR') + ' FCFA' : '—'}</td>
                  <td className="px-4 py-3"><Badge variant={REVIEW_STATUS_VARIANT[r.status]}>{REVIEW_STATUS_LABEL[r.status]}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </PageLayout>
  );
}
