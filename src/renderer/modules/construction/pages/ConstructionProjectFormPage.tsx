import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useConstructionProject, useCreateConstructionProject, useUpdateConstructionProject } from '../hooks/useConstructionProjects';
import { useConstructionLocalities } from '../hooks/useConstructionLibrary';
import { useClients } from '../../clients/hooks/useClients';
import { useProspects } from '../../prospects/hooks/useProspects';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { useSelectableUsers } from '../../users/hooks/useUsers';
import QuickEstimatePanel from '../components/QuickEstimatePanel';
import { formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  BUILDING_TYPE_LABELS, STANDING_LABELS, ROOF_TYPE_LABELS, JOINERY_TYPE_LABELS, FLOORING_TYPE_LABELS,
  AC_TYPE_LABELS, KITCHEN_TYPE_LABELS, TERRAIN_TYPE_LABELS, SANITATION_TYPE_LABELS, toOptions,
} from '../utils/constructionLabels';
import { Save } from 'lucide-react';

const clientLabel = (c: any) => formatPersonName(c, '');
const prospectLabel = (p: any) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
const terrainLabel = (t: any) => t.reference;

const initialValues = {
  nom: '',
  clientId: null as number | null,
  prospectId: null as number | null,
  terrainId: null as number | null,
  agentId: null as number | null,
  buildingType: 'VILLA_BASSE',
  standing: 'MOYEN_STANDING',
  levels: 1,
  roomCount: 5,
  livingRoomCount: 1,
  bedroomCount: 3,
  bathroomCount: 0,
  showerRoomCount: 2,
  wcCount: 1,
  surfaceHabitable: '' as number | '',
  surfaceConstruite: '' as number | '',
  kitchenType: 'EQUIPEE_STANDARD',
  roofType: 'DALLE_PLEINE',
  joineryType: 'ALUMINIUM_STANDARD',
  flooringType: 'CARRELAGE_GRES_STANDARD',
  acType: 'SPLIT_PARTIEL',
  hasFalseCeiling: false,
  terrainType: 'PLAT',
  localityId: null as number | null,
  ville: '',
  sanitationType: 'FOSSE_SEPTIQUE_PUISARD',
  fenceLength: '' as number | '',
  gateCount: 0,
  hasPool: false,
  poolSurface: '' as number | '',
  hasExteriorLayout: false,
  description: '',
  notes: '',
};

type FormValues = typeof initialValues;

