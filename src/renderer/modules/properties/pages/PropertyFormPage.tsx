import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { clsx } from 'clsx';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { FormSearchSelect } from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useProperty, useCreateProperty, useUpdateProperty } from '../hooks/useProperties';
import { useOwners } from '../../owners/hooks/useOwners';
import { useProgrammes } from '../../programmes/hooks/useProgrammes';
import { useClients } from '../../clients/hooks/useClients';
import { useCountries } from '../../../shared/hooks/useCountries';
import { useAuthStore } from '../../../shared/stores/auth.store';
import MapLinkField from '../../../shared/components/MapLinkField';
import { Save } from 'lucide-react';

// Statuts pour lesquels un client rattaché est obligatoire.
const STATUS_REQUIRING_CLIENT = ['RESERVE', 'SOUS_OPTION', 'VENDU', 'EN_LOCATION'] as const;
type StatusRequiringClient = (typeof STATUS_REQUIRING_CLIENT)[number];
const statusNeedsClient = (s: string): s is StatusRequiringClient =>
  (STATUS_REQUIRING_CLIENT as readonly string[]).includes(s);

const schema = z.object({
  // Origine du bien : propriétaire OU programme immobilier (jamais les deux).
  ownerId: z.coerce.number().int().positive().optional().or(z.literal('')),
  programmeId: z.coerce.number().int().positive().optional().or(z.literal('')),
  // Client rattaché (visible quand le statut ≠ DISPONIBLE).
  clientId: z.coerce.number().int().positive().optional().or(z.literal('')),
  type: z.enum(['APARTEMENT', 'DUPLEX', 'VILLA', 'STUDIO', 'BUREAU', 'PARKING', 'AUTRE']),
  status: z.enum(['DISPONIBLE', 'RESERVE', 'SOUS_OPTION', 'VENDU', 'EN_LOCATION', 'EN_RENOVATION', 'INDISPONIBLE']).default('DISPONIBLE'),
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
  surface: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) > 0), 'Surface invalide'),
  rooms: z.coerce.number().int().optional(),
  bedrooms: z.coerce.number().int().optional(),
  bathrooms: z.coerce.number().int().optional(),
  floor: z.coerce.number().int().optional(),
  totalFloors: z.coerce.number().int().optional(),
  buildYear: z.coerce.number().int().optional(),
  condition: z.enum(['NOUVEAU', 'EXCELLENT', 'BON', 'MOYEN', 'MAUVAIS']).optional(),
  garage: z.string().optional(),
  cuisine: z.string().optional(),
  terrasseBalcon: z.string().optional(),
  rentPrice: z.coerce.number().optional(),
  salePrice: z.coerce.number().optional(),
  charges: z.coerce.number().optional(),
  description: z.string().optional(),
}).superRefine((data, ctx) => {
  if (statusNeedsClient(data.status) && !data.clientId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['clientId'],
      message: 'Un client doit être rattaché pour ce statut',
    });
  }
});

