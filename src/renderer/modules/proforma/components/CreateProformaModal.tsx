import { useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';

/** Date du jour + 30 jours (format `yyyy-mm-dd`), valeur par défaut de « Valable jusqu'au ». */
function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

interface CreateProformaModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { validUntil: string; notes: string; taxRate?: number }) => void | Promise<void>;
  loading?: boolean;
  /** Affiche le champ TVA (%) — pertinent uniquement pour une émission depuis une convention, qui ne porte pas de taux de TVA propre. */
  showTaxRate?: boolean;
}

/**
 * Modale partagée (Devis et Convention) de confirmation d'émission d'une
 * facture Proforma — document optionnel, non comptable, produit à la demande
 * d'un client/prospect avant un achat.
 */
export default function CreateProformaModal({ open, onClose, onConfirm, loading, showTaxRate }: CreateProformaModalProps) {
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState('0');

  return (
    <Modal
      open={open} onClose={onClose} title="Émettre une facture Proforma"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={loading} onClick={() => onConfirm({ validUntil, notes, taxRate: showTaxRate ? Number(taxRate) || 0 : undefined })}>
            Générer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Document optionnel et sans valeur comptable, produit à la demande d'un client ou d'un prospect
          (ex. justificatif de décaissement auprès d'une banque) avant l'achat d'un terrain ou d'un bien immobilier.
        </p>
        <Input label="Valable jusqu'au (optionnel)" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        {showTaxRate && (
          <Input label="TVA (%)" type="number" step="0.01" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        )}
        <Textarea label="Notes (optionnel)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
