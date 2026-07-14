import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import SocialMediaTabs from '../components/SocialMediaTabs';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { formatDate } from '../../../shared/utils/format';
import { useFollowerSnapshots, usePlatforms, useDeleteSnapshot } from '../hooks/useSocialMedia';
import FollowerSnapshotModal from '../components/FollowerSnapshotModal';
import { PLATFORM_TYPE_LABEL, type SocialFollowerSnapshot } from '../types/social-media.types';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Seuls ces rôles peuvent modifier ou supprimer une ligne de relevé déjà
// enregistrée (les autres rôles autorisés sur le module ne peuvent que créer
// un nouveau relevé).
const EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

export default function SocialFollowersPage() {
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canEdit = EDIT_ROLES.includes(role);
  const canDelete = canEdit;

  const [platformId, setPlatformId] = useState('');
  const { data: platRes } = usePlatforms(true);
  const platforms = platRes?.success ? platRes.data ?? [] : [];

  const { data, isLoading } = useFollowerSnapshots(platformId ? Number(platformId) : undefined, 100);
  const snapshots: SocialFollowerSnapshot[] = data?.data ?? [];

  const del = useDeleteSnapshot();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SocialFollowerSnapshot | null>(null);
  const [toDelete, setToDelete] = useState<SocialFollowerSnapshot | null>(null);

  return (
    <PageLayout
      title="Réseaux Sociaux & Plateformes Web"
      breadcrumbs={[{ label: 'Réseaux Sociaux & Web', to: '/social-media/dashboard' }, { label: 'Abonnés' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
          Nouveau relevé
        </Button>
      }
    >
      <SocialMediaTabs />

      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="w-64">
          <Select label="Plateforme" placeholder="Toutes les plateformes"
            options={platforms.map((p: any) => ({ value: String(p.id), label: p.name }))}
            value={platformId} onChange={(e) => setPlatformId(e.target.value)} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : snapshots.length === 0 ? (
          <EmptyState
            title="Aucun relevé d’abonnés enregistré"
            action={{ label: 'Nouveau relevé', onClick: () => setFormOpen(true) }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Plateforme</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Abonnés</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Évolution</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Relevé par</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshots.map((s, idx) => {
                // Les relevés sont triés par date décroissante ; on compare au
                // relevé précédent (plus ancien) de la même plateforme.
                const prev = snapshots
                  .slice(idx + 1)
                  .find((o) => o.platformId === s.platformId);
                const delta = prev ? s.followersCount - prev.followersCount : null;
                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600">{formatDate(s.date)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.platform?.name}
                      <p className="text-xs text-slate-400">{s.platform && PLATFORM_TYPE_LABEL[s.platform.type]}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.followersCount.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      {delta === null ? (
                        <span className="text-slate-400">—</span>
                      ) : delta > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600"><TrendingUp className="h-3.5 w-3.5" />+{delta}</span>
                      ) : delta < 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600"><TrendingDown className="h-3.5 w-3.5" />{delta}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400"><Minus className="h-3.5 w-3.5" />0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.recordedBy ? `${s.recordedBy.lastName} ${s.recordedBy.firstName}` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {canEdit && (
                          <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />}
                            onClick={() => setEditTarget(s)} />
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />}
                            onClick={() => setToDelete(s)} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <FollowerSnapshotModal
        open={formOpen || !!editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        defaultPlatformId={platformId ? Number(platformId) : undefined}
        snapshot={editTarget}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer le relevé"
        message={`Supprimer le relevé du ${toDelete ? formatDate(toDelete.date) : ''} ?`}
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)}
      />
    </PageLayout>
  );
}
