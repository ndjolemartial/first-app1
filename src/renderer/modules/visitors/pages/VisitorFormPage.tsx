import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Button from '../../../shared/components/ui/Button';
import { FormSearchSelect } from '../../../shared/components/ui/SearchSelect';
import { Save } from 'lucide-react';
import { useVisitor, useCreateVisitor, useUpdateVisitor, useVisitObjects } from '../hooks/useVisitors';

interface FormData {
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  email: string;
  objet: string;
  details: string;
}

const EMPTY: FormData = {
  firstName: '', lastName: '', company: '', phone: '', email: '', objet: '', details: '',
};

export default function VisitorFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const visitorId = Number(id);

  const { data: res } = useVisitor(isEdit ? visitorId : 0);
  const create = useCreateVisitor();
  const update = useUpdateVisitor();

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: EMPTY,
  });

  const { data: objectsRes } = useVisitObjects();
  const objetOptions = [
    { value: '', label: '— Sélectionner un objet —' },
    ...((objectsRes?.success && objectsRes.data ? objectsRes.data : []).map((o: any) => ({
      value: o.label,
      label: o.label,
    }))),
  ];

  useEffect(() => {
    if (isEdit && res?.success && res.data) {
      const v = res.data;
      reset({
        firstName: v.firstName ?? '',
        lastName: v.lastName ?? '',
        company: v.company ?? '',
        phone: v.phone ?? '',
        email: v.email ?? '',
        objet: v.objet ?? '',
        details: v.details ?? '',
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    if (isEdit) {
      const r = await update.mutateAsync({ id: visitorId, payload: data });
      if (r.success) navigate('/visitors');
    } else {
      const r = await create.mutateAsync(data);
      if (r.success) navigate('/visitors');
    }
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le visiteur' : 'Nouveau visiteur'}
      breadcrumbs={[{ label: 'Gestion des visiteurs', to: '/visitors' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-4">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Identité du visiteur</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Nom" required className="uppercase" error={errors.lastName?.message} {...register('lastName', { required: 'Nom requis' })} />
            <Input label="Prénoms" required error={errors.firstName?.message} {...register('firstName', { required: 'Prénoms requis' })} />
            <Input label="Entreprise" {...register('company')} />
            <Input label="Contacts (téléphone)" required error={errors.phone?.message} {...register('phone', { required: 'Contacts requis' })} />
            <Input label="Adresse mail" type="email" error={errors.email?.message}
              {...register('email', {
                validate: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Adresse mail invalide',
              })} />
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Visite</h3>
          <div className="grid grid-cols-1 gap-3">
            <FormSearchSelect
              control={control}
              name="objet"
              label="Objet de visite"
              required
              options={objetOptions}
              placeholder="Rechercher un objet de visite…"
              rules={{ required: 'Objet de visite requis' }}
              error={errors.objet?.message}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Détails</label>
              <textarea
                rows={4}
                {...register('details')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/visitors')}>Annuler</Button>
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={isSubmitting}>
            {isEdit ? 'Enregistrer' : 'Enregistrer le visiteur'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
