import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useCrmAssignees } from '../../crm/hooks/useCrm';
import { usePlatforms, useCreatePublication, useUpdatePublication } from '../hooks/useSocialMedia';
import { PUBLICATION_TYPE_LABEL, type SocialPublication, type SocialPublicationType } from '../types/social-media.types';
import { Paperclip, FileText, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: SocialPublication | null;
  defaultPlatformId?: number;
}

const TYPE_OPTIONS = Object.entries(PUBLICATION_TYPE_LABEL).map(([value, label]) => ({ value, label }));

// SUPER_ADMIN/ADMIN/MANAGER voient et gèrent toutes les publications ; les
// autres rôles sont cantonnés à celles dont ils sont l'auteur (même périmètre
// que côté IPC, cf. PUBLICATION_FULL_VIEW_ROLES dans social-media.ipc.ts).
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const today = () => new Date().toISOString().slice(0, 10);

const ATTACH_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*,video/*,audio/*';

/** Formate une taille en octets de façon lisible. */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const emptyForm = {
  platformId: '',
  type: 'PUBLICATION' as SocialPublicationType,
  title: '',
  publishedAt: today(),
  url: '',
  viewsCount: '0',
  interactionsCount: '0',
  authorId: '',
  notes: '',
};

export default function PublicationModal({ open, onClose, editing, defaultPlatformId }: Props) {
  const token = useAuthStore((s) => s.token)!;
  const currentUser = useAuthStore((s) => s.user);
  const hasFullView = FULL_VIEW_ROLES.includes(currentUser?.role ?? '');
  const qc = useQueryClient();
  const { data: platRes } = usePlatforms(false);
  const platforms = platRes?.success ? platRes.data ?? [] : [];
  // La liste des auteurs sélectionnables (crm:listAssignees) est réservée à la
  // vue complète CRM : on ne l'interroge que pour les rôles pleinement
  // habilités, sous peine d'erreur de permission pour les autres.
  const { data: usersRes } = useCrmAssignees(open && hasFullView);
  const users: Array<{ id: number; firstName: string; lastName: string }> = usersRes?.success ? usersRes.data ?? [] : [];

  const create = useCreatePublication();
  const update = useUpdatePublication();

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  // Pièces jointes : fichiers à téléverser + pièces déjà jointes (édition).
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const existingAttachments = editing?.attachments ?? [];

  const addFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  /** Téléverse les fichiers sélectionnés et les rattache à la publication créée/éditée. */
  const uploadAttachments = async (publicationId: number): Promise<void> => {
    if (!files.length) return;
    const payload = {
      socialPublicationId: publicationId,
      files: files.map((f) => ({
        sourcePath: window.electron.documents.pathForFile(f),
        originalName: f.name,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
      })),
    };
    const r: any = await window.electron.documents.import(token, payload);
    if (!r?.success) {
      toast.error(`Pièces jointes : ${String(r?.error ?? 'échec du téléversement')}`);
      return;
    }
    qc.invalidateQueries({ queryKey: ['social-publications'] });
    toast.success(`${r.data?.length ?? files.length} pièce(s) jointe(s) ajoutée(s)`);
  };

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        platformId: String(editing.platformId),
        type: editing.type,
        title: editing.title,
        publishedAt: editing.publishedAt.slice(0, 10),
        url: editing.url ?? '',
        viewsCount: String(editing.viewsCount),
        interactionsCount: String(editing.interactionsCount),
        authorId: editing.authorId ? String(editing.authorId) : '',
        notes: editing.notes ?? '',
      });
    } else {
      setForm({
        ...emptyForm,
        platformId: defaultPlatformId ? String(defaultPlatformId) : '',
        authorId: !hasFullView && currentUser ? String(currentUser.id) : '',
      });
    }
    setFiles([]);
    setError('');
  }, [open, editing, defaultPlatformId, hasFullView, currentUser]);

  const handleSubmit = async () => {
    if (!form.platformId) { setError('La plateforme est requise.'); return; }
    if (!form.title.trim()) { setError('Le titre est requis.'); return; }
    const payload = {
      platformId: Number(form.platformId),
      type: form.type,
      title: form.title.trim(),
      publishedAt: form.publishedAt,
      url: form.url.trim() || undefined,
      viewsCount: Number(form.viewsCount) || 0,
      interactionsCount: Number(form.interactionsCount) || 0,
      authorId: form.authorId ? Number(form.authorId) : null,
      notes: form.notes.trim() || undefined,
    };
    const r: any = editing
      ? await update.mutateAsync({ id: editing.id, payload })
      : await create.mutateAsync(payload);
    if (r.success) {
      const publicationId = editing ? editing.id : r.data.id;
      await uploadAttachments(publicationId);
      onClose();
    } else {
      setError(typeof r.error === 'string' ? r.error : 'Erreur lors de l’enregistrement');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Modifier la publication' : 'Nouvelle publication / article'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={create.isPending || update.isPending} onClick={handleSubmit}>
            {editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Plateforme" required placeholder="Sélectionner…"
            options={platforms.map((p: any) => ({ value: String(p.id), label: p.name }))}
            value={form.platformId}
            onChange={(e) => setForm((f) => ({ ...f, platformId: e.target.value }))} />
          <Select label="Type" options={TYPE_OPTIONS} value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SocialPublicationType }))} />
        </div>
        <Input label="Titre" required value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Ex : Lancement du lotissement XYZ" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date de publication" type="date" required value={form.publishedAt}
            onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))} />
          {hasFullView ? (
            <Select label="Auteur" placeholder="Non renseigné"
              options={users.map((u) => ({ value: String(u.id), label: `${u.lastName} ${u.firstName}` }))}
              value={form.authorId}
              onChange={(e) => setForm((f) => ({ ...f, authorId: e.target.value }))} />
          ) : (
            <Input label="Auteur" value={currentUser ? `${currentUser.lastName} ${currentUser.firstName}` : ''} disabled />
          )}
        </div>
        <Input label="URL" value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="https://…" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Vues" type="number" min={0} value={form.viewsCount}
            onChange={(e) => setForm((f) => ({ ...f, viewsCount: e.target.value }))} />
          <Input label="Interactions" type="number" min={0} value={form.interactionsCount}
            onChange={(e) => setForm((f) => ({ ...f, interactionsCount: e.target.value }))} />
        </div>
        <Textarea label="Notes" rows={2} value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />

        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Pièces jointes</h3>
          <p className="text-xs text-slate-400 mb-2">
            Visuels, brouillons ou justificatifs liés à cette publication (PDF, Word, Excel, images, audio, vidéo).
          </p>

          {existingAttachments.length > 0 && (
            <ul className="mb-2 space-y-1">
              {existingAttachments.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-slate-700">{doc.name}</span>
                    {doc.numeroArchive && <span className="shrink-0 text-xs font-mono text-slate-400">{doc.numeroArchive}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => window.electron.documents.open(token, doc.id)}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                  >
                    Ouvrir
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center transition-colors ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <Paperclip className="h-5 w-5 text-slate-400" />
            <p className="text-sm text-slate-600">Glissez-déposez des fichiers ou cliquez pour parcourir</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ATTACH_ACCEPT}
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-1.5 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-slate-700">{f.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatFileSize(f.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                    aria-label="Retirer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
