import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
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
import { useTerrain, useCreateTerrain, useUpdateTerrain } from '../hooks/useTerrains';
import { useLotissements } from '../../lotissements/hooks/useLotissements';
import { useProgrammes } from '../../programmes/hooks/useProgrammes';
import { useClients } from '../../clients/hooks/useClients';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';
import MapLinkField from '../../../shared/components/MapLinkField';
import PriceTierEditor from '../../../shared/components/forms/PriceTierEditor';
import { nearestSurfaceRow, type SurfacePriceMatrix } from '../../../shared/components/forms/SurfacePriceMatrixEditor';
import { formatPersonName } from '../../../shared/utils/format';
import { Save, Paperclip } from 'lucide-react';

const schema = z.object({
  lotissementId: z.coerce.number().int().positive('Lotissement requis'),
  programmeId: z.coerce.number().int().positive().optional().or(z.literal('')),
  clientId: z.coerce.number().int().positive().optional().or(z.literal('')),
  numeroIlot: z.string().optional(),
  numeroParcelle: z.string().optional(),
  statut: z.enum(['DISPONIBLE', 'RESERVE', 'VENDU', 'SOUS_OPTION']),
  surface: z.coerce.number().positive().optional().or(z.literal('')),
  prixVente: z.coerce.number().positive().optional().or(z.literal('')),
  viabilise: z.boolean(),
  numeroADU: z.string().optional(),
  numeroAttestationAttribution: z.string().optional(),
  numeroAttestationCession: z.string().optional(),
  numeroDM: z.string().optional(),
  titreFoncier: z.string().optional(),
  numeroACD: z.string().optional(),
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
  description: z.string().optional(),
  // Frais de démarches ACD (option client).
  acdDemarchesEnabled: z.boolean().optional(),
  acdDemarchesAmount: z.coerce.number().nonnegative().optional().or(z.literal('')),
  acdDemarchesStartDate: z.string().optional(),
  acdDemarchesInstallmentCount: z.coerce.number().int().positive().optional().or(z.literal('')),
}).superRefine((d, ctx) => {
  // Règle métier : un terrain en RESERVE / VENDU / SOUS_OPTION doit avoir un attributaire.
  if (['RESERVE', 'VENDU', 'SOUS_OPTION'].includes(d.statut) && (d.clientId === '' || d.clientId == null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['clientId'],
      message: 'Un attributaire est requis pour ce statut (Réservé, Vendu, Sous option).',
    });
  }
  // Règle métier : si l'option ACD est activée, le montant, la date de début
  // et le nombre d'échéances sont obligatoires (et un attributaire doit exister).
  if (d.acdDemarchesEnabled) {
    if (d.acdDemarchesAmount === '' || d.acdDemarchesAmount == null || Number(d.acdDemarchesAmount) <= 0) {
      ctx.addIssue({ code: 'custom', path: ['acdDemarchesAmount'], message: 'Montant requis.' });
    }
    if (!d.acdDemarchesStartDate) {
      ctx.addIssue({ code: 'custom', path: ['acdDemarchesStartDate'], message: 'Date de début requise.' });
    }
    if (d.acdDemarchesInstallmentCount === '' || d.acdDemarchesInstallmentCount == null || Number(d.acdDemarchesInstallmentCount) < 1) {
      ctx.addIssue({ code: 'custom', path: ['acdDemarchesInstallmentCount'], message: 'Nombre d\'échéances ≥ 1 requis.' });
    }
    if (d.clientId === '' || d.clientId == null) {
      ctx.addIssue({ code: 'custom', path: ['clientId'], message: "Un attributaire est requis pour activer les frais de démarches ACD." });
    }
    // Un terrain DISPONIBLE n'a pas d'attributaire — l'option ACD est donc
    // incompatible : le backend forcerait `clientId` à null sur ce statut,
    // créant un état incohérent (ACD activé sans client). On exige un statut
    // engagé (Réservé / Vendu / Sous option).
    if (d.statut === 'DISPONIBLE') {
      ctx.addIssue({
        code: 'custom',
        path: ['statut'],
        message: 'Sélectionnez un statut Réservé / Vendu / Sous option : un terrain « Disponible » ne peut pas porter l\'option ACD.',
      });
    }
  }
});

type FormData = z.infer<typeof schema>;

