import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Modal from '../../../shared/components/ui/Modal';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, PlusCircle, FileText, Trash2, Printer } from 'lucide-react';
import {
  useEmployee, useCreateContract, useUpdateContract, useDeleteContract, useDeleteEmployee,
  usePrintContract,
} from '../hooks/useHr';
import {
  EMPLOYEE_STATUS_LABEL, EMPLOYEE_STATUS_VARIANT,
  CONTRACT_TYPE_OPTIONS, CONTRACT_TYPE_LABEL,
  CONTRACT_STATUS_OPTIONS, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_VARIANT,
  type EmploymentContract,
} from '../types/hr.types';

const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH']);
const toDateInput = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value ?? '—'}</dd>
    </div>
  );
}

interface ContractForm {
  type: string; status: string; poste: string; categorie: string;
  startDate: string; endDate: string; trialEndDate: string;
  weeklyHours: string; baseSalary: string; notes: string;
  sursalaire: string; primeAnciennete: string; grossSalary: string;
  its: string; cnps: string; totalDeductions: string; transportAllowance: string; netSalary: string;
}

const numOrEmpty = (v: unknown) => (v == null ? '' : String(v));

function ContractModal({
  employeeId, contract, onClose,
}: { employeeId: number; contract: EmploymentContract | null; onClose: () => void }) {
  const create = useCreateContract();
  const update = useUpdateContract(employeeId);
  const isEdit = !!contract;
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm<ContractForm>({
    defaultValues: {
      type: contract?.type ?? 'CDI',
      status: contract?.status ?? 'ACTIF',
      poste: contract?.poste ?? '',
      categorie: contract?.categorie ?? '',
      startDate: toDateInput(contract?.startDate),
      endDate: toDateInput(contract?.endDate),
      trialEndDate: toDateInput(contract?.trialEndDate),
      weeklyHours: contract?.weeklyHours != null ? String(contract.weeklyHours) : '',
      baseSalary: contract?.baseSalary != null ? String(contract.baseSalary) : '',
      sursalaire: numOrEmpty(contract?.sursalaire),
      primeAnciennete: numOrEmpty(contract?.primeAnciennete),
      grossSalary: numOrEmpty(contract?.grossSalary),
      its: numOrEmpty(contract?.its),
      cnps: numOrEmpty(contract?.cnps),
      totalDeductions: numOrEmpty(contract?.totalDeductions),
      transportAllowance: numOrEmpty(contract?.transportAllowance),
      netSalary: numOrEmpty(contract?.netSalary),
      notes: contract?.notes ?? '',
    },
  });
  const type = watch('type');
  const showRemuneration = type === 'CDI' || type === 'CDD';

  const onSubmit = async (data: ContractForm) => {
    const num = (v: string) => (v === '' ? null : Number(v));
    const payload: any = {
      ...data,
      employeeId,
      weeklyHours: data.weeklyHours === '' ? null : Number(data.weeklyHours),
      baseSalary: Number(data.baseSalary) || 0,
      endDate: data.endDate || null,
      trialEndDate: data.trialEndDate || null,
      sursalaire: num(data.sursalaire),
      primeAnciennete: num(data.primeAnciennete),
      grossSalary: num(data.grossSalary),
      its: num(data.its),
      cnps: num(data.cnps),
      totalDeductions: num(data.totalDeductions),
      transportAllowance: num(data.transportAllowance),
      netSalary: num(data.netSalary),
    };
    const r = isEdit
      ? await update.mutateAsync({ id: contract!.id, payload })
      : await create.mutateAsync(payload);
    if (r.success) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Modifier le contrat' : 'Nouveau contrat'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Type de contrat" options={CONTRACT_TYPE_OPTIONS} {...register('type')} />
        <Select label="Statut" options={CONTRACT_STATUS_OPTIONS} {...register('status')} />
        <Input label="Poste" {...register('poste')} />
        <Input label="Catégorie / classification" {...register('categorie')} />
        <Input label="Date de début" type="date" required {...register('startDate')} />
        <Input label="Date de fin (CDD/stage)" type="date" {...register('endDate')} />
        <Input label="Fin de période d'essai" type="date" {...register('trialEndDate')} />
        <Input label="Heures / semaine" type="number" step="0.5" min="0" {...register('weeklyHours')} />
        <Input label="Salaire de base mensuel (FCFA)" type="number" step="1000" min="0" required {...register('baseSalary')} />
      </div>

      {showRemuneration && (
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Rémunération (clause du contrat)</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Sursalaire (FCFA)" type="number" step="1" min="0" {...register('sursalaire')} />
            <Input label="Prime d'ancienneté (FCFA)" type="number" step="1" min="0" {...register('primeAnciennete')} />
            <Input label="Salaire brut (FCFA)" type="number" step="1" min="0" {...register('grossSalary')} />
            <Input label="ITS (FCFA)" type="number" step="1" min="0" {...register('its')} />
            <Input label="CNPS (FCFA)" type="number" step="1" min="0" {...register('cnps')} />
            <Input label="Total des retenues (FCFA)" type="number" step="1" min="0" {...register('totalDeductions')} />
            <Input label="Prime de transport (FCFA)" type="number" step="1" min="0" {...register('transportAllowance')} />
            <Input label="Salaire net à payer (FCFA)" type="number" step="1" min="0" {...register('netSalary')} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Salaire brut = salaire de base + sursalaire + prime d'ancienneté. Net à payer = brut − total des retenues + transport.
          </p>
        </div>
      )}

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          rows={2}
          {...register('notes')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </Modal>
  );
}

export default function EmployeeDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const employeeId = Number(id);
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = WRITE_ROLES.has(role);

  const { data: res, isLoading } = useEmployee(employeeId);
  const deleteContract = useDeleteContract(employeeId);
  const deleteEmployee = useDeleteEmployee();
  const printContract = usePrintContract();

  const [contractModal, setContractModal] = useState<{ open: boolean; contract: EmploymentContract | null }>({ open: false, contract: null });
  const [contractToDelete, setContractToDelete] = useState<EmploymentContract | null>(null);
  const [confirmEmployeeDelete, setConfirmEmployeeDelete] = useState(false);

  if (isLoading) return <PageLayout title="Employé"><Card><SkeletonTable rows={6} /></Card></PageLayout>;
  if (!res?.success || !res.data) {
    return <PageLayout title="Employé"><Card>Employé introuvable.</Card></PageLayout>;
  }

  const e = res.data;
  const name = `${e.lastName ?? ''} ${e.firstName ?? ''}`.trim();
  const contracts: EmploymentContract[] = e.contracts ?? [];

  return (
    <PageLayout
      title={name || e.matricule}
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Personnel', to: '/hr/employees' }, { label: name || e.matricule }]}
      actions={
        canWrite && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/hr/employees/${employeeId}/edit`)}>
              Modifier
            </Button>
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmEmployeeDelete(true)}>
              Archiver
            </Button>
          </div>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-500">{e.matricule}</span>
            <Badge variant={(EMPLOYEE_STATUS_VARIANT[e.status] ?? 'default') as any}>
              {EMPLOYEE_STATUS_LABEL[e.status] ?? e.status}
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{name}</h2>
          <p className="mb-4 text-sm text-slate-500">{e.poste ?? '—'}{e.departement ? ` · ${e.departement}` : ''}</p>
          <dl className="space-y-3">
            <Field label="Téléphone" value={e.mobile || e.phone} />
            <Field label="Email" value={e.email} />
            <Field label="Adresse" value={[e.address, e.city].filter(Boolean).join(', ') || null} />
            <Field label="Date d'embauche" value={e.hireDate ? formatDate(e.hireDate) : null} />
          </dl>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">État civil & social</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Date de naissance" value={e.birthDate ? formatDate(e.birthDate) : null} />
              <Field label="Lieu de naissance" value={e.birthPlace} />
              <Field label="Nationalité" value={e.nationality} />
              <Field label="Situation familiale" value={e.maritalStatus} />
              <Field label="Enfants" value={e.childrenCount} />
              <Field label="N° pièce d'identité" value={e.idNumber} />
              <Field label="N° CNPS" value={e.cnpsNumber} />
              <Field label="N° CMU" value={e.cmuNumber} />
              <Field label="Banque" value={e.bankName} />
              <Field label="RIB / IBAN" value={e.bankRib} />
            </dl>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Contrats de travail</h3>
              {canWrite && (
                <Button size="sm" icon={<PlusCircle className="h-4 w-4" />} onClick={() => setContractModal({ open: true, contract: null })}>
                  Nouveau contrat
                </Button>
              )}
            </div>
            {contracts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Aucun contrat enregistré.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2">Référence</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Période</th>
                    <th className="py-2">Salaire de base</th>
                    <th className="py-2">Statut</th>
                    {canWrite && <th className="py-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contracts.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2">
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-700">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />{c.reference}
                        </span>
                      </td>
                      <td className="py-2 text-slate-600">{CONTRACT_TYPE_LABEL[c.type] ?? c.type}</td>
                      <td className="py-2 text-slate-600">
                        {formatDate(c.startDate)}{c.endDate ? ` → ${formatDate(c.endDate)}` : ''}
                      </td>
                      <td className="py-2 text-slate-700">{formatCurrency(Number(c.baseSalary))}</td>
                      <td className="py-2">
                        <Badge variant={(CONTRACT_STATUS_VARIANT[c.status] ?? 'default') as any}>
                          {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                      </td>
                      {canWrite && (
                        <td className="py-2">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" title="Aperçu / Imprimer" icon={<Printer className="h-4 w-4" />}
                              loading={printContract.isPending && printContract.variables === c.id}
                              onClick={() => printContract.mutate(c.id)} />
                            <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                              onClick={() => setContractModal({ open: true, contract: c })} />
                            <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />}
                              onClick={() => setContractToDelete(c)} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {e.notes && (
            <Card>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{e.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {contractModal.open && (
        <ContractModal
          employeeId={employeeId}
          contract={contractModal.contract}
          onClose={() => setContractModal({ open: false, contract: null })}
        />
      )}

      <ConfirmDialog
        open={!!contractToDelete}
        title="Supprimer le contrat"
        message={contractToDelete ? `Supprimer le contrat ${contractToDelete.reference} ?` : ''}
        confirmLabel="Supprimer"
        loading={deleteContract.isPending}
        onClose={() => setContractToDelete(null)}
        onConfirm={async () => {
          if (contractToDelete) {
            const r = await deleteContract.mutateAsync(contractToDelete.id);
            if (r.success) setContractToDelete(null);
          }
        }}
      />

      <ConfirmDialog
        open={confirmEmployeeDelete}
        title="Archiver l'employé"
        message={`Archiver l'employé ${name} ? Il n'apparaîtra plus dans la liste du personnel.`}
        confirmLabel="Archiver"
        loading={deleteEmployee.isPending}
        onClose={() => setConfirmEmployeeDelete(false)}
        onConfirm={async () => {
          const r = await deleteEmployee.mutateAsync(employeeId);
          if (r.success) navigate('/hr/employees');
        }}
      />
    </PageLayout>
  );
}
