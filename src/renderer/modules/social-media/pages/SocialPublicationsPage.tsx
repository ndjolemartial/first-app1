import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import SocialMediaTabs from '../components/SocialMediaTabs';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import Pagination from '../../../shared/components/ui/Pagination';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { formatDate } from '../../../shared/utils/format';
import { usePublications, usePlatforms, useDeletePublication } from '../hooks/useSocialMedia';
import PublicationModal from '../components/PublicationModal';
import { PLATFORM_TYPE_LABEL, PUBLICATION_TYPE_LABEL, type SocialPublication } from '../types/social-media.types';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Pencil, Trash2, Eye, ThumbsUp, ExternalLink, Paperclip } from 'lucide-react';

// Seuls ces rôles peuvent supprimer une publication (les autres rôles
// autorisés sur le module ne peuvent que créer/modifier les leurs).
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

export default function SocialPublicationsPage() {
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canDelete = DELETE_ROLES.includes(role);

  const [page, setPage] = useState(1);
  const [platformId, setPlatformId] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const filters = { platformId: platformId || undefined, type: type || undefined, search: search || undefined };

  const { data, isLoading } = usePublications(filters, page, 20);
  const { data: platRes } = usePlatforms(true);
  const platforms = platRes?.success ? platRes.data ?? [] : [];

  const del = useDeletePublication();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SocialPublication | null>(null);
  const [toDelete, setToDelete] = useState<SocialPublication | null>(null);

  const publications: SocialPublication[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Réseaux Sociaux & Plateformes Web"
      breadcrumbs={[{ label: 'Réseaux Sociaux & Web', to: '/social-media/dashboard' }, { label: 'Publications & articles' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
          Nouvelle publication
        </Button>
      }
    >
      <SocialMediaTabs />

      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Rechercher" placeholder="Titre…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-56">
          <Select label="Plateforme" placeholder="Toutes les plateformes"
            options={platforms.map((p: any) => ({ value: String(p.id), label: p.name }))}
            value={platformId} onChange={(e) => { setPlatformId(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <Select label="Type" placeholder="Tous les types"
            options={Object.entries(PUBLICATION_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : publications.length === 0 ? (
          <EmptyState
            title="Aucune publication enregistrée"
            action={{ label: 'Nouvelle publication', onClick: () => { setEditing(null); setFormOpen(true); } }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Plateforme</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Vues / Interactions</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Auteur</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Publié le</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {publications.map((pub) => (
                  <tr key={pub.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{pub.title}</p>
                        {pub.url && (
                          <a href={pub.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {!!pub.attachments?.length && (
                          <span className="flex items-center gap-0.5 text-slate-400" title={`${pub.attachments.length} pièce(s) jointe(s)`}>
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="text-xs">{pub.attachments.length}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {pub.platform?.name}
                      <p className="text-xs text-slate-400">{pub.platform && PLATFORM_TYPE_LABEL[pub.platform.type]}</p>
                    </td>
                    <td className="px-4 py-3"><Badge variant="info">{PUBLICATION_TYPE_LABEL[pub.type]}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-slate-400" />{pub.viewsCount.toLocaleString('fr-FR')}</span>
                      {'  '}
                      <span className="inline-flex items-center gap-1 ml-2"><ThumbsUp className="h-3.5 w-3.5 text-slate-400" />{pub.interactionsCount.toLocaleString('fr-FR')}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{pub.author ? `${pub.author.lastName} ${pub.author.firstName}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(pub.publishedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />}
                          onClick={() => { setEditing(pub); setFormOpen(true); }} />
                        {canDelete && (
                          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />}
                            onClick={() => setToDelete(pub)} />
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

      <PublicationModal open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer la publication"
        message={`Supprimer « ${toDelete?.title} » ?`}
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)}
      />
    </PageLayout>
  );
}
