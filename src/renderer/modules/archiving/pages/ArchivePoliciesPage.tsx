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
import { usePolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy } from '../hooks/useArchiving';
import { Plus, Edit, Trash2, Save, X, Shield } from 'lucide-react';

const ENTITY_LABEL: Record<string, string> = {
  CLIENT: 'Client', PROSPECT: 'Prospect', OWNER: 'Propriétaire',
  PROPERTY: 'Bien', CONTRACT: 'Contrat', INVOICE: 'Facture', DOCUMENT: 'Document',
};

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  entityType: z.enum(['CLIENT', 'PROSPECT', 'OWNER', 'PROPERTY', 'CONTRACT', 'INVOICE', 'DOCUMENT']),
  triggerCondition: z.string().min(1, 'Condition requise'),
  retentionDays: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});
type FormData = z.infer<typeof schema>;

const ENTITY_OPTIONS = Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label }));

function PolicyForm({
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
  const { register, handleSubmit, formState: { errors } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          ...initial,
          triggerCondition: typeof initial.triggerCondition === 'object'
            ? JSON.stringify(initial.triggerCondition, null, 2)
            : initial.triggerCondition,
        }
      : { entityType: 'CONTRACT', isActive: true, triggerCondition: '{"status": "TERMINER", "olderThanDays": 365}' },
  });

  const onSubmit = (data: FormData) => {
    try {
      const parsed = { ...data, triggerCondition: JSON.parse(data.triggerCondition) };
      onSave(parsed);
    } catch {
      alert('La condition JSON est invalide.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nom *</label>
          <input {...register('name')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Type d'entité *</label>
          <select {...register('entityType')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
        <input {...register('description')}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Condition de déclenchement (JSON) *</label>
        <textarea rows={3} {...register('triggerCondition')}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {errors.triggerCondition && <p className="text-xs text-red-500 mt-1">{errors.triggerCondition.message}</p>}
        <p className="text-xs text-slate-400 mt-1">Ex : {"{ \"status\": \"TERMINER\", \"olderThanDays\": 365 }"}</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Durée de rétention (jours, vide = illimitée)</label>
        <input type="number" min="1" {...register('retentionDays')}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="policyActive" {...register('isActive')} className="rounded" />
        <label htmlFor="policyActive" className="text-sm text-slate-700">Politique active</label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" icon={<X className="h-4 w-4" />} onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading} icon={<Save className="h-4 w-4" />}>Enregistrer</Button>
      </div>
    </form>
  );
}

export default function ArchivePoliciesPage() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: res, isLoading } = usePolicies();
  const policies = res?.data ?? [];
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const deletePolicy = useDeletePolicy();

  const handleCreate = async (data: any) => {
    const r = await createPolicy.mutateAsync(data);
    if (r.success) setCreating(false);
  };

  const handleUpdate = async (data: any) => {
    const r = await updatePolicy.mutateAsync({ id: editing.id, payload: data });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => {
    await deletePolicy.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <PageLayout
      title="Politiques d'archivage"
      breadcrumbs={[{ label: 'Archivage', to: '/archiving' }, { label: 'Politiques' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          Nouvelle politique
        </Button>
      }
    >
      <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
        <strong>Les politiques d'archivage automatique</strong> définissent des règles qui peuvent être appliquées manuellement ou via des scripts planifiés pour archiver automatiquement les entités remplissant les conditions définies.
      </div>

      {creating && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">Nouvelle politique</h3>
          <PolicyForm onSave={handleCreate} onCancel={() => setCreating(false)} loading={createPolicy.isPending} />
        </Card>
      )}

      {isLoading ? (
        <div className="p-6"><SkeletonTable rows={4} /></div>
      ) : policies.length === 0 ? (
        <div className="py-16 text-center text-slate-400">Aucune politique définie.</div>
      ) : (
        <div className="space-y-4">
          {policies.map((p: any) => (
            <Card key={p.id}>
              {editing?.id === p.id ? (
                <>
                  <h3 className="font-semibold text-slate-800 mb-4">Modifier — {p.name}</h3>
                  <PolicyForm initial={p} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={updatePolicy.isPending} />
                </>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-indigo-500" />
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      <Badge variant="default">{ENTITY_LABEL[p.entityType] ?? p.entityType}</Badge>
                      {p.isActive
                        ? <Badge variant="success">Active</Badge>
                        : <Badge variant="default">Inactive</Badge>}
                    </div>
                    {p.description && <p className="text-sm text-slate-500 mb-1">{p.description}</p>}
                    <div className="flex gap-4 text-xs text-slate-400 mt-1">
                      <span>Condition : <code className="bg-slate-50 px-1.5 py-0.5 rounded font-mono">{JSON.stringify(p.triggerCondition)}</code></span>
                      <span>Rétention : {p.retentionDays ? `${p.retentionDays} jours` : 'Illimitée'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="secondary" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => setEditing(p)}>
                      Modifier
                    </Button>
                    <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(p)} />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer la politique"
        message={`Supprimer la politique "${deleteTarget?.name}" ?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
