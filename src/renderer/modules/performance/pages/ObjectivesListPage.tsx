import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import Modal from '../../../shared/components/ui/Modal';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { FormSearchSelect } from '../../../shared/components/ui/SearchSelect';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ExportMenu, { type ExportColumn } from '../../../shared/components/ExportMenu';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';
import KpiUnitModal from '../components/KpiUnitModal';
import { Target, PlusCircle, Pencil, Trash2, Plus, Copy, Printer } from 'lucide-react';
import {
  useObjectives, useSaveObjective, useDeleteObjective, usePerfEmployees, useKpis, useKpiUnits,
  useDuplicateObjectives,
} from '../hooks/usePerformance';
import { useJobPositions } from '../../hr/hooks/useHr';
import {
  OBJECTIVE_STATUS_LABEL, OBJECTIVE_STATUS_VARIANT, employeeName,
  type Objective, type PerfEmployee, type KpiDefinition, type ObjectiveStatus,
} from '../types/performance.types';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

/** Colonnes d'export / impression de la liste des objectifs. */
const EXPORT_COLUMNS: ExportColumn<Objective>[] = [
  { header: 'Cible', cell: (o) => o.poste ? `Poste : ${o.poste}` : `${employeeName(o.employee)}${o.employee?.matricule ? ` (${o.employee.matricule})` : ''}` },
  { header: 'Objectif', cell: (o) => o.title },
  { header: 'KPI', cell: (o) => o.kpiDefinition?.label ?? '' },
  { header: 'Cycle', cell: (o) => o.cycleType === 'TRIMESTRIEL' ? `T${o.quarter} ${o.year}` : `Année ${o.year}` },
  { header: 'Objectif chiffré', cell: (o) => o.targetValue != null ? `${Number(o.targetValue)}${o.unit ? ` ${o.unit}` : ''}` : '' },
  { header: 'Pondération', cell: (o) => Number(o.weight).toFixed(1) },
  { header: 'Avancement', cell: (o) => `${o.progress}%` },
  { header: 'Mesure', cell: (o) => o.measureType === 'AUTO' ? 'Automatique (KPI)' : 'Manuelle' },
  { header: 'Statut', cell: (o) => OBJECTIVE_STATUS_LABEL[o.status] },
];

