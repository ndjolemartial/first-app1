import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
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
import { useProgramme, useCreateProgramme, useUpdateProgramme } from '../hooks/useProgrammes';
import { useCountries } from '../../../shared/hooks/useCountries';
import { Save } from 'lucide-react';

const schema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  type: z.enum(['RESIDENTIEL', 'COMMERCIAL', 'MIXTE']),
  promoteur: z.string().optional(),
  commune: z.string().optional(),
  quartier: z.string().optional(),
  ville: z.string().min(1, 'Ville requise'),
  pays: z.string().optional(),
  surface: z.coerce.number().positive().optional().or(z.literal('')),
  nombreLogements: z.coerce.number().int().positive().optional().or(z.literal('')),
  dateDebut: z.string().optional(),
  dateLivraisonPrevue: z.string().optional(),
  statut: z.enum(['EN_PROJET', 'EN_CONSTRUCTION', 'EN_COMMERCIALISATION', 'LIVRE', 'CLOTURE']),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TYPE_OPTIONS = [
  { value: 'RESIDENTIEL', label: 'Résidentiel' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'MIXTE', label: 'Mixte' },
];

const STATUT_OPTIONS = [
  { value: 'EN_PROJET', label: 'En projet' },
  { value: 'EN_CONSTRUCTION', label: 'En construction' },
  { value: 'EN_COMMERCIALISATION', label: 'En commercialisation' },
  { value: 'LIVRE', label: 'Livré' },
  { value: 'CLOTURE', label: 'Clôturé' },
];

export default function ProgrammeFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useProgramme(isEdit ? Number(id) : 0);
  const create = useCreateProgramme();
  const update = useUpdateProgramme();

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<
    z.input<typeof schema>,
    any,
    FormData
  >({
    resolver: zodResolver(schema),
    defaultValues: { type: 'RESIDENTIEL', statut: 'EN_PROJET', pays: 'CI' },
  });

  const { data: countriesRes } = useCountries();
  const countryOptions = (countriesRes?.data ?? []).map((c) => ({ value: c.isoCode, label: c.name }));

  useEffect(() => {
    if (isEdit && res?.data) {
      const p = res.data;
      reset({
        ...p,
        surface: p.surface ?? '',
        nombreLogements: p.nombreLogements ?? '',
        dateDebut: p.dateDebut ? String(p.dateDebut).slice(0, 10) : '',
        dateLivraisonPrevue: p.dateLivraisonPrevue ? String(p.dateLivraisonPrevue).slice(0, 10) : '',
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      surface: data.surface === '' ? undefined : data.surface,
      nombreLogements: data.nombreLogements === '' ? undefined : data.nombreLogements,
      dateDebut: data.dateDebut || undefined,
      dateLivraisonPrevue: data.dateLivraisonPrevue || undefined,
    };
    let r: any;
    if (isEdit) r = await update.mutateAsync({ id: Number(id), payload });
    else r = await create.mutateAsync(payload);
    if (r.success) navigate('/programmes');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le programme immobilier' : 'Nouveau programme immobilier'}
      breadcrumbs={[{ label: 'Programmes immobiliers', to: '/programmes' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Identité */}
          <div className="space-y-4">
            <Input label="Nom du programme" required error={errors.nom?.message} {...register('nom')} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Type de programme" options={TYPE_OPTIONS} {...register('type')} />
              <Select label="Statut" options={STATUT_OPTIONS} {...register('statut')} />
            </div>
            <Input label="Promoteur / Aménageur" {...register('promoteur')} />
          </div>

          {/* Localisation */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Localisation</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Commune" {...register('commune')} />
              <Input label="Quartier" {...register('quartier')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Ville / Village" required error={errors.ville?.message} {...register('ville')} />
              <FormSearchSelect control={control} name="pays" label="Pays" options={countryOptions} />
            </div>
          </div>

          {/* Données techniques */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Données techniques</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Surface totale (m²)" type="number" step="0.01" {...register('surface')} />
              <Input label="Nombre de logements" type="number" {...register('nombreLogements')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date de démarrage" type="date" {...register('dateDebut')} />
              <Input label="Livraison prévue" type="date" {...register('dateLivraisonPrevue')} />
            </div>
          </div>

          <Textarea label="Description / Notes" rows={3} {...register('description')} />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/programmes')}>Annuler</Button>
            <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
