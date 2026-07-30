import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useCreateInnovation, useInnovationEmployees } from '../hooks/useItInnovations';
import PhaseAttachments from './PhaseAttachments';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: number) => void;
}

// Rôles pouvant choisir librement le porteur (les autres — AGENT_TECHNIQUE —
// sont auto-affectés à eux-mêmes, cf. FULL_VIEW_ROLES côté it-innovations.ipc.ts).
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RH'];

const emptyForm = { employeeId: '', title: '', phase1Description: '', notes: '' };

export default function InnovationFormModal({ open, onClose, onCreated }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token)!;
  const hasFullView = FULL_VIEW_ROLES.includes(currentUser?.role ?? '');
  const qc = useQueryClient();

  const { data: empRes } = useInnovationEmployees(open && hasFullView);
  const employees: Array<{ id: number; firstName: string; lastName: string; matricule: string }> = empRes?.success ? empRes.data ?? [] : [];

  const create = useCreateInnovation();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    if (open) { setForm(emptyForm); setError(''); setPendingFiles([]); }
  }, [open]);

  const uploadPendingFiles = async (innovationId: number): Promise<void> => {
    if (!pendingFiles.length) return;
    const payload = {
      itInnovationId: innovationId,
      itInnovationPhase: 1,
      files: pendingFiles.map((f) => ({
        sourcePath: window.electron.documents.pathForFile(f),
        originalName: f.name,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
      })),
    };
    const r: any = await window.electron.documents.import(token, payload);
    if (!r?.success) { toast.error(`Pièces jointes : ${String(r?.error ?? 'échec du téléversement')}`); return; }
    qc.invalidateQueries({ queryKey: ['it-innovation', innovationId] });
  };

  const handleSubmit = async () => {
    if (hasFullView && !form.employeeId) { setError('Le porteur de l’innovation est requis.'); return; }
    if (!form.title.trim()) { setError('Le titre est requis.'); return; }
    if (!form.phase1Description.trim()) { setError('La description (Phase 1) est requise.'); return; }
    const payload = {
      employeeId: hasFullView ? Number(form.employeeId) : undefined,
      title: form.title.trim(),
      phase1Description: form.phase1Description.trim(),
      notes: form.notes.trim() || undefined,
    };
    const r: any = await create.mutateAsync(payload);
    if (r.success) {
      await uploadPendingFiles(r.data.id);
      onClose();
      onCreated?.(r.data.id);
    } else {
      setError(typeof r.error === 'string' ? r.error : 'Erreur lors de l’enregistrement');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle innovation IT"
      size="xl"
      sidebarSafe
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={create.isPending} onClick={handleSubmit}>Créer</Button>
        </div>
      }
    >
      <div className="space-y-3">
        {hasFullView ? (
          <Select label="Porteur de l’innovation" required placeholder="Sélectionner…"
            options={employees.map((e) => ({ value: String(e.id), label: `${e.lastName} ${e.firstName} (${e.matricule})` }))}
            value={form.employeeId}
            onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} />
        ) : (
          <Input label="Porteur de l’innovation" value={currentUser ? `${currentUser.lastName} ${currentUser.firstName}` : ''} disabled />
        )}
        <Input label="Titre" required value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Ex : Automatisation de la génération des reçus" />
        <Textarea
          label="Phase 1 — Énoncé et description"
          required
          rows={4}
          value={form.phase1Description}
          onChange={(e) => setForm((f) => ({ ...f, phase1Description: e.target.value }))}
          placeholder="Décrivez le problème résolu, le fonctionnement envisagé…"
        />
        <Textarea label="Notes (optionnel)" rows={2} value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />

        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Pièces jointes (Phase 1)</h3>
          <p className="mb-2 text-xs text-slate-400">
            Documents, images, vidéos ou audios justifiant ou illustrant cette innovation.
          </p>
          <PhaseAttachments phase={1} pendingFiles={pendingFiles} onPendingFilesChange={setPendingFiles} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