function ObjectiveModal({ objective, onClose }: { objective: Objective | null; onClose: () => void }) {
  const save = useSaveObjective();
  const { data: empRes } = usePerfEmployees();
  const { data: kpiRes } = useKpis();
  const { data: postesRes } = useJobPositions();
  const { data: unitsRes } = useKpiUnits();
  const employees: PerfEmployee[] = empRes?.success ? empRes.data ?? [] : [];
  const kpis: KpiDefinition[] = kpiRes?.success ? kpiRes.data ?? [] : [];
  const postes: any[] = postesRes?.success ? postesRes.data ?? [] : [];
  const [unitModalOpen, setUnitModalOpen] = useState(false);

  const isEdit = !!objective;
  const initialTarget = objective ? (objective.poste ? 'poste' : 'employee') : 'employee';

  const { register, handleSubmit, watch, control, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: objective
      ? {
          targetType: initialTarget,
          employeeId: objective.employeeId ? String(objective.employeeId) : '', poste: objective.poste ?? '',
          cycleType: objective.cycleType, year: String(objective.year),
          quarter: objective.quarter ? String(objective.quarter) : '', title: objective.title,
          description: objective.description ?? '', weight: String(objective.weight ?? 1),
          targetValue: objective.targetValue != null ? String(objective.targetValue) : '', unit: objective.unit ?? '',
          kpiDefinitionId: objective.kpiDefinitionId ? String(objective.kpiDefinitionId) : '',
          measureType: objective.measureType, progress: String(objective.progress ?? 0), status: objective.status,
        }
      : {
          targetType: 'employee', employeeId: '', poste: '', cycleType: 'ANNUEL', year: String(CURRENT_YEAR), quarter: '', title: '',
          description: '', weight: '1', targetValue: '', unit: '', kpiDefinitionId: '',
          measureType: 'MANUAL', progress: '0', status: 'EN_COURS',
        },
  });
  const cycleType = watch('cycleType');
  const targetType = watch('targetType');

  const onSubmit = async (d: any) => {
    if (!d.title) return;
    const byPoste = d.targetType === 'poste';
    if (byPoste ? !d.poste : !d.employeeId) return;
    const payload = {
      employeeId: byPoste ? null : Number(d.employeeId), poste: byPoste ? d.poste : null,
      cycleType: d.cycleType, year: Number(d.year),
      quarter: d.cycleType === 'TRIMESTRIEL' ? Number(d.quarter) || null : null,
      title: d.title, description: d.description || null, weight: Number(d.weight) || 1,
      targetValue: d.targetValue !== '' ? Number(d.targetValue) : null, unit: d.unit || null,
      kpiDefinitionId: d.kpiDefinitionId ? Number(d.kpiDefinitionId) : null,
      measureType: d.measureType, progress: Number(d.progress) || 0, status: d.status,
    };
    const r = await save.mutateAsync({ id: objective?.id, payload });
    if (r.success) onClose();
  };

  const empOptions = [{ value: '', label: '— Sélectionner —' },
    ...employees.map((e) => ({ value: String(e.id), label: `${e.matricule} — ${employeeName(e)}` }))];
  const posteOptions = [{ value: '', label: '— Sélectionner —' },
    ...postes.map((p: any) => ({ value: p.label, label: p.label }))];
  const kpiOptions = [{ value: '', label: '— Aucun (objectif qualitatif) —' },
    ...kpis.map((k) => ({ value: String(k.id), label: k.label }))];
  const unitOptions = [{ value: '', label: '— Aucune —' },
    ...((unitsRes?.success && unitsRes.data ? unitsRes.data : []).map((u: any) => ({ value: u.label, label: u.label })))];

  return (
    <Modal open onClose={onClose} title={objective ? 'Modifier l’objectif' : 'Nouvel objectif'} size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button loading={isSubmitting || save.isPending} onClick={handleSubmit(onSubmit)}>Enregistrer</Button>
      </>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Select label="Cible de l’objectif" disabled={isEdit}
          options={[{ value: 'employee', label: 'Un collaborateur' }, { value: 'poste', label: 'Un poste (tous les employés du poste)' }]}
          {...register('targetType')} />
        {targetType === 'poste'
          ? <Select label="Poste *" options={posteOptions} {...register('poste')} />
          : <Select label="Collaborateur *" options={empOptions} {...register('employeeId')} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Cycle" options={[{ value: 'ANNUEL', label: 'Annuel' }, { value: 'TRIMESTRIEL', label: 'Trimestriel' }]} {...register('cycleType')} />
          <Select label="Année" options={YEARS.map((y) => ({ value: String(y), label: String(y) }))} {...register('year')} />
          {cycleType === 'TRIMESTRIEL' && (
            <Select label="Trimestre" options={[1, 2, 3, 4].map((q) => ({ value: String(q), label: `T${q}` }))} {...register('quarter')} />
          )}
        </div>
        <Input label="Intitulé *" {...register('title')} />
        <Textarea label="Description" rows={2} {...register('description')} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(() => {
            const kpiReg = register('kpiDefinitionId');
            return (
              <Select
                label="KPI mesuré (optionnel)"
                options={kpiOptions}
                {...kpiReg}
                onChange={(e) => {
                  kpiReg.onChange(e);
                  // Sélectionner un KPI bascule la mesure sur « Automatique (KPI) » ;
                  // le retirer revient à « Manuelle ».
                  setValue('measureType', e.target.value ? 'AUTO' : 'MANUAL');
                }}
              />
            );
          })()}
          <Select label="Mesure" options={[{ value: 'MANUAL', label: 'Manuelle' }, { value: 'AUTO', label: 'Automatique (KPI)' }]} {...register('measureType')} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input label="Objectif" type="number" step="any" {...register('targetValue')} />
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
            <FormSearchSelect control={control} name="unit" options={unitOptions} placeholder="Rechercher une unité…" />
          </div>
          <Input label="Pondération" type="number" step="any" {...register('weight')} />
          <Input label="Avancement (%)" type="number" min={0} {...register('progress')} />
        </div>
        <Select label="Statut" options={(Object.keys(OBJECTIVE_STATUS_LABEL) as ObjectiveStatus[]).map((s) => ({ value: s, label: OBJECTIVE_STATUS_LABEL[s] }))} {...register('status')} />
      </form>
      <KpiUnitModal open={unitModalOpen} onClose={() => setUnitModalOpen(false)} onCreated={(label) => setValue('unit', label)} />
    </Modal>
  );
}

