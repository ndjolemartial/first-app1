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
import { useProperty, useCreateProperty, useUpdateProperty } from '../hooks/useProperties';
import { useOwners } from '../../owners/hooks/useOwners';
import { useAuthStore } from '../../../shared/stores/auth.store';
import MapLinkField from '../../../shared/components/MapLinkField';
import { Save } from 'lucide-react';

const schema = z.object({
  ownerId: z.coerce.number().int().positive('Propriétaire requis'),
  type: z.enum(['APARTEMENT', 'DUPLEX', 'VILLA', 'STUDIO', 'BUREAU', 'PARKING', 'AUTRE']),
  status: z.enum(['DISPONIBLE', 'INDISPONIBLE', 'EN_LOCATION', 'SOLDE', 'SOUS_OPTION', 'EN_RENOVATION']).default('DISPONIBLE'),
  address: z.string().min(1, 'Adresse requise'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'Ville requise'),
  postalCode: z.string().optional(),
  country: z.string().default('CI'),
  latitude: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) >= -90 && Number(v) <= 90), 'Latitude entre -90 et 90'),
  longitude: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) >= -180 && Number(v) <= 180), 'Longitude entre -180 et 180'),
  surface: z.coerce.number().positive('Surface requise'),
  surfaceCarrez: z.coerce.number().optional(),
  rooms: z.coerce.number().int().optional(),
  bedrooms: z.coerce.number().int().optional(),
  bathrooms: z.coerce.number().int().optional(),
  floor: z.coerce.number().int().optional(),
  totalFloors: z.coerce.number().int().optional(),
  buildYear: z.coerce.number().int().optional(),
  condition: z.enum(['NOUVEAU', 'EXCELLENT', 'BON', 'MOYEN', 'MAUVAIS']).optional(),
  rentPrice: z.coerce.number().optional(),
  salePrice: z.coerce.number().optional(),
  charges: z.coerce.number().optional(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TYPE_OPTIONS = [
  { value: 'APARTEMENT', label: 'Appartement' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'BUREAU', label: 'Bureau' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'AUTRE', label: 'Autre' },
];

const STATUS_OPTIONS = [
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'INDISPONIBLE', label: 'Indisponible' },
  { value: 'EN_LOCATION', label: 'En location' },
  { value: 'SOLDE', label: 'Soldé' },
  { value: 'SOUS_OPTION', label: 'Sous option' },
  { value: 'EN_RENOVATION', label: 'En rénovation' },
];

const CONDITION_OPTIONS = [
  { value: '', label: '— État —' },
  { value: 'NOUVEAU', label: 'Neuf' },
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'BON', label: 'Bon' },
  { value: 'MOYEN', label: 'Moyen' },
  { value: 'MAUVAIS', label: 'Mauvais' },
];

export default function PropertyFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const { data: res } = useProperty(isEdit ? Number(id) : 0);
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const { data: ownersRes } = useOwners({}, 1, 200);

  const ownerOptions = [
    { value: '', label: '— Choisir un propriétaire —' },
    ...(ownersRes?.data ?? []).map((o: any) => ({
      value: String(o.id),
      label:
        o.type === 'ENTREPRISE'
          ? o.companyName ?? ''
          : `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim(),
    })),
  ];

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<
    z.input<typeof schema>,
    any,
    FormData
  >({
    resolver: zodResolver(schema),
    defaultValues: { type: 'VILLA', status: 'DISPONIBLE', country: 'CI' },
  });

  useEffect(() => {
    if (isEdit && res?.data) {
      const p = res.data;
      reset({
        ...p,
        ownerId: p.ownerId,
        surface: Number(p.surface),
        surfaceCarrez: p.surfaceCarrez ? Number(p.surfaceCarrez) : undefined,
        rentPrice: p.rentPrice ? Number(p.rentPrice) : undefined,
        salePrice: p.salePrice ? Number(p.salePrice) : undefined,
        charges: p.charges ? Number(p.charges) : undefined,
        latitude: p.latitude != null ? String(p.latitude) : '',
        longitude: p.longitude != null ? String(p.longitude) : '',
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload: any = { ...data };
    if (!payload.condition) delete payload.condition;
    payload.latitude = data.latitude ? Number(data.latitude) : null;
    payload.longitude = data.longitude ? Number(data.longitude) : null;
    let r;
    if (isEdit) r = await update.mutateAsync({ id: Number(id), payload });
    else r = await create.mutateAsync(payload);
    if (r.success) navigate('/properties');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le bien' : 'Nouveau bien'}
      breadcrumbs={[{ label: 'Biens', to: '/properties' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto">
        {/* Identification */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Identification</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Propriétaire *"
              options={ownerOptions}
              error={errors.ownerId?.message}
              {...register('ownerId')}
            />
            <Select label="Type de bien *" options={TYPE_OPTIONS} error={errors.type?.message} {...register('type')} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Select label="Statut" options={STATUS_OPTIONS} {...register('status')} />
            <Select label="État du bien" options={CONDITION_OPTIONS} {...register('condition')} />
          </div>
        </Card>

        {/* Localisation */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Localisation</h3>
          <Input label="Adresse *" error={errors.address?.message} {...register('address')} />
          <div className="mt-4">
            <Input label="Complément d'adresse" {...register('addressLine2')} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Input label="Ville *" error={errors.city?.message} {...register('city')} />
            <Input label="Code postal" {...register('postalCode')} />
            <Input label="Pays" defaultValue="CI" {...register('country')} />
          </div>
          <div className="mt-4">
            <MapLinkField
              token={token}
              onResolved={(la, lo) => {
                setValue('latitude', String(la), { shouldValidate: true });
                setValue('longitude', String(lo), { shouldValidate: true });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input
              label="Latitude"
              type="number"
              step="any"
              placeholder="Ex: 5.345678"
              helper="Coordonnée GPS — visible sur la carte de la fiche"
              error={errors.latitude?.message}
              {...register('latitude')}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              placeholder="Ex: -4.024429"
              helper="Coordonnée GPS — visible sur la carte de la fiche"
              error={errors.longitude?.message}
              {...register('longitude')}
            />
          </div>
        </Card>

        {/* Caractéristiques */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Caractéristiques</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Surface (m²) *" type="number" step="0.01" error={errors.surface?.message} {...register('surface')} />
            <Input label="Surface Carrez (m²)" type="number" step="0.01" {...register('surfaceCarrez')} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Input label="Pièces" type="number" {...register('rooms')} />
            <Input label="Chambres" type="number" {...register('bedrooms')} />
            <Input label="Salles de bain" type="number" {...register('bathrooms')} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Input label="Étage" type="number" {...register('floor')} />
            <Input label="Nbre d'étages" type="number" {...register('totalFloors')} />
            <Input label="Année construction" type="number" {...register('buildYear')} />
          </div>
        </Card>

        {/* Prix */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Prix</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Loyer mensuel (FCFA)" type="number" step="1000" {...register('rentPrice')} />
            <Input label="Prix de vente (FCFA)" type="number" step="1000" {...register('salePrice')} />
          </div>
          <div className="mt-4">
            <Input label="Charges mensuelles (FCFA)" type="number" step="1000" {...register('charges')} />
          </div>
        </Card>

        {/* Description */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Description</h3>
          <Textarea label="Description du bien" rows={4} {...register('description')} />
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/properties')}>Annuler</Button>
          <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
            {isEdit ? 'Enregistrer' : 'Créer le bien'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
