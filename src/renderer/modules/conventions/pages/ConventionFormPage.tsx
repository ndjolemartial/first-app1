import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { FormSearchSelect, default as SearchSelect, type SearchSelectOption } from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useConvention, useConventions, useCreateConvention, useUpdateConvention } from '../hooks/useConventions';
import { useClients } from '../../clients/hooks/useClients';
import { useProperties } from '../../properties/hooks/useProperties';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { formatPersonName } from '../../../shared/utils/format';
import { Save } from 'lucide-react';

/** Identifiant optionnel : une chaîne vide est traitée comme « non renseigné ». */
const optionalId = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
  z.number().int().positive().optional(),
);

/** Tableau d'identifiants (biens ou terrains rattachés). */
const idArray = z.array(z.number().int().positive()).default([]);

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
  propertyIds: idArray,
  terrainIds: idArray,
  clientId: z.coerce.number().int().positive('Client principal requis'),
  secondaryClientId: optionalId,
  parentConventionId: optionalId,
  amendmentType: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.enum(['PROLONGATION_DELAI', 'TRANSFERT_PROPRIETE', 'TRANSFERT_SITE']).optional(),
  ),
  souscriptionType: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.enum(['STANDARD', 'AVEC_ACD', 'FINANCEMENT_PROJET']).optional(),
  ),
  type: z.enum(['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION']),
  status: z.enum(['BROUILLON', 'ACTIVE', 'EXPIRE', 'TERMINER', 'ANNULE', 'ATTENTE_SIGNATURE']).default('BROUILLON'),
  startDate: z.string().min(1, 'Date de début requise'),
  endDate: z.string().min(1, 'Délai requis : choisissez une durée ou saisissez la date de fin'),
  signedAt: z.string().optional(),
  rentAmount: optionalNumber,
  saleAmount: optionalNumber,
  apportInitial: optionalNumber,
  deposit: optionalNumber,
  agencyFees: optionalNumber,
  charges: optionalNumber,
  fraisOuvertureDossier: optionalNumber,
  paymentDay: optionalDay,
  paymentMethod: z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'NON_DEFINI']).default('ESPECE'),
  paymentModalites: z.enum(['CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS', 'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS']).default('CASH'),
  installmentCount: optionalNumber,
  firstInstallmentDate: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.assetType === 'PROPERTY' && (!d.propertyIds || d.propertyIds.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['propertyIds'], message: 'Sélectionnez au moins un bien immobilier' });
  }
  if (d.assetType === 'TERRAIN' && (!d.terrainIds || d.terrainIds.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['terrainIds'], message: 'Sélectionnez au moins un terrain' });
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
  if (d.type === 'SOUSCRIPTION' && !d.souscriptionType) {
    ctx.addIssue({
      code: 'custom',
      path: ['souscriptionType'],
      message: 'Précisez la nature de la souscription',
    });
  }
});

type FormData = z.infer<typeof schema>;

