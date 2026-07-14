import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import ExportMenu, { type ExportColumn } from '../../../shared/components/ExportMenu';
import { toast } from '../../../shared/components/ui/Toast';
import { Plus, Trash2, Users, CalendarDays, CalendarClock, Printer } from 'lucide-react';
import { useVisitors, useVisitorsStats, useDeleteVisitor } from '../hooks/useVisitors';
import { SOURCE_LABEL, type Visitor } from '../types/visitors.types';
import VisitorsTabs from '../components/VisitorsTabs';
import { useAuthStore } from '../../../shared/stores/auth.store';

// Suppression réservée à SUPER_ADMIN/ADMIN/MANAGER (ASSISTANTE_DIRECTION
// accède au module mais ne peut pas supprimer un enregistrement).
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
// Export / impression de la liste — réservés aux mêmes rôles.
const EXPORT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Formate un horodatage ISO en « JJ/MM/AAAA à HH:MM ». */
function formatDateTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

const fullName = (v: Visitor) => `${v.lastName ?? ''} ${v.firstName ?? ''}`.trim();

const VISITOR_EXPORT_COLUMNS: ExportColumn<Visitor>[] = [
  { header: 'Date / heure', cell: (v) => formatDateTime(v.visitedAt) },
  { header: 'Nom & Prénoms', cell: (v) => fullName(v) },
  { header: 'Entreprise', cell: (v) => v.company ?? '' },
  { header: 'Téléphone', cell: (v) => v.phone ?? '' },
  { header: 'Email', cell: (v) => v.email ?? '' },
  { header: 'Objet de visite', cell: (v) => v.objet },
  { header: 'Source', cell: (v) => SOURCE_LABEL[v.source] ?? v.source },
];

type Period = 'today' | 'month' | null;

export default function VisitorsListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const token = useAuthStore((s) => s.token)!;
  const canDelete = DELETE_ROLES.includes(role);
  const canExport = EXPORT_ROLES.includes(role);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>(null);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Visitor | null>(null);
  const [printing, setPrinting] = useState(false);
  const limit = 20;

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (search) f.search = search;
    const now = new Date();
    if (period === 'today') f.dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    else if (period === 'month') f.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return f;
  }, [search, period]);
  const selectPeriod = (p: Period) => { setPeriod(p); setPage(1); };
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

  // Récupère l'intégralité des visiteurs correspondant aux filtres courants
  // (indépendamment de la pagination affichée) pour l'export / l'impression.
  const fetchAllVisitors = async (): Promise<Visitor[]> => {
    const r = await window.electron.visitors.list(token, filters, 1, 10000);
    return r.success ? r.data ?? [] : [];
  };

  const handlePrint = async () => {
    const rows = await fetchAllVisitors();
    if (rows.length === 0) { toast.error('Aucun visiteur à imprimer'); return; }
    setPrinting(true);
    try {
      const matrix = rows.map((row) =>
        VISITOR_EXPORT_COLUMNS.map((col) => {
          const v = col.cell(row);
          return v === null || v === undefined ? '' : String(v);
        }),
      );
      const pr = await window.electron.exporter.print(token, {
        fileName: 'visiteurs',
        title: 'Gestion des visiteurs',
        headers: VISITOR_EXPORT_COLUMNS.map((col) => col.header),
        rows: matrix,
      });
      if (!pr.success) toast.error(typeof pr.error === 'string' ? pr.error : "Erreur lors de l'impression");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'impression");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PageLayout
      title="Gestion des visiteurs"
      breadcrumbs={[{ label: 'Gestion des visiteurs' }]}
      actions={
        <div className="flex gap-2">
          {canExport && (
            <>
              <ExportMenu
                fileName="visiteurs"
                title="Gestion des visiteurs"
                columns={VISITOR_EXPORT_COLUMNS}
                fetchRows={fetchAllVisitors}
              />
              <Button variant="secondary" icon={<Printer className="h-4 w-4" />} loading={printing} onClick={handlePrint}>
                Imprimer
              </Button>
            </>
          )}
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/visitors/new')}>
            Nouveau visiteur
          </Button>
        </div>
      }
    >
      <VisitorsTabs />

      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button type="button" onClick={() => selectPeriod('today')} className="text-left">
            <Card className={`flex items-center gap-3 transition hover:shadow-md ${period === 'today' ? 'ring-2 ring-blue-400' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50"><CalendarClock className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-xs text-slate-500">Aujourd'hui</p><p className="text-xl font-bold text-slate-900">{stats.today}</p></div>
            </Card>
          </button>
          <button type="button" onClick={() => selectPeriod('month')} className="text-left">
            <Card className={`flex items-center gap-3 transition hover:shadow-md ${period === 'month' ? 'ring-2 ring-emerald-400' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50"><CalendarDays className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="text-xs text-slate-500">Ce mois</p><p className="text-xl font-bold text-slate-900">{stats.month}</p></div>
            </Card>
          </button>
          <button type="button" onClick={() => selectPeriod(null)} className="text-left">
            <Card className={`flex items-center gap-3 transition hover:shadow-md ${period === null ? 'ring-2 ring-slate-400' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><Users className="h-5 w-5 text-slate-600" /></div>
              <div><p className="text-xs text-slate-500">Total</p><p className="text-xl font-bold text-slate-900">{stats.total}</p></div>
            </Card>
          </button>
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
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(v)}
                          className="p-1.5 text-slate-400 hover:text-red-500"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
