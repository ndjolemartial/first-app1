import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import Pagination from '../../../shared/components/ui/Pagination';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { formatDate } from '../../../shared/utils/format';
import { useAmlProfiles } from '../hooks/useAml';
import AmlRiskBadge from '../components/AmlRiskBadge';
import { PROFILE_STATUS_LABEL, PROFILE_STATUS_VARIANT, RISK_LEVEL_LABEL, subjectDisplayName } from '../utils/aml.utils';
import type { AmlProfile } from '../types/aml.types';
import { Plus, ShieldAlert } from 'lucide-react';

export default function AmlProfilesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [riskLevel, setRiskLevel] = useState('');
  const [status, setStatus] = useState('');
  const filters = { riskLevel: riskLevel || undefined, status: status || undefined };

  const { data, isLoading } = useAmlProfiles(filters, page, 20);
  const profiles: AmlProfile[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Profils LBC/FT"
      breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Profils' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/aml/profiles/new')}>
          Nouveau profil
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select label="Niveau de risque" placeholder="Tous niveaux"
            options={Object.entries(RISK_LEVEL_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }} />
        </div>
        <div className="w-52">
          <Select label="Statut" placeholder="Tous statuts"
            options={Object.entries(PROFILE_STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : profiles.length === 0 ? (
          <EmptyState icon={<ShieldAlert className="h-10 w-10" />} title="Aucun profil LBC/FT enregistré"
            action={{ label: 'Nouveau profil', onClick: () => navigate('/aml/profiles/new') }} />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Sujet</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Risque</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">PPE</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Créé le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((p) => (
                  <tr key={p.id} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => navigate(`/aml/profiles/${p.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.reference}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {subjectDisplayName(p.subject)}
                      <span className="ml-2 text-xs text-slate-400">{p.subjectType === 'CLIENT' ? 'Client' : 'Propriétaire'}</span>
                    </td>
                    <td className="px-4 py-3"><AmlRiskBadge level={p.riskLevel} /></td>
                    <td className="px-4 py-3"><Badge variant={PROFILE_STATUS_VARIANT[p.status]}>{PROFILE_STATUS_LABEL[p.status]}</Badge></td>
                    <td className="px-4 py-3">{p.isPep ? <Badge variant="danger">PPE</Badge> : '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </Card>
    </PageLayout>
  );
}
