import { useEffect, useMemo, useRef, useState } from 'react';
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
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate } from '../../../shared/utils/format';
import { PlusCircle, Check, X, Trash2, Printer, Paperclip, FileCheck2 } from 'lucide-react';
import {
  useLeaveRequests, useLeaveTypes, useEmployees, useCreateLeaveRequest,
  useDecideLeaveRequest, useDeleteLeaveRequest, usePrintLeaveRequest,
  useUploadLeaveSigned, useLeaveBalance,
} from '../hooks/useHr';
import {
  LEAVE_STATUS_LABEL, LEAVE_STATUS_VARIANT, LEAVE_STATUS_OPTIONS,
  type LeaveRequest, type LeaveType, type Employee,
} from '../types/hr.types';

// Gestion des congés : admins/RH + MANAGER & ASSISTANTE_DIRECTION (ces derniers
// restreints côté IPC aux employés dont le contrat en cours n'est pas un CDI).
const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER', 'ASSISTANTE_DIRECTION']);

/**
 * Date de fin (« Au ») calculée à partir d'une date de début et d'un nombre de
 * jours ouvrés : renvoie la date du dernier jour ouvré couvert. Si le début
 * tombe un week-end, le comptage démarre au premier jour ouvré suivant. Les
 * demi-journées étendent la fin jusqu'au jour ouvré touché (arrondi au jour).
 */
function endDateFromWorkingDays(start: string, days: number): string {
  if (!start || !days || days <= 0) return '';
  const s = new Date(start);
  if (isNaN(s.getTime())) return '';
  const target = Math.ceil(days);
  const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  let counted = 0;
  for (let i = 0; i < 3650; i += 1) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      counted += 1;
      if (counted >= target) break;
    }
    d.setDate(d.getDate() + 1);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const create = useCreateLeaveRequest();
  // Sélecteur de la demande de congé : tous les employés actifs (aucune
  // restriction de périmètre, y compris pour AD & MANAGER).
  const { data: empRes } = useEmployees({ status: 'ACTIF', context: 'leaveRequest' }, 1, 1000);
  const { data: typeRes } = useLeaveTypes();
  const employees: Employee[] = empRes?.data ?? [];
  const types: LeaveType[] = typeRes?.data ?? [];

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: { employeeId: '', typeId: '', startDate: '', endDate: '', days: '', reason: '' },
  });
  const empId = Number(watch('employeeId')) || 0;
  const start = watch('startDate'); const days = watch('days');
  // « Au » calculé automatiquement à partir de « Du » et du nombre de jours ouvrés.
  const autoEnd = useMemo(() => endDateFromWorkingDays(start, Number(days)), [start, days]);
  useEffect(() => { setValue('endDate', autoEnd); }, [autoEnd, setValue]);
  const { data: balRes } = useLeaveBalance(empId);
  const balance = balRes?.data;

  const onSubmit = async (d: any) => {
    if (!d.employeeId || !d.typeId) return;
    const payload = {
      employeeId: Number(d.employeeId), typeId: Number(d.typeId),
      startDate: d.startDate, endDate: d.endDate,
      days: Number(d.days) || 0,
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
        <Input label="Nombre de jours ouvrés" type="number" step="0.5" min="0"
          placeholder="0" {...register('days', { required: true })} />
        <Input label="Au (calculé automatiquement)" type="date" readOnly
          {...register('endDate', { required: true })} />
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
  const printReq = usePrintLeaveRequest();
  const uploadSigned = useUploadLeaveSigned();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);

  const requests: LeaveRequest[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  /** Déclenche le sélecteur de fichier pour joindre la fiche signée d'une demande. */
  const triggerUpload = (id: number) => { setUploadTargetId(id); fileRef.current?.click(); };

  /** Lit le fichier scanné (base64) et le joint à la demande ciblée. */
  const onSignedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadTargetId == null) { if (fileRef.current) fileRef.current.value = ''; return; }
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await uploadSigned.mutateAsync({
      id: uploadTargetId, name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataBase64,
    });
    setUploadTargetId(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  /** Ouvre la fiche signée jointe dans l'application système. */
  const openSigned = async (id: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    const r = await window.electron.hr.leaveRequests.openSigned(token, id);
    if (!r.success) toast.error(String(r.error));
  };

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
                        <Button variant="ghost" size="sm" title="Imprimer la fiche" icon={<Printer className="h-4 w-4" />}
                          loading={printReq.isPending && printReq.variables === r.id}
                          onClick={() => printReq.mutate(r.id)} />
                        {r.status === 'APPROUVE' && (r as any).signedDocName && (
                          <Button variant="ghost" size="sm" title={`Ouvrir la fiche signée (${(r as any).signedDocName})`}
                            icon={<FileCheck2 className="h-4 w-4 text-green-600" />}
                            onClick={() => openSigned(r.id)} />
                        )}
                        {canWrite && r.status === 'APPROUVE' && (
                          <Button variant="ghost" size="sm"
                            title={(r as any).signedDocName ? 'Remplacer la fiche signée' : 'Joindre la fiche signée (scan)'}
                            icon={<Paperclip className="h-4 w-4" />}
                            loading={uploadSigned.isPending && uploadTargetId === r.id}
                            onClick={() => triggerUpload(r.id)} />
                        )}
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

      {/* Sélecteur de fichier (scan de la fiche signée) — partagé par toutes les lignes. */}
      <input ref={fileRef} type="file" className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,image/*,application/pdf"
        onChange={onSignedFile} />
    </PageLayout>
  );
}
