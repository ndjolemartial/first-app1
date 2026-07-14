import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import SocialMediaTabs from '../components/SocialMediaTabs';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Badge from '../../../shared/components/ui/Badge';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useCrmAssignees } from '../../crm/hooks/useCrm';
import { usePlatforms, useCreatePlatform, useUpdatePlatform, useDeletePlatform } from '../hooks/useSocialMedia';
import { PLATFORM_TYPE_LABEL, type SocialPlatform, type SocialPlatformType } from '../types/social-media.types';

const TYPE_OPTIONS = Object.entries(PLATFORM_TYPE_LABEL).map(([value, label]) => ({ value, label }));

const emptyForm = {
  name: '',
  type: 'FACEBOOK' as SocialPlatformType,
  url: '',
  responsibleId: '',
  notes: '',
};

export default function SocialPlatformsPage() {
  const { data: res, isLoading } = usePlatforms(true);
  const platforms: SocialPlatform[] = res?.success ? res.data ?? [] : [];
  const { data: usersRes } = useCrmAssignees();
  const users: Array<{ id: number; firstName: string; lastName: string }> = usersRes?.success ? usersRes.data ?? [] : [];

  const create = useCreatePlatform();
  const update = useUpdatePlatform();
  const remove = useDeletePlatform();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<SocialPlatform | null>(null);

  const resetForm = () => { setEditingId(null); setForm(emptyForm); setError(''); };
  const startEdit = (p: SocialPlatform) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      type: p.type,
      url: p.url ?? '',
      responsibleId: p.responsibleId ? String(p.responsibleId) : '',
      notes: p.notes ?? '',
    });
    setError('');
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) { setError('Le nom est requis.'); return; }
    const payload = {
      name,
      type: form.type,
      url: form.url.trim() || undefined,
      responsibleId: form.responsibleId ? Number(form.responsibleId) : null,
      notes: form.notes.trim() || undefined,
    };
    const r: any = editingId
      ? await update.mutateAsync({ id: editingId, payload })
      : await create.mutateAsync(payload);
    if (r.success) resetForm();
    else setError(typeof r.error === 'string' ? r.error : 'Erreur lors de l’enregistrement');
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await remove.mutateAsync(toDelete.id);
    if (editingId === toDelete.id) resetForm();
    setToDelete(null);
  };

  return (
    <PageLayout
      title="Réseaux Sociaux & Plateformes Web"
      breadcrumbs={[{ label: 'Réseaux Sociaux & Web', to: '/social-media/dashboard' }, { label: 'Plateformes' }]}
    >
      <SocialMediaTabs />

      <Card className="mb-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">{editingId ? 'Modifier la plateforme' : 'Ajouter une plateforme'}</h3>
        <p className="mb-3 text-xs text-slate-500">
          Comptes réseaux sociaux et site web dont l’activité est suivie (publications, abonnés, vues, interactions).
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-2xl">
          <Input label="Nom" required value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ex : Page Facebook Afrikimmo, Site web…" />
          <Select label="Type" options={TYPE_OPTIONS} value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SocialPlatformType }))} />
          <Input label="URL" value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://…" />
          <Select label="Responsable" placeholder="Aucun" options={users.map((u) => ({ value: String(u.id), label: `${u.lastName} ${u.firstName}` }))}
            value={form.responsibleId}
            onChange={(e) => setForm((f) => ({ ...f, responsibleId: e.target.value }))} />
        </div>
        <div className="max-w-2xl mt-3">
          <Textarea label="Notes" rows={2} value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end gap-2 max-w-2xl">
          {editingId && (
            <Button variant="secondary" size="sm" icon={<X className="h-4 w-4" />} onClick={resetForm}>Annuler</Button>
          )}
          <Button
            size="sm"
            icon={editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            loading={create.isPending || update.isPending}
            onClick={handleSubmit}
          >
            {editingId ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <p className="p-6 text-sm text-slate-400">Chargement…</p>
        ) : platforms.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Aucune plateforme enregistrée. Ajoutez-en une ci-dessus.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Responsable</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Publications</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {platforms.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    {p.url && <p className="text-xs text-slate-400 truncate max-w-xs">{p.url}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{PLATFORM_TYPE_LABEL[p.type]}</td>
                  <td className="px-4 py-3 text-slate-600">{p.responsible ? `${p.responsible.lastName} ${p.responsible.firstName}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p._count?.publications ?? 0}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => update.mutate({ id: p.id, payload: { isActive: !p.isActive } })}
                      title={p.isActive ? 'Désactiver' : 'Activer'}
                    >
                      <Badge variant={p.isActive ? 'success' : 'default'}>{p.isActive ? 'Actif' : 'Inactif'}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => startEdit(p)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />} onClick={() => setToDelete(p)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Archiver la plateforme"
        message={`Archiver « ${toDelete?.name} » ? Les publications et relevés d’abonnés déjà enregistrés ne sont pas modifiés.`}
        confirmLabel="Archiver"
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </PageLayout>
  );
}
