import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { formatDate } from '../../../shared/utils/format';
import { useAmlSuspiciousReports } from '../hooks/useAml';
import { REPORT_STATUS_LABEL, REPORT_STATUS_VARIANT, subjectDisplayName } from '../utils/aml.utils';
import { AlertTriangle } from 'lucide-react';

export default function AmlSuspiciousReportsListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useAmlSuspiciousReports({ status: status || undefined }, 1, 50);
  const reports = data?.data ?? [];

  return (
    <PageLayout title="Déclarations de soupçon" breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Déclarations de soupçon' }]}>
      <Card className="mb-4 w-52">
        <Select label="Statut" placeholder="Tous statuts"
          options={Object.entries(REPORT_STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          value={status} onChange={(e) => setStatus(e.target.value)} />
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : reports.length === 0 ? (
          <EmptyState icon={<AlertTriangle className="h-10 w-10" />} title="Aucune déclaration de soupçon" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Sujet</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Déclarant</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Déposée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((r: any) => (
                <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/aml/suspicious-reports/${r.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.reference}</td>
                  <td className="px-4 py-3 text-slate-700">{subjectDisplayName(r.subject)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.declaredByName ?? '—'}</td>
                  <td className="px-4 py-3"><Badge variant={REPORT_STATUS_VARIANT[r.status]}>{REPORT_STATUS_LABEL[r.status]}</Badge></td>
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
