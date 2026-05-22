import { useNavigate } from 'react-router-dom';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatCurrency } from '../../../shared/utils/format';
import {
  COMMISSION_STATUS_LABEL,
  COMMISSION_STATUS_VARIANT,
  TRANSACTION_TYPE_LABEL,
  SOURCE_LABEL,
  beneficiaryName,
} from '../utils/commissions.utils';

interface CommissionTableProps {
  commissions: any[];
  isLoading?: boolean;
  showBeneficiary?: boolean;
  canManage?: boolean;
  onPay?: (commission: any) => void;
  onCancel?: (commission: any) => void;
  emptyMessage?: string;
}

/** Tableau réutilisable de commissions avec actions payer / annuler. */
export default function CommissionTable({
  commissions,
  isLoading,
  showBeneficiary = true,
  canManage = false,
  onPay,
  onCancel,
  emptyMessage = 'Aucune commission.',
}: CommissionTableProps) {
  const navigate = useNavigate();

  if (isLoading) return <div className="p-4"><SkeletonTable rows={6} /></div>;
  if (commissions.length === 0) return <p className="p-6 text-sm text-slate-400 text-center">{emptyMessage}</p>;

  const showActions = canManage && (onPay || onCancel);

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Convention</th>
          {showBeneficiary && <th className="text-left px-4 py-3 font-medium text-slate-600">Bénéficiaire</th>}
          <th className="text-left px-4 py-3 font-medium text-slate-600">Transaction</th>
          <th className="text-right px-4 py-3 font-medium text-slate-600">Assiette</th>
          <th className="text-right px-4 py-3 font-medium text-slate-600">Taux</th>
          <th className="text-right px-4 py-3 font-medium text-slate-600">Montant</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
          {showActions && <th className="px-4 py-3" />}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {commissions.map((c: any) => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="px-4 py-3">
              <span className="font-medium text-slate-800">{c.reference}</span>
              <span className="ml-2 text-xs text-slate-400">{SOURCE_LABEL[c.source] ?? c.source}</span>
            </td>
            <td className="px-4 py-3">
              {c.convention ? (
                <button
                  className="font-medium text-indigo-600 hover:underline"
                  onClick={() => navigate(`/conventions/${c.conventionId}`)}
                >
                  {c.convention.reference}
                </button>
              ) : '—'}
            </td>
            {showBeneficiary && (
              <td className="px-4 py-3 text-slate-700">
                {beneficiaryName(c)}
                {c.beneficiaryType === 'USER' && c.user?.fonction && (
                  <span className="ml-2 text-xs text-slate-400">· {c.user.fonction}</span>
                )}
              </td>
            )}
            <td className="px-4 py-3 text-slate-600">{TRANSACTION_TYPE_LABEL[c.transactionType] ?? c.transactionType}</td>
            <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(Number(c.baseAmount))}</td>
            <td className="px-4 py-3 text-right text-slate-500">{Number(c.rate)} %</td>
            <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(Number(c.amount))}</td>
            <td className="px-4 py-3">
              <Badge variant={COMMISSION_STATUS_VARIANT[c.status] ?? 'default'}>
                {COMMISSION_STATUS_LABEL[c.status] ?? c.status}
              </Badge>
            </td>
            {showActions && (
              <td className="px-4 py-3">
                {c.status === 'A_PAYER' && (
                  <div className="flex justify-end gap-2">
                    {onPay && (
                      <Button size="sm" onClick={() => onPay(c)}>Payer</Button>
                    )}
                    {onCancel && (
                      <Button size="sm" variant="secondary" onClick={() => onCancel(c)}>Annuler</Button>
                    )}
                  </div>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