type FormData = z.infer<typeof schema>;
type SourceType = 'OWNER' | 'PROGRAMME' | 'NONE';

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'OWNER', label: 'Propriétaire' },
  { value: 'PROGRAMME', label: 'Programme immobilier' },
  { value: 'NONE', label: 'Non précisée' },
];

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
  { value: 'RESERVE', label: 'Réservé' },
  { value: 'SOUS_OPTION', label: 'Sous option' },
  { value: 'VENDU', label: 'Vendu' },
  { value: 'EN_LOCATION', label: 'En location' },
  { value: 'EN_RENOVATION', label: 'En rénovation' },
  { value: 'INDISPONIBLE', label: 'Indisponible' },
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
  const [searchParams] = useSearchParams();
  const presetProgrammeId = searchParams.get('programmeId') ?? '';

  const { data: res } = useProperty(isEdit ? Number(id) : 0);
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const { data: ownersRes } = useOwners({}, 1, 200);
  const { data: programmesRes } = useProgrammes({}, 1, 200);
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: countriesRes } = useCountries();
  const countryOptions = (countriesRes?.data ?? []).map((c) => ({ value: c.isoCode, label: c.name }));

  // Origine du bien : propriétaire par défaut, ou programme si pré-rempli.
  const [sourceType, setSourceType] = useState<SourceType>(presetProgrammeId ? 'PROGRAMME' : 'OWNER');

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

  const programmeOptions = [
    { value: '', label: '— Choisir un programme —' },
    ...(programmesRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.nom}`,
    })),
  ];

  const clientOptions = [
    { value: '', label: '— Choisir un client —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label:
        c.type === 'ENTREPRISE'
          ? c.entreprise ?? ''
          : `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
    })),
  ];

  const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<
    z.input<typeof schema>,
    any,
    FormData
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'VILLA',
      status: 'DISPONIBLE',
      country: 'CI',
      ownerId: '',
      programmeId: presetProgrammeId,
      clientId: '',
    },
  });

  // Statut courant : pilote la visibilité du champ Client.
  const currentStatus = useWatch({ control, name: 'status' });
  const showClientField = currentStatus !== 'DISPONIBLE';

  // Vide automatiquement clientId quand le statut repasse à DISPONIBLE.
  useEffect(() => {
    if (currentStatus === 'DISPONIBLE') setValue('clientId', '');
  }, [currentStatus, setValue]);

  useEffect(() => {
    if (isEdit && res?.data) {
      const p = res.data;
      setSourceType(p.programmeId ? 'PROGRAMME' : p.ownerId ? 'OWNER' : 'NONE');
      // Coercion des null Prisma en '' / undefined pour les champs optional :
      // Zod n'accepte pas null sur un string/enum optional, sinon handleSubmit
      // échoue silencieusement et RHF focus le premier champ "invalide".
      reset({
        ...p,
        ownerId: p.ownerId ?? '',
        programmeId: p.programmeId ?? '',
        clientId: p.clientId ?? '',
        surface: p.surface != null ? String(p.surface) : '',
        rentPrice: p.rentPrice ? Number(p.rentPrice) : undefined,
        salePrice: p.salePrice ? Number(p.salePrice) : undefined,
        charges: p.charges ? Number(p.charges) : undefined,
        latitude: p.latitude != null ? String(p.latitude) : '',
        longitude: p.longitude != null ? String(p.longitude) : '',
        addressLine2: p.addressLine2 ?? '',
        postalCode: p.postalCode ?? '',
        garage: p.garage ?? '',
        cuisine: p.cuisine ?? '',
        terrasseBalcon: p.terrasseBalcon ?? '',
        description: p.description ?? '',
        condition: p.condition ?? undefined,
      });
    }
  }, [res, isEdit, reset]);

  const handleSourceChange = (v: SourceType) => {
    setSourceType(v);
    if (v !== 'OWNER') setValue('ownerId', '');
    if (v !== 'PROGRAMME') setValue('programmeId', '');
  };

  const onSubmit = async (data: FormData) => {
    const payload: any = { ...data };
    if (!payload.condition) delete payload.condition;
    payload.surface = data.surface ? Number(data.surface) : null;
    payload.latitude = data.latitude ? Number(data.latitude) : null;
    payload.longitude = data.longitude ? Number(data.longitude) : null;
    payload.ownerId = sourceType === 'OWNER' && data.ownerId ? Number(data.ownerId) : null;
    payload.programmeId = sourceType === 'PROGRAMME' && data.programmeId ? Number(data.programmeId) : null;
    // Client : forcé à null si le statut est DISPONIBLE (cohérence côté serveur aussi).
    payload.clientId =
      data.status !== 'DISPONIBLE' && data.clientId ? Number(data.clientId) : null;
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

          {/* Origine du bien */}
          <div>
            <label className="text-sm font-medium text-slate-700">Origine du bien</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSourceChange(opt.value)}
                  className={clsx(
                    'px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors',
                    sourceType === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Un bien provient soit d'un propriétaire, soit d'un programme immobilier.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            {sourceType === 'OWNER' && (
              <FormSearchSelect control={control} name="ownerId" label="Propriétaire" options={ownerOptions} />
            )}
            {sourceType === 'PROGRAMME' && (
              <FormSearchSelect control={control} name="programmeId" label="Programme immobilier" options={programmeOptions} />
            )}
            {sourceType === 'NONE' && (
              <p className="text-sm text-slate-400 self-center">Aucune origine renseignée.</p>
            )}
            <Select label="Type de bien *" options={TYPE_OPTIONS} error={errors.type?.message} {...register('type')} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Select label="Statut" options={STATUS_OPTIONS} {...register('status')} />
            <Select label="État du bien" options={CONDITION_OPTIONS} {...register('condition')} />
          </div>
          {showClientField && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <FormSearchSelect
                control={control}
                name="clientId"
                label={statusNeedsClient(currentStatus ?? '') ? 'Client rattaché *' : 'Client rattaché'}
                options={clientOptions}
                error={errors.clientId?.message as string | undefined}
              />
            </div>
          )}
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
            <FormSearchSelect control={control} name="country" label="Pays" options={countryOptions} />
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
          <Input label="Surface (m²)" type="number" step="0.01" error={errors.surface?.message} {...register('surface')} />
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
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Input label="Garage" placeholder="Ex : box fermé, 2 places…" {...register('garage')} />
            <Input label="Cuisine" placeholder="Ex : américaine équipée…" {...register('cuisine')} />
            <Input label="Terrasse ou balcon" placeholder="Ex : terrasse 12 m² exposée sud…" {...register('terrasseBalcon')} />
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
