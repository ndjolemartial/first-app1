import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  useTreasuryAccount, useTreasuryOperations, useTreasuryCategories,
  useDeleteTreasuryAccount, useDeleteTreasuryOperation,
} from '../hooks/useTreasury';
import {
  ACCOUNT_TYPE_LABEL, ACCOUNT_TYPE_VARIANT, DIRECTION_LABEL, DIRECTION_OPTIONS,
  SOURCE_LABEL, PAYMENT_METHOD_LABEL, TREASURY_WRITE_ROLES, TREASURY_ADMIN_ROLES,
  categoryLabel,
} from '../utils/treasury.utils';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { Plus, Pencil, Trash2, Search, ArrowLeft } from 'lucide-react';

const SOURCE_OPTIONS = [
  { value: '', label: 'Toutes origines' },
  { value: 'MANUEL', label: 'Saisie manuelle' },
  { value: 'FACTURE', label: 'Encaissement facture' },
  { value: 'ECHEANCE', label: 'Règlement échéance' },
  { value: 'COMMISSION', label: 'Paiement commission' },
];

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canManage = TREASURY_WRITE_ROLES.includes(role);
  const canDelete = TREASURY_ADMIN_ROLES.includes(role);

  const [direction, setDirection] = useState('');
  const [source, setSource] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteOpTarget, setDeleteOpTarget] = useState<any>(null);

  const { data: accountRes, isLoading: accountLoading } = useTreasuryAccount(accountId);
  const account = accountRes?.data;

  const { data: categoriesRes } = useTreasuryCategories({ isActive: 'true' });
  const categories = categoriesRes?.data ?? [];

  const filters: any = { bankAccountId: accountId };
  if (direction) filters.direction = direction;
  if (source) filters.source = source;
  if (categoryId) filters.categoryId = Number(categoryId);
  if (dateFrom) filters.dateFrom = new Date(`${dateFrom}T00:00:00`).toISOString();
  if (dateTo) filters.dateTo = new Date(`${dateTo}T23:59:59`).toISOString();
  if (search) filters.search = search;

  const { data: opsRes, isLoading: opsLoading } = useTreasuryOperations(filters, page, limit);
  const operations = opsRes?.data ?? [];
  const total = opsRes?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const totalEntree = opsRes?.totalEntree ?? 0;
  const totalSortie = opsRes?.totalSortie ?? 0;

  const deleteAccount = useDeleteTreasuryAccount();
  const deleteOperation = useDeleteTreasuryOperation();

  const resetPage = () => setPage(1);

  const filterSummary = [
    direction && `Sens : ${DIRECTION_LABEL[direction]}`,
    source && `Origine : ${SOURCE_OPTIONS.find((o) => o.value === source)?.label}`,
    categoryId && `Objet : ${categoryLabel(categories.find((c: any) => c.id === Number(categoryId)))}`,
    dateFrom && `Du ${formatDate(dateFrom)}`,
    dateTo && `Au ${formatDate(dateTo)}`,
    search && `Recherche : "${search}"`,
  ].filter(Boolean).join('   —   ') || undefined;

  const EXPORT_COLUMNS: ExportColumn[] = [
    { header: 'Date', cell: (o) => formatDate(o.operationDate) },
    { header: 'Référence', cell: (o) => o.reference },
    { header: 'Libellé', cell: (o) => o.label },
    { header: 'Objet', cell: (o) => (o.category ? categoryLabel(o.category) : '') },
    { header: 'Origine', cell: (o) => SOURCE_LABEL[o.source] ?? o.source },
    { header: 'Sens', cell: (o) => DIRECTION_LABEL[o.direction] ?? o.direction },
    { header: 'Mode', cell: (o) => PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod },
    { header: 'Montant', cell: (o) => formatCurrency(Number(o.amount)) },
  ];

  const handleDeleteAccount = async () => {
    const r = await deleteAccount.mutateAsync(accountId);
    if (r.success) navigate('/treasury');
  };

  const handleDeleteOperation = async () => {
    if (!deleteOpTarget) return;
    const r = await deleteOperation.mutateAsync(deleteOpTarget.id);
    if (r.success) setDeleteOpTarget(null);
  };

  const deleteAccountError = deleteAccount.data && !deleteAccount.data.success ? deleteAccount.data.error : null;
  const deleteOpError = deleteOperation.data && !deleteOperation.data.success ? deleteOperation.data.error : null;

  return (
    <PageLayout
      title={account?.name ?? 'Compte de trésorerie'}
      breadcrumbs={[
        { label: 'Trésorerie', to: '/treasury' },
        { label: account?.name ?? 'Compte' },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/treasury')}>
            Retour
          </Button>
          {canManage && (
            <>
              <Button
                variant="secondary"
                icon={<Pencil className="h-4 w-4" />}
                onClick={() => navigate(`/treasury/accounts/${accountId}/edit`)}
              >
                Modifier
              </Button>
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => navigate(`/treasury/operations/new?accountId=${accountId}`)}
              >
                Nouvelle opération
              </Button>
            </>
          )}
        </div>
      }
    >
      {accountLoading ? (
        <div className="p-8"><SkeletonTable rows={4} /></div>
      ) : !account ? (
        <div className="p-8 text-slate-500">Compte introuvable.</div>
      ) : (
        <>
          {/* Informations & solde */}
          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <Card className="lg:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-slate-800">{account.name}</h3>
                    <Badge variant={ACCOUNT_TYPE_VARIANT[account.type] ?? 'default'}>
                      {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
                    </Badge>
                    {!account.isActive && <Badge variant="default">Inactif</Badge>}
                    {account.linkedUser && <Badge variant="warning">Compte privé</Badge>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                    <div><dt className="text-slate-400 inline">Banque / Opérateur : </dt><dd className="inline text-slate-700">{account.bankName || '—'}</dd></div>
                    <div><dt className="text-slate-400 inline">N° de compte : </dt><dd className="inline text-slate-700">{account.accountNumber || '—'}</dd></div>
                    <div><dt className="text-slate-400 inline">IBAN : </dt><dd className="inline text-slate-700">{account.iban || '—'}</dd></div>
                    <div><dt className="text-slate-400 inline">BIC : </dt><dd className="inline text-slate-700">{account.bic || '—'}</dd></div>
                    <div><dt className="text-slate-400 inline">Solde initial : </dt><dd className="inline text-slate-700">{formatCurrency(account.initialBalance, account.currency)}</dd></div>
                    <div><dt className="text-slate-400 inline">Devise : </dt><dd className="inline text-slate-700">{account.currency}</dd></div>
                    <div>
                      <dt className="text-slate-400 inline">Rattaché à : </dt>
                      <dd className="inline text-slate-700">
                        {account.linkedUser
                          ? `${account.linkedUser.firstName} ${account.linkedUser.lastName}`
                          : 'Compte commun (tous les utilisateurs)'}
                      </dd>
                    </div>
                  </dl>
                  {account.notes && <p className="mt-3 text-sm text-slate-500">{account.notes}</p>}
                </div>
                {canDelete && (
                  <Button
                    size="sm" variant="ghost"
                    icon={<Trash2 className="h-4 w-4 text-red-500" />}
                    onClick={() => { deleteAccount.reset(); setDeleteAccountOpen(true); }}
                  />
                )}
              </div>
            </Card>
            <Card className="flex flex-col justify-center">
              <p className="text-xs text-slate-500 mb-0.5">Solde courant</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(account.balance, account.currency)}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-green-600">Entrées : {formatCurrency(account.totalIn, account.currency)}</span>
                <span className="text-red-500">Sorties : {formatCurrency(account.totalOut, account.currency)}</span>
              </div>
            </Card>
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher (libellé, référence…)"
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-36">
              <Select
                options={[{ value: '', label: 'Tous les sens' }, ...DIRECTION_OPTIONS]}
                value={direction}
                onChange={(e) => { setDirection(e.target.value); resetPage(); }}
              />
            </div>
            <div className="w-48">
              <Select
                options={SOURCE_OPTIONS}
                value={source}
                onChange={(e) => { setSource(e.target.value); resetPage(); }}
              />
            </div>
            <div className="w-52">
              <Select
                options={[
                  { value: '', label: 'Tous les objets' },
                  ...categories.map((c: any) => ({ value: String(c.id), label: categoryLabel(c) })),
                ]}
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); resetPage(); }}
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <ExportMenu
              fileName={`operations-${account.name}`}
              title={`Opérations — ${account.name}`}
              subtitle={filterSummary}
              columns={EXPORT_COLUMNS}
              totalRow={['', '', '', '', '', `Entrées : ${formatCurrency(totalEntree)}`, `Sorties : ${formatCurrency(totalSortie)}`, formatCurrency(totalEntree - totalSortie)]}
              fetchRows={async () => {
                const r = await window.electron.treasury.listOperations(token, filters, 1, 100000);
                return r.success ? r.data ?? [] : [];
              }}
            />
          </div>

          {/* Tableau des opérations */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {opsLoading ? (
              <div className="p-6"><SkeletonTable rows={8} /></div>
            ) : operations.length === 0 ? (
              <div className="py-16 text-center text-slate-400">Aucune opération pour ces critères.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Libellé</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Objet</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Origine</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Mode</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Montant</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operations.map((op: any) => (
                    <tr key={op.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{formatDate(op.operationDate)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {op.label}
                        <span className="block text-xs text-slate-400">{op.reference}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{op.category ? categoryLabel(op.category) : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={op.source === 'MANUEL' ? 'default' : 'info'}>
                          {SOURCE_LABEL[op.source] ?? op.source}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{PAYMENT_METHOD_LABEL[op.paymentMethod] ?? op.paymentMethod}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${op.direction === 'ENTREE' ? 'text-green-600' : 'text-red-500'}`}>
                        {op.direction === 'ENTREE' ? '+' : '−'} {formatCurrency(Number(op.amount))}
                      </td>
                      <td className="px-4 py-3">
                        {canManage && op.source === 'MANUEL' && (
                          <div className="flex justify-end">
                            <Button
                              size="sm" variant="ghost"
                              icon={<Trash2 className="h-4 w-4 text-red-500" />}
                              onClick={() => { deleteOperation.reset(); setDeleteOpTarget(op); }}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Totaux & pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>
              {total} opération(s) — Entrées {formatCurrency(totalEntree)} · Sorties {formatCurrency(totalSortie)}
            </span>
            {totalPages > 1 && (
              <div className="flex gap-2 items-center">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                  Précédent
                </Button>
                <span className="py-1 px-2">{page} / {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                  Suivant
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Supprimer le compte"
        message={
          deleteAccountError && typeof deleteAccountError === 'string'
            ? deleteAccountError
            : `Supprimer le compte « ${account?.name ?? ''} » ? Cette action est irréversible.`
        }
        confirmLabel="Supprimer"
        loading={deleteAccount.isPending}
      />

      <ConfirmDialog
        open={!!deleteOpTarget}
        onClose={() => setDeleteOpTarget(null)}
        onConfirm={handleDeleteOperation}
        title="Supprimer l'opération"
        message={
          deleteOpError && typeof deleteOpError === 'string'
            ? deleteOpError
            : `Supprimer l'opération « ${deleteOpTarget?.label ?? ''} » (${deleteOpTarget ? formatCurrency(Number(deleteOpTarget.amount)) : ''}) ?`
        }
        confirmLabel="Supprimer"
        loading={deleteOperation.isPending}
      />
    </PageLayout>
  );
}
