import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAccountingDashboard, useRevenue, usePrintInvoice } from '../hooks/useAccounting';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, AlertCircle, Clock, FileText, CheckCircle, Printer } from 'lucide-react';

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr',
  '05': 'Mai', '06': 'Juin', '07': 'Juil', '08': 'Août',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
};

const INSTALLMENT_STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  PAYE: 'success', EN_ATTENTE: 'info', A_REGLER: 'warning', EN_RETARD: 'danger', ANNULE: 'default',
};
const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  PAYE: 'Payé', EN_ATTENTE: 'En attente', A_REGLER: 'À régler', EN_RETARD: 'En retard', ANNULE: 'Annulé',
};

const REVENUE_PERIOD_OPTIONS = [
  { value: 'month', label: 'ce mois' },
  { value: 'quarter', label: 'ce trimestre' },
  { value: 'semester', label: 'ce semestre' },
  { value: 'year', label: 'cette année' },
];

export default function AccountingDashboardPage() {
  const navigate = useNavigate();
  const { data: res, isLoading } = useAccountingDashboard();
  const [revenuePeriod, setRevenuePeriod] = useState('month');
  const { data: revenueRes } = useRevenue(revenuePeriod);
  const printInvoice = usePrintInvoice();

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;

  const d = res?.data;
  if (!d) return <div className="p-8 text-slate-500">Données indisponibles.</div>;

  const chartData = (d.revenueChart ?? []).map((item: any) => ({
    ...item,
    label: MONTH_LABELS[item.month] ?? item.month,
  }));

  return (
    <PageLayout
      title="Comptabilité"
      breadcrumbs={[{ label: 'Comptabilité' }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/accounting/installments')}>
            Échéances
          </Button>
          <Button onClick={() => navigate('/accounting/invoices/new')}>
            Nouvelle facture
          </Button>
        </div>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="flex items-center gap-4">
          <div className="rounded-xl bg-green-50 p-3">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs text-slate-500">Chiffre d'affaires</span>
              <select
                value={revenuePeriod}
                onChange={(e) => setRevenuePeriod(e.target.value)}
                className="text-xs text-slate-500 bg-transparent border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {REVENUE_PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <p className="text-xl font-bold text-slate-900">
              {formatCurrency(revenueRes?.data?.revenue ?? 0)}
            </p>
            {revenueRes?.data?.label && (
              <p className="text-xs text-slate-400">
                {revenueRes.data.label} · {revenueRes.data.count ?? 0} encaissement(s)
              </p>
            )}
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="rounded-xl bg-blue-50 p-3">
            <CheckCircle className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Factures payées</p>
            <p className="text-xl font-bold text-slate-900">{d.paidInvoicesCount ?? 0}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="rounded-xl bg-orange-50 p-3">
            <FileText className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Impayés</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(d.unpaidAmount ?? 0)}</p>
            <p className="text-xs text-slate-400">{d.unpaidCount ?? 0} facture(s)</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="rounded-xl bg-red-50 p-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Échéances en retard</p>
            <p className="text-xl font-bold text-slate-900">{d.overdueInstallmentsCount ?? 0}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="col-span-2">
          <Card>
            <h3 className="font-semibold text-slate-800 mb-4">Chiffre d'affaires (6 mois)</h3>
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Aucune donnée disponible.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="CA" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Upcoming Installments */}
        <div>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" /> Prochaines échéances
              </h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/accounting/installments')}>
                Voir tout →
              </Button>
            </div>
            {(d.upcomingInstallments ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Aucune échéance à venir.</p>
            ) : (
              <div className="space-y-3">
                {(d.upcomingInstallments ?? []).slice(0, 5).map((inst: any) => (
                  <div key={inst.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {inst.convention?.reference}
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(inst.dueDate)}</p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="font-semibold">{formatCurrency(Number(inst.amount))}</p>
                      <Badge variant={INSTALLMENT_STATUS_VARIANT[inst.status] ?? 'default'}>
                        {INSTALLMENT_STATUS_LABEL[inst.status] ?? inst.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Overdue Installments */}
      {(d.overdueInstallments ?? []).length > 0 && (
        <Card className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Échéances en retard
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/accounting/installments?tab=overdue')}>
              Gérer les retards →
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Convention</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Client</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Échéance</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Montant</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(d.overdueInstallments ?? []).slice(0, 10).map((inst: any) => {
                const clientName = inst.convention?.client?.type === 'INDIVIDUEL'
                  ? `${inst.convention?.client?.firstName ?? ''} ${inst.convention?.client?.lastName ?? ''}`.trim()
                  : (inst.convention?.client?.entreprise ?? '—');
                return (
                  <tr key={inst.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{inst.convention?.reference}</td>
                    <td className="px-3 py-2 text-slate-600">{clientName}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(inst.dueDate)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(Number(inst.amount))}</td>
                    <td className="px-3 py-2">
                      <Badge variant="danger">En retard</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Recent Invoices */}
      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Factures récentes</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/accounting/invoices')}>
            Voir toutes →
          </Button>
        </div>
        {(d.recentInvoices ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Aucune facture.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Référence</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Client</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Échéance</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Total</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Statut</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(d.recentInvoices ?? []).map((inv: any) => {
                const clientName = inv.client?.type === 'INDIVIDUEL'
                  ? `${inv.client?.firstName ?? ''} ${inv.client?.lastName ?? ''}`.trim()
                  : (inv.client?.entreprise ?? '—');
                const STATUS_LABEL: Record<string, string> = {
                  BROUILLON: 'Brouillon', ENVOYEE: 'Envoyée', PAYEE: 'Payée',
                  PARTIEL: 'Partiel', EN_RETARD: 'En retard', ANNULEE: 'Annulée',
                };
                const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
                  BROUILLON: 'default', ENVOYEE: 'info', PAYEE: 'success',
                  PARTIEL: 'warning', EN_RETARD: 'danger', ANNULEE: 'default',
                };
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/accounting/invoices/${inv.id}`)}
                  >
                    <td className="px-3 py-2 font-medium text-indigo-600">{inv.reference}</td>
                    <td className="px-3 py-2 text-slate-600">{clientName}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(inv.dueDate)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(Number(inv.total))}</td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[inv.status] ?? 'default'}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Printer className="h-4 w-4" />}
                        onClick={() => printInvoice(inv.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </PageLayout>
  );
}
