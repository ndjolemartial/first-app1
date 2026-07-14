import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import SearchSelect, { type SearchSelectOption } from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useAttestation, useCreateAttestation, useUpdateAttestation, useLegacyBalance } from '../hooks/useAttestations';
import { useClients } from '../../clients/hooks/useClients';
import { useProperties } from '../../properties/hooks/useProperties';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { useConvention, useConventions } from '../hooks/useConventions';
import { ATTESTATION_TYPE_LABELS } from '../utils/attestationTemplate';
import { formatPersonName, formatCurrency } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Save, X } from 'lucide-react';

const TYPE_OPTIONS = Object.entries(ATTESTATION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const ASSET_OPTIONS = [
  { value: 'TERRAIN', label: 'Un terrain' },
  { value: 'PROPERTY', label: 'Un bien immobilier' },
];

const CONVENTION_TYPE_SHORT: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Location', RENTAL_FURNISHED: 'Loc. meublée',
  SALE: 'Vente', MANAGEMENT: 'Gestion', COMMERCIAL_LEASE: 'Bail comm.',
  SOUSCRIPTION: 'Souscription', AVENANT: 'Avenant', RESILIATION: 'Résiliation',
};

function clientLabel(c: any): string {
  return formatPersonName(c, '');
}

/**
 * Récupère le lotissement rattaché à une convention (via son premier terrain).
 * Toutes les conventions sur terrain partagent un même lotissement, donc le
 * premier terrain est représentatif.
 */
function getConventionLotissement(c: any): { nom: string; ville: string } | null {
  const lot = c?.terrains?.[0]?.terrain?.lotissement;
  if (!lot) return null;
  return { nom: lot.nom ?? '', ville: lot.ville ?? '' };
}

function conventionOptionLabel(c: any): string {
  const t = CONVENTION_TYPE_SHORT[c.type] ?? c.type;
  const lot = getConventionLotissement(c);
  const lotPart = lot?.nom ? ` — Lot. ${lot.nom}` : '';
  return `${c.reference} — ${t}${lotPart}`;
}

const HERITED_CONVENTION_TYPES = ['AVENANT_DELAI_HERITE', 'AVENANT_TRANSFERT_SITE_HERITE', 'AVENANT_RESILIATION_HERITE'];

/** Vrai si la convention est héritée (date d'origine importée ou type hérité). */
function isHeritedConvention(c: any): boolean {
  return !!c && (c.priorConventionDate != null || HERITED_CONVENTION_TYPES.includes(c.type));
}

/** Montant souscrit d'une convention héritée (échéances, sinon montants antérieurs). */
function heritedTotal(c: any): number {
  const active = (c?.installments ?? []).filter((i: any) => i.status !== 'ANNULE');
  if (active.length > 0) return active.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
  return Number(c?.priorTotalBiens ?? c?.priorTotalVersements ?? 0);
}

/**
 * Solde d'une convention de souscription : (prix de vente + frais d'ouverture
 * de dossier + montant supplémentaire éventuel) − apport initial − somme des
 * échéances réglées. Les frais de démarches ACD ne sont jamais inclus.
 *
 * Pour une **convention héritée**, le solde est celui de ses échéances (montant
 * restant dû = amount − paidAmount sur les échéances non annulées) — il peut
 * être ≤ 0. Retourne `null` si le calcul n'est pas significatif.
 */
function computeSubscriptionBalance(c: any): number | null {
  if (!c) return null;
  if (isHeritedConvention(c)) {
    const installments: any[] = (c.installments ?? []).filter((i: any) => i.status !== 'ANNULE');
    if (installments.length > 0) {
      return installments.reduce((s, i) => s + (Number(i.amount) - Number(i.paidAmount ?? 0)), 0);
    }
    return c.priorSolde != null ? Number(c.priorSolde) : null;
  }
  const sale = Number(c.saleAmount ?? 0);
  if (!sale) return null;
  const fraisOuv = Number(c.fraisOuvertureDossier ?? 0);
  const additional = Number(c.additionalAmount ?? 0);
  const totalDu = sale + fraisOuv + additional;
  if (c.paymentModalites === 'CASH') return 0;
  const apport = Number(c.apportInitial ?? 0);
  const installments: any[] = c.installments ?? [];
  const paid = installments
    .filter((i) => i.status === 'PAYE')
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  return Math.max(0, totalDu - apport - paid);
}

