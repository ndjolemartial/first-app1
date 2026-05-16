import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '../hooks/useCommunication';
import { Mail, MessageSquare, Plus, Edit, Trash2, Save, X } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  channel: z.enum(['EMAIL', 'SMS']),
  subject: z.string().optional(),
  body: z.string().min(1, 'Corps requis'),
  variables: z.string().optional(),
  isActive: z.boolean().default(true),
});
type FormData = z.infer<typeof schema>;

function TemplateForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          ...initial,
          variables: Array.isArray(initial.variables) ? initial.variables.join(', ') : '',
        }
      : { channel: 'EMAIL', isActive: true },
  });
  const channel = watch('channel');

  const onSubmit = (data: FormData) => {
    const vars = data.variables
      ? data.variables.split(',').map((v) => v.trim()).filter(Boolean)
      : [];
    onSave({ ...data, variables: vars });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nom du template *</label>
          <input
            {...register('name')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Canal *</label>
          <select
            {...register('channel')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
          </select>
        </div>
      </div>
      {channel === 'EMAIL' && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Sujet</label>
          <input
            {...register('subject')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Corps du message *</label>
        <textarea
          rows={5}
          {...register('body')}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          placeholder="Utilisez {{variableName}} pour les variables dynamiques"
        />
        {errors.body && <p className="text-xs text-red-500 mt-1">{errors.body.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Variables (séparées par des virgules)</label>
        <input
          {...register('variables')}
          placeholder="firstName, dueDate, amount"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <p className="text-xs text-slate-400 mt-1">Ex : firstName, dueDate, contractRef</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="isActive" {...register('isActive')} className="rounded" />
        <label htmlFor="isActive" className="text-sm text-slate-700">Template actif</label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" icon={<X className="h-4 w-4" />} onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
      </div>
    </form>
  );
}

export default function TemplatesPage() {
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: res, isLoading } = useTemplates(channelFilter || undefined);
  const templates = res?.data ?? [];
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const handleCreate = async (data: any) => {
    const r = await createTemplate.mutateAsync(data);
    if (r.success) setCreating(false);
  };

  const handleUpdate = async (data: any) => {
    const r = await updateTemplate.mutateAsync({ id: editing.id, payload: data });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => {
    await deleteTemplate.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <PageLayout
      title="Templates de communication"
      breadcrumbs={[{ label: 'Communication', to: '/communication' }, { label: 'Templates' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          Nouveau template
        </Button>
      }
    >
      {/* Filtre canal */}
      <div className="flex gap-2 mb-6">
        {['', 'EMAIL', 'SMS'].map((c) => (
          <button
            key={c}
            onClick={() => setChannelFilter(c)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              channelFilter === c
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c === '' ? 'Tous' : c}
          </button>
        ))}
      </div>

      {/* Formulaire création */}
      {creating && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">Nouveau template</h3>
          <TemplateForm
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
            loading={createTemplate.isPending}
          />
        </Card>
      )}

      {isLoading ? (
        <div className="p-6"><SkeletonTable rows={4} /></div>
      ) : templates.length === 0 ? (
        <div className="py-16 text-center text-slate-400">Aucun template. Créez-en un.</div>
      ) : (
        <div className="space-y-4">
          {templates.map((t: any) => (
            <Card key={t.id}>
              {editing?.id === t.id ? (
                <>
                  <h3 className="font-semibold text-slate-800 mb-4">Modifier — {t.name}</h3>
                  <TemplateForm
                    initial={t}
                    onSave={handleUpdate}
                    onCancel={() => setEditing(null)}
                    loading={updateTemplate.isPending}
                  />
                </>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {t.channel === 'EMAIL'
                        ? <Mail className="h-4 w-4 text-blue-500" />
                        : <MessageSquare className="h-4 w-4 text-green-500" />}
                      <span className="font-semibold text-slate-900">{t.name}</span>
                      <Badge variant={t.channel === 'EMAIL' ? 'info' : 'success'}>{t.channel}</Badge>
                      {!t.isActive && <Badge variant="default">Inactif</Badge>}
                    </div>
                    {t.subject && <p className="text-sm text-slate-500 mb-1">Sujet : {t.subject}</p>}
                    <p className="text-sm text-slate-600 line-clamp-2 font-mono bg-slate-50 px-2 py-1 rounded">
                      {t.body}
                    </p>
                    {Array.isArray(t.variables) && t.variables.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {t.variables.map((v: string) => (
                          <span key={v} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="secondary" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => setEditing(t)}>
                      Modifier
                    </Button>
                    <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(t)} />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer le template"
        message={`Supprimer le template "${deleteTarget?.name}" ?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
