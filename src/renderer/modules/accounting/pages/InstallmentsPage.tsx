import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useOverdueInstallments,
  useUpcomingInstallments,
  useUnpaidInstallments,
  usePaidInstallments,
  useCancelledInstallments,
  usePayInstallment,
  useCancelInstallment,
  useReinstateInstallment,
  usePrintInvoice,
} from '../hooks/useAccounting';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import TreasuryAccountFields from '../../../shared/components/TreasuryAccountFields';
import { AlertCircle, Clock, CreditCard, CheckCircle2, Ban, Search, Printer, ListTodo } from 'lucide-react';
import { toast } from '../../../shared/components/ui/Toast';

type TabKey = 'upcoming' | 'overdue' | 'unpaid' | 'paid' | 'cancelled';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

const DAYS_OPTIONS = [
  { value: '15', label: '15 prochains jours' },
  { value: '30', label: '30 prochains jours' },
  { value: '60', label: '60 prochains jours' },
  { value: '90', label: '90 prochains jours' },
  { value: '180', label: '180 prochains jours' },
  { value: '365', label: "Sur l'année" },
  { value: '0', label: 'Toutes les échéances' },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: '0', label: 'Toutes les années' },
  ...Array.from({ length: 6 }, (_, i) => {
    const y = currentYear - i;
    return { value: String(y), label: String(y) };
  }),
];

const SEMESTER_OPTIONS = [
  { value: '0', label: "Toute l'année" },
  { value: '1', label: '1er semestre (janv. – juin)' },
  { value: '2', label: '2e semestre (juil. – déc.)' },
];

const INST_STATUS_LABEL: Record<string, string> = {
  PAYE: 'Payé', EN_ATTENTE: 'En attente', A_REGLER: 'À régler', EN_RETARD: 'En retard', ANNULE: 'Annulé',
};

const clientLabel = (inst: any): string =>
  inst.convention?.client?.type === 'INDIVIDUEL'
    ? `${inst.convention?.client?.firstName ?? ''} ${inst.convention?.client?.lastName ?? ''}`.trim()
    : (inst.convention?.client?.entreprise ?? '');

/** Filtre une échéance sur le client, la convention, la date d'échéance ou le montant. */
const matchInstallment = (inst: any, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    clientLabel(inst),
    inst.convention?.reference ?? '',
    formatDate(inst.dueDate),
    String(Number(inst.amount)),
  ]
    .join(' ')
    .toLowerCase()
    .includes(q);
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Convention',       cell: (i) => i.convention?.reference },
  { header: 'Client',           cell: (i) => clientLabel(i) },
  { header: 'N° échéance',      cell: (i) => i.installmentNumber },
  { header: "Date d'échéance",  cell: (i) => formatDate(i.dueDate) },
  { header: 'Montant',          cell: (i) => formatCurrency(Number(i.amount)) },
  { header: 'Statut',           cell: (i) => INST_STATUS_LABEL[i.status] ?? i.status },
];

