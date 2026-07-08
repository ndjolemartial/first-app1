import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { toast } from '../../../shared/components/ui/Toast';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate } from '../../../shared/utils/format';
import { Calculator, Send, Check, X, Save, Plus, Trash2, CheckCircle2, Circle, ClipboardList } from 'lucide-react';
import {
  useEvaluation, useUpdateEvaluation, useEvaluationAction, useSavePlan, useDeletePlan,
} from '../hooks/usePerformance';
import {
  EVAL_STATUS_LABEL, EVAL_STATUS_VARIANT, PLAN_STATUS_LABEL, employeeName,
  type Evaluation, type EvaluationLine, type ProgressPlan,
} from '../types/performance.types';

const MANAGE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH', 'MANAGER']);
const DIRECTION_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

type DraftLine = Partial<EvaluationLine> & { label: string };

function SignatureStep({ done, at, label }: { done: boolean; at: string | null; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
      <span className={done ? 'text-slate-800' : 'text-slate-400'}>{label}</span>
      {at && <span className="text-xs text-slate-400">— {formatDate(at)}</span>}
    </div>
  );
}

function PlanModal({ evaluationId, employeeId, plan, onClose }: { evaluationId: number; employeeId: number; plan: ProgressPlan | null; onClose: () => void }) {
  const save = useSavePlan();
  const [form, setForm] = useState({
    title: plan?.title ?? '', actions: plan?.actions ?? '', trainingNeeds: plan?.trainingNeeds ?? '',
    dueDate: plan?.dueDate ? plan.dueDate.slice(0, 10) : '', status: plan?.status ?? 'EN_COURS', followUpNotes: plan?.followUpNotes ?? '',
  });
  const submit = async () => {
    if (!form.title.trim()) { toast.error('Intitulé requis'); return; }
    const payload = { ...form, evaluationId, employeeId, dueDate: form.dueDate || null };
    const r = await save.mutateAsync({ id: plan?.id, payload });
    if (r.success) onClose();
  };
  return (
    <Modal open onClose={onClose} title={plan ? 'Modifier le plan de progrès' : 'Nouveau plan de progrès'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button loading={save.isPending} onClick={submit}>Enregistrer</Button></>}
    >
      <div className="space-y-3">
        <Input label="Intitulé *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Textarea label="Actions de progrès" rows={3} value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} />
        <Textarea label="Besoins de formation" rows={2} value={form.trainingNeeds} onChange={(e) => setForm({ ...form, trainingNeeds: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Échéance" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Statut</label>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
              {Object.entries(PLAN_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <Textarea label="Suivi" rows={2} value={form.followUpNotes} onChange={(e) => setForm({ ...form, followUpNotes: e.target.value })} />
      </div>
    </Modal>
  );
}

export default function EvaluationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const evalId = Number(id);
  const role = useAuthStore((s) => s.user?.role ?? '');
  const currentUserId = useAuthStore((s) => s.user?.id ?? 0);

  const { data, isLoading } = useEvaluation(evalId);
  const update = useUpdateEvaluation();
  const actions = useEvaluationAction();
  const delPlan = useDeletePlan();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const evaluation: Evaluation | null = data?.success ? data.data ?? null : null;

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [appr, setAppr] = useState({ strengths: '', areasToImprove: '', comments: '' });
  const [planModal, setPlanModal] = useState<{ plan: ProgressPlan | null } | null>(null);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseReason, setRefuseReason] = useState('');

  useEffect(() => {
    if (evaluation) {
      setLines((evaluation.lines ?? []).map((l) => ({ ...l })));
      setAppr({ strengths: evaluation.strengths ?? '', areasToImprove: evaluation.areasToImprove ?? '', comments: evaluation.comments ?? '' });
    }
  }, [evaluation?.id, evaluation?.lines?.length, evaluation?.status]);

  if (isLoading) return <PageLayout title="Évaluation"><Card><SkeletonTable /></Card></PageLayout>;
  if (!evaluation) return <PageLayout title="Évaluation"><Card>Évaluation introuvable.</Card></PageLayout>;

  const editable = !['VALIDEE_DIRECTION', 'CLOTUREE'].includes(evaluation.status);
  const canManage = MANAGE_ROLES.has(role);
  const isAdmin = DIRECTION_ROLES.has(role);
  const isDraft = evaluation.status === 'BROUILLON' || evaluation.status === 'REFUSEE';
  const isEmployee = evaluation.employee?.userId === currentUserId;

  const computedScore = (() => {
    let s = 0, w = 0;
    for (const l of lines) { if (l.score != null) { s += Number(l.score) * (Number(l.weight) || 1); w += Number(l.weight) || 1; } }
    return w > 0 ? Math.round((s / w) * 10) / 10 : null;
  })();

  const saveAll = async () => {
    const payload = {
      ...appr,
      globalScore: computedScore,
      lines: lines.map((l) => ({
        objectiveId: l.objectiveId ?? null, kpiDefinitionId: l.kpiDefinitionId ?? null, label: l.label,
        weight: Number(l.weight) || 1, targetValue: l.targetValue ?? null, actualValue: l.actualValue ?? null,
        score: l.score ?? null, comment: l.comment ?? null,
      })),
    };
    await update.mutateAsync({ id: evalId, payload });
  };

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <PageLayout
      title={`Évaluation ${evaluation.reference}`}
      breadcrumbs={[{ label: 'Performances', to: '/performance/dashboard' }, { label: 'Évaluations', to: '/performance/evaluations' }, { label: evaluation.reference }]}
      actions={(canManage && editable) || isAdmin ? (
        <div className="flex gap-2">
          {canManage && editable && (
            <>
              <Button variant="secondary" icon={<Calculator className="h-4 w-4" />} loading={actions.computeKpis.isPending} onClick={() => actions.computeKpis.mutate(evalId)}>Calculer les KPI</Button>
              <Button icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={saveAll}>Enregistrer</Button>
            </>
          )}
          {isAdmin && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>Supprimer</Button>
          )}
        </div>
      ) : undefined}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* En-tête */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">{employeeName(evaluation.employee)}</div>
                <div className="text-sm text-slate-500">{evaluation.employee?.poste ?? '—'} · {evaluation.employee?.departement ?? 'Sans service'}</div>
                <div className="mt-1 text-xs text-slate-400">{evaluation.cycleType === 'TRIMESTRIEL' ? `Trimestre ${evaluation.quarter} — ${evaluation.year}` : `Année ${evaluation.year}`}</div>
              </div>
              <div className="text-right">
                <Badge variant={EVAL_STATUS_VARIANT[evaluation.status]}>{EVAL_STATUS_LABEL[evaluation.status]}</Badge>
                <div className="mt-2 text-3xl font-bold text-slate-900">{(computedScore ?? evaluation.globalScore ?? 0).toFixed?.(1) ?? '—'}<span className="text-sm font-normal text-slate-400">/100</span></div>
              </div>
            </div>
            {evaluation.status === 'REFUSEE' && evaluation.refusalReason && (
              <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">Refusée : {evaluation.refusalReason}</div>
            )}
          </Card>

          {/* Lignes KPI / objectifs */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Indicateurs & objectifs évalués</span>
              {canManage && editable && (
                <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setLines([...lines, { label: '', weight: 1 }])}>Ligne</Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Indicateur</th>
                    <th className="px-3 py-2 w-20 text-right">Objectif</th>
                    <th className="px-3 py-2 w-20 text-right">Réalisé</th>
                    <th className="px-3 py-2 w-16 text-right">Pond.</th>
                    <th className="px-3 py-2 w-20 text-right">Note</th>
                    {canManage && editable && <th className="px-3 py-2 w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">Aucune ligne. Cliquez sur « Calculer les KPI » ou ajoutez une ligne.</td></tr>
                  )}
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        {canManage && editable
                          ? <input className="w-full rounded border border-slate-200 px-2 py-1 text-sm" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder="Libellé" />
                          : <span className="text-slate-700">{l.label}{l.kpiDefinition && <span className="ml-1 text-xs text-blue-600">({l.kpiDefinition.label})</span>}</span>}
                      </td>
                      {(['targetValue', 'actualValue', 'weight', 'score'] as const).map((field) => (
                        <td key={field} className="px-3 py-1.5 text-right">
                          {canManage && editable
                            ? <input type="number" step="any" className="w-full rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums" value={l[field] ?? ''} onChange={(e) => setLine(i, { [field]: e.target.value === '' ? null : Number(e.target.value) } as any)} />
                            : <span className="tabular-nums text-slate-700">{l[field] != null ? Number(l[field]).toLocaleString('fr-FR') : '—'}</span>}
                        </td>
                      ))}
                      {canManage && editable && (
                        <td className="px-3 py-1.5 text-right">
                          <button className="text-red-400 hover:text-red-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Appréciations */}
          <Card>
            <div className="mb-2 text-sm font-semibold text-slate-700">Appréciations</div>
            {canManage && editable ? (
              <div className="space-y-3">
                <Textarea label="Points forts" rows={2} value={appr.strengths} onChange={(e) => setAppr({ ...appr, strengths: e.target.value })} />
                <Textarea label="Axes d’amélioration" rows={2} value={appr.areasToImprove} onChange={(e) => setAppr({ ...appr, areasToImprove: e.target.value })} />
                <Textarea label="Commentaire général" rows={2} value={appr.comments} onChange={(e) => setAppr({ ...appr, comments: e.target.value })} />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-slate-600">Points forts :</span> {evaluation.strengths || '—'}</p>
                <p><span className="font-medium text-slate-600">Axes d’amélioration :</span> {evaluation.areasToImprove || '—'}</p>
                <p><span className="font-medium text-slate-600">Commentaire :</span> {evaluation.comments || '—'}</p>
              </div>
            )}
          </Card>

          {/* Plans de progrès */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><ClipboardList className="h-4 w-4" /> Plans de progrès</span>
              {canManage && <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setPlanModal({ plan: null })}>Ajouter</Button>}
            </div>
            <div className="divide-y divide-slate-100">
              {(evaluation.plans ?? []).length === 0 && <div className="px-4 py-4 text-sm text-slate-400">Aucun plan de progrès.</div>}
              {(evaluation.plans ?? []).map((p) => (
                <div key={p.id} className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{p.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === 'REALISE' ? 'success' : p.status === 'ABANDONNE' ? 'default' : 'info'}>{PLAN_STATUS_LABEL[p.status]}</Badge>
                      {canManage && <>
                        <button className="text-slate-400 hover:text-blue-600 text-xs" onClick={() => setPlanModal({ plan: p })}>Modifier</button>
                        <button className="text-red-400 hover:text-red-600" onClick={() => delPlan.mutate(p.id)}><Trash2 className="h-4 w-4" /></button>
                      </>}
                    </div>
                  </div>
                  {p.trainingNeeds && <p className="mt-1 text-xs text-amber-700">Formation : {p.trainingNeeds}</p>}
                  {p.actions && <p className="mt-0.5 text-xs text-slate-500">{p.actions}</p>}
                  {p.dueDate && <p className="mt-0.5 text-xs text-slate-400">Échéance : {formatDate(p.dueDate)}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Colonne latérale : circuit de validation */}
        <div className="space-y-4">
          <Card>
            <div className="mb-3 text-sm font-semibold text-slate-700">Validation électronique</div>
            <div className="space-y-2">
              <SignatureStep done={!!evaluation.managerSignedAt} at={evaluation.managerSignedAt} label="1. Responsable" />
              <SignatureStep done={!!evaluation.employeeSignedAt} at={evaluation.employeeSignedAt} label="2. Collaborateur" />
              <SignatureStep done={!!evaluation.directionSignedAt} at={evaluation.directionSignedAt} label="3. Direction" />
            </div>

            <div className="mt-4 space-y-2">
              {canManage && isDraft && (
                <Button className="w-full" icon={<Send className="h-4 w-4" />} loading={actions.submit.isPending} onClick={() => actions.submit.mutate(evalId)}>Soumettre</Button>
              )}
              {canManage && evaluation.status === 'SOUMISE' && (
                <Button className="w-full" icon={<Check className="h-4 w-4" />} loading={actions.sign.isPending} onClick={() => actions.sign.mutate({ id: evalId, level: 'MANAGER' })}>Valider (responsable)</Button>
              )}
              {isEmployee && evaluation.status === 'VALIDEE_RESPONSABLE' && (
                <Button className="w-full" icon={<Check className="h-4 w-4" />} loading={actions.sign.isPending} onClick={() => actions.sign.mutate({ id: evalId, level: 'EMPLOYEE' })}>Signer (collaborateur)</Button>
              )}
              {DIRECTION_ROLES.has(role) && evaluation.status === 'VALIDEE_COLLABORATEUR' && (
                <Button className="w-full" icon={<Check className="h-4 w-4" />} loading={actions.sign.isPending} onClick={() => actions.sign.mutate({ id: evalId, level: 'DIRECTION' })}>Valider (Direction)</Button>
              )}
              {canManage && !['BROUILLON', 'VALIDEE_DIRECTION', 'CLOTUREE', 'REFUSEE'].includes(evaluation.status) && (
                <Button variant="danger" className="w-full" icon={<X className="h-4 w-4" />} onClick={() => setRefuseOpen(true)}>Refuser</Button>
              )}
            </div>
            {evaluation.evaluator && <div className="mt-3 text-xs text-slate-400">Évaluateur : {employeeName(evaluation.evaluator)}</div>}
          </Card>
        </div>
      </div>

      {planModal && <PlanModal evaluationId={evalId} employeeId={evaluation.employeeId} plan={planModal.plan} onClose={() => setPlanModal(null)} />}
      {refuseOpen && (
        <Modal open onClose={() => setRefuseOpen(false)} title="Refuser l’évaluation"
          footer={<><Button variant="secondary" onClick={() => setRefuseOpen(false)}>Annuler</Button>
            <Button variant="danger" loading={actions.refuse.isPending} onClick={async () => { await actions.refuse.mutateAsync({ id: evalId, reason: refuseReason }); setRefuseOpen(false); }}>Refuser</Button></>}
        >
          <Textarea label="Motif du refus" rows={3} value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} />
        </Modal>
      )}
      {confirmDelete && (
        <ConfirmDialog
          open
          title="Supprimer l’évaluation"
          message={`Supprimer définitivement l’évaluation ${evaluation.reference} de ${employeeName(evaluation.employee)} ? Cette action est réservée aux administrateurs.`}
          confirmLabel="Supprimer"
          loading={actions.remove.isPending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const r = await actions.remove.mutateAsync(evalId);
            setConfirmDelete(false);
            if (r.success) navigate('/performance/evaluations');
          }}
        />
      )}
    </PageLayout>
  );
}
