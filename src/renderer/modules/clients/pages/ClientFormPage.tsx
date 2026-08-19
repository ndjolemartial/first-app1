import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { clsx } from 'clsx';
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
import { PEP_CATEGORY_LABEL } from '../../aml/utils/aml.utils';
import { SOURCE_OF_FUNDS_OPTIONS, RELATIONSHIP_PURPOSE_OPTIONS } from '../utils/kycDocument';
import {
  Save, Upload, X, FileText, User, Building2, Users, MapPin,
  UserCog, ShieldCheck, ClipboardList, UserPlus,
} from 'lucide-react';

/** Affectation client : AD est explicitement exclue (réduite au niveau AGENT sur ce module). */
const ASSIGN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']);

const schema = z.object({
  type: z.enum(['INDIVIDUEL', 'ENTREPRISE', 'ASSOCIATION_ONG']),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  civilite: z.string().optional(),
  statutConjugal: z.string().optional(),
  entreprise: z.string().optional(),
  registre_de_commerce: z.string().optional(),
  compte_contribuable: z.string().optional(),
  website: z.string().optional(),
  companyActivity: z.string().optional(),
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
  commune: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  nationality: z.string().optional(),
  profession: z.string().optional(),
  idNumber: z.string().optional(),
  idTypeId: z.string().optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  fatherFirstName: z.string().optional(),
  fatherLastName: z.string().optional(),
  motherFirstName: z.string().optional(),
  motherLastName: z.string().optional(),
  // Informations complémentaires — alimentent la « Fiche KYC » imprimable
  // depuis la fiche client.
  employerName: z.string().optional(),
  monthlyIncome: z.string().optional(),
  sourceOfFunds: z.array(z.string()).optional(),
  sourceOfFundsOther: z.string().optional(),
  sourceOfWealth: z.string().optional(),
  relationshipPurpose: z.array(z.string()).optional(),
  relationshipPurposeOther: z.string().optional(),
  expectedTransactionVolume: z.string().optional(),
  acquisitionChannel: z.string().optional(),
  isPep: z.boolean().optional(),
  pepCategory: z.string().optional(),
  pepFunction: z.string().optional(),
  hasRiskyCountryLink: z.boolean().optional(),
  kycSignedAt: z.string().optional(),
  kycSignedPlace: z.string().optional(),
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
  // Pour un client personne morale (entreprise ou association/ONG), la pièce
  // d'identité du représentant légal est obligatoire (alignement sur le
  // module Propriétaires).
  if (data.type !== 'INDIVIDUEL') {
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
  { value: 'Monsieur', label: 'Monsieur' },
  { value: 'Madame', label: 'Madame' },
  { value: 'Mademoiselle', label: 'Mademoiselle' },
];

const STATUT_CONJUGAL_OPTIONS = [
  { value: 'CELIBATAIRE', label: 'Célibataire' },
  { value: 'MARIEE', label: 'Marié(e)' },
  { value: 'CONCUBINAGE', label: 'Concubinage' },
  { value: 'DIVORCE', label: 'Divorcé(e)' },
  { value: 'VEUF', label: 'Veuf/Veuve' },
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

interface FormSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  /** `accent` distingue visuellement un bloc particulier (ex. Fiche KYC) des autres sections, neutres. */
  tone?: 'neutral' | 'accent';
  children: React.ReactNode;
}

/** Panneau de section réutilisable pour structurer visuellement le formulaire client. */
function FormSection({ title, description, icon, tone = 'neutral', children }: FormSectionProps) {
  const isAccent = tone === 'accent';
  return (
    <div className={clsx(
      'rounded-xl border p-4',
      isAccent ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-slate-50/60'
    )}>
      <div className="flex items-center gap-2">
        <span className={isAccent ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
        <h3 className={clsx('text-sm font-semibold', isAccent ? 'text-indigo-900' : 'text-slate-700')}>{title}</h3>
      </div>
      {description && <p className={clsx('text-xs mt-0.5 mb-3', isAccent ? 'text-indigo-700/80' : 'text-slate-400')}>{description}</p>}
      <div className={clsx(description ? '' : 'mt-3', 'space-y-4')}>{children}</div>
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

  const [type, setType] = useState<'INDIVIDUEL' | 'ENTREPRISE' | 'ASSOCIATION_ONG'>('INDIVIDUEL');
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

  // Justificatif(s) d'origine des fonds — plusieurs fichiers possibles,
  // s'ajoutant aux justificatifs déjà déposés (contrairement aux uploaders
  // ci-dessus, à document unique remplacé à chaque envoi).
  const [fundsProofFiles, setFundsProofFiles] = useState<File[]>([]);
  const [fundsProofError, setFundsProofError] = useState<string | null>(null);
  const [existingFundsProofs, setExistingFundsProofs] = useState<{ id: number; name: string; size: number }[]>([]);
  const fundsProofRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'INDIVIDUEL', country: 'CI', status: 'ACTIF',
      civilite: 'Monsieur', statutConjugal: 'CELIBATAIRE',
      sourceOfFunds: [],
      relationshipPurpose: [],
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
  const watchIsPep = watch('isPep');
  const watchSourceOfFunds = watch('sourceOfFunds') ?? [];
  const toggleSourceOfFunds = (value: string) => {
    setValue('sourceOfFunds', watchSourceOfFunds.includes(value)
      ? watchSourceOfFunds.filter((v) => v !== value)
      : [...watchSourceOfFunds, value]);
  };
  const watchRelationshipPurpose = watch('relationshipPurpose') ?? [];
  const toggleRelationshipPurpose = (value: string) => {
    setValue('relationshipPurpose', watchRelationshipPurpose.includes(value)
      ? watchRelationshipPurpose.filter((v) => v !== value)
      : [...watchRelationshipPurpose, value]);
  };

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
        civilite:             c.civilite ?? 'Monsieur',
        statutConjugal:       c.statutConjugal ?? 'CELIBATAIRE',
        entreprise:           c.entreprise ?? '',
        registre_de_commerce: c.registre_de_commerce ?? '',
        compte_contribuable:  c.compte_contribuable ?? '',
        website:              c.website ?? '',
        companyActivity:      c.companyActivity ?? '',
        legalRepFirstName:    c.legalRepFirstName ?? '',
        legalRepLastName:     c.legalRepLastName ?? '',
        legalRepPhone:        c.legalRepPhone ?? '',
        legalRepIdNumber:     c.legalRepIdNumber ?? '',
        legalRepIdTypeId:     c.legalRepIdTypeId != null ? String(c.legalRepIdTypeId) : '',
        email:                c.email ?? '',
        phone:                c.phone ?? '',
        mobile:               c.mobile ?? '',
        address:              c.address ?? '',
        commune:              c.commune ?? '',
        city:                 c.city ?? '',
        country:              c.country ?? 'CI',
        nationality:          c.nationality ?? '',
        profession:           c.profession ?? '',
        idNumber:             c.idNumber ?? '',
        idTypeId:             c.idTypeId != null ? String(c.idTypeId) : '',
        // `<input type="date">` n'accepte que le format YYYY-MM-DD.
        birthDate:            c.birthDate ? new Date(c.birthDate).toISOString().slice(0, 10) : '',
        birthPlace:           c.birthPlace ?? '',
        fatherFirstName:      c.fatherFirstName ?? '',
        fatherLastName:       c.fatherLastName ?? '',
        motherFirstName:      c.motherFirstName ?? '',
        motherLastName:       c.motherLastName ?? '',
        employerName:              c.employerName ?? '',
        monthlyIncome:             c.monthlyIncome != null ? String(c.monthlyIncome) : '',
        sourceOfFunds:             Array.isArray(c.sourceOfFunds) ? c.sourceOfFunds : [],
        sourceOfFundsOther:        c.sourceOfFundsOther ?? '',
        sourceOfWealth:            c.sourceOfWealth ?? '',
        relationshipPurpose:       Array.isArray(c.relationshipPurpose) ? c.relationshipPurpose : [],
        relationshipPurposeOther:  c.relationshipPurposeOther ?? '',
        expectedTransactionVolume: c.expectedTransactionVolume != null ? String(c.expectedTransactionVolume) : '',
        acquisitionChannel:        c.acquisitionChannel ?? '',
        isPep:                     c.isPep ?? false,
        pepCategory:               c.pepCategory ?? '',
        pepFunction:               c.pepFunction ?? '',
        hasRiskyCountryLink:       c.hasRiskyCountryLink ?? false,
        kycSignedAt:               c.kycSignedAt ? new Date(c.kycSignedAt).toISOString().slice(0, 10) : '',
        kycSignedPlace:            c.kycSignedPlace ?? '',
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
      setExistingFundsProofs(
        docs.filter((d) => d.category === 'justificatif_origine_fonds')
          .map((d) => ({ id: d.id, name: d.name, size: d.size }))
      );
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

  function handleFundsProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFundsProofError(null);
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const invalid = files.find((f) => !ACCEPTED_TYPES.includes(f.type));
    if (invalid) {
      setFundsProofError('Format non accepté. Utilisez JPG, PNG, WEBP ou PDF.');
    } else {
      const tooBig = files.find((f) => f.size > MAX_MB * 1024 * 1024);
      if (tooBig) setFundsProofError(`Fichier trop volumineux (max ${MAX_MB} Mo) : ${tooBig.name}`);
      else setFundsProofFiles((prev) => [...prev, ...files]);
    }
    if (fundsProofRef.current) fundsProofRef.current.value = '';
  }

  function removeFundsProofFile(index: number) {
    setFundsProofFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /** Upload additif de plusieurs justificatifs d'origine des fonds (ne remplace jamais les précédents). */
  async function uploadFundsProofs(clientId: number) {
    if (!fundsProofFiles.length) return;
    const files = await Promise.all(fundsProofFiles.map((file) => new Promise<any>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        fileName: file.name, fileType: file.type, fileSize: file.size,
        fileData: (reader.result as string).split(',')[1],
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    await (window.electron as any).documents.uploadClientDocs(token, clientId, 'justificatif_origine_fonds', files);
    setFundsProofFiles([]);
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
    if (payload.kycSignedAt) {
      payload.kycSignedAt = new Date(`${payload.kycSignedAt}T00:00:00.000Z`).toISOString();
    } else {
      delete payload.kycSignedAt;
    }
    if (!payload.isPep) payload.pepCategory = null;
    if (!payload.sourceOfFunds?.includes('AUTRE')) payload.sourceOfFundsOther = null;
    if (!payload.relationshipPurpose?.includes('AUTRE')) payload.relationshipPurposeOther = null;
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
          uploadFundsProofs(cid),
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
          uploadFundsProofs(cid),
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
      <Card className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Select label="Type de client" options={[
            { value: 'INDIVIDUEL', label: 'Personne physique' },
            { value: 'ENTREPRISE', label: 'Personne morale' },
            { value: 'ASSOCIATION_ONG', label: 'Association / ONG' },
          ]} {...register('type')} />

          {type === 'INDIVIDUEL' ? (
            <>
              <FormSection title="Identité" icon={<User className="h-4 w-4" />}>
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
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Date de naissance" type="date" {...register('birthDate')} />
                  <Input label="Lieu de naissance" {...register('birthPlace')} />
                  <Input label="Profession" {...register('profession')} />
                </div>
              </FormSection>

              {/* Pièce d'identité scannée */}
              <FormSection title="Pièce d'identité scannée" icon={<Upload className="h-4 w-4" />}>
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
              </FormSection>

              {/* Filiation */}
              <FormSection title="Filiation" icon={<Users className="h-4 w-4" />}>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nom du père" {...upperField(register('fatherLastName'))} />
                  <Input label="Prénom du père" {...upperField(register('fatherFirstName'))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nom de la mère" {...upperField(register('motherLastName'))} />
                  <Input label="Prénom de la mère" {...upperField(register('motherFirstName'))} />
                </div>
              </FormSection>
            </>
          ) : (
            <FormSection title={type === 'ASSOCIATION_ONG' ? 'Association / ONG' : 'Entreprise'} icon={<Building2 className="h-4 w-4" />}>
              <Input label={type === 'ASSOCIATION_ONG' ? "Nom de l'association / ONG" : "Nom de l'entreprise"} required {...upperField(register('entreprise'))} />
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
              <div className="grid grid-cols-2 gap-4">
                <Input label="Compte contribuable" {...register('compte_contribuable')} />
                <Input label="Site web" placeholder="https://…" {...register('website')} />
              </div>
              <Textarea label="Activités de l'entreprise" rows={2} {...register('companyActivity')} />
            </FormSection>
          )}

          <FormSection title="Coordonnées" icon={<MapPin className="h-4 w-4" />}>
            <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Téléphone 1" {...register('phone')} />
              <Input label="Téléphone 2" {...register('mobile')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Adresse" {...register('address')} />
              <Input label="Commune" {...register('commune')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Ville" {...register('city')} />
              <FormSearchSelect control={control} name="country" label="Pays" options={countryOptions} />
            </div>
          </FormSection>

          {/* Représentant légal — pour un client personne morale (entreprise ou association/ONG) */}
          {type !== 'INDIVIDUEL' && (
            <FormSection title="Représentant légal" icon={<UserCog className="h-4 w-4" />}>
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
            </FormSection>
          )}

          {/* Informations complémentaires — alimentent la Fiche KYC imprimable
              depuis la fiche client (bouton dédié sur ClientDetailPage). Bloc
              volontairement distinct (accent indigo) des autres sections,
              neutres, pour bien le démarquer comme relevant de la conformité. */}
          <FormSection
            tone="accent"
            title="Informations complémentaires"
            description="Alimentent la Fiche KYC imprimable depuis la fiche client (bouton dédié)."
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <div className="grid grid-cols-2 gap-4">
              <Input label="Employeur / activité professionnelle" {...register('employerName')} />
              <Input label="Revenu mensuel déclaré (FCFA)" type="number" {...register('monthlyIncome')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Origine des fonds</label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-indigo-100 bg-white p-3">
                {SOURCE_OF_FUNDS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300"
                      checked={watchSourceOfFunds.includes(opt.value)}
                      onChange={() => toggleSourceOfFunds(opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
              {watchSourceOfFunds.includes('AUTRE') && (
                <div className="mt-2">
                  <Input label="Précisez" {...register('sourceOfFundsOther')} />
                </div>
              )}
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Justificatif(s) d'origine des fonds</label>
                {existingFundsProofs.length > 0 && (
                  <ul className="mb-2 space-y-1.5">
                    {existingFundsProofs.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="flex-1 truncate text-sm text-slate-700">{doc.name}</span>
                        <span className="text-xs text-slate-400">{formatBytes(doc.size)}</span>
                        <button type="button" className="text-xs text-blue-600 hover:underline"
                          onClick={() => window.electron.documents.open(token, doc.id)}>Ouvrir</button>
                      </li>
                    ))}
                  </ul>
                )}
                {fundsProofFiles.length > 0 && (
                  <ul className="mb-2 space-y-1.5">
                    {fundsProofFiles.map((file, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                        <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                        <span className="flex-1 truncate text-sm text-blue-800">{file.name}</span>
                        <span className="text-xs text-blue-600">{formatBytes(file.size)}</span>
                        <button type="button" onClick={() => removeFundsProofFile(i)} className="text-blue-400 hover:text-red-500 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  ref={fundsProofRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={handleFundsProofChange}
                />
                <button
                  type="button"
                  onClick={() => fundsProofRef.current?.click()}
                  className="w-full flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">Scanner / joindre un ou plusieurs justificatifs (JPG, PNG, PDF — max {MAX_MB} Mo chacun)</span>
                </button>
                {fundsProofError && <p className="mt-1 text-xs text-red-600">{fundsProofError}</p>}
              </div>
            </div>
            <Textarea label="Origine du patrimoine" rows={2} {...register('sourceOfWealth')} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Objet de la relation d'affaires</label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-indigo-100 bg-white p-3">
                {RELATIONSHIP_PURPOSE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300"
                      checked={watchRelationshipPurpose.includes(opt.value)}
                      onChange={() => toggleRelationshipPurpose(opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
              {watchRelationshipPurpose.includes('AUTRE') && (
                <div className="mt-2">
                  <Input label="Précisez" {...register('relationshipPurposeOther')} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Volume mensuel estimé des opérations (FCFA)" type="number" {...register('expectedTransactionVolume')} />
              <Input label="Canal d'entrée en relation" {...register('acquisitionChannel')} />
            </div>
            <div className="flex items-center gap-2">
              <input id="isPep" type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('isPep')} />
              <label htmlFor="isPep" className="text-sm font-medium text-slate-700">Personne politiquement exposée (PPE)</label>
            </div>
            {watchIsPep && (
              <div className="grid grid-cols-2 gap-4">
                <Select label="Catégorie PPE" placeholder="Non précisée"
                  options={Object.entries(PEP_CATEGORY_LABEL).map(([v, l]) => ({ value: v, label: l }))}
                  {...register('pepCategory')} />
                <Input label="Fonction exercée" {...register('pepFunction')} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input id="hasRiskyCountryLink" type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('hasRiskyCountryLink')} />
              <label htmlFor="hasRiskyCountryLink" className="text-sm font-medium text-slate-700">Lien avec un pays à risque</label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Lieu de signature de la fiche KYC" {...register('kycSignedPlace')} />
              <Input label="Date de signature de la fiche KYC" type="date" {...register('kycSignedAt')} />
            </div>
          </FormSection>

          <FormSection title="Notes & statut" icon={<ClipboardList className="h-4 w-4" />}>
            <Textarea label="Notes" rows={3} {...register('notes')} />
            <Select label="Statut" options={STATUS_OPTIONS} {...register('status')} />
          </FormSection>

          {canAssign && (
            <FormSection title="Affectation" icon={<UserPlus className="h-4 w-4" />}>
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
            </FormSection>
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
