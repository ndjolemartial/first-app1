import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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
import { formatCurrency } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { PlusCircle, Eye, Printer, Settings, FileText, Copy, Landmark, CheckCircle2 } from 'lucide-react';
import { usePayslips, useEmployees, useGeneratePayslip, usePrintPayslip, useUpdatePayslipStatus } from '../hooks/useHr';
import DuplicatePayslipModal from '../components/DuplicatePayslipModal';
import WireTransferOrderModal from '../components/WireTransferOrderModal';
import {
  PAYSLIP_STATUS_LABEL, PAYSLIP_STATUS_VARIANT, PAYSLIP_STATUS_OPTIONS,
  MONTH_OPTIONS, MONTH_LABEL, type Payslip, type Employee,
} from '../types/hr.types';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Référence', cell: (p: any) => p.reference },
  { header: 'Employé', cell: (p: any) => (p.employee ? `${p.employee.lastName ?? ''} ${p.employee.firstName ?? ''}`.trim() : '') },
  { header: 'Matricule', cell: (p: any) => p.employee?.matricule ?? '' },
  { header: 'Mois', cell: (p: any) => `${MONTH_LABEL[p.periodMonth] ?? p.periodMonth} ${p.periodYear}` },
  { header: 'Brut imposable', cell: (p: any) => Math.round(Number(p.grossTaxable)) },
  { header: 'Total gains', cell: (p: any) => Math.round(Number(p.totalGains)) },
  { header: 'CNPS salarié', cell: (p: any) => Math.round(Number(p.cnpsEmployee)) },
  { header: 'ITS', cell: (p: any) => Math.round(Number(p.its)) },
  { header: 'CMU', cell: (p: any) => Math.round(Number(p.cmuEmployee)) },
  { header: 'Total retenues', cell: (p: any) => Math.round(Number(p.totalDeductions)) },
  { header: 'Net à payer', cell: (p: any) => Math.round(Number(p.netSalary)) },
  { header: 'Charges patronales', cell: (p: any) => Math.round(Number(p.employerCharges)) },
  { header: 'Coût employeur', cell: (p: any) => Math.round(Number(p.employerCost)) },
  { header: 'Statut', cell: (p: any) => PAYSLIP_STATUS_LABEL[p.status] ?? p.status },
];

// Écriture opérationnelle (bulletins) : admins/RH + MANAGER & ASSISTANTE_DIRECTION.
const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER']);
// Configuration (modèles de bulletins, paramètres de paie) : admins et RH uniquement.
const CONFIG_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT']);
// Ordre de virement : réservé aux Super Admin / Admin.
const WIRE_TRANSFER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const now = new Date();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const y = now.getFullYear() - i;
  return { value: String(y), label: String(y) };
});

function GenerateModal({ onClose }: { onClose: () => void }) {
  const generate = useGeneratePayslip();
  const { data: empRes } = useEmployees({ status: 'ACTIF' }, 1, 1000);
  const employees: Employee[] = empRes?.data ?? [];
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      employeeId: '', periodYear: String(now.getFullYear()), periodMonth: String(now.getMonth() + 1),
      sursalaire: '', taxablePrime: '', transportAllowance: '', includeOvertime: true,
    },
  });

  const onSubmit = async (d: any) => {
    if (!d.employeeId) return;
    const payload = {
      employeeId: Number(d.employeeId),
      periodYear: Number(d.periodYear),
      periodMonth: Number(d.periodMonth),
      sursalaire: d.sursalaire ? Number(d.sursalaire) : 0,
      taxablePrime: d.taxablePrime ? Number(d.taxablePrime) : 0,
      transportAllowance: d.transportAllowance ? Number(d.transportAllowance) : 0,
      includeOvertime: !!d.includeOvertime,
    };
    const r = await generate.mutateAsync(payload);
    if (r.success) onClose();
  };

  const empOptions = [
    { value: '', label: '— Sélectionner —' },
    ...employees.map((e) => ({ value: String(e.id), label: `${e.matricule} — ${e.lastName ?? ''} ${e.firstName ?? ''}`.trim() })),
  ];

  return (
    <Modal
      open onClose={onClose} title="Générer un bulletin de paie" size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Générer</Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        Le salaire de base provient du dernier contrat de l'employé. La prime d'ancienneté est calculée
        automatiquement selon l'ancienneté. Les retenues (CNPS, ITS, CMU…) et charges patronales
        sont calculées selon les taux paramétrés (Paie → Paramètres).
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Select label="Employé" options={empOptions} {...register('employeeId', { required: true })} />
        </div>
        <Select label="Mois" options={MONTH_OPTIONS} {...register('periodMonth')} />
        <Select label="Année" options={YEAR_OPTIONS} {...register('periodYear')} />
        <Input label="Sursalaire (FCFA)" type="number" step="1000" min="0" {...register('sursalaire')} />
        <Input label="Prime imposable (FCFA)" type="number" step="1000" min="0" {...register('taxablePrime')} />
        <Input label="Indemnité transport (FCFA)" type="number" step="1000" min="0" {...register('transportAllowance')} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" {...register('includeOvertime')} />
        Inclure les heures supplémentaires du pointage du mois
      </label>
    </Modal>
  );
}

