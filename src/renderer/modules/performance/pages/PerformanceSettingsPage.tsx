import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import KpiUnitModal from '../components/KpiUnitModal';
import JobPositionModal from '../../hr/components/JobPositionModal';
import { useJobPositions } from '../../hr/hooks/useHr';
import { toast } from '../../../shared/components/ui/Toast';
import ExportMenu, { type ExportColumn } from '../../../shared/components/ExportMenu';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Sliders, Gauge, PlusCircle, Pencil, Trash2, Scale, Users, Save, Plus, Printer } from 'lucide-react';
import {
  useKpis, useSaveKpi, useDeleteKpi, useWeightProfiles, useSaveWeightProfile, useDeleteWeightProfile,
  useRankingRoster, useSaveRankingRoster, useKpiUnits,
} from '../hooks/usePerformance';
import {
  KPI_SOURCE_LABEL, KPI_METRIC_LABEL, METRICS_BY_SOURCE, employeeName,
  type KpiDefinition, type KpiSource, type WeightProfile, type PerfEmployee,
} from '../types/performance.types';

// ── Export / impression des pondérations par poste ──────────────────────────
type WeightRow = { poste: string; profil: string; kpi: string; weight: number | null };

/** Aplatit les profils en une ligne par (profil, KPI) — un poids par ligne. */
function flattenProfiles(profiles: WeightProfile[]): WeightRow[] {
  return profiles.flatMap((p): WeightRow[] =>
    p.lines.length
      ? p.lines.map((l): WeightRow => ({
          poste: p.poste, profil: p.name,
          kpi: l.kpiDefinition?.label ?? `KPI #${l.kpiDefinitionId}`, weight: Number(l.weight),
        }))
      : [{ poste: p.poste, profil: p.name, kpi: '—', weight: null }],
  );
}

const WEIGHT_EXPORT_COLUMNS: ExportColumn<WeightRow>[] = [
  { header: 'Poste', cell: (r) => r.poste },
  { header: 'Profil', cell: (r) => r.profil },
  { header: 'KPI', cell: (r) => r.kpi },
  { header: 'Poids', cell: (r) => r.weight == null ? '' : String(r.weight) },
];

