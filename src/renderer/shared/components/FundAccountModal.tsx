import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import { toast } from './ui/Toast';
import { useAuthStore } from '../stores/auth.store';
import { formatCurrency } from '../utils/format';

const PAYMENT_OPTIONS = [
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
];

/** Mode de paiement par défaut selon le type de compte à approvisionner :
 *  Caisse → Espèces, Mobile money → Mobile money, sinon Virement (banque). */
function defaultFundMethod(accountType?: string): string {
  if (accountType === 'CAISSE') return 'ESPECE';
  if (accountType === 'MOBILE_MONEY') return 'MOBILE_MONEY';
  return 'VIREMENT';
}

function toDateInput(d?: string | Date | null): string {
  const dt = d ? new Date(d) : new Date();
  if (isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export interface FundAccountModalProps {
  /** Compte à approvisionner (id, libellé, type et solde courant). */
  account: { id: number; name: string; type?: string; balance?: number | null };
  onClose: () => void;
  /** Appelé après un approvisionnement réussi, avec le nouveau solde. */
  onFunded?: (balance: number) => void;
}

/**
 * Modale d'approvisionnement d'un compte de trésorerie (opération d'entrée).
 * S'appuie sur `expenses:fundAccount` : une opération ENTREE est enregistrée et,
 * pour une CAISSE, l'objet d'opération « APPRO CAISSE » (585) est attaché.
 * Réutilisée par le règlement des charges et le formulaire d'opération.
 */
export default function FundAccountModal({ account, onClose, onFunded }: FundAccountModalProps) {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const fund = useMutation({
    mutationFn: (payload: object) => window.electron.expenses.fundAccount(token, payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['expenses', 'accounts'] });
        qc.invalidateQueries({ queryKey: ['treasury'] });
        toast.success('Compte approvisionné');
        onFunded?.(res.data?.balance ?? 0);
      } else {
        toast.error(String(res.error));
      }
    },
  });

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => toDateInput());
  const [method, setMethod] = useState(() => defaultFundMethod(account.type));
  const [ref, setRef] = useState('');

  return (
    <Modal open onClose={onClose} title={`Approvisionner ${account.name}`} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={fund.isPending} disabled={!date || !(Number(amount) > 0)}
            onClick={async () => {
              const r = await fund.mutateAsync({
                bankAccountId: account.id,
                amount: Number(amount),
                operationDate: date,
                paymentMethod: method,
                paymentRef: ref.trim() || null,
              });
              if (r.success) onClose();
            }}>Approvisionner</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Solde actuel : <span className="font-semibold text-slate-700">{formatCurrency(Number(account.balance ?? 0))}</span>
        </p>
        <Input label="Montant de l'approvisionnement (FCFA)" type="number" step="1000" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Mode" options={PAYMENT_OPTIONS} value={method} onChange={(e) => setMethod(e.target.value)} />
        <Input label="Référence (facultatif)" value={ref} onChange={(e) => setRef(e.target.value)} />
        <p className="text-xs text-slate-500">Une opération d'entrée sera enregistrée en trésorerie sur ce compte.</p>
      </div>
    </Modal>
  );
}
