import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import ExportMenu, { type ExportColumn } from '../../../shared/components/ExportMenu';
import { toast } from '../../../shared/components/ui/Toast';
import { Plus, Trash2, Pencil, Phone, PhoneIncoming, PhoneOutgoing, CalendarDays, CalendarClock, Printer } from 'lucide-react';
import { useCalls, useCallsStats, useDeleteCall } from '../hooks/useCalls';
import { DIRECTION_LABEL, STATUS_LABEL, type PhoneCall } from '../types/calls.types';
import { useAuthStore } from '../../../shared/stores/auth.store';

// Suppression réservée à SUPER_ADMIN/ADMIN/MANAGER (les autres rôles autorisés
// sur le module ne peuvent que consulter/créer/modifier).
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

const contactName = (c: PhoneCall) => `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim();

const linkedEntityLabel = (c: PhoneCall): string | null => {
  if (c.client) {
    return c.client.type !== 'INDIVIDUEL'
      ? (c.client.entreprise ?? '')
      : `${c.client.lastName ?? ''} ${c.client.firstName ?? ''}`.trim();
  }
  if (c.prospect) return `${c.prospect.lastName ?? ''} ${c.prospect.firstName ?? ''}`.trim();
  return null;
};

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  ABOUTI: 'success',
  MANQUE: 'danger',
  OCCUPE: 'warning',
  MESSAGE_LAISSE: 'default',
};

const CALL_EXPORT_COLUMNS: ExportColumn<PhoneCall>[] = [
  { header: 'Date / heure', cell: (c) => formatDateTime(c.calledAt) },
  { header: 'Sens', cell: (c) => DIRECTION_LABEL[c.direction] ?? c.direction },
  { header: 'Contact', cell: (c) => contactName(c) || c.company || '' },
  { header: 'Téléphone', cell: (c) => c.phone },
  { header: 'Client / Prospect lié', cell: (c) => linkedEntityLabel(c) ?? '' },
  { header: 'Objet', cell: (c) => c.objet },
  { header: 'Durée (min)', cell: (c) => c.duration ?? '' },
  { header: 'Statut', cell: (c) => STATUS_LABEL[c.status] ?? c.status },
];

type Period = 'today' | 'month' | null;

export default function CallsListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const token = useAuthStore((s) => s.token)!;
  const canDelete = DELETE_ROLES.includes(role);
  const canExport = EXPORT_ROLES.includes(role);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState<Period>(null);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<PhoneCall | null>(null);
  const [printing, setPrinting] = useState(false);
  const limit = 20;

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (search) f.search = search;
    if (direction) f.direction = direction;
    if (status) f.status = status;
    const now = new Date();
    if (period === 'today') f.dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    else if (period === 'month') f.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return f;
  }, [search, direction, status, period]);

  // Cartes de synthèse cliquables : appliquent le filtre correspondant en
  // réinitialisant les autres, pour que la liste affichée corresponde
  // exactement au chiffre affiché sur la carte (les stats ne tiennent compte
  // ni de la recherche ni du statut).
  const applyQuickFilter = (opts: { period?: Period; direction?: string }) => {
    setSearch('');
    setStatus('');
    setPeriod(opts.period ?? null);
    setDirection(opts.direction ?? '');
    setPage(1);
  };
  const { data: res, isLoading, refetch } = useCalls(filters, page, limit);
  const { data: statsRes } = useCallsStats();
  const del = useDeleteCall();

  const calls: PhoneCall[] = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const stats = statsRes?.data;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await del.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    refetch();
  };

  // Récupère l'intégralité des appels correspondant aux filtres courants
  // (indépendamment de la pagination affichée) pour l'export / l'impression.
  const fetchAllCalls = async (): Promise<PhoneCall[]> => {
    const r = await window.electron.calls.list(token, filters, 1, 10000);
    return r.success ? r.data ?? [] : [];
  };

  const handlePrint = async () => {
    const rows = await fetchAllCalls();
    if (rows.length === 0) { toast.error('Aucun appel à imprimer'); return; }
    setPrinting(true);
    try {
      const matrix = rows.map((row) =>
        CALL_EXPORT_COLUMNS.map((col) => {
          const v = col.cell(row);
          return v === null || v === undefined ? '' : String(v);
        }),
      );
      const pr = await window.electron.exporter.print(token, {
        fileName: 'appels',
        title: 'Gestion des appels',
        headers: CALL_EXPORT_COLUMNS.map((col) => col.header),
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
      title="Gestion des appels"
      breadcrumbs={[{ label: 'Gestion des appels' }]}
      actions={
        <div className="flex gap-2">
          {canExport && (
            <>
              <ExportMenu
                fileName="appels"
                title="Gestion des appels"
                columns={CALL_EXPORT_COLUMNS}
                fetchRows={fetchAllCalls}
              />
              <Button variant="secondary" icon={<Printer className="h-4 w-4" />} loading={printing} onClick={handlePrint}>
                Imprimer
              </Button>
            </>
          )}
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/calls/new')}>
            Nouvel appel
          </Button>
        </div>
      }
    >
      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <button type="button" onClick={() => applyQuickFilter({ period: 'today' })} className="text-left">
            <Card className={`flex items-center gap-3 transition hover:shadow-md ${period === 'today' && !direction ? 'ring-2 ring-blue-400' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50"><CalendarClock className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-xs text-slate-500">Aujourd'hui</p><p className="text-xl font-bold text-slate-900">{stats.today}</p></div>
            </Card>
          </button>
          <button type="button" onClick={() => applyQuickFilter({ period: 'month' })} className="text-left">
            <Card className={`flex items-center gap-3 transition hover:shadow-md ${period === 'month' && !direction ? 'ring-2 ring-emerald-400' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50"><CalendarDays className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="text-xs text-slate-500">Ce mois</p><p className="text-xl font-bold text-slate-900">{stats.month}</p></div>
            </Card>
          </button>
          <button type="button" onClick={() => applyQuickFilter({})} className="text-left">
            <Card className={`flex items-center gap-3 transition hover:shadow-md ${period === null && !direction && !search && !status ? 'ring-2 ring-slate-400' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><Phone className="h-5 w-5 text-slate-600" /></div>
              <div><p className="text-xs text-slate-500">Total</p><p className="text-xl font-bold text-slate-900">{stats.total}</p></div>
            </Card>
          </button>
          <button type="button" onClick={() => applyQuickFilter({ direction: 'ENTRANT' })} className="text-left">
            <Card className={`flex items-center gap-3 transition hover:shadow-md ${direction === 'ENTRANT' ? 'ring-2 ring-purple-400' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50"><PhoneIncoming className="h-5 w-5 text-purple-600" /></div>
              <div><p className="text-xs text-slate-500">Entrants</p><p className="text-xl font-bold text-slate-900">{stats.entrant}</p></div>
            </Card>
          </button>
          <button type="button" onClick={() => applyQuickFilter({ direction: 'SORTANT' })} className="text-left">
            <Card className={`flex items-center gap-3 transition hover:shadow-md ${direction === 'SORTANT' ? 'ring-2 ring-amber-400' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50"><PhoneOutgoing className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-xs text-slate-500">Sortants</p><p className="text-xl font-bold text-slate-900">{stats.sortant}</p></div>
            </Card>
          </button>
        </div>
      )}

      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-sm flex-1 min-w-[200px]">
          <Input
            label="Rechercher"
            placeholder="Nom, entreprise, téléphone, objet…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-44">
          <Select
            label="Sens"
            placeholder="Tous"
            options={Object.entries(DIRECTION_LABEL).map(([value, label]) => ({ value, label }))}
            value={direction}
            onChange={(e) => { setDirection(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-48">
          <Select
            label="Statut"
            placeholder="Tous"
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : calls.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Aucun appel enregistré.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Date / heure</th>
                  <th className="px-4 py-2 font-medium">Sens</th>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 font-medium">Client / Prospect lié</th>
                  <th className="px-4 py-2 font-medium">Objet</th>
                  <th className="px-4 py-2 font-medium">Durée</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((c) => {
                  const linked = linkedEntityLabel(c);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatDateTime(c.calledAt)}</td>
                      <td className="px-4 py-2">
                        <Badge variant={c.direction === 'ENTRANT' ? 'info' : 'purple'}>
                          {DIRECTION_LABEL[c.direction] ?? c.direction}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {contactName(c) || c.company || '—'}
                        <span className="block text-xs text-slate-400">{c.phone}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {linked ? (
                          <button
                            className="text-blue-600 hover:underline"
                            onClick={() => navigate(c.client ? `/clients/${c.client!.id}` : `/prospects/${c.prospect!.id}`)}
                          >
                            {linked}
                          </button>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {c.objet}
                        {c.details ? <span className="block max-w-xs truncate text-xs text-slate-400" title={c.details}>{c.details}</span> : null}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{c.duration != null ? `${c.duration} min` : '—'}</td>
                      <td className="px-4 py-2">
                        <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => navigate(`/calls/${c.id}/edit`)}
                            className="p-1.5 text-slate-400 hover:text-blue-600"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(c)}
                              className="p-1.5 text-slate-400 hover:text-red-500"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{total} appel(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Précédent</Button>
            <span className="px-2 py-1">{page} / {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Suivant</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer l'appel"
        message={`Supprimer l'enregistrement de cet appel${deleteTarget ? ` (${contactName(deleteTarget) || deleteTarget.phone})` : ''} ?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
