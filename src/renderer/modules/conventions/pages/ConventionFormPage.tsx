import { useNavigate, useParams } from 'react-router-dom';
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
import { useConvention, useConventions, useCreateConvention, useUpdateConvention } from '../hooks/useConventions';
import { useClients } from '../../clients/hooks/useClients';
import { useProperties } from '../../properties/hooks/useProperties';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { Save } from 'lucide-react';

/** Identifiant optionnel : une chaîne vide est traitée comme « non renseigné ». */
const optionalId = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
  z.number().int().positive().optional(),
);

/** Nombre optionnel : une chaîne vide est traitée comme « non renseigné » (et non comme 0). */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
  z.number().optional(),
);
/** Jour du mois optionnel (1-31). */
const optionalDay = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
  z.number().int().min(1).max(31).optional(),
);

const schema = z.object({
  assetType: z.enum(['PROPERTY', 'TERRAIN']).default('TERRAIN'),
  propertyId: optionalId,
  terrainId: optionalId,
  clientId: z.coerce.number().int().positive('Client principal requis'),
  secondaryClientId: optionalId,
  parentConventionId: optionalId,
  amendmentType: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.enum(['PROLONGATION_DELAI', 'TRANSFERT_PROPRIETE', 'TRANSFERT_SITE']).optional(),
  ),
  type: z.enum(['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION']),
  status: z.enum(['BROUILLON', 'ACTIVE', 'EXPIRE', 'TERMINER', 'ANNULE', 'ATTENTE_SIGNATURE']).default('BROUILLON'),
  startDate: z.string().min(1, 'Date de début requise'),
  endDate: z.string().optional(),
  signedAt: z.string().optional(),
  rentAmount: optionalNumber,
  saleAmount: optionalNumber,
  apportInitial: optionalNumber,
  deposit: optionalNumber,
  agencyFees: optionalNumber,
  charges: optionalNumber,
  paymentDay: optionalDay,
  paymentMethod: z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'NON_DEFINI']).default('ESPECE'),
  paymentModalites: z.enum(['CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS', 'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS']).default('CASH'),
  installmentCount: optionalNumber,
  firstInstallmentDate: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.assetType === 'PROPERTY' && !d.propertyId) {
    ctx.addIssue({ code: 'custom', path: ['propertyId'], message: 'Bien immobilier requis' });
  }
  if (d.assetType === 'TERRAIN' && !d.terrainId) {
    ctx.addIssue({ code: 'custom', path: ['terrainId'], message: 'Terrain requis' });
  }
  if (d.secondaryClientId && d.secondaryClientId === d.clientId) {
    ctx.addIssue({
      code: 'custom',
      path: ['secondaryClientId'],
      message: 'Le souscripteur associé doit être différent du client principal',
    });
  }
  if ((d.type === 'AVENANT' || d.type === 'RESILIATION') && !d.parentConventionId) {
    ctx.addIssue({
      code: 'custom',
      path: ['parentConventionId'],
      message: 'Sélectionnez la convention initiale / précédente',
    });
  }
  if (d.type === 'AVENANT' && !d.amendmentType) {
    ctx.addIssue({
      code: 'custom',
      path: ['amendmentType'],
      message: 'Précisez la nature de l\'avenant',
    });
  }
});

type FormData = z.infer<typeof schema>;

const ASSET_TYPE_OPTIONS = [
  { value: 'PROPERTY', label: 'Un bien immobilier' },
  { value: 'TERRAIN', label: 'Un terrain' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'RENTAL_UNFURNISHED', label: 'Location non meublée' },
  { value: 'RENTAL_FURNISHED', label: 'Location meublée' },
  { value: 'SALE', label: 'Vente' },
  { value: 'MANAGEMENT', label: 'Gestion' },
  { value: 'COMMERCIAL_LEASE', label: 'Bail commercial' },
];

const TERRAIN_TYPE_OPTIONS = [
  { value: 'SOUSCRIPTION', label: 'Souscription' },
  { value: 'SALE', label: 'Vente' },
  { value: 'AVENANT', label: 'Avenant' },
  { value: 'RESILIATION', label: 'Résiliation' },
];

/** Types de convention de terrain nécessitant un terrain encore disponible. */
const TERRAIN_AVAILABLE_TYPES = ['SOUSCRIPTION', 'SALE'];

/** Types de convention liés à une convention initiale/précédente. */
const AMENDMENT_TYPES = ['AVENANT', 'RESILIATION'];