export default function ConstructionProjectFormPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const { id } = useParams();
  const isEdit = !!id;
  const { data: existingRes } = useConstructionProject(isEdit ? Number(id) : 0);
  const existing = existingRes?.data;

  const [values, setValues] = useState<FormValues>(initialValues);
  const set = <K extends keyof FormValues>(key: K, v: FormValues[K]) => setValues((s) => ({ ...s, [key]: v }));

  useEffect(() => {
    if (existing) {
      setValues({
        nom: existing.nom ?? '',
        clientId: existing.clientId ?? null,
        prospectId: existing.prospectId ?? null,
        terrainId: existing.terrainId ?? null,
        agentId: existing.agentId ?? null,
        buildingType: existing.buildingType, standing: existing.standing,
        levels: existing.levels, roomCount: existing.roomCount, livingRoomCount: existing.livingRoomCount,
        bedroomCount: existing.bedroomCount, bathroomCount: existing.bathroomCount, showerRoomCount: existing.showerRoomCount,
        wcCount: existing.wcCount, surfaceHabitable: Number(existing.surfaceHabitable),
        surfaceConstruite: existing.surfaceConstruite != null ? Number(existing.surfaceConstruite) : '',
        kitchenType: existing.kitchenType, roofType: existing.roofType, joineryType: existing.joineryType,
        flooringType: existing.flooringType, acType: existing.acType, hasFalseCeiling: existing.hasFalseCeiling,
        terrainType: existing.terrainType, localityId: existing.localityId ?? null, ville: existing.ville ?? '',
        sanitationType: existing.sanitationType,
        fenceLength: existing.fenceLength != null ? Number(existing.fenceLength) : '',
        gateCount: existing.gateCount, hasPool: existing.hasPool,
        poolSurface: existing.poolSurface != null ? Number(existing.poolSurface) : '',
        hasExteriorLayout: existing.hasExteriorLayout,
        description: existing.description ?? '', notes: existing.notes ?? '',
      });
    }
  }, [existing]);

  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: prospectsRes } = useProspects({}, 1, 500);
  const { data: terrainsRes } = useTerrains({}, 1, 500);
  const { data: usersRes } = useSelectableUsers();
  const { data: localitiesRes } = useConstructionLocalities();

  const clientOptions = (clientsRes?.data ?? []).map((c: any) => ({ value: String(c.id), label: clientLabel(c) }));
  const prospectOptions = (prospectsRes?.data ?? []).map((p: any) => ({ value: String(p.id), label: prospectLabel(p) }));
  const terrainOptions = (terrainsRes?.data ?? []).map((t: any) => ({ value: String(t.id), label: terrainLabel(t) }));
  const agentOptions = (usersRes?.data ?? []).map((u: any) => ({ value: String(u.id), label: formatPersonName(u, '') }));
  const localityOptions = (localitiesRes?.data ?? []).map((l: any) => ({ value: String(l.id), label: l.label }));

  // Recherche côté serveur — non bornée aux 500 premiers enregistrements préchargés.
  const searchClients = useMemo(
    () => makeEntitySearch((filters, page, limit) => window.electron.clients.list(token!, filters, page, limit), (c: any) => ({ value: String(c.id), label: clientLabel(c) })),
    [token],
  );
  const searchProspects = useMemo(
    () => makeEntitySearch((filters, page, limit) => window.electron.prospects.list(token!, filters, page, limit), (p: any) => ({ value: String(p.id), label: prospectLabel(p) })),
    [token],
  );
  const searchTerrains = useMemo(
    () => makeEntitySearch((filters, page, limit) => window.electron.terrains.list(token!, filters, page, limit), (t: any) => ({ value: String(t.id), label: terrainLabel(t) })),
    [token],
  );

  const createMutation = useCreateConstructionProject();
  const updateMutation = useUpdateConstructionProject();
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...values,
      surfaceHabitable: Number(values.surfaceHabitable) || 0,
      surfaceConstruite: values.surfaceConstruite === '' ? null : Number(values.surfaceConstruite),
      fenceLength: values.fenceLength === '' ? null : Number(values.fenceLength),
      poolSurface: values.poolSurface === '' ? null : Number(values.poolSurface),
    };
    const res = isEdit
      ? await updateMutation.mutateAsync({ id: Number(id), payload })
      : await createMutation.mutateAsync(payload);
    if (res.success) navigate(`/construction/projects/${res.data.id}`);
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le projet' : 'Nouveau projet de construction'}
      breadcrumbs={[{ label: 'Devis construction', to: '/construction' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      {Number(values.surfaceHabitable) > 0 ? (
        <div className="mb-6">
          <QuickEstimatePanel characteristics={values} />
        </div>
      ) : (
        <div className="mb-6 rounded-lg bg-slate-600 px-4 py-3 text-sm text-white text-center">
          Renseignez la surface habitable pour voir l’estimation rapide.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Projet & destinataire</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Nom du projet" required value={values.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Ex: Villa Riviera — M. Koné" />
            </div>
            <SearchSelect label="Client" options={clientOptions} onSearch={searchClients} value={values.clientId ? String(values.clientId) : ''}
              onChange={(v) => set('clientId', v ? Number(v) : null)} placeholder="Rechercher un client…" />
            <SearchSelect label="Prospect" options={prospectOptions} onSearch={searchProspects} value={values.prospectId ? String(values.prospectId) : ''}
              onChange={(v) => set('prospectId', v ? Number(v) : null)} placeholder="Rechercher un prospect…" />
            <SearchSelect label="Terrain (optionnel)" options={terrainOptions} onSearch={searchTerrains} value={values.terrainId ? String(values.terrainId) : ''}
              onChange={(v) => set('terrainId', v ? Number(v) : null)} placeholder="Rechercher un terrain…" />
            <SearchSelect label="Agent commercial" options={agentOptions} value={values.agentId ? String(values.agentId) : ''}
              onChange={(v) => set('agentId', v ? Number(v) : null)} placeholder="Rechercher un agent…" />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Bâtiment</h3>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Type de bâtiment" options={toOptions(BUILDING_TYPE_LABELS)} value={values.buildingType} onChange={(e) => set('buildingType', e.target.value)} />
            <Select label="Standing" options={toOptions(STANDING_LABELS)} value={values.standing} onChange={(e) => set('standing', e.target.value)} />
            <Input label="Niveaux (RDC = 1)" type="number" min={1} value={values.levels} onChange={(e) => set('levels', Number(e.target.value))} />
            <Input label="Nombre de pièces" type="number" min={1} value={values.roomCount} onChange={(e) => set('roomCount', Number(e.target.value))} />
            <Input label="Séjours" type="number" min={0} value={values.livingRoomCount} onChange={(e) => set('livingRoomCount', Number(e.target.value))} />
            <Input label="Chambres" type="number" min={0} value={values.bedroomCount} onChange={(e) => set('bedroomCount', Number(e.target.value))} />
            <Input label="Salles de bain (SDB)" type="number" min={0} value={values.bathroomCount} onChange={(e) => set('bathroomCount', Number(e.target.value))} />
            <Input label="Salles d’eau (SDE)" type="number" min={0} value={values.showerRoomCount} onChange={(e) => set('showerRoomCount', Number(e.target.value))} />
            <Input label="WC indépendants" type="number" min={0} value={values.wcCount} onChange={(e) => set('wcCount', Number(e.target.value))} />
            <Input label="Surface habitable (m²)" required type="number" min={1} step="0.01" value={values.surfaceHabitable}
              onChange={(e) => set('surfaceHabitable', e.target.value === '' ? '' : Number(e.target.value))} />
            <Input label="Surface construite (m², optionnel)" type="number" min={0} step="0.01" value={values.surfaceConstruite}
              onChange={(e) => set('surfaceConstruite', e.target.value === '' ? '' : Number(e.target.value))} helper="Vide → dérivée automatiquement" />
            <Select label="Cuisine" options={toOptions(KITCHEN_TYPE_LABELS)} value={values.kitchenType} onChange={(e) => set('kitchenType', e.target.value)} />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Second œuvre & finitions</h3>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Toiture" options={toOptions(ROOF_TYPE_LABELS)} value={values.roofType} onChange={(e) => set('roofType', e.target.value)} />
            <Select label="Menuiserie" options={toOptions(JOINERY_TYPE_LABELS)} value={values.joineryType} onChange={(e) => set('joineryType', e.target.value)} />
            <Select label="Revêtement de sol" options={toOptions(FLOORING_TYPE_LABELS)} value={values.flooringType} onChange={(e) => set('flooringType', e.target.value)} />
            <Select label="Climatisation" options={toOptions(AC_TYPE_LABELS)} value={values.acType} onChange={(e) => set('acType', e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
              <input type="checkbox" checked={values.hasFalseCeiling} onChange={(e) => set('hasFalseCeiling', e.target.checked)} className="rounded border-slate-300" />
              Faux plafond
            </label>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Terrain, localisation & assainissement</h3>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Type de terrain" options={toOptions(TERRAIN_TYPE_LABELS)} value={values.terrainType} onChange={(e) => set('terrainType', e.target.value)} />
            <Select label="Localité (bordereau de prix)" options={localityOptions} placeholder="Par défaut" value={values.localityId ? String(values.localityId) : ''}
              onChange={(e) => set('localityId', e.target.value ? Number(e.target.value) : null)} />
            <Input label="Ville / commune" value={values.ville} onChange={(e) => set('ville', e.target.value)} />
            <Select label="Assainissement" options={toOptions(SANITATION_TYPE_LABELS)} value={values.sanitationType} onChange={(e) => set('sanitationType', e.target.value)} />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Extérieurs</h3>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Clôture (ml)" type="number" min={0} value={values.fenceLength} onChange={(e) => set('fenceLength', e.target.value === '' ? '' : Number(e.target.value))} />
            <Input label="Portails" type="number" min={0} value={values.gateCount} onChange={(e) => set('gateCount', Number(e.target.value))} />
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
              <input type="checkbox" checked={values.hasPool} onChange={(e) => set('hasPool', e.target.checked)} className="rounded border-slate-300" />
              Piscine
            </label>
            {values.hasPool && (
              <Input label="Surface piscine (m²)" type="number" min={0} value={values.poolSurface} onChange={(e) => set('poolSurface', e.target.value === '' ? '' : Number(e.target.value))} />
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
              <input type="checkbox" checked={values.hasExteriorLayout} onChange={(e) => set('hasExteriorLayout', e.target.checked)} className="rounded border-slate-300" />
              Aménagements extérieurs
            </label>
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
