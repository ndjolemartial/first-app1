import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { usePermitProject, useCreatePermitProject, useUpdatePermitProject } from '../hooks/usePermitProjects';
import { usePermitCommunes } from '../hooks/usePermitLibrary';
import { useConstructionProjects } from '../../construction/hooks/useConstructionProjects';
import { useClients } from '../../clients/hooks/useClients';
import { useProspects } from '../../prospects/hooks/useProspects';
import { useSelectableUsers } from '../../users/hooks/useUsers';
import PermitQuickEstimatePanel from '../components/PermitQuickEstimatePanel';
import { formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { NATURE_LABELS, STANDING_LABELS, ZONE_TYPE_LABELS, MISSION_PHASE_LABELS, toOptions } from '../utils/permitLabels';
import { Save } from 'lucide-react';

const clientLabel = (c: any) => formatPersonName(c, '');
const prospectLabel = (p: any) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();

const MISSION_PHASE_ORDER = ['ESQUISSE', 'APS', 'APD', 'PLANS_EXECUTION', 'SUIVI_CHANTIER', 'RECEPTION'];

const initialValues = {
  nom: '',
  clientId: null as number | null,
  prospectId: null as number | null,
  agentId: null as number | null,
  constructionProjectId: null as number | null,
  nature: 'VILLA',
  standing: 'MOYEN_STANDING',
  communeId: null as number | null,
  zoneType: '' as '' | 'URBAINE' | 'RURALE',
  terrainSurface: '' as number | '',
  surfaceBatie: '' as number | '',
  levels: 1,
  hasSousSol: false,
  nombreBatiments: 1,
  coutPrevisionnelTravaux: '' as number | '',
  hasPiscine: false,
  hasAscenseur: false,
  hasGroupeElectrogene: false,
  hasForage: false,
  hasCloture: false,
  hasVoirieInterieure: false,
  missionPhases: ['ESQUISSE', 'APS', 'APD', 'PLANS_EXECUTION'] as string[],
  description: '',
  notes: '',
};

type FormValues = typeof initialValues;

export default function PermitProjectFormPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const { id } = useParams();
  const isEdit = !!id;
  const { data: existingRes } = usePermitProject(isEdit ? Number(id) : 0);
  const existing = existingRes?.data;

  const [values, setValues] = useState<FormValues>(initialValues);
  const set = <K extends keyof FormValues>(key: K, v: FormValues[K]) => setValues((s) => ({ ...s, [key]: v }));

  useEffect(() => {
    if (existing) {
      setValues({
        nom: existing.nom ?? '',
        clientId: existing.clientId ?? null,
        prospectId: existing.prospectId ?? null,
        agentId: existing.agentId ?? null,
        constructionProjectId: existing.constructionProjectId ?? null,
        nature: existing.nature, standing: existing.standing,
        communeId: existing.communeId ?? null, zoneType: existing.zoneType ?? '',
        terrainSurface: existing.terrainSurface != null ? Number(existing.terrainSurface) : '',
        surfaceBatie: Number(existing.surfaceBatie),
        levels: existing.levels, hasSousSol: existing.hasSousSol, nombreBatiments: existing.nombreBatiments,
        coutPrevisionnelTravaux: existing.coutPrevisionnelTravaux != null ? Number(existing.coutPrevisionnelTravaux) : '',
        hasPiscine: existing.hasPiscine, hasAscenseur: existing.hasAscenseur,
        hasGroupeElectrogene: existing.hasGroupeElectrogene, hasForage: existing.hasForage,
        hasCloture: existing.hasCloture, hasVoirieInterieure: existing.hasVoirieInterieure,
        missionPhases: Array.isArray(existing.missionPhases) ? existing.missionPhases : [],
        description: existing.description ?? '', notes: existing.notes ?? '',
      });
    }
  }, [existing]);

  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: prospectsRes } = useProspects({}, 1, 500);
  const { data: usersRes } = useSelectableUsers();
  const { data: communesRes } = usePermitCommunes();
  const { data: constructionProjectsRes } = useConstructionProjects({}, 1, 200);

  const clientOptions = (clientsRes?.data ?? []).map((c: any) => ({ value: String(c.id), label: clientLabel(c) }));
  const prospectOptions = (prospectsRes?.data ?? []).map((p: any) => ({ value: String(p.id), label: prospectLabel(p) }));
  const agentOptions = (usersRes?.data ?? []).map((u: any) => ({ value: String(u.id), label: formatPersonName(u, '') }));
  const communeOptions = (communesRes?.data ?? []).map((c: any) => ({ value: String(c.id), label: c.nom }));
  const constructionProjectOptions = (constructionProjectsRes?.data ?? []).map((p: any) => ({ value: String(p.id), label: `${p.reference} — ${p.nom}` }));

  const searchClients = useMemo(
    () => makeEntitySearch((filters, page, limit) => window.electron.clients.list(token!, filters, page, limit), (c: any) => ({ value: String(c.id), label: clientLabel(c) })),
    [token],
  );
  const searchProspects = useMemo(
    () => makeEntitySearch((filters, page, limit) => window.electron.prospects.list(token!, filters, page, limit), (p: any) => ({ value: String(p.id), label: prospectLabel(p) })),
    [token],
  );

  const createMutation = useCreatePermitProject();
  const updateMutation = useUpdatePermitProject();
  const saving = createMutation.isPending || updateMutation.isPending;

  const hasEnoughForEstimate = Number(values.surfaceBatie) > 0 && values.missionPhases.length > 0;

  const toggleMissionPhase = (phase: string) => {
    set('missionPhases', values.missionPhases.includes(phase)
      ? values.missionPhases.filter((p) => p !== phase)
      : [...values.missionPhases, phase]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...values,
      surfaceBatie: Number(values.surfaceBatie) || 0,
      terrainSurface: values.terrainSurface === '' ? null : Number(values.terrainSurface),
      coutPrevisionnelTravaux: values.coutPrevisionnelTravaux === '' ? null : Number(values.coutPrevisionnelTravaux),
      zoneType: values.zoneType || null,
    };
    const res = isEdit
      ? await updateMutation.mutateAsync({ id: Number(id), payload })
      : await createMutation.mutateAsync(payload);
    if (res.success) navigate(`/permits/projects/${res.data.id}`);
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le projet' : 'Nouveau projet de permis de construire'}
      breadcrumbs={[{ label: 'Devis permis de construire', to: '/permits' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      {hasEnoughForEstimate ? (
        <div className="mb-6">
          <PermitQuickEstimatePanel characteristics={values} />
        </div>
      ) : (
        <div className="mb-6 rounded-lg px-4 py-3 text-sm text-white text-center" style={{ backgroundColor: '#0A1A3F' }}>
          Renseignez la surface bâtie et au moins une phase de mission pour voir l’estimation rapide.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Projet & destinataire</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Nom du projet" required value={values.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Ex: Permis — Villa Riviera M. Koné" />
            </div>
            <SearchSelect label="Client" options={clientOptions} onSearch={searchClients} value={values.clientId ? String(values.clientId) : ''}
              onChange={(v) => set('clientId', v ? Number(v) : null)} placeholder="Rechercher un client…" />
            <SearchSelect label="Prospect" options={prospectOptions} onSearch={searchProspects} value={values.prospectId ? String(values.prospectId) : ''}
              onChange={(v) => set('prospectId', v ? Number(v) : null)} placeholder="Rechercher un prospect…" />
            <SearchSelect label="Agent commercial" options={agentOptions} value={values.agentId ? String(values.agentId) : ''}
              onChange={(v) => set('agentId', v ? Number(v) : null)} placeholder="Rechercher un agent…" />
            <div>
              <Select label="Projet de construction lié (optionnel)" options={constructionProjectOptions} placeholder="Aucun"
                value={values.constructionProjectId ? String(values.constructionProjectId) : ''}
                onChange={(e) => set('constructionProjectId', e.target.value ? Number(e.target.value) : null)} />
              <p className="mt-1 text-xs text-slate-400">Si renseigné, le coût prévisionnel des travaux se déduit par défaut de la dernière estimation de ce projet.</p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Caractéristiques du projet</h3>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Nature" options={toOptions(NATURE_LABELS)} value={values.nature} onChange={(e) => set('nature', e.target.value)} />
            <Select label="Standing" options={toOptions(STANDING_LABELS)} value={values.standing} onChange={(e) => set('standing', e.target.value)} />
            <Select label="Commune" options={communeOptions} placeholder="Non renseignée" value={values.communeId ? String(values.communeId) : ''}
              onChange={(e) => set('communeId', e.target.value ? Number(e.target.value) : null)} />
            <Select label="Zone" options={toOptions(ZONE_TYPE_LABELS)} placeholder="Selon la commune" value={values.zoneType}
              onChange={(e) => set('zoneType', e.target.value as any)} />
            <Input label="Superficie du terrain (m²)" type="number" min={0} step="0.01" value={values.terrainSurface}
              onChange={(e) => set('terrainSurface', e.target.value === '' ? '' : Number(e.target.value))} />
            <Input label="Surface bâtie (m²)" required type="number" min={1} step="0.01" value={values.surfaceBatie}
              onChange={(e) => set('surfaceBatie', e.target.value === '' ? '' : Number(e.target.value))} />
            <Input label="Nombre de niveaux (RDC = 1)" type="number" min={1} value={values.levels} onChange={(e) => set('levels', Number(e.target.value))} />
            <Input label="Nombre de bâtiments" type="number" min={1} value={values.nombreBatiments} onChange={(e) => set('nombreBatiments', Number(e.target.value))} />
            <Input label="Coût prévisionnel des travaux (FCFA)" type="number" min={0} value={values.coutPrevisionnelTravaux}
              onChange={(e) => set('coutPrevisionnelTravaux', e.target.value === '' ? '' : Number(e.target.value))}
              helper="Base des honoraires calculés au pourcentage" />
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
              <input type="checkbox" checked={values.hasSousSol} onChange={(e) => set('hasSousSol', e.target.checked)} className="rounded border-slate-300" />
              Sous-sol
            </label>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Caractéristiques techniques</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              ['hasPiscine', 'Piscine'], ['hasAscenseur', 'Ascenseur'], ['hasGroupeElectrogene', 'Groupe électrogène'],
              ['hasForage', 'Forage'], ['hasCloture', 'Clôture'], ['hasVoirieInterieure', 'Voirie intérieure'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={(values as any)[key]} onChange={(e) => set(key as keyof FormValues, e.target.checked as any)} className="rounded border-slate-300" />
                {label}
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Niveau de prestation (mission)</h3>
          <div className="grid grid-cols-3 gap-2">
            {MISSION_PHASE_ORDER.map((phase) => (
              <label key={phase} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={values.missionPhases.includes(phase)} onChange={() => toggleMissionPhase(phase)} className="rounded border-slate-300" />
                {MISSION_PHASE_LABELS[phase]}
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Notes</h3>
          <div className="space-y-4">
            <Textarea label="Description" value={values.description} onChange={(e) => set('description', e.target.value)} rows={2} />
            <Textarea label="Notes internes" value={values.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Annuler</Button>
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </PageLayout>
  );
}
