import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useLotissement, useCreateLotissement, useUpdateLotissement } from '../hooks/useLotissements';
import { Save } from 'lucide-react';

const schema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  commune: z.string().optional(),
  quartier: z.string().optional(),
  ville: z.string().min(1, 'Ville requise'),
  pays: z.string().optional(),
  surface: z.coerce.number().positive().optional().or(z.literal('')),
  nombreParcelles: z.coerce.number().int().positive().optional().or(z.literal('')),
  promoteur: z.string().optional(),
  statut: z.enum(['EN_COURS_LOTISSEMENT', 'EN_COURS', 'OUVERT', 'PARTIELLEMENT_VENDU', 'COMPLET', 'FERME']),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const STATUT_OPTIONS = [
  { value: 'EN_COURS_LOTISSEMENT', label: 'En cours de lotissement' },
  { value: 'EN_COURS', label: 'En cours d\'aménagement' },
  { value: 'OUVERT', label: 'Ouvert à la vente' },
  { value: 'PARTIELLEMENT_VENDU', label: 'Partiellement vendu' },
  { value: 'COMPLET', label: 'Complet (entièrement vendu)' },
  { value: 'FERME', label: 'Fermé' },
];

export default function LotissementFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useLotissement(isEdit ? Number(id) : 0);
  const create = useCreateLotissement();
  const update = useUpdateLotissement();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { statut: 'EN_COURS_LOTISSEMENT', pays: 'CI' },
  });

  useEffect(() => {
    if (isEdit && res?.data) reset({ ...res.data });
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      surface: data.surface === '' ? undefined : data.surface,
      nombreParcelles: data.nombreParcelles === '' ? undefined : data.nombreParcelles,
    };
    let r: any;
    if (isEdit) r = await update.mutateAsync({ id: Number(id), payload });
    else r = await create.mutateAsync(payload);
    if (r.success) navigate('/lotissements');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le lotissement' : 'Nouveau lotissement'}
      breadcrumbs={[{ label: 'Lotissements', to: '/lotissements' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Identité */}
          <div className="space-y-4">
            <Input label="Nom du lotissement" required error={errors.nom?.message} {...register('nom')} />
            <Input label="Promoteur / Aménageur" {...register('promoteur')} />
            <Select label="Statut" options={STATUT_OPTIONS} {...register('statut')} />
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
              <Input label="Pays" defaultValue="CI" {...register('pays')} />
            </div>
          </div>

          {/* Données techniques */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Données techniques</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Surface totale (m²)" type="number" step="0.01" {...register('surface')} />
              <Input label="Nombre de parcelles" type="number" {...register('nombreParcelles')} />
            </div>
          </div>

          <Textarea label="Description / Notes" rows={3} {...register('description')} />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/lotissements')}>Annuler</Button>
            <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
