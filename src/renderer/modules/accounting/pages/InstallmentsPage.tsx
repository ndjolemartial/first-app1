import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useOverdueInstallments, useUpcomingInstallments, usePayInstallment } from '../hooks/useAccounting';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { AlertCircle, Clock, CreditCard } from 'lucide-react';

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
];

function PayModal({ installment, onClose, onSuccess }: { installment: any; onClose: () => void; onSuccess: () => void }) {
  const payInstallment = usePayInstallment();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { method: 'ESPECE', reference: '', notes: '' },
  });

  const onSubmit = async (data: any) => {
    const r = await payInstallment.mutateAsync({ installmentId: installment.id, payload: data });
    if (r.success) onSuccess();
  };

  const clientName = installment.contract?.client?.type === 'INDIVIDUEL'
    ? `${installment.contract?.client?.firstName ?? ''} ${installment.contract?.client?.lastName ?? ''}`.trim()
    : (installment.contract?.client?.entreprise ?? '—');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Encaisser l'échéance</h2>
        <p className="text-sm text-slate-500 mb-4">
          {installment.contract?.reference} — {clientName} — Échéance n°{installment.installmentNumber}
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
              {...register('reference')}
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
}: {
  installments: any[];
  isLoading: boolean;
  onPay: (inst: any) => void;
}) {
  const navigate = useNavigate();
  if (isLoading) return <div className="p-4"><SkeletonTable rows={5} /></div>;
  if (installments.length === 0) return <p className="p-4 text-sm text-slate-400">Aucune échéance.</p>;

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Contrat</th>
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
          const clientName = inst.contract?.client?.type === 'INDIVIDUEL'
            ? `${inst.contract?.client?.firstName ?? ''} ${inst.contract?.client?.lastName ?? ''}`.trim()
            : (inst.contract?.client?.entreprise ?? '—');
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
                  onClick={() => navigate(`/contracts/${inst.contractId}`)}
                >
                  {inst.contract?.reference}
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
                {inst.status !== 'PAYE' && inst.status !== 'ANNULE' && (
                  <Button size="sm" onClick={() => onPay(inst)}>
                    Encaisser
                  </Button>
                )}
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
  const initialTab = searchParams.get('tab') === 'overdue' ? 'overdue' : 'upcoming';
  const [activeTab, setActiveTab] = useState<'upcoming' | 'overdue'>(initialTab);
  const [days, setDays] = useState(30);
  const [payingInstallment, setPayingInstallment] = useState<any>(null);

  const { data: upcomingRes, isLoading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingInstallments(days);
  const { data: overdueRes, isLoading: overdueLoading, refetch: refetchOverdue } = useOverdueInstallments();

  const upcoming = upcomingRes?.data ?? [];
  const overdue = overdueRes?.data ?? [];

  const handlePaySuccess = () => {
    setPayingInstallment(null);
    refetchUpcoming();
    refetchOverdue();
  };

  return (
    <PageLayout
      title="Échéances de vente"
      breadcrumbs={[{ label: 'Comptabilité', to: '/accounting' }, { label: 'Échéances' }]}
    >
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
          />
        </Card>
      )}

      {/* Overdue Tab */}
      {activeTab === 'overdue' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Échéances en retard
            </h3>
            {overdue.length > 0 && (
              <p className="text-sm text-red-600 font-medium">
                Total : {formatCurrency(overdue.reduce((s: number, i: any) => s + Number(i.amount), 0))}
              </p>
            )}
          </div>
          <InstallmentTable
            installments={overdue}
            isLoading={overdueLoading}
            onPay={setPayingInstallment}
          />
        </Card>
      )}

      {payingInstallment && (
        <PayModal
          installment={payingInstallment}
          onClose={() => setPayingInstallment(null)}
          onSuccess={handlePaySuccess}
        />
      )}
    </PageLayout>
  );
}
