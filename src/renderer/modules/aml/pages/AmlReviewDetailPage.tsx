import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatDate } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAmlReview, useCloseAmlReview } from '../hooks/useAml';
import ReportSuspicionButton from '../components/ReportSuspicionButton';
import { REVIEW_STATUS_LABEL, REVIEW_STATUS_VARIANT, REVIEW_TRIGGER_LABEL, reviewSourceLabel, reviewSourceBadgeVariant, subjectDisplayName } from '../utils/aml.utils';

const AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];

export default function AmlReviewDetailPage() {
  const { id } = useParams();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = AML_ROLES.includes(role);
  const { data, isLoading } = useAmlReview(Number(id));
  const review = data?.data;
  const closeReview = useCloseAmlReview();
  const [conclusion, setConclusion] = useState('');

  if (isLoading) return <PageLayout title="Revue de transaction"><SkeletonTable rows={8} /></PageLayout>;
  if (!review) return <PageLayout title="Revue de transaction">Revue introuvable.</PageLayout>;

  const isOpen = review.status === 'OUVERTE' || review.status === 'EN_COURS';

  return (
    <PageLayout title={`Revue ${review.reference}`} breadcrumbs={[{ label: 'Conformité LBC/FT', to: '/aml/reviews' }, { label: 'Revues de transaction', to: '/aml/reviews' }, { label: review.reference }]}
      actions={isOpen && <ReportSuspicionButton subjectType={review.subjectType} subjectId={review.subjectId} conventionId={review.conventionId ?? undefined} />}
    >
      <Card className="max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={reviewSourceBadgeVariant(review)}>{reviewSourceLabel(review)}</Badge>
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{review.sourceLabel ?? '—'}</div>
            <div className="text-sm text-slate-500">{subjectDisplayName(review.subject)}</div>
          </div>
          <Badge variant={REVIEW_STATUS_VARIANT[review.status]}>{REVIEW_STATUS_LABEL[review.status]}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div><div className="text-slate-400">Motif</div><div className="text-slate-900">{REVIEW_TRIGGER_LABEL[review.triggerReason]}</div></div>
          <div><div className="text-slate-400">Montant</div><div className="text-slate-900">{review.amount ? Number(review.amount).toLocaleString('fr-FR') + ' FCFA' : '—'}</div></div>
          <div><div className="text-slate-400">Mode de paiement</div><div className="text-slate-900">{review.paymentMethod ?? '—'}</div></div>
          <div><div className="text-slate-400">Créée le</div><div className="text-slate-900">{formatDate(review.createdAt)}</div></div>
        </div>

        {review.conclusion && (
          <div className="text-sm"><div className="text-slate-400">Conclusion</div><p className="text-slate-700">{review.conclusion}</p></div>
        )}

        {canWrite && isOpen && (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <Textarea label="Conclusion de la revue" rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="secondary" loading={closeReview.isPending}
                onClick={() => closeReview.mutate({ id: review.id, payload: { status: 'CLOTUREE_RAS', conclusion } })}>
                Clôturer — RAS
              </Button>
              <Button variant="danger" loading={closeReview.isPending}
                onClick={() => closeReview.mutate({ id: review.id, payload: { status: 'CLOTUREE_DECLAREE', conclusion } })}>
                Clôturer — donne lieu à déclaration
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
