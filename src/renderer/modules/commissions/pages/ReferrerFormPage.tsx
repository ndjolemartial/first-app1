import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { FormSearchSelect } from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import { useReferrer, useCreateReferrer, useUpdateReferrer } from '../hooks/useCommissions';
import { useCountries } from '../../../shared/hooks/useCountries';
import { Save } from 'lucide-react';

const schema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  companyName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ReferrerFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const { data: res } = useReferrer(isEdit ? Number(id) : 0);
  const create = useCreateReferrer();
  const update = useUpdateReferrer();

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: 'CI', isActive: 'true' },
  });

  const { data: countriesRes } = useCountries();
  const countryOptions = (countriesRes?.data ?? []).map((c) => ({ value: c.isoCode, label: c.name }));

  useEffect(() => {
    if (isEdit && res?.data) {
      reset({
        firstName: res.data.firstName ?? '',
        lastName: res.data.lastName ?? '',
        companyName: res.data.companyName ?? '',
        email: res.data.email ?? '',
        phone: res.data.phone ?? '',
        mobile: res.data.mobile ?? '',
        address: res.data.address ?? '',
        city: res.data.city ?? '',
        country: res.data.country ?? 'CI',
        bankIban: res.data.bankIban ?? '',
        bankBic: res.data.bankBic ?? '',
        notes: res.data.notes ?? '',
        isActive: String(res.data.isActive),
      });
    }
  }, [res, isEdit, reset]);

  const apiError = create.data && !create.data.success ? create.data.error
    : update.data && !update.data.success ? update.data.error
    : null;

  const onSubmit = async (data: FormData) => {
    const payload = { ...data, isActive: data.isActive !== 'false' };
    const r = isEdit
      ? await update.mutateAsync({ id: Number(id), payload })
      : await create.mutateAsync(payload);
    if (r.success) navigate('/commissions/referrers');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier l\'apporteur d\'affaire' : 'Nouvel apporteur d\'affaire'}
      breadcrumbs={[
        { label: 'Commissions', to: '/commissions' },
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
              <div className="grid grid-cols-2 gap-4">
                <Input label="Prénom" required error={errors.firstName?.message} {...register('firstName')} />
                <Input label="Nom" required error={errors.lastName?.message} {...register('lastName')} />
              </div>
              <Input label="Société (si l'apporteur est une entreprise)" {...register('companyName')} />
            </div>

            {/* Coordonnées */}
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

            {/* Informations bancaires */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Informations bancaires (règlement des commissions)</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="IBAN" placeholder="CI xx xxxx" {...register('bankIban')} />
                <Input label="BIC / SWIFT" {...register('bankBic')} />
              </div>
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
      </div>
    </PageLayout>
  );
}
