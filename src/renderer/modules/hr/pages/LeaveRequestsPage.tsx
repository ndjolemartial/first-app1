import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import Modal from '../../../shared/components/ui/Modal';
import Pagination from '../../../shared/components/ui/Pagination';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate } from '../../../shared/utils/format';
import { PlusCircle, Check, X, Trash2 } from 'lucide-react';
import {
  useLeaveRequests, useLeaveTypes, useEmployees, useCreateLeaveRequest,
  useDecideLeaveRequest, useDeleteLeaveRequest, useLeaveBalance,
} from '../hooks/useHr';
import {
  LEAVE_STATUS_LABEL, LEAVE_STATUS_VARIANT, LEAVE_STATUS_OPTIONS,
  type LeaveRequest, type LeaveType, type Employee,
} from '../types/hr.types';

// Gestion des congés : admins/RH + MANAGER & ASSISTANTE_DIRECTION (ces derniers
// restreints côté IPC aux employés dont le contrat en cours n'est pas un CDI).
const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH', 'MANAGER', 'ASSISTANTE_DIRECTION']);

/** Jours ouvrés (lundi-vendredi) entre deux dates incluses — aperçu côté UI. */
function workingDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start); const e = new Date(end);
  if (e < s) return 0;
  let count = 0;
  const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  while (d <= last) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count += 1;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const create = useCreateLeaveRequest();
  const { data: empRes } = useEmployees({}, 1, 1000);
  const { data: typeRes } = useLeaveTypes();
  const employees: Employee[] = empRes?.data ?? [];
  const types: LeaveType[] = typeRes?.data ?? [];

  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm({
    defaultValues: { employeeId: '', typeId: '', startDate: '', endDate: '', days: '', reason: '' },
  });
  const empId = Number(watch('employeeId')) || 0;
  const start = watch('startDate'); const end = watch('endDate');
  const autoDays = useMemo(() => workingDays(start, end), [start, end]);
  const { data: balRes } = useLeaveBalance(empId);
  const balance = balRes?.data;

  const onSubmit = async (d: any) => {
    if (!d.employeeId || !d.typeId) return;
    const payload = {
      employeeId: Number(d.employeeId), typeId: Number(d.typeId),
      startDate: d.startDate, endDate: d.endDate,
      days: d.days ? Number(d.days) : autoDays,
      reason: d.reason || null,
    };
    const r = await create.mutateAsync(payload);
    if (r.success) onClose();
  };

  const empOptions = [{ value: '', label: '— Sélectionner —' },
    ...employees.map((e) => ({ value: String(e.id), label: `${e.matricule} — ${e.lastName ?? ''} ${e.firstName ?? ''}`.trim() }))];
  const typeOptions = [{ value: '', label: '— Sélectionner —' },
    ...types.map((t) => ({ value: String(t.id), label: t.name }))];

  return (
    <Modal open onClose={onClose} title="Nouvelle demande de congé / absence" size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Enregistrer</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Select label="Employé" options={empOptions} {...register('employeeId', { required: true })} />
        </div>
        {empId > 0 && balance && (
          <div className="sm:col-span-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-slate-700">
            Solde de congés payés : <strong>{balance.remaining} j</strong>
            <span className="text-slate-400"> (acquis {balance.acquired} − pris {balance.taken})</span>
          </div>
        )}
        <Select label="Type" options={typeOptions} {...register('typeId', { required: true })} />
        <div />
        <Input label="Du" type="date" {...register('startDate', { required: true })} />
        <Input label="Au" type="date" {...register('endDate', { required: true })} />
        <Input label={`Nombre de jours (auto : ${autoDays} j ouvrés)`} type="number" step="0.5" min="0"
          placeholder={String(autoDays)} {...register('days')} />
        <div />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Motif (optionnel)</label>
          <textarea rows={2} {...register('reason')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  );
}

export default function LeaveRequestsPage() {
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = WRITE_ROLES.has(role);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const filters = { status: status || undefined };
  const { data, isLoading } = useLeaveRequests(filters, page, 20);
  const decide = useDecideLeaveRequest();
  const del = useDeleteLeaveRequest();

  const requests: LeaveRequest[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Congés & absences"
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Congés' }]}
      actions={
        canWrite && (
          <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
            Nouvelle demande
          </Button>
        )
      }
    >
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select label="Statut" options={[{ value: '', label: 'Tous' }, ...LEAVE_STATUS_OPTIONS]} value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : requests.length === 0 ? (
          <EmptyState title="Aucune demande"
            action={canWrite ? { label: 'Nouvelle demande', onClick: () => setShowCreate(true) } : undefined} />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Employé</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Période</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Jours</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Statut</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-medium text-slate-900">{r.reference}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.employee ? `${r.employee.lastName ?? ''} ${r.employee.firstName ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.type?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(r.startDate)} → {formatDate(r.endDate)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{Number(r.days)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={(LEAVE_STATUS_VARIANT[r.status] ?? 'default') as any}>
                        {LEAVE_STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canWrite && r.status === 'EN_ATTENTE' && (
                          <>
                            <Button variant="ghost" size="sm" title="Approuver" icon={<Check className="h-4 w-4 text-green-600" />}
                              onClick={() => decide.mutate({ id: r.id, status: 'APPROUVE' })} />
                            <Button variant="ghost" size="sm" title="Refuser" icon={<X className="h-4 w-4 text-red-600" />}
                              onClick={() => decide.mutate({ id: r.id, status: 'REFUSE' })} />
                          </>
                        )}
                        {canWrite && (
                          <Button variant="ghost" size="sm" title="Supprimer" icon={<Trash2 className="h-4 w-4" />}
                            onClick={() => del.mutate(r.id)} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </Card>

      {showCreate && <RequestModal onClose={() => setShowCreate(false)} />}
    </PageLayout>
  );
}
