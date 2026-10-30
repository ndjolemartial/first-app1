import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { useTreasuryCategories, useTreasuryThirdParties, useUpdateTreasuryOperation } from '../hooks/useTreasury';
import { DIRECTION_LABEL, PAYMENT_METHOD_OPTIONS, categoryLabel } from '../utils/treasury.utils';
import { formatCurrency } from '../../../shared/utils/format';
import { AlertTriangle } from 'lucide-react';

interface Props {
  /** Opération à modifier (`null` = fenêtre fermée). */
  operation: any | null;
  onClose: () => void;
}

/**
 * Fenêtre « Modifier l'opération » : correction du montant, de la date, du
 * libellé, de l'objet, du tiers, du mode/de la référence de paiement et des
 * notes d'une opération de trésorerie saisie manuellement ou issue d'un
 * transfert. Pour un transfert, le serveur répercute montant, date, mode,
 * référence et notes sur l'écriture liée de l'autre compte.
 */
export default function EditOperationModal({ operation, onClose }: Props) {
  const update = useUpdateTreasuryOperation();
  const { data: categoriesRes } = useTreasuryCategories({ isActive: 'true' });
  const { data: thirdPartiesRes } = useTreasuryThirdParties();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [thirdPartyId, setThirdPartyId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!operation) return;
    setAmount(String(Number(operation.amount)));
    setDate(String(operation.operationDate).slice(0, 10));
    setLabel(operation.label ?? '');
    setCategoryId(operation.categoryId ? String(operation.categoryId) : '');
    setThirdPartyId(operation.thirdPartyId ? String(operation.thirdPartyId) : '');
    setPaymentMethod(operation.paymentMethod ?? 'ESPECE');
    setPaymentRef(operation.paymentRef ?? '');
    setNotes(operation.notes ?? '');
    setError('');
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation]);

  if (!operation) return null;

  const isTransfer = operation.source === 'TRANSFERT';
  // Objets du même sens que l'opération ; on garde l'objet actuel même s'il est inactif.
  const categories: any[] = (categoriesRes?.data ?? []).filter((c: any) => c.direction === operation.direction);
  if (operation.category && !categories.some((c) => c.id === operation.categoryId)) {
    categories.push(operation.category);
  }
  const thirdParties: any[] = thirdPartiesRes?.data ?? [];

  const handleSave = async () => {
    setError('');
    const amountNum = Number(amount.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amountNum) || amountNum <= 0) { setError('Montant invalide'); return; }
    if (!date) { setError('Date requise'); return; }
    if (!label.trim()) { setError('Libellé requis'); return; }

    const payload: any = {
      amount: amountNum,
      label: label.trim(),
      paymentMethod,
      paymentRef,
      notes,
      thirdPartyId: thirdPartyId ? Number(thirdPartyId) : null,
    };
    if (categoryId) payload.categoryId = Number(categoryId);
    // On ne réécrit la date (et donc l'heure stockée) que si le jour a changé.
    if (date !== String(operation.operationDate).slice(0, 10)) {
      payload.operationDate = new Date(`${date}T12:00:00`).toISOString();
    }
    const r = await update.mutateAsync({ id: operation.id, payload });
    if (r.success) onClose();
    else setError(typeof r.error === 'string' ? r.error : 'Erreur lors de l\'enregistrement');
  };

  return (
    <Modal
      open={!!operation}
      onClose={onClose}
      title={`Modifier l'opération ${operation.reference}`}
      size="lg"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} loading={update.isPending}>Enregistrer</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {DIRECTION_LABEL[operation.direction] ?? operation.direction} — montant actuel{' '}
          <span className="font-medium text-slate-700">{formatCurrency(Number(operation.amount))}</span>
        </p>
        {isTransfer && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Opération issue d'un <strong>transfert</strong> : le montant, la date, le mode, la référence
              de paiement et les notes seront aussi appliqués à l'opération liée sur l'autre compte.
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Montant (FCFA)" required value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          <Input label="Date de l'opération" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Input label="Libellé" required value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Objet d'opération"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            placeholder="— Aucun —"
            options={categories.map((c) => ({ value: String(c.id), label: categoryLabel(c) }))}
          />
          <Select
            label={operation.direction === 'ENTREE' ? 'En provenance de' : 'À destination de'}
            value={thirdPartyId}
            onChange={(e) => setThirdPartyId(e.target.value)}
            placeholder="— Aucun —"
            options={thirdParties.map((t) => ({ value: String(t.id), label: t.fullName }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Mode de paiement"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={PAYMENT_METHOD_OPTIONS}
          />
          <Input label="Référence de paiement" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
        </div>
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
