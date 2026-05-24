import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useProject, useCreateProject, useUpdateProject, useProjectTypes } from '../hooks/useProjects';
import { useCountries } from '../../../shared/hooks/useCountries';
import { Save } from 'lucide-react';

const schema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  typeId: z.coerce.number().int().positive('Type de projet requis'),
  statut: z.enum(['EN_PROJET', 'EN_COURS', 'SUSPENDU', 'TERMINE', 'ANNULE']),
  avancement: z.coerce.number().int().min(0).max(100).default(0),
  // Rattachements optionnels (ID numérique ou vide)
  clientId: z.coerce.number().int().positive().optional().or(z.literal('')),
  ownerId: z.coerce.number().int().positive().optional().or(z.literal('')),
  terrainId: z.coerce.number().int().positive().optional().or(z.literal('')),
  lotissementId: z.coerce.number().int().positive().optional().or(z.literal('')),
  programmeId: z.coerce.number().int().positive().optional().or(z.literal('')),
  // Localisation
  adresse: z.string().optional(),
  commune: z.string().optional(),
  quartier: z.string().optional(),
  ville: z.string().optional(),
  pays: z.string().optional(),
  // Dates
  dateDebutPrevu: z.string().optional(),
  dateDebutReel: z.string().optional(),
  dateFinPrevue: z.string().optional(),
  dateFinReelle: z.string().optional(),
  // Financier
  budgetPrevu: z.coerce.number().nonnegative().optional().or(z.literal('')),
  budgetRealise: z.coerce.number().nonnegative().optional().or(z.literal('')),
  // Texte libre
  description: z.string().optional(),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormData = z.infer<typeof schema>;

const STATUT_OPTIONS = [
  { value: 'EN_PROJET', label: 'En projet' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'SUSPENDU', label: 'Suspendu' },
  { value: 'TERMINE', label: 'Terminé' },
  { value: 'ANNULE', label: 'Annulé' },
];

const EMPTY_OPTION = { value: '', label: '— Aucun —' };

type SelectOption = { value: string; label: string };

