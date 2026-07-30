import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useReferrers } from '../hooks/useCommissions';
import { referrerName, COMMISSION_WRITE_ROLES, COMMISSION_REFERRERS_FULL_VIEW_ROLES, COMMISSION_REFERRERS_EXPORT_ROLES } from '../utils/commissions.utils';
import { formatPersonName } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { Plus, Search, Eye, Receipt } from 'lucide-react';

const ACTIVE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'true', label: 'Actifs' },
  { value: 'false', label: 'Inactifs' },
];

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Apporteur',            cell: (r) => referrerName(r) },
  { header: 'Email',                cell: (r) => r.email },
  { header: 'Téléphone 1',          cell: (r) => r.phone },
  { header: 'Téléphone 2',          cell: (r) => r.mobile },
  { header: 'Ville',                cell: (r) => r.city },
  { header: 'Utilisateur référent', cell: (r) => (r.assignedTo ? formatPersonName(r.assignedTo) : '—') },
  { header: 'Commissions',          cell: (r) => r._count?.commissions ?? 0 },
  { header: 'Statut',               cell: (r) => (r.isActive ? 'Actif' : 'Inactif') },
];

export default function ReferrersListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canManage = COMMISSION_WRITE_ROLES.includes(role);
  const canViewCommissions = COMMISSION_REFERRERS_FULL_VIEW_ROLES.includes(role);
  const canExport = COMMISSION_REFERRERS_EXPORT_ROLES.includes(role);

  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const token = useAuthStore((s) => s.token)!;

  const filters: any = {};
  if (search) filters.search = search;
  if (active) filters.isActive = active;

  const filterSummary = [
    search && `Recherche : "${search}"`,
    active && `Statut : ${ACTIVE_OPTIONS.find((o) => o.value === active)?.label ?? active}`,
  ].filter(Boolean).join('   —   ') || undefined;

  const { data: res, isLoading } = useReferrers(filters, page, limit);
  const referrers = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <PageLayout
      title="Apporteurs d'affaire"
      breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Apporteurs d\'affaire' }]}
      actions={
        <div className="flex gap-2">
          {canExport && (
            <ExportMenu
              fileName="apporteurs-affaire"
              title="Liste des apporteurs d'affaire"
              subtitle={filterSummary}
              columns={EXPORT_COLUMNS}
              fetchRows={async () => {
                const r = await window.electron.commissions.listReferrers(token, filters, 1, 100000);
                return r.success ? r.data ?? [] : [];
              }}
            />
          )}
          {canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/commissions/referrers/new')}>
              Nouvel apporteur
            </Button>
          )}
        </div>
      }
    >
      {/* Filtres */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un apporteur d'affaire…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-40">
          <Select options={ACTIVE_OPTIONS} value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : referrers.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Aucun apporteur d'affaire.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Apporteur</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Ville</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Utilisateur référent</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Commissions</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {referrers.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-left">
                    <button
                      className="font-medium text-indigo-600 hover:underline text-left"
                      onClick={() => navigate(`/commissions/referrers/${r.id}`)}
                    >
                      {referrerName(r)}
                    </button>
                    {r.companyName && (r.firstName || r.lastName) && (
                      <p className="text-xs text-slate-400">{r.firstName} {r.lastName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.email && <p>{r.email}</p>}
                    <p className="text-slate-400">{r.phone || r.mobile || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.city ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.assignedTo ? formatPersonName(r.assignedTo) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r._count?.commissions ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.isActive ? 'success' : 'default'}>
                      {r.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canViewCommissions && (
                        <Button
                          size="sm" variant="ghost"
                          icon={<Receipt className="h-4 w-4" />}
                          onClick={() => navigate(`/commissions/beneficiary/REFERRER/${r.id}`)}
                        >
                          Commissions
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost"
                        icon={<Eye className="h-4 w-4" />}
                        onClick={() => navigate(`/commissions/referrers/${r.id}`)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>{total} apporteur(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              Précédent
            </Button>
            <span className="py-1 px-2">{page} / {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              Suivant
            </Button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