export default function PayslipsListPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = WRITE_ROLES.has(role);
  const canConfig = CONFIG_ROLES.has(role);
  const canWireTransfer = WIRE_TRANSFER_ROLES.has(role);

  const [page, setPage] = useState(1);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Payslip | null>(null);
  const [showWireTransfer, setShowWireTransfer] = useState(false);

  const filters = {
    periodYear: year || undefined,
    periodMonth: month || undefined,
    status: status || undefined,
  };
  const { data, isLoading } = usePayslips(filters, page, 20);
  const printPayslip = usePrintPayslip();
  const updateStatus = useUpdatePayslipStatus();

  const payslips: Payslip[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Bulletins de paie"
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Paie' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName="bulletins-paie"
            title="Bulletins de paie"
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.hr.payslips.list(token, filters, 1, 100000);
              return r.success ? r.data ?? [] : [];
            }}
          />
          {canConfig && (
            <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => navigate('/hr/templates')}>
              Modèles de bulletins
            </Button>
          )}
          {canConfig && (
            <Button variant="secondary" icon={<Settings className="h-4 w-4" />} onClick={() => navigate('/hr/payroll-settings')}>
              Paramètres
            </Button>
          )}
          {canWrite && (
            <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => setShowGenerate(true)}>
              Générer un bulletin
            </Button>
          )}
        </div>
      }
    >
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Select label="Année" options={[{ value: '', label: 'Toutes' }, ...YEAR_OPTIONS]} value={year}
            onChange={(e) => { setYear(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <Select label="Mois" options={[{ value: '', label: 'Tous' }, ...MONTH_OPTIONS]} value={month}
            onChange={(e) => { setMonth(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <Select label="Statut" options={[{ value: '', label: 'Tous' }, ...PAYSLIP_STATUS_OPTIONS]} value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
        </div>
        {canWireTransfer && (
          <Button
            variant="danger"
            icon={<Landmark className="h-4 w-4" />}
            disabled={!year || !month}
            title={!year || !month ? 'Sélectionnez une année et un mois' : undefined}
            onClick={() => setShowWireTransfer(true)}
          >
            Ordre de virement
          </Button>
        )}
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : payslips.length === 0 ? (
          <EmptyState
            title="Aucun bulletin"
            action={canWrite ? { label: 'Générer un bulletin', onClick: () => setShowGenerate(true) } : undefined}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Employé</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Période</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Brut</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Net à payer</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Statut</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payslips.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-medium text-slate-900">{p.reference}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.employee ? `${p.employee.lastName ?? ''} ${p.employee.firstName ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{MONTH_LABEL[p.periodMonth]} {p.periodYear}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(Number(p.totalGains))}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(Number(p.netSalary))}</td>
                    <td className="px-4 py-3">
                      <Badge variant={(PAYSLIP_STATUS_VARIANT[p.status] ?? 'default') as any}>
                        {PAYSLIP_STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Aperçu / Imprimer" icon={<Printer className="h-4 w-4" />}
                          loading={printPayslip.isPending && printPayslip.variables === p.id}
                          onClick={() => printPayslip.mutate(p.id)} />
                        {canWrite && p.status === 'BROUILLON' && (
                          <Button variant="ghost" size="sm" title="Valider" icon={<CheckCircle2 className="h-4 w-4" />}
                            loading={updateStatus.isPending && updateStatus.variables?.id === p.id}
                            onClick={() => updateStatus.mutate({ id: p.id, status: 'VALIDE' })} />
                        )}
                        {canWrite && (
                          <Button variant="ghost" size="sm" title="Dupliquer" icon={<Copy className="h-4 w-4" />}
                            onClick={() => setDuplicateSource(p)} />
                        )}
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                          onClick={() => navigate(`/hr/payslips/${p.id}`)} />
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

      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} />}
      {duplicateSource && <DuplicatePayslipModal source={duplicateSource} onClose={() => setDuplicateSource(null)} />}
      {showWireTransfer && year && month && (
        <WireTransferOrderModal
          periodYear={Number(year)}
          periodMonth={Number(month)}
          onClose={() => setShowWireTransfer(false)}
        />
      )}
    </PageLayout>
  );
}