function PayModal({ installment, onClose, onSuccess }: { installment: any; onClose: () => void; onSuccess: () => void }) {
  const payInstallment = usePayInstallment();
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: { method: 'ESPECE', paymentRef: '', notes: '' },
  });

  const onSubmit = async (data: any) => {
    const r = await payInstallment.mutateAsync({
      installmentId: installment.id,
      payload: {
        method: data.method,
        paymentRef: data.paymentRef,
        notes: data.notes,
        bankAccountId: data.bankAccountId ? Number(data.bankAccountId) : undefined,
        categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      },
    });
    if (r.success) onSuccess();
    else toast.error(typeof r.error === 'string' ? r.error : 'Échec de l\'encaissement de l\'échéance');
  };

  const clientName = installment.convention?.client?.type === 'INDIVIDUEL'
    ? `${installment.convention?.client?.firstName ?? ''} ${installment.convention?.client?.lastName ?? ''}`.trim()
    : (installment.convention?.client?.entreprise ?? '—');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Encaisser l'échéance</h2>
        <p className="text-sm text-slate-500 mb-4">
          {installment.convention?.reference} — {clientName} — Échéance n°{installment.installmentNumber}
        </p>

        <div className="bg-blue-50 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-slate-600">Montant à encaisser</span>
          <span className="text-xl font-bold text-slate-900">{formatCurrency(Number(installment.amount))}</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mode de paiement</label>
            <select
              {...register('method')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PAYMENT_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Référence (chèque, virement…)</label>
            <input
              type="text"
              {...register('paymentRef')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optionnel)</label>
            <textarea
              rows={2}
              {...register('notes')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <TreasuryAccountFields register={register} watch={watch} setValue={setValue} direction="ENTREE" />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting} icon={<CreditCard className="h-4 w-4" />}>
              Confirmer l'encaissement
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InstallmentTable({
  installments,
  isLoading,
  onPay,
  onCancel,
  onReinstate,
  onPrint,
}: {
  installments: any[];
  isLoading: boolean;
  onPay: (inst: any) => void;
  onCancel?: (inst: any) => void;
  onReinstate?: (inst: any) => void;
  onPrint?: (inst: any) => void;
}) {
  const navigate = useNavigate();
  if (isLoading) return <div className="p-4"><SkeletonTable rows={5} /></div>;
  if (installments.length === 0) return <p className="p-4 text-sm text-slate-400">Aucune échéance.</p>;

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Convention</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">N°</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Échéance</th>
          <th className="text-right px-4 py-3 font-medium text-slate-600">Montant</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {installments.map((inst: any) => {
          const clientName = inst.convention?.client?.type === 'INDIVIDUEL'
            ? `${inst.convention?.client?.firstName ?? ''} ${inst.convention?.client?.lastName ?? ''}`.trim()
            : (inst.convention?.client?.entreprise ?? '—');
          const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
            PAYE: 'success', EN_ATTENTE: 'info', A_REGLER: 'warning', EN_RETARD: 'danger', ANNULE: 'default',
          };
          const statusLabel: Record<string, string> = {
            PAYE: 'Payé', EN_ATTENTE: 'En attente', A_REGLER: 'À régler', EN_RETARD: 'En retard', ANNULE: 'Annulé',
          };
          return (
            <tr key={inst.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <button
                  className="font-medium text-indigo-600 hover:underline"
                  onClick={() => navigate(`/conventions/${inst.conventionId}`)}
                >
                  {inst.convention?.reference}
                </button>
              </td>
              <td className="px-4 py-3 text-slate-600">{clientName}</td>
              <td className="px-4 py-3 text-slate-500">{inst.installmentNumber}</td>
              <td className="px-4 py-3 text-slate-500">{formatDate(inst.dueDate)}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(inst.amount))}</td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[inst.status] ?? 'default'}>
                  {statusLabel[inst.status] ?? inst.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {inst.status !== 'PAYE' && inst.status !== 'ANNULE' && (
                    <>
                      <Button size="sm" onClick={() => onPay(inst)}>
                        Encaisser
                      </Button>
                      {onCancel && (
                        <Button size="sm" variant="secondary" onClick={() => onCancel(inst)}>
                          Annuler
                        </Button>
                      )}
                    </>
                  )}
                  {inst.status === 'ANNULE' && onReinstate && (
                    <Button size="sm" variant="secondary" onClick={() => onReinstate(inst)}>
                      Réintégrer
                    </Button>
                  )}
                  {inst.status === 'PAYE' && inst.invoiceId && onPrint && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Printer className="h-4 w-4" />}
                      onClick={() => onPrint(inst)}
                    >
                      Facture
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function InstallmentsPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: TabKey =
    tabParam === 'overdue' ? 'overdue'
      : tabParam === 'unpaid' ? 'unpaid'
        : tabParam === 'paid' ? 'paid'
          : tabParam === 'cancelled' ? 'cancelled'
            : 'upcoming';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [days, setDays] = useState(30);
  const [paidYear, setPaidYear] = useState(0);
  const [paidSemester, setPaidSemester] = useState(0);
  const [payingInstallment, setPayingInstallment] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [search, setSearch] = useState('');

  const { data: upcomingRes, isLoading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingInstallments(days);
  const { data: overdueRes, isLoading: overdueLoading, refetch: refetchOverdue } = useOverdueInstallments();
  const { data: unpaidRes, isLoading: unpaidLoading, refetch: refetchUnpaid } = useUnpaidInstallments();
  const { data: paidRes, isLoading: paidLoading, refetch: refetchPaid } = usePaidInstallments(paidYear, paidSemester);
  const { data: cancelledRes, isLoading: cancelledLoading } = useCancelledInstallments();
  const cancelInstallment = useCancelInstallment();
  const reinstateInstallment = useReinstateInstallment();
  const printInvoice = usePrintInvoice();

  // Recherche appliquée à l'onglet courant : client, convention, date d'échéance ou montant.
  const upcoming = (upcomingRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  const overdue = (overdueRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  const unpaid = (unpaidRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  const paid = (paidRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  const cancelled = (cancelledRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  const paidTotal = paid.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const upcomingTotal = upcoming.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const overdueTotal = overdue.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const unpaidTotal = unpaid.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const cancelledTotal = cancelled.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const paidFilterLabel =
    paidYear === 0
      ? 'toutes périodes'
      : paidSemester === 1
        ? `1er semestre ${paidYear}`
        : paidSemester === 2
          ? `2e semestre ${paidYear}`
          : `année ${paidYear}`;
  const upcomingPeriodLabel =
    DAYS_OPTIONS.find((o) => Number(o.value) === days)?.label ?? `${days} prochains jours`;

  // Ligne de solde reprise en pied des fichiers exportés (PDF / Excel).
  const exportTotalRow: string[] =
    activeTab === 'upcoming'
      ? [`Solde à venir — ${upcoming.length} échéance(s)`, '', '', '', formatCurrency(upcomingTotal), '']
      : activeTab === 'overdue'
        ? [`Solde en retard — ${overdue.length} échéance(s)`, '', '', '', formatCurrency(overdueTotal), '']
        : activeTab === 'unpaid'
          ? [`Total impayé — ${unpaid.length} échéance(s)`, '', '', '', formatCurrency(unpaidTotal), '']
          : activeTab === 'paid'
            ? [`Solde encaissé — ${paid.length} échéance(s)`, '', '', '', formatCurrency(paidTotal), '']
            : [`Total annulé — ${cancelled.length} échéance(s)`, '', '', '', formatCurrency(cancelledTotal), ''];

  const handlePaySuccess = () => {
    setPayingInstallment(null);
    refetchUpcoming();
    refetchOverdue();
    refetchUnpaid();
    refetchPaid();
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    await cancelInstallment.mutateAsync(cancelTarget.id);
    setCancelTarget(null);
  };

  const handleReinstate = (inst: any) => {
    reinstateInstallment.mutate(inst.id);
  };

  return (
    <PageLayout
      title="Échéances de vente"
      breadcrumbs={[{ label: 'Comptabilité', to: '/accounting' }, { label: 'Échéances' }]}
      actions={
        <ExportMenu
          fileName={
            activeTab === 'upcoming' ? 'echeances-a-venir'
              : activeTab === 'overdue' ? 'echeances-en-retard'
                : activeTab === 'unpaid' ? 'echeances-impayees'
                  : activeTab === 'paid' ? 'echeances-payees'
                    : 'echeances-annulees'
          }
          title={
            activeTab === 'upcoming' ? 'Échéances de vente à venir'
              : activeTab === 'overdue' ? 'Échéances de vente en retard'
                : activeTab === 'unpaid' ? 'Échéances de vente impayées'
                  : activeTab === 'paid' ? 'Échéances de vente payées'
                    : 'Échéances de vente annulées'
          }
          subtitle={
            activeTab === 'upcoming' ? upcomingPeriodLabel
              : activeTab === 'paid' ? paidFilterLabel
                : undefined
          }
          columns={EXPORT_COLUMNS}
          totalRow={exportTotalRow}
          fetchRows={async () => (
            activeTab === 'upcoming' ? upcoming
              : activeTab === 'overdue' ? overdue
                : activeTab === 'unpaid' ? unpaid
                  : activeTab === 'paid' ? paid
                    : cancelled
          )}
        />
      }
    >
      {/* Recherche */}
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par client, convention, date d'échéance ou montant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'upcoming' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="h-4 w-4" /> À venir
          {upcoming.length > 0 && (
            <span className="ml-1 bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {upcoming.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('overdue')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'overdue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertCircle className="h-4 w-4" /> En retard
          {overdue.length > 0 && (
            <span className="ml-1 bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {overdue.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('unpaid')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'unpaid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ListTodo className="h-4 w-4" /> Toutes impayées
          {unpaid.length > 0 && (
            <span className="ml-1 bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {unpaid.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('paid')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'paid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" /> Payées
          {paid.length > 0 && (
            <span className="ml-1 bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {paid.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('cancelled')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'cancelled' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Ban className="h-4 w-4" /> Annulées
          {cancelled.length > 0 && (
            <span className="ml-1 bg-slate-200 text-slate-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {cancelled.length}
            </span>
          )}
        </button>
      </div>

      {/* Upcoming Tab */}
      {activeTab === 'upcoming' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Prochaines échéances</h3>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DAYS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <InstallmentTable
            installments={upcoming}
            isLoading={upcomingLoading}
            onPay={setPayingInstallment}
            onCancel={setCancelTarget}
          />
          {!upcomingLoading && upcoming.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Solde à venir ({upcomingPeriodLabel}) — {upcoming.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-slate-900">{formatCurrency(upcomingTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Overdue Tab */}
      {activeTab === 'overdue' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Échéances en retard
            </h3>
          </div>
          <InstallmentTable
            installments={overdue}
            isLoading={overdueLoading}
            onPay={setPayingInstallment}
            onCancel={setCancelTarget}
          />
          {!overdueLoading && overdue.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Solde en retard — {overdue.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(overdueTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Unpaid Tab — toutes les échéances impayées (en attente + à régler + en retard) */}
      {activeTab === 'unpaid' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-amber-600" /> Toutes les échéances impayées
            </h3>
          </div>
          <InstallmentTable
            installments={unpaid}
            isLoading={unpaidLoading}
            onPay={setPayingInstallment}
            onCancel={setCancelTarget}
          />
          {!unpaidLoading && unpaid.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Total impayé — {unpaid.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-amber-700">{formatCurrency(unpaidTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Paid Tab */}
      {activeTab === 'paid' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> Échéances payées
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={paidYear}
                onChange={(e) => setPaidYear(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {YEAR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={paidSemester}
                onChange={(e) => setPaidSemester(Number(e.target.value))}
                disabled={paidYear === 0}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {SEMESTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <InstallmentTable
            installments={paid}
            isLoading={paidLoading}
            onPay={setPayingInstallment}
            onPrint={(inst) => printInvoice(inst.invoiceId)}
          />
          {!paidLoading && paid.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Solde encaissé ({paidFilterLabel}) — {paid.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-green-700">{formatCurrency(paidTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Cancelled Tab */}
      {activeTab === 'cancelled' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Ban className="h-4 w-4 text-slate-500" /> Échéances annulées
            </h3>
          </div>
          <InstallmentTable
            installments={cancelled}
            isLoading={cancelledLoading}
            onPay={setPayingInstallment}
            onReinstate={handleReinstate}
          />
          {!cancelledLoading && cancelled.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Total annulé — {cancelled.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-slate-500">{formatCurrency(cancelledTotal)}</span>
            </div>
          )}
          {!cancelledLoading && cancelled.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              Une échéance annulée peut être réintégrée au calendrier des règlements.
            </p>
          )}
        </Card>
      )}

      {payingInstallment && (
        <PayModal
          installment={payingInstallment}
          onClose={() => setPayingInstallment(null)}
          onSuccess={handlePaySuccess}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Annuler l'échéance"
        message={
          cancelTarget
            ? `Annuler l'échéance n°${cancelTarget.installmentNumber} de la convention ${cancelTarget.convention?.reference ?? ''} (${formatCurrency(Number(cancelTarget.amount))}) ? Elle pourra être réintégrée par la suite.`
            : ''
        }
        confirmLabel="Annuler l'échéance"
        loading={cancelInstallment.isPending}
        onConfirm={handleCancelConfirm}
        onClose={() => setCancelTarget(null)}
      />
    </PageLayout>
  );
}
