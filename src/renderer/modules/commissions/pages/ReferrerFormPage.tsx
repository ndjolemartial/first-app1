import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { upperField } from '../../../shared/utils/uppercase';
import Select from '../../../shared/components/ui/Select';
import { FormSearchSelect } from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import { useReferrer, useCreateReferrer, useUpdateReferrer, useCommissionUsers } from '../hooks/useCommissions';
import { useCountries } from '../../../shared/hooks/useCountries';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { SOURCE_OF_FUNDS_OPTIONS, RELATIONSHIP_PURPOSE_OPTIONS } from '../../../shared/utils/kycDocumentKit';
import { PEP_CATEGORY_LABEL } from '../../aml/utils/aml.utils';
import { Save, Upload, X, FileText } from 'lucide-react';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_MB = 10;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const CIVILITE_OPTIONS = [
  { value: '', label: '— Civilité —' },
  { value: 'Monsieur', label: 'Monsieur' },
  { value: 'Madame', label: 'Madame' },
  { value: 'Mademoiselle', label: 'Mademoiselle' },
];

const schema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  civilite: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  // Informations complémentaires — alimentent la Fiche KYC imprimable.
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
  isActive: z.string().optional(),
  assignedToId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ReferrerFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;

  const { data: res } = useReferrer(isEdit ? Number(id) : 0);
  const create = useCreateReferrer();
  const update = useUpdateReferrer();

  // Justificatif(s) d'origine des fonds — plusieurs fichiers possibles,
  // s'ajoutant aux justificatifs déjà déposés.
  const [fundsProofFiles, setFundsProofFiles] = useState<File[]>([]);
  const [fundsProofError, setFundsProofError] = useState<string | null>(null);
  const [existingFundsProofs, setExistingFundsProofs] = useState<{ id: number; name: string; size: number }[]>([]);
  const fundsProofRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: 'CI', isActive: 'true', sourceOfFunds: [], relationshipPurpose: [] },
  });

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

  const { data: countriesRes } = useCountries();
  const countryOptions = (countriesRes?.data ?? []).map((c) => ({ value: c.isoCode, label: c.name }));

  const { data: usersRes } = useCommissionUsers();
  const userOptions = [
    { value: '', label: '— Aucun —' },
    ...((usersRes?.data ?? []) as any[]).map((u) => ({
      value: String(u.id),
      label: `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() || u.email,
    })),
  ];

  useEffect(() => {
    if (isEdit && res?.data) {
      reset({
        firstName: res.data.firstName ?? '',
        lastName: res.data.lastName ?? '',
        civilite: res.data.civilite ?? '',
        companyName: res.data.companyName ?? '',
        email: res.data.email ?? '',
        phone: res.data.phone ?? '',
        mobile: res.data.mobile ?? '',
        address: res.data.address ?? '',
        city: res.data.city ?? '',
        country: res.data.country ?? 'CI',
        bankIban: res.data.bankIban ?? '',
        bankBic: res.data.bankBic ?? '',
        employerName: res.data.employerName ?? '',
        monthlyIncome: res.data.monthlyIncome != null ? String(res.data.monthlyIncome) : '',
        sourceOfFunds: Array.isArray(res.data.sourceOfFunds) ? res.data.sourceOfFunds : [],
        sourceOfFundsOther: res.data.sourceOfFundsOther ?? '',
        sourceOfWealth: res.data.sourceOfWealth ?? '',
        relationshipPurpose: Array.isArray(res.data.relationshipPurpose) ? res.data.relationshipPurpose : [],
        relationshipPurposeOther: res.data.relationshipPurposeOther ?? '',
        expectedTransactionVolume: res.data.expectedTransactionVolume != null ? String(res.data.expectedTransactionVolume) : '',
        acquisitionChannel: res.data.acquisitionChannel ?? '',
        isPep: res.data.isPep ?? false,
        pepCategory: res.data.pepCategory ?? '',
        pepFunction: res.data.pepFunction ?? '',
        hasRiskyCountryLink: res.data.hasRiskyCountryLink ?? false,
        kycSignedAt: res.data.kycSignedAt ? new Date(res.data.kycSignedAt).toISOString().slice(0, 10) : '',
        kycSignedPlace: res.data.kycSignedPlace ?? '',
        notes: res.data.notes ?? '',
        isActive: String(res.data.isActive),
        assignedToId: res.data.assignedToId != null ? String(res.data.assignedToId) : '',
      });
      const docs: any[] = res.data.documents ?? [];
      setExistingFundsProofs(
        docs.filter((d: any) => d.category === 'justificatif_origine_fonds')
          .map((d: any) => ({ id: d.id, name: d.name, size: d.size }))
      );
    }
  }, [res, isEdit, reset]);

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
  async function uploadFundsProofs(referrerId: number) {
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
    await window.electron.documents.uploadReferrerDocs(token, referrerId, 'justificatif_origine_fonds', files);
    setFundsProofFiles([]);
  }

  const apiError = create.data && !create.data.success ? create.data.error
    : update.data && !update.data.success ? update.data.error
    : null;

  const onSubmit = async (data: FormData) => {
    const { assignedToId, ...rest } = data;
    const payload: any = { ...rest, isActive: data.isActive !== 'false' };
    payload.assignedToId = assignedToId ? Number(assignedToId) : null;
    if (payload.kycSignedAt) {
      payload.kycSignedAt = new Date(`${payload.kycSignedAt}T00:00:00.000Z`).toISOString();
    } else {
      delete payload.kycSignedAt;
    }
    if (!payload.isPep) payload.pepCategory = null;
    if (!payload.sourceOfFunds?.includes('AUTRE')) payload.sourceOfFundsOther = null;
    if (!payload.relationshipPurpose?.includes('AUTRE')) payload.relationshipPurposeOther = null;
    const r = isEdit
      ? await update.mutateAsync({ id: Number(id), payload })
      : await create.mutateAsync(payload);
    if (r.success) {
      const rid = isEdit ? Number(id) : r.data.id;
      await uploadFundsProofs(rid);
      navigate('/commissions/referrers');
    }
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier l\'apporteur d\'affaire' : 'Nouvel apporteur d\'affaire'}
      breadcrumbs={[
        { label: 'Tierce partie' },
        { label: 'Apporteurs d\'affaire', to: '/commissions/referrers' },
        { label: isEdit ? 'Modifier' : 'Nouveau' },
      ]}
    >
      <div className="max-w-2xl mx-auto">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Identité */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Identité</h3>
              <Select label="Civilité" options={CIVILITE_OPTIONS} {...register('civilite')} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Prénom" required error={errors.firstName?.message} {...upperField(register('firstName'))} />
                <Input label="Nom" required error={errors.lastName?.message} {...upperField(register('lastName'))} />
              </div>
              <Input label="Société (si l'apporteur est une entreprise)" {...upperField(register('companyName'))} />
            </div>

            {/* Coordonnées */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Coordonnées</h3>
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
            </div>

            {/* Informations bancaires */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Informations bancaires (règlement des commissions)</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="IBAN" placeholder="CI xx xxxx" {...register('bankIban')} />
                <Input label="BIC / SWIFT" {...register('bankBic')} />
              </div>
            </div>

            {/* Informations complémentaires (Fiche KYC) */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Informations complémentaires (Fiche KYC)</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Employeur / activité professionnelle" {...register('employerName')} />
                <Input label="Revenu mensuel déclaré (FCFA)" type="number" {...register('monthlyIncome')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Origine des fonds</label>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-3">
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
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-3">
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
                <input id="referrerIsPep" type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('isPep')} />
                <label htmlFor="referrerIsPep" className="text-sm font-medium text-slate-700">Personne politiquement exposée (PPE)</label>
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
                <input id="referrerHasRiskyCountryLink" type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('hasRiskyCountryLink')} />
                <label htmlFor="referrerHasRiskyCountryLink" className="text-sm font-medium text-slate-700">Lien avec un pays à risque</label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Lieu de signature de la fiche KYC" {...register('kycSignedPlace')} />
                <Input label="Date de signature de la fiche KYC" type="date" {...register('kycSignedAt')} />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Affectation</h3>
              <FormSearchSelect
                control={control}
                name="assignedToId"
                label="Utilisateur référent"
                options={userOptions}
              />
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-4">
              <Select
                label="Statut"
                options={[{ value: 'true', label: 'Actif' }, { value: 'false', label: 'Inactif' }]}
                {...register('isActive')}
              />
              <Textarea label="Notes" rows={3} {...register('notes')} />
            </div>

            {apiError && (
              <p className="text-sm text-red-600">
                {typeof apiError === 'string' ? apiError : 'Erreur lors de l\'enregistrement'}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => navigate('/commissions/referrers')}>
                Annuler
              </Button>
              <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
                {isEdit ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </Card>

        {isEdit && (
          <EntityDocumentsCard
            documents={res?.data?.documents ?? []}
            defaultLinks={{ referrerId: Number(id) }}
            invalidateKey={['commissions', 'referrer', Number(id)]}
          />
        )}
      </div>
    </PageLayout>
  );
}
