import { useQuery } from '@tanstack/react-query';
import Modal from '../../../shared/components/ui/Modal';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatCurrency, formatDate } from '../../../shared/utils/format';

interface Props {
  operation: any | null;
  onClose: () => void;
  /** Autorise l'ajout/gestion des pièces jointes (false = lecture seule). */
  canManage?: boolean;
}

/**
 * Modal de gestion des pièces jointes d'une opération de trésorerie déjà
 * enregistrée. Réutilise EntityDocumentsCard (import GED pré-rattaché +
 * consultation) en pré-remplissant le lien `treasuryOperationId`.
 */
export default function OperationDocumentsModal({ operation, onClose, canManage = true }: Props) {
  const token = useAuthStore((s) => s.token)!;
  const opId = operation?.id as number | undefined;

  const queryKey = ['treasury-op-docs', opId] as const;
  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!opId,
    queryFn: () => window.electron.documents.list(token, { treasuryOperationId: opId }, 1, 200),
  });
  const documents = data?.success ? data.data ?? [] : [];

  return (
    <Modal
      open={!!operation}
      onClose={onClose}
      size="lg"
      title={operation ? `Pièces jointes — ${operation.reference}` : 'Pièces jointes'}
    >
      {operation && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="font-medium text-slate-800">{operation.label}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
              <span>{formatDate(operation.operationDate)}</span>
              <span
                className={operation.direction === 'ENTREE' ? 'text-green-600' : 'text-red-500'}
              >
                {operation.direction === 'ENTREE' ? '+' : '−'} {formatCurrency(Number(operation.amount))}
              </span>
            </div>
          </div>

          {isLoading ? (
            <SkeletonTable />
          ) : (
            <EntityDocumentsCard
              documents={documents}
              defaultLinks={{ treasuryOperationId: opId }}
              invalidateKey={queryKey}
              title="Pièces jointes de l'opération"
              canManage={canManage}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
