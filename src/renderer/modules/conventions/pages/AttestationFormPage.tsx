import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useAttestation, useCreateAttestation, useUpdateAttestation } from '../hooks/useAttestations';
import { useClients } from '../../clients/hooks/useClients';
import { useProperties } from '../../properties/hooks/useProperties';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { useConvention, useConventions } from '../hooks/useConventions';
import { ATTESTATION_TYPE_LABELS } from '../utils/attestationTemplate';
import { formatPersonName, formatCurrency } from '../../../shared/utils/format';
import { Save } from 'lucide-react';

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

/**
 * Solde d'une convention de souscription : (prix de vente + frais d'ouverture
 * de dossier + montant supplémentaire éventuel) − apport initial − somme des
 * échéances réglées. Les frais de démarches ACD ne sont jamais inclus.
 * Retourne `null` si le calcul n'est pas significatif (pas de prix de vente).
 */
function computeSubscriptionBalance(c: any): number | null {
  if (!c) return null;
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

export default function AttestationFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledConventionId = searchParams.get('conventionId');
  const prefilledType = searchParams.get('type') ?? '';

  const { data: res } = useAttestation(isEdit ? Number(id) : 0);
  const { data: prefilledConv } = useConvention(prefilledConventionId ? Number(prefilledConventionId) : 0);
  const create = useCreateAttestation();
  const update = useUpdateAttestation();
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: propertiesRes } = useProperties({}, 1, 500);

  const [type, setType] = useState(prefilledType || 'ATTRIBUTION');
  const [clientId, setClientId] = useState('');
  const [secondaryClientId, setSecondaryClientId] = useState('');
  const [assetType, setAssetType] = useState('TERRAIN');
  const [terrainId, setTerrainId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [conventionId, setConventionId] = useState(prefilledConventionId ?? '');
  const [emittedAt, setEmittedAt] = useState(toDateInput(new Date()));
  const [amount, setAmount] = useState('');
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
  const terrainFilters = isCession && secondaryClientIdNum > 0
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
  const balance = isSoldeOrTransfert ? computeSubscriptionBalance(selectedConvention) : null;
  const selectedLotissement = showSubscriptionFields ? getConventionLotissement(selectedConvention) : null;

  // Pré-remplissage depuis l'attestation existante (édition)
  useEffect(() => {
    if (isEdit && res?.data) {
      const a = res.data;
      setType(a.type ?? 'ATTRIBUTION');
      setClientId(String(a.clientId ?? ''));
      setSecondaryClientId(a.secondaryClientId ? String(a.secondaryClientId) : '');
      if (a.terrainId) { setAssetType('TERRAIN'); setTerrainId(String(a.terrainId)); }
      if (a.propertyId) { setAssetType('PROPERTY'); setPropertyId(String(a.propertyId)); }
      setConventionId(a.conventionId ? String(a.conventionId) : '');
      setEmittedAt(toDateInput(a.emittedAt));
      setAmount(a.amount != null ? String(a.amount) : '');
      setNotes(a.notes ?? '');
    }
  }, [res, isEdit]);

  // Pré-remplissage depuis la convention source (création depuis ConventionDetailPage)
  useEffect(() => {
    if (!isEdit && prefilledConv?.data) {
      const c = prefilledConv.data;
      setClientId(String(c.clientId));
      if (c.terrainId) { setAssetType('TERRAIN'); setTerrainId(String(c.terrainId)); }
      else if (c.propertyId) { setAssetType('PROPERTY'); setPropertyId(String(c.propertyId)); }
    }
  }, [prefilledConv, isEdit]);

  // Synchronisation du montant avec la convention liée : à chaque changement
  // de sélection on aligne le champ sur le prix de vente de la convention
  // (création ou édition). Lorsqu'aucune convention n'est liée, le champ est
  // remis à vide — cohérent avec les autres champs dérivés (Solde, lotissement)
  // qui s'effacent eux aussi sans convention.
  useEffect(() => {
    if (!hasLinkedConvention) {
      setAmount('');
      return;
    }
    if (selectedConvention?.saleAmount != null) {
      setAmount(String(Number(selectedConvention.saleAmount)));
    }
  }, [hasLinkedConvention, selectedConvention?.id, selectedConvention?.saleAmount]);

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
  let terrainOptions: Array<{ value: string; label: string }>;
  if (isCession && secondaryClientIdNum <= 0) {
    terrainOptions = [{ value: '', label: '— Choisir d\'abord le cédant —' }];
  } else if (isCession && terrainsList.length === 0) {
    terrainOptions = [{ value: '', label: 'Aucun terrain affecté à ce cédant' }];
  } else {
    terrainOptions = [
      { value: '', label: '— Choisir un terrain —' },
      ...terrainsList.map((t: any) => ({
        value: String(t.id),
        label: `${t.reference}${t.numeroParcelle ? ` — parcelle ${t.numeroParcelle}` : ''}`,
      })),
    ];
  }
  const propertyOptions = [
    { value: '', label: '— Choisir un bien —' },
    ...(propertiesRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.address}, ${p.city}`,
    })),
  ];

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
    if (isCession && assetType === 'TERRAIN' && !terrainId) {
      setError('Sélectionnez le terrain cédé');
      return;
    }
    if (isCession && assetType === 'PROPERTY' && !propertyId) {
      setError('Sélectionnez le bien immobilier cédé');
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

    setSaving(true);
    const payload: any = {
      type,
      clientId: Number(clientId),
      secondaryClientId: secondaryClientId ? Number(secondaryClientId) : undefined,
      // Pour SOLDE / TRANSFERT_PROPRIETE on n'attache pas de bien — l'attestation
      // porte sur la souscription dans son ensemble.
      terrainId: !isSoldeOrTransfert && assetType === 'TERRAIN' && terrainId ? Number(terrainId) : undefined,
      propertyId: !isSoldeOrTransfert && assetType === 'PROPERTY' && propertyId ? Number(propertyId) : undefined,
      conventionId: conventionId ? Number(conventionId) : undefined,
      emittedAt: emittedAt ? new Date(emittedAt).toISOString() : undefined,
      // Le montant n'est envoyé que lorsque le champ est visible — c'est-à-dire
      // pour SOLDE / TRANSFERT_PROPRIETE ou lorsqu'une convention est liée.
      amount: showSubscriptionFields && amount ? Number(amount) : undefined,
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
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type d'attestation *" options={TYPE_OPTIONS} value={type}
              onChange={(e) => {
                setType(e.target.value);
                // En CESSION la liste des terrains est restreinte au cédant ;
                // une sélection antérieure peut ne plus être valide.
                setTerrainId('');
              }} />
            <Input label="Date d'émission *" type="date" value={emittedAt}
              onChange={(e) => setEmittedAt(e.target.value)} />
            <Select label={type === 'CESSION' ? 'Cessionnaire (bénéficiaire) *' : 'Client bénéficiaire *'}
              options={clientOptions} value={clientId}
              onChange={(e) => setClientId(e.target.value)} />
            {type === 'CESSION' && (
              <Select label="Cédant *" options={secondaryClientOptions} value={secondaryClientId}
                onChange={(e) => {
                  setSecondaryClientId(e.target.value);
                  // La liste des terrains se restreint au nouveau cédant : on
                  // efface le terrain précédemment choisi.
                  setTerrainId('');
                }} />
            )}
            {type === 'TRANSFERT_PROPRIETE' && (
              <Select label="Ancien propriétaire *" options={secondaryClientOptions}
                value={secondaryClientId} onChange={(e) => setSecondaryClientId(e.target.value)} />
            )}
          </div>
        </Card>

        {!isSoldeOrTransfert && (
          <Card>
            <h3 className="text-base font-semibold text-slate-800 mb-4">Bien concerné</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label={isCession ? 'Type de bien *' : 'Type de bien'} options={ASSET_OPTIONS} value={assetType}
                onChange={(e) => setAssetType(e.target.value)} />
              {assetType === 'TERRAIN' ? (
                <Select label={isCession ? 'Terrain *' : 'Terrain'} options={terrainOptions} value={terrainId}
                  onChange={(e) => setTerrainId(e.target.value)} />
              ) : (
                <Select label={isCession ? 'Bien immobilier *' : 'Bien immobilier'} options={propertyOptions} value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)} />
              )}
            </div>
          </Card>
        )}

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Détails complémentaires</h3>
          <div className="space-y-4">
            {/* Convention liée — seule sur sa ligne */}
            <Select
              label={isSoldeOrTransfert ? 'Convention liée *' : 'Convention liée'}
              options={conventionOptions}
              value={conventionId}
              onChange={(e) => setConventionId(e.target.value)}
            />

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
                    placeholder={selectedConvention ? '—' : 'Sélectionnez une convention'}
                  />
                )}
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
                  placeholder={selectedConvention ? '—' : 'Sélectionnez une convention'}
                />
                <Input
                  label="Ville du lotissement"
                  value={selectedLotissement?.ville ?? ''}
                  readOnly
                  placeholder={selectedConvention ? '—' : 'Sélectionnez une convention'}
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
