import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
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
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useInnovations, useDeleteInnovation } from '../hooks/useItInnovations';
import InnovationFormModal from '../components/InnovationFormModal';
import { STATUS_LABEL, STATUS_BADGE_VARIANT, type ItInnovation } from '../types/it-innovation.types';
import { Plus, Trash2, Lightbulb, Paperclip } from 'lucide-react';

const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

export default function ItInnovationsListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canDelete = DELETE_ROLES.includes(role);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const filters = { status: status || undefined, search: search || undefined };

  const { data, isLoading } = useInnovations(filters, page, 20);
  const del = useDeleteInnovation();

  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ItInnovation | null>(null);

  const innovations: ItInnovation[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Innovations IT"
      breadcrumbs={[{ label: 'Innovations IT' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
          Nouvelle innovation
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Rechercher" placeholder="Titre, référence…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-64">
          <Select label="Statut" placeholder="Tous les statuts"
            options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : innovations.length === 0 ? (
          <EmptyState
            icon={<Lightbulb className="h-10 w-10" />}
            title="Aucune innovation IT enregistrée"
            action={{ label: 'Nouvelle innovation', onClick: () => setFormOpen(true) }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Porteur</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Progression</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Créée le</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {innovations.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/innovations/${it.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{it.reference}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{it.title}</span>
                        {!!it._count?.attachments && (
                          <span className="flex items-center gap-0.5 text-slate-400" title={`${it._count.attachments} pièce(s) jointe(s)`}>
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="text-xs">{it._count.attachments}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {it.employee ? `${it.employee.lastName} ${it.employee.firstName}` : '—'}
                    </td>
                    <td className="px-4 py-3"><Badge variant={STATUS_BADGE_VARIANT[it.status]}>{STATUS_LABEL[it.status]}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 w-32">
                        <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${it.progress}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">{it.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(it.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {canDelete && (
                          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />}
                            onClick={() => setToDelete(it)} />
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

      <InnovationFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => navigate(`/innovations/${id}`)}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer l’innovation"
        message={`Supprimer « ${toDelete?.title} » ?`}
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)}
      />
    </PageLayout>
  );
}
