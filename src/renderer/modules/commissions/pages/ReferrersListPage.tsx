import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useReferrers, useDeleteReferrer } from '../hooks/useCommissions';
import { referrerName, COMMISSION_WRITE_ROLES, COMMISSION_ADMIN_ROLES } from '../utils/commissions.utils';
import { Plus, Search, Pencil, Trash2, Receipt } from 'lucide-react';

const ACTIVE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'true', label: 'Actifs' },
  { value: 'false', label: 'Inactifs' },
];

export default function ReferrersListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canManage = COMMISSION_WRITE_ROLES.includes(role);
  const canDelete = COMMISSION_ADMIN_ROLES.includes(role);

  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const deleteReferrer = useDeleteReferrer();

  const filters: any = {};
  if (search) filters.search = search;
  if (active) filters.isActive = active;

  const { data: res, isLoading } = useReferrers(filters, page, limit);
  const referrers = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const r = await deleteReferrer.mutateAsync(deleteTarget.id);
    if (r.success) setDeleteTarget(null);
  };

  const deleteError = deleteReferrer.data && !deleteReferrer.data.success ? deleteReferrer.data.error : null;

  return (
    <PageLayout
      title="Apporteurs d'affaire"
      breadcrumbs={[{ label: 'Commissions', to: '/commissions' }, { label: 'Apporteurs d\'affaire' }]}
      actions={
        canManage && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/commissions/referrers/new')}>
            Nouvel apporteur
          </Button>
        )
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
                <th className="text-right px-4 py-3 font-medium text-slate-600">Commissions</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {referrers.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      className="font-medium text-indigo-600 hover:underline"
                      onClick={() => navigate(`/commissions/beneficiary/REFERRER/${r.id}`)}
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
                  <td className="px-4 py-3 text-right text-slate-600">{r._count?.commissions ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.isActive ? 'success' : 'default'}>
                      {r.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm" variant="ghost"
                        icon={<Receipt className="h-4 w-4" />}
                        onClick={() => navigate(`/commissions/beneficiary/REFERRER/${r.id}`)}
                      >
                        Commissions
                      </Button>
                      {canManage && (
                        <Button
                          size="sm" variant="ghost"
                          icon={<Pencil className="h-4 w-4" />}
                          onClick={() => navigate(`/commissions/referrers/${r.id}/edit`)}
                        >
                          Modifier
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm" variant="ghost"
                          icon={<Trash2 className="h-4 w-4 text-red-500" />}
                          onClick={() => { deleteReferrer.reset(); setDeleteTarget(r); }}
                        />
                      )}
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer l'apporteur d'affaire"
        message={
          deleteError && typeof deleteError === 'string'
            ? deleteError
            : `Supprimer « ${deleteTarget ? referrerName(deleteTarget) : ''} » ? Cette action est irréversible.`
        }
        confirmLabel="Supprimer"
        loading={deleteReferrer.isPending}
      />
    </PageLayout>
  );
}
