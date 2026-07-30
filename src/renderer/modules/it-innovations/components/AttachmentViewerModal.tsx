import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import DocumentPreview from '../../archiving/components/DocumentPreview';
import { useAuthStore } from '../../../shared/stores/auth.store';
import type { ItInnovationAttachment } from '../types/it-innovation.types';
import { ExternalLink } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  attachment: ItInnovationAttachment | null;
}

/** Aperçu intégré (image/PDF/audio/vidéo) d'une pièce jointe d'innovation IT. */
export default function AttachmentViewerModal({ open, onClose, attachment }: Props) {
  const token = useAuthStore((s) => s.token)!;
  if (!attachment) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={attachment.name}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
          <Button icon={<ExternalLink className="h-4 w-4" />}
            onClick={() => window.electron.documents.open(token, attachment.id)}>
            Ouvrir
          </Button>
        </div>
      }
    >
      <DocumentPreview documentId={attachment.id} mimeType={attachment.type} name={attachment.name} />
    </Modal>
  );
}