function RosterTab() {
  const { data, isLoading } = useRankingRoster();
  const save = useSaveRankingRoster();
  const employees: PerfEmployee[] = data?.success ? data.data?.employees ?? [] : [];
  const initial: number[] = data?.success ? data.data?.ids ?? [] : [];
  const [selected, setSelected] = useState<Set<number> | null>(null);

  // Initialise la sélection au premier chargement (roster vide = tous cochés).
  const sel = selected ?? new Set<number>(initial.length ? initial : employees.map((e) => e.id));
  const toggle = (id: number) => {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const allSelected = employees.length > 0 && employees.every((e) => sel.has(e.id));

  const submit = () => {
    // Tous cochés → roster vide (= tous les actifs, comportement par défaut).
    const ids = allSelected ? [] : employees.filter((e) => sel.has(e.id)).map((e) => e.id);
    save.mutate(ids);
  };

  if (isLoading) return <Card className="text-sm text-slate-400">Chargement…</Card>;

  return (
    <Card padding={false}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <div>
          <div className="text-sm font-semibold text-slate-700">Personnel à classer</div>
          <p className="text-xs text-slate-500">Cochez les collaborateurs à inclure dans les classements. Tout cocher revient à classer l’ensemble du personnel actif.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs text-blue-600 hover:underline"
            onClick={() => setSelected(new Set(allSelected ? [] : employees.map((e) => e.id)))}>
            {allSelected ? 'Tout décocher' : 'Tout cocher'}
          </button>
          <Button size="sm" icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={submit}>Enregistrer</Button>
        </div>
      </div>
      {employees.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">Aucun employé actif.</div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-100">
          {employees.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} />
              <span className="font-medium text-slate-800">{employeeName(e)}</span>
              <span className="text-xs text-slate-400">{e.matricule}</span>
              {e.poste && <span className="ml-auto text-xs text-slate-500">{e.poste}</span>}
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}

const SOURCE_OPTIONS = (Object.keys(KPI_SOURCE_LABEL) as KpiSource[]).map((v) => ({ value: v, label: KPI_SOURCE_LABEL[v] }));

function KpiModal({ kpi, onClose }: { kpi: KpiDefinition | null; onClose: () => void }) {
  const save = useSaveKpi();
  const { data: unitsRes } = useKpiUnits();
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [form, setForm] = useState({
    code: kpi?.code ?? '', label: kpi?.label ?? '', category: kpi?.category ?? '',
    source: kpi?.source ?? 'SALES', metric: kpi?.metric ?? 'SALES_AMOUNT',
    unit: kpi?.unit ?? '', direction: kpi?.direction ?? 'HIGHER_BETTER',
    defaultTarget: kpi?.defaultTarget != null ? String(kpi.defaultTarget) : '', isActive: kpi?.isActive ?? true,
  });
  const metricOptions = METRICS_BY_SOURCE[form.source as KpiSource].map((m) => ({ value: m, label: KPI_METRIC_LABEL[m] }));
  const unitOptions = [
    { value: '', label: '— Aucune —' },
    ...((unitsRes?.success && unitsRes.data ? unitsRes.data : []).map((u: any) => ({ value: u.label, label: u.label }))),
  ];

  const submit = async () => {
    if (!form.code.trim() || !form.label.trim()) { toast.error('Code et libellé requis'); return; }
    const payload = {
      code: form.code.trim(), label: form.label.trim(), category: form.category || null,
      source: form.source, metric: form.metric, unit: form.unit || null, direction: form.direction,
      defaultTarget: form.defaultTarget !== '' ? Number(form.defaultTarget) : null, isActive: form.isActive,
    };
    const r = await save.mutateAsync({ id: kpi?.id, payload });
    if (r.success) onClose();
  };

  return (
    <Modal open onClose={onClose} title={kpi ? 'Modifier le KPI' : 'Nouveau KPI'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button loading={save.isPending} onClick={submit}>Enregistrer</Button></>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Code *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SALES_AMOUNT" />
          <Input label="Libellé *" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Source de données" options={SOURCE_OPTIONS} value={form.source} onChange={(e) => {
            const source = e.target.value as KpiSource;
            setForm({ ...form, source, metric: METRICS_BY_SOURCE[source][0] });
          }} />
          <Select label="Métrique" options={metricOptions} value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value as any })} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Unité</label>
              <button
                type="button"
                onClick={() => setUnitModalOpen(true)}
                title="Gérer les unités"
                className="flex items-center gap-1 rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Gérer
              </button>
            </div>
            <SearchSelect options={unitOptions} value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="Rechercher une unité…" />
          </div>
          <Select label="Sens" options={[{ value: 'HIGHER_BETTER', label: 'Plus = mieux' }, { value: 'LOWER_BETTER', label: 'Moins = mieux' }]} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as any })} />
          <Input label="Objectif par défaut" type="number" step="any" value={form.defaultTarget} onChange={(e) => setForm({ ...form, defaultTarget: e.target.value })} />
        </div>
        <Input label="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Actif
        </label>
      </div>
      <KpiUnitModal open={unitModalOpen} onClose={() => setUnitModalOpen(false)} onCreated={(label) => setForm((f) => ({ ...f, unit: label }))} />
    </Modal>
  );
}

