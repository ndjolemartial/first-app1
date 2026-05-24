import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import { useUpdateInstallments } from '../hooks/useConventions';
import { toast } from '../../../shared/components/ui/Toast';
import { formatCurrency } from '../../../shared/utils/format';
import { Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';

type RawInstallment = {
  id: number;
  installmentNumber: number;
  dueDate: string;
  amount: number | string;
  status: 'EN_ATTENTE' | 'A_REGLER' | 'PAYE' | 'EN_RETARD' | 'ANNULE';
};

interface Props {
  open: boolean;
  onClose: () => void;
  conventionId: number;
  installments: RawInstallment[];
  saleAmount: number;
  apportInitial?: number;
}

type Row = {
  id: number;
  installmentNumber: number;
  status: RawInstallment['status'];
  dueDate: string;   // yyyy-mm-dd
  amount: number;
  editable: boolean;
};

const STATUS_VARIANT: Record<RawInstallment['status'], 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  PAYE: 'success', EN_ATTENTE: 'info', A_REGLER: 'warning', EN_RETARD: 'danger', ANNULE: 'default',
};
const STATUS_LABEL: Record<RawInstallment['status'], string> = {
  PAYE: 'Payé', EN_ATTENTE: 'En attente', A_REGLER: 'À régler', EN_RETARD: 'En retard', ANNULE: 'Annulé',
};

/** ISO ou Date → "yyyy-mm-dd" (locale) pour <input type="date"> */
function toDateInputValue(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function EditInstallmentsModal({
  open, onClose, conventionId, installments, saleAmount, apportInitial,
}: Props) {
  const updateInstallments = useUpdateInstallments();
  const expectedTotal = useMemo(
    () => round2(Number(saleAmount) - Number(apportInitial ?? 0)),
    [saleAmount, apportInitial],
  );

  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    setRows(
      installments.map((i) => ({
        id: i.id,
        installmentNumber: i.installmentNumber,
        status: i.status,
        dueDate: toDateInputValue(i.dueDate),
        amount: Number(i.amount),
        editable: i.status !== 'PAYE',
      })),
    );
  }, [open, installments]);

  const total = useMemo(() => round2(rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0)), [rows]);
  const diff = round2(expectedTotal - total);
  const isBalanced = Math.abs(diff) < 0.01;
  const lastEditableIndex = useMemo(() => {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].editable) return i;
    }
    return -1;
  }, [rows]);

  const handleAmount = (idx: number, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: value === '' ? 0 : Number(value) } : r)));
  };

  const handleDate = (idx: number, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, dueDate: value } : r)));
  };

  /** Ajuste la dernière ligne éditable pour absorber le reste à répartir. */
  const handleSpreadRemainder = () => {
    if (lastEditableIndex < 0) return;
    setRows((prev) => prev.map((r, i) => {
      if (i !== lastEditableIndex) return r;
      const newAmount = round2(Number(r.amount) + diff);
      return { ...r, amount: newAmount < 0 ? 0 : newAmount };
    }));
  };

  const handleSave = async () => {
    if (!isBalanced) return;
    // Validation : aucune date vide
    const missingDate = rows.find((r) => r.editable && !r.dueDate);
    if (missingDate) {
      toast.error(`Date manquante pour l'échéance n°${missingDate.installmentNumber}`);
      return;
    }
    const payload = rows
      .filter((r) => r.editable)
      .map((r) => ({ id: r.id, dueDate: new Date(r.dueDate).toISOString(), amount: r.amount }));
    if (payload.length === 0) {
      toast.error('Aucune échéance modifiable.');
      return;
    }
    const res = await updateInstallments.mutateAsync({ conventionId, installments: payload });
    if (res?.success) {
      toast.success('Échéances mises à jour.');
      onClose();
    } else {
      const msg = typeof res?.error === 'string' ? res.error : 'Échec de la mise à jour des échéances.';
      toast.error(msg);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifier les échéances de paiement"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={updateInstallments.isPending}>Annuler</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={updateInstallments.isPending}
            disabled={!isBalanced || updateInstallments.isPending}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 mb-4">
        Ajustez la date et/ou le montant de chaque échéance. Le total doit correspondre au montant à payer.
        Les lignes payées sont en lecture seule.
      </p>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600 w-12">N°</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Date d'échéance</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Montant</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, idx) => (
              <tr key={r.id} className={r.editable ? '' : 'bg-slate-50/60'}>
                <td className="px-3 py-2 text-slate-500">{r.installmentNumber}</td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={r.dueDate}
                    disabled={!r.editable}
                    onChange={(e) => handleDate(idx, e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.amount}
                    disabled={!r.editable}
                    onChange={(e) => handleAmount(idx, e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Synthèse total / écart */}
      <div className="mt-4 rounded-lg border border-slate-200 p-4 bg-slate-50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Montant à payer</span>
          <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(expectedTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-slate-600">Total des échéances</span>
          <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(total)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-slate-200">
          <span className="flex items-center gap-2 font-medium">
            {isBalanced ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-emerald-700">Équilibré</span></>
            ) : (
              <><AlertTriangle className="h-4 w-4 text-amber-600" /><span className="text-amber-700">Écart à régler</span></>
            )}
          </span>
          <span className={`font-semibold tabular-nums ${isBalanced ? 'text-emerald-700' : 'text-amber-700'}`}>
            {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
          </span>
        </div>
        {!isBalanced && lastEditableIndex >= 0 && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              icon={<Scale className="h-4 w-4" />}
              onClick={handleSpreadRemainder}
            >
              Répartir le reste sur la dernière ligne (n°{rows[lastEditableIndex].installmentNumber})
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
