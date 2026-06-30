import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { Plus, Banknote, Pencil, XCircle, Trash2, AlertTriangle, Wallet } from 'lucide-react';
import {
  useExpenses, useExpenseStats, useExpenseAccounts, useSettleExpense, useCancelExpense, useRemoveExpense,
} from '../hooks/useExpenses';
import FundAccountModal from '../../../shared/components/FundAccountModal';

const STATUS_LABEL: Record<string, string> = { PREVUE: 'Prévue', REGLEE: 'Réglée', ANNULEE: 'Annulée' };
const PAYMENT_OPTIONS = [
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
];

function toDateInput(d?: string | Date | null): string {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function SettleModal({ expense, onClose }: { expense: any; onClose: () => void }) {
  const settle = useSettleExpense();
  const { data: accRes } = useExpenseAccounts();
  const fallbackDefault = useAuthStore((s) => s.user?.defaultAccountSortieId);
  const accounts: any[] = accRes?.success ? (accRes.data ?? []) : [];
  const defaultAccountId = (accRes?.success ? accRes.defaultAccountId : null) ?? fallbackDefault ?? null;

  const [amount, setAmount] = useState(String(Number(expense.amount)));
  const [date, setDate] = useState(() => toDateInput());
  const [method, setMethod] = useState('VIREMENT');
  const [account, setAccount] = useState('');
  const [ref, setRef] = useState('');
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    if (account || accounts.length === 0) return;
    const preferred = (defaultAccountId != null && accounts.find((a) => a.id === defaultAccountId)) || accounts[0];
    if (preferred) setAccount(String(preferred.id));
  }, [accounts, defaultAccountId, account]);

  const options = accounts.map((a) => ({ value: String(a.id), label: a.name }));
  const selectedAccount = accounts.find((a) => String(a.id) === account) ?? null;
  const balance = selectedAccount ? Number(selectedAccount.balance ?? 0) : null;
  const settleAmount = Number(amount) || 0;
  // Solde insuffisant : le compte sélectionné ne couvre pas le montant à régler.
  // Le règlement est bloqué tant que le compte n'est pas approvisionné à hauteur
  // du montant (solde ≥ montant requis).
  const insufficient = selectedAccount != null && balance != null && settleAmount > 0 && balance < settleAmount;

  return (
    <>
    <Modal open onClose={onClose} title={`Régler ${expense.reference}`} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={settle.isPending} disabled={!account || !date || !(Number(amount) > 0) || insufficient}
            onClick={async () => {
              const r = await settle.mutateAsync({
                id: expense.id,
                amount: Number(amount),
                settledAt: date,
                bankAccountId: Number(account),
                paymentMethod: method,
                paymentRef: ref.trim() || null,
              });
              if (r.success) onClose();
            }}>Régler & comptabiliser</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">{expense.label}</p>
        <Input label="Montant (FCFA)" type="number" step="1000" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Date de règlement" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Compte débité" options={options} value={account} onChange={(e) => setAccount(e.target.value)} />
        {selectedAccount && (
          <p className="-mt-1 text-xs text-slate-500">
            Solde du compte :{' '}
            <span className={`font-semibold ${insufficient ? 'text-red-600' : 'text-slate-700'}`}>
              {formatCurrency(balance ?? 0)}
            </span>
          </p>
        )}
        {insufficient && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700">Solde insuffisant</p>
                <p className="mt-0.5 text-xs text-red-600">
                  Le solde de ce compte ({formatCurrency(balance ?? 0)}) ne couvre pas le montant à régler ({formatCurrency(settleAmount)}). Approvisionnez-le pour pouvoir régler cette charge.
                </p>
                <Button size="sm" variant="secondary" className="mt-2" icon={<Wallet className="h-4 w-4" />}
                  onClick={() => setFunding(true)}>
                  Approvisionner le compte
                </Button>
              </div>
            </div>
          </div>
        )}
        <Select label="Mode de paiement" options={PAYMENT_OPTIONS} value={method} onChange={(e) => setMethod(e.target.value)} />
        <Input label="Référence du règlement (facultatif)" value={ref} onChange={(e) => setRef(e.target.value)} />
        <p className="text-xs text-slate-500">Une opération de sortie sera enregistrée en comptabilité sur le compte choisi.</p>
      </div>
    </Modal>
    {funding && selectedAccount && (
      <FundAccountModal account={selectedAccount} onClose={() => setFunding(false)} />
    )}
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-xl font-bold ${tone ?? 'text-slate-900'}`}>{value}</span>
    </Card>
  );
}

export default function ExpensesListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [settleTarget, setSettleTarget] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const filters = useMemo(() => ({ status: status || undefined, search: search || undefined }), [status, search]);
  const { data: res, isLoading } = useExpenses(filters, page);
  const { data: statsRes } = useExpenseStats();
  const cancel = useCancelExpense();
  const remove = useRemoveExpense();

  const rows: any[] = res?.success ? (res.data ?? []) : [];
  const total = res?.success ? (res.total ?? 0) : 0;
  const stats = statsRes?.success ? statsRes.data : null;
  const now = new Date();

  return (
    <PageLayout
      title="Charges prévisionnelles"
      breadcrumbs={[{ label: 'Charges prévisionnelles' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/expenses/new')}>Nouvelle charge</Button>
      }
    >
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Prévues" value={String(stats.prevue)} />
          <StatCard label="En retard" value={String(stats.overdue)} tone={stats.overdue > 0 ? 'text-red-600' : undefined} />
          <StatCard label="Total à régler" value={`${formatCurrency(stats.totalDue)}`} />
          <StatCard label="Réglé ce mois" value={`${formatCurrency(stats.settledThisMonth)}`} tone="text-emerald-600" />
        </div>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Select label="Statut" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              options={[{ value: '', label: 'Tous' }, { value: 'PREVUE', label: 'Prévues' }, { value: 'REGLEE', label: 'Réglées' }, { value: 'ANNULEE', label: 'Annulées' }]} />
          </div>
          <div className="w-64">
            <Input label="Recherche" placeholder="Référence ou libellé" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <SkeletonTable rows={6} />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Aucune charge prévisionnelle.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Référence</th>
                  <th className="py-2 pr-3">Libellé</th>
                  <th className="py-2 pr-3">Objet</th>
                  <th className="py-2 pr-3 text-right">Montant</th>
                  <th className="py-2 pr-3">Échéance</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Planifié par</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((e) => {
                  const overdue = e.status === 'PREVUE' && new Date(e.dueDate) < now;
                  return (
                    <tr key={e.id}>
                      <td className="py-2 pr-3 font-mono text-xs">{e.reference}</td>
                      <td className="py-2 pr-3">{e.label}</td>
                      <td className="py-2 pr-3 text-slate-600">{e.category?.label ?? '—'}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(Number(e.status === 'REGLEE' && e.settledAmount != null ? e.settledAmount : e.amount))}</td>
                      <td className="py-2 pr-3">{formatDate(e.dueDate)}</td>
                      <td className="py-2 pr-3">
                        {overdue
                          ? <Badge variant="danger">En retard</Badge>
                          : <Badge variant={e.status === 'REGLEE' ? 'success' : e.status === 'ANNULEE' ? 'default' : 'warning'}>{STATUS_LABEL[e.status]}</Badge>}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}` : '—'}</td>
                      <td className="py-2 pr-3">
                        <div className="flex justify-end gap-1">
                          {e.status === 'PREVUE' && (
                            <Button size="sm" icon={<Banknote className="h-4 w-4" />} onClick={() => setSettleTarget(e)}>Régler</Button>
                          )}
                          {e.status === 'PREVUE' && (
                            <Button size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/expenses/${e.id}/edit`)} />
                          )}
                          {e.status === 'PREVUE' && (
                            <Button size="sm" variant="secondary" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelTarget(e)} />
                          )}
                          {e.status !== 'REGLEE' && (
                            <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(e)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > 20 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">{total} charge(s)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
              <Button size="sm" variant="secondary" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
            </div>
          </div>
        )}
      </Card>

      {settleTarget && <SettleModal expense={settleTarget} onClose={() => setSettleTarget(null)} />}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Annuler la charge"
        message={`Annuler la charge ${cancelTarget?.reference} ? Le rappel CRM associé sera clôturé.`}
        confirmLabel="Annuler la charge"
        loading={cancel.isPending}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => { await cancel.mutateAsync(cancelTarget.id); setCancelTarget(null); }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer la charge"
        message={`Supprimer définitivement la charge ${deleteTarget?.reference} ?`}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { await remove.mutateAsync(deleteTarget.id); setDeleteTarget(null); }}
      />
    </PageLayout>
  );
}
