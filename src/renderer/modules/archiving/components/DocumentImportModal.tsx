import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { useImportDocuments, useGedCategories, useGedFolders, useGedTags } from '../hooks/useGed';
import { hierOptions, formatBytes } from '../utils/gedTree';

interface DocumentImportModalProps {
  open: boolean;
  onClose: () => void;
  defaultFolderId?: number | null;
}

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*,video/*,audio/*';

/** Modale d'import de documents : glisser-déposer multi-formats + classement. */
export default function DocumentImportModal({ open, onClose, defaultFolderId }: DocumentImportModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const importDocs = useImportDocuments();
  const { data: catRes } = useGedCategories();
  const { data: folderRes } = useGedFolders();
  const { data: tagRes } = useGedTags();

  useEffect(() => {
    if (open) {
      setFiles([]);
      setCategoryId('');
      setTagIds([]);
      setDescription('');
      setFolderId(defaultFolderId ? String(defaultFolderId) : '');
    }
  }, [open, defaultFolderId]);

  const addFiles = (list: FileList | File[]) => {
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    const payload = {
      files: files.map((f) => ({
        sourcePath: window.electron.documents.pathForFile(f),
        originalName: f.name,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
      })),
      description: description.trim() || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      folderId: folderId ? Number(folderId) : undefined,
      tagIds: tagIds.length ? tagIds : undefined,
    };
    const r: any = await importDocs.mutateAsync(payload);
    if (r.success) onClose();
  };

  const categoryOptions = hierOptions(catRes?.data ?? [], '— Aucune catégorie —');
  const folderOptions = hierOptions(folderRes?.data ?? [], '— Aucun dossier —');
  const tags: any[] = tagRes?.data ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Archiver des documents"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleImport}
            loading={importDocs.isPending}
            disabled={files.length === 0}
            icon={<UploadCloud className="h-4 w-4" />}
          >
            Archiver {files.length > 0 ? `(${files.length})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Zone de glisser-déposer */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors',
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50',
          )}
        >
          <UploadCloud className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-600">Glissez vos fichiers ici ou cliquez pour parcourir</p>
          <p className="text-xs text-slate-400">PDF, Word, Excel, images, vidéos, audios</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {/* Fichiers sélectionnés */}
        {files.length > 0 && (
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 truncate text-slate-700">{f.name}</span>
                <span className="text-xs text-slate-400">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Classement */}
        <div className="grid grid-cols-2 gap-4">
          <Select label="Catégorie" options={categoryOptions} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          <Select label="Dossier" options={folderOptions} value={folderId} onChange={(e) => setFolderId(e.target.value)} />
        </div>

        {/* Étiquettes */}
        {tags.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Étiquettes</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const active = tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTagIds((prev) => (active ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                    className={clsx(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                      active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Textarea
          label="Description (commune aux fichiers archivés)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
