import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Pagination from '../../../shared/components/ui/Pagination';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useConventions, useConventionsStatusStats } from '../hooks/useConventions';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import StatusRecap, { type StatusRecapItem } from '../../../shared/components/ui/StatusRecap';
import { Plus, Eye, Edit, FileText, Award, FilePen, Clock, CheckCircle2, CalendarX, XCircle } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'RENTAL_UNFURNISHED', label: 'Location non meublée' },
  { value: 'RENTAL_FURNISHED', label: 'Location meublée' },
  { value: 'SALE', label: 'Vente' },
  { value: 'MANAGEMENT', label: 'Gestion' },
  { value: 'COMMERCIAL_LEASE', label: 'Bail commercial' },
  { value: 'SOUSCRIPTION', label: 'Souscription' },
  { value: 'AVENANT', label: 'Avenant' },
  { value: 'RESILIATION', label: 'Résiliation' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ATTENTE_SIGNATURE', label: 'Attente signature' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRE', label: 'Expirée' },
  { value: 'ANNULE', label: 'Annulée' },
];

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success', BROUILLON: 'info', ATTENTE_SIGNATURE: 'warning',
  EXPIRE: 'danger', TERMINER: 'default', ANNULE: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active', BROUILLON: 'Brouillon', ATTENTE_SIGNATURE: 'Attente signature',
  EXPIRE: 'Expirée', TERMINER: 'Terminée', ANNULE: 'Annulée',
};

const TYPE_LABEL: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Location', RENTAL_FURNISHED: 'Loc. meublée',
  SALE: 'Vente', MANAGEMENT: 'Gestion', COMMERCIAL_LEASE: 'Bail comm.',
  SOUSCRIPTION: 'Souscription', AVENANT: 'Avenant', RESILIATION: 'Résiliation',
};

const AMENDMENT_TYPE_LABEL: Record<string, string> = {
  PROLONGATION_DELAI:  'Avenant de prolongation de délai',
  TRANSFERT_PROPRIETE: 'Avenant de transfert de propriété',
  TRANSFERT_SITE:      'Avenant de transfert de site / changement de lot',
};

const SOUSCRIPTION_TYPE_LABEL: Record<string, string> = {
  STANDARD:           'Convention de souscription',
  AVEC_ACD:           'Convention de souscription avec ACD',
  FINANCEMENT_PROJET: 'Convention de financement sur projet',
};

/** Libellé détaillé : combine le type avec la nature de l'avenant ou de la souscription. */
function conventionTypeLabel(c: { type?: string; amendmentType?: string | null; souscriptionType?: string | null }): string {
  if (c.type === 'AVENANT' && c.amendmentType && AMENDMENT_TYPE_LABEL[c.amendmentType]) {
    return AMENDMENT_TYPE_LABEL[c.amendmentType];
  }
  if (c.type === 'SOUSCRIPTION' && c.souscriptionType && SOUSCRIPTION_TYPE_LABEL[c.souscriptionType]) {
    return SOUSCRIPTION_TYPE_LABEL[c.souscriptionType];
  }
  return TYPE_LABEL[c.type ?? ''] ?? (c.type ?? '');
}

const STATUS_RECAP_ITEMS: StatusRecapItem[] = [
  { key: 'BROUILLON',         label: 'Brouillons',    icon: FilePen,       iconBg: 'bg-slate-100',   iconColor: 'text-slate-600',   activeColor: 'text-slate-800' },
  { key: 'ATTENTE_SIGNATURE', label: 'Attente sign.', icon: Clock,         iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   activeColor: 'text-amber-700' },
  { key: 'ACTIVE',            label: 'Actives',       icon: CheckCircle2,  iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', activeColor: 'text-emerald-700' },
  { key: 'EXPIRE',            label: 'Expirées',      icon: CalendarX,     iconBg: 'bg-red-100',     iconColor: 'text-red-600',     activeColor: 'text-red-700' },
  { key: 'ANNULE',            label: 'Annulées',      icon: XCircle,       iconBg: 'bg-rose-100',    iconColor: 'text-rose-600',    activeColor: 'text-rose-700' },
];

export default function ConventionsListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const filters = {
    search: search || undefined,
    type: type || undefined,
    status: status || undefined,
  };
  const { data, isLoading } = useConventions(filters, page, 20);
  // Stats : mêmes filtres SAUF le statut.
  const { data: statsRes } = useConventionsStatusStats({
    search: search || undefined,
    type: type || undefined,
  });
  const stats = statsRes?.success ? statsRes.data : undefined;
  const conventions: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des conventions"
      breadcrumbs={[{ label: 'Conventions' }]}
      actions={
        <div className="flex gap-2">
          <Button icon={<Award className="h-4 w-4" />}
            onClick={() => navigate('/conventions/attestations')}>
            Attestations
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/conventions/new')}>
            Nouvelle convention
          </Button>
        </div>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Rechercher" placeholder="Référence, client…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-48">
          <Select label="Type" options={TYPE_OPTIONS} value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }} />
        </div>
        <div className="w-48">
          <Select label="Statut" options={STATUS_OPTIONS} value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <div className="mb-4">
        <StatusRecap
          items={STATUS_RECAP_ITEMS}
          stats={stats}
          total={stats?.total}
          activeKey={status}
          onSelect={(k) => { setStatus(k); setPage(1); }}
        />
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : conventions.length === 0 ? (
          <EmptyState
            title="Aucune convention trouvée"
            description="Commencez par créer une convention de location ou de vente."
            action={{ label: 'Nouvelle convention', onClick: () => navigate('/conventions/new') }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Bien / Terrain</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Montant</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Début</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conventions.map((c: any) => {
                  const clientName = c.client?.type === 'INDIVIDUEL'
                    ? `${c.client?.firstName ?? ''} ${c.client?.lastName ?? ''}`.trim()
                    : (c.client?.entreprise ?? '—');
                  const amount = c.rentAmount ?? c.saleAmount;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-indigo-600" />
                          </div>
                          <span className="font-medium text-slate-900">{c.reference}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{conventionTypeLabel(c)}</td>
                      <td className="px-4 py-3">
                        {c.assetType === 'TERRAIN' ? (() => {
                          const refs = (c.terrains ?? [])
                            .map((l: any) => l.terrain?.reference)
                            .filter(Boolean);
                          const shown = refs.slice(0, 2).join(', ');
                          const extra = refs.length > 2 ? ` +${refs.length - 2}` : '';
                          return (
                            <>
                              <p className="text-slate-800" title={refs.join(', ')}>{shown || '—'}{extra}</p>
                              <p className="text-xs text-slate-500">{refs.length > 1 ? `${refs.length} terrains` : 'Terrain'}</p>
                            </>
                          );
                        })() : (() => {
                          const props = (c.properties ?? []).map((l: any) => l.property).filter(Boolean);
                          const refs = props.map((p: any) => p.reference);
                          const shown = refs.slice(0, 2).join(', ');
                          const extra = refs.length > 2 ? ` +${refs.length - 2}` : '';
                          const cityLabel = refs.length > 1
                            ? `${refs.length} biens`
                            : (props[0]?.city ?? '');
                          return (
                            <>
                              <p className="text-slate-800" title={refs.join(', ')}>{shown || '—'}{extra}</p>
                              <p className="text-xs text-slate-500">{cityLabel}</p>
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{clientName}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {amount ? formatCurrency(Number(amount)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(c.startDate)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                            onClick={() => navigate(`/conventions/${c.id}`)} />
                          <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                            onClick={() => navigate(`/conventions/${c.id}/edit`)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </Card>
    </PageLayout>
  );
}
