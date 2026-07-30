import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Textarea from '../../../shared/components/ui/Textarea';
import { useInnovation, useValidatePhase } from '../hooks/useItInnovations';
import PhaseAttachments from './PhaseAttachments';
import type { ItInnovation } from '../types/it-innovation.types';

interface Props {
  open: boolean;
  onClose: () => void;
  innovationId: number;
  phase: 1 | 2 | 3;
}

const PHASE_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Phase 1 — Énoncé et description',
  2: 'Phase 2 — Démonstration et validation de test',
  3: 'Phase 3 — Validation finale et intégration',
};

export default function ValidatePhaseModal({ open, onClose, innovationId, phase }: Props) {
  const { data } = useInnovation(innovationId);
  const innovation: ItInnovation | undefined = data?.success ? data.data : undefined;
  const description = phase === 1 ? innovation?.phase1Description
    : phase === 2 ? innovation?.phase2Description
    : innovation?.phase3Description;

  const validate = useValidatePhase();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (open) { setReason(''); setError(''); setRejecting(false); }
  }, [open]);

  const submit = async (decision: 'VALIDATE' | 'REJECT') => {
    if (decision === 'REJECT' && !reason.trim()) { setError('Le motif de rejet est requis.'); return; }
    const r: any = await validate.mutateAsync({
      id: innovationId,
      payload: { phase, decision, reason: decision === 'REJECT' ? reason.trim() : undefined },
    });
    if (r.success) onClose();
    else setError(typeof r.error === 'string' ? r.error : 'Erreur lors de l’enregistrement');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Valider — ${PHASE_LABEL[phase]}`}
      size="lg"
      footer={
        rejecting ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)}>Retour</Button>
            <Button variant="danger" loading={validate.isPending} onClick={() => submit('REJECT')}>Confirmer le rejet</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button variant="danger" onClick={() => setRejecting(true)}>Rejeter</Button>
            <Button loading={validate.isPending} onClick={() => submit('VALIDATE')}>Valider</Button>
          </div>
        )
      }
    >
      <div className="space-y-3">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Contenu soumis</h3>
          <p className="whitespace-pre-wrap rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
            {description || <span className="italic text-slate-400">Non renseigné</span>}
          </p>
        </div>

        {innovation && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Pièces jointes</h3>
            <PhaseAttachments phase={phase} attachments={innovation.attachments} readOnly />
          </div>
        )}

        {rejecting ? (
          <Textarea
            label="Motif du rejet"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Expliquez pourquoi cette phase n’est pas validée…"
          />
        ) : (
          <p className="text-sm text-slate-600">
            Confirmez la validation de cette phase, ou choisissez « Rejeter » pour la renvoyer en révision au porteur.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
