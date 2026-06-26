import { useEffect, useMemo } from 'react';
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
import { useGedDocuments } from '../../archiving/hooks/useGed';
import { useSelectableUsers } from '../../users/hooks/useUsers';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { Save } from 'lucide-react';

/**
 * Rôles ayant une vue complète sur les clients (lister tous les clients).
 * Les autres rôles ne voient que les clients actifs dont ils sont référents.
 */
const CLIENT_FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/**
 * Rôles ayant une vue complète sur les prospects (lister tous les prospects).
 * Les autres rôles ne voient que les prospects actifs dont ils sont référents.
 */
const PROSPECT_FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/** Statuts considérés comme « inactifs » pour un prospect (converti ou perdu). */
const PROSPECT_INACTIVE_STATUSES = ['CONVERTI', 'PERDU'];

const schema = z.object({
  type: z.enum(['NOTIFICATION', 'APPEL', 'EMAIL', 'SMS', 'REUNION', 'VISITE', 'TASK', 'RAPPEL', 'DOCUMENT']),
  subject: z.string().min(1, 'Sujet requis'),
  description: z.string().optional(),
  status: z.enum(['EN_ATTENTE', 'EN_TRAITEMENT', 'TRAITE', 'ANNULE']).default('EN_ATTENTE'),
  dueDate: z.string().optional(),
  userId: z.coerce.number().optional(),
  clientId: z.coerce.number().optional(),
  prospectId: z.coerce.number().optional(),
  propertyId: z.coerce.number().optional(),
  programmeId: z.coerce.number().optional(),
  lotissementId: z.coerce.number().optional(),
  terrainId: z.coerce.number().optional(),
  conventionId: z.coerce.number().optional(),
  invoiceId: z.coerce.number().optional(),
  installmentId: z.coerce.number().optional(),
  documentId: z.coerce.number().optional(),
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
  'userId', 'clientId', 'prospectId', 'propertyId', 'programmeId',
  'lotissementId', 'terrainId', 'conventionId', 'invoiceId', 'installmentId',
  'documentId',
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

  const currentRole = useAuthStore((s) => s.user?.role);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.token)!;
  // Liste filtrée côté serveur (utilisateurs actifs + rôles autorisés selon le rôle connecté).
  const { data: usersRes } = useSelectableUsers();
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: prospectsRes } = useProspects({}, 1, 500);
  const { data: propertiesRes } = useProperties({ crmReferentScope: true }, 1, 500);
  // Lotissement et Programme immobilier sont masqués pour AGENT / AGENT_TECHNIQUE / READONLY.
  const canSeeLotProg = !['AGENT', 'AGENT_TECHNIQUE', 'READONLY'].includes(currentRole ?? '');
  const { data: programmesRes } = useProgrammes({}, 1, 500, { enabled: canSeeLotProg });
  const { data: lotissementsRes } = useLotissements({}, 1, 500, { enabled: canSeeLotProg });
  const { data: terrainsRes } = useTerrains({ crmReferentScope: true }, 1, 500);
  const { data: conventionsRes } = useConventions({ crmReferentScope: true }, 1, 500);
  const { data: invoicesRes } = useInvoices({ crmReferentScope: true }, 1, 500);
  const { data: installmentsRes } = useAllInstallments(true);
  // Archives (documents GED) — proposées uniquement à l'Assistante de Direction.
  const isAssistanteDirection = currentRole === 'ASSISTANTE_DIRECTION';
  const { data: archivesRes } = useGedDocuments({}, 1, 1000, { enabled: isAssistanteDirection });

  const userOptions = [
    { value: '', label: '— Utilisateur (optionnel) —' },
    ...(usersRes?.data ?? []).map((u: any) => ({
      value: String(u.id),
      label: `${formatPersonName(u, `Utilisateur #${u.id}`)}${u.matricule ? ` (${u.matricule})` : ''}`,
    })),
  ];

  const clientHasFullView = CLIENT_FULL_VIEW_ROLES.includes(currentRole ?? '');
  const clientOptions = [
    { value: '', label: '— Client (optionnel) —' },
    ...(clientsRes?.data ?? [])
      .filter((c: any) =>
        clientHasFullView || (c.isActive && c.assignedToId === currentUserId)
      )
      .map((c: any) => ({
        value: String(c.id),
        label: formatPersonName(c, ''),
      })),
  ];

  const prospectHasFullView = PROSPECT_FULL_VIEW_ROLES.includes(currentRole ?? '');
  const prospectOptions = [
    { value: '', label: '— Prospect (optionnel) —' },
    ...(prospectsRes?.data ?? [])
      .filter((p: any) =>
        prospectHasFullView ||
        (!PROSPECT_INACTIVE_STATUSES.includes(p.status) && p.assignedToId === currentUserId)
      )
      .map((p: any) => ({
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

  // Programmes / lotissements actifs (hors statut terminal), pour tous les rôles.
  const programmeOptions = [
    { value: '', label: '— Programme immobilier (optionnel) —' },
    ...(programmesRes?.data ?? [])
      .filter((p: any) => p.statut !== 'CLOTURE')
      .map((p: any) => ({
        value: String(p.id),
        label: `${p.reference} — ${p.nom}`,
      })),
  ];

  const lotissementOptions = [
    { value: '', label: '— Lotissement (optionnel) —' },
    ...(lotissementsRes?.data ?? [])
      .filter((l: any) => l.statut !== 'FERME')
      .map((l: any) => ({
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

  // Recherche distante (serveur) pour afficher n'importe quel enregistrement
  // quel que soit le volume. On réplique les mêmes prédicats que les listes
  // préchargées ci-dessus (visibilité par rôle pour client/prospect, périmètre
  // référent CRM pour bien/terrain) afin de conserver un comportement identique.
  const searchClients = useMemo(() => async (q: string) => {
    const r: any = await window.electron.clients.list(token, q ? { search: q } : {}, 1, 100);
    return (r?.data ?? [])
      .filter((c: any) => clientHasFullView || (c.isActive && c.assignedToId === currentUserId))
      .map((c: any) => ({ value: String(c.id), label: formatPersonName(c, '') }));
  }, [token, clientHasFullView, currentUserId]);

  const searchProspects = useMemo(() => async (q: string) => {
    const r: any = await window.electron.prospects.list(token, q ? { search: q } : {}, 1, 100);
    return (r?.data ?? [])
      .filter((p: any) =>
        prospectHasFullView ||
        (!PROSPECT_INACTIVE_STATUSES.includes(p.status) && p.assignedToId === currentUserId))
      .map((p: any) => ({ value: String(p.id), label: formatPersonName(p, '') }));
  }, [token, prospectHasFullView, currentUserId]);

  const searchProperties = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.properties.list(token, f, p, l),
    (p: any) => ({ value: String(p.id), label: `${p.reference} — ${p.address}` }),
    { crmReferentScope: true },
  ), [token]);

  const searchTerrains = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.terrains.list(token, f, p, l),
    (t: any) => {
      const loc = [
        t.numeroIlot ? `Îlot ${t.numeroIlot}` : '',
        t.numeroParcelle ? `Lot ${t.numeroParcelle}` : '',
      ].filter(Boolean).join(', ');
      return {
        value: String(t.id),
        label: `${t.reference}${loc ? ` — ${loc}` : ''}${t.lotissement?.nom ? ` — ${t.lotissement.nom}` : ''}`,
      };
    },
    { crmReferentScope: true },
  ), [token]);

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

  // Archives : libellé concis (référence — nom) ; la recherche couvre en plus la
  // catégorie, la description et le dossier via `searchText`.
  const archiveOptions = [
    { value: '', label: '— Archive (optionnel) —' },
    ...(archivesRes?.data ?? []).map((doc: any) => {
      const ref = doc.numeroArchive ?? '';
      const cat = doc.documentCategory?.name ?? '';
      const folder = doc.folder?.name ?? '';
      const desc = doc.description ?? '';
      return {
        value: String(doc.id),
        label: ref ? `${ref} — ${doc.name}` : doc.name,
        searchText: [doc.name, cat, desc, ref, folder].filter(Boolean).join(' '),
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
        userId: act.userId ?? undefined,
        clientId: act.clientId ?? undefined,
        prospectId: act.prospectId ?? undefined,
        propertyId: act.propertyId ?? undefined,
        programmeId: act.programmeId ?? undefined,
        lotissementId: act.lotissementId ?? undefined,
        terrainId: act.terrainId ?? undefined,
        conventionId: act.conventionId ?? undefined,
        invoiceId: act.invoiceId ?? undefined,
        installmentId: act.installmentId ?? undefined,
        documentId: act.documentId ?? undefined,
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
            <FormSearchSelect control={control} name="userId" label="Utilisateur" options={userOptions} />
            <FormSearchSelect control={control} name="clientId" label="Client" options={clientOptions} onSearch={searchClients} />
            <FormSearchSelect control={control} name="prospectId" label="Prospect" options={prospectOptions} onSearch={searchProspects} />
            <FormSearchSelect control={control} name="propertyId" label="Bien immobilier" options={propertyOptions} onSearch={searchProperties} />
            {canSeeLotProg && (
              <>
                <FormSearchSelect control={control} name="programmeId" label="Programme immobilier" options={programmeOptions} />
                <FormSearchSelect control={control} name="lotissementId" label="Lotissement" options={lotissementOptions} />
              </>
            )}
            <FormSearchSelect control={control} name="terrainId" label="Terrain" options={terrainOptions} onSearch={searchTerrains} />
            <FormSearchSelect control={control} name="conventionId" label="Convention" options={conventionOptions} />
            <FormSearchSelect control={control} name="invoiceId" label="Facture" options={invoiceOptions} />
            <FormSearchSelect control={control} name="installmentId" label="Échéance" options={installmentOptions} />
            {isAssistanteDirection && (
              <FormSearchSelect control={control} name="documentId" label="Archive" options={archiveOptions} />
            )}
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
