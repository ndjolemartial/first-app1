import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useArchives, useArchiveStats, useRestoreArchive, usePermanentDelete } from '../hooks/useArchiving';
import ArchivingNav from '../components/ArchivingNav';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate, formatDateTime } from '../../../shared/utils/format';
import { Archive, RotateCcw, Trash2, Settings } from 'lucide-react';

const ENTITY_LABEL: Record<string, string> = {
  CLIENT: 'Client', PROSPECT: 'Prospect', OWNER: 'Propriétaire',
  PROPERTY: 'Bien', CONVENTION: 'Convention', INVOICE: 'Facture', DOCUMENT: 'Document',
};
const REASON_LABEL: Record<string, string> = {
  MANUEL: 'Manuel', CONVENTION_TERMINEE: 'Convention terminée', CLIENT_INACTIF: 'Client inactif',
  BIEN_VENDU: 'Bien vendu', POLITIQUE_AUTOMATIQUE: 'Automatique', DEMANDE_RGPD: 'RGPD', AUTRE: 'Autre',
};
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  ARCHIVE: 'warning', RESTAURE: 'success', SUPPRIME_DEFINITIVEMENT: 'danger',
};
const STATUS_LABEL: Record<string, string> = {
  ARCHIVE: 'Archivé', RESTAURE: 'Restauré', SUPPRIME_DEFINITIVEMENT: 'Supprimé définitivement',
};

const ENTITY_OPTIONS = [
  { value: '', label: 'Tous les types' },
  ...Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label })),
];
const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'ARCHIVE', label: 'Archivé' },
  { value: 'RESTAURE', label: 'Restauré' },
];

export default function ArchivingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [entityType, setEntityType] = useState('');
  const [statusFilter, setStatusFilter] = useState('ARCHIVE');
  const [page, setPage] = useState(1);
  const [restoreTarget, setRestoreTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const limit = 30;

  const filters: any = {};
  if (entityType) filters.entityType = entityType;
  if (statusFilter) filters.status = statusFilter;

  const { data: res, isLoading, refetch } = useArchives(filters, page, limit);
  const { data: statsRes } = useArchiveStats();
  const restore = useRestoreArchive();
  const permDelete = usePermanentDelete();

  const archives = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const stats = statsRes?.data;

  const handleRestore = async () => {
    await restore.mutateAsync(restoreTarget.id);
    setRestoreTarget(null);
    refetch();
  };

  const handlePermDelete = async () => {
    await permDelete.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    refetch();
  };

  return (
    <PageLayout
      title="Archivage"
      breadcrumbs={[{ label: 'Archivage' }]}
      actions={
        <Button
          variant="secondary"
          icon={<Settings className="h-4 w-4" />}
          onClick={() => navigate('/archiving/policies')}
        >
          Politiques
        </Button>
      }
    >
      <ArchivingNav />
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <Archive className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total archivés</p>
              <p className="text-xl font-bold text-slate-900">{stats.totalArchived}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
              <RotateCcw className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Restaurés</p>
              <p className="text-xl font-bold text-slate-900">{stats.totalRestored}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Expirent dans 30j</p>
              <p className="text-xl font-bold text-slate-900">{stats.expiringCount}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Répartition par type */}
      {stats?.byType && stats.byType.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {stats.byType.map((b: any) => (
            <button
              key={b.entityType}
              onClick={() => setEntityType(entityType === b.entityType ? '' : b.entityType)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                entityType === b.entityType
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {ENTITY_LABEL[b.entityType] ?? b.entityType} ({b.count})
            </button>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3 mb-6">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : archives.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Aucune archive trouvée.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Motif</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Archivé le</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Par</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Rétention</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {archives.map((arch: any) => (
                <tr key={arch.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Badge variant="default">{ENTITY_LABEL[arch.entityType] ?? arch.entityType}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-indigo-700">{arch.entityRef}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span>{REASON_LABEL[arch.reason] ?? arch.reason}</span>
                    {arch.reasonDetail && (
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">{arch.reasonDetail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(arch.archivedAt)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {arch.archivedBy ? `${arch.archivedBy.firstName} ${arch.archivedBy.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {arch.retentionDate ? formatDate(arch.retentionDate) : 'Illimitée'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[arch.status] ?? 'default'}>
                      {STATUS_LABEL[arch.status] ?? arch.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {arch.status === 'ARCHIVE' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RotateCcw className="h-4 w-4" />}
                          onClick={() => setRestoreTarget(arch)}
                        >
                          Restaurer
                        </Button>
                      )}
                      {isSuperAdmin && arch.status !== 'SUPPRIME_DEFINITIVEMENT' && (
                        <button
                          onClick={() => setDeleteTarget(arch)}
                          className="p-1.5 text-slate-400 hover:text-red-500"
                          title="Supprimer définitivement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>{total} archive(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Précédent</Button>
            <span className="py-1 px-2">{page} / {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Suivant</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!restoreTarget}
        title="Restaurer l'archive"
        message={`Restaurer "${restoreTarget?.entityRef}" (${ENTITY_LABEL[restoreTarget?.entityType] ?? ''}) ?`}
        onConfirm={handleRestore}
        onClose={() => setRestoreTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Suppression définitive"
        message={`Supprimer définitivement "${deleteTarget?.entityRef}" ? Cette action est irréversible.`}
        onConfirm={handlePermDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
