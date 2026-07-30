import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import { Eye, FileText, FileSpreadsheet } from 'lucide-react';
import {
  usePrintWireTransferOrder, useExportWireTransferOrderPdf, useExportWireTransferOrderExcel,
} from '../hooks/useWireTransfer';
import { MONTH_LABEL } from '../types/hr.types';

interface Props {
  periodYear: number;
  periodMonth: number;
  onClose: () => void;
}

/**
 * Fiche « Ordre de virement » à transmettre à la banque : liste des salaires
 * nets à payer (bulletins validés/payés) du mois sélectionné, avec les
 * références bancaires de chaque employé. Réservé à SUPER_ADMIN/ADMIN.
 */
export default function WireTransferOrderModal({ periodYear, periodMonth, onClose }: Props) {
  const print = usePrintWireTransferOrder();
  const exportPdf = useExportWireTransferOrderPdf();
  const exportExcel = useExportWireTransferOrderExcel();

  const period = { periodYear, periodMonth };
  const label = `${MONTH_LABEL[periodMonth] ?? periodMonth} ${periodYear}`;

  return (
    <Modal
      open
      onClose={onClose}
      title="Ordre de virement"
      size="md"
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <p className="mb-1 text-sm text-slate-600">
        Fiche à transmettre à la banque pour les virements de salaire de <strong>{label}</strong>,
        établie à partir des bulletins validés ou payés de la période.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Le modèle (bloc d'introduction, titre du tableau, largeurs de colonnes, signataire) est
        configurable dans Paramètres → Modèles d'imprimés → « Modèle d'ordre de virement ».
      </p>
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary" icon={<Eye className="h-4 w-4" />}
          loading={print.isPending}
          onClick={() => print.mutate(period)}
        >
          Aperçu / Imprimer
        </Button>
        <Button
          variant="secondary" icon={<FileText className="h-4 w-4 text-red-500" />}
          loading={exportPdf.isPending}
          onClick={() => exportPdf.mutate(period)}
        >
          Exporter en PDF
        </Button>
        <Button
          variant="secondary" icon={<FileSpreadsheet className="h-4 w-4 text-green-600" />}
          loading={exportExcel.isPending}
          onClick={() => exportExcel.mutate(period)}
        >
          Exporter en Excel
        </Button>
      </div>
    </Modal>
  );
}
