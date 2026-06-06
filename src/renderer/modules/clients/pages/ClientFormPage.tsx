import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { upperField } from '../../../shared/utils/uppercase';
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
  // Entreprise — représentant légal
  legalRepFirstName: z.string().optional(),
  legalRepLastName: z.string().optional(),
  legalRepPhone: z.string().optional(),
  legalRepIdNumber: z.string().optional(),
  legalRepIdTypeId: z.string().optional(),
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
  // Pour un client entreprise, la pièce d'identité du représentant légal est
  // obligatoire (alignement sur le module Propriétaires).
  if (data.type === 'ENTREPRISE') {
    if (!data.legalRepIdTypeId || data.legalRepIdTypeId.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['legalRepIdTypeId'], message: 'Type de pièce d’identité du représentant requis' });
    }
    if (!data.legalRepIdNumber || data.legalRepIdNumber.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['legalRepIdNumber'], message: 'Numéro de pièce d’identité du représentant requis' });
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

interface DocUploadFieldProps {
  label: string;
  existingName?: string | null;
  file: File | null;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

/** Champ de dépôt de fichier réutilisable (pièces jointes du représentant légal). */
function DocUploadField({ label, existingName, file, error, inputRef, onChange, onClear }: DocUploadFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {file ? (
        <div className="flex items-center gap-2 p-3 border border-blue-200 rounded-lg bg-blue-50">
          <FileText className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-sm text-blue-800 flex-1 truncate">{file.name} ({formatBytes(file.size)})</span>
          <button type="button" onClick={onClear} className="text-blue-400 hover:text-blue-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : existingName ? (
        <div className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50">
          <FileText className="h-4 w-4 text-slate-500 shrink-0" />
          <span className="text-sm text-slate-700 flex-1 truncate">{existingName}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-blue-600 hover:underline"
          >Remplacer</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <Upload className="h-4 w-4" />
          <span className="text-sm">Joindre (JPG, PNG, PDF — max {MAX_MB} Mo)</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={onChange}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
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

  // Pièce d'identité du représentant légal (entreprise)
  const [repIdDocFile, setRepIdDocFile] = useState<File | null>(null);
  const [repIdDocError, setRepIdDocError] = useState<string | null>(null);
  const [existingRepIdDoc, setExistingRepIdDoc] = useState<string | null>(null);
  const repIdDocRef = useRef<HTMLInputElement>(null);

  // Registre de commerce scanné (entreprise)
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [rcError, setRcError] = useState<string | null>(null);
  const [existingRc, setExistingRc] = useState<string | null>(null);
  const rcRef = useRef<HTMLInputElement>(null);

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
    if (def) {
      setValue('idTypeId', String(def.id));
      setValue('legalRepIdTypeId', String(def.id));
    }
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
        legalRepFirstName:    c.legalRepFirstName ?? '',
        legalRepLastName:     c.legalRepLastName ?? '',
        legalRepPhone:        c.legalRepPhone ?? '',
        legalRepIdNumber:     c.legalRepIdNumber ?? '',
        legalRepIdTypeId:     c.legalRepIdTypeId != null ? String(c.legalRepIdTypeId) : '',
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
      const docs: any[] = c.documents ?? [];
      const idDoc = docs.find((d) => d.category === 'identité');
      if (idDoc) setExistingIdDoc({ name: idDoc.name, size: idDoc.size });
      setExistingRepIdDoc(docs.find((d) => d.category === 'piece_identite_rep_legal')?.name ?? null);
      setExistingRc(docs.find((d) => d.category === 'registre_commerce')?.name ?? null);
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

  function makeFileHandler(
    setFile: (f: File | null) => void,
    setError: (e: string | null) => void,
    ref: React.RefObject<HTMLInputElement | null>
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      if (!file) return;
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Format non accepté. Utilisez JPG, PNG, WEBP ou PDF.');
        if (ref.current) ref.current.value = '';
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`Fichier trop volumineux (max ${MAX_MB} Mo).`);
        if (ref.current) ref.current.value = '';
        return;
      }
      setFile(file);
    };
  }

  function makeClearHandler(
    setFile: (f: File | null) => void,
    setError: (e: string | null) => void,
    ref: React.RefObject<HTMLInputElement | null>
  ) {
    return () => {
      setFile(null);
      setError(null);
      if (ref.current) ref.current.value = '';
    };
  }

