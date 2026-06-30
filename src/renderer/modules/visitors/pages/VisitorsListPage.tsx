import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { Plus, Trash2, Users, CalendarDays, CalendarClock } from 'lucide-react';
import { useVisitors, useVisitorsStats, useDeleteVisitor } from '../hooks/useVisitors';
import { SOURCE_LABEL, type Visitor } from '../types/visitors.types';
import VisitorsTabs from '../components/VisitorsTabs';

/** Formate un horodatage ISO en « JJ/MM/AAAA à HH:MM ». */
function formatDateTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

const fullName = (v: Visitor) => `${v.lastName ?? ''} ${v.firstName ?? ''}`.trim();

export default function VisitorsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Visitor | null>(null);
  const limit = 20;

  const filters = useMemo(() => (search ? { search } : {}), [search]);
  const { data: res, isLoading, refetch } = useVisitors(filters, page, limit);
  const { data: statsRes } = useVisitorsStats();
  const del = useDeleteVisitor();

  const visitors: Visitor[] = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const stats = statsRes?.data;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await del.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    refetch();
  };

  return (
    <PageLayout
      title="Gestion des visiteurs"
      breadcrumbs={[{ label: 'Gestion des visiteurs' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/visitors/new')}>
          Nouveau visiteur
        </Button>
      }
    >
      <VisitorsTabs />

      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50"><CalendarClock className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-xs text-slate-500">Aujourd'hui</p><p className="text-xl font-bold text-slate-900">{stats.today}</p></div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50"><CalendarDays className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-xs text-slate-500">Ce mois</p><p className="text-xl font-bold text-slate-900">{stats.month}</p></div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><Users className="h-5 w-5 text-slate-600" /></div>
            <div><p className="text-xs text-slate-500">Total</p><p className="text-xl font-bold text-slate-900">{stats.total}</p></div>
          </Card>
        </div>
      )}

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Rechercher (nom, entreprise, objet…)"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : visitors.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Aucun visiteur enregistré.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Date / heure</th>
                  <th className="px-4 py-2 font-medium">Nom & Prénoms</th>
                  <th className="px-4 py-2 font-medium">Entreprise</th>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 font-medium">Objet de visite</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visitors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatDateTime(v.visitedAt)}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{fullName(v)}</td>
                    <td className="px-4 py-2 text-slate-600">{v.company || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {v.phone || '—'}
                      {v.email ? <span className="block text-xs text-slate-400">{v.email}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {v.objet}
                      {v.details ? <span className="block max-w-xs truncate text-xs text-slate-400" title={v.details}>{v.details}</span> : null}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={v.source === 'QR' ? 'info' : 'default'}>{SOURCE_LABEL[v.source] ?? v.source}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => setDeleteTarget(v)}
                        className="p-1.5 text-slate-400 hover:text-red-500"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{total} visiteur(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Précédent</Button>
            <span className="px-2 py-1">{page} / {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Suivant</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer le visiteur"
        message={`Supprimer l'enregistrement de « ${deleteTarget ? fullName(deleteTarget) : ''} » ?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
