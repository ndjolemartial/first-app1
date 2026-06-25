import { useForm } from 'react-hook-form';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import { usePayCommission, useCancelCommission, useUpdateCommission } from '../hooks/useCommissions';
import { PAYMENT_METHOD_OPTIONS, transactionLabel, beneficiaryName } from '../utils/commissions.utils';
import TreasuryAccountFields from '../../../shared/components/TreasuryAccountFields';
import { formatCurrency } from '../../../shared/utils/format';
import { CreditCard, Ban, Save } from 'lucide-react';

interface ModalProps {
  commission: any;
  onClose: () => void;
  onSuccess: () => void;
}

/** Modale d'enregistrement du paiement d'une commission. */
export function PayCommissionModal({ commission, onClose, onSuccess }: ModalProps) {
  const payCommission = usePayCommission();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { method: 'VIREMENT', paymentRef: '', notes: '' },
  });
  const error = payCommission.data && !payCommission.data.success ? payCommission.data.error : null;

  const onSubmit = async (data: any) => {
    const r = await payCommission.mutateAsync({
      id: commission.id,
      method: data.method,
      paymentRef: data.paymentRef,
      notes: data.notes,
      bankAccountId: data.bankAccountId ? Number(data.bankAccountId) : undefined,
      categoryId: data.categoryId ? Number(data.categoryId) : undefined,
    });
    if (r.success) onSuccess();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Payer la commission"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
            icon={<CreditCard className="h-4 w-4" />}
          >
            Confirmer le paiement
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        {commission.reference} — {beneficiaryName(commission)}
      </p>
      <div className="bg-green-50 rounded-lg p-3 mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-600">Montant à payer</span>
        <span className="text-xl font-bold text-slate-900">{formatCurrency(Number(commission.amount))}</span>
      </div>
      <form className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Mode de paiement</label>
          <select
            {...register('method')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Référence du règlement (chèque, virement…)</label>
          <input
            type="text"
            {...register('paymentRef')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optionnel)</label>
          <textarea
            rows={2}
            {...register('notes')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <TreasuryAccountFields register={register} direction="SORTIE" />
        {error && <p className="text-xs text-red-600">{typeof error === 'string' ? error : 'Erreur lors du paiement'}</p>}
      </form>
    </Modal>
  );
}

/**
 * Modale d'édition d'une commission encore à payer : assiette, taux et note.
 * Le montant final est recalculé côté serveur à partir des nouveaux valeurs.
 */
export function EditCommissionModal({ commission, onClose, onSuccess }: ModalProps) {
  const updateCommission = useUpdateCommission();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      baseAmount: String(Number(commission.baseAmount)),
      rate: String(Number(commission.rate)),
      notes: commission.notes ?? '',
    },
  });
  const apiError = updateCommission.data && !updateCommission.data.success ? updateCommission.data.error : null;

  const baseAmount = Number(watch('baseAmount') || 0);
  const rate = Number(watch('rate') || 0);
  const previewAmount = Math.round(baseAmount * (rate / 100) * 100) / 100;

  const onSubmit = async (data: any) => {
    const r = await updateCommission.mutateAsync({
      id: commission.id,
      baseAmount: Number(data.baseAmount),
      rate: Number(data.rate),
      notes: data.notes || undefined,
    });
    if (r.success) onSuccess();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Modifier la commission"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
            icon={<Save className="h-4 w-4" />}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        {commission.reference} — {beneficiaryName(commission)}
        {' '}— {transactionLabel(commission)}
      </p>
      <form className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Assiette</label>
            <input
              type="number"
              step="0.01"
              {...register('baseAmount', { validate: (v) => Number(v) > 0 || 'Doit être positif' })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.baseAmount && <p className="mt-1 text-xs text-red-600">{errors.baseAmount.message as string}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Taux (%)</label>
            <input
              type="number"
              step="0.01"
              {...register('rate', {
                validate: (v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0 || n > 100) return 'Entre 0 et 100';
                  return true;
                },
              })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.rate && <p className="mt-1 text-xs text-red-600">{errors.rate.message as string}</p>}
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-slate-600">Nouveau montant</span>
          <span className="text-xl font-bold text-slate-900">{formatCurrency(previewAmount)}</span>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optionnel)</label>
          <textarea
            rows={2}
            {...register('notes')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {apiError && <p className="text-xs text-red-600">{typeof apiError === 'string' ? apiError : 'Erreur lors de la modification'}</p>}
      </form>
    </Modal>
  );
}

/** Modale d'annulation d'une commission (motif obligatoire). */
export function CancelCommissionModal({ commission, onClose, onSuccess }: ModalProps) {
  const cancelCommission = useCancelCommission();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { reason: '' },
  });
  const apiError = cancelCommission.data && !cancelCommission.data.success ? cancelCommission.data.error : null;

  const onSubmit = async (data: any) => {
    const r = await cancelCommission.mutateAsync({ id: commission.id, reason: data.reason });
    if (r.success) onSuccess();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Annuler la commission"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Retour</Button>
          <Button
            variant="danger"
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
            icon={<Ban className="h-4 w-4" />}
          >
            Annuler la commission
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        {commission.reference} — {beneficiaryName(commission)} — {formatCurrency(Number(commission.amount))}
      </p>
      <form className="space-y-2">
        <label className="block text-xs font-medium text-slate-700">Motif de l'annulation *</label>
        <textarea
          rows={3}
          {...register('reason', { required: 'Le motif est obligatoire' })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          placeholder="Ex : convention annulée, erreur de saisie…"
        />
        {errors.reason && <p className="text-xs text-red-600">{errors.reason.message as string}</p>}
        {apiError && <p className="text-xs text-red-600">{typeof apiError === 'string' ? apiError : 'Erreur lors de l\'annulation'}</p>}
      </form>
    </Modal>
  );
}
