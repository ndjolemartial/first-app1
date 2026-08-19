import { useRef, useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { formatDate } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useSelectableUsers } from '../../users/hooks/useUsers';
import { useAmlTrainings, useCreateAmlTraining, useUpdateAmlTraining, useDeleteAmlTraining } from '../hooks/useAml';
import type { AmlTraining } from '../types/aml.types';
import { Plus, Edit, Trash2, Save, X, Paperclip, GraduationCap } from 'lucide-react';

// En création : plusieurs participants pour une même session (une ligne
// AmlTraining par participant, créées ensemble par le serveur). En édition :
// une ligne = un participant, le champ reste un sélecteur simple.
interface EditState { id?: number; userIds: string[]; trainingDate: string; topic: string; provider: string; durationHours: string; notes: string }
const AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];

const userLabel = (u: any) => `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() || u.email;

export default function AmlTrainingListPage() {
  const token = useAuthStore((s) => s.token)!;
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = AML_ROLES.includes(role);

  const { data, isLoading } = useAmlTrainings({}, 1, 50);
  const { data: usersRes } = useSelectableUsers();
  const trainings: AmlTraining[] = data?.data ?? [];
  const users: any[] = usersRes?.data ?? [];

  const create = useCreateAmlTraining();
  const update = useUpdateAmlTraining();
  const del = useDeleteAmlTraining();

  const [editing, setEditing] = useState<EditState | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [toDelete, setToDelete] = useState<AmlTraining | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);

  const startNew = () => { setEditing({ userIds: [], trainingDate: '', topic: '', provider: '', durationHours: '', notes: '' }); setParticipantSearch(''); };
  const startEdit = (t: AmlTraining) => setEditing({
    id: t.id, userIds: [String(t.userId)], trainingDate: String(t.trainingDate).slice(0, 10),
    topic: t.topic, provider: t.provider ?? '', durationHours: t.durationHours != null ? String(t.durationHours) : '', notes: t.notes ?? '',
  });

  const toggleParticipant = (id: string) => {
    if (!editing) return;
    const set = new Set(editing.userIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    setEditing({ ...editing, userIds: Array.from(set) });
  };

  const onSave = async () => {
    if (!editing || editing.userIds.length === 0 || !editing.trainingDate || !editing.topic.trim()) return;
    const shared = {
      trainingDate: editing.trainingDate, topic: editing.topic.trim(),
      provider: editing.provider || undefined, durationHours: editing.durationHours ? Number(editing.durationHours) : undefined,
      notes: editing.notes || undefined,
    };
    const r: any = editing.id
      ? await update.mutateAsync({ id: editing.id, payload: { ...shared, userId: Number(editing.userIds[0]) } })
      : await create.mutateAsync({ ...shared, userIds: editing.userIds.map(Number) });
    if (r.success) setEditing(null);
  };

  const uploadDocs = async (trainingId: number, list: FileList | null) => {
    if (!list || !list.length) return;
    const files = Array.from(list).map((f) => ({
      sourcePath: window.electron.documents.pathForFile(f),
      originalName: f.name, mimeType: f.type || 'application/octet-stream', size: f.size,
    }));
    await window.electron.documents.import(token, { amlTrainingId: trainingId, files });
  };

  const filteredUsers = users.filter((u) => userLabel(u).toLowerCase().includes(participantSearch.toLowerCase()));

  return (
    <PageLayout title="Formations LBC/FT" breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Formations' }]}
      actions={canWrite && !editing ? <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle formation</Button> : undefined}
    >
      {canWrite && editing && (
        <Card className="mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier la formation' : 'Nouvelle formation'}</h3>
          <div className="grid grid-cols-2 gap-3">
            {editing.id ? (
              <Select label="Participant *" placeholder="Sélectionner…"
                options={users.map((u) => ({ value: String(u.id), label: userLabel(u) }))}
                value={editing.userIds[0] ?? ''} onChange={(e) => setEditing({ ...editing, userIds: [e.target.value] })} />
            ) : (
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Participants * {editing.userIds.length > 0 && <span className="font-normal text-slate-500">({editing.userIds.length} sélectionné{editing.userIds.length > 1 ? 's' : ''})</span>}
                </label>
                {editing.userIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {editing.userIds.map((id) => {
                      const u = users.find((x) => String(x.id) === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {u ? userLabel(u) : `#${id}`}
                          <button type="button" onClick={() => toggleParticipant(id)} className="hover:text-blue-900" aria-label="Retirer">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <Input placeholder="Rechercher un participant…" value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)} className="mb-1.5" />
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
                  {filteredUsers.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">Aucun utilisateur</p>}
                  {filteredUsers.map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={editing.userIds.includes(String(u.id))} onChange={() => toggleParticipant(String(u.id))} className="h-4 w-4 rounded border-slate-300" />
                      {userLabel(u)}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Input label="Date *" type="date" value={editing.trainingDate} onChange={(e) => setEditing({ ...editing, trainingDate: e.target.value })} />
            <Input label="Sujet *" value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} className="col-span-2" />
            <Input label="Organisme" value={editing.provider} onChange={(e) => setEditing({ ...editing, provider: e.target.value })} />
            <Input label="Durée (heures)" type="number" value={editing.durationHours} onChange={(e) => setEditing({ ...editing, durationHours: e.target.value })} />
          </div>
          <Textarea label="Notes" rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={create.isPending || update.isPending} onClick={onSave}>
              Enregistrer{!editing.id && editing.userIds.length > 1 ? ` (${editing.userIds.length} participants)` : ''}
            </Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : trainings.length === 0 ? (
          <EmptyState icon={<GraduationCap className="h-10 w-10" />} title="Aucune formation enregistrée"
            action={canWrite ? { label: 'Nouvelle formation', onClick: startNew } : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Participant</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Sujet</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Organisme</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                {canWrite && <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trainings.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.reference}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.userName ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{t.topic}</td>
                  <td className="px-4 py-3 text-slate-500">{t.provider ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(t.trainingDate)}</td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Paperclip className="h-4 w-4" />}
                          onClick={() => { setUploadTargetId(t.id); fileInputRef.current?.click(); }} />
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(t)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(t)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <input ref={fileInputRef} type="file" multiple className="hidden"
        onChange={(e) => { if (uploadTargetId) uploadDocs(uploadTargetId, e.target.files); e.target.value = ''; setUploadTargetId(null); }} />

      {canWrite && (
        <ConfirmDialog open={!!toDelete} title="Supprimer la formation" message={`Supprimer « ${toDelete?.topic ?? ''} » ?`}
          onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }} onClose={() => setToDelete(null)} />
      )}
    </PageLayout>
  );
}
