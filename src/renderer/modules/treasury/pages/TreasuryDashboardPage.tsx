import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useTreasuryDashboard } from '../hooks/useTreasury';
import {
  ACCOUNT_TYPE_LABEL, ACCOUNT_TYPE_VARIANT, DIRECTION_LABEL, SOURCE_LABEL,
  TREASURY_WRITE_ROLES, TREASURY_ADMIN_ROLES, categoryLabel,
} from '../utils/treasury.utils';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import {
  Plus, Wallet, ArrowDownCircle, ArrowUpCircle, Landmark, Tags, Banknote,
} from 'lucide-react';

export default function TreasuryDashboardPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canManage = TREASURY_WRITE_ROLES.includes(role);
  // Solde total, sorties du mois, nombre d'opérations : réservés aux administrateurs.
  const isAdmin = TREASURY_ADMIN_ROLES.includes(role);

  const { data: res, isLoading } = useTreasuryDashboard();
  const d = res?.data;

  return (
    <PageLayout
      title="Trésorerie"
      breadcrumbs={[{ label: 'Trésorerie' }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Tags className="h-4 w-4" />} onClick={() => navigate('/treasury/categories')}>
            Objets d'opération
          </Button>
          {canManage && (
            <>
              <Button
                variant="secondary"
                icon={<Banknote className="h-4 w-4" />}
                onClick={() => navigate('/treasury/operations/new')}
              >
                Nouvelle opération
              </Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/treasury/accounts/new')}>
                Nouveau compte
              </Button>
            </>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="p-8"><SkeletonTable rows={6} /></div>
      ) : !d ? (
        <div className="p-8 text-slate-500">Données indisponibles.</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {isAdmin && (
              <Card className="flex items-center gap-4">
                <div className="rounded-xl bg-blue-50 p-3">
                  <Wallet className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Solde total</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(d.totalBalance)}</p>
                  <p className="text-xs text-slate-400">{d.accountsCount} compte(s)</p>
                </div>
              </Card>
            )}
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-green-50 p-3">
                <ArrowDownCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Entrées du mois</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(d.monthIn)}</p>
              </div>
            </Card>
            {isAdmin && (
              <Card className="flex items-center gap-4">
                <div className="rounded-xl bg-red-50 p-3">
                  <ArrowUpCircle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Sorties du mois</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(d.monthOut)}</p>
                </div>
              </Card>
            )}
            {isAdmin && (
              <Card className="flex items-center gap-4">
                <div className="rounded-xl bg-slate-100 p-3">
                  <Banknote className="h-6 w-6 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Opérations enregistrées</p>
                  <p className="text-xl font-bold text-slate-900">{d.operationsCount}</p>
                </div>
              </Card>
            )}
          </div>

          {/* Comptes */}
          <Card className="mb-6" padding={false}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Comptes de trésorerie</h3>
            </div>
            {(d.accounts ?? []).length === 0 ? (
              <p className="p-6 text-sm text-slate-400 text-center">
                Aucun compte enregistré. Créez un premier compte pour suivre votre trésorerie.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                {d.accounts.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/treasury/accounts/${a.id}`)}
                    className="text-left rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Landmark className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{a.name}</span>
                      </div>
                      <Badge variant={ACCOUNT_TYPE_VARIANT[a.type] ?? 'default'}>
                        {ACCOUNT_TYPE_LABEL[a.type] ?? a.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mb-2 truncate">
                      {[a.bankName, a.accountNumber].filter(Boolean).join(' — ') || 'Aucune coordonnée'}
                    </p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(a.balance, a.currency)}</p>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-green-600">+ {formatCurrency(a.totalIn, a.currency)}</span>
                      <span className="text-red-500">− {formatCurrency(a.totalOut, a.currency)}</span>
                    </div>
                    {!a.isActive && <p className="text-xs text-slate-400 mt-2">Compte inactif</p>}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Opérations récentes */}
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                {isAdmin ? 'Opérations récentes' : 'Mes opérations récentes'}
              </h3>
            </div>
            {(d.recent ?? []).length === 0 ? (
              <p className="p-6 text-sm text-slate-400 text-center">Aucune opération enregistrée.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Libellé</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Compte</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Objet</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Origine</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.recent.map((op: any) => (
                    <tr key={op.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{formatDate(op.operationDate)}</td>
                      <td className="px-4 py-3 text-slate-700">{op.label}</td>
                      <td className="px-4 py-3 text-slate-500">{op.bankAccount?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{op.category ? categoryLabel(op.category) : '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{SOURCE_LABEL[op.source] ?? op.source}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${op.direction === 'ENTREE' ? 'text-green-600' : 'text-red-500'}`}>
                        {op.direction === 'ENTREE' ? '+' : '−'} {formatCurrency(Number(op.amount))}
                        <span className="ml-1 text-xs text-slate-400">{DIRECTION_LABEL[op.direction]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </PageLayout>
  );
}
