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
import { useOwner, useCreateOwner, useUpdateOwner } from '../hooks/useOwners';
import { useCountries } from '../../../shared/hooks/useCountries';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Save, Upload, X, FileText } from 'lucide-react';

const schema = z.object({
  type: z.enum(['INDIVIDUEL', 'ENTREPRISE']),
  // Particulier
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  idNumber: z.string().optional(),
  // Entreprise
  companyName: z.string().optional(),
  registreCommerce: z.string().optional(),
  legalRepFirstName: z.string().optional(),
  legalRepLastName: z.string().optional(),
  legalRepPhone: z.string().optional(),
  legalRepIdNumber: z.string().optional(),
  // Commun
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  compte_contribuable: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_MB = 10;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
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

export default function OwnerFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;

  const { data: res } = useOwner(isEdit ? Number(id) : 0);
  const create = useCreateOwner();
  const update = useUpdateOwner();

  const [type, setType] = useState<'INDIVIDUEL' | 'ENTREPRISE'>('INDIVIDUEL');

  // Pièce d'identité propriétaire (particulier)
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [idDocError, setIdDocError] = useState<string | null>(null);
  const [existingIdDoc, setExistingIdDoc] = useState<string | null>(null);
  const idDocRef = useRef<HTMLInputElement>(null);

  // Pièce d'identité représentant légal (entreprise)
  const [repIdDocFile, setRepIdDocFile] = useState<File | null>(null);
  const [repIdDocError, setRepIdDocError] = useState<string | null>(null);
  const [existingRepIdDoc, setExistingRepIdDoc] = useState<string | null>(null);
  const repIdDocRef = useRef<HTMLInputElement>(null);

  // Registre de commerce (entreprise)
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [rcError, setRcError] = useState<string | null>(null);
  const [existingRc, setExistingRc] = useState<string | null>(null);
  const rcRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'INDIVIDUEL', country: 'CI' },
  });

  const { data: countriesRes } = useCountries();
  const countryOptions = (countriesRes?.data ?? []).map((c) => ({ value: c.isoCode, label: c.name }));

  const watchType = watch('type');
  useEffect(() => setType(watchType as any), [watchType]);

  useEffect(() => {
    if (isEdit && res?.data) {
      const o = res.data;
      reset({ ...o });
      setType(o.type);
      const docs: any[] = o.documents ?? [];
      setExistingIdDoc(docs.find((d: any) => d.category === 'piece_identite')?.name ?? null);
      setExistingRepIdDoc(docs.find((d: any) => d.category === 'piece_identite_rep_legal')?.name ?? null);
      setExistingRc(docs.find((d: any) => d.category === 'registre_commerce')?.name ?? null);
    }
  }, [res, isEdit, reset]);

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

  async function uploadDoc(ownerId: number, file: File | null, category: string) {
    if (!file) return;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await (window.electron as any).documents.uploadOwnerDoc(token, ownerId, category, {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData: base64,
    });
  }

  const onSubmit = async (data: FormData) => {
    let r: any;
    if (isEdit) {
      r = await update.mutateAsync({ id: Number(id), payload: data });
      if (r.success) {
        const oid = Number(id);
        await Promise.all([
          uploadDoc(oid, idDocFile, 'piece_identite'),
          uploadDoc(oid, repIdDocFile, 'piece_identite_rep_legal'),
          uploadDoc(oid, rcFile, 'registre_commerce'),
        ]);
      }
    } else {
      r = await create.mutateAsync(data);
      if (r.success) {
        const oid = r.data.id;
        await Promise.all([
          uploadDoc(oid, idDocFile, 'piece_identite'),
          uploadDoc(oid, repIdDocFile, 'piece_identite_rep_legal'),
          uploadDoc(oid, rcFile, 'registre_commerce'),
        ]);
      }
    }
    if (r.success) navigate('/owners');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le propriétaire' : 'Nouveau propriétaire'}
      breadcrumbs={[{ label: 'Propriétaires', to: '/owners' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Type */}
            <Select
              label="Type de propriétaire"
              options={[{ value: 'INDIVIDUEL', label: 'Particulier' }, { value: 'ENTREPRISE', label: 'Entreprise' }]}
              {...register('type')}
            />

            {/* ── Particulier ── */}
            {type === 'INDIVIDUEL' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nom" {...register('lastName')} />
                  <Input label="Prénom" {...register('firstName')} />
                </div>
                <Input label="Numéro pièce d'identité" placeholder="CI/Passeport/…" {...register('idNumber')} />
                <DocUploadField
                  label="Pièce d'identité scannée"
                  existingName={existingIdDoc}
                  file={idDocFile}
                  error={idDocError}
                  inputRef={idDocRef}
                  onChange={makeFileHandler(setIdDocFile, setIdDocError, idDocRef)}
                  onClear={makeClearHandler(setIdDocFile, setIdDocError, idDocRef)}
                />
              </div>
            )}

            {/* ── Entreprise ── */}
            {type === 'ENTREPRISE' && (
              <div className="space-y-4">
                <Input label="Nom de la société" required {...register('companyName')} />
                <Input label="Numéro registre de commerce" placeholder="RC-xxxx" {...register('registreCommerce')} />

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Représentant légal</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Nom" {...register('legalRepLastName')} />
                      <Input label="Prénom" {...register('legalRepFirstName')} />
                    </div>
                    <Input label="Contact (téléphone/email)" {...register('legalRepPhone')} />
                    <Input label="Numéro pièce d'identité" placeholder="CI/Passeport/…" {...register('legalRepIdNumber')} />
                    <DocUploadField
                      label="Pièce d'identité du représentant légal"
                      existingName={existingRepIdDoc}
                      file={repIdDocFile}
                      error={repIdDocError}
                      inputRef={repIdDocRef}
                      onChange={makeFileHandler(setRepIdDocFile, setRepIdDocError, repIdDocRef)}
                      onClear={makeClearHandler(setRepIdDocFile, setRepIdDocError, repIdDocRef)}
                    />
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
                </div>
              </div>
            )}

            {/* ── Coordonnées ── */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Coordonnées</h3>
              <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Téléphone" {...register('phone')} />
                <Input label="Mobile" {...register('mobile')} />
              </div>
              <Input label="Adresse" {...register('address')} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Ville" {...register('city')} />
                <FormSearchSelect control={control} name="country" label="Pays" options={countryOptions} />
              </div>
            </div>

            {/* ── Bancaire & Fiscal ── */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Informations bancaires & fiscales</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="IBAN" placeholder="CI xx xxxx" {...register('bankIban')} />
                <Input label="BIC / SWIFT" {...register('bankBic')} />
              </div>
              <Input label="Compte contribuable" {...register('compte_contribuable')} />
            </div>

            <Textarea label="Notes" rows={3} {...register('notes')} />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => navigate('/owners')}>Annuler</Button>
              <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
                {isEdit ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageLayout>
  );
}
