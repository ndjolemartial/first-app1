import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useCommissions } from '../hooks/useCommissions';
import CommissionTable from '../components/CommissionTable';
import { PayCommissionModal, CancelCommissionModal } from '../components/CommissionModals';
import {
  COMMISSION_WRITE_ROLES,
  COMMISSION_STATUS_LABEL,
  TRANSACTION_TYPE_LABEL,
  BENEFICIARY_TYPE_LABEL,
  beneficiaryName,
} from '../utils/commissions.utils';
import { formatCurrency } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { Plus, Search } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'A_PAYER', label: 'À payer' },
  { value: 'PAYEE', label: 'Payée' },
  { value: 'ANNULEE', label: 'Annulée' },
];

const BENEFICIARY_OPTIONS = [
  { value: '', label: 'Tous les bénéficiaires' },
  { value: 'USER', label: 'Utilisateurs' },
  { value: 'REFERRER', label: 'Apporteurs d\'affaire' },
];

const TRANSACTION_OPTIONS = [
  { value: '', label: 'Toutes les transactions' },
  { value: 'VENTE', label: 'Ventes' },
  { value: 'LOCATION', label: 'Locations' },
  { value: 'SOUSCRIPTION', label: 'Souscriptions' },
];

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Référence',         cell: (c) => c.reference },
  { header: 'Convention',        cell: (c) => c.convention?.reference ?? '' },
  { header: 'Bénéficiaire',      cell: (c) => beneficiaryName(c) },
  {
    header: 'Type bénéficiaire',
    cell: (c) => {
      const label = BENEFICIARY_TYPE_LABEL[c.beneficiaryType] ?? c.beneficiaryType;
      return c.beneficiaryType === 'USER' && c.user?.fonction
        ? `${label} (${c.user.fonction})`
        : label;
    },
  },
  { header: 'Transaction',       cell: (c) => TRANSACTION_TYPE_LABEL[c.transactionType] ?? c.transactionType },
  { header: 'Assiette',          cell: (c) => formatCurrency(Number(c.baseAmount)) },
  { header: 'Taux',              cell: (c) => `${Number(c.rate)} %` },
  { header: 'Montant',           cell: (c) => formatCurrency(Number(c.amount)) },
  { header: 'Statut',            cell: (c) => COMMISSION_STATUS_LABEL[c.status] ?? c.status },
];

export default function CommissionsListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const token = useAuthStore((s) => s.token)!;
  const canManage = COMMISSION_WRITE_ROLES.includes(role);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [beneficiaryType, setBeneficiaryType] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [payTarget, setPayTarget] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);

  const filters: any = {};
  if (search) filters.search = search;
  if (status) filters.status = status;
  if (beneficiaryType) filters.beneficiaryType = beneficiaryType;
  if (transactionType) filters.transactionType = transactionType;

  const filterSummary = [
    search && `Recherche : "${search}"`,
    status && `Statut : ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`,
    beneficiaryType && `Bénéficiaire : ${BENEFICIARY_OPTIONS.find((o) => o.value === beneficiaryType)?.label ?? beneficiaryType}`,
    transactionType && `Transaction : ${TRANSACTION_OPTIONS.find((o) => o.value === transactionType)?.label ?? transactionType}`,
  ].filter(Boolean).join('   —   ') || undefined;

  const { data: res, isLoading } = useCommissions(filters, page, limit);
  const commissions = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <PageLayout
      title="Toutes les commissions"
      breadcrumbs={[{ label: 'Commissions', to: '/commissions' }, { label: 'Toutes les commissions' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName="commissions"
            title="Liste des commissions"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.commissions.list(token, filters, 1, 100000);
              return r.success ? r.data ?? [] : [];
            }}
          />
          {canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/commissions/new')}>
              Nouvelle commission
            </Button>
          )}
        </div>
      }
    >
      {/* Filtres */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher (référence, convention, bénéficiaire)…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-44">
          <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
        </div>
        <div className="w-52">
          <Select options={BENEFICIARY_OPTIONS} value={beneficiaryType} onChange={(e) => { setBeneficiaryType(e.target.value); setPage(1); }} />
        </div>
        <div className="w-52">
          <Select options={TRANSACTION_OPTIONS} value={transactionType} onChange={(e) => { setTransactionType(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <CommissionTable
          commissions={commissions}
          isLoading={isLoading}
          canManage={canManage}
          onPay={setPayTarget}
          onCancel={setCancelTarget}
          emptyMessage="Aucune commission trouvée."
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>{total} commission(s)</span>
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

      {payTarget && (
        <PayCommissionModal
          commission={payTarget}
          onClose={() => setPayTarget(null)}
          onSuccess={() => setPayTarget(null)}
        />
      )}
      {cancelTarget && (
        <CancelCommissionModal
          commission={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSuccess={() => setCancelTarget(null)}
        />
      )}
    </PageLayout>
  );
}
