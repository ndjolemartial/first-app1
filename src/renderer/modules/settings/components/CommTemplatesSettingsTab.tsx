import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '../../communication/hooks/useCommunication';
import VariablePicker from '../../communication/components/VariablePicker';
import { COMM_VARIABLE_GROUPS_FOR_EDITOR } from '../../communication/utils/variables';
import { Mail, MessageSquare, Plus, Edit, Trash2, Save, X } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
  subject: z.string().optional(),
  body: z.string().min(1, 'Corps requis'),
  variables: z.string().optional(),
  usageType: z.enum(['AUTO', 'MANUEL']).default('MANUEL'),
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
  const { register, handleSubmit, watch, setValue, getValues, control, formState: { errors } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          ...initial,
          // Coercer les null Prisma en '' : `subject` est null pour les modèles
          // SMS/WhatsApp, or z.string().optional() rejette null → la validation
          // échouerait en silence et aucune modification ne serait enregistrée.
          subject: initial.subject ?? '',
          usageType: initial.usageType ?? 'MANUEL',
          variables: Array.isArray(initial.variables) ? initial.variables.join(', ') : '',
        }
      : { channel: 'EMAIL', usageType: 'MANUEL', isActive: true },
  });
  const channel = watch('channel');

  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectReg = register('subject');
  const bodyReg = register('body');

  const insertVariable = (target: 'subject' | 'body', token: string): void => {
    const el = target === 'subject' ? subjectRef.current : bodyRef.current;
    const current = String(getValues(target) ?? '');
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    setValue(target, current.slice(0, start) + token + current.slice(end), {
      shouldValidate: true,
      shouldDirty: true,
    });
    const key = token.replace(/[{}]/g, '');
    const declared = String(getValues('variables') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!declared.includes(key)) {
      setValue('variables', [...declared, key].join(', '), { shouldDirty: true });
    }
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      }
    });
  };

  const onSubmit = (data: FormData): void => {
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
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Type de modèle *</label>
        <select
          {...register('usageType')}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="MANUEL">Type manuel — envois manuels</option>
          <option value="AUTO">Type auto — relances automatiques</option>
        </select>
        <p className="text-xs text-slate-400 mt-1">
          Les modèles « Type auto » ne sont proposés dans l'envoi manuel qu'aux rôles SUPER ADMIN, ADMIN, MANAGER et Comptable.
        </p>
      </div>
      {channel === 'EMAIL' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-slate-700">Sujet</label>
            <VariablePicker onInsert={(t) => insertVariable('subject', t)} />
          </div>
          <input
            {...subjectReg}
            ref={(el) => { subjectReg.ref(el); subjectRef.current = el; }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-700">
            Corps du message *
            {channel === 'EMAIL' && <span className="ml-2 text-slate-400 font-normal">(HTML — mise en forme, images, liens)</span>}
          </label>
          {channel === 'SMS' && (
            <VariablePicker onInsert={(t) => insertVariable('body', t)} />
          )}
        </div>
        {channel === 'EMAIL' ? (
          <Controller
            control={control}
            name="body"
            render={({ field }) => (
              <RichTextEditor
                value={field.value || ''}
                onChange={(html) => {
                  field.onChange(html);
                  // Synchronise la liste de variables déclarées avec celles présentes dans le HTML.
                  const found = Array.from(html.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((m) => m[1]);
                  const unique = Array.from(new Set(found));
                  if (unique.length) {
                    const declared = String(getValues('variables') ?? '')
                      .split(',').map((v) => v.trim()).filter(Boolean);
                    const merged = Array.from(new Set([...declared, ...unique]));
                    setValue('variables', merged.join(', '), { shouldDirty: true });
                  }
                }}
                variables={COMM_VARIABLE_GROUPS_FOR_EDITOR}
                minHeight={260}
                placeholder="Saisissez le message — barre d'outils pour mise en forme, images, liens. Insérez les variables via le bouton dédié."
              />
            )}
          />
        ) : (
          <textarea
            rows={5}
            {...bodyReg}
            ref={(el) => { bodyReg.ref(el); bodyRef.current = el; }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            placeholder="Saisissez le message — bouton « Insérer une variable » pour les champs dynamiques {{...}}"
          />
        )}
        {errors.body && <p className="text-xs text-red-500 mt-1">{errors.body.message}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Variables (séparées par des virgules)</label>
        <input
          {...register('variables')}
          placeholder="firstName, dueDate, amount"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <p className="text-xs text-slate-400 mt-1">Complétée automatiquement à chaque variable insérée. Ex : firstName, dueDate, conventionRef</p>
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

export default function CommTemplatesSettingsTab() {
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: res, isLoading } = useTemplates(channelFilter || undefined);
  const templates = res?.data ?? [];
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const handleCreate = async (data: any): Promise<void> => {
    const r = await createTemplate.mutateAsync(data);
    if (r.success) setCreating(false);
  };

  const handleUpdate = async (data: any): Promise<void> => {
    const r = await updateTemplate.mutateAsync({ id: editing.id, payload: data });
    if (r.success) setEditing(null);
  };

  const handleDelete = async (): Promise<void> => {
    await deleteTemplate.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* En-tête du tab */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Modèles de messages</h2>
          <p className="text-sm text-slate-500">
            Bibliothèque des modèles email et SMS utilisés pour les envois manuels et les relances automatiques.
            Les variables <span className="font-mono text-xs">{'{{firstName}}'}</span>, <span className="font-mono text-xs">{'{{dueDate}}'}</span>… sont remplacées à l'envoi.
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          Nouveau modèle
        </Button>
      </div>

      {/* Filtre canal */}
      <div className="flex gap-2">
        {['', 'EMAIL', 'SMS', 'WHATSAPP'].map((c) => (
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
        <Card>
          <h3 className="font-semibold text-slate-800 mb-4">Nouveau modèle</h3>
          <TemplateForm
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
            loading={createTemplate.isPending}
          />
        </Card>
      )}

      {isLoading ? (
        <Card><SkeletonTable rows={4} /></Card>
      ) : templates.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-slate-400">Aucun modèle. Créez-en un.</p>
        </Card>
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
                      <Badge variant={t.usageType === 'AUTO' ? 'warning' : 'default'}>
                        {t.usageType === 'AUTO' ? 'Type auto' : 'Type manuel'}
                      </Badge>
                      {!t.isActive && <Badge variant="default">Inactif</Badge>}
                    </div>
                    {t.subject && <p className="text-sm text-slate-500 mb-1">Sujet : {t.subject}</p>}
                    <p className="text-sm text-slate-600 line-clamp-2 bg-slate-50 px-2 py-1 rounded">
                      {t.channel === 'EMAIL'
                        ? String(t.body ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                        : t.body}
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
        title="Supprimer le modèle"
        message={`Supprimer le modèle "${deleteTarget?.name}" ?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
