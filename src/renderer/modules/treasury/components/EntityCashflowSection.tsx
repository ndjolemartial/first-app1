import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useEntityCashflow } from '../hooks/useTreasury';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { ArrowDownCircle, ArrowUpCircle, Wallet, PlusCircle } from 'lucide-react';

interface EntityCashflowSectionProps {
  entityType: 'PROJECT' | 'LOTISSEMENT' | 'PROGRAMME';
  entityId: number;
  /** Préfixe query-string passé au formulaire d'opération (ex: ?projectId=12). */
  newOperationQuery: string;
}

/**
 * Section « Flux de trésorerie » affichée sur la fiche d'un projet, d'un
 * lotissement ou d'un programme immobilier. Liste les opérations rattachées
 * (entrées/sorties) et affiche un résumé (total in, total out, solde net).
 */
export default function EntityCashflowSection({
  entityType,
  entityId,
  newOperationQuery,
}: EntityCashflowSectionProps) {
  const navigate = useNavigate();
  const { data: res, isLoading } = useEntityCashflow(entityType, entityId, 50);
  const cashflow = res?.success ? (res.data as any) : null;
  const operations: any[] = cashflow?.operations ?? [];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Flux de trésorerie
        </h3>
        <Button
          size="sm"
          icon={<PlusCircle className="h-4 w-4" />}
          onClick={() => navigate(`/treasury/operations/new${newOperationQuery}`)}
        >
          Nouvelle opération
        </Button>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <ArrowDownCircle className="h-4 w-4" />
            <p className="text-xs font-medium">Entrées</p>
          </div>
          <p className="text-lg font-bold text-emerald-800 mt-1">
            {formatCurrency(cashflow?.totalEntree ?? 0)}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700">
            <ArrowUpCircle className="h-4 w-4" />
            <p className="text-xs font-medium">Sorties</p>
          </div>
          <p className="text-lg font-bold text-red-800 mt-1">
            {formatCurrency(cashflow?.totalSortie ?? 0)}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Wallet className="h-4 w-4" />
            <p className="text-xs font-medium">Solde net</p>
          </div>
          <p
            className={`text-lg font-bold mt-1 ${
              (cashflow?.net ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatCurrency(cashflow?.net ?? 0)}
          </p>
        </div>
      </div>

      {/* Liste des opérations */}
      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : operations.length === 0 ? (
        <p className="text-slate-400 text-sm py-4 text-center">
          Aucune opération de trésorerie n'est encore rattachée.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-y border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Référence</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Libellé</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Compte</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">Sens</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {operations.map((op: any) => (
              <tr key={op.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-600">{formatDate(op.operationDate)}</td>
                <td className="px-3 py-2 font-mono text-xs text-blue-700">{op.reference}</td>
                <td className="px-3 py-2 text-slate-800">
                  {op.label}
                  {op.category && (
                    <span className="text-xs text-slate-500 block">
                      {op.category.label}
                      {op.category.accountingCode ? ` · ${op.category.accountingCode}` : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">{op.bankAccount?.name ?? '—'}</td>
                <td className="px-3 py-2 text-center">
                  <Badge variant={op.direction === 'ENTREE' ? 'success' : 'danger'}>
                    {op.direction === 'ENTREE' ? 'Entrée' : 'Sortie'}
                  </Badge>
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    op.direction === 'ENTREE' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {op.direction === 'ENTREE' ? '+' : '−'} {formatCurrency(Number(op.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