const STATUT_OPTIONS = [
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'RESERVE', label: 'Réservé' },
  { value: 'SOUS_OPTION', label: 'Sous option' },
  { value: 'VENDU', label: 'Vendu' },
];

type ScanKey = 'adu' | 'attribution' | 'cession' | 'dm' | 'tf' | 'acd' | 'compulsoires' | 'dossier_technique';

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FilePicker({ onChange, existingName }: { onChange: (f: File | null) => void; existingName?: string }) {
  const [name, setName] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setName(f?.name ?? null);
          onChange(f);
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full text-left px-3 py-2 border border-dashed border-slate-300 rounded-md text-sm text-slate-600 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center gap-2"
      >
        <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="truncate">{name ?? (existingName ? existingName : 'Joindre le fichier scanné…')}</span>
      </button>
      {existingName && !name && (
        <p className="text-xs text-emerald-600 mt-1 truncate flex items-center gap-1">
          <span>✓</span> <span className="truncate">{existingName}</span>
        </p>
      )}
    </div>
  );
}

export default function TerrainFormPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;

  const { data: res } = useTerrain(isEdit ? Number(id) : 0);
  const create = useCreateTerrain();
  const update = useUpdateTerrain();
  const { data: lotsRes } = useLotissements({}, 1, 200);
  const { data: clientsRes } = useClients({}, 1, 200);
  const { data: programmesRes } = useProgrammes({}, 1, 200);

  const [scanFiles, setScanFiles] = useState<Partial<Record<ScanKey, File>>>({});
  const [existingDocs, setExistingDocs] = useState<Record<string, any>>({});
  // Grille de prix par modalité, surcharge de celle du lotissement (objet { modalite: montant }).
  const [priceTiers, setPriceTiers] = useState<Record<string, number | ''>>({});
  // Case à cocher (non persistée) : recopier la localisation GPS du lotissement.
  // Tant qu'elle est active, les champs lat/long sont verrouillés et suivent le
  // lotissement courant (utile pour les terrains qui partagent l'emplacement
  // général du lotissement, ex. lotissement compact ou GPS approximative).
  const [gpsSameAsLot, setGpsSameAsLot] = useState(false);
  const initialGpsMatchRef = useRef(false);

  useEffect(() => {
    if (isEdit && Number(id)) {
      window.electron.documents.getByTerrain(token, Number(id)).then((r: any) => {
        if (r.success) {
          const byCategory: Record<string, any> = {};
          for (const doc of r.data) byCategory[doc.category] = doc;
          setExistingDocs(byCategory);
        }
      });
    }
  }, [isEdit, id, token]);

  const lotOptions = [
    { value: '', label: '— Sélectionner un lotissement —' },
    ...(lotsRes?.data ?? []).map((l: any) => ({ value: String(l.id), label: `${l.reference} — ${l.nom} (${l.ville})` })),
  ];
  const clientOptions = [
    { value: '', label: '— Aucun attributaire —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: formatPersonName(c),
    })),
  ];

  const programmeOptions = [
    { value: '', label: '— Aucun programme —' },
    ...(programmesRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.nom}`,
    })),
  ];

  const defaultLotissementId = searchParams.get('lotissementId') ?? '';
  const defaultProgrammeId = searchParams.get('programmeId') ?? '';

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors, isSubmitting } } = useForm<
    z.input<typeof schema>,
    any,
    FormData
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      statut: 'DISPONIBLE',
      viabilise: false,
      lotissementId: defaultLotissementId ? Number(defaultLotissementId) : ('' as any),
      programmeId: defaultProgrammeId ? Number(defaultProgrammeId) : ('' as any),
    },
  });

  // Un terrain DISPONIBLE n'a en principe pas d'attributaire. Exception : si
  // l'option ACD est activée, un attributaire est obligatoire (c'est le client
  // qui confie les démarches), on doit donc afficher le champ même en statut
  // DISPONIBLE — sinon l'utilisateur ne peut pas le renseigner et la
  // validation `superRefine` échoue silencieusement sur un champ invisible.
  const watchStatut = watch('statut');
  const watchAcdEnabled = watch('acdDemarchesEnabled');
  const showAttributaire = watchStatut !== 'DISPONIBLE' || !!watchAcdEnabled;
  useEffect(() => {
    if (!showAttributaire) {
      setValue('clientId', '' as any, { shouldValidate: false });
    }
  }, [showAttributaire, setValue]);

  // Pré-remplissage du montant des frais de démarches ACD à partir du
  // lotissement sélectionné : la source officielle est `fraisDemarchesAcdStandard`
  // du lotissement, le champ reste éditable pour ajustement local.
  //   - À l'activation de l'option ACD (ou si le montant est vide / 0), on
  //     applique le standard du lotissement courant.
  //   - Si l'utilisateur change de lotissement, on ré-applique le standard du
  //     nouveau lotissement (l'éventuel ajustement précédent est écrasé).
  //   - En édition d'un terrain existant, le `reset()` initial pose le montant
  //     enregistré ; on le préserve tant que le lotissement ne change pas
  //     (premier run de l'effet, où `prevLotIdRef.current === undefined`).
  const watchAcdAmount = watch('acdDemarchesAmount');
  const watchLotissementId = watch('lotissementId');
  const prevLotIdRef = useRef<number | null | undefined>(undefined);
  const selectedLot = (lotsRes?.data ?? []).find((l: any) => Number(l.id) === Number(watchLotissementId));
  const acdStandard = (() => {
    const std = selectedLot?.fraisDemarchesAcdStandard;
    return std != null && Number(std) > 0 ? Number(std) : null;
  })();
  const lotHasGps =
    selectedLot?.latitude != null &&
    selectedLot?.longitude != null &&
    Number.isFinite(Number(selectedLot.latitude)) &&
    Number.isFinite(Number(selectedLot.longitude));
  useEffect(() => {
    const lotId = Number(watchLotissementId) || null;
    const prevLotId = prevLotIdRef.current;
    prevLotIdRef.current = lotId;
    if (!watchAcdEnabled) return;
    if (acdStandard == null) return;
    const amountEmpty = watchAcdAmount === '' || watchAcdAmount == null || Number(watchAcdAmount) === 0;
    const lotChangedByUser = prevLotId !== undefined && prevLotId !== null && prevLotId !== lotId;
    if (amountEmpty || lotChangedByUser) {
      setValue('acdDemarchesAmount', acdStandard as any, { shouldValidate: false });
    }
  }, [watchAcdEnabled, watchLotissementId, acdStandard, watchAcdAmount, setValue]);

  // Tant que la case « identique au lotissement » est cochée, on aligne les
  // coordonnées du terrain sur celles du lotissement sélectionné. Si l'utilisateur
  // change de lotissement, on ré-applique automatiquement les nouvelles coords.
  // Si le nouveau lotissement n'a pas de GPS, on décoche la case pour éviter
  // d'afficher des champs verrouillés sans source de vérité.
  useEffect(() => {
    if (!gpsSameAsLot) return;
    if (!lotHasGps) {
      setGpsSameAsLot(false);
      return;
    }
    setValue('latitude', String(selectedLot.latitude), { shouldValidate: true });
    setValue('longitude', String(selectedLot.longitude), { shouldValidate: true });
  }, [gpsSameAsLot, lotHasGps, watchLotissementId, selectedLot, setValue]);

  // À l'édition d'un terrain existant, pré-cocher la case si les coords du
  // terrain correspondent exactement à celles de son lotissement — évite que
  // l'utilisateur découvre une case « décochée » alors qu'il avait sauvegardé
  // l'alignement précédemment. N'est exécuté qu'une fois, dès que terrain et
  // lotissement sont chargés.
  useEffect(() => {
    if (!isEdit || initialGpsMatchRef.current) return;
    const t = res?.data;
    if (!t || !selectedLot) return;
    initialGpsMatchRef.current = true;
    if (
      t.latitude != null && t.longitude != null &&
      selectedLot.latitude != null && selectedLot.longitude != null &&
      Number(t.latitude) === Number(selectedLot.latitude) &&
      Number(t.longitude) === Number(selectedLot.longitude)
    ) {
      setGpsSameAsLot(true);
    }
  }, [isEdit, res, selectedLot]);

  useEffect(() => {
    if (isEdit && res?.data) {
      const t = res.data;
      // Coercion des null Prisma en '' pour les champs `z.string().optional()` :
      // Zod n'accepte pas null sur un string optional, sinon handleSubmit échoue
      // silencieusement et RHF focus le premier champ "invalide".
      reset({
        ...t,
        clientId: t.clientId ?? ('' as any),
        programmeId: t.programmeId ?? ('' as any),
        surface: t.surface ?? ('' as any),
        prixVente: t.prixVente ?? ('' as any),
        latitude: t.latitude != null ? String(t.latitude) : '',
        longitude: t.longitude != null ? String(t.longitude) : '',
        numeroIlot: t.numeroIlot ?? '',
        numeroParcelle: t.numeroParcelle ?? '',
        numeroADU: t.numeroADU ?? '',
        numeroAttestationAttribution: t.numeroAttestationAttribution ?? '',
        numeroAttestationCession: t.numeroAttestationCession ?? '',
        numeroDM: t.numeroDM ?? '',
        titreFoncier: t.titreFoncier ?? '',
        numeroACD: t.numeroACD ?? '',
        description: t.description ?? '',
        acdDemarchesEnabled: !!t.acdDemarchesEnabled,
        acdDemarchesAmount: t.acdDemarchesAmount ?? ('' as any),
        // L'<input type="date"> attend une chaîne ISO YYYY-MM-DD.
        acdDemarchesStartDate: t.acdDemarchesStartDate
          ? new Date(t.acdDemarchesStartDate).toISOString().slice(0, 10)
          : '',
        acdDemarchesInstallmentCount: t.acdDemarchesInstallmentCount ?? ('' as any),
      });
      setPriceTiers((t.salePriceTiers as Record<string, number>) ?? {});
    }
  }, [res, isEdit, reset]);

  // Grille héritée : ligne du lotissement de la tranche de superficie la plus
  // proche de celle du terrain (matrice indexée par superficie puis modalité).
  const watchSurface = watch('surface');
  const inheritedTiers = nearestSurfaceRow(
    selectedLot?.salePriceTiers as SurfacePriceMatrix | undefined,
    watchSurface as string | number,
  ) as Record<string, number> | null;

  const uploadScans = async (terrainId: number) => {
    const entries: Array<[ScanKey, string]> = [
      ['adu', 'adu_scan'],
      ['attribution', 'attribution_scan'],
      ['cession', 'cession_scan'],
      ['dm', 'dm_scan'],
      ['tf', 'tf_scan'],
      ['acd', 'acd_scan'],
      ['compulsoires', 'compulsoires_scan'],
      ['dossier_technique', 'dossier_technique_scan'],
    ];
    for (const [key, category] of entries) {
      const file = scanFiles[key];
      if (!file) continue;
      try {
        const fileData = await toBase64(file);
        const r = await window.electron.documents.uploadTerrainDoc(token, terrainId, category, {
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          fileData,
        });
        if (!r.success) toast.error(`Erreur upload ${key.toUpperCase()}: ${r.error}`);
      } catch {
        toast.error(`Échec de l'upload du fichier ${key.toUpperCase()}`);
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    const payload: any = {
      ...data,
      clientId: data.clientId === '' ? null : data.clientId,
      programmeId: data.programmeId === '' ? null : data.programmeId,
      surface: data.surface === '' ? null : data.surface,
      prixVente: data.prixVente === '' ? null : data.prixVente,
      latitude: data.latitude ? Number(data.latitude) : null,
      longitude: data.longitude ? Number(data.longitude) : null,
      acdDemarchesEnabled: !!data.acdDemarchesEnabled,
      acdDemarchesAmount: data.acdDemarchesAmount === '' ? null : data.acdDemarchesAmount,
      acdDemarchesStartDate: data.acdDemarchesStartDate ? new Date(data.acdDemarchesStartDate).toISOString() : null,
      acdDemarchesInstallmentCount: data.acdDemarchesInstallmentCount === '' ? null : data.acdDemarchesInstallmentCount,
      // Grille de prix (surcharge du lotissement) : objet { modalite: montant } ; {} pour vider.
      salePriceTiers: priceTiers as Record<string, number>,
    };
    let r: any;
    if (isEdit) r = await update.mutateAsync({ id: Number(id), payload });
    else r = await create.mutateAsync(payload);
    if (!r.success) return;

    const terrainId = isEdit ? Number(id) : r.data.id;
    await uploadScans(terrainId);
    navigate('/terrains');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le terrain' : 'Nouveau terrain'}
      breadcrumbs={[{ label: 'Terrains', to: '/terrains' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <Card className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Rattachement */}
          <div className="grid grid-cols-2 gap-4">
            <FormSearchSelect
              control={control}
              name="lotissementId"
              label="Lotissement *"
              options={lotOptions}
              error={errors.lotissementId?.message}
            />
            <FormSearchSelect
              control={control}
              name="programmeId"
              label="Programme immobilier"
              options={programmeOptions}
            />
          </div>

          {/* Identification de la parcelle */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Identification de la parcelle</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Numéro d'îlot" placeholder="Ex: 03" {...register('numeroIlot')} />
              <Input label="Numéro de lot / parcelle" placeholder="Ex: 12" {...register('numeroParcelle')} />
            </div>
          </div>

          {/* Caractéristiques */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Caractéristiques</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Surface (m²)" type="number" step="0.01" {...register('surface')} />
              <Input label="Prix de vente (FCFA)" type="number" step="1" {...register('prixVente')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Statut"
                options={STATUT_OPTIONS}
                error={(errors as any).statut?.message}
                {...register('statut')}
              />
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded" {...register('viabilise')} />
                  <span className="text-sm font-medium text-slate-700">Terrain viabilisé</span>
                </label>
              </div>
            </div>
            {/* Attributaire — affiché uniquement si statut ≠ DISPONIBLE */}
            {showAttributaire && (
              <FormSearchSelect
                control={control}
                name="clientId"
                label="Attributaire (obligatoire pour Réservé / Vendu / Sous option)"
                options={clientOptions}
                error={errors.clientId?.message}
              />
            )}
          </div>

          {/* Grille de prix de vente par échéance (surcharge le lotissement) */}
          <div className="border-t border-slate-200 pt-4">
            <PriceTierEditor
              value={priceTiers}
              onChange={setPriceTiers}
              inherited={inheritedTiers}
              description={
                inheritedTiers
                  ? 'Prix hérités du lotissement pour cette superficie (affichés en gris). Laisser vide pour hériter, ou saisir pour surcharger ce terrain.'
                  : 'Aucun prix défini dans le lotissement pour cette superficie — saisissez les prix par échéance pour ce terrain.'
              }
            />
          </div>

          {/* Frais de démarches ACD */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Frais de démarches ACD</h3>
            <p className="text-xs text-slate-500">
              Cocher cette option si le client confie les démarches ACD à l'entreprise. Ces frais sont
              indépendants du prix du terrain et des frais de dossier. La génération des factures se fait
              ensuite depuis la fiche du terrain.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded" {...register('acdDemarchesEnabled')} />
              <span className="text-sm font-medium text-slate-700">
                Le client confie les démarches ACD à l'entreprise
              </span>
            </label>
            {watchAcdEnabled && (
              <div className="grid grid-cols-3 gap-4 pl-6">
                <Input
                  label="Montant (FCFA)"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Pré-rempli depuis le lotissement"
                  helper={
                    acdStandard != null
                      ? `Standard du lotissement : ${acdStandard.toLocaleString('fr-FR')} FCFA — modifiable`
                      : 'Aucun standard défini sur le lotissement — saisissez le montant'
                  }
                  error={(errors as any).acdDemarchesAmount?.message}
                  {...register('acdDemarchesAmount')}
                />
                <Input
                  label="Date de début"
                  type="date"
                  error={(errors as any).acdDemarchesStartDate?.message}
                  {...register('acdDemarchesStartDate')}
                />
                <Input
                  label="Nombre d'échéances"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="1 = comptant"
                  helper="1 pour un paiement comptant, N pour un échelonnement mensuel"
                  error={(errors as any).acdDemarchesInstallmentCount?.message}
                  {...register('acdDemarchesInstallmentCount')}
                />
              </div>
            )}
          </div>

          {/* Localisation GPS */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Localisation GPS</h3>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded mt-0.5"
                checked={gpsSameAsLot}
                disabled={!lotHasGps}
                onChange={(e) => setGpsSameAsLot(e.target.checked)}
              />
              <span className="text-sm text-slate-700">
                Identique à la localisation du lotissement
                {!lotHasGps && (
                  <span className="block text-xs text-slate-400 italic">
                    Le lotissement sélectionné n'a pas de coordonnées GPS — renseignez-les sur la fiche du lotissement pour activer cette option.
                  </span>
                )}
              </span>
            </label>

            {!gpsSameAsLot && (
              <MapLinkField
                token={token}
                onResolved={(la, lo) => {
                  setValue('latitude', String(la), { shouldValidate: true });
                  setValue('longitude', String(lo), { shouldValidate: true });
                }}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Latitude"
                type="number"
                step="any"
                placeholder="Ex: 5.345678"
                helper={
                  gpsSameAsLot
                    ? 'Recopiée depuis le lotissement — décochez la case pour modifier'
                    : 'Coordonnée GPS — visible sur la carte de la fiche'
                }
                error={errors.latitude?.message}
                readOnly={gpsSameAsLot}
                {...register('latitude')}
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                placeholder="Ex: -4.024429"
                helper={
                  gpsSameAsLot
                    ? 'Recopiée depuis le lotissement — décochez la case pour modifier'
                    : 'Coordonnée GPS — visible sur la carte de la fiche'
                }
                error={errors.longitude?.message}
                readOnly={gpsSameAsLot}
                {...register('longitude')}
              />
            </div>
          </div>

          {/* Documents officiels */}
          <div className="border-t border-slate-200 pt-4 space-y-6">
            <h3 className="text-sm font-semibold text-slate-700">Documents officiels</h3>

            {/* Ligne 1 — ADU | Attestation d'attribution | Attestation de cession */}
            <div className="grid grid-cols-3 gap-4">

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">ADU</p>
                <Input label="Numéro ADU" placeholder="Ex: ADU-2024-001" {...register('numeroADU')} />
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Fichier scanné ADU</p>
                  <FilePicker
                    onChange={(f) => setScanFiles((p) => ({ ...p, adu: f ?? undefined }))}
                    existingName={existingDocs['adu_scan']?.name}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Attestation d'attribution</p>
                <Input label="Numéro Att. attribution" placeholder="Ex: ATT-2024-001" {...register('numeroAttestationAttribution')} />
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Fichier scanné attribution</p>
                  <FilePicker
                    onChange={(f) => setScanFiles((p) => ({ ...p, attribution: f ?? undefined }))}
                    existingName={existingDocs['attribution_scan']?.name}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Attestation de cession</p>
                <Input label="Numéro Att. cession" placeholder="Ex: CES-2024-001" {...register('numeroAttestationCession')} />
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Fichier scanné cession</p>
                  <FilePicker
                    onChange={(f) => setScanFiles((p) => ({ ...p, cession: f ?? undefined }))}
                    existingName={existingDocs['cession_scan']?.name}
                  />
                </div>
              </div>

            </div>

            {/* Ligne 2 — DM | Titre Foncier | ACD */}
            <div className="grid grid-cols-3 gap-4">

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">DM</p>
                <Input label="Numéro DM" placeholder="Ex: DM-2024-001" {...register('numeroDM')} />
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Fichier scanné BM/DM</p>
                  <FilePicker
                    onChange={(f) => setScanFiles((p) => ({ ...p, dm: f ?? undefined }))}
                    existingName={existingDocs['dm_scan']?.name}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Titre Foncier</p>
                <Input label="Numéro TF" placeholder="Ex: TF-xxxx" {...register('titreFoncier')} />
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Fichier scanné TF</p>
                  <FilePicker
                    onChange={(f) => setScanFiles((p) => ({ ...p, tf: f ?? undefined }))}
                    existingName={existingDocs['tf_scan']?.name}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">ACD</p>
                <Input label="Numéro ACD" placeholder="Ex: ACD-2024-001" {...register('numeroACD')} />
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Fichier scanné ACD</p>
                  <FilePicker
                    onChange={(f) => setScanFiles((p) => ({ ...p, acd: f ?? undefined }))}
                    existingName={existingDocs['acd_scan']?.name}
                  />
                </div>
              </div>

            </div>

            {/* Ligne 3 — Compulsoires d'Huissier | Dossier Technique */}
            <div className="grid grid-cols-2 gap-4">

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Compulsoires d'Huissier</p>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Fichier scanné compulsoires</p>
                  <FilePicker
                    onChange={(f) => setScanFiles((p) => ({ ...p, compulsoires: f ?? undefined }))}
                    existingName={existingDocs['compulsoires_scan']?.name}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dossier Technique</p>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Fichier scanné dossier technique</p>
                  <FilePicker
                    onChange={(f) => setScanFiles((p) => ({ ...p, dossier_technique: f ?? undefined }))}
                    existingName={existingDocs['dossier_technique_scan']?.name}
                  />
                </div>
              </div>

            </div>
          </div>


          <Textarea label="Description / Notes" rows={3} {...register('description')} />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/terrains')}>Annuler</Button>
            <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