const AMENDMENT_NATURE_OPTIONS = [
  { value: '', label: '— Choisir la nature —' },
  { value: 'PROLONGATION_DELAI', label: 'Avenant de prolongation de délai' },
  { value: 'TRANSFERT_PROPRIETE', label: 'Avenant de transfert de propriété' },
  { value: 'TRANSFERT_SITE', label: 'Avenant de transfert de site / changement de lot' },
];

const TYPE_LABELS: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Location non meublée', RENTAL_FURNISHED: 'Location meublée',
  SALE: 'Vente', MANAGEMENT: 'Gestion', COMMERCIAL_LEASE: 'Bail commercial',
  SOUSCRIPTION: 'Souscription', AVENANT: 'Avenant', RESILIATION: 'Résiliation',
};

const STATUS_OPTIONS = [
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ATTENTE_SIGNATURE', label: 'Attente signature' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRE', label: 'Expirée' },
  { value: 'TERMINER', label: 'Terminée' },
  { value: 'ANNULE', label: 'Annulée' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'NON_DEFINI', label: 'Non défini' },
];

const PAYMENT_MODALITES_OPTIONS = [
  { value: 'CASH', label: 'Paiement comptant' },
  { value: 'SUR_3_MOIS', label: '3 mois' },
  { value: 'SUR_6_MOIS', label: '6 mois' },
  { value: 'SUR_9_MOIS', label: '9 mois' },
  { value: 'SUR_12_MOIS', label: '12 mois' },
  { value: 'SUR_24_MOIS', label: '24 mois' },
  { value: 'SUR_36_MOIS', label: '36 mois' },
  { value: 'SUR_48_MOIS', label: '48 mois' },
  { value: 'SUR_60_MOIS', label: '60 mois' },
  { value: 'SUR_PLUS_60_MOIS', label: '+ de 60 mois (libre)' },
];

const DURATION_OPTIONS = [
  { value: '', label: '— Personnalisé (saisir la date) —' },
  { value: '1', label: '1 mois' },
  { value: '3', label: '3 mois' },
  { value: '6', label: '6 mois' },
  { value: '9', label: '9 mois' },
  { value: '12', label: '12 mois (1 an)' },
  { value: '18', label: '18 mois' },
  { value: '24', label: '24 mois (2 ans)' },
  { value: '36', label: '36 mois (3 ans)' },
  { value: '48', label: '48 mois (4 ans)' },
  { value: '60', label: '60 mois (5 ans)' },
];

function toDateInput(val?: string | Date | null): string {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Ajoute un nombre de mois à une date ISO (yyyy-MM-dd). */
function addMonthsToDate(dateStr: string, months: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  return r.toISOString().slice(0, 10);
}

/** Déduit le délai en mois si l'écart entre deux dates est un nombre de mois exact. */
function monthsBetween(startVal?: string | Date | null, endVal?: string | Date | null): number | null {
  if (!startVal || !endVal) return null;
  const s = new Date(startVal);
  const e = new Date(endVal);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  return months > 0 && e.getUTCDate() === s.getUTCDate() ? months : null;
}

/** Nombre d'échéances par modalité de paiement. */
const INSTALLMENT_COUNTS: Record<string, number> = {
  SUR_3_MOIS: 3, SUR_6_MOIS: 6, SUR_9_MOIS: 9, SUR_12_MOIS: 12,
  SUR_24_MOIS: 24, SUR_36_MOIS: 36, SUR_48_MOIS: 48, SUR_60_MOIS: 60,
};

/** Génère les dates d'échéance : le 5 de chaque mois à partir de la date donnée. */
function fifthOfMonthDates(fromDateStr: string, count: number): string[] {
  let d = new Date(fromDateStr);
  if (!fromDateStr || isNaN(d.getTime())) d = new Date();
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth();
  if (d.getUTCDate() > 5) month += 1;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(Date.UTC(year, month + i, 5)).toISOString().slice(0, 10));
  }
  return out;
}

/** Construit l'échéancier par défaut : montants égaux, dernière échéance ajustée à l'arrondi. */
function buildInstallments(
  count: number, total: number, apport: number, fromDateStr: string,
): { dueDate: string; amount: string }[] {
  if (count <= 0) return [];
  const financed = Math.max(0, Math.round((total || 0) - (apport || 0)));
  const per = Math.floor(financed / count);
  const dates = fifthOfMonthDates(fromDateStr, count);
  const rows: { dueDate: string; amount: string }[] = [];
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? financed - per * (count - 1) : per;
    rows.push({ dueDate: dates[i], amount: String(amount) });
  }
  return rows;
}

