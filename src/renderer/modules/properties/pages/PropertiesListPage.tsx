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
import { useProperties, usePropertiesStatusStats } from '../hooks/useProperties';
import { formatCurrency } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import StatusRecap, { type StatusRecapItem } from '../../../shared/components/ui/StatusRecap';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Eye, Edit, Building2, CheckCircle2, BookmarkCheck, Clock, BadgeCheck, KeyRound, Wrench, Ban } from 'lucide-react';

/** Rôles habilités à créer/modifier un bien. */
const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']);

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'APARTEMENT', label: 'Appartement' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'BUREAU', label: 'Bureau' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'AUTRE', label: 'Autre' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'RESERVE', label: 'Réservé' },
  { value: 'SOUS_OPTION', label: 'Sous option' },
  { value: 'VENDU', label: 'Vendu' },
  { value: 'EN_LOCATION', label: 'En location' },
  { value: 'EN_RENOVATION', label: 'En rénovation' },
  { value: 'INDISPONIBLE', label: 'Indisponible' },
];

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default' | 'purple'> = {
  DISPONIBLE: 'success',
  RESERVE: 'warning',
  SOUS_OPTION: 'warning',
  VENDU: 'default',
  EN_LOCATION: 'info',
  EN_RENOVATION: 'purple',
  INDISPONIBLE: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  RESERVE: 'Réservé',
  SOUS_OPTION: 'Sous option',
  VENDU: 'Vendu',
  EN_LOCATION: 'En location',
  EN_RENOVATION: 'En rénovation',
  INDISPONIBLE: 'Indisponible',
};

const TYPE_LABEL: Record<string, string> = {
  APARTEMENT: 'Appartement', DUPLEX: 'Duplex',
  VILLA: 'Villa', STUDIO: 'Studio', BUREAU: 'Bureau', PARKING: 'Parking', AUTRE: 'Autre',
};

const STATUS_RECAP_ITEMS: StatusRecapItem[] = [
  { key: 'DISPONIBLE',    label: 'Disponibles',   icon: CheckCircle2,  iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', activeColor: 'text-emerald-700' },
  { key: 'RESERVE',       label: 'Réservés',      icon: BookmarkCheck, iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   activeColor: 'text-amber-700' },
  { key: 'SOUS_OPTION',   label: 'Sous option',   icon: Clock,         iconBg: 'bg-sky-100',     iconColor: 'text-sky-600',     activeColor: 'text-sky-700' },
  { key: 'VENDU',         label: 'Vendus',        icon: BadgeCheck,    iconBg: 'bg-slate-200',   iconColor: 'text-slate-700',   activeColor: 'text-slate-800' },
  { key: 'EN_LOCATION',   label: 'En location',   icon: KeyRound,      iconBg: 'bg-blue-100',    iconColor: 'text-blue-600',    activeColor: 'text-blue-700' },
  { key: 'EN_RENOVATION', label: 'En rénovation', icon: Wrench,        iconBg: 'bg-purple-100',  iconColor: 'text-purple-600',  activeColor: 'text-purple-700' },
  { key: 'INDISPONIBLE',  label: 'Indisponibles', icon: Ban,           iconBg: 'bg-red-100',     iconColor: 'text-red-600',     activeColor: 'text-red-700' },
];

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Référence',     cell: (p) => p.reference },
  { header: 'Type',          cell: (p) => TYPE_LABEL[p.type] ?? p.type },
  { header: 'Adresse',       cell: (p) => p.address },
  { header: 'Ville',         cell: (p) => p.city },
  { header: 'Origine',       cell: (p) => (
    p.programme
      ? `Programme : ${p.programme.nom}`
      : p.owner
        ? `Propriétaire : ${p.owner.companyName ?? `${p.owner.firstName ?? ''} ${p.owner.lastName ?? ''}`.trim()}`
        : ''
  ) },
  { header: 'Surface (m²)',  cell: (p) => p.surface ?? '' },
  { header: 'Loyer mensuel', cell: (p) => (p.rentPrice != null ? formatCurrency(Number(p.rentPrice)) : '') },
  { header: 'Prix de vente', cell: (p) => (p.salePrice != null ? formatCurrency(Number(p.salePrice)) : '') },
  { header: 'Statut',        cell: (p) => STATUS_LABEL[p.status] ?? p.status },
];

export default function PropertiesListPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const role  = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = WRITE_ROLES.has(role);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const filters = {
    search: search || undefined,
    type: type || undefined,
    status: status || undefined,
  };
  const { data, isLoading } = useProperties(filters, page, 20);
  // Stats : mêmes filtres SAUF le statut (sinon une seule colonne serait non nulle).
  const { data: statsRes } = usePropertiesStatusStats({
    search: search || undefined,
    type: type || undefined,
  });
  const stats = statsRes?.success ? statsRes.data : undefined;

  const filterSummary = [
    search && `Recherche : "${search}"`,
    type && `Type : ${TYPE_LABEL[type] ?? type}`,
    status && `Statut : ${STATUS_LABEL[status] ?? status}`,
  ].filter(Boolean).join('   —   ') || undefined;
  const properties: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des biens"
      breadcrumbs={[{ label: 'Biens' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName="biens"
            title="Liste des biens immobiliers"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.properties.list(token, filters, 1, 100000);
              return r.success ? r.data ?? [] : [];
            }}
          />
          {canWrite && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/properties/new')}>
              Nouveau bien
            </Button>
          )}
        </div>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Rechercher" placeholder="Référence, adresse, ville, propriétaire…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <Select label="Type" options={TYPE_OPTIONS} value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
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
        ) : properties.length === 0 ? (
          <EmptyState
            title="Aucun bien trouvé"
            description="Commencez par référencer un bien immobilier."
            action={canWrite ? { label: 'Nouveau bien', onClick: () => navigate('/properties/new') } : undefined}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Adresse</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Origine</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Surface</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Prix</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {properties.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium text-slate-900">{p.reference}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[p.type] ?? p.type}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{p.address}</p>
                      <p className="text-xs text-slate-500">{p.city}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.programme ? (
                        <>
                          <span className="block text-[11px] uppercase tracking-wide text-indigo-500">Programme</span>
                          <span>{p.programme.nom}</span>
                        </>
                      ) : p.owner ? (
                        <>
                          <span className="block text-[11px] uppercase tracking-wide text-slate-400">Propriétaire</span>
                          <span>{p.owner.companyName ?? `${p.owner.firstName ?? ''} ${p.owner.lastName ?? ''}`.trim()}</span>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.surface != null ? `${p.surface} m²` : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.rentPrice ? <p>{formatCurrency(Number(p.rentPrice))}<span className="text-xs text-slate-400">/mois</span></p> : null}
                      {p.salePrice ? <p className="text-xs">{formatCurrency(Number(p.salePrice))}</p> : null}
                      {!p.rentPrice && !p.salePrice ? '—' : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                          onClick={() => navigate(`/properties/${p.id}`)} />
                        {canWrite && (
                          <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                            onClick={() => navigate(`/properties/${p.id}/edit`)} />
                        )}
                      </div>
                    </td>
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
