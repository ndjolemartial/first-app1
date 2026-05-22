import { useNavigate } from 'react-router-dom';
import { Plus, Wallet, PieChart, FolderPlus, ArrowDownCircle, ListTree } from 'lucide-react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatCurrency, formatDate, fullName } from '../../../shared/utils/format';
import { useBudgetDashboard } from '../hooks/useBudget';
import ProgressBar from '../components/ProgressBar';
import {
  BUDGET_STATUS_LABEL, BUDGET_STATUS_VARIANT, BUDGET_ADMIN_ROLES,
} from '../utils/budget.utils';

export default function BudgetDashboardPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  // Seuls les administrateurs peuvent consulter les listes/fiches de budgets et
  // ouvrir les actions de gestion. Les gestionnaires non-admin ne voient que
  // leurs propres lignes (cf. backend `budget.ipc.ts`).
  const isAdmin = BUDGET_ADMIN_ROLES.includes(role);

  const { data: res, isLoading } = useBudgetDashboard();
  const d = res?.data;

  return (
    <PageLayout
      title={isAdmin ? 'Budgets' : 'Mes lignes budgétaires'}
      breadcrumbs={[{ label: 'Budgets' }]}
      actions={
        isAdmin ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<ListTree className="h-4 w-4" />}
              onClick={() => navigate('/budgets/list')}
            >
              Liste des budgets
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/budgets/new')}>
              Nouveau budget
            </Button>
          </div>
        ) : null
      }
    >
      {isLoading ? (
        <div className="p-8"><SkeletonTable rows={6} /></div>
      ) : !d ? (
        <div className="p-8 text-slate-500">Données indisponibles.</div>
      ) : (
        <>
          {/* KPIs : globaux pour les admins, restreints aux lignes du gestionnaire sinon. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-blue-50 p-3"><Wallet className="h-6 w-6 text-blue-600" /></div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">
                  {isAdmin ? 'Total alloué' : 'Alloué à mes lignes'}
                </p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(d.stats.totalAllocated)}</p>
                {isAdmin && <p className="text-xs text-slate-400">{d.stats.budgetsCount} budget(s)</p>}
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-red-50 p-3"><ArrowDownCircle className="h-6 w-6 text-red-500" /></div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">
                  {isAdmin ? 'Total dépensé' : 'Mes dépenses'}
                </p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(d.stats.totalSpent)}</p>
                <p className="text-xs text-slate-400">
                  {d.stats.totalAllocated > 0
                    ? `${Math.round((d.stats.totalSpent / d.stats.totalAllocated) * 100)} % de l'enveloppe`
                    : '—'}
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-emerald-50 p-3"><PieChart className="h-6 w-6 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Solde restant</p>
                <p className="text-xl font-bold text-emerald-700">{formatCurrency(d.stats.totalRemaining)}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-slate-100 p-3"><FolderPlus className="h-6 w-6 text-slate-500" /></div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">
                  {isAdmin ? 'Lignes budgétaires' : 'Mes lignes'}
                </p>
                <p className="text-xl font-bold text-slate-900">{d.stats.linesCount}</p>
                <p className="text-xs text-slate-400">{d.stats.activeLines} active(s)</p>
              </div>
            </Card>
          </div>

          {/* Cartes budgets — administrateurs uniquement */}
          {isAdmin && (
            <Card className="mb-6" padding={false}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Budgets en cours</h3>
                <p className="text-xs text-slate-500">
                  {d.stats.openBudgets} ouvert(s) · {d.stats.closedBudgets} clôturé(s)
                </p>
              </div>
              {(d.budgets ?? []).length === 0 ? (
                <p className="p-6 text-sm text-slate-400 text-center">
                  Aucun budget enregistré. Créez un premier budget pour démarrer.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  {d.budgets.map((b: any) => (
                    <button
                      key={b.id}
                      onClick={() => navigate(`/budgets/${b.id}`)}
                      className="text-left rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{b.name}</p>
                          <p className="text-xs text-slate-400">{b.reference}</p>
                        </div>
                        <Badge variant={BUDGET_STATUS_VARIANT[b.status as 'OUVERT' | 'CLOTURE']}>
                          {BUDGET_STATUS_LABEL[b.status as 'OUVERT' | 'CLOTURE']}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        {formatDate(b.periodStart)} → {formatDate(b.periodEnd)}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                        <div>
                          <p className="text-slate-400">Alloué</p>
                          <p className="font-semibold text-slate-700">{formatCurrency(b.totalAllocated)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Dépensé</p>
                          <p className="font-semibold text-red-500">{formatCurrency(b.totalSpent)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Restant</p>
                          <p className="font-semibold text-emerald-600">{formatCurrency(b.totalRemaining)}</p>
                        </div>
                      </div>
                      <ProgressBar rate={b.consumptionRate} />
                      <p className="text-xs text-slate-400 mt-2">{b.totalLines} ligne(s)</p>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Lignes budgétaires — visibles par tous (filtrées côté serveur) */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                {isAdmin ? 'Évolution des lignes budgétaires' : 'Mes lignes budgétaires'}
              </h3>
            </div>
            {(d.lines ?? []).length === 0 ? (
              <p className="p-6 text-sm text-slate-400 text-center">
                {isAdmin
                  ? 'Aucune ligne budgétaire.'
                  : 'Aucune ligne budgétaire ne vous est attribuée pour le moment.'}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Ligne</th>
                    {isAdmin && (
                      <>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Budget</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Gestionnaire</th>
                      </>
                    )}
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Alloué</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Dépensé</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Restant</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 w-56">Évolution</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.lines.map((l: any) => (
                    <tr
                      key={l.id}
                      className={isAdmin ? 'hover:bg-slate-50 cursor-pointer' : ''}
                      onClick={isAdmin ? () => navigate(`/budgets/${l.budgetId}`) : undefined}
                    >
                      <td className="px-4 py-3 text-slate-700">
                        <p className="font-medium">{l.label}</p>
                        {l.code && <p className="text-xs text-slate-400">{l.code}</p>}
                      </td>
                      {isAdmin && (
                        <>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {l.budget?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {l.manager ? fullName(l.manager.firstName, l.manager.lastName) : '—'}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(l.allocatedAmount)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{formatCurrency(l.spent)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(l.remaining)}</td>
                      <td className="px-4 py-3">
                        <ProgressBar rate={l.consumptionRate} />
                      </td>
                      <td className="px-4 py-3">
                        {!l.isActive ? (
                          <Badge variant="default">Inactive</Badge>
                        ) : l.budget?.status === 'CLOTURE' ? (
                          <Badge variant="default">Clôturée</Badge>
                        ) : l.consumptionRate >= 1 ? (
                          <Badge variant="danger">Dépassée</Badge>
                        ) : l.consumptionRate >= 0.8 ? (
                          <Badge variant="warning">Critique</Badge>
                        ) : (
                          <Badge variant="success">En cours</Badge>
                        )}
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
