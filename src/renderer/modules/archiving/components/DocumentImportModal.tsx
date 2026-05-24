import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { UploadCloud, File as FileIcon, X, Link2 } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { useImportDocuments, useGedCategories, useGedFolders, useGedTags } from '../hooks/useGed';
import { hierOptions, formatBytes } from '../utils/gedTree';
import DocumentLinksFields, { DocumentLinks, EMPTY_LINKS } from './DocumentLinksFields';

interface DocumentImportModalProps {
  open: boolean;
  onClose: () => void;
  defaultFolderId?: number | null;
  /** Rattachements pré-remplis (ex : ouverture depuis la fiche projet). */
  defaultLinks?: { [K in keyof DocumentLinks]?: number | string };
  /** Callback déclenché après un import réussi (pour rafraîchir la vue appelante). */
  onImported?: () => void;
}

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*,video/*,audio/*';

/** Modale d'import de documents : glisser-déposer multi-formats + classement. */
export default function DocumentImportModal({ open, onClose, defaultFolderId, defaultLinks, onImported }: DocumentImportModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [archiveName, setArchiveName] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState<DocumentLinks>(EMPTY_LINKS);
  const [showLinks, setShowLinks] = useState(false);
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
      setArchiveName('');
      setDescription('');
      setFolderId(defaultFolderId ? String(defaultFolderId) : '');
      const initLinks: DocumentLinks = { ...EMPTY_LINKS };
      if (defaultLinks) {
        for (const [k, v] of Object.entries(defaultLinks)) {
          if (v != null) (initLinks as any)[k] = String(v);
        }
      }
      setLinks(initLinks);
      // Panneau Rattachements ouvert par défaut pour mettre en avant la fonctionnalité.
      setShowLinks(true);
    }
  }, [open, defaultFolderId, defaultLinks]);

  const addFiles = (list: FileList | File[]) => {
    const snapshot = Array.from(list);
    setFiles((prev) => [...prev, ...snapshot]);
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    const linkPayload: Record<string, number> = {};
    for (const [k, v] of Object.entries(links)) {
      if (v) linkPayload[k] = Number(v);
    }
    const trimmedName = archiveName.trim();
    const payload = {
      files: files.map((f, i) => ({
        sourcePath: window.electron.documents.pathForFile(f),
        originalName: f.name,
        // Nom d'affichage : si l'utilisateur a saisi un nom d'archive,
        // on l'utilise (avec suffixe " (N)" si plusieurs fichiers).
        displayName: trimmedName
          ? files.length > 1 ? `${trimmedName} (${i + 1})` : trimmedName
          : undefined,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
      })),
      description: description.trim() || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      folderId: folderId ? Number(folderId) : undefined,
      tagIds: tagIds.length ? tagIds : undefined,
      ...linkPayload,
    };
    const r: any = await importDocs.mutateAsync(payload);
    if (r.success) {
      onImported?.();
      onClose();
    }
  };

  const activeLinkCount = Object.values(links).filter(Boolean).length;

  const categoryOptions = hierOptions(catRes?.data ?? [], '— Aucune catégorie —');
  const folderOptions = hierOptions(folderRes?.data ?? [], '— Aucun dossier —');
  const tags: any[] = tagRes?.data ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Archiver des documents"
      size="content"
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
        {/* Nom et description de l'archive */}
        <Input
          label="Nom de l'archive"
          placeholder="Ex : Pièce d'identité Jean Dupont (laisser vide pour conserver le nom du fichier)"
          value={archiveName}
          onChange={(e) => setArchiveName(e.target.value)}
        />
        <Textarea
          label="Description (commune aux fichiers archivés)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

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
            className="sr-only"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
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

        {/* Rattachements aux entités métier (repliable, ouvert par défaut) */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60">
          <button
            type="button"
            onClick={() => setShowLinks((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-100/60 rounded-t-lg"
          >
            <span className="flex items-center gap-2.5">
              <Link2 className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-slate-800">Rattacher à des entités</span>
              {activeLinkCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {activeLinkCount}
                </span>
              )}
              <span className="text-xs font-normal text-slate-500">
                — client, propriétaire, prospect, apporteur, utilisateur, bien, terrain…
              </span>
            </span>
            <span className="text-xs text-slate-400">{showLinks ? 'Masquer' : 'Afficher'}</span>
          </button>
          {showLinks && (
            <div className="border-t border-slate-200 bg-white p-4 rounded-b-lg">
              <DocumentLinksFields
                values={links}
                onChange={(field, value) => setLinks((prev) => ({ ...prev, [field]: value }))}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
