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
import { useLotissement, useCreateLotissement, useUpdateLotissement } from '../hooks/useLotissements';
import { useCountries } from '../../../shared/hooks/useCountries';
import { useTitleTypes } from '../../../shared/hooks/useTitleTypes';
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
  fraisDemarchesAcdStandard: z.coerce.number().nonnegative().optional().or(z.literal('')),
  titleTypeId: z.string().optional(),
  titleNumber: z.string().optional(),
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

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { statut: 'EN_COURS_LOTISSEMENT', pays: 'CI' },
  });

  const { data: countriesRes } = useCountries();
  const countryOptions = (countriesRes?.data ?? []).map((c) => ({ value: c.isoCode, label: c.name }));

  const { data: titleTypesRes } = useTitleTypes();
  const titleTypes = titleTypesRes?.success ? (titleTypesRes.data as any[]) ?? [] : [];
  const titleTypeOptions = [
    { value: '', label: '— Aucun —' },
    ...titleTypes.map((t) => ({ value: String(t.id), label: t.label })),
  ];

  useEffect(() => {
    if (isEdit && res?.data) {
      const l = res.data as any;
      // Coercion des null Prisma en '' pour les champs `optional()`
      // (sinon Zod plante silencieusement et handleSubmit n'appelle jamais onSubmit).
      reset({
        ...l,
        surface: l.surface ?? ('' as any),
        nombreParcelles: l.nombreParcelles ?? ('' as any),
        fraisDemarchesAcdStandard: l.fraisDemarchesAcdStandard ?? ('' as any),
        titleTypeId: l.titleTypeId != null ? String(l.titleTypeId) : '',
        titleNumber: l.titleNumber ?? '',
      });
    }
  }, [res, isEdit, reset]);

  // En mode création, pré-sélectionne la nature de titre marquée isDefault.
  useEffect(() => {
    if (isEdit) return;
    const def = titleTypes.find((t) => t.isDefault);
    if (def) setValue('titleTypeId', String(def.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleTypes.length, isEdit]);

  const onSubmit = async (data: FormData) => {
    const { titleTypeId, ...rest } = data;
    const payload: any = {
      ...rest,
      surface: rest.surface === '' ? undefined : rest.surface,
      nombreParcelles: rest.nombreParcelles === '' ? undefined : rest.nombreParcelles,
      fraisDemarchesAcdStandard: rest.fraisDemarchesAcdStandard === '' ? null : rest.fraisDemarchesAcdStandard,
      titleTypeId: titleTypeId ? Number(titleTypeId) : null,
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
              <FormSearchSelect control={control} name="pays" label="Pays" options={countryOptions} />
            </div>
          </div>

          {/* Données techniques */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Données techniques</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Surface totale (m²)" type="number" step="0.01" {...register('surface')} />
              <Input label="Nombre de parcelles" type="number" {...register('nombreParcelles')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Nature du titre sollicité" options={titleTypeOptions} {...register('titleTypeId')} />
              <Input label="Numéro du titre obtenu" placeholder="Ex : AP-2024-0123" {...register('titleNumber')} />
            </div>
          </div>

          {/* Frais de démarches ACD */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Frais de démarches ACD</h3>
            <p className="text-xs text-slate-500">
              Montant standard appliqué lorsqu'un client confie les démarches ACD à l'entreprise sur un
              terrain de ce lotissement. Pré-rempli sur chaque terrain et modifiable au cas par cas.
            </p>
            <Input
              label="Montant standard (FCFA)"
              type="number"
              step="1"
              min="0"
              placeholder="Ex: 500 000"
              {...register('fraisDemarchesAcdStandard')}
            />
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
