import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
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
import {
  useClient, useCreateClient, useUpdateClient,
  useClientAssignableUsers, useClientReferrers,
} from '../hooks/useClients';
import { useCountries } from '../../../shared/hooks/useCountries';
import { useIdTypes } from '../../../shared/hooks/useIdTypes';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Save, Upload, X, FileText } from 'lucide-react';

/** Affectation client : AD est explicitement exclue (réduite au niveau AGENT sur ce module). */
const ASSIGN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']);

const schema = z.object({
  type: z.enum(['INDIVIDUEL', 'ENTREPRISE']),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  civilite: z.string().optional(),
  statutConjugal: z.string().optional(),
  entreprise: z.string().optional(),
  registre_de_commerce: z.string().optional(),
  compte_contribuable: z.string().optional(),
  email: z.string().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  nationality: z.string().optional(),
  idNumber: z.string().optional(),
  idTypeId: z.string().optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  fatherFirstName: z.string().optional(),
  fatherLastName: z.string().optional(),
  motherFirstName: z.string().optional(),
  motherLastName: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  // Champs d'affectation — convertis en number|null lors de la soumission.
  assignedToId: z.string().optional(),
  referrerId:   z.string().optional(),
}).superRefine((data, ctx) => {
  // Pour un client particulier, le type et le numéro de pièce d'identité
  // sont obligatoires (KYC).
  if (data.type === 'INDIVIDUEL') {
    if (!data.idTypeId || data.idTypeId.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idTypeId'], message: 'Type de pièce d’identité requis' });
    }
    if (!data.idNumber || data.idNumber.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idNumber'], message: 'Numéro de pièce d’identité requis' });
    }
  }
});

type FormData = z.infer<typeof schema>;

const CIVILITE_OPTIONS = [
  { value: 'MONSIEUR', label: 'Monsieur' },
  { value: 'MADAME', label: 'Madame' },
  { value: 'MADEMOISELLE', label: 'Mademoiselle' },
];