export default function ConventionFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useConvention(isEdit ? Number(id) : 0);
  const create = useCreateConvention();
  const update = useUpdateConvention();
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: propertiesRes } = useProperties({}, 1, 500);
  const { data: terrainsRes } = useTerrains({}, 1, 500);
  const { data: conventionsRes } = useConventions({}, 1, 500);
  const [isSale, setIsSale] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [durationMonths, setDurationMonths] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [installmentRows, setInstallmentRows] = useState<{ dueDate: string; amount: string }[]>([]);
  const skipInstallmentGenRef = useRef(false);

  const clientOptions = [
    { value: '', label: '— Choisir un client —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: c.type === 'INDIVIDUEL'
        ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
        : (c.entreprise ?? ''),
    })),
  ];

  const propertyOptions = [
    { value: '', label: '— Choisir un bien —' },
    ...(propertiesRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.address}, ${p.city}`,
    })),
  ];

  const secondaryClientOptions = [
    { value: '', label: '— Aucun (facultatif) —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: c.type === 'INDIVIDUEL'
        ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
        : (c.entreprise ?? ''),
    })),
  ];

  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { assetType: 'TERRAIN', type: 'SOUSCRIPTION', status: 'BROUILLON', paymentMethod: 'ESPECE', paymentModalites: 'CASH' },
  });

  const watchType = watch('type');
  const watchModalites = watch('paymentModalites');
  const watchAssetType = watch('assetType');
  const watchStartDate = watch('startDate');
  const watchTerrainId = watch('terrainId');
  const watchInstallmentCount = watch('installmentCount');
  const watchSignedAt = watch('signedAt');
  const watchSaleAmount = watch('saleAmount');
  const watchApport = watch('apportInitial');

  const installmentCount = watchModalites === 'SUR_PLUS_60_MOIS'
    ? (Number(watchInstallmentCount) || 0)
    : (INSTALLMENT_COUNTS[watchModalites ?? ''] ?? 0);
  const installmentsTotal = installmentRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const recomputeInstallments = () => {
    setInstallmentRows(buildInstallments(
      installmentCount,
      Number(watchSaleAmount) || 0,
      Number(watchApport) || 0,
      watchSignedAt || watchStartDate,
    ));
  };

  const updateInstallmentRow = (idx: number, field: 'dueDate' | 'amount', value: string) => {
    setInstallmentRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const typeOptions = watchAssetType === 'TERRAIN' ? TERRAIN_TYPE_OPTIONS : PROPERTY_TYPE_OPTIONS;

  // Terrains proposés selon le type de convention : disponibles pour Souscription/Vente,
  // déjà engagés (réservé/vendu/sous-option) pour Avenant/Résiliation.
  const terrainStatutFilter = TERRAIN_AVAILABLE_TYPES.includes(watchType)
    ? ['DISPONIBLE']
    : ['RESERVE', 'VENDU', 'SOUS_OPTION'];
  const editingTerrain: any = isEdit ? res?.data?.terrain : null;
  const filteredTerrains = (terrainsRes?.data ?? []).filter(
    (t: any) => terrainStatutFilter.includes(t.statut),
  );
  // Conserve le terrain déjà rattaché même s'il ne correspond plus au filtre courant.
  if (editingTerrain && !filteredTerrains.some((t: any) => t.id === editingTerrain.id)) {
    filteredTerrains.unshift(editingTerrain);
  }
  const terrainOptions = [
    { value: '', label: '— Choisir un terrain —' },
    ...filteredTerrains.map((t: any) => {
      const loc = [
        t.numeroIlot ? `Îlot ${t.numeroIlot}` : '',
        t.numeroParcelle ? `Lot ${t.numeroParcelle}` : '',
      ].filter(Boolean).join(', ');
      return {
        value: String(t.id),
        label: `${t.reference} — ${t.lotissement?.nom ?? ''}`.trim() + (loc ? ` (${loc})` : ''),
      };
    }),
  ];

  // Avenant / résiliation : convention initiale ou précédente, parmi les conventions du même terrain.
  const isAmendment = AMENDMENT_TYPES.includes(watchType);
  const parentConventionOptions = [
    { value: '', label: '— Choisir la convention —' },
    ...(conventionsRes?.data ?? [])
      .filter((co: any) =>
        co.id !== Number(id)
        && co.terrainId != null
        && String(co.terrainId) === String(watchTerrainId))
      .map((co: any) => {
        const cn = co.client?.type === 'INDIVIDUEL'
          ? `${co.client?.firstName ?? ''} ${co.client?.lastName ?? ''}`.trim()
          : (co.client?.entreprise ?? '');
        return {
          value: String(co.id),
          label: `${co.reference} — ${TYPE_LABELS[co.type] ?? co.type}${cn ? ` — ${cn}` : ''}`,
        };
      }),
  ];

  useEffect(() => {
    // Une convention sur terrain est toujours « orientée vente » (prix, modalités, échéances).
    setIsSale(watchAssetType === 'TERRAIN' || watchType === 'SALE');
  }, [watchType, watchAssetType]);

  // Réaligne le type de convention lorsque le rattachement (bien / terrain) change.
  useEffect(() => {
    const valid = watchAssetType === 'TERRAIN' ? TERRAIN_TYPE_OPTIONS : PROPERTY_TYPE_OPTIONS;
    if (!valid.some((o) => o.value === watchType)) {
      setValue('type', watchAssetType === 'TERRAIN' ? 'SOUSCRIPTION' : 'RENTAL_UNFURNISHED');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchAssetType]);

  useEffect(() => {
    setIsInstallment(watchModalites !== 'CASH');
  }, [watchModalites]);

  // Calcule la date de fin à partir de la date de début et du délai choisi.
  useEffect(() => {
    if (durationMonths && watchStartDate) {
      setValue('endDate', addMonthsToDate(watchStartDate, Number(durationMonths)));
    }
  }, [watchStartDate, durationMonths, setValue]);

  // Régénère l'échéancier par défaut quand le nombre d'échéances change.
  useEffect(() => {
    if (skipInstallmentGenRef.current) {
      skipInstallmentGenRef.current = false;
      return;
    }
    setInstallmentRows(
      installmentCount > 0
        ? buildInstallments(
            installmentCount,
            Number(watchSaleAmount) || 0,
            Number(watchApport) || 0,
            watchSignedAt || watchStartDate,
          )
        : [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installmentCount]);

  useEffect(() => {
    if (isEdit && res?.data) {
      const c = res.data;
      reset({
        ...c,
        assetType: c.assetType ?? 'PROPERTY',
        propertyId: c.propertyId ?? undefined,
        terrainId: c.terrainId ?? undefined,
        clientId: c.clientId,
        secondaryClientId: c.secondaryClientId ?? undefined,
        parentConventionId: c.parentConventionId ?? undefined,
        amendmentType: c.amendmentType ?? undefined,
        startDate: toDateInput(c.startDate),
        endDate: toDateInput(c.endDate),
        signedAt: toDateInput(c.signedAt),
        firstInstallmentDate: toDateInput(c.firstInstallmentDate),
        rentAmount: c.rentAmount ? Number(c.rentAmount) : undefined,
        saleAmount: c.saleAmount ? Number(c.saleAmount) : undefined,
        deposit: c.deposit ? Number(c.deposit) : undefined,
        agencyFees: c.agencyFees ? Number(c.agencyFees) : undefined,
        charges: c.charges ? Number(c.charges) : undefined,
      });
      // Pré-sélectionne le délai si la date de fin correspond à un nombre de mois exact
      const derived = monthsBetween(c.startDate, c.endDate);
      setDurationMonths(
        derived && DURATION_OPTIONS.some((o) => o.value === String(derived)) ? String(derived) : '',
      );
      // Charge l'échéancier existant
      if (c.installments && c.installments.length > 0) {
        skipInstallmentGenRef.current = true;
        setInstallmentRows(c.installments.map((inst: any) => ({
          dueDate: toDateInput(inst.dueDate),
          amount: String(Number(inst.amount)),
        })));
      }
    }
  }, [res, isEdit, reset]);

  const onInvalid = () => {
    setSubmitError('Certains champs obligatoires sont manquants ou invalides — vérifiez le formulaire.');
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
    const payload: any = { ...data };
    // N'envoie que les champs correspondant au type de rattachement choisi
    if (payload.assetType === 'TERRAIN') {
      delete payload.propertyId;
    } else {
      delete payload.terrainId;
      delete payload.secondaryClientId;
    }
    // La convention liée ne concerne que les avenants et résiliations
    if (!AMENDMENT_TYPES.includes(payload.type)) delete payload.parentConventionId;
    // La nature de l'avenant ne concerne que les avenants
    if (payload.type !== 'AVENANT') delete payload.amendmentType;
    // Échéancier : vente par échéances uniquement
    if (isSale && payload.paymentModalites !== 'CASH') {
      payload.installments = installmentRows
        .filter((r) => r.dueDate && r.amount !== '')
        .map((r) => ({ dueDate: new Date(r.dueDate).toISOString(), amount: Number(r.amount) }));
      payload.installmentCount = installmentCount;
      if (payload.installments.length > 0) {
        payload.firstInstallmentDate = payload.installments[0].dueDate;
      }
    } else {
      payload.installments = [];
      delete payload.apportInitial;
    }
    // Convertit les dates en ISO datetime
    if (payload.startDate) payload.startDate = new Date(payload.startDate).toISOString();
    if (payload.endDate) payload.endDate = new Date(payload.endDate).toISOString();
    else delete payload.endDate;
    if (payload.signedAt) payload.signedAt = new Date(payload.signedAt).toISOString();
    else delete payload.signedAt;
    if (payload.firstInstallmentDate) payload.firstInstallmentDate = new Date(payload.firstInstallmentDate).toISOString();
    else delete payload.firstInstallmentDate;

    const r = isEdit
      ? await update.mutateAsync({ id: Number(id), payload })
      : await create.mutateAsync(payload);
    if (r?.success) {
      navigate(`/conventions/${r.data?.id ?? ''}`);
    } else {
      setSubmitError(
        typeof r?.error === 'string'
          ? r.error
          : "L'enregistrement de la convention a échoué. Vérifiez les informations saisies.",
      );
    }
    } catch (e: any) {
      setSubmitError(e?.message ?? "Une erreur est survenue lors de l'enregistrement.");
    }
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier la convention' : 'Nouvelle convention'}
      breadcrumbs={[{ label: 'Conventions', to: '/conventions' }, { label: isEdit ? 'Modifier' : 'Nouvelle' }]}
    >
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6 max-w-3xl mx-auto">
        {/* Rattachement */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Rattachement de la convention</h3>
          <div className="space-y-4">
            <Select label="La convention porte sur *" options={ASSET_TYPE_OPTIONS} {...register('assetType')} />
            {watchAssetType === 'TERRAIN' ? (
              <FormSearchSelect
                control={control}
                name="terrainId"
                label="Terrain *"
                options={terrainOptions}
                error={errors.terrainId?.message}
                onValueChange={(v) => {
                  // Reprend le prix de vente saisi lors de la création du terrain
                  const t = filteredTerrains.find((x: any) => String(x.id) === v);
                  const price = Number(t?.prixVente);
                  if (Number.isFinite(price) && price > 0) {
                    setValue('saleAmount', price, { shouldValidate: true });
                  }
                }}
              />
            ) : (
              <FormSearchSelect
                control={control}
                name="propertyId"
                label="Bien immobilier *"
                options={propertyOptions}
                error={errors.propertyId?.message}
              />
            )}
            <FormSearchSelect
              control={control}
              name="clientId"
              label="Client principal *"
              options={clientOptions}
              error={errors.clientId?.message}
            />
            {watchAssetType === 'TERRAIN' && (
              <FormSearchSelect
                control={control}
                name="secondaryClientId"
                label="Souscripteur associé / successeur"
                options={secondaryClientOptions}
                error={errors.secondaryClientId?.message}
              />
            )}
          </div>
        </Card>

        {/* Type et statut */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Type de convention</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type *" options={typeOptions} error={errors.type?.message} {...register('type')} />
            <Select label="Statut" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          {watchType === 'AVENANT' && (
            <div className="mt-4">
              <Select
                label="Nature de l'avenant *"
                options={AMENDMENT_NATURE_OPTIONS}
                error={errors.amendmentType?.message}
                {...register('amendmentType')}
              />
            </div>
          )}
          {isAmendment && (
            <div className="mt-4">
              <FormSearchSelect
                control={control}
                name="parentConventionId"
                label={watchType === 'RESILIATION' ? 'Convention à résilier *' : 'Convention initiale / précédente *'}
                options={parentConventionOptions}
                error={errors.parentConventionId?.message}
              />
              <p className="text-xs text-slate-500 mt-1">
                Conventions rattachées au terrain sélectionné.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label="Date de début *" type="date" error={errors.startDate?.message} {...register('startDate')} />
            <Select
              label="Délai de la convention"
              options={DURATION_OPTIONS}
              value={durationMonths}
              onChange={(e) => setDurationMonths(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Input
                label="Date de fin"
                type="date"
                {...register('endDate', { onChange: () => setDurationMonths('') })}
              />
              {durationMonths && (
                <p className="text-xs text-slate-500 mt-1">Calculée à partir du délai sélectionné.</p>
              )}
            </div>
            <Input label="Date de signature" type="date" {...register('signedAt')} />
          </div>
        </Card>

        {/* Conditions financières */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Conditions financières</h3>
          {!isSale ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Loyer mensuel (FCFA)" type="number" step="1000" {...register('rentAmount')} />
                <Input label="Charges (FCFA)" type="number" step="1000" {...register('charges')} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Input label="Caution / Dépôt (FCFA)" type="number" step="1000" {...register('deposit')} />
                <Input label="Honoraires agence (FCFA)" type="number" step="1000" {...register('agencyFees')} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Input label="Jour de paiement (1-31)" type="number" min="1" max="31" error={errors.paymentDay?.message} {...register('paymentDay')} />
                <Select label="Mode de paiement" options={PAYMENT_METHOD_OPTIONS} {...register('paymentMethod')} />
              </div>
            </>
          ) : (
            <>
              {watchAssetType === 'TERRAIN' ? (
                <div>
                  <Input label="Prix de vente (FCFA)" type="number" step="1000" {...register('saleAmount')} />
                  <p className="text-xs text-slate-500 mt-1">
                    Repris automatiquement du terrain sélectionné — modifiable si nécessaire.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Prix de vente (FCFA)" type="number" step="1000" {...register('saleAmount')} />
                  <Input label="Honoraires agence (FCFA)" type="number" step="1000" {...register('agencyFees')} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Select label="Modalités de paiement" options={PAYMENT_MODALITES_OPTIONS} {...register('paymentModalites')} />
                <Select label="Mode de paiement" options={PAYMENT_METHOD_OPTIONS} {...register('paymentMethod')} />
              </div>
              {isInstallment && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Apport initial (FCFA)" type="number" step="1000" {...register('apportInitial')} />
                    {watchModalites === 'SUR_PLUS_60_MOIS' && (
                      <Input label="Nombre d'échéances" type="number" {...register('installmentCount')} />
                    )}
                  </div>
                  {installmentCount > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-slate-700">
                          Échéancier — {installmentCount} échéance{installmentCount > 1 ? 's' : ''}
                        </h4>
                        <Button type="button" variant="secondary" size="sm" onClick={recomputeInstallments}>
                          Recalculer
                        </Button>
                      </div>
                      <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-1 mb-1 text-xs font-medium text-slate-500">
                        <span className="text-center">N°</span>
                        <span>Date d'échéance</span>
                        <span>Montant (FCFA)</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                        {installmentRows.map((row, idx) => (
                          <div key={idx} className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center">
                            <span className="text-xs text-slate-500 text-center">{idx + 1}</span>
                            <Input type="date" value={row.dueDate}
                              onChange={(e) => updateInstallmentRow(idx, 'dueDate', e.target.value)} />
                            <Input type="number" step="1000" value={row.amount}
                              onChange={(e) => updateInstallmentRow(idx, 'amount', e.target.value)} />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs mt-2 pt-2 border-t border-blue-200 text-slate-600">
                        <span>Total échéances : <span className="font-semibold">{installmentsTotal.toLocaleString('fr-FR')} FCFA</span></span>
                        <span>Apport + échéances : <span className="font-semibold">{(installmentsTotal + (Number(watchApport) || 0)).toLocaleString('fr-FR')} FCFA</span></span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Par défaut : (prix de vente − apport) ÷ nombre d'échéances, le 5 de chaque mois à partir de la signature. Dates et montants modifiables.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {watchAssetType !== 'TERRAIN' && (
                <div className="mt-4">
                  <Input label="Caution (FCFA)" type="number" step="1000" {...register('deposit')} />
                </div>
              )}
            </>
          )}
        </Card>

        {/* Notes */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Notes</h3>
          <Textarea label="Observations" rows={3} {...register('notes')} />
        </Card>

        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/conventions')}>Annuler</Button>
          <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
            {isEdit ? 'Enregistrer' : 'Créer la convention'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
