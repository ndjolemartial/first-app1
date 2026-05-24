import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { FormSearchSelect } from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useActivity, useCreateActivity, useUpdateActivity } from '../hooks/useCrm';
import { useClients } from '../../clients/hooks/useClients';
import { useProperties } from '../../properties/hooks/useProperties';
import { useConventions } from '../../conventions/hooks/useConventions';
import { useProspects } from '../../prospects/hooks/useProspects';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { useLotissements } from '../../lotissements/hooks/useLotissements';
import { useProgrammes } from '../../programmes/hooks/useProgrammes';
import { useInvoices, useAllInstallments } from '../../accounting/hooks/useAccounting';
import { formatPersonName } from '../../../shared/utils/format';
import { Save } from 'lucide-react';

const schema = z.object({
  type: z.enum(['NOTIFICATION', 'APPEL', 'EMAIL', 'SMS', 'REUNION', 'VISITE', 'TASK', 'RAPPEL', 'DOCUMENT']),
  subject: z.string().min(1, 'Sujet requis'),
  description: z.string().optional(),
  status: z.enum(['EN_ATTENTE', 'EN_TRAITEMENT', 'TRAITE', 'ANNULE']).default('EN_ATTENTE'),
  dueDate: z.string().optional(),
  clientId: z.coerce.number().optional(),
  prospectId: z.coerce.number().optional(),
  propertyId: z.coerce.number().optional(),
  programmeId: z.coerce.number().optional(),
  lotissementId: z.coerce.number().optional(),
  terrainId: z.coerce.number().optional(),
  conventionId: z.coerce.number().optional(),
  invoiceId: z.coerce.number().optional(),
  installmentId: z.coerce.number().optional(),
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

/** Champs de rattachement à une entité — tous optionnels. */
const ENTITY_FIELDS = [
  'clientId', 'prospectId', 'propertyId', 'programmeId',
  'lotissementId', 'terrainId', 'conventionId', 'invoiceId', 'installmentId',
] as const;

function toDateTimeLocal(val?: string | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

/** Nom affichable d'un client (particulier : nom + prénom ; entreprise : raison sociale). */
function clientName(c: any): string {
  return formatPersonName(c, '');
}

export default function ActivityFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useActivity(isEdit ? Number(id) : 0);
  const create = useCreateActivity();
  const update = useUpdateActivity();

  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: prospectsRes } = useProspects({}, 1, 500);
  const { data: propertiesRes } = useProperties({}, 1, 500);
  const { data: programmesRes } = useProgrammes({}, 1, 500);
  const { data: lotissementsRes } = useLotissements({}, 1, 500);
  const { data: terrainsRes } = useTerrains({}, 1, 500);
  const { data: conventionsRes } = useConventions({}, 1, 500);
  const { data: invoicesRes } = useInvoices({}, 1, 500);
  const { data: installmentsRes } = useAllInstallments();

  const clientOptions = [
    { value: '', label: '— Client (optionnel) —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: formatPersonName(c, ''),
    })),
  ];

  const prospectOptions = [
    { value: '', label: '— Prospect (optionnel) —' },
    ...(prospectsRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: formatPersonName(p, ''),
    })),
  ];

  const propertyOptions = [
    { value: '', label: '— Bien (optionnel) —' },
    ...(propertiesRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.address}`,
    })),
  ];

  const programmeOptions = [
    { value: '', label: '— Programme immobilier (optionnel) —' },
    ...(programmesRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.nom}`,
    })),
  ];

  const lotissementOptions = [
    { value: '', label: '— Lotissement (optionnel) —' },
    ...(lotissementsRes?.data ?? []).map((l: any) => ({
      value: String(l.id),
      label: `${l.reference} — ${l.nom}`,
    })),
  ];

  const terrainOptions = [
    { value: '', label: '— Terrain (optionnel) —' },
    ...(terrainsRes?.data ?? []).map((t: any) => {
      const loc = [
        t.numeroIlot ? `Îlot ${t.numeroIlot}` : '',
        t.numeroParcelle ? `Lot ${t.numeroParcelle}` : '',
      ].filter(Boolean).join(', ');
      return {
        value: String(t.id),
        label: `${t.reference}${loc ? ` — ${loc}` : ''}${t.lotissement?.nom ? ` — ${t.lotissement.nom}` : ''}`,
      };
    }),
  ];

  const conventionOptions = [
    { value: '', label: '— Convention (optionnel) —' },
    ...(conventionsRes?.data ?? []).map((c: any) => {
      const cn = clientName(c.client);
      return {
        value: String(c.id),
        label: cn ? `${c.reference} — ${cn}` : c.reference,
      };
    }),
  ];

  const invoiceOptions = [
    { value: '', label: '— Facture (optionnel) —' },
    ...(invoicesRes?.data ?? []).map((inv: any) => {
      const cn = clientName(inv.client);
      return {
        value: String(inv.id),
        label: cn ? `${inv.reference} — ${cn}` : inv.reference,
      };
    }),
  ];

  const installmentOptions = [
    { value: '', label: '— Échéance (optionnel) —' },
    ...(installmentsRes?.data ?? []).map((inst: any) => {
      const cn = clientName(inst.convention?.client);
      return {
        value: String(inst.id),
        label: `${inst.convention?.reference ?? 'Convention'} — Échéance n°${inst.installmentNumber}`
          + (cn ? ` — ${cn}` : ''),
      };
    }),
  ];

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, any, FormData>({
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
        prospectId: act.prospectId ?? undefined,
        propertyId: act.propertyId ?? undefined,
        programmeId: act.programmeId ?? undefined,
        lotissementId: act.lotissementId ?? undefined,
        terrainId: act.terrainId ?? undefined,
        conventionId: act.conventionId ?? undefined,
        invoiceId: act.invoiceId ?? undefined,
        installmentId: act.installmentId ?? undefined,
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload: any = { ...data };
    if (payload.dueDate) payload.dueDate = new Date(payload.dueDate).toISOString();
    else delete payload.dueDate;
    // Retire les rattachements non renseignés (0 / vide).
    for (const field of ENTITY_FIELDS) {
      if (!payload[field]) delete payload[field];
    }

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
          <h3 className="text-base font-semibold text-slate-800 mb-1">Entité associée</h3>
          <p className="text-xs text-slate-400 mb-4">
            Rattachez l'activité à une ou plusieurs entités — tous les champs sont optionnels.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FormSearchSelect control={control} name="clientId" label="Client" options={clientOptions} />
            <FormSearchSelect control={control} name="prospectId" label="Prospect" options={prospectOptions} />
            <FormSearchSelect control={control} name="propertyId" label="Bien immobilier" options={propertyOptions} />
            <FormSearchSelect control={control} name="programmeId" label="Programme immobilier" options={programmeOptions} />
            <FormSearchSelect control={control} name="lotissementId" label="Lotissement" options={lotissementOptions} />
            <FormSearchSelect control={control} name="terrainId" label="Terrain" options={terrainOptions} />
            <FormSearchSelect control={control} name="conventionId" label="Convention" options={conventionOptions} />
            <FormSearchSelect control={control} name="invoiceId" label="Facture" options={invoiceOptions} />
            <FormSearchSelect control={control} name="installmentId" label="Échéance" options={installmentOptions} />
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
