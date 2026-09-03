import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import SearchSelect, { type SearchSelectOption } from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useQuote, useCreateQuote, useUpdateQuote, useQuoteUnits } from '../hooks/useQuotes';
import { useClients } from '../../clients/hooks/useClients';
import { useProspects } from '../../prospects/hooks/useProspects';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { useProperties } from '../../properties/hooks/useProperties';
import { QUOTE_TYPE_LABELS, DEFAULT_REFERENCE_COLUMN_LABEL } from '../utils/quoteTemplate';
import { formatCurrency, formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { useAuthStore } from '../../../shared/stores/auth.store';
import CatalogPicker, { CatalogPick } from '../../../shared/components/CatalogPicker';
import { useCatalog } from '../../../shared/hooks/useCatalog';
import { Save, Plus, Trash2, Heading, Pilcrow, Lock, X } from 'lucide-react';

const TYPE_OPTIONS = Object.entries(QUOTE_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const MODALITES_OPTIONS = [
  { value: 'CASH', label: 'Comptant' },
  { value: 'SUR_3_MOIS', label: 'Sur 3 mois' },
  { value: 'SUR_6_MOIS', label: 'Sur 6 mois' },
  { value: 'SUR_9_MOIS', label: 'Sur 9 mois' },
  { value: 'SUR_12_MOIS', label: 'Sur 12 mois' },
  { value: 'SUR_24_MOIS', label: 'Sur 24 mois' },
  { value: 'SUR_36_MOIS', label: 'Sur 36 mois' },
  { value: 'SUR_48_MOIS', label: 'Sur 48 mois' },
  { value: 'SUR_60_MOIS', label: 'Sur 60 mois' },
  { value: 'SUR_PLUS_60_MOIS', label: 'Plus de 60 mois' },
];

type QuoteItemLineType = 'ARTICLE' | 'TITLE' | 'SUBTITLE';
interface Line {
  lineType: QuoteItemLineType; designation: string; reference: string; category: string;
  quantity: string; unit: string; unitPrice: string;
  /** Unité non modifiable : ligne ajoutée depuis le catalogue, l'unité vient de l'article. */
  unitLocked: boolean;
  /** Article du catalogue d'origine (null si ligne manuelle) — empêche de le sélectionner deux fois. */
  catalogItemId: number | null;
  /**
   * Terrain/bien d'origine (null si ligne manuelle ou catalogue) — ligne
   * ajoutée automatiquement depuis le sélecteur « Terrain(s) »/« Bien(s) »,
   * retirée automatiquement si l'élément est désélectionné. Purement une
   * commodité de saisie (non persistée sur QuoteItem) : à l'édition d'un
   * devis existant, ces lignes rechargées depuis la base redeviennent des
   * lignes manuelles ordinaires (pas de re-synchronisation rétroactive).
   */
  assetId?: number | null;
  assetKind?: 'TERRAIN' | 'PROPERTY' | null;
}

/** Extrait le premier message d'une erreur Zod `.format()` (objet imbriqué `{ _errors: [...] }`). */
function extractZodMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const obj = err as Record<string, any>;
  if (Array.isArray(obj._errors) && obj._errors.length > 0) return obj._errors[0];
  for (const key of Object.keys(obj)) {
    if (key === '_errors') continue;
    const found = extractZodMessage(obj[key]);
    if (found) return found;
  }
  return null;
}

/** Date du jour + 30 jours (format `yyyy-mm-dd`), valeur par défaut de « Validité (jusqu'au) ». */
function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function toDateInput(v?: string | Date | null): string {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * Champ montant pouvant être saisi en valeur fixe (XOF) ou en pourcentage.
 * Le basculement XOF/% est affiché à droite du libellé ; `hint` indique
 * l'équivalent calculé (ex. « = 50 000 FCFA »).
 */
function AmountPercentField({ label, isPercent, onModeChange, value, onValueChange, hint }: {
  label: string;
  isPercent: boolean;
  onModeChange: (percent: boolean) => void;
  value: string;
  onValueChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium text-slate-700">{label}</label>
        <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => onModeChange(false)}
            className={`px-2 py-0.5 text-xs transition-colors ${!isPercent ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>XOF</button>
          <button type="button" onClick={() => onModeChange(true)}
            className={`px-2 py-0.5 text-xs transition-colors ${isPercent ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>%</button>
        </div>
      </div>
      <div className="relative">
        <input
          type="number" min="0" step={isPercent ? '0.01' : '1'} max={isPercent ? '100' : undefined}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{isPercent ? '%' : 'XOF'}</span>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/**
 * Sélecteur multiple (puces + recherche) pour le terrain/bien concerné —
 * même principe que `MultiAssetSelect` dans AttestationFormPage.tsx : ajoute
 * un élément via un `SearchSelect`, l'affiche comme une puce retirable.
 * `options` doit déjà exclure les éléments non éligibles (ex. hors du
 * lotissement/programme verrouillé) tout en conservant ceux déjà sélectionnés.
 */
function MultiAssetSelect({
  label,
  options,
  values,
  onChange,
  onSearch,
  placeholder = '— Ajouter un élément —',
}: {
  label: string;
  options: SearchSelectOption[];
  values: number[];
  onChange: (next: number[]) => void;
  onSearch?: (query: string) => Promise<SearchSelectOption[]>;
  placeholder?: string;
}) {
  const selectedSet = new Set(values.map(String));
  const remainingOptions: SearchSelectOption[] = [
    { value: '', label: placeholder },
    ...options.filter((o) => o.value !== '' && !selectedSet.has(o.value)),
  ];
  const labelByValue = new Map(options.filter((o) => o.value !== '').map((o) => [o.value, o.label]));
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {values.length > 0 && (
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
        }}
        onSearch={onSearch}
      />
    </div>
  );
}

export default function QuoteFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.token)!;

  const { data: res } = useQuote(isEdit ? Number(id) : 0);
  const create = useCreateQuote();
  const update = useUpdateQuote();
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: prospectsRes } = useProspects({}, 1, 500);
  const { data: terrainsRes } = useTerrains({}, 1, 500);
  const { data: propertiesRes } = useProperties({}, 1, 500);

  const [recipientType, setRecipientType] = useState<'CLIENT' | 'PROSPECT'>('CLIENT');
  const [clientId, setClientId] = useState(searchParams.get('clientId') ?? '');
  const [prospectId, setProspectId] = useState(searchParams.get('prospectId') ?? '');
  const [type, setType] = useState('PRESTATION');
  const [objet, setObjet] = useState('');
  const [assetType, setAssetType] = useState<'NONE' | 'TERRAIN' | 'PROPERTY'>('NONE');
  // Sélection multiple de terrains/biens, restreinte à un même lotissement /
  // programme immobilier (même principe que les Attestations).
  const [terrainIds, setTerrainIds] = useState<number[]>(
    searchParams.get('terrainId') ? [Number(searchParams.get('terrainId'))] : [],
  );
  const [propertyIds, setPropertyIds] = useState<number[]>([]);
  // Cache des objets terrain/bien complets (prix de vente, lotissement/programme…)
  // vus jusqu'ici — préchargement (terrainsRes/propertiesRes) + résultats de
  // recherche distante (celle-ci ne renvoie qu'un { value, label } léger pour le
  // sélecteur) — afin de pouvoir construire une ligne de devis correctement
  // valorisée quelle que soit l'origine de la sélection.
  const [terrainCache, setTerrainCache] = useState<Record<number, any>>({});
  const [propertyCache, setPropertyCache] = useState<Record<number, any>>({});
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountIsPercent, setDiscountIsPercent] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [depositExpected, setDepositExpected] = useState('');
  const [depositIsPercent, setDepositIsPercent] = useState(false);
  const [depositPercent, setDepositPercent] = useState('');
  const [paymentModalites, setPaymentModalites] = useState('CASH');
  const [installmentCount, setInstallmentCount] = useState('');
  const [notes, setNotes] = useState('');
  const [conditions, setConditions] = useState('');
  const [items, setItems] = useState<Line[]>([]);
  const [referenceColumnLabel, setReferenceColumnLabel] = useState(DEFAULT_REFERENCE_COLUMN_LABEL);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: unitsRes } = useQuoteUnits();
  const unitOptions = [
    { value: '', label: '— Aucune —' },
    ...((unitsRes?.success && unitsRes.data ? unitsRes.data : []).map((u: any) => ({ value: u.label, label: u.label }))),
  ];

  useEffect(() => {
    if (searchParams.get('prospectId')) setRecipientType('PROSPECT');
    if (searchParams.get('terrainId')) setAssetType('TERRAIN');
  }, [searchParams]);

  // Alimente le cache terrain/bien avec le préchargement initial (les résultats
  // de recherche distante l'alimentent aussi, cf. searchTerrainsMulti/searchPropertiesMulti).
  useEffect(() => {
    const list: any[] = terrainsRes?.data ?? [];
    if (!list.length) return;
    setTerrainCache((prev) => {
      const next = { ...prev };
      for (const t of list) next[t.id] = t;
      return next;
    });
  }, [terrainsRes]);
  useEffect(() => {
    const list: any[] = propertiesRes?.data ?? [];
    if (!list.length) return;
    setPropertyCache((prev) => {
      const next = { ...prev };
      for (const p of list) next[p.id] = p;
      return next;
    });
  }, [propertiesRes]);

  useEffect(() => {
    if (isEdit && res?.data) {
      const q = res.data;
      setRecipientType(q.clientId ? 'CLIENT' : 'PROSPECT');
      setClientId(q.clientId ? String(q.clientId) : '');
      setProspectId(q.prospectId ? String(q.prospectId) : '');
      setType(q.type ?? 'VENTE_TERRAIN');
      setObjet(q.objet ?? '');
      // Terrain(s) / bien(s) — sélection multiple : on lit la relation
      // terrains/properties (join table), avec repli sur le champ singulier
      // terrainId/propertyId pour les devis mono-bien antérieurs à cette fonctionnalité.
      const terrainIdsFromRelation: number[] = (q.terrains ?? []).map((l: any) => l.terrainId ?? l.terrain?.id).filter(Boolean);
      const propertyIdsFromRelation: number[] = (q.properties ?? []).map((l: any) => l.propertyId ?? l.property?.id).filter(Boolean);
      const effTerrainIds = terrainIdsFromRelation.length ? terrainIdsFromRelation : (q.terrainId ? [q.terrainId] : []);
      const effPropertyIds = propertyIdsFromRelation.length ? propertyIdsFromRelation : (q.propertyId ? [q.propertyId] : []);
      setTerrainIds(effTerrainIds);
      setPropertyIds(effPropertyIds);
      if (effTerrainIds.length) setAssetType('TERRAIN');
      else if (effPropertyIds.length) setAssetType('PROPERTY');
      else setAssetType('NONE');
      setValidUntil(toDateInput(q.validUntil));
      setDiscountAmount(String(Number(q.discountAmount ?? 0)));
      setDiscountIsPercent(Boolean(q.discountIsPercent));
      setDiscountPercent(q.discountPercent != null ? String(Number(q.discountPercent)) : '0');
      setTaxRate(String(Number(q.taxRate ?? 0)));
      setDepositExpected(q.depositExpected != null ? String(Number(q.depositExpected)) : '');
      setDepositIsPercent(Boolean(q.depositIsPercent));
      setDepositPercent(q.depositPercent != null ? String(Number(q.depositPercent)) : '');
      setPaymentModalites(q.paymentModalites ?? 'CASH');
      setInstallmentCount(q.installmentCount != null ? String(q.installmentCount) : '');
      setNotes(q.notes ?? '');
      setConditions(q.conditions ?? '');
      setReferenceColumnLabel(q.referenceColumnLabel || DEFAULT_REFERENCE_COLUMN_LABEL);
      setItems((q.items ?? []).map((it: any) => ({ lineType: it.lineType ?? 'ARTICLE', designation: it.designation, reference: it.reference ?? '', category: it.category ?? '', quantity: String(Number(it.quantity)), unit: it.unit ?? '', unitPrice: String(Number(it.unitPrice)), unitLocked: false, catalogItemId: it.catalogItemId ?? null })));
    }
  }, [res, isEdit]);

  // Articles du catalogue déjà utilisés dans le devis — exclus du sélecteur
  // pour empêcher d'ajouter deux fois le même article.
  const usedCatalogItemIds = useMemo(
    () => items.map((i) => i.catalogItemId).filter((id): id is number => id != null),
    [items],
  );

  // Un sous-titre n'a de sens qu'après au moins un article déjà renseigné.
  const hasArticleLine = items.some((i) => i.lineType === 'ARTICLE' && i.designation.trim());

  const totals = useMemo(() => {
    const lines = items.map((i) => Math.round((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0) * 100) / 100);
    const subtotal = lines.reduce((s, l) => s + l, 0);
    // Remise : montant fixe (XOF) ou pourcentage du sous-total.
    const effectiveDiscount = discountIsPercent
      ? Math.round(subtotal * ((Number(discountPercent) || 0) / 100) * 100) / 100
      : (Number(discountAmount) || 0);
    const base = Math.max(0, subtotal - effectiveDiscount);
    const taxAmount = Math.round(base * (Number(taxRate) || 0)) / 100;
    const total = Math.round((base + taxAmount) * 100) / 100;
    // Acompte : montant fixe (XOF) ou pourcentage du total TTC.
    const effectiveDeposit = depositIsPercent
      ? Math.round(total * ((Number(depositPercent) || 0) / 100) * 100) / 100
      : (depositExpected !== '' ? Number(depositExpected) || 0 : null);
    return { subtotal, taxAmount, total, lines, effectiveDiscount, effectiveDeposit };
  }, [items, discountAmount, discountIsPercent, discountPercent, taxRate, depositExpected, depositIsPercent, depositPercent]);

  // Catégories suggérées (datalist) : celles du catalogue + celles déjà saisies.
  const { data: catalogRes } = useCatalog({});
  const knownCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of (catalogRes?.data ?? [])) if (c.category) set.add(String(c.category));
    for (const l of items) if (l.category?.trim()) set.add(l.category.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [catalogRes, items]);

  const clientOptions = [{ value: '', label: '— Choisir un client —' }, ...(clientsRes?.data ?? []).map((c: any) => ({ value: String(c.id), label: formatPersonName(c, '') }))];
  const prospectOptions = [{ value: '', label: '— Choisir un prospect —' }, ...(prospectsRes?.data ?? []).map((p: any) => ({ value: String(p.id), label: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() }))];

  // Libellés détaillés : îlot, lot/parcelle et lotissement pour un terrain ;
  // adresse, ville et programme immobilier pour un bien.
  const terrainLabel = (t: any) =>
    `${t.reference}${t.numeroIlot ? ` — Îlot ${t.numeroIlot}` : ''}${t.numeroParcelle ? `, Lot ${t.numeroParcelle}` : ''}${t.lotissement?.nom ? ` (${t.lotissement.nom})` : ''}`;
  const propertyLabel = (p: any) =>
    `${p.reference} — ${p.address ?? ''}${p.city ? `, ${p.city}` : ''}${p.programme?.nom ? ` (${p.programme.nom})` : ''}`;

  // Construit une ligne de devis valorisée à partir d'un terrain/bien complet
  // (prix de vente, lotissement/programme pour la catégorie) — utilisées par
  // syncAssetLines() ci-dessous pour ajouter/retirer automatiquement une ligne
  // quand la sélection « Terrain(s) »/« Bien(s) » change.
  const terrainToLine = (t: any): Line => ({
    lineType: 'ARTICLE', designation: terrainLabel(t), reference: t.reference ?? '',
    category: t.lotissement?.nom ?? '', quantity: '1', unit: '',
    unitPrice: String(Math.round(Number(t.prixVente ?? 0))),
    unitLocked: false, catalogItemId: null, assetId: t.id, assetKind: 'TERRAIN',
  });
  const propertyToLine = (p: any): Line => ({
    lineType: 'ARTICLE', designation: propertyLabel(p), reference: p.reference ?? '',
    category: p.programme?.nom ?? '', quantity: '1', unit: '',
    unitPrice: String(Math.round(Number(p.salePrice ?? 0))),
    unitLocked: false, catalogItemId: null, assetId: p.id, assetKind: 'PROPERTY',
  });

  /**
   * Ajoute/retire les lignes de devis correspondant à la sélection « Terrain(s) »/
   * « Bien(s) » : une ligne par élément ajouté (valorisée depuis le cache), les
   * lignes des éléments retirés sont supprimées. Les autres lignes (manuelles,
   * catalogue, titres/sous-titres) ne sont jamais affectées.
   */
  function syncAssetLines(
    prevItems: Line[], prevIds: number[], nextIds: number[],
    cache: Record<number, any>, kind: 'TERRAIN' | 'PROPERTY', toLine: (o: any) => Line,
  ): Line[] {
    const removedIds = prevIds.filter((id) => !nextIds.includes(id));
    const addedIds = nextIds.filter((id) => !prevIds.includes(id));
    let next = removedIds.length
      ? prevItems.filter((l) => !(l.assetKind === kind && l.assetId != null && removedIds.includes(l.assetId)))
      : prevItems;
    if (addedIds.length) {
      const newLines = addedIds.map((id) => cache[id]).filter(Boolean).map(toLine);
      next = [...next, ...newLines];
    }
    return next;
  }
  // La synchronisation automatique des lignes n'a lieu que pour un devis de
  // vente du bien concerné (Vente terrain ↔ terrain sélectionné, Vente bien ↔
  // bien sélectionné) — pour les autres types (Prestation, Frais…), le terrain/
  // bien peut être rattaché à titre indicatif sans en faire une ligne facturée.
  const handleTerrainIdsChange = (next: number[]) => {
    if (type === 'VENTE_TERRAIN') {
      setItems((prev) => syncAssetLines(prev, terrainIds, next, terrainCache, 'TERRAIN', terrainToLine));
    }
    setTerrainIds(next);
  };
  const handlePropertyIdsChange = (next: number[]) => {
    if (type === 'VENTE_BIEN') {
      setItems((prev) => syncAssetLines(prev, propertyIds, next, propertyCache, 'PROPERTY', propertyToLine));
    }
    setPropertyIds(next);
  };

  // Sélection multiple « Terrain(s) » / « Bien(s) » — verrouillée sur le
  // lotissement du 1ᵉʳ terrain choisi / le programme immobilier du 1ᵉʳ bien
  // choisi (s'il en a un), même principe que les Attestations.
  const terrainsList: any[] = terrainsRes?.data ?? [];
  const lockedLotissementId: number | null = terrainIds.length > 0
    ? (terrainsList.find((t: any) => t.id === terrainIds[0])?.lotissementId ?? null)
    : null;
  const terrainOptionsMulti: SearchSelectOption[] = terrainsList
    .filter((t: any) => terrainIds.includes(t.id) || lockedLotissementId == null || t.lotissementId === lockedLotissementId)
    .map((t: any) => ({ value: String(t.id), label: terrainLabel(t) }));

  const propertiesList: any[] = propertiesRes?.data ?? [];
  const lockedProgrammeId: number | null = propertyIds.length > 0
    ? (propertiesList.find((p: any) => p.id === propertyIds[0])?.programmeId ?? null)
    : null;
  const propertyOptionsMulti: SearchSelectOption[] = propertiesList
    .filter((p: any) => propertyIds.includes(p.id) || lockedProgrammeId == null || p.programmeId === lockedProgrammeId)
    .map((p: any) => ({ value: String(p.id), label: propertyLabel(p) }));

  const hasMixedLotissements = (() => {
    const selected = terrainsList.filter((t: any) => terrainIds.includes(t.id));
    return new Set(selected.map((t: any) => t.lotissementId ?? null)).size > 1;
  })();
  const hasMixedProgrammes = (() => {
    const selected = propertiesList.filter((p: any) => propertyIds.includes(p.id));
    const programmeIds = new Set(selected.map((p: any) => p.programmeId).filter((v: any) => v != null));
    return programmeIds.size > 1;
  })();

  // Recherche distante « Terrain(s) »/« Bien(s) » — applique en plus le
  // verrouillage lotissement/programme.
  const searchTerrainsMulti = async (q: string) => {
    const filters: any = { ...(q ? { search: q } : {}), ...(lockedLotissementId != null ? { lotissementId: lockedLotissementId } : {}) };
    const r: any = await window.electron.terrains.list(token, filters, 1, 100);
    const list: any[] = r?.data ?? [];
    if (list.length) setTerrainCache((prev) => { const next = { ...prev }; for (const t of list) next[t.id] = t; return next; });
    return list.map((t: any) => ({ value: String(t.id), label: terrainLabel(t) }));
  };
  const searchPropertiesMulti = async (q: string) => {
    const r: any = await window.electron.properties.list(token, q ? { search: q } : {}, 1, 100);
    const list: any[] = (r?.data ?? []).filter((p: any) => lockedProgrammeId == null || p.programmeId === lockedProgrammeId);
    if (list.length) setPropertyCache((prev) => { const next = { ...prev }; for (const p of list) next[p.id] = p; return next; });
    return list.map((p: any) => ({ value: String(p.id), label: propertyLabel(p) }));
  };

  // Recherche côté serveur : l'élément s'affiche quel que soit le volume.
  const searchClients = useMemo(
    () =>
      makeEntitySearch(
        (filters, page, limit) => window.electron.clients.list(token, filters, page, limit),
        (c: any) => ({ value: String(c.id), label: formatPersonName(c, '') }),
      ),
    [token],
  );
  const searchProspects = useMemo(
    () =>
      makeEntitySearch(
        (filters, page, limit) => window.electron.prospects.list(token, filters, page, limit),
        (p: any) => ({ value: String(p.id), label: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() }),
      ),
    [token],
  );
  const setLine = (idx: number, patch: Partial<Line>) =>
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setItems((prev) => [...prev, { lineType: 'ARTICLE', designation: '', reference: '', category: '', quantity: '1', unit: '', unitPrice: '0', unitLocked: false, catalogItemId: null }]);
  const addTitleLine = () => setItems((prev) => [...prev, { lineType: 'TITLE', designation: '', reference: '', category: '', quantity: '0', unit: '', unitPrice: '0', unitLocked: false, catalogItemId: null }]);
  const addSubtitleLine = () => {
    if (!hasArticleLine) return;
    setItems((prev) => [...prev, { lineType: 'SUBTITLE', designation: '', reference: '', category: '', quantity: '0', unit: '', unitPrice: '0', unitLocked: false, catalogItemId: null }]);
  };
  const removeLine = (idx: number) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  // Ajout depuis le catalogue : remplit la dernière ligne vide ou en ajoute une. L'unité vient
  // de l'article et n'est pas modifiable (seules les unités des lignes vides le sont). L'article
  // choisi disparaît ensuite du sélecteur (cf. usedCatalogItemIds) pour éviter les doublons.
  const addFromCatalog = (it: CatalogPick) => setItems((prev) => {
    const line: Line = { lineType: 'ARTICLE', designation: it.designation, reference: it.reference ?? '', category: it.category ?? '', quantity: '1', unit: it.unit ?? '', unitPrice: String(Math.round(it.unitPrice)), unitLocked: true, catalogItemId: it.id };
    const last = prev[prev.length - 1];
    if (last && last.lineType === 'ARTICLE' && !last.designation.trim() && (!last.unitPrice || Number(last.unitPrice) === 0)) {
      return prev.map((l, i) => (i === prev.length - 1 ? line : l));
    }
    return [...prev, line];
  });

  const handleSave = async () => {
    setError('');
    if (recipientType === 'CLIENT' && !clientId) { setError('Sélectionnez un client'); return; }
    if (recipientType === 'PROSPECT' && !prospectId) { setError('Sélectionnez un prospect'); return; }
    const validItems = items.filter((i) => i.designation.trim());
    if (validItems.length === 0) { setError('Ajoutez au moins une ligne au devis'); return; }
    if (assetType === 'TERRAIN' && hasMixedLotissements) {
      setError('Tous les terrains sélectionnés doivent provenir du même lotissement.');
      return;
    }
    if (assetType === 'PROPERTY' && hasMixedProgrammes) {
      setError('Tous les biens immobiliers sélectionnés doivent provenir du même programme immobilier.');
      return;
    }

    setSaving(true);
    const payload: any = {
      type,
      objet: objet.trim() || null,
      clientId: recipientType === 'CLIENT' && clientId ? Number(clientId) : null,
      prospectId: recipientType === 'PROSPECT' && prospectId ? Number(prospectId) : null,
      // On envoie toujours les deux tableaux (le non-sélectionné vide) afin
      // que changer de type de bien efface bien l'autre côté serveur.
      terrainIds: assetType === 'TERRAIN' ? terrainIds : [],
      propertyIds: assetType === 'PROPERTY' ? propertyIds : [],
      agentId: currentUserId ?? null,
      validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      discountIsPercent,
      discountPercent: discountIsPercent ? (Number(discountPercent) || 0) : null,
      discountAmount: discountIsPercent ? 0 : (Number(discountAmount) || 0),
      taxRate: Number(taxRate) || 0,
      depositIsPercent,
      depositPercent: depositIsPercent ? (Number(depositPercent) || 0) : null,
      depositExpected: depositIsPercent ? null : (depositExpected ? Number(depositExpected) : null),
      paymentModalites,
      installmentCount: paymentModalites !== 'CASH' && installmentCount ? Number(installmentCount) : null,
      notes: notes || undefined,
      conditions: conditions || undefined,
      referenceColumnLabel: referenceColumnLabel.trim() && referenceColumnLabel.trim() !== DEFAULT_REFERENCE_COLUMN_LABEL
        ? referenceColumnLabel.trim() : null,
      items: validItems.map((i) => ({
        lineType: i.lineType,
        designation: i.designation.trim(),
        reference: i.lineType === 'ARTICLE' ? (i.reference.trim() || null) : null,
        category: i.lineType === 'ARTICLE' ? (i.category.trim() || null) : null,
        quantity: i.lineType === 'ARTICLE' ? (Number(i.quantity) || 1) : 0,
        unit: i.lineType === 'ARTICLE' ? (i.unit.trim() || null) : null,
        unitPrice: i.lineType === 'ARTICLE' ? (Number(i.unitPrice) || 0) : 0,
        catalogItemId: i.lineType === 'ARTICLE' ? i.catalogItemId : null,
      })),
    };
    const r = isEdit ? await update.mutateAsync({ id: Number(id), payload }) : await create.mutateAsync(payload);
    setSaving(false);
    if (r.success) navigate(`/quotes/${r.data?.id ?? id}`);
    else setError(typeof r.error === 'string' ? r.error : (extractZodMessage(r.error) ?? 'Échec de l\'enregistrement'));
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le devis' : 'Nouveau devis'}
      breadcrumbs={[{ label: 'Devis', to: '/quotes' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Destinataire & objet</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type de destinataire" value={recipientType}
              options={[{ value: 'CLIENT', label: 'Client' }, { value: 'PROSPECT', label: 'Prospect' }]}
              onChange={(e) => setRecipientType(e.target.value as any)} />
            {recipientType === 'CLIENT'
              ? <SearchSelect label="Client *" options={clientOptions} value={clientId} onChange={setClientId} onSearch={searchClients} placeholder="Rechercher un client…" />
              : <SearchSelect label="Prospect *" options={prospectOptions} value={prospectId} onChange={setProspectId} onSearch={searchProspects} placeholder="Rechercher un prospect…" />}
            <Select label="Type de devis *" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} />
            <Input label="Validité (jusqu'au)" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            <Select label="Bien concerné" value={assetType}
              options={[{ value: 'NONE', label: 'Aucun' }, { value: 'TERRAIN', label: 'Un terrain' }, { value: 'PROPERTY', label: 'Un bien' }]}
              onChange={(e) => {
                setAssetType(e.target.value as any);
                setItems((prev) => prev.filter((l) => !l.assetKind));
                setTerrainIds([]);
                setPropertyIds([]);
              }} />
            <Input label="Objet du devis" value={objet} onChange={(e) => setObjet(e.target.value)}
              placeholder="Ex. : Aménagement de villa, Étude de viabilisation…" maxLength={255} />
          </div>
          {assetType === 'TERRAIN' && (
            <div className="mt-4">
              <MultiAssetSelect
                label="Terrain(s)"
                options={terrainOptionsMulti}
                values={terrainIds}
                onChange={handleTerrainIdsChange}
                onSearch={searchTerrainsMulti}
                placeholder="Rechercher un terrain…"
              />
              <p className="mt-1 text-xs text-slate-500">Tous les terrains sélectionnés doivent provenir du même lotissement.</p>
              {type === 'VENTE_TERRAIN' && (
                <p className="mt-1 text-xs text-slate-500">Une ligne est ajoutée/retirée automatiquement au devis pour chaque terrain sélectionné, avec son prix de vente.</p>
              )}
              {hasMixedLotissements && (
                <p className="mt-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  Les terrains sélectionnés proviennent de lotissements différents. Retirez ceux qui n'appartiennent pas au même lotissement avant d'enregistrer.
                </p>
              )}
            </div>
          )}
          {assetType === 'PROPERTY' && (
            <div className="mt-4">
              <MultiAssetSelect
                label="Bien(s)"
                options={propertyOptionsMulti}
                values={propertyIds}
                onChange={handlePropertyIdsChange}
                onSearch={searchPropertiesMulti}
                placeholder="Rechercher un bien…"
              />
              <p className="mt-1 text-xs text-slate-500">Si le premier bien choisi appartient à un programme immobilier, les suivants doivent en provenir également.</p>
              {type === 'VENTE_BIEN' && (
                <p className="mt-1 text-xs text-slate-500">Une ligne est ajoutée/retirée automatiquement au devis pour chaque bien sélectionné, avec son prix de vente.</p>
              )}
              {hasMixedProgrammes && (
                <p className="mt-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  Les biens sélectionnés proviennent de programmes immobiliers différents. Retirez ceux qui n'appartiennent pas au même programme avant d'enregistrer.
                </p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-slate-800">Lignes du devis</h3>
            <div className="flex items-end gap-2">
              <div className="w-72"><CatalogPicker onPick={addFromCatalog} placeholder="Ajouter depuis le catalogue…" excludeIds={usedCatalogItemIds} /></div>
              <Button size="sm" variant="secondary" icon={<Heading className="h-4 w-4" />} onClick={addTitleLine}>Titre</Button>
              <Button size="sm" variant="secondary" icon={<Pilcrow className="h-4 w-4" />} onClick={addSubtitleLine} disabled={!hasArticleLine}
                title={!hasArticleLine ? 'Ajoutez au moins un article avant de pouvoir insérer un sous-titre' : undefined}>Sous-titre</Button>
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addLine}>Ligne vide</Button>
            </div>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Une ligne de <strong>titre</strong> découpe le devis en sections (affichée en évidence au-dessus d'un tableau dédié) ;
            une ligne de <strong>sous-titre</strong> apparaît comme un repère pleine largeur au sein du tableau.
          </p>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-44">Catégorie</th>
                <th className="text-left px-1 py-1 font-medium text-slate-600 w-36">
                  <input value={referenceColumnLabel} onChange={(e) => setReferenceColumnLabel(e.target.value)}
                    maxLength={50} placeholder="Référence / LOT"
                    className="w-full bg-transparent px-1.5 py-1 rounded border border-transparent font-medium text-slate-600 hover:border-slate-300 focus:border-blue-400 focus:bg-white focus:outline-none"
                    title="Cliquez pour renommer le titre de cette colonne" />
                </th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Désignation</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600 w-28">Qté</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600 w-36">Unité</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600 w-40">Prix unitaire</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600 w-40">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((line, idx) => (
                line.lineType !== 'ARTICLE' ? (
                  <tr key={idx} className={`border-t border-slate-100 ${line.lineType === 'TITLE' ? 'bg-slate-100' : 'bg-slate-50'}`}>
                    <td colSpan={7} className="px-2 py-2">
                      <input
                        className={`w-full px-2 py-1.5 border border-slate-200 rounded text-sm ${line.lineType === 'TITLE' ? 'font-bold uppercase' : 'font-semibold italic'}`}
                        placeholder={line.lineType === 'TITLE' ? 'Titre de section (ex : LOT 1 — Terrassement)' : 'Sous-titre'}
                        value={line.designation} onChange={(e) => setLine(idx, { designation: e.target.value })} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-2 py-2">
                      <input className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" placeholder="(facultatif)" list="quote-categories"
                        value={line.category} onChange={(e) => setLine(idx, { category: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" placeholder="(facultatif)"
                        value={line.reference} onChange={(e) => setLine(idx, { reference: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" placeholder="Désignation"
                        value={line.designation} onChange={(e) => setLine(idx, { designation: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" step="1" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right"
                        value={line.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      {line.unitLocked ? (
                        <div className="w-full px-2 py-1.5 border border-slate-100 bg-slate-50 rounded text-sm text-slate-500 flex items-center justify-center gap-1.5" title="Unité définie par l'article du catalogue, non modifiable">
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{line.unit || '—'}</span>
                        </div>
                      ) : (
                        <SearchSelect options={unitOptions} value={line.unit} onChange={(v) => setLine(idx, { unit: v })} placeholder="(facultatif)" />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" step="1" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right"
                        value={line.unitPrice} onChange={(e) => setLine(idx, { unitPrice: e.target.value })} />
                    </td>
                    <td className="px-2 py-2 text-right font-medium">{formatCurrency(totals.lines[idx] ?? 0)}</td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
          <datalist id="quote-categories">
            {knownCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
          <p className="mt-3 text-xs text-slate-400">
            Renseignez une catégorie sur les lignes pour disposer le devis par blocs avec un sous-total par catégorie.
          </p>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Montants & modalités</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <AmountPercentField
              label="Remise"
              isPercent={discountIsPercent}
              onModeChange={setDiscountIsPercent}
              value={discountIsPercent ? discountPercent : discountAmount}
              onValueChange={discountIsPercent ? setDiscountPercent : setDiscountAmount}
              hint={discountIsPercent ? `= ${formatCurrency(totals.effectiveDiscount)}` : undefined}
            />
            <Input label="TVA (%)" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            <AmountPercentField
              label="Acompte attendu"
              isPercent={depositIsPercent}
              onModeChange={setDepositIsPercent}
              value={depositIsPercent ? depositPercent : depositExpected}
              onValueChange={depositIsPercent ? setDepositPercent : setDepositExpected}
              hint={depositIsPercent && totals.effectiveDeposit != null ? `= ${formatCurrency(totals.effectiveDeposit)}` : undefined}
            />
            <Select label="Modalités de paiement" options={MODALITES_OPTIONS} value={paymentModalites} onChange={(e) => setPaymentModalites(e.target.value)} />
            {paymentModalites !== 'CASH' && (
              <Input label="Nombre d'échéances" type="number" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8"><span className="text-slate-500">Sous-total</span><span className="font-medium w-40 text-right">{formatCurrency(totals.subtotal)}</span></div>
            {totals.effectiveDiscount > 0 && (
              <div className="flex gap-8"><span className="text-slate-500">Remise{discountIsPercent ? ` (${Number(discountPercent) || 0} %)` : ''}</span><span className="font-medium w-40 text-right text-red-600">− {formatCurrency(totals.effectiveDiscount)}</span></div>
            )}
            <div className="flex gap-8"><span className="text-slate-500">TVA</span><span className="font-medium w-40 text-right">{formatCurrency(totals.taxAmount)}</span></div>
            <div className="flex gap-8 text-base"><span className="font-semibold text-slate-700">TOTAL</span><span className="font-bold w-40 text-right">{formatCurrency(totals.total)}</span></div>
            {totals.effectiveDeposit != null && totals.effectiveDeposit > 0 && (
              <div className="flex gap-8"><span className="text-slate-500">Acompte attendu{depositIsPercent ? ` (${Number(depositPercent) || 0} %)` : ''}</span><span className="font-medium w-40 text-right">{formatCurrency(totals.effectiveDeposit)}</span></div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Conditions & notes</h3>
          <div className="space-y-4">
            <Textarea label="Conditions" value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} placeholder="Conditions particulières (facultatif)" />
            <Textarea label="Notes internes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (facultatif)" />
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/quotes')}>Annuler</Button>
          <Button type="button" loading={saving} icon={<Save className="h-4 w-4" />} onClick={handleSave}>
            {isEdit ? 'Enregistrer' : 'Créer le devis'}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