/** Charge une liste IPC au montage et retourne des options { value, label }. */
function useEntityOptions(
  loader: () => Promise<{ success?: boolean; data?: any[] }>,
  labelOf: (item: any) => string,
): SelectOption[] {
  const [options, setOptions] = useState<SelectOption[]>([]);
  useEffect(() => {
    loader().then((r) => {
      const list: any[] = r?.success ? (r.data as any[]) ?? [] : [];
      setOptions(list.map((i) => ({ value: String(i.id), label: labelOf(i) })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return options;
}

export default function ProjectFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useAuthStore((s) => s.token)!;

  const { data: res } = useProject(isEdit ? Number(id) : 0);
  const create = useCreateProject();
  const update = useUpdateProject();

  const { data: typesRes } = useProjectTypes(false);
  const types: any[] = typesRes?.success ? (typesRes.data as any[]) ?? [] : [];

  const { data: countriesRes } = useCountries();
  const countryOptions = (countriesRes?.data ?? []).map((c) => ({ value: c.isoCode, label: c.name }));

  // Listes pour les selects de rattachement (limite large pour un MVP).
  const clientOptions = useEntityOptions(
    () => window.electron.clients.list(token, {}, 1, 500),
    (c) => [c.firstName, c.lastName, c.entreprise].filter(Boolean).join(' ') || `Client #${c.id}`,
  );
  const ownerOptions = useEntityOptions(
    () => window.electron.owners.list(token, {}, 1, 500),
    (o) => [o.firstName, o.lastName].filter(Boolean).join(' ') || o.companyName || `Propriétaire #${o.id}`,
  );
  const terrainOptions = useEntityOptions(
    () => window.electron.terrains.list(token, {}, 1, 500),
    (t) => `${t.reference}${t.numeroParcelle ? ` · Lot ${t.numeroParcelle}` : ''}`,
  );
  const lotissementOptions = useEntityOptions(
    () => window.electron.lotissements.list(token, {}, 1, 500),
    (l) => `${l.reference} · ${l.nom}`,
  );
  const programmeOptions = useEntityOptions(
    () => window.electron.programmes.list(token, {}, 1, 500),
    (p) => `${p.reference} · ${p.nom}`,
  );

  // Pré-remplissage depuis les query-string (ex: /projects/new?clientId=12)
  const presets = {
    clientId: searchParams.get('clientId') ?? '',
    ownerId: searchParams.get('ownerId') ?? '',
    terrainId: searchParams.get('terrainId') ?? '',
    lotissementId: searchParams.get('lotissementId') ?? '',
    programmeId: searchParams.get('programmeId') ?? '',
  };

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<
    FormInput,
    any,
    FormData
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      statut: 'EN_PROJET',
      pays: 'CI',
      avancement: 0,
      ...presets,
    },
  });

  const typeOptions = useMemo(
    () => [{ value: '', label: '— Choisir un type —' }, ...types.map((t: any) => ({ value: String(t.id), label: t.label }))],
    [types],
  );

  useEffect(() => {
    if (isEdit && res?.data) {
      const p: any = res.data;
      reset({
        nom: p.nom ?? '',
        typeId: p.typeId,
        statut: p.statut,
        avancement: p.avancement ?? 0,
        clientId: p.clientId ?? '',
        ownerId: p.ownerId ?? '',
        terrainId: p.terrainId ?? '',
        lotissementId: p.lotissementId ?? '',
        programmeId: p.programmeId ?? '',
        adresse: p.adresse ?? '',
        commune: p.commune ?? '',
        quartier: p.quartier ?? '',
        ville: p.ville ?? '',
        pays: p.pays ?? 'CI',
        dateDebutPrevu: p.dateDebutPrevu ? String(p.dateDebutPrevu).slice(0, 10) : '',
        dateDebutReel: p.dateDebutReel ? String(p.dateDebutReel).slice(0, 10) : '',
        dateFinPrevue: p.dateFinPrevue ? String(p.dateFinPrevue).slice(0, 10) : '',
        dateFinReelle: p.dateFinReelle ? String(p.dateFinReelle).slice(0, 10) : '',
        budgetPrevu: p.budgetPrevu ?? '',
        budgetRealise: p.budgetRealise ?? '',
        description: p.description ?? '',
        notes: p.notes ?? '',
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload: any = {
      ...data,
      clientId: data.clientId === '' ? null : data.clientId,
      ownerId: data.ownerId === '' ? null : data.ownerId,
      terrainId: data.terrainId === '' ? null : data.terrainId,
      lotissementId: data.lotissementId === '' ? null : data.lotissementId,
      programmeId: data.programmeId === '' ? null : data.programmeId,
      budgetPrevu: data.budgetPrevu === '' ? null : data.budgetPrevu,
      budgetRealise: data.budgetRealise === '' ? null : data.budgetRealise,
      dateDebutPrevu: data.dateDebutPrevu || null,
      dateDebutReel: data.dateDebutReel || null,
      dateFinPrevue: data.dateFinPrevue || null,
      dateFinReelle: data.dateFinReelle || null,
    };
    const r: any = isEdit
      ? await update.mutateAsync({ id: Number(id), payload })
      : await create.mutateAsync(payload);
    if (r.success) navigate('/projects');
  };

  const watchedAvancement = Number(watch('avancement') ?? 0);

  return (
    <PageLayout
      title={isEdit ? 'Modifier le projet' : 'Nouveau projet'}
      breadcrumbs={[{ label: 'Projets', to: '/projects' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <Card className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Identité */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Identité</h3>
            <Input label="Nom du projet" required error={errors.nom?.message} {...register('nom')} />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Type de projet"
                required
                options={typeOptions}
                error={errors.typeId?.message}
                {...register('typeId')}
              />
              <Select label="Statut" options={STATUT_OPTIONS} {...register('statut')} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Avancement : {watchedAvancement} %</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="w-full mt-1"
                {...register('avancement')}
              />
            </div>
          </div>

          {/* Rattachements */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Rattachements (optionnels)</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Client commanditaire" options={[EMPTY_OPTION, ...clientOptions]} {...register('clientId')} />
              <Select label="Propriétaire" options={[EMPTY_OPTION, ...ownerOptions]} {...register('ownerId')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Terrain" options={[EMPTY_OPTION, ...terrainOptions]} {...register('terrainId')} />
              <Select label="Lotissement" options={[EMPTY_OPTION, ...lotissementOptions]} {...register('lotissementId')} />
            </div>
            <Select label="Programme immobilier" options={[EMPTY_OPTION, ...programmeOptions]} {...register('programmeId')} />
          </div>

          {/* Localisation */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Localisation</h3>
            <Input label="Adresse" {...register('adresse')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Commune" {...register('commune')} />
              <Input label="Quartier" {...register('quartier')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Ville / Village" {...register('ville')} />
              <Select
                label="Pays"
                options={countryOptions.length ? countryOptions : [{ value: 'CI', label: 'Côte d\'Ivoire' }]}
                {...register('pays')}
              />
            </div>
          </div>

          {/* Calendrier */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Calendrier</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date de démarrage prévue" type="date" {...register('dateDebutPrevu')} />
              <Input label="Date de démarrage réelle" type="date" {...register('dateDebutReel')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date de fin prévue" type="date" {...register('dateFinPrevue')} />
              <Input label="Date de fin réelle" type="date" {...register('dateFinReelle')} />
            </div>
          </div>

          {/* Financier */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Budget</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Budget prévu" type="number" step="0.01" {...register('budgetPrevu')} />
              <Input label="Budget réalisé" type="number" step="0.01" {...register('budgetRealise')} />
            </div>
          </div>

          {/* Description */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <Textarea label="Description" rows={3} {...register('description')} />
            <Textarea label="Notes internes" rows={2} {...register('notes')} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/projects')}>Annuler</Button>
            <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
