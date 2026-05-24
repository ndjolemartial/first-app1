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
import { useConvention } from '../hooks/useConventions';
import { ATTESTATION_TYPE_LABELS } from '../utils/attestationTemplate';
import { formatPersonName } from '../../../shared/utils/format';
import { Save } from 'lucide-react';

const TYPE_OPTIONS = Object.entries(ATTESTATION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const ASSET_OPTIONS = [
  { value: 'TERRAIN', label: 'Un terrain' },
  { value: 'PROPERTY', label: 'Un bien immobilier' },
];

function clientLabel(c: any): string {
  return formatPersonName(c, '');
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
  const { data: terrainsRes } = useTerrains({}, 1, 500);

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
  const terrainOptions = [
    { value: '', label: '— Choisir un terrain —' },
    ...(terrainsRes?.data ?? []).map((t: any) => ({
      value: String(t.id),
      label: `${t.reference}${t.numeroParcelle ? ` — parcelle ${t.numeroParcelle}` : ''}`,
    })),
  ];
  const propertyOptions = [
    { value: '', label: '— Choisir un bien —' },
    ...(propertiesRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.address}, ${p.city}`,
    })),
  ];

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
    if (assetType === 'TERRAIN' && !terrainId) { setError('Sélectionnez un terrain'); return; }
    if (assetType === 'PROPERTY' && !propertyId) { setError('Sélectionnez un bien immobilier'); return; }

    setSaving(true);
    const payload: any = {
      type,
      clientId: Number(clientId),
      secondaryClientId: secondaryClientId ? Number(secondaryClientId) : undefined,
      terrainId: assetType === 'TERRAIN' ? Number(terrainId) : undefined,
      propertyId: assetType === 'PROPERTY' ? Number(propertyId) : undefined,
      conventionId: conventionId ? Number(conventionId) : undefined,
      emittedAt: emittedAt ? new Date(emittedAt).toISOString() : undefined,
      amount: amount ? Number(amount) : undefined,
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
              onChange={(e) => setType(e.target.value)} />
            <Input label="Date d'émission *" type="date" value={emittedAt}
              onChange={(e) => setEmittedAt(e.target.value)} />
            <Select label={type === 'CESSION' ? 'Cessionnaire (bénéficiaire) *' : 'Client bénéficiaire *'}
              options={clientOptions} value={clientId}
              onChange={(e) => setClientId(e.target.value)} />
            {type === 'CESSION' && (
              <Select label="Cédant *" options={secondaryClientOptions} value={secondaryClientId}
                onChange={(e) => setSecondaryClientId(e.target.value)} />
            )}
            {type === 'TRANSFERT_PROPRIETE' && (
              <Select label="Ancien propriétaire (facultatif)" options={secondaryClientOptions}
                value={secondaryClientId} onChange={(e) => setSecondaryClientId(e.target.value)} />
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Bien concerné</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type de bien *" options={ASSET_OPTIONS} value={assetType}
              onChange={(e) => setAssetType(e.target.value)} />
            {assetType === 'TERRAIN' ? (
              <Select label="Terrain *" options={terrainOptions} value={terrainId}
                onChange={(e) => setTerrainId(e.target.value)} />
            ) : (
              <Select label="Bien immobilier *" options={propertyOptions} value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)} />
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Détails complémentaires</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Montant (XOF)" type="number" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={type === 'SOLDE' ? 'Total réglé (frais inclus)' : 'Optionnel'} />
            <Input label="Convention liée (référence)" value={conventionId}
              onChange={(e) => setConventionId(e.target.value)}
              placeholder="ID de la convention (facultatif)" />
          </div>
          <div className="mt-4">
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