const QUARTER_OPTIONS = [1, 2, 3, 4].map((q) => ({ value: String(q), label: `T${q}` }));
const CYCLE_OPTIONS = [{ value: 'ANNUEL', label: 'Annuel' }, { value: 'TRIMESTRIEL', label: 'Trimestriel' }];

function PeriodFields({ prefix, value, onChange }: { prefix: string; value: any; onChange: (v: any) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Select label={`${prefix} — Cycle`} options={CYCLE_OPTIONS} value={value.cycleType} onChange={(e) => onChange({ ...value, cycleType: e.target.value })} />
      <Select label="Année" options={YEARS.map((y) => ({ value: String(y), label: String(y) }))} value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value })} />
      {value.cycleType === 'TRIMESTRIEL' && (
        <Select label="Trimestre" options={QUARTER_OPTIONS} value={value.quarter} onChange={(e) => onChange({ ...value, quarter: e.target.value })} />
      )}
    </div>
  );
}

function DuplicateModal({ initial, onClose }: { initial: { cycleType: string; year: string }; onClose: () => void }) {
  const dup = useDuplicateObjectives();
  const [source, setSource] = useState({ cycleType: initial.cycleType || 'ANNUEL', year: initial.year || String(CURRENT_YEAR), quarter: '1' });
  const [target, setTarget] = useState({ cycleType: initial.cycleType || 'ANNUEL', year: String(CURRENT_YEAR + 1), quarter: '1' });

  const submit = async () => {
    const build = (p: any) => ({ cycleType: p.cycleType, year: Number(p.year), quarter: p.cycleType === 'TRIMESTRIEL' ? Number(p.quarter) : null });
    const r = await dup.mutateAsync({ source: build(source), target: build(target) });
    if (r.success) onClose();
  };

  return (
    <Modal open onClose={onClose} title="Dupliquer des objectifs vers une autre période" size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button icon={<Copy className="h-4 w-4" />} loading={dup.isPending} onClick={submit}>Dupliquer</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-700">Période source (à copier)</div>
          <PeriodFields prefix="Source" value={source} onChange={setSource} />
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-700">Période cible</div>
          <PeriodFields prefix="Cible" value={target} onChange={setTarget} />
        </div>
        <p className="text-xs text-slate-500">
          Les objectifs de la période source (dans votre périmètre) sont recopiés vers la période cible :
          intitulé, cible, pondération et KPI sont conservés ; l'avancement est remis à 0 et le statut à « En cours ».
          Les objectifs déjà présents à l'identique dans la cible sont ignorés.
        </p>
      </div>
    </Modal>
  );
}