function WeightModal({ profile, kpis, onClose }: { profile: WeightProfile | null; kpis: KpiDefinition[]; onClose: () => void }) {
  const save = useSaveWeightProfile();
  const { data: postesRes } = useJobPositions();
  const [posteModalOpen, setPosteModalOpen] = useState(false);
  const [poste, setPoste] = useState(profile?.poste ?? '');
  const [name, setName] = useState(profile?.name ?? '');
  const posteOptions = [
    { value: '', label: '— Sélectionner —' },
    ...((postesRes?.success && postesRes.data ? postesRes.data : []).map((p: any) => ({ value: p.label, label: p.label }))),
  ];
  const [weights, setWeights] = useState<Record<number, string>>(() => {
    const w: Record<number, string> = {};
    (profile?.lines ?? []).forEach((l) => { w[l.kpiDefinitionId] = String(l.weight); });
    return w;
  });

  const submit = async () => {
    if (!poste.trim() || !name.trim()) { toast.error('Poste et nom requis'); return; }
    const lines = Object.entries(weights)
      .filter(([, v]) => v !== '' && Number(v) > 0)
      .map(([kpiDefinitionId, v]) => ({ kpiDefinitionId: Number(kpiDefinitionId), weight: Number(v) }));
    const r = await save.mutateAsync({ id: profile?.id ?? null, payload: { poste: poste.trim(), name: name.trim(), isActive: true, lines } });
    if (r.success) onClose();
  };

  return (
    <Modal open onClose={onClose} title={profile ? 'Modifier le profil de pondération' : 'Nouveau profil de pondération'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button loading={save.isPending} onClick={submit}>Enregistrer</Button></>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Poste *</label>
              <button
                type="button"
                onClick={() => setPosteModalOpen(true)}
                title="Gérer les postes"
                className="flex items-center gap-1 rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Gérer
              </button>
            </div>
            <SearchSelect options={posteOptions} value={poste} onChange={setPoste} placeholder="Rechercher un poste…" />
          </div>
          <Input label="Nom du profil *" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="rounded border border-slate-100">
          <div className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">Poids par KPI</div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {kpis.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="text-sm text-slate-700">{k.label}</span>
                <input type="number" step="any" min={0} className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                  value={weights[k.id] ?? ''} onChange={(e) => setWeights({ ...weights, [k.id]: e.target.value })} placeholder="0" />
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">Les poids sont relatifs : ils sont automatiquement ramenés à 100 % lors du calcul du score.</p>
      </div>
      <JobPositionModal open={posteModalOpen} onClose={() => setPosteModalOpen(false)} onCreated={setPoste} />
    </Modal>
  );
}

export default function PerformanceSettingsPage() {
  const [tab, setTab] = useState<'kpis' | 'weights' | 'roster'>('kpis');
  const { data: kpiRes } = useKpis(true);
  const { data: wRes } = useWeightProfiles();
  const delKpi = useDeleteKpi();
  const delProfile = useDeleteWeightProfile();
  const kpis: KpiDefinition[] = kpiRes?.success ? kpiRes.data ?? [] : [];
  const profiles: WeightProfile[] = wRes?.success ? wRes.data ?? [] : [];

  const [kpiModal, setKpiModal] = useState<{ kpi: KpiDefinition | null } | null>(null);
  const [wModal, setWModal] = useState<{ profile: WeightProfile | null } | null>(null);
  const [delK, setDelK] = useState<KpiDefinition | null>(null);
  const [delP, setDelP] = useState<WeightProfile | null>(null);

  const token = useAuthStore((s) => s.token)!;
  const [printingWeights, setPrintingWeights] = useState(false);
  const weightRows = flattenProfiles(profiles);

  // Impression de la liste des pondérations par poste (aperçu + imprimante).
  const handlePrintWeights = async () => {
    if (weightRows.length === 0) { toast.error('Aucune pondération à imprimer'); return; }
    setPrintingWeights(true);
    try {
      const matrix = weightRows.map((r) =>
        WEIGHT_EXPORT_COLUMNS.map((c) => { const v = c.cell(r); return v === null || v === undefined ? '' : String(v); }),
      );
      const pr = await window.electron.exporter.print(token, {
        fileName: 'ponderations-par-poste',
        title: 'Pondérations par poste',
        headers: WEIGHT_EXPORT_COLUMNS.map((c) => c.header),
        rows: matrix,
        sectionBreakColumn: 0,
      });
      if (!pr.success) toast.error(typeof pr.error === 'string' ? pr.error : "Erreur lors de l'impression");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'impression");
    } finally {
      setPrintingWeights(false);
    }
  };

  return (
    <PageLayout
      title="Performance — Configuration"
      breadcrumbs={[{ label: 'Performances', to: '/performance/dashboard' }, { label: 'Configuration' }]}
      actions={tab === 'kpis'
        ? <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => setKpiModal({ kpi: null })}>Nouveau KPI</Button>
        : tab === 'weights'
          ? (
            <div className="flex flex-wrap gap-2">
              <ExportMenu
                fileName="ponderations-par-poste"
                title="Pondérations par poste"
                columns={WEIGHT_EXPORT_COLUMNS}
                sectionBreakColumn={0}
                fetchRows={async () => weightRows}
              />
              <Button variant="secondary" icon={<Printer className="h-4 w-4" />} loading={printingWeights} onClick={handlePrintWeights}>Imprimer</Button>
              <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => setWModal({ profile: null })}>Nouveau profil</Button>
            </div>
          )
          : undefined}
    >
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-slate-200">
          <button className={`flex items-center gap-2 px-3 py-2 text-sm font-medium ${tab === 'kpis' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`} onClick={() => setTab('kpis')}>
            <Gauge className="h-4 w-4" /> Catalogue KPI
          </button>
          <button className={`flex items-center gap-2 px-3 py-2 text-sm font-medium ${tab === 'weights' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`} onClick={() => setTab('weights')}>
            <Scale className="h-4 w-4" /> Pondération par poste
          </button>
          <button className={`flex items-center gap-2 px-3 py-2 text-sm font-medium ${tab === 'roster' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`} onClick={() => setTab('roster')}>
            <Users className="h-4 w-4" /> Personnel à classer
          </button>
        </div>

        {tab === 'roster' && <RosterTab />}

        {tab === 'kpis' && (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Libellé</th>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Objectif</th>
                    <th className="px-4 py-2">État</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucun KPI. Créez votre premier indicateur.</td></tr>}
                  {kpis.map((k) => (
                    <tr key={k.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-800">{k.label}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{k.code}</td>
                      <td className="px-4 py-2 text-slate-600">{KPI_SOURCE_LABEL[k.source]}</td>
                      <td className="px-4 py-2 tabular-nums text-slate-600">{k.defaultTarget != null ? `${Number(k.defaultTarget).toLocaleString('fr-FR')} ${k.unit ?? ''}` : '—'}</td>
                      <td className="px-4 py-2"><Badge variant={k.isActive ? 'success' : 'default'}>{k.isActive ? 'Actif' : 'Inactif'}</Badge></td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setKpiModal({ kpi: k })} />
                          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />} onClick={() => setDelK(k)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'weights' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {profiles.length === 0 && <Card className="text-sm text-slate-400">Aucun profil de pondération. Créez-en un par poste.</Card>}
            {profiles.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-500">Poste : {p.poste}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setWModal({ profile: p })} />
                    <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />} onClick={() => setDelP(p)} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.lines.map((l) => (
                    <Badge key={l.id} variant="info">{l.kpiDefinition?.label ?? `KPI #${l.kpiDefinitionId}`} · {Number(l.weight)}</Badge>
                  ))}
                  {p.lines.length === 0 && <span className="text-xs text-slate-400">Aucun poids défini</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {kpiModal && <KpiModal kpi={kpiModal.kpi} onClose={() => setKpiModal(null)} />}
      {wModal && <WeightModal profile={wModal.profile} kpis={kpis.filter((k) => k.isActive)} onClose={() => setWModal(null)} />}
      {delK && <ConfirmDialog open title="Supprimer le KPI" message={`Supprimer « ${delK.label} » ?`} confirmLabel="Supprimer" loading={delKpi.isPending} onClose={() => setDelK(null)} onConfirm={async () => { await delKpi.mutateAsync(delK.id); setDelK(null); }} />}
      {delP && <ConfirmDialog open title="Supprimer le profil" message={`Supprimer le profil « ${delP.name} » ?`} confirmLabel="Supprimer" loading={delProfile.isPending} onClose={() => setDelP(null)} onConfirm={async () => { await delProfile.mutateAsync(delP.id); setDelP(null); }} />}
    </PageLayout>
  );
}
