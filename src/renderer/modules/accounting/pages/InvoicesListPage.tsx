import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useInvoices, usePrintInvoice } from '../hooks/useAccounting';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Search, Printer, FileText } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ENVOYEE', label: 'Envoyée' },
  { value: 'PAYEE', label: 'Payée' },
  { value: 'PARTIEL', label: 'Partiel' },
  { value: 'EN_RETARD', label: 'En retard' },
  { value: 'ANNULEE', label: 'Annulée' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'VENTE', label: 'Vente' },
  { value: 'ECHEANCE_VENTE', label: 'Échéance vente' },
  { value: 'FRAIS_AGENCE', label: 'Frais agence' },
  { value: 'FRAIS_DE_GESTION', label: 'Frais de gestion' },
  { value: 'AVANCE', label: 'Avance' },
  { value: 'CAUTION', label: 'Caution' },
  { value: 'OTHER', label: 'Autre' },
];

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  BROUILLON: 'default', ENVOYEE: 'info', PAYEE: 'success',
  PARTIEL: 'warning', EN_RETARD: 'danger', ANNULEE: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon', ENVOYEE: 'Envoyée', PAYEE: 'Payée',
  PARTIEL: 'Partiel', EN_RETARD: 'En retard', ANNULEE: 'Annulée',
};
const TYPE_LABEL: Record<string, string> = {
  VENTE: 'Vente', ECHEANCE_VENTE: 'Échéance vente', FRAIS_AGENCE: 'Frais agence',
  FRAIS_DE_GESTION: 'Frais gestion', AVANCE: 'Avance', CAUTION: 'Caution', OTHER: 'Autre',
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Référence',        cell: (inv) => inv.reference },
  { header: 'Type',             cell: (inv) => TYPE_LABEL[inv.type] ?? inv.type },
  { header: 'Client',           cell: (inv) => (inv.client?.type === 'INDIVIDUEL' ? `${inv.client?.firstName ?? ''} ${inv.client?.lastName ?? ''}`.trim() : (inv.client?.entreprise ?? '')) },
  { header: "Date d'émission",  cell: (inv) => formatDate(inv.issueDate) },
  { header: 'Échéance',         cell: (inv) => formatDate(inv.dueDate) },
  { header: 'Total',            cell: (inv) => formatCurrency(Number(inv.total)) },
  { header: 'Statut',           cell: (inv) => STATUS_LABEL[inv.status] ?? inv.status },
];

export default function InvoicesListPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const printInvoice = usePrintInvoice();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const filters: any = {};
  if (search) filters.search = search;
  if (status) filters.status = status;
  if (type) filters.type = type;

  const filterSummary = [
    search && `Recherche : "${search}"`,
    status && `Statut : ${STATUS_LABEL[status] ?? status}`,
    type && `Type : ${TYPE_LABEL[type] ?? type}`,
  ].filter(Boolean).join('   —   ') || undefined;

  const { data: res, isLoading } = useInvoices(filters, page, limit);
  const invoices = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <PageLayout
      title="Factures"
      breadcrumbs={[{ label: 'Comptabilité', to: '/accounting' }, { label: 'Factures' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName="factures"
            title="Liste des factures"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.accounting.getInvoices(token, filters, 1, 100000);
              return r.success ? r.data ?? [] : [];
            }}
          />
          <Button
            variant="secondary"
            icon={<FileText className="h-4 w-4" />}
            onClick={() => navigate('/accounting/invoice-templates')}
          >
            Modèles
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/accounting/invoices/new')}>
            Nouvelle facture
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une facture..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="w-40">
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-44">
          <Select
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Aucune facture trouvée.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Émission</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Échéance</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv: any) => {
                const clientName = inv.client?.type === 'INDIVIDUEL'
                  ? `${inv.client?.firstName ?? ''} ${inv.client?.lastName ?? ''}`.trim()
                  : (inv.client?.entreprise ?? '—');
                const paidAmount = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
                const balance = Number(inv.total) - paidAmount;
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/accounting/invoices/${inv.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-indigo-600">{inv.reference}</td>
                    <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[inv.type] ?? inv.type}</td>
                    <td className="px-4 py-3 text-slate-700">{clientName}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(inv.issueDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold">{formatCurrency(Number(inv.total))}</p>
                      {inv.status === 'PARTIEL' && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Payé {formatCurrency(paidAmount)} ·{' '}
                          <span className="text-amber-600">Solde {formatCurrency(balance)}</span>
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[inv.status] ?? 'default'}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>{total} facture(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              Précédent
            </Button>
            <span className="py-1 px-2">{page} / {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              Suivant
            </Button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