const ASSET_TYPE_OPTIONS = [
  { value: 'TERRAIN', label: 'Des terrains' },
  { value: 'PROPERTY', label: 'Des biens immobiliers' },
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

/** Types de convention de terrain n'exigeant pas un pré-rattachement client (le terrain est encore DISPONIBLE — la convention acte la réservation). */
const TERRAIN_DISPONIBLE_TYPES = ['SOUSCRIPTION'];

/** Statuts de terrain considérés comme « engagés à un client » (pré-rattachement requis). */
const TERRAIN_ENGAGED_STATUTS = ['RESERVE', 'VENDU', 'SOUS_OPTION'];

/** Statuts de bien considérés comme « engagés à un client » (pré-rattachement requis). */
const PROPERTY_ENGAGED_STATUTS = ['RESERVE', 'VENDU', 'SOUS_OPTION', 'EN_LOCATION', 'INDISPONIBLE'];

/** Types de convention liés à une convention initiale/précédente. */
const AMENDMENT_TYPES = ['AVENANT', 'RESILIATION'];

const AMENDMENT_NATURE_OPTIONS = [
  { value: '', label: '— Choisir la nature —' },
  { value: 'PROLONGATION_DELAI', label: 'Avenant de prolongation de délai' },
  { value: 'TRANSFERT_PROPRIETE', label: 'Avenant de transfert de propriété' },
  { value: 'TRANSFERT_SITE', label: 'Avenant de transfert de site / changement de lot' },
];

const SOUSCRIPTION_NATURE_OPTIONS = [
  { value: '', label: '— Choisir la nature —' },
  { value: 'STANDARD', label: 'Convention de souscription' },
  { value: 'AVEC_ACD', label: 'Convention de souscription avec ACD' },
  { value: 'FINANCEMENT_PROJET', label: 'Convention de financement sur projet' },
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

/**
 * Sélecteur multiple : affiche les éléments sélectionnés en chips (suppression au clic)
 * et propose un SearchSelect pour ajouter un nouvel élément. Les options déjà
 * sélectionnées sont retirées du sélecteur d'ajout.
 */
function MultiAssetSelect({
  label,
  options,
  values,
  onChange,
  error,
  onAdd,
}: {
  label: string;
  options: SearchSelectOption[];
  values: number[];
  onChange: (next: number[]) => void;
  error?: string;
  onAdd?: (addedId: number) => void;
}) {
  const selectedSet = new Set(values.map(String));
  const remainingOptions: SearchSelectOption[] = [
    { value: '', label: '— Ajouter un élément —' },
    ...options.filter((o) => o.value !== '' && !selectedSet.has(o.value)),
  ];
  const labelByValue = new Map(options.filter((o) => o.value !== '').map((o) => [o.value, o.label]));
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">
        {label}
        <span className="text-red-500 ml-1">*</span>
      </label>
      {values.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun élément sélectionné.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-sm text-blue-700"
            >
              <span className="break-all">{labelByValue.get(String(v)) ?? `#${v}`}</span>
              <button
                type="button"
                aria-label="Retirer"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="ml-1 rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <SearchSelect
        options={remainingOptions}
        value=""
        onChange={(v) => {
          const num = Number(v);
          if (!v || !Number.isFinite(num)) return;
          onChange([...values, num]);
          onAdd?.(num);
        }}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
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
  // Mémorise le clientId courant pour ne réinitialiser la sélection terrain/bien
  // qu'à un VRAI changement (et pas au pré-remplissage initial en édition).
  const prevClientIdRef = useRef<number | null>(null);

  const clientOptions = [
    { value: '', label: '— Choisir un client —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: formatPersonName(c),
    })),
  ];

  const secondaryClientOptions = [
    { value: '', label: '— Aucun (facultatif) —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: formatPersonName(c),
    })),
  ];

  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      assetType: 'TERRAIN', type: 'SOUSCRIPTION', status: 'BROUILLON',
      paymentMethod: 'ESPECE', paymentModalites: 'CASH',
      propertyIds: [], terrainIds: [],
      fraisOuvertureDossier: 100000,
    },
  });

  const watchType = watch('type');
  const watchModalites = watch('paymentModalites');
  const watchAssetType = watch('assetType');
  const watchStartDate = watch('startDate');
  const watchTerrainIds = watch('terrainIds') ?? [];
  const watchClientId = watch('clientId');
  const watchInstallmentCount = watch('installmentCount');
  const watchSignedAt = watch('signedAt');
  const watchSaleAmount = watch('saleAmount');
  const watchApport = watch('apportInitial');
  const clientIdNum = Number(watchClientId) || 0;

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

  // Règle métier : pour SOUSCRIPTION de terrain, la convention acte la réservation —
  // on propose tous les terrains DISPONIBLES. Pour les autres types (SALE/AVENANT/
  // RESILIATION), le terrain doit avoir été préalablement assigné au client choisi
  // (clientId + statut engagé) depuis la fiche terrain.
  const terrainStrictByClient = !TERRAIN_DISPONIBLE_TYPES.includes(watchType);
  // Terrains déjà rattachés en édition — conservés en option même hors filtre courant.
  const editingTerrains: any[] = isEdit
    ? (res?.data?.terrains ?? []).map((l: any) => l.terrain)
    : [];
  const filteredTerrains = (terrainsRes?.data ?? []).filter((t: any) => {
    if (terrainStrictByClient) {
      return TERRAIN_ENGAGED_STATUTS.includes(t.statut)
        && clientIdNum > 0
        && Number(t.clientId) === clientIdNum;
    }
    // Non-strict : terrains DISPONIBLES + terrains déjà rattachés au client courant.
    if (t.statut === 'DISPONIBLE') return true;
    if (clientIdNum > 0 && Number(t.clientId) === clientIdNum) return true;
    return false;
  });
  // Réinjecte les terrains déjà rattachés en édition pour ne pas les masquer si
  // leur statut a évolué — mais en filtrage strict, seulement s'ils restent
  // attribués au client courant (sinon ils n'ont plus rien à faire ici).
  for (const t of editingTerrains) {
    if (!t) continue;
    if (terrainStrictByClient && Number(t.clientId) !== clientIdNum) continue;
    if (!filteredTerrains.some((x: any) => x.id === t.id)) {
      filteredTerrains.unshift(t);
    }
  }
  // Tri : les terrains déjà rattachés au client courant remontent en tête.
  filteredTerrains.sort((a: any, b: any) => {
    const aOwned = clientIdNum > 0 && Number(a.clientId) === clientIdNum ? 1 : 0;
    const bOwned = clientIdNum > 0 && Number(b.clientId) === clientIdNum ? 1 : 0;
    return bOwned - aOwned;
  });

  // Règle métier : tous les terrains d'une convention doivent appartenir au
  // même lotissement (ou tous être sans lotissement). Dès qu'un terrain est
  // sélectionné, on verrouille les options d'ajout sur son lotissementId. Les
  // terrains déjà sélectionnés restent visibles (pour pouvoir les retirer).
  const selectedTerrainIdsSet = new Set(watchTerrainIds.map(Number));
  const lockedLotissementId: number | null = (() => {
    if (watchTerrainIds.length === 0) return null;
    const first = filteredTerrains.find((t: any) => selectedTerrainIdsSet.has(Number(t.id)));
    if (!first) return null;
    return first.lotissementId ?? null;
  })();
  const terrainOptions = [
    { value: '', label: '— Choisir un terrain —' },
    ...filteredTerrains
      .filter((t: any) => {
        if (selectedTerrainIdsSet.has(Number(t.id))) return true; // toujours visible
        if (watchTerrainIds.length === 0) return true;
        return (t.lotissementId ?? null) === lockedLotissementId;
      })
      .map((t: any) => {
        const loc = [
          t.numeroIlot ? `Îlot ${t.numeroIlot}` : '',
          t.numeroParcelle ? `Lot ${t.numeroParcelle}` : '',
        ].filter(Boolean).join(', ');
        const isClientOwned = clientIdNum > 0 && Number(t.clientId) === clientIdNum;
        return {
          value: String(t.id),
          label: `${t.reference} — ${t.lotissement?.nom ?? ''}`.trim() + (loc ? ` (${loc})` : ''),
          highlighted: isClientOwned,
        };
      }),
  ];

  // Détection d'une éventuelle incohérence (cas d'édition d'une convention
  // historique) : terrains rattachés provenant de lotissements différents.
  const selectedTerrains = filteredTerrains.filter((t: any) => selectedTerrainIdsSet.has(Number(t.id)));
  const distinctLotIds = new Set(selectedTerrains.map((t: any) => t.lotissementId ?? null));
  const hasMixedLotissements = distinctLotIds.size > 1;

  // Biens immobiliers : pour une nouvelle convention (RENTAL/SALE/MANAGEMENT/
  // COMMERCIAL_LEASE), on propose les biens DISPONIBLES — la convention acte
  // l'engagement. Pour AVENANT/RESILIATION, pré-rattachement client obligatoire.
  const propertyStrictByClient = AMENDMENT_TYPES.includes(watchType);
  const editingProperties: any[] = isEdit
    ? (res?.data?.properties ?? []).map((l: any) => l.property)
    : [];
  const filteredProperties = (propertiesRes?.data ?? []).filter((p: any) => {
    if (propertyStrictByClient) {
      return PROPERTY_ENGAGED_STATUTS.includes(p.status)
        && clientIdNum > 0
        && Number(p.clientId) === clientIdNum;
    }
    // Non-strict : biens DISPONIBLES + biens déjà rattachés au client courant.
    if (p.status === 'DISPONIBLE') return true;
    if (clientIdNum > 0 && Number(p.clientId) === clientIdNum) return true;
    return false;
  });
  for (const p of editingProperties) {
    if (!p) continue;
    if (propertyStrictByClient && Number(p.clientId) !== clientIdNum) continue;
    if (!filteredProperties.some((x: any) => x.id === p.id)) {
      filteredProperties.unshift(p);
    }
  }
  // Tri : les biens déjà rattachés au client courant remontent en tête.
  filteredProperties.sort((a: any, b: any) => {
    const aOwned = clientIdNum > 0 && Number(a.clientId) === clientIdNum ? 1 : 0;
    const bOwned = clientIdNum > 0 && Number(b.clientId) === clientIdNum ? 1 : 0;
    return bOwned - aOwned;
  });
  const filteredPropertyOptions = [
    { value: '', label: '— Choisir un bien —' },
    ...filteredProperties.map((p: any) => {
      const isClientOwned = clientIdNum > 0 && Number(p.clientId) === clientIdNum;
      return {
        value: String(p.id),
        label: `${p.reference} — ${p.address}, ${p.city}`,
        highlighted: isClientOwned,
      };
    }),
  ];

  // Avenant / résiliation : convention initiale ou précédente, parmi les conventions
  // partageant au moins un terrain avec la sélection courante.
  const isAmendment = AMENDMENT_TYPES.includes(watchType);
  const selectedTerrainIdSet = new Set(watchTerrainIds.map(String));
  const parentConventionOptions = [
    { value: '', label: '— Choisir la convention —' },
    ...(conventionsRes?.data ?? [])
      .filter((co: any) => {
        if (co.id === Number(id)) return false;
        const coTerrainIds: string[] = (co.terrains ?? []).map((l: any) => String(l.terrain?.id ?? l.terrainId));
        return coTerrainIds.some((tid) => selectedTerrainIdSet.has(tid));
      })
      .map((co: any) => {
        const cn = formatPersonName(co.client, '');
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

  // Vide la sélection terrain/bien quand l'utilisateur change de client principal,
  // mais uniquement pour les types de convention en mode strict (clientId obligatoire) —
  // sinon la sélection sur biens/terrains DISPONIBLES reste valide quel que soit le client.
  // Le pré-remplissage initial (edit mode) ne déclenche pas la purge : on enregistre
  // d'abord le clientId d'amorçage, on ne réagit qu'aux changements suivants.
  useEffect(() => {
    if (prevClientIdRef.current === null) {
      prevClientIdRef.current = clientIdNum;
      return;
    }
    if (prevClientIdRef.current !== clientIdNum) {
      prevClientIdRef.current = clientIdNum;
      if (terrainStrictByClient) setValue('terrainIds', [], { shouldValidate: false });
      if (propertyStrictByClient) setValue('propertyIds', [], { shouldValidate: false });
    }
  }, [clientIdNum, setValue, terrainStrictByClient, propertyStrictByClient]);

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
      const propIds: number[] = (c.properties ?? []).map((l: any) => Number(l.property?.id ?? l.propertyId)).filter(Boolean);
      const terrIds: number[] = (c.terrains ?? []).map((l: any) => Number(l.terrain?.id ?? l.terrainId)).filter(Boolean);
      // Coercion des null Prisma en '' / undefined pour les champs optional :
      // Zod n'accepte pas null sur un string/enum optional, sinon handleSubmit
      // échoue silencieusement et RHF focus le premier champ "invalide".
      reset({
        ...c,
        assetType: c.assetType ?? 'PROPERTY',
        propertyIds: propIds,
        terrainIds: terrIds,
        clientId: c.clientId,
        secondaryClientId: c.secondaryClientId ?? undefined,
        parentConventionId: c.parentConventionId ?? undefined,
        amendmentType: c.amendmentType ?? undefined,
        souscriptionType: c.souscriptionType ?? undefined,
        startDate: toDateInput(c.startDate),
        endDate: toDateInput(c.endDate),
        signedAt: toDateInput(c.signedAt),
        firstInstallmentDate: toDateInput(c.firstInstallmentDate),
        rentAmount: c.rentAmount ? Number(c.rentAmount) : undefined,
        saleAmount: c.saleAmount ? Number(c.saleAmount) : undefined,
        deposit: c.deposit ? Number(c.deposit) : undefined,
        agencyFees: c.agencyFees ? Number(c.agencyFees) : undefined,
        charges: c.charges ? Number(c.charges) : undefined,
        fraisOuvertureDossier: c.fraisOuvertureDossier ? Number(c.fraisOuvertureDossier) : undefined,
        indexType: c.indexType ?? '',
        notes: c.notes ?? '',
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

  // Quand on ajoute un terrain, on cumule son prix de vente dans saleAmount.
  const onTerrainAdded = (terrainId: number) => {
    const t = filteredTerrains.find((x: any) => x.id === terrainId);
    const price = Number(t?.prixVente);
    if (Number.isFinite(price) && price > 0) {
      const current = Number(watchSaleAmount) || 0;
      setValue('saleAmount', current + price, { shouldValidate: true });
    }
  };

  const onInvalid = () => {
    setSubmitError('Certains champs obligatoires sont manquants ou invalides — vérifiez le formulaire.');
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    // Garde-fou client : tous les terrains d'une convention doivent provenir
    // du même lotissement. Le backend rejette aussi, mais on échoue ici
    // explicitement pour un message clair sans aller-retour réseau.
    if (data.assetType === 'TERRAIN' && hasMixedLotissements) {
      setSubmitError('Tous les terrains rattachés doivent provenir du même lotissement.');
      return;
    }
    try {
    const payload: any = { ...data };
    // N'envoie que les identifiants correspondant au type de rattachement choisi
    if (payload.assetType === 'TERRAIN') {
      delete payload.propertyIds;
    } else {
      delete payload.terrainIds;
      delete payload.secondaryClientId;
    }
    // La convention liée ne concerne que les avenants et résiliations
    if (!AMENDMENT_TYPES.includes(payload.type)) delete payload.parentConventionId;
    // La nature de l'avenant ne concerne que les avenants
    if (payload.type !== 'AVENANT') delete payload.amendmentType;
    // La nature de la souscription ne concerne que les souscriptions
    if (payload.type !== 'SOUSCRIPTION') delete payload.souscriptionType;
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
            <FormSearchSelect
              control={control}
              name="clientId"
              label="Client principal *"
              options={clientOptions}
              error={errors.clientId?.message}
            />
            {watchAssetType === 'TERRAIN' ? (
              <>
                <Controller
                  control={control}
                  name="terrainIds"
                  render={({ field }) => (
                    <MultiAssetSelect
                      label="Terrains rattachés"
                      options={terrainOptions}
                      values={(field.value ?? []) as number[]}
                      onChange={field.onChange}
                      onAdd={onTerrainAdded}
                      error={errors.terrainIds?.message as string | undefined}
                    />
                  )}
                />
                {terrainStrictByClient && clientIdNum === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Sélectionnez d'abord le client principal pour afficher les terrains qui lui sont déjà attribués.
                  </p>
                )}
                {terrainStrictByClient && clientIdNum > 0 && filteredTerrains.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Aucun terrain n'est rattaché à ce client. Assignez d'abord un terrain (statut réservé / vendu / sous option) au client depuis la fiche terrain.
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Tous les terrains d'une convention doivent appartenir au même lotissement.
                </p>
                {hasMixedLotissements && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                    Les terrains sélectionnés proviennent de lotissements différents. Retirez ceux qui n'appartiennent pas au même lotissement avant d'enregistrer.
                  </p>
                )}
              </>
            ) : (
              <>
                <Controller
                  control={control}
                  name="propertyIds"
                  render={({ field }) => (
                    <MultiAssetSelect
                      label="Biens immobiliers rattachés"
                      options={filteredPropertyOptions}
                      values={(field.value ?? []) as number[]}
                      onChange={field.onChange}
                      error={errors.propertyIds?.message as string | undefined}
                    />
                  )}
                />
                {propertyStrictByClient && clientIdNum === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Sélectionnez d'abord le client principal pour afficher les biens qui lui sont déjà attribués.
                  </p>
                )}
                {propertyStrictByClient && clientIdNum > 0 && filteredProperties.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Aucun bien n'est rattaché à ce client. Assignez d'abord un bien (statut réservé / vendu / sous option / en location / indisponible) au client depuis la fiche bien.
                  </p>
                )}
              </>
            )}
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
          {watchType === 'SOUSCRIPTION' && (
            <div className="mt-4">
              <Select
                label="Nature de la souscription *"
                options={SOUSCRIPTION_NATURE_OPTIONS}
                error={errors.souscriptionType?.message}
                {...register('souscriptionType')}
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
                Conventions partageant au moins un terrain avec la sélection courante.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label="Date de début *" type="date" error={errors.startDate?.message} {...register('startDate')} />
            <Select
              label="Délai de la convention *"
              options={DURATION_OPTIONS}
              value={durationMonths}
              onChange={(e) => setDurationMonths(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Input
                label="Date de fin *"
                type="date"
                error={errors.endDate?.message}
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
                  <Input label="Prix de vente total (FCFA)" type="number" step="1000" {...register('saleAmount')} />
                  <p className="text-xs text-slate-500 mt-1">
                    Cumulé automatiquement à partir des terrains ajoutés — modifiable si nécessaire.
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

          {/* Frais d'ouverture de dossier — applicable à toutes les conventions */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Input
              label="Frais d'ouverture de dossier (FCFA)"
              type="number"
              step="1000"
              placeholder="100 000"
              {...register('fraisOuvertureDossier')}
            />
          </div>
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
