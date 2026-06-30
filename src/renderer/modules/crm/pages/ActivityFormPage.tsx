import { useEffect, useMemo, useRef, useState } from 'react';
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
import { toast } from '../../../shared/components/ui/Toast';
import { Save, Paperclip, FileText, X } from 'lucide-react';

/** Formate une taille en octets de façon lisible. */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const ATTACH_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*,video/*,audio/*';

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

  // Pièces jointes : fichiers à téléverser (accessible à tous les rôles pouvant
  // créer une activité, soit tous sauf READONLY) + pièces déjà jointes (édition).
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const existingAttachments: any[] = (isEdit && res?.data?.attachments) || [];

  const addFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  /** Téléverse les fichiers sélectionnés et les rattache à l'activité créée/éditée. */
  const uploadAttachments = async (activityId: number): Promise<boolean> => {
    if (!files.length) return true;
    const payload = {
      crmActivityId: activityId,
      files: files.map((f) => ({
        sourcePath: window.electron.documents.pathForFile(f),
        originalName: f.name,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
      })),
    };
    const r: any = await window.electron.documents.import(token, payload);
    if (!r?.success) {
      toast.error(`Pièces jointes : ${String(r?.error ?? 'échec du téléversement')}`);
      return false;
    }
    toast.success(`${r.data?.length ?? files.length} pièce(s) jointe(s) ajoutée(s)`);
    return true;
  };
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
    if (!r.success) {
      toast.error(typeof r.error === 'string' ? r.error : "Échec de l'enregistrement de l'activité");
      return;
    }
    const activityId = isEdit ? Number(id) : r.data?.id;
    if (activityId) await uploadAttachments(activityId);
    navigate('/crm');
  };

  return (
    <PageLayout
      title={isEdit ? "Modifier l'activité" : 'Nouvelle activité'}
      breadcrumbs={[{ label: 'Activités & CRM', to: '/crm' }, { label: isEdit ? 'Modifier' : 'Nouvelle' }]}
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

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-1">Pièces jointes</h3>
          <p className="text-xs text-slate-400 mb-4">
            Joignez des documents à cette activité (PDF, Word, Excel, images, audio, vidéo). Ils sont archivés dans la GED et rattachés à l'activité.
          </p>

          {existingAttachments.length > 0 && (
            <ul className="mb-4 space-y-1">
              {existingAttachments.map((doc: any) => (
                <li key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-slate-700">{doc.name}</span>
                    {doc.numeroArchive && <span className="shrink-0 text-xs font-mono text-slate-400">{doc.numeroArchive}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => window.electron.documents.open(token, doc.id)}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                  >
                    Ouvrir
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <Paperclip className="h-5 w-5 text-slate-400" />
            <p className="text-sm text-slate-600">Glissez-déposez des fichiers ou cliquez pour parcourir</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ATTACH_ACCEPT}
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {files.length > 0 && (
            <ul className="mt-3 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-slate-700">{f.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatFileSize(f.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                    aria-label="Retirer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
