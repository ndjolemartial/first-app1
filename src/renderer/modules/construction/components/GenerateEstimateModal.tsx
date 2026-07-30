import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import { useGenerateEstimate } from '../hooks/useConstructionProjects';
import { useRatioProfiles, useConstructionLocalities } from '../hooks/useConstructionLibrary';
import { useClients } from '../../clients/hooks/useClients';
import { useProspects } from '../../prospects/hooks/useProspects';
import { formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { PRECISION_LEVEL_LABELS, BUILDING_TYPE_LABELS, STANDING_LABELS } from '../utils/constructionLabels';

const clientLabel = (c: any) => formatPersonName(c, '');
const prospectLabel = (p: any) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();

export default function GenerateEstimateModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: any }) {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [precisionLevel, setPrecisionLevel] = useState<'NIVEAU_1' | 'NIVEAU_2'>('NIVEAU_2');
  const [ratioProfileId, setRatioProfileId] = useState('');
  const [localityId, setLocalityId] = useState(project?.localityId ? String(project.localityId) : '');
  const [fraisChantierPct, setFraisChantierPct] = useState('');
  const [fraisGenerauxPct, setFraisGenerauxPct] = useState('');
  const [margePct, setMargePct] = useState('');
  const [tvaPct, setTvaPct] = useState('18');
  const [createQuote, setCreateQuote] = useState(false);
  const [clientId, setClientId] = useState(project?.clientId ? String(project.clientId) : '');
  const [prospectId, setProspectId] = useState(project?.prospectId ? String(project.prospectId) : '');
  const [splitLaborByLot, setSplitLaborByLot] = useState(false);

  const { data: profilesRes } = useRatioProfiles();
  const { data: localitiesRes } = useConstructionLocalities();
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: prospectsRes } = useProspects({}, 1, 500);
  const searchClients = useMemo(
    () => makeEntitySearch((filters, page, limit) => window.electron.clients.list(token!, filters, page, limit), (c: any) => ({ value: String(c.id), label: clientLabel(c) })),
    [token],
  );
  const searchProspects = useMemo(
    () => makeEntitySearch((filters, page, limit) => window.electron.prospects.list(token!, filters, page, limit), (p: any) => ({ value: String(p.id), label: prospectLabel(p) })),
    [token],
  );
  const generate = useGenerateEstimate();

  const profiles = profilesRes?.data ?? [];
  const matchingProfile = profiles.find((p: any) => p.buildingType === project?.buildingType && p.standing === project?.standing);

  const handleSubmit = async () => {
    const payload: any = {
      projectId: project.id,
      precisionLevel,
      options: {
        ratioProfileId: ratioProfileId ? Number(ratioProfileId) : undefined,
        localityId: localityId ? Number(localityId) : undefined,
        fraisChantierPct: fraisChantierPct ? Number(fraisChantierPct) : undefined,
        fraisGenerauxPct: fraisGenerauxPct ? Number(fraisGenerauxPct) : undefined,
        margePct: margePct ? Number(margePct) : undefined,
        tvaPct: tvaPct ? Number(tvaPct) : undefined,
      },
      createQuote,
    };
    if (createQuote) {
      if (!clientId && !prospectId) { return; }
      payload.quote = { clientId: clientId ? Number(clientId) : null, prospectId: prospectId ? Number(prospectId) : null, taxRate: tvaPct ? Number(tvaPct) : 0, splitLaborByLot };
    }
    const res = await generate.mutateAsync(payload);
    if (res.success) {
      onClose();
      navigate(`/construction/estimates/${res.data.id}`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Générer une estimation" size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit} loading={generate.isPending}>Générer</Button>
      </>}
    >
      <div className="space-y-4">
        <Select
          label="Niveau de précision"
          options={[{ value: 'NIVEAU_2', label: PRECISION_LEVEL_LABELS.NIVEAU_2 }, { value: 'NIVEAU_1', label: PRECISION_LEVEL_LABELS.NIVEAU_1 }]}
          value={precisionLevel} onChange={(e) => setPrecisionLevel(e.target.value as any)}
        />
        <Select
          label="Profil de coefficients"
          options={profiles.map((p: any) => ({ value: String(p.id), label: p.name }))}
          placeholder={matchingProfile ? `Auto : ${matchingProfile.name}` : `Aucun profil pour ${BUILDING_TYPE_LABELS[project?.buildingType]} × ${STANDING_LABELS[project?.standing]} — valeurs par défaut`}
          value={ratioProfileId} onChange={(e) => setRatioProfileId(e.target.value)}
        />
        <Select
          label="Localité (prix)"
          options={(localitiesRes?.data ?? []).map((l: any) => ({ value: String(l.id), label: l.label }))}
          placeholder="Prix de référence (Abidjan)"
          value={localityId} onChange={(e) => setLocalityId(e.target.value)}
        />
        <div className="grid grid-cols-4 gap-3">
          <Input label="Frais chantier %" type="number" placeholder="10" value={fraisChantierPct} onChange={(e) => setFraisChantierPct(e.target.value)} />
          <Input label="Frais généraux %" type="number" placeholder="12" value={fraisGenerauxPct} onChange={(e) => setFraisGenerauxPct(e.target.value)} />
          <Input label="Marge %" type="number" placeholder="15" value={margePct} onChange={(e) => setMargePct(e.target.value)} />
          <Input label="TVA %" type="number" value={tvaPct} onChange={(e) => setTvaPct(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={createQuote} onChange={(e) => setCreateQuote(e.target.checked)} className="rounded border-slate-300" />
          Créer aussi le devis commercial (module Devis)
        </label>
        {createQuote && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <SearchSelect label="Client" options={(clientsRes?.data ?? []).map((c: any) => ({ value: String(c.id), label: clientLabel(c) }))}
              onSearch={searchClients} placeholder="Rechercher un client…" value={clientId} onChange={setClientId} />
            <SearchSelect label="Prospect" options={(prospectsRes?.data ?? []).map((p: any) => ({ value: String(p.id), label: prospectLabel(p) }))}
              onSearch={searchProspects} placeholder="Rechercher un prospect…" value={prospectId} onChange={setProspectId} />
            <label className="col-span-2 flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={splitLaborByLot} onChange={(e) => setSplitLaborByLot(e.target.checked)} className="mt-0.5 rounded border-slate-300" />
              <span>
                Détailler la main d'œuvre par lot
                <span className="block text-xs text-slate-400">Ajoute une ligne « Main d'œuvre » à la fin de chaque lot ; le total du devis reste inchangé.</span>
              </span>
            </label>
            {!clientId && !prospectId && <p className="col-span-2 text-xs text-red-500">Sélectionnez un client ou un prospect.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