  /** Upload d'un document client catégorisé (représentant légal, RC scanné…). */
  async function uploadClientDoc(clientId: number, file: File | null, category: string) {
    if (!file) return;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await (window.electron as any).documents.uploadClientDoc(token, clientId, category, {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData: base64,
    });
  }

  const onSubmit = async (data: FormData) => {
    // Convertit les sélecteurs d'affectation (chaînes) en number|null|undefined.
    // Si l'utilisateur n'a pas le droit d'affecter, on retire ces champs du payload.
    const { assignedToId, referrerId, idTypeId, legalRepIdTypeId, ...rest } = data;
    const payload: any = { ...rest };
    // Convertit YYYY-MM-DD en ISO datetime attendu par le schéma Zod du back-end.
    if (payload.birthDate) {
      payload.birthDate = new Date(`${payload.birthDate}T00:00:00.000Z`).toISOString();
    } else {
      delete payload.birthDate;
    }
    payload.idTypeId = idTypeId ? Number(idTypeId) : null;
    payload.legalRepIdTypeId = legalRepIdTypeId ? Number(legalRepIdTypeId) : null;
    if (canAssign) {
      payload.assignedToId = assignedToId ? Number(assignedToId) : null;
      payload.referrerId   = referrerId   ? Number(referrerId)   : null;
    }
    let r: any;
    if (isEdit) {
      r = await update.mutateAsync({ id: Number(id), payload });
      if (r.success) {
        const cid = Number(id);
        if (idDocFile) await uploadIdDocument(cid);
        await Promise.all([
          uploadClientDoc(cid, repIdDocFile, 'piece_identite_rep_legal'),
          uploadClientDoc(cid, rcFile, 'registre_commerce'),
        ]);
      }
    } else {
      r = await create.mutateAsync(payload);
      if (r.success) {
        const cid = r.data.id;
        if (idDocFile) await uploadIdDocument(cid);
        await Promise.all([
          uploadClientDoc(cid, repIdDocFile, 'piece_identite_rep_legal'),
          uploadClientDoc(cid, rcFile, 'registre_commerce'),
        ]);
      }
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
                <Input label="Nom" {...upperField(register('lastName'))} />
                <Input label="Prénom" {...upperField(register('firstName'))} />
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
                  <Input label="Nom du père" {...upperField(register('fatherLastName'))} />
                  <Input label="Prénom du père" {...upperField(register('fatherFirstName'))} />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Input label="Nom de la mère" {...upperField(register('motherLastName'))} />
                  <Input label="Prénom de la mère" {...upperField(register('motherFirstName'))} />
                </div>
              </div>
            </>
          ) : (
            <>
              <Input label="Nom de l'entreprise" required {...upperField(register('entreprise'))} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Numéro registre de commerce" {...register('registre_de_commerce')} />
                <DocUploadField
                  label="Registre de commerce scanné"
                  existingName={existingRc}
                  file={rcFile}
                  error={rcError}
                  inputRef={rcRef}
                  onChange={makeFileHandler(setRcFile, setRcError, rcRef)}
                  onClear={makeClearHandler(setRcFile, setRcError, rcRef)}
                />
              </div>
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

          {/* Représentant légal — uniquement pour un client entreprise */}
          {type === 'ENTREPRISE' && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Représentant légal</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nom" {...upperField(register('legalRepLastName'))} />
                  <Input label="Prénom" {...upperField(register('legalRepFirstName'))} />
                </div>
                <Input label="Contact (téléphone/email)" {...register('legalRepPhone')} />
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Type de pièce d'identité" required options={idTypeOptions} error={errors.legalRepIdTypeId?.message} {...register('legalRepIdTypeId')} />
                  <Input label="Numéro pièce d'identité" required placeholder="CI/Passeport/…" error={errors.legalRepIdNumber?.message} {...register('legalRepIdNumber')} />
                </div>
                <DocUploadField
                  label="Pièce d'identité du représentant légal"
                  existingName={existingRepIdDoc}
                  file={repIdDocFile}
                  error={repIdDocError}
                  inputRef={repIdDocRef}
                  onChange={makeFileHandler(setRepIdDocFile, setRepIdDocError, repIdDocRef)}
                  onClear={makeClearHandler(setRepIdDocFile, setRepIdDocError, repIdDocRef)}
                />
              </div>
            </div>
          )}

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
