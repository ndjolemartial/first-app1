import { useState } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatDate } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  useAmlSuspiciousReport, useUpdateAmlSuspiciousReport, useTransmitAmlSuspiciousReport, useClassifyAmlSuspiciousReport,
} from '../hooks/useAml';
import { REPORT_MOTIF_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_VARIANT, subjectDisplayName } from '../utils/aml.utils';

export default function AmlSuspiciousReportDetailPage() {
  const { id } = useParams();
  const userId = useAuthStore((s) => s.user?.id);
  const { data, isLoading } = useAmlSuspiciousReport(Number(id));
  const report = data?.data;
  const update = useUpdateAmlSuspiciousReport();
  const transmit = useTransmitAmlSuspiciousReport();
  const classify = useClassifyAmlSuspiciousReport();

  const [centifReference, setCentifReference] = useState('');
  const [classificationReason, setClassificationReason] = useState('');

  if (isLoading) return <PageLayout title="Déclaration de soupçon"><SkeletonTable rows={8} /></PageLayout>;
  if (!report) return <PageLayout title="Déclaration de soupçon">Déclaration introuvable.</PageLayout>;

  const canDecide = report.status === 'BROUILLON' || report.status === 'VALIDEE_INTERNE';

  return (
    <PageLayout title={`Déclaration ${report.reference}`} breadcrumbs={[{ label: 'Conformité LBC/FT', to: '/aml/suspicious-reports' }, { label: 'Déclarations de soupçon', to: '/aml/suspicious-reports' }, { label: report.reference }]}>
      <Card className="max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">{subjectDisplayName(report.subject)}</div>
            <div className="text-sm text-slate-500">{report.subjectType === 'CLIENT' ? 'Client' : 'Propriétaire'} — déposée par {report.declaredByName ?? '—'} le {formatDate(report.createdAt)}</div>
          </div>
          <Badge variant={REPORT_STATUS_VARIANT[report.status]}>{REPORT_STATUS_LABEL[report.status]}</Badge>
        </div>

        {report.motifCategory && <Badge variant="default">{REPORT_MOTIF_LABEL[report.motifCategory]}</Badge>}
        <div className="text-sm"><div className="text-slate-400">Motif</div><p className="whitespace-pre-wrap text-slate-700">{report.motif}</p></div>

        {report.status === 'BROUILLON' && (
          <Button size="sm" variant="secondary" loading={update.isPending}
            onClick={() => update.mutate({ id: report.id, payload: { complianceOfficerId: userId } })}>
            Prendre en charge (valider en interne)
          </Button>
        )}

        {report.status === 'TRANSMISE_CENTIF' && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="text-slate-400">Transmise le {formatDate(report.transmittedAt!)} par {report.transmittedByName}</div>
            <div className="font-medium text-slate-900">Réf. CENTIF : {report.centifReference}</div>
          </div>
        )}
        {report.status === 'CLASSEE_SANS_SUITE' && report.classificationReason && (
          <div className="text-sm"><div className="text-slate-400">Motif de classement sans suite</div><p className="text-slate-700">{report.classificationReason}</p></div>
        )}

        {canDecide && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="space-y-2">
              <Input label="Référence de l'accusé de réception CENTIF" value={centifReference} onChange={(e) => setCentifReference(e.target.value)} />
              <Button variant="danger" disabled={!centifReference.trim()} loading={transmit.isPending}
                onClick={() => transmit.mutate({ id: report.id, payload: { centifReference: centifReference.trim() } })}>
                Transmettre à la CENTIF
              </Button>
            </div>
            <div className="space-y-2">
              <Textarea label="Motif de classement sans suite" rows={2} value={classificationReason} onChange={(e) => setClassificationReason(e.target.value)} />
              <Button variant="secondary" disabled={!classificationReason.trim()} loading={classify.isPending}
                onClick={() => classify.mutate({ id: report.id, payload: { classificationReason: classificationReason.trim() } })}>
                Classer sans suite
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
