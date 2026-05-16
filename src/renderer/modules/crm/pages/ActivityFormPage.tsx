import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useActivity, useCreateActivity, useUpdateActivity } from '../hooks/useCrm';
import { useClients } from '../../clients/hooks/useClients';
import { useProperties } from '../../properties/hooks/useProperties';
import { useContracts } from '../../contracts/hooks/useContracts';
import { Save } from 'lucide-react';

const schema = z.object({
  type: z.enum(['NOTIFICATION', 'APPEL', 'EMAIL', 'SMS', 'REUNION', 'VISITE', 'TASK', 'RAPPEL', 'DOCUMENT']),
  subject: z.string().min(1, 'Sujet requis'),
  description: z.string().optional(),
  status: z.enum(['EN_ATTENTE', 'EN_TRAITEMENT', 'TRAITE', 'ANNULE']).default('EN_ATTENTE'),
  dueDate: z.string().optional(),
  clientId: z.coerce.number().optional(),
  propertyId: z.coerce.number().optional(),
  contractId: z.coerce.number().optional(),
});

type FormData = z.infer<typeof schema>;

const TYPE_OPTIONS = [
  { value: 'TASK', label: 'Tâche' },
  { value: 'APPEL', label: 'Appel téléphonique' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'REUNION', label: 'Réunion' },
  { value: 'VISITE', label: 'Visite' },
  { value: 'RAPPEL', label: 'Rappel' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'NOTIFICATION', label: 'Notification' },
];

const STATUS_OPTIONS = [
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'EN_TRAITEMENT', label: 'En cours' },
  { value: 'TRAITE', label: 'Traité' },
  { value: 'ANNULE', label: 'Annulé' },
];

function toDateTimeLocal(val?: string | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

export default function ActivityFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useActivity(isEdit ? Number(id) : 0);
  const create = useCreateActivity();
  const update = useUpdateActivity();
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: propertiesRes } = useProperties({}, 1, 500);
  const { data: contractsRes } = useContracts({}, 1, 500);

  const clientOptions = [
    { value: '', label: '— Client (optionnel) —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: c.type === 'INDIVIDUEL'
        ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
        : (c.entreprise ?? ''),
    })),
  ];

  const propertyOptions = [
    { value: '', label: '— Bien (optionnel) —' },
    ...(propertiesRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.address}`,
    })),
  ];

  const contractOptions = [
    { value: '', label: '— Contrat (optionnel) —' },
    ...(contractsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: c.reference,
    })),
  ];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'TASK', status: 'EN_ATTENTE' },
  });

  useEffect(() => {
    if (isEdit && res?.data) {
      const act = res.data;
      reset({
        type: act.type,
        subject: act.subject,
        description: act.description ?? '',
        status: act.status,
        dueDate: toDateTimeLocal(act.dueDate),
        clientId: act.clientId ?? undefined,
        propertyId: act.propertyId ?? undefined,
        contractId: act.contractId ?? undefined,
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload: any = { ...data };
    if (payload.dueDate) payload.dueDate = new Date(payload.dueDate).toISOString();
    else delete payload.dueDate;
    if (!payload.clientId) delete payload.clientId;
    if (!payload.propertyId) delete payload.propertyId;
    if (!payload.contractId) delete payload.contractId;

    let r;
    if (isEdit) r = await update.mutateAsync({ id: Number(id), payload });
    else r = await create.mutateAsync(payload);
    if (r.success) navigate('/crm');
  };

  return (
    <PageLayout
      title={isEdit ? "Modifier l'activité" : 'Nouvelle activité'}
      breadcrumbs={[{ label: 'CRM', to: '/crm' }, { label: isEdit ? 'Modifier' : 'Nouvelle' }]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto">
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Activité</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type *" options={TYPE_OPTIONS} error={errors.type?.message} {...register('type')} />
            <Select label="Statut" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          <div className="mt-4">
            <Input label="Sujet *" error={errors.subject?.message} {...register('subject')} />
          </div>
          <div className="mt-4">
            <Input label="Date / Heure prévue" type="datetime-local" {...register('dueDate')} />
          </div>
          <div className="mt-4">
            <Textarea label="Description" rows={3} {...register('description')} />
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Entité associée</h3>
          <div className="space-y-4">
            <Select label="Client" options={clientOptions} {...register('clientId')} />
            <Select label="Bien immobilier" options={propertyOptions} {...register('propertyId')} />
            <Select label="Contrat" options={contractOptions} {...register('contractId')} />
          </div>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/crm')}>Annuler</Button>
          <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