const STATUT_CONJUGAL_OPTIONS = [
  { value: 'CELIBATAIRE', label: 'Célibataire' },
  { value: 'MARIEE', label: 'Marié(e)' },
  { value: 'CONCUBINAGE', label: 'Concubinage' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIF', label: 'Actif' },
  { value: 'INACTIF', label: 'Inactif' },
  { value: 'VIP', label: 'VIP' },
  { value: 'SUSPENDU', label: 'Suspendu' },
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_MB = 10;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function ClientFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canAssign = ASSIGN_ROLES.has(role);

  const { data: res } = useClient(isEdit ? Number(id) : 0);
  const create = useCreateClient();
  const update = useUpdateClient();

  const { data: assignableUsersRes } = useClientAssignableUsers();
  const { data: referrersRes }       = useClientReferrers();
  const userOptions = [
    { value: '', label: '— Aucun —' },
    ...((assignableUsersRes?.data ?? []) as any[]).map((u) => ({
      value: String(u.id),
      label: `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() || u.email,
    })),
  ];
  const referrerOptions = [
    { value: '', label: '— Aucun —' },
    ...((referrersRes?.data ?? []) as any[]).map((r) => ({
      value: String(r.id),
      label: r.companyName
        ? `${r.lastName ?? ''} ${r.firstName ?? ''} (${r.companyName})`.trim()
        : `${r.lastName ?? ''} ${r.firstName ?? ''}`.trim(),
    })),
  ];

  const [type, setType] = useState<'INDIVIDUEL' | 'ENTREPRISE'>('INDIVIDUEL');
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [idDocError, setIdDocError] = useState<string | null>(null);
  const [existingIdDoc, setExistingIdDoc] = useState<{ name: string; size: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'INDIVIDUEL', country: 'CI', status: 'ACTIF',
      civilite: 'MONSIEUR', statutConjugal: 'CELIBATAIRE',
      assignedToId: '', referrerId: '',
    },
  });

  const { data: countriesRes } = useCountries();
  const countryOptions = (countriesRes?.data ?? []).map((c) => ({ value: c.isoCode, label: c.name }));

  const { data: idTypesRes } = useIdTypes();
  const idTypes = idTypesRes?.success ? (idTypesRes.data as any[]) ?? [] : [];
  const idTypeOptions = [
    { value: '', label: '— Aucun —' },
    ...idTypes.map((t) => ({ value: String(t.id), label: t.label })),
  ];

  const watchType = watch('type');
  useEffect(() => setType(watchType as any), [watchType]);

  // En mode création, pré-sélectionne le type de pièce marqué isDefault.
  useEffect(() => {
    if (isEdit) return;
    const def = idTypes.find((t) => t.isDefault);
    if (def) setValue('idTypeId', String(def.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTypes.length, isEdit]);

  useEffect(() => {
    if (isEdit && res?.data) {
      const c = res.data;
      // Zod `.string().optional()` rejette `null` — coercer chaque champ optionnel
      // venant de Prisma (`String?`) en chaîne vide pour éviter un échec silencieux
      // de validation qui bloquerait `handleSubmit` sans message d'erreur.
      reset({
        type:                 c.type ?? 'INDIVIDUEL',
        firstName:            c.firstName ?? '',
        lastName:             c.lastName ?? '',
        civilite:             c.civilite ?? 'MONSIEUR',
        statutConjugal:       c.statutConjugal ?? 'CELIBATAIRE',
        entreprise:           c.entreprise ?? '',
        registre_de_commerce: c.registre_de_commerce ?? '',
        compte_contribuable:  c.compte_contribuable ?? '',
        email:                c.email ?? '',
        phone:                c.phone ?? '',
        mobile:               c.mobile ?? '',
        address:              c.address ?? '',
        city:                 c.city ?? '',
        country:              c.country ?? 'CI',
        nationality:          c.nationality ?? '',
        idNumber:             c.idNumber ?? '',
        idTypeId:             c.idTypeId != null ? String(c.idTypeId) : '',
        // `<input type="date">` n'accepte que le format YYYY-MM-DD.
        birthDate:            c.birthDate ? new Date(c.birthDate).toISOString().slice(0, 10) : '',
        birthPlace:           c.birthPlace ?? '',
        fatherFirstName:      c.fatherFirstName ?? '',
        fatherLastName:       c.fatherLastName ?? '',
        motherFirstName:      c.motherFirstName ?? '',
        motherLastName:       c.motherLastName ?? '',
        notes:                c.notes ?? '',
        status:               c.status ?? 'ACTIF',
        assignedToId:         c.assignedToId != null ? String(c.assignedToId) : '',
        referrerId:           c.referrerId   != null ? String(c.referrerId)   : '',
      });
      setType(c.type);
      const idDoc = c.documents?.find((d: any) => d.category === 'identité');
      if (idDoc) setExistingIdDoc({ name: idDoc.name, size: idDoc.size });
    }
  }, [res, isEdit, reset]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setIdDocError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setIdDocError('Format non accepté. Utilisez JPG, PNG, WEBP ou PDF.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setIdDocError(`Fichier trop volumineux (max ${MAX_MB} Mo).`);
      return;
    }
    setIdDocFile(file);
  }

  function clearFile() {
    setIdDocFile(null);
    setIdDocError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadIdDocument(clientId: number) {
    if (!idDocFile) return;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(idDocFile);
    });
    await (window.electron as any).documents.uploadIdDocument(token, clientId, {
      fileName: idDocFile.name,
      fileType: idDocFile.type,
      fileSize: idDocFile.size,
      fileData: base64,
    });
  }

  const onSubmit = async (data: FormData) => {
    // Convertit les sélecteurs d'affectation (chaînes) en number|null|undefined.
    // Si l'utilisateur n'a pas le droit d'affecter, on retire ces champs du payload.
    const { assignedToId, referrerId, idTypeId, ...rest } = data;
    const payload: any = { ...rest };
    // Convertit YYYY-MM-DD en ISO datetime attendu par le schéma Zod du back-end.
    if (payload.birthDate) {
      payload.birthDate = new Date(`${payload.birthDate}T00:00:00.000Z`).toISOString();
    } else {
      delete payload.birthDate;
    }
    payload.idTypeId = idTypeId ? Number(idTypeId) : null;
    if (canAssign) {
      payload.assignedToId = assignedToId ? Number(assignedToId) : null;
      payload.referrerId   = referrerId   ? Number(referrerId)   : null;
    }
    let r: any;
    if (isEdit) {
      r = await update.mutateAsync({ id: Number(id), payload });
      if (r.success && idDocFile) await uploadIdDocument(Number(id));
    } else {
      r = await create.mutateAsync(payload);
      if (r.success && idDocFile) await uploadIdDocument(r.data.id);
    }
    if (r.success) navigate('/clients');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le client' : 'Nouveau client'}
      breadcrumbs={[{ label: 'Clients', to: '/clients' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Select label="Type de client" options={[{ value: 'INDIVIDUEL', label: 'Particulier' }, { value: 'ENTREPRISE', label: 'Entreprise' }]} {...register('type')} />

          {type === 'INDIVIDUEL' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Civilité" options={CIVILITE_OPTIONS} {...register('civilite')} />
                <Select label="Statut conjugal" options={STATUT_CONJUGAL_OPTIONS} {...register('statutConjugal')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nom" {...register('lastName')} />
                <Input label="Prénom" {...register('firstName')} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Select label="Type de pièce d'identité" required options={idTypeOptions} error={errors.idTypeId?.message} {...register('idTypeId')} />
                <Input label="Numéro pièce d'identité" required error={errors.idNumber?.message} {...register('idNumber')} />
                <Input label="Nationalité" {...register('nationality')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Date de naissance" type="date" {...register('birthDate')} />
                <Input label="Lieu de naissance" {...register('birthPlace')} />
              </div>

              {/* Pièce d'identité scannée */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Pièce d'identité scannée
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {idDocFile ? (
                  <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                    <FileText className="h-5 w-5 flex-shrink-0 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{idDocFile.name}</p>
                      <p className="text-xs text-slate-500">{formatBytes(idDocFile.size)}</p>
                    </div>
                    <button type="button" onClick={clearFile} className="text-slate-400 hover:text-red-500 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : existingIdDoc ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                      <FileText className="h-5 w-5 flex-shrink-0 text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{existingIdDoc.name}</p>
                        <p className="text-xs text-slate-400">{formatBytes(existingIdDoc.size)} — document actuel</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<Upload className="h-4 w-4" />}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Remplacer le document
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-slate-200 px-6 py-8 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                  >
                    <Upload className="mx-auto h-8 w-8 text-slate-300 group-hover:text-blue-400 mb-2" />
                    <p className="text-sm text-slate-500 group-hover:text-blue-600">
                      Cliquez pour sélectionner un fichier
                    </p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP ou PDF — max {MAX_MB} Mo</p>
                  </button>
                )}
                {idDocError && <p className="mt-2 text-xs text-red-600">{idDocError}</p>}
              </div>

              {/* Filiation */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Filiation</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nom du père" {...register('fatherLastName')} />
                  <Input label="Prénom du père" {...register('fatherFirstName')} />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Input label="Nom de la mère" {...register('motherLastName')} />
                  <Input label="Prénom de la mère" {...register('motherFirstName')} />
                </div>
              </div>
            </>
          ) : (
            <>
              <Input label="Nom de l'entreprise" required {...register('entreprise')} />
              <Input label="Registre de commerce" {...register('registre_de_commerce')} />
              <Input label="Compte contribuable" {...register('compte_contribuable')} />
            </>
          )}

          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Téléphone 1" {...register('phone')} />
            <Input label="Téléphone 2" {...register('mobile')} />
          </div>
          <Input label="Adresse" {...register('address')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ville" {...register('city')} />
            <FormSearchSelect control={control} name="country" label="Pays" options={countryOptions} />
          </div>
          <Textarea label="Notes" rows={3} {...register('notes')} />
          <Select label="Statut" options={STATUS_OPTIONS} {...register('status')} />

          {canAssign && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Affectation
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FormSearchSelect
                  control={control}
                  name="assignedToId"
                  label="Utilisateur référent"
                  options={userOptions}
                />
                <FormSearchSelect
                  control={control}
                  name="referrerId"
                  label="Apporteur d'affaire"
                  options={referrerOptions}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/clients')}>Annuler</Button>
            <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
