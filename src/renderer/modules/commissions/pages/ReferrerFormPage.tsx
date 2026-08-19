import { useEffect } from 'react';
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
import { SOURCE_OF_FUNDS_OPTIONS, RELATIONSHIP_PURPOSE_OPTIONS } from '../../../shared/utils/kycDocumentKit';
import { PEP_CATEGORY_LABEL } from '../../aml/utils/aml.utils';
import { Save } from 'lucide-react';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';

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

  const { data: res } = useReferrer(isEdit ? Number(id) : 0);
  const create = useCreateReferrer();
  const update = useUpdateReferrer();

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
    }
  }, [res, isEdit, reset]);

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
    if (r.success) navigate('/commissions/referrers');
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