function toDateInput(val?: string | Date | null): string {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * Sélecteur multiple (puces + recherche) — même principe que `MultiAssetSelect`
 * dans ConventionFormPage.tsx : ajoute un élément via un `SearchSelect`, l'affiche
 * comme une puce retirable. `options` doit déjà exclure les éléments non éligibles
 * (ex. hors du lotissement/programme verrouillé) tout en conservant ceux déjà
 * sélectionnés (pour l'affichage de leur libellé).
 */
function MultiAssetSelect({
  label,
  options,
  values,
  onChange,
  error,
  onSearch,
  addLabel = '— Ajouter un élément —',
}: {
  label: string;
  options: SearchSelectOption[];
  values: number[];
  onChange: (next: number[]) => void;
  error?: string;
  onSearch?: (query: string) => Promise<SearchSelectOption[]>;
  /** Libellé de l'option vide (ex. invite à choisir un cédant au préalable). */
  addLabel?: string;
}) {
  const selectedSet = new Set(values.map(String));
  const remainingOptions: SearchSelectOption[] = [
    { value: '', label: addLabel },
    ...options.filter((o) => o.value !== '' && !selectedSet.has(o.value)),
  ];
  const labelByValue = new Map(options.filter((o) => o.value !== '').map((o) => [o.value, o.label]));
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
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
        }}
        onSearch={onSearch}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function AttestationFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledConventionId = searchParams.get('conventionId');
  const prefilledType = searchParams.get('type') ?? '';
  // Mode « souscription héritée » : attestation de solde émise sur des échéances
  // sans convention (rattachées directement à un client + terrain). Déclenché par
  // ?legacy=1 (création depuis l'écran Échéances héritées) ou détecté à l'édition.
  const legacyParam = searchParams.get('legacy') === '1';
  const prefilledClientId = searchParams.get('clientId') ?? '';
  const prefilledTerrainId = searchParams.get('terrainId') ?? '';

  const { data: res } = useAttestation(isEdit ? Number(id) : 0);
  const { data: prefilledConv } = useConvention(prefilledConventionId ? Number(prefilledConventionId) : 0);
  const create = useCreateAttestation();
  const update = useUpdateAttestation();
  const token = useAuthStore((s) => s.token)!;
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: propertiesRes } = useProperties({}, 1, 500);

  const [type, setType] = useState(prefilledType || (legacyParam ? 'SOLDE' : 'ATTRIBUTION'));
  const [clientId, setClientId] = useState(prefilledClientId);
  const [secondaryClientId, setSecondaryClientId] = useState('');
  const [assetType, setAssetType] = useState('TERRAIN');
  // Terrain(s) — sélection multiple, restreinte à un même lotissement.
  // Utilisé à la fois par le mode hérité (souscription) et par « Bien concerné »
  // (ATTRIBUTION / CESSION) : ces deux cartes sont mutuellement exclusives.
  const [terrainIds, setTerrainIds] = useState<number[]>(prefilledTerrainId ? [Number(prefilledTerrainId)] : []);
  // « Bien concerné » (ATTRIBUTION / CESSION) uniquement — biens immobiliers,
  // restreints à un même programme immobilier (s'il est déterminable).
  const [propertyIds, setPropertyIds] = useState<number[]>([]);
  const [conventionId, setConventionId] = useState(prefilledConventionId ?? '');
  // Vrai dès qu'on émet/édite une attestation de solde héritée (sans convention).
  const [legacyMode, setLegacyMode] = useState(legacyParam);
  const [emittedAt, setEmittedAt] = useState(toDateInput(new Date()));
  const [amount, setAmount] = useState('');
  const [prixTotalBien, setPrixTotalBien] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isSoldeOrTransfert = type === 'SOLDE' || type === 'TRANSFERT_PROPRIETE';
  const isTransfert = type === 'TRANSFERT_PROPRIETE';
  const isCession = type === 'CESSION';
  const clientIdNum = clientId ? Number(clientId) : 0;
  const secondaryClientIdNum = secondaryClientId ? Number(secondaryClientId) : 0;
  const conventionIdNum = conventionId ? Number(conventionId) : 0;

  // Pour une cession, on ne propose que les terrains affectés au cédant
  // (Terrain.clientId === secondaryClientId). Pour les autres types, on
  // garde la liste complète.
  // En mode hérité, on restreint les terrains à ceux du client bénéficiaire
  // (ce sont les terrains de ses échéances héritées).
  const terrainFilters = legacyMode && clientIdNum > 0
    ? { clientId: clientIdNum }
    : isCession && secondaryClientIdNum > 0
      ? { clientId: secondaryClientIdNum }
      : {};
  const { data: terrainsRes } = useTerrains(terrainFilters, 1, 500);

  // Source des conventions à proposer dans le menu déroulant :
  //   - TRANSFERT_PROPRIETE → conventions de l'ancien propriétaire
  //   - autres types        → conventions du client bénéficiaire
  const conventionsOwnerId = isTransfert ? secondaryClientIdNum : clientIdNum;
  const { data: clientConvsRes } = useConventions(
    conventionsOwnerId > 0 ? { clientId: conventionsOwnerId } : {},
    1, 500,
  );
  // Une attestation ne peut jamais être liée à un avenant ni à une convention
  // de résiliation — on filtre la liste source en conséquence pour tous les
  // types d'attestation.
  const clientConventions: any[] = conventionsOwnerId > 0
    ? (clientConvsRes?.data ?? []).filter(
        (c: any) => c.type !== 'AVENANT' && c.type !== 'RESILIATION',
      )
    : [];

  // Détail de la convention sélectionnée — nécessaire pour récupérer les
  // échéances et calculer le solde restant à régler.
  const { data: selectedConvRes } = useConvention(conventionIdNum);
  const selectedConvention = selectedConvRes?.data;
  // Une convention est considérée comme « liée » dès qu'une référence est
  // sélectionnée dans le menu déroulant. Le détail (selectedConvention) arrive
  // de manière asynchrone — on garde l'UI en place dès la sélection.
  const hasLinkedConvention = conventionIdNum > 0;
  const showSubscriptionFields = isSoldeOrTransfert || hasLinkedConvention;

  // Solde de la souscription héritée (client + terrain(s)). Récupéré côté
  // serveur : total souscrit, encaissé, reste dû. Inactif hors mode hérité.
  const { data: legacyBalanceRes } = useLegacyBalance(
    legacyMode ? clientIdNum : 0,
    legacyMode ? terrainIds : [],
  );
  const legacyInfo = legacyMode ? legacyBalanceRes?.data : undefined;
  const legacyBalance = legacyInfo ? legacyInfo.balance : null;

  // Premier terrain sélectionné (objet) — sert au lotissement affiché en mode
  // hérité (tous les terrains sélectionnés partagent le même lotissement).
  const selectedTerrain = (terrainsRes?.data ?? []).find((t: any) => t.id === terrainIds[0]);

  const balance = legacyMode
    ? legacyBalance
    : (isSoldeOrTransfert ? computeSubscriptionBalance(selectedConvention) : null);
  const selectedLotissement = legacyMode
    ? (selectedTerrain?.lotissement
        ? { nom: selectedTerrain.lotissement.nom ?? '', ville: selectedTerrain.lotissement.ville ?? '' }
        : null)
    : (showSubscriptionFields ? getConventionLotissement(selectedConvention) : null);

  // Pré-remplissage depuis l'attestation existante (édition)
  useEffect(() => {
    if (isEdit && res?.data) {
      const a = res.data;
      setType(a.type ?? 'ATTRIBUTION');
      setClientId(String(a.clientId ?? ''));
      setSecondaryClientId(a.secondaryClientId ? String(a.secondaryClientId) : '');
      // Terrain(s) / bien(s) — sélection multiple : on lit la relation
      // `terrains`/`properties` (join table), avec repli sur le champ
      // singulier terrainId/propertyId pour les attestations mono-bien
      // antérieures à cette fonctionnalité.
      const terrainIdsFromRelation: number[] = (a.terrains ?? []).map((l: any) => l.terrainId ?? l.terrain?.id).filter(Boolean);
      const propertyIdsFromRelation: number[] = (a.properties ?? []).map((l: any) => l.propertyId ?? l.property?.id).filter(Boolean);
      const effTerrainIds = terrainIdsFromRelation.length ? terrainIdsFromRelation : (a.terrainId ? [a.terrainId] : []);
      const effPropertyIds = propertyIdsFromRelation.length ? propertyIdsFromRelation : (a.propertyId ? [a.propertyId] : []);
      setTerrainIds(effTerrainIds);
      setPropertyIds(effPropertyIds);
      const isLegacyAttestation = a.type === 'SOLDE' && !a.conventionId;
      if (!isLegacyAttestation) {
        if (effTerrainIds.length) setAssetType('TERRAIN');
        else if (effPropertyIds.length) setAssetType('PROPERTY');
      }
      setConventionId(a.conventionId ? String(a.conventionId) : '');
      setEmittedAt(toDateInput(a.emittedAt));
      setAmount(a.amount != null ? String(a.amount) : '');
      setPrixTotalBien(a.prixTotalBien != null ? String(a.prixTotalBien) : '');
      setNotes(a.notes ?? '');
      // Attestation de solde sans convention = souscription héritée (avec ou
      // sans terrain rattaché).
      setLegacyMode(isLegacyAttestation);
    }
  }, [res, isEdit]);

  // Pré-remplissage depuis la convention source (création depuis ConventionDetailPage)
  // — une convention rattache ses terrains/biens via les tables de liaison
  // ConventionTerrain/ConventionProperty (sélection multiple côté convention).
  useEffect(() => {
    if (!isEdit && prefilledConv?.data) {
      const c = prefilledConv.data;
      setClientId(String(c.clientId));
      const cTerrainIds: number[] = (c.terrains ?? []).map((l: any) => l.terrainId ?? l.terrain?.id).filter(Boolean);
      const cPropertyIds: number[] = (c.properties ?? []).map((l: any) => l.propertyId ?? l.property?.id).filter(Boolean);
      if (cTerrainIds.length) { setAssetType('TERRAIN'); setTerrainIds(cTerrainIds); }
      else if (cPropertyIds.length) { setAssetType('PROPERTY'); setPropertyIds(cPropertyIds); }
    }
  }, [prefilledConv, isEdit]);

  // Synchronisation du montant avec la convention liée : à chaque changement
  // de sélection on aligne le champ sur le prix de vente de la convention
  // (création ou édition). Lorsqu'aucune convention n'est liée, le champ est
  // remis à vide — cohérent avec les autres champs dérivés (Solde, lotissement)
  // qui s'effacent eux aussi sans convention.
  useEffect(() => {
    // En mode hérité, le montant est piloté par le total de la souscription
    // héritée (effet dédié ci-dessous) — on ne touche pas au champ ici.
    if (legacyMode) return;
    if (!hasLinkedConvention) {
      setAmount('');
      return;
    }
    // Convention héritée sans prix de vente : on aligne le montant sur le total
    // souscrit (somme de ses échéances).
    if (isHeritedConvention(selectedConvention) && selectedConvention?.saleAmount == null) {
      if (!isEdit) setAmount(String(Math.round(heritedTotal(selectedConvention))));
    } else if (selectedConvention?.saleAmount != null) {
      setAmount(String(Number(selectedConvention.saleAmount)));
    }
  }, [legacyMode, hasLinkedConvention, isEdit, selectedConvention?.id, selectedConvention?.saleAmount]);

  // Mode hérité : aligne le montant sur le total souscrit (somme des échéances
  // héritées du couple client/terrain). Ignoré à l'édition pour préserver la
  // valeur déjà saisie sur l'attestation existante.
  useEffect(() => {
    if (!legacyMode || isEdit) return;
    if (legacyInfo?.total != null) setAmount(String(Math.round(legacyInfo.total)));
  }, [legacyMode, isEdit, legacyInfo?.total]);

  // Si le propriétaire des conventions change (client bénéficiaire, ou ancien
  // propriétaire pour un transfert de propriété), on retire la convention liée
  // lorsqu'elle ne lui appartient plus.
  useEffect(() => {
    if (conventionsOwnerId <= 0 || !conventionId) return;
    if (clientConventions.length === 0) return;
    if (!clientConventions.some((c) => String(c.id) === conventionId)) {
      setConventionId('');
    }
  }, [conventionsOwnerId, clientConventions, conventionId]);

  const clientOptions = [
    { value: '', label: '— Choisir un client —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({ value: String(c.id), label: clientLabel(c) })),
  ];
  const secondaryClientOptions = [
    { value: '', label: '— Aucun —' },
    ...(clientsRes?.data ?? [])
      .filter((c: any) => String(c.id) !== clientId)
      .map((c: any) => ({ value: String(c.id), label: clientLabel(c) })),
  ];
  // Liste des terrains à proposer. Pour une cession, on bloque le menu tant
  // qu'aucun cédant n'est sélectionné et on affiche un message dédié si le
  // cédant n'a aucun terrain affecté.
  const terrainsList: any[] = terrainsRes?.data ?? [];
  const terrainAddLabel = isCession && secondaryClientIdNum <= 0
    ? '— Choisir d\'abord le cédant —'
    : (isCession && terrainsList.length === 0 ? 'Aucun terrain affecté à ce cédant' : undefined);
  // « Bien concerné » (ATTRIBUTION / CESSION) — options pour la sélection
  // multiple. Terrains : verrouillés sur le lotissement du premier terrain
  // choisi. Biens : verrouillés sur le programme immobilier du premier bien
  // choisi UNIQUEMENT s'il en a un (sinon sélection libre).
  const lockedLotissementId: number | null = terrainIds.length > 0
    ? (terrainsList.find((t: any) => t.id === terrainIds[0])?.lotissementId ?? null)
    : null;
  const terrainOptionsMulti: SearchSelectOption[] = terrainsList
    .filter((t: any) => terrainIds.includes(t.id) || lockedLotissementId == null || t.lotissementId === lockedLotissementId)
    .map((t: any) => ({
      value: String(t.id),
      label: `${t.reference}${t.numeroParcelle ? ` — parcelle ${t.numeroParcelle}` : ''}${t.lotissement?.nom ? ` (${t.lotissement.nom})` : ''}`,
    }));
  const propertiesList: any[] = propertiesRes?.data ?? [];
  const lockedProgrammeId: number | null = propertyIds.length > 0
    ? (propertiesList.find((p: any) => p.id === propertyIds[0])?.programmeId ?? null)
    : null;
  const propertyOptionsMulti: SearchSelectOption[] = propertiesList
    .filter((p: any) => propertyIds.includes(p.id) || lockedProgrammeId == null || p.programmeId === lockedProgrammeId)
    .map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.address}, ${p.city}`,
    }));
  const hasMixedLotissements = (() => {
    const selected = terrainsList.filter((t: any) => terrainIds.includes(t.id));
    return new Set(selected.map((t: any) => t.lotissementId ?? null)).size > 1;
  })();
  const hasMixedProgrammes = (() => {
    const selected = propertiesList.filter((p: any) => propertyIds.includes(p.id));
    const programmeIds = new Set(selected.map((p: any) => p.programmeId).filter((v: any) => v != null));
    return programmeIds.size > 1;
  })();

  // Recherche distante (serveur) pour afficher n'importe quel enregistrement
  // quel que soit le volume, en conservant les mêmes règles que les listes
  // ci-dessus (cédant exclu du bénéficiaire ; périmètre terrain selon cession/
  // souscription héritée ; verrouillage cession tant qu'aucun cédant n'est choisi).
  const searchClients = makeEntitySearch(
    (f, p, l) => window.electron.clients.list(token, f, p, l),
    (c: any) => ({ value: String(c.id), label: clientLabel(c) }),
  );
  const searchSecondaryClients = async (q: string) => {
    const r: any = await window.electron.clients.list(token, q ? { search: q } : {}, 1, 100);
    return (r?.data ?? [])
      .filter((c: any) => String(c.id) !== clientId)
      .map((c: any) => ({ value: String(c.id), label: clientLabel(c) }));
  };
  // Recherche distante pour la sélection multiple « Bien concerné » —
  // applique en plus le verrouillage lotissement/programme.
  const searchTerrainsMulti = async (q: string) => {
    if (isCession && secondaryClientIdNum <= 0) return [];
    const filters: any = {
      ...terrainFilters,
      ...(q ? { search: q } : {}),
      ...(lockedLotissementId != null ? { lotissementId: lockedLotissementId } : {}),
    };
    const r: any = await window.electron.terrains.list(token, filters, 1, 100);
    return (r?.data ?? []).map((t: any) => ({
      value: String(t.id),
      label: `${t.reference}${t.numeroParcelle ? ` — parcelle ${t.numeroParcelle}` : ''}${t.lotissement?.nom ? ` (${t.lotissement.nom})` : ''}`,
    }));
  };
  const searchPropertiesMulti = async (q: string) => {
    const r: any = await window.electron.properties.list(token, q ? { search: q } : {}, 1, 100);
    return (r?.data ?? [])
      .filter((p: any) => lockedProgrammeId == null || p.programmeId === lockedProgrammeId)
      .map((p: any) => ({ value: String(p.id), label: `${p.reference} — ${p.address}, ${p.city}` }));
  };

  // Options du select Convention liée : dépend du propriétaire des conventions
  // (client bénéficiaire ou ancien propriétaire pour TRANSFERT_PROPRIETE). Si
  // aucun n'est sélectionné, on invite à en choisir un. S'il n'a aucune
  // convention, on affiche le marqueur « Aucune convention ».
  let conventionOptions: Array<{ value: string; label: string }>;
  if (conventionsOwnerId <= 0) {
    conventionOptions = [{
      value: '',
      label: isTransfert ? '— Choisir d\'abord l\'ancien propriétaire —' : '— Choisir d\'abord un client —',
    }];
  } else if (clientConventions.length === 0) {
    conventionOptions = [{ value: '', label: 'Aucune convention' }];
  } else {
    conventionOptions = [
      { value: '', label: '— Choisir une convention —' },
      ...clientConventions.map((c: any) => ({ value: String(c.id), label: conventionOptionLabel(c) })),
    ];
  }

  const handleSave = async () => {
    setError('');
    if (!clientId) { setError('Sélectionnez un client bénéficiaire'); return; }
    if (type === 'CESSION' && !secondaryClientId) {
      setError('Une attestation de cession nécessite un cédant');
      return;
    }
    if (type === 'CESSION' && secondaryClientId === clientId) {
      setError('Le cessionnaire et le cédant doivent être deux clients différents');
      return;
    }
    if (!legacyMode && !isSoldeOrTransfert && isCession && assetType === 'TERRAIN' && terrainIds.length === 0) {
      setError('Sélectionnez au moins un terrain cédé');
      return;
    }
    if (!legacyMode && !isSoldeOrTransfert && isCession && assetType === 'PROPERTY' && propertyIds.length === 0) {
      setError('Sélectionnez au moins un bien immobilier cédé');
      return;
    }
    if (!legacyMode && !isSoldeOrTransfert && assetType === 'TERRAIN' && hasMixedLotissements) {
      setError('Tous les terrains sélectionnés doivent provenir du même lotissement.');
      return;
    }
    if (!legacyMode && !isSoldeOrTransfert && assetType === 'PROPERTY' && hasMixedProgrammes) {
      setError('Tous les biens immobiliers sélectionnés doivent provenir du même programme immobilier.');
      return;
    }
    if (isTransfert && !secondaryClientId) {
      setError('Sélectionnez l\'ancien propriétaire');
      return;
    }
    if (isTransfert && secondaryClientId === clientId) {
      setError('L\'ancien propriétaire et le nouveau bénéficiaire doivent être différents');
      return;
    }
    if (legacyMode) {
      // Souscription héritée : le(s) terrain(s) de souscription sont
      // obligatoires (portés sur l'attestation, et doivent provenir d'un même
      // lotissement). Le solde est vérifié côté serveur sur les échéances
      // héritées du client (repli si les terrains choisis n'ont pas d'échéance
      // rattachée) et doit être inférieur ou égal à 0.
      if (terrainIds.length === 0) {
        setError('Sélectionnez au moins un terrain de la souscription héritée');
        return;
      }
      if (hasMixedLotissements) {
        setError('Tous les terrains sélectionnés doivent provenir du même lotissement.');
        return;
      }
      if (legacyBalance == null) {
        setError('Calcul du solde de la souscription héritée en cours, réessayez dans un instant');
        return;
      }
      if (legacyBalance > 0) {
        setError(`Le solde de la souscription héritée doit être inférieur ou égal à 0 pour émettre cette attestation (solde restant : ${formatCurrency(legacyBalance)}).`);
        return;
      }
    } else {
      if (isSoldeOrTransfert && !conventionId) {
        setError('Sélectionnez la convention liée à l\'attestation');
        return;
      }
      // Une attestation de solde ou de transfert de propriété ne peut être émise
      // que lorsque la souscription est entièrement réglée (solde = 0).
      if (isSoldeOrTransfert) {
        if (!selectedConvention) {
          setError('Chargement de la convention en cours, réessayez dans un instant');
          return;
        }
        if (balance == null || balance > 0) {
          const remaining = balance != null ? formatCurrency(balance) : 'inconnu';
          setError(`Le solde de la convention liée doit être à 0 pour émettre cette attestation (solde restant : ${remaining}).`);
          return;
        }
      }
    }

    setSaving(true);
    const payload: any = {
      type,
      clientId: Number(clientId),
      secondaryClientId: secondaryClientId ? Number(secondaryClientId) : undefined,
      // Mode hérité : on attache le(s) terrain(s) de la souscription (sélection
      // multiple, et aucune convention). Pour une SOLDE / TRANSFERT sur
      // convention, aucun bien n'est attaché — l'attestation porte sur la
      // souscription dans son ensemble. « Bien concerné » (ATTRIBUTION /
      // CESSION) — on envoie toujours les deux tableaux (le non-sélectionné
      // vide) afin que changer de type de bien efface bien l'autre côté serveur.
      terrainIds: legacyMode
        ? terrainIds
        : (!isSoldeOrTransfert ? (assetType === 'TERRAIN' ? terrainIds : []) : undefined),
      propertyIds: (!legacyMode && !isSoldeOrTransfert) ? (assetType === 'PROPERTY' ? propertyIds : []) : undefined,
      conventionId: legacyMode ? undefined : (conventionId ? Number(conventionId) : undefined),
      emittedAt: emittedAt ? new Date(emittedAt).toISOString() : undefined,
      // Le montant n'est envoyé que lorsque le champ est visible — c'est-à-dire
      // pour SOLDE / TRANSFERT_PROPRIETE ou lorsqu'une convention est liée.
      amount: showSubscriptionFields && amount ? Number(amount) : undefined,
      // Prix total du bien — saisi pour l'attestation de solde héritée.
      prixTotalBien: legacyMode && prixTotalBien ? Number(prixTotalBien) : undefined,
      notes: notes || undefined,
    };
    const r = isEdit
      ? await update.mutateAsync({ id: Number(id), payload })
      : await create.mutateAsync(payload);
    setSaving(false);
    if (r.success) navigate(`/conventions/attestations/${r.data?.id ?? id}`);
    else setError(typeof r.error === 'string' ? r.error : 'Échec de l\'enregistrement');
  };

  return (
    <PageLayout
      title={isEdit ? "Modifier l'attestation" : 'Nouvelle attestation'}
      breadcrumbs={[
        { label: 'Conventions', to: '/conventions' },
        { label: 'Attestations', to: '/conventions/attestations' },
        { label: isEdit ? 'Modifier' : 'Nouvelle' },
      ]}
    >
      <div className="space-y-6 max-w-3xl mx-auto">
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Type et bénéficiaire</h3>
          {legacyMode && (
            <p className="mb-4 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              Attestation de solde sur une <strong>souscription héritée</strong> (échéances sans convention).
              Émission réservée aux administrateurs, managers et comptables, et possible uniquement lorsque le
              solde des échéances héritées du client est inférieur ou égal à 0.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type d'attestation *" options={TYPE_OPTIONS} value={type}
              disabled={legacyMode}
              onChange={(e) => {
                setType(e.target.value);
                // En CESSION la liste des terrains est restreinte au cédant ;
                // une sélection antérieure peut ne plus être valide.
                setTerrainIds([]);
                setPropertyIds([]);
              }} />
            <Input label="Date d'émission *" type="date" value={emittedAt}
              onChange={(e) => setEmittedAt(e.target.value)} />
            <SearchSelect label={type === 'CESSION' ? 'Cessionnaire (bénéficiaire) *' : 'Client bénéficiaire *'}
              options={clientOptions} value={clientId} onSearch={searchClients}
              onChange={(v) => setClientId(v)} />
            {type === 'CESSION' && (
              <SearchSelect label="Cédant *" options={secondaryClientOptions} value={secondaryClientId}
                onSearch={searchSecondaryClients}
                onChange={(v) => {
                  setSecondaryClientId(v);
                  // La liste des terrains se restreint au nouveau cédant : on
                  // efface le terrain précédemment choisi.
                  setTerrainIds([]);
                }} />
            )}
            {type === 'TRANSFERT_PROPRIETE' && (
              <SearchSelect label="Ancien propriétaire *" options={secondaryClientOptions}
                value={secondaryClientId} onSearch={searchSecondaryClients}
                onChange={(v) => setSecondaryClientId(v)} />
            )}
          </div>
        </Card>

        {legacyMode ? (
          <Card>
            <h3 className="text-base font-semibold text-slate-800 mb-4">Terrain(s) de la souscription</h3>
            <MultiAssetSelect
              label="Terrain(s) *"
              options={terrainOptionsMulti}
              values={terrainIds}
              onChange={setTerrainIds}
              onSearch={searchTerrainsMulti}
            />
            {hasMixedLotissements && (
              <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                Les terrains sélectionnés proviennent de lotissements différents. Retirez ceux qui n'appartiennent pas au même lotissement avant d'enregistrer.
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Le solde est vérifié sur les échéances héritées du client (le(s) terrain(s) choisi(s) figure(nt) sur l'attestation ;
              si aucune échéance n'y est rattachée, le solde porte sur l'ensemble des échéances héritées du client).
            </p>
          </Card>
        ) : !isSoldeOrTransfert && (
          <Card>
            <h3 className="text-base font-semibold text-slate-800 mb-4">Bien concerné</h3>
            <div className="grid grid-cols-2 gap-4 items-start">
              <Select label={isCession ? 'Type de bien *' : 'Type de bien'} options={ASSET_OPTIONS} value={assetType}
                onChange={(e) => setAssetType(e.target.value)} />
              <div className="space-y-2">
                {assetType === 'TERRAIN' ? (
                  <>
                    <MultiAssetSelect
                      label={isCession ? 'Terrain(s) *' : 'Terrain(s)'}
                      options={terrainOptionsMulti}
                      values={terrainIds}
                      onChange={setTerrainIds}
                      onSearch={searchTerrainsMulti}
                      addLabel={terrainAddLabel}
                    />
                    <p className="text-xs text-slate-500">
                      Tous les terrains sélectionnés doivent provenir du même lotissement.
                    </p>
                    {hasMixedLotissements && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        Les terrains sélectionnés proviennent de lotissements différents. Retirez ceux qui n'appartiennent pas au même lotissement avant d'enregistrer.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <MultiAssetSelect
                      label={isCession ? 'Bien(s) immobilier(s) *' : 'Bien(s) immobilier(s)'}
                      options={propertyOptionsMulti}
                      values={propertyIds}
                      onChange={setPropertyIds}
                      onSearch={searchPropertiesMulti}
                    />
                    <p className="text-xs text-slate-500">
                      Si le premier bien choisi appartient à un programme immobilier, les suivants doivent en provenir également.
                    </p>
                    {hasMixedProgrammes && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        Les biens sélectionnés proviennent de programmes immobiliers différents. Retirez ceux qui n'appartiennent pas au même programme avant d'enregistrer.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Détails complémentaires</h3>
          <div className="space-y-4">
            {/* Convention liée — masquée en mode hérité (aucune convention). */}
            {!legacyMode && (
              <Select
                label={isSoldeOrTransfert ? 'Convention liée *' : 'Convention liée'}
                options={conventionOptions}
                value={conventionId}
                onChange={(e) => setConventionId(e.target.value)}
              />
            )}

            {/* Détails de souscription hérités — rappel informatif. */}
            {legacyMode && legacyInfo?.detailsSouscription && (
              <Input label="Souscription (détails hérités)" value={legacyInfo.detailsSouscription} readOnly />
            )}

            {/* Montant de souscription + Solde restant à payer — visibles
                lorsqu'une convention est liée (ou pour SOLDE / TRANSFERT_PROPRIETE
                où la liaison est obligatoire). */}
            {showSubscriptionFields && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Montant de souscription (XOF)"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Montant de souscription"
                />
                {isSoldeOrTransfert && (
                  <Input
                    label="Solde restant à payer (XOF)"
                    value={balance != null ? formatCurrency(balance) : ''}
                    readOnly
                    placeholder={
                      legacyMode
                        ? (terrainIds.length > 0 ? '—' : 'Sélectionnez un terrain')
                        : (selectedConvention ? '—' : 'Sélectionnez une convention')
                    }
                  />
                )}
              </div>
            )}

            {/* Prix total du bien — attestation de solde sur échéance héritée. */}
            {legacyMode && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Prix Total du bien (XOF)"
                  type="number"
                  value={prixTotalBien}
                  onChange={(e) => setPrixTotalBien(e.target.value)}
                  placeholder="Prix total du bien"
                />
              </div>
            )}

            {/* Nom du lotissement + Ville du lotissement — mêmes conditions
                d'affichage que le bloc montant. */}
            {showSubscriptionFields && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nom du lotissement"
                  value={selectedLotissement?.nom ?? ''}
                  readOnly
                  placeholder={
                    legacyMode
                      ? (terrainIds.length > 0 ? '—' : 'Sélectionnez un terrain')
                      : (selectedConvention ? '—' : 'Sélectionnez une convention')
                  }
                />
                <Input
                  label="Ville du lotissement"
                  value={selectedLotissement?.ville ?? ''}
                  readOnly
                  placeholder={
                    legacyMode
                      ? (terrainIds.length > 0 ? '—' : 'Sélectionnez un terrain')
                      : (selectedConvention ? '—' : 'Sélectionnez une convention')
                  }
                />
              </div>
            )}

            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} placeholder="Précisions complémentaires (facultatif)" />
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/conventions/attestations')}>
            Annuler
          </Button>
          <Button type="button" loading={saving} icon={<Save className="h-4 w-4" />} onClick={handleSave}>
            {isEdit ? 'Enregistrer' : "Émettre l'attestation"}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
