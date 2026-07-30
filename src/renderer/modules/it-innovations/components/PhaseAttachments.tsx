import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../../../shared/components/ui/Toast';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useAuthStore } from '../../../shared/stores/auth.store';
import AttachmentViewerModal from './AttachmentViewerModal';
import { useRemoveAttachment } from '../hooks/useItInnovations';
import type { ItInnovationAttachment } from '../types/it-innovation.types';
import { Paperclip, FileText, Eye, Trash2, X } from 'lucide-react';

const ATTACH_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*,video/*,audio/*';

/** Formate une taille en octets de façon lisible. */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface Props {
  /** Innovation déjà créée (upload immédiat) — absent lors de la création (upload différé). */
  innovationId?: number;
  phase: 1 | 2 | 3;
  attachments?: ItInnovationAttachment[];
  /** Fichiers en attente d'envoi (mode création, avant que l'innovation existe). */
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export default function PhaseAttachments({
  innovationId, phase, attachments = [], pendingFiles, onPendingFilesChange, readOnly, compact,
}: Props) {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const removeAttachment = useRemoveAttachment();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<ItInnovationAttachment | null>(null);
  const [toDelete, setToDelete] = useState<ItInnovationAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const phaseAttachments = attachments.filter((a) => a.itInnovationPhase === phase);

  const addFiles = async (list: FileList | null) => {
    if (!list || !list.length) return;
    const files = Array.from(list);
    if (innovationId) {
      setUploading(true);
      const payload = {
        itInnovationId: innovationId,
        itInnovationPhase: phase,
        files: files.map((f) => ({
          sourcePath: window.electron.documents.pathForFile(f),
          originalName: f.name,
          mimeType: f.type || 'application/octet-stream',
          size: f.size,
        })),
      };
      const r: any = await window.electron.documents.import(token, payload);
      setUploading(false);
      if (!r?.success) { toast.error(`Pièces jointes : ${String(r?.error ?? 'échec du téléversement')}`); return; }
      qc.invalidateQueries({ queryKey: ['it-innovation', innovationId] });
      toast.success(`${r.data?.length ?? files.length} pièce(s) jointe(s) ajoutée(s)`);
    } else {
      onPendingFilesChange?.([...(pendingFiles ?? []), ...files]);
    }
  };

  const canAdd = !readOnly && (innovationId != null || !!onPendingFilesChange);
  const canDelete = !readOnly && innovationId != null;
  const hasAny = phaseAttachments.length > 0 || (pendingFiles && pendingFiles.length > 0);

  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      {readOnly && !hasAny && (
        <p className="text-xs italic text-slate-400">Aucune pièce jointe pour cette phase.</p>
      )}
      {hasAny && (
        <ul className="mb-2 space-y-1">
          {phaseAttachments.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate text-slate-700">{doc.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatFileSize(doc.size)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => setViewing(doc)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                  <Eye className="h-3.5 w-3.5" /> Voir
                </button>
                {canDelete && (
                  <button type="button" onClick={() => setToDelete(doc)} aria-label="Supprimer"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
          {pendingFiles?.map((f, i) => (
            <li key={`pending-${f.name}-${i}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate text-slate-700">{f.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatFileSize(f.size)}</span>
              </span>
              <button type="button"
                onClick={() => onPendingFilesChange?.(pendingFiles.filter((_, idx) => idx !== i))}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500" aria-label="Retirer">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 text-center text-xs transition-colors ${
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <Paperclip className="h-4 w-4 text-slate-400" />
          <span className="text-slate-600">{uploading ? 'Envoi…' : 'Ajouter des pièces jointes (documents, images, vidéos, audios…)'}</span>
          <input ref={fileInputRef} type="file" multiple accept={ATTACH_ACCEPT} className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>
      )}

      <AttachmentViewerModal open={!!viewing} onClose={() => setViewing(null)} attachment={viewing} />

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer la pièce jointe"
        message={`Supprimer « ${toDelete?.name} » ?`}
        onConfirm={async () => {
          if (toDelete && innovationId) await removeAttachment.mutateAsync({ id: innovationId, documentId: toDelete.id });
          setToDelete(null);
        }}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
