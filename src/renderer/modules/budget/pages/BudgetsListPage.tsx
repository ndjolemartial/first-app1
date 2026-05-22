import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { useBudgets } from '../hooks/useBudget';
import ProgressBar from '../components/ProgressBar';
import {
  BUDGET_STATUS_LABEL, BUDGET_STATUS_OPTIONS, BUDGET_STATUS_VARIANT, BUDGET_WRITE_ROLES,
} from '../utils/budget.utils';

export default function BudgetsListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canWrite = BUDGET_WRITE_ROLES.includes(role);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data: res, isLoading } = useBudgets({
    search: search.trim() || undefined,
    status: status || undefined,
  });
  const budgets = res?.data ?? [];

  return (
    <PageLayout
      title="Budgets"
      breadcrumbs={[{ label: 'Budgets', to: '/budgets' }, { label: 'Liste' }]}
      actions={canWrite ? (
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/budgets/new')}>
          Nouveau budget
        </Button>
      ) : null}
    >
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Rechercher (nom, référence)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            options={BUDGET_STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : budgets.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Aucun budget trouvé.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Période</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Alloué</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Dépensé</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Restant</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-48">Évolution</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {budgets.map((b: any) => {
                const rate = b.totalAllocated > 0 ? b.totalSpent / b.totalAllocated : 0;
                return (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/budgets/${b.id}`)}
                  >
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{b.reference}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {b.name}
                      <p className="text-xs text-slate-400">{b.totalLines} ligne(s)</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatDate(b.periodStart)} → {formatDate(b.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(b.totalAllocated)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{formatCurrency(b.totalSpent)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(b.totalRemaining)}</td>
                    <td className="px-4 py-3"><ProgressBar rate={rate} /></td>
                    <td className="px-4 py-3">
                      <Badge variant={BUDGET_STATUS_VARIANT[b.status as 'OUVERT' | 'CLOTURE']}>
                        {BUDGET_STATUS_LABEL[b.status as 'OUVERT' | 'CLOTURE']}
                      </Badge>
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