export default function ObjectivesListPage() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [cycleType, setCycleType] = useState('');
  const [scope, setScope] = useState('');
  const [poste, setPoste] = useState('');
  const [editing, setEditing] = useState<Objective | null>(null);
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [toDelete, setToDelete] = useState<Objective | null>(null);

  const { data: postesRes } = useJobPositions();
  const posteFilterOptions = [
    { value: '', label: 'Tous les postes' },
    ...((postesRes?.success ? postesRes.data ?? [] : []) as any[]).map((p: any) => ({ value: p.label, label: p.label })),
  ];

  const filters = useMemo(() => {
    const f: any = {};
    if (year) f.year = Number(year);
    if (cycleType) f.cycleType = cycleType;
    if (scope) f.scope = scope;
    if (poste) f.poste = poste;
    return f;
  }, [year, cycleType, scope, poste]);

  const { data, isLoading } = useObjectives(filters);
  const del = useDeleteObjective();
  const objectives: Objective[] = data?.success ? data.data ?? [] : [];

  const token = useAuthStore((s) => s.token)!;
  const [printing, setPrinting] = useState(false);
  const filterSummary = [
    year && `Année : ${year}`,
    cycleType && `Cycle : ${cycleType === 'ANNUEL' ? 'Annuel' : 'Trimestriel'}`,
    scope && `Cible : ${scope === 'employee' ? 'Par collaborateur' : 'Par poste'}`,
    poste && `Poste : ${poste}`,
  ].filter(Boolean).join('   —   ') || undefined;

  // Impression de la liste affichée (aperçu + choix d'imprimante).
  const handlePrint = async () => {
    if (objectives.length === 0) { toast.error('Aucun objectif à imprimer'); return; }
    setPrinting(true);
    try {
      const matrix = objectives.map((o) =>
        EXPORT_COLUMNS.map((c) => {
          const v = c.cell(o);
          return v === null || v === undefined ? '' : String(v);
        }),
      );
      const pr = await window.electron.exporter.print(token, {
        fileName: 'objectifs',
        title: 'Liste des objectifs',
        subtitle: filterSummary,
        headers: EXPORT_COLUMNS.map((c) => c.header),
        rows: matrix,
      });
      if (!pr.success) toast.error(typeof pr.error === 'string' ? pr.error : "Erreur lors de l'impression");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'impression");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PageLayout
      title="Objectifs des collaborateurs"
      breadcrumbs={[{ label: 'Performances', to: '/performance/dashboard' }, { label: 'Objectifs' }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <ExportMenu
            fileName="objectifs"
            title="Liste des objectifs"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => objectives}
          />
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />} loading={printing} onClick={handlePrint}>Imprimer</Button>
          <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => setDuplicating(true)}>Dupliquer une période</Button>
          <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => setCreating(true)}>Nouvel objectif</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Année" options={[{ value: '', label: 'Toutes' }, ...YEARS.map((y) => ({ value: String(y), label: String(y) }))]} value={year} onChange={(e) => setYear(e.target.value)} />
            <Select label="Cycle" options={[{ value: '', label: 'Tous' }, { value: 'ANNUEL', label: 'Annuel' }, { value: 'TRIMESTRIEL', label: 'Trimestriel' }]} value={cycleType} onChange={(e) => setCycleType(e.target.value)} />
            <Select label="Cible" options={[{ value: '', label: 'Toutes' }, { value: 'employee', label: 'Par collaborateur' }, { value: 'poste', label: 'Par poste' }]} value={scope} onChange={(e) => setScope(e.target.value)} />
            <Select label="Poste" options={posteFilterOptions} value={poste} onChange={(e) => setPoste(e.target.value)} />
          </div>
        </Card>

        <Card padding={false}>
          {isLoading ? (
            <div className="p-4"><SkeletonTable /></div>
          ) : objectives.length === 0 ? (
            <EmptyState icon={<Target className="h-10 w-10" />} title="Aucun objectif" description="Fixez des objectifs annuels ou trimestriels à vos collaborateurs." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Collaborateur</th>
                    <th className="px-4 py-2">Objectif</th>
                    <th className="px-4 py-2">Cycle</th>
                    <th className="px-4 py-2 text-right">Pond.</th>
                    <th className="px-4 py-2">Avancement</th>
                    <th className="px-4 py-2">Statut</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {objectives.map((o) => (
                    <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {o.poste
                          ? <span className="inline-flex items-center gap-1"><Badge variant="purple">Poste</Badge> {o.poste}</span>
                          : <>{employeeName(o.employee)}<span className="ml-2 text-xs text-slate-400">{o.employee?.matricule}</span></>}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{o.title}{o.kpiDefinition && <span className="ml-2 text-xs text-blue-600">({o.kpiDefinition.label})</span>}</td>
                      <td className="px-4 py-2 text-slate-600">{o.cycleType === 'TRIMESTRIEL' ? `T${o.quarter} ${o.year}` : `Année ${o.year}`}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">{Number(o.weight).toFixed(1)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, o.progress)}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-slate-500">{o.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2"><Badge variant={OBJECTIVE_STATUS_VARIANT[o.status]}>{OBJECTIVE_STATUS_LABEL[o.status]}</Badge></td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(o)} />
                          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />} onClick={() => setToDelete(o)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {(creating || editing) && <ObjectiveModal objective={editing} onClose={() => { setCreating(false); setEditing(null); }} />}
      {duplicating && <DuplicateModal initial={{ cycleType: cycleType || 'ANNUEL', year }} onClose={() => setDuplicating(false)} />}
      {toDelete && (
        <ConfirmDialog
          open title="Supprimer l’objectif"
          message={`Supprimer l’objectif « ${toDelete.title} » ?`}
          confirmLabel="Supprimer" loading={del.isPending}
          onClose={() => setToDelete(null)}
          onConfirm={async () => { await del.mutateAsync(toDelete.id); setToDelete(null); }}
        />
      )}
    </PageLayout>
  );
}
