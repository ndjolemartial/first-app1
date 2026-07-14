import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { Printer, CheckCircle2, Banknote, XCircle, Trash2, Pencil, Copy } from 'lucide-react';
import { usePayslip, useUpdatePayslip, useUpdatePayslipStatus, useUpdatePayslipPayment, usePayslipPayAccounts, useDeletePayslip, usePrintPayslip } from '../hooks/useHr';
import DuplicatePayslipModal from '../components/DuplicatePayslipModal';
import {
  PAYSLIP_STATUS_LABEL, PAYSLIP_STATUS_VARIANT, MONTH_LABEL,
  PAYMENT_METHOD_OPTIONS, type PayslipLine,
} from '../types/hr.types';

const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT']);

function LineTable({ title, lines }: { title: string; lines: PayslipLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="mb-4">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="py-1.5 text-slate-700">{l.label}</td>
              <td className="py-1.5 text-right text-xs text-slate-400">{l.base != null ? formatCurrency(Number(l.base)) : ''}</td>
              <td className="py-1.5 text-right text-xs text-slate-400">{l.rate != null ? `${Number(l.rate)} %` : ''}</td>
              <td className="py-1.5 text-right font-medium text-slate-800">{formatCurrency(Number(l.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Date locale au format AAAA-MM-JJ pour les champs <input type="date">. */
function toDateInput(d?: string | Date | null): string {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Options de comptes débitables (communs, actifs) + compte par défaut configuré. */
function useDebitAccountOptions() {
  const { data } = usePayslipPayAccounts();
  const accounts: any[] = data?.success ? (data.data ?? []) : [];
  const defaultAccountId = data?.success ? (data.defaultAccountId ?? null) : null;
  const options = [
    { value: '', label: '— Aucun (ne pas enregistrer en comptabilité) —' },
    ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
  ];
  return { accounts, options, defaultAccountId };
}

function PayModal({ id, amount, onClose }: { id: number; amount: number; onClose: () => void }) {
  const update = useUpdatePayslipStatus();
  const defaultSortieId = useAuthStore((s) => s.user?.defaultAccountSortieId);
  const { accounts, options, defaultAccountId } = useDebitAccountOptions();
  const [method, setMethod] = useState('VIREMENT');
  const [date, setDate] = useState(() => toDateInput());
  const [account, setAccount] = useState('');

  // Présélection : compte de paie configuré (Paramètres) en priorité, puis compte
  // de sortie par défaut de l'utilisateur, sinon le 1er compte disponible.
  useEffect(() => {
    if (account || accounts.length === 0) return;
    const preferred =
      (defaultAccountId != null && accounts.find((a) => a.id === defaultAccountId)) ||
      (defaultSortieId != null && accounts.find((a) => a.id === defaultSortieId)) ||
      accounts[0];
    if (preferred) setAccount(String(preferred.id));
  }, [accounts, defaultAccountId, defaultSortieId, account]);

  return (
    <Modal open onClose={onClose} title="Marquer comme payé" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={update.isPending} disabled={!date} onClick={async () => {
            const r = await update.mutateAsync({
              id, status: 'PAYE', paymentMethod: method, paidAt: date,
              bankAccountId: account ? Number(account) : undefined,
            });
            if (r.success) onClose();
          }}>Confirmer le paiement</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Montant à payer (net)</label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-[#1E3A5F]">
            {formatCurrency(amount)}
          </div>
        </div>
        <Input label="Date de paiement" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Mode de paiement" options={PAYMENT_METHOD_OPTIONS} value={method} onChange={(e) => setMethod(e.target.value)} />
        <Select label="Compte débité" options={options} value={account} onChange={(e) => setAccount(e.target.value)} />
        {account && <p className="text-xs text-slate-500">Un décaissement de salaire sera enregistré en trésorerie sur ce compte.</p>}
      </div>
    </Modal>
  );
}

function EditPaymentModal({ payslip, onClose }: { payslip: any; onClose: () => void }) {
  const update = useUpdatePayslipPayment();
  const { options } = useDebitAccountOptions();
  const currentAccountId = payslip.operations?.[0]?.bankAccountId;
  const [method, setMethod] = useState(payslip.paymentMethod ?? 'VIREMENT');
  const [date, setDate] = useState(() => toDateInput(payslip.paidAt));
  const [account, setAccount] = useState(currentAccountId != null ? String(currentAccountId) : '');
  return (
    <Modal open onClose={onClose} title="Modifier le paiement" size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={update.isPending} disabled={!date} onClick={async () => {
            const r = await update.mutateAsync({
              id: payslip.id, paidAt: date, paymentMethod: method,
              bankAccountId: account ? Number(account) : undefined,
            });
            if (r.success) onClose();
          }}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Date de paiement" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Mode de paiement" options={PAYMENT_METHOD_OPTIONS} value={method} onChange={(e) => setMethod(e.target.value)} />
        <Select label="Compte débité" options={options} value={account} onChange={(e) => setAccount(e.target.value)} />
        <p className="text-xs text-slate-500">Le décaissement de salaire en trésorerie est mis à jour en conséquence.</p>
      </div>
    </Modal>
  );
}

function lineAmount(lines: PayslipLine[], label: string): number {
  const l = lines.find((x) => x.label === label);
  return l ? Number(l.amount) : 0;
}

function EditPayslipModal({ payslip, onClose }: { payslip: any; onClose: () => void }) {
  const update = useUpdatePayslip();
  const lines: PayslipLine[] = payslip.lines ?? [];
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      sursalaire: lineAmount(lines, 'Sursalaire') || '',
      taxablePrime: lineAmount(lines, 'Primes imposables') || '',
      transportAllowance: lineAmount(lines, 'Indemnité de transport (non imposable)') || '',
      includeOvertime: lineAmount(lines, 'Heures supplémentaires') > 0,
    },
  });

  const onSubmit = async (d: any) => {
    const payload = {
      sursalaire: d.sursalaire ? Number(d.sursalaire) : 0,
      taxablePrime: d.taxablePrime ? Number(d.taxablePrime) : 0,
      transportAllowance: d.transportAllowance ? Number(d.transportAllowance) : 0,
      includeOvertime: !!d.includeOvertime,
    };
    const r = await update.mutateAsync({ id: payslip.id, payload });
    if (r.success) onClose();
  };

  return (
    <Modal open onClose={onClose} title="Modifier le bulletin (brouillon)" size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Recalculer & enregistrer</Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        Le salaire de base provient du contrat de l'employé. Le bulletin est recalculé (CNPS, ITS, CMU,
        charges) à partir des éléments ci-dessous.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

export default function PayslipDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const payslipId = Number(id);
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = WRITE_ROLES.has(role);

  const { data: res, isLoading } = usePayslip(payslipId);
  const updateStatus = useUpdatePayslipStatus();
  const deletePayslip = useDeletePayslip();
  const printPayslip = usePrintPayslip();
  const [showPay, setShowPay] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEditPayment, setShowEditPayment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);

  if (isLoading) return <PageLayout title="Bulletin"><Card><SkeletonTable rows={6} /></Card></PageLayout>;
  if (!res?.success || !res.data) return <PageLayout title="Bulletin"><Card>Bulletin introuvable.</Card></PageLayout>;

  const p = res.data;
  const emp = p.employee ?? {};
  const name = `${emp.lastName ?? ''} ${emp.firstName ?? ''}`.trim();
  const categorie = p.contract?.categorie || emp.categorie || '—';
  const seniority = ((): string => {
    if (!emp.hireDate) return '—';
    const start = new Date(emp.hireDate);
    if (isNaN(start.getTime())) return '—';
    const ref = new Date(p.periodYear, p.periodMonth, 0); // dernier jour de la période
    let months = (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth());
    if (ref.getDate() < start.getDate()) months -= 1;
    if (months < 0) return '—';
    const y = Math.floor(months / 12);
    const m = months % 12;
    const parts: string[] = [];
    if (y > 0) parts.push(`${y} an${y > 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} mois`);
    return parts.length ? parts.join(' ') : "moins d'un mois";
  })();
  const lines: PayslipLine[] = p.lines ?? [];
  const gains = lines.filter((l) => l.type === 'GAIN');
  const retenues = lines.filter((l) => l.type === 'RETENUE');
  const charges = lines.filter((l) => l.type === 'CHARGE_PATRONALE');

  return (
    <PageLayout
      title={`Bulletin ${p.reference}`}
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Paie', to: '/hr/payslips' }, { label: p.reference }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />}
            loading={printPayslip.isPending} onClick={() => printPayslip.mutate(payslipId)}>
            Aperçu / Imprimer
          </Button>
          {canWrite && (
            <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => setShowDuplicate(true)}>
              Dupliquer
            </Button>
          )}
          {canWrite && p.status === 'BROUILLON' && (
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setShowEdit(true)}>
              Modifier
            </Button>
          )}
          {canWrite && p.status === 'BROUILLON' && (
            <Button variant="secondary" icon={<CheckCircle2 className="h-4 w-4" />}
              loading={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: payslipId, status: 'VALIDE' })}>
              Valider
            </Button>
          )}
          {canWrite && (p.status === 'VALIDE' || p.status === 'BROUILLON') && (
            <Button icon={<Banknote className="h-4 w-4" />} onClick={() => setShowPay(true)}>
              Marquer payé
            </Button>
          )}
          {canWrite && p.status === 'PAYE' && (
            <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} onClick={() => setShowEditPayment(true)}>
              Modifier le paiement
            </Button>
          )}
          {canWrite && p.status !== 'ANNULE' && (
            <Button variant="secondary" icon={<XCircle className="h-4 w-4" />}
              onClick={() => updateStatus.mutate({ id: payslipId, status: 'ANNULE' })}>
              Annuler
            </Button>
          )}
          {canWrite && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)} />
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs text-slate-500">{p.reference}</span>
            <Badge variant={(PAYSLIP_STATUS_VARIANT[p.status] ?? 'default') as any}>
              {PAYSLIP_STATUS_LABEL[p.status] ?? p.status}
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{name}</h2>
          <p className="text-sm text-slate-500">Matricule {emp.matricule}</p>
          <p className="text-sm text-slate-500">Catégorie socio-professionnelle : {categorie}</p>
          <p className="text-sm text-slate-500">Date d'embauche : {formatDate(emp.hireDate)}</p>
          <p className="text-sm text-slate-500">Ancienneté : {seniority}</p>
          <p className="text-sm text-slate-500">Période : {MONTH_LABEL[p.periodMonth]} {p.periodYear}</p>
          {p.status === 'PAYE' && (
            <>
              <p className="text-sm text-emerald-600">
                Payé le {formatDate(p.paidAt)}{p.paymentMethod ? ` par ${String(p.paymentMethod).replace(/_/g, ' ')}` : ''}
              </p>
              {p.operations?.[0] && (
                <p className="mb-4 text-xs text-slate-500">
                  Décaissé du compte « {p.operations[0].bankAccount?.name ?? '—'} » · {p.operations[0].reference}
                </p>
              )}
              {!p.operations?.[0] && <div className="mb-4" />}
            </>
          )}
          {p.status !== 'PAYE' && <div className="mb-4" />}
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Total des gains</dt><dd className="text-slate-800">{formatCurrency(Number(p.totalGains))}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Total des retenues</dt><dd className="text-slate-800">- {formatCurrency(Number(p.totalDeductions))}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>Net à payer</dt><dd className="text-[#1E3A5F]">{formatCurrency(Number(p.netSalary))}</dd></div>
            <div className="flex justify-between pt-2"><dt className="text-slate-400">Charges patronales</dt><dd className="text-slate-500">{formatCurrency(Number(p.employerCharges))}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Coût total employeur</dt><dd className="text-slate-500">{formatCurrency(Number(p.employerCost))}</dd></div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <LineTable title="Gains" lines={gains} />
          <LineTable title="Retenues salariales" lines={retenues} />
          <LineTable title="Charges patronales (information)" lines={charges} />
        </Card>
      </div>

      {showPay && <PayModal id={payslipId} amount={Number(p.netSalary)} onClose={() => setShowPay(false)} />}
      {showEdit && <EditPayslipModal payslip={p} onClose={() => setShowEdit(false)} />}
      {showEditPayment && <EditPaymentModal payslip={p} onClose={() => setShowEditPayment(false)} />}
      {showDuplicate && <DuplicatePayslipModal source={p} onClose={() => setShowDuplicate(false)} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer le bulletin"
        message={`Supprimer le bulletin ${p.reference} ?`}
        confirmLabel="Supprimer"
        loading={deletePayslip.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const r = await deletePayslip.mutateAsync(payslipId);
          if (r.success) navigate('/hr/payslips');
        }}
      />
    </PageLayout>
  );
}
