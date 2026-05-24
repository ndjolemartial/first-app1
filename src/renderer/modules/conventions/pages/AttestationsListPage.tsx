import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useAttestations, useDeleteAttestation, useAttestationsTypeStats } from '../hooks/useAttestations';
import { ATTESTATION_TYPE_LABELS } from '../utils/attestationTemplate';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import StatusRecap, { type StatusRecapItem } from '../../../shared/components/ui/StatusRecap';
import { Plus, Eye, Trash2, FileText, FileSignature, ArrowRightLeft, Wallet, Building2 } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  ...Object.entries(ATTESTATION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const TYPE_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  ATTRIBUTION: 'info',
  CESSION: 'warning',
  SOLDE: 'success',
  TRANSFERT_PROPRIETE: 'default',
};

const TYPE_RECAP_ITEMS: StatusRecapItem[] = [
  { key: 'ATTRIBUTION',         label: 'Attribution',  icon: FileSignature,  iconBg: 'bg-sky-100',     iconColor: 'text-sky-600',     activeColor: 'text-sky-700' },
  { key: 'CESSION',             label: 'Cession',      icon: ArrowRightLeft, iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   activeColor: 'text-amber-700' },
  { key: 'SOLDE',               label: 'Solde',        icon: Wallet,         iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', activeColor: 'text-emerald-700' },
  { key: 'TRANSFERT_PROPRIETE', label: 'Transfert',    icon: Building2,      iconBg: 'bg-purple-100',  iconColor: 'text-purple-600',  activeColor: 'text-purple-700' },
];

function clientName(c: any): string {
  if (!c) return '—';
  return c.type === 'INDIVIDUEL'
    ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
    : (c.entreprise ?? '—');
}

export default function AttestationsListPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAttestations({
    type: type || undefined,
    search: search || undefined,
  });
  // Stats : mêmes filtres SAUF le type.
  const { data: statsRes } = useAttestationsTypeStats({ search: search || undefined });
  const stats = statsRes?.success ? statsRes.data : undefined;
  const deleteAttestation = useDeleteAttestation();
  const [toDelete, setToDelete] = useState<any>(null);

  const items: any[] = data?.data ?? [];

  const handleDelete = async () => {
    if (toDelete) await deleteAttestation.mutateAsync(toDelete.id);
    setToDelete(null);
  };

  return (
    <PageLayout
      title="Attestations"
      breadcrumbs={[{ label: 'Conventions', to: '/conventions' }, { label: 'Attestations' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/conventions/attestations/new')}>
          Nouvelle attestation
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="w-64">
          <Select label="Type d'attestation" options={TYPE_OPTIONS} value={type}
            onChange={(e) => setType(e.target.value)} />
        </div>
        <div className="w-64">
          <Input label="Recherche (référence, notes)" value={search}
            onChange={(e) => setSearch(e.target.value)} placeholder="ATT-2026-…" />
        </div>
      </Card>

      <div className="mb-4">
        <StatusRecap
          items={TYPE_RECAP_ITEMS}
          stats={stats}
          total={stats?.total}
          activeKey={type}
          onSelect={(k) => setType(k)}
        />
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucune attestation"
            description="Émettez votre première attestation depuis cette page ou directement depuis une convention."
            action={{ label: 'Nouvelle attestation', onClick: () => navigate('/conventions/attestations/new') }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Bénéficiaire</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Bien / Terrain</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Émise le</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Montant</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="font-medium text-slate-900">{a.reference}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={TYPE_BADGE[a.type] ?? 'default'}>
                      {ATTESTATION_TYPE_LABELS[a.type] ?? a.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{clientName(a.client)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.terrain?.reference ?? a.property?.reference ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(a.emittedAt)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {a.amount != null ? formatCurrency(Number(a.amount)) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                        onClick={() => navigate(`/conventions/attestations/${a.id}`)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => setToDelete(a)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer l'attestation"
        message={`Supprimer l'attestation « ${toDelete?.reference ?? ''} » ?`}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </PageLayout>
  );
}
