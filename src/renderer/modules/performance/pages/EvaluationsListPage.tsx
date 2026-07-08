import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import Modal from '../../../shared/components/ui/Modal';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { ClipboardCheck, PlusCircle, Eye } from 'lucide-react';
import { useEvaluations, useCreateEvaluation, usePerfEmployees } from '../hooks/usePerformance';
import {
  EVAL_STATUS_LABEL, EVAL_STATUS_VARIANT, employeeName,
  type Evaluation, type PerfEmployee, type EvaluationStatus,
} from '../types/performance.types';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

function CreateEvaluationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const create = useCreateEvaluation();
  const { data: empRes } = usePerfEmployees();
  const employees: PerfEmployee[] = empRes?.success ? empRes.data ?? [] : [];
  const { register, handleSubmit, watch } = useForm({
    defaultValues: { employeeId: '', cycleType: 'ANNUEL', year: String(CURRENT_YEAR), quarter: '1' },
  });
  const cycleType = watch('cycleType');

  const onSubmit = async (d: any) => {
    if (!d.employeeId) return;
    const payload = {
      employeeId: Number(d.employeeId), cycleType: d.cycleType, year: Number(d.year),
      quarter: d.cycleType === 'TRIMESTRIEL' ? Number(d.quarter) : null, lines: [],
    };
    const r = await create.mutateAsync(payload);
    if (r.success && r.data) onCreated(r.data.id);
  };

  const empOptions = [{ value: '', label: '— Sélectionner —' },
    ...employees.map((e) => ({ value: String(e.id), label: `${e.matricule} — ${employeeName(e)}` }))];

  return (
    <Modal open onClose={onClose} title="Nouvelle évaluation"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button loading={create.isPending} onClick={handleSubmit(onSubmit)}>Créer</Button>
      </>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Select label="Collaborateur *" options={empOptions} {...register('employeeId')} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Cycle" options={[{ value: 'ANNUEL', label: 'Annuel' }, { value: 'TRIMESTRIEL', label: 'Trimestriel' }]} {...register('cycleType')} />
          <Select label="Année" options={YEARS.map((y) => ({ value: String(y), label: String(y) }))} {...register('year')} />
          {cycleType === 'TRIMESTRIEL' && (
            <Select label="Trimestre" options={[1, 2, 3, 4].map((q) => ({ value: String(q), label: `T${q}` }))} {...register('quarter')} />
          )}
        </div>
        <p className="text-xs text-slate-500">Vous pourrez ensuite calculer les KPI, saisir les appréciations puis lancer le circuit de validation.</p>
      </form>
    </Modal>
  );
}

export default function EvaluationsListPage() {
  const navigate = useNavigate();
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);

  const filters = useMemo(() => {
    const f: any = {};
    if (year) f.year = Number(year);
    if (status) f.status = status;
    return f;
  }, [year, status]);

  const { data, isLoading } = useEvaluations(filters);
  const evaluations: Evaluation[] = data?.success ? data.data ?? [] : [];

  return (
    <PageLayout
      title="Évaluations"
      breadcrumbs={[{ label: 'Performances', to: '/performance/dashboard' }, { label: 'Évaluations' }]}
      actions={<Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => setCreating(true)}>Nouvelle évaluation</Button>}
    >
      <div className="space-y-4">
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select label="Année" options={[{ value: '', label: 'Toutes' }, ...YEARS.map((y) => ({ value: String(y), label: String(y) }))]} value={year} onChange={(e) => setYear(e.target.value)} />
            <Select label="Statut" options={[{ value: '', label: 'Tous' }, ...(Object.keys(EVAL_STATUS_LABEL) as EvaluationStatus[]).map((s) => ({ value: s, label: EVAL_STATUS_LABEL[s] }))]} value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
        </Card>

        <Card padding={false}>
          {isLoading ? (
            <div className="p-4"><SkeletonTable /></div>
          ) : evaluations.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="h-10 w-10" />} title="Aucune évaluation" description="Créez une évaluation pour un collaborateur." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Référence</th>
                    <th className="px-4 py-2">Collaborateur</th>
                    <th className="px-4 py-2">Cycle</th>
                    <th className="px-4 py-2 text-right">Note</th>
                    <th className="px-4 py-2">Statut</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((ev) => (
                    <tr key={ev.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/performance/evaluations/${ev.id}`)}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">{ev.reference}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{employeeName(ev.employee)}<span className="ml-2 text-xs text-slate-400">{ev.employee?.matricule}</span></td>
                      <td className="px-4 py-2 text-slate-600">{ev.cycleType === 'TRIMESTRIEL' ? `T${ev.quarter} ${ev.year}` : `Année ${ev.year}`}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">{ev.globalScore != null ? Number(ev.globalScore).toFixed(1) : '—'}</td>
                      <td className="px-4 py-2"><Badge variant={EVAL_STATUS_VARIANT[ev.status]}>{EVAL_STATUS_LABEL[ev.status]}</Badge></td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />} onClick={(e) => { e.stopPropagation(); navigate(`/performance/evaluations/${ev.id}`); }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {creating && <CreateEvaluationModal onClose={() => setCreating(false)} onCreated={(id) => navigate(`/performance/evaluations/${id}`)} />}
    </PageLayout>
  );
}
