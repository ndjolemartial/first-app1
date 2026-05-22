import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Edit, Plus, Lock, Unlock, ToggleLeft, ToggleRight, Trash2, FileText,
} from 'lucide-react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatCurrency, formatDate, formatDateTime, fullName } from '../../../shared/utils/format';
import {
  useBudget, useCloseBudget, useReopenBudget, useDeleteBudget, useDeleteBudgetLine, useToggleBudgetLineActive,
} from '../hooks/useBudget';
import ProgressBar from '../components/ProgressBar';
import {
  BUDGET_STATUS_LABEL, BUDGET_STATUS_VARIANT, BUDGET_ADMIN_ROLES, BUDGET_WRITE_ROLES,
} from '../utils/budget.utils';

export default function BudgetDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canWrite = BUDGET_WRITE_ROLES.includes(role);
  const isAdmin = BUDGET_ADMIN_ROLES.includes(role);

  const { data: res, isLoading } = useBudget(id);
  const closeMut = useCloseBudget();
  const reopenMut = useReopenBudget();
  const deleteMut = useDeleteBudget();
  const toggleLine = useToggleBudgetLineActive();
  const deleteLine = useDeleteBudgetLine();

  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<number | null>(null);

  if (isLoading) {
    return (
      <PageLayout title="Budget" breadcrumbs={[{ label: 'Budgets', to: '/budgets' }]}>
        <div className="p-8"><SkeletonTable rows={6} /></div>
      </PageLayout>
    );
  }
  if (!res?.success || !res.data) {
    return (
      <PageLayout title="Budget" breadcrumbs={[{ label: 'Budgets', to: '/budgets' }]}>
        <div className="p-8 text-slate-500">Budget introuvable.</div>
      </PageLayout>
    );
  }

  const b = res.data;
  const isClosed = b.status === 'CLOTURE';
  const lines = b.lines ?? [];
  const summary = b.summary ?? {
    totalAllocated: 0, totalSpent: 0, totalRemaining: 0, linesCount: 0, operationsCount: 0,
  };
  const rate = summary.totalAllocated > 0 ? summary.totalSpent / summary.totalAllocated : 0;
  const snapshot = isClosed && b.closingSnapshot ? (b.closingSnapshot as any) : null;

  const handleClose = async () => {
    const r = await closeMut.mutateAsync(id);
    setConfirmClose(false);
    if (!r.success) alert(typeof r.error === 'string' ? r.error : 'Erreur de clôture');
  };
  const handleReopen = async () => {
    const r = await reopenMut.mutateAsync(id);
    setConfirmReopen(false);
    if (!r.success) alert(typeof r.error === 'string' ? r.error : 'Erreur de réouverture');
  };
  const handleDelete = async () => {
    const r = await deleteMut.mutateAsync(id);
    setConfirmDelete(false);
    if (r.success) navigate('/budgets');
    else alert(typeof r.error === 'string' ? r.error : 'Erreur de suppression');
  };
  const handleDeleteLine = async () => {
    if (lineToDelete == null) return;
    const r = await deleteLine.mutateAsync(lineToDelete);
    setLineToDelete(null);
    if (!r.success) alert(typeof r.error === 'string' ? r.error : 'Erreur de suppression');
  };

  return (
    <PageLayout
      title={b.name}
      breadcrumbs={[{ label: 'Budgets', to: '/budgets' }, { label: b.reference }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/budgets')}>
            Retour
          </Button>
          {canWrite && !isClosed && (
            <Button variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/budgets/${id}/edit`)}>
              Modifier
            </Button>
          )}
          {isAdmin && !isClosed && (
            <Button variant="secondary" icon={<Lock className="h-4 w-4" />} onClick={() => setConfirmClose(true)}>
              Clôturer
            </Button>
          )}
          {isAdmin && isClosed && (
            <Button variant="secondary" icon={<Unlock className="h-4 w-4" />} onClick={() => setConfirmReopen(true)}>
              Rouvrir
            </Button>
          )}
          {isAdmin && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          )}
        </div>
      }
    >
      {/* En-tête : informations du budget */}
      <Card className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-slate-400 font-mono">{b.reference}</p>
            <p className="text-xl font-bold text-slate-900">{b.name}</p>
            <p className="text-sm text-slate-500 mt-1">
              {formatDate(b.periodStart)} → {formatDate(b.periodEnd)}
            </p>
            {b.description && <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{b.description}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={BUDGET_STATUS_VARIANT[b.status as 'OUVERT' | 'CLOTURE']}>
              {BUDGET_STATUS_LABEL[b.status as 'OUVERT' | 'CLOTURE']}
            </Badge>
            {isClosed && b.closedAt && (
              <p className="text-xs text-slate-500">
                Clôturé le {formatDateTime(b.closedAt)}
                {b.closedBy && ` par ${fullName(b.closedBy.firstName, b.closedBy.lastName)}`}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-xs text-slate-500">Total alloué</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.totalAllocated)}</p>
          <p className="text-xs text-slate-400">{summary.linesCount} ligne(s)</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Total dépensé</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalSpent)}</p>
          <p className="text-xs text-slate-400">{summary.operationsCount} opération(s)</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Solde restant</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(summary.totalRemaining)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 mb-2">Consommation</p>
          <ProgressBar rate={rate} />
        </Card>
      </div>

      {/* Lignes budgétaires */}
      <Card padding={false} className="mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Lignes budgétaires</h3>
          {canWrite && !isClosed && (
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/budgets/${id}/lines/new`)}>
              Nouvelle ligne
            </Button>
          )}
        </div>
        {lines.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">
            Aucune ligne budgétaire. {canWrite && !isClosed && 'Ajoutez une première ligne pour démarrer.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Ligne</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Gestionnaire</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Alloué</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Dépensé</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Restant</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 w-48">Évolution</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">
                    <p className="font-medium">{l.label}</p>
                    {l.code && <p className="text-xs text-slate-400">{l.code}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {l.manager ? fullName(l.manager.firstName, l.manager.lastName) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(l.allocatedAmount)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{formatCurrency(l.spent)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(l.remaining)}</td>
                  <td className="px-4 py-3"><ProgressBar rate={l.consumptionRate} /></td>
                  <td className="px-4 py-3">
                    {!l.isActive ? (
                      <Badge variant="default">Inactive</Badge>
                    ) : l.consumptionRate >= 1 ? (
                      <Badge variant="danger">Dépassée</Badge>
                    ) : l.consumptionRate >= 0.8 ? (
                      <Badge variant="warning">Critique</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canWrite && !isClosed && (
                        <>
                          <button
                            title="Activer / désactiver"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                            onClick={() => toggleLine.mutate(l.id)}
                          >
                            {l.isActive
                              ? <ToggleRight className="h-4 w-4 text-emerald-600" />
                              : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                          </button>
                          <button
                            title="Modifier"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                            onClick={() => navigate(`/budgets/${id}/lines/${l.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {isAdmin && l.operationsCount === 0 && (
                        <button
                          title="Supprimer"
                          className="p-1.5 rounded hover:bg-red-50 text-red-500"
                          onClick={() => setLineToDelete(l.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Snapshot de clôture */}
      {snapshot && (
        <Card padding={false}>
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <FileText className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold text-slate-800">Récapitulatif de clôture</h3>
          </div>
          <div className="p-6 space-y-3 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Période</p>
                <p className="text-slate-700">
                  {formatDate(snapshot.summary.periodStart)} → {formatDate(snapshot.summary.periodEnd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Alloué</p>
                <p className="text-slate-700 font-semibold">{formatCurrency(snapshot.summary.totalAllocated)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Dépensé</p>
                <p className="text-red-600 font-semibold">{formatCurrency(snapshot.summary.totalSpent)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Solde</p>
                <p className="text-emerald-700 font-semibold">{formatCurrency(snapshot.summary.totalRemaining)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
              Cliché figé au moment de la clôture, indépendant des opérations modifiées par la suite.
            </p>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={handleClose}
        title="Clôturer le budget"
        message="Le budget passera en lecture seule. Plus aucune opération ne pourra y être imputée. Un récapitulatif figé sera conservé."
        confirmLabel="Clôturer"
        loading={closeMut.isPending}
      />
      <ConfirmDialog
        open={confirmReopen}
        onClose={() => setConfirmReopen(false)}
        onConfirm={handleReopen}
        title="Rouvrir le budget"
        message="Le récapitulatif figé sera supprimé. Le budget redevient modifiable."
        confirmLabel="Rouvrir"
        loading={reopenMut.isPending}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Supprimer le budget"
        message="Cette action archive le budget. Elle est impossible si des opérations sont imputées à ses lignes."
        confirmLabel="Supprimer"
        loading={deleteMut.isPending}
      />
      <ConfirmDialog
        open={lineToDelete != null}
        onClose={() => setLineToDelete(null)}
        onConfirm={handleDeleteLine}
        title="Supprimer la ligne"
        message="La ligne sera supprimée définitivement. Cette action n'est possible qu'en l'absence d'opérations imputées."
        confirmLabel="Supprimer"
        loading={deleteLine.isPending}
      />
    </PageLayout>
  );
}
