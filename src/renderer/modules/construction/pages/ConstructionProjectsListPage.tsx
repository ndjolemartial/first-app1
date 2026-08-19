import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useConstructionProjects, useDeleteConstructionProject } from '../hooks/useConstructionProjects';
import {
  BUILDING_TYPE_LABELS, STANDING_LABELS, PROJECT_STATUS_LABELS, PROJECT_STATUS_VARIANT, PROJECT_SCOPE_LABELS, toOptions,
} from '../utils/constructionLabels';
import { formatDate, formatPersonName } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Search, HardHat, Trash2 } from 'lucide-react';

const STATUS_OPTIONS = [{ value: '', label: 'Tous les statuts' }, ...toOptions(PROJECT_STATUS_LABELS)];
/** Suppression : réservée à SUPER_ADMIN/ADMIN/MANAGER (même liste que côté IPC, `DELETE_ROLES` dans `construction-projects.ipc.ts`). */
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Création : réservée à SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT (même liste que côté IPC, `WRITE_ROLES` dans `construction-projects.ipc.ts`). */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

function destinataire(p: any): string {
  if (p.client) return formatPersonName(p.client, '');
  if (p.prospect) return `${p.prospect.firstName ?? ''} ${p.prospect.lastName ?? ''}`.trim() + ' (prospect)';
  return '—';
}

export default function ConstructionProjectsListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const filters = { ...(status ? { status } : {}), ...(search ? { search } : {}) };
  const { data: res, isLoading } = useConstructionProjects(filters, 1, 100);
  const projects = res?.data ?? [];

  const role = useAuthStore((s) => s.user?.role);
  const canDelete = !!role && DELETE_ROLES.includes(role);
  const canWrite = !!role && WRITE_ROLES.includes(role);
  const deleteProject = useDeleteConstructionProject();
  const [toDelete, setToDelete] = useState<any>(null);

  return (
    <PageLayout
      title="Devis construction"
      breadcrumbs={[{ label: 'Devis construction' }]}
      actions={canWrite ? (
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/construction/projects/new')}>
          Nouveau projet
        </Button>
      ) : undefined}
    >
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text" placeholder="Rechercher (référence, nom du projet)…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4"><SkeletonTable rows={6} /></div>
        ) : projects.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <HardHat className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Aucun projet de construction.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Projet</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Destinataire</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Standing</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Surface</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Créé le</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                {canDelete && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/construction/projects/${p.id}`)}>
                  <td className="px-4 py-3 font-medium text-indigo-600">{p.reference}</td>
                  <td className="px-4 py-3 text-slate-700">{p.nom}</td>
                  <td className="px-4 py-3 text-slate-500">{destinataire(p)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.scope && p.scope !== 'COMPLET' ? PROJECT_SCOPE_LABELS[p.scope] ?? p.scope : (BUILDING_TYPE_LABELS[p.buildingType] ?? p.buildingType)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.scope && p.scope !== 'COMPLET' ? '—' : (STANDING_LABELS[p.standing] ?? p.standing)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{p.scope && p.scope !== 'COMPLET' ? '—' : `${Number(p.surfaceHabitable)} m²`}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3"><Badge variant={PROJECT_STATUS_VARIANT[p.status] ?? 'default'}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</Badge></td>
                  {canDelete && (
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={(ev) => { ev.stopPropagation(); setToDelete(p); }} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog open={!!toDelete} title="Supprimer le projet"
        message={`Supprimer le projet ${toDelete?.reference ?? ''} et toutes ses estimations ?`}
        confirmLabel="Supprimer" loading={deleteProject.isPending}
        onConfirm={async () => { await deleteProject.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)} />
    </PageLayout>
  );
}
