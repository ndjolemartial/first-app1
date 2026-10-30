import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Modal from '../../../shared/components/ui/Modal';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAmlAlerts, useAmlAlert, useCreateAmlAlert, useUpdateAmlAlert, useDeleteAmlAlert } from '../hooks/useAml';
import { ALERT_SOURCE_LABEL } from '../utils/aml.utils';
import { formatBytes } from '../../archiving/utils/gedTree';
import AttachmentViewerModal from '../components/AttachmentViewerModal';
import { Plus, Edit, Trash2, Save, X, BellRing, Paperclip, FileText, ExternalLink, Eye } from 'lucide-react';

const ADMIN_ONLY = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

// `display:none` empêche, dans ce build Electron, le `change` de se déclencher
// après sélection — l'input doit rester rendu mais invisible.
const HIDDEN_FILE_INPUT_STYLE: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

interface EditState {
  id?: number;
  source: string;
  title: string;
  centifPublicationDate: string;
  fileDownloadedAt: string;
  integratedAt: string;
  operatorName: string;
  entriesAdded: string;
  entriesModified: string;
  entriesDeleted: string;
  notes: string;
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

export default function AmlAlertsPage() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  const { data, isLoading } = useAmlAlerts();
  const create = useCreateAmlAlert();
  const update = useUpdateAmlAlert();
  const del = useDeleteAmlAlert();
  const rows: any[] = data?.data ?? [];

  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? '';
  const canDelete = ADMIN_ONLY.includes(role);
  const operatorDefault = user ? `${user.lastName} ${user.firstName}` : '';

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<any>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingInputRef = useRef<HTMLInputElement>(null);
  const existingInputRef = useRef<HTMLInputElement>(null);

  const { data: editingAlertRes } = useAmlAlert(editing?.id);
  const editingDocs: any[] = (editingAlertRes?.success ? editingAlertRes.data?.documents : []) ?? [];
  const { data: viewingRes } = useAmlAlert(viewingId ?? undefined);
  const viewingDocs: any[] = (viewingRes?.success ? viewingRes.data?.documents : []) ?? [];

  const filesToPayload = (files: File[]) => files.map((f) => ({
    sourcePath: window.electron.documents.pathForFile(f),
    originalName: f.name, mimeType: f.type || 'application/octet-stream', size: f.size,
  }));

  const importFiles = async (alertId: number, files: File[]): Promise<boolean> => {
    if (!files.length) return true;
    const r: any = await window.electron.documents.import(token, { amlWatchlistAlertId: alertId, files: filesToPayload(files) });
    if (!r?.success) toast.error(`Pièce jointe : ${String(r?.error ?? 'échec du téléversement')}`);
    return !!r?.success;
  };

  const addPendingFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    const files = Array.from(list); // capturer immédiatement (le FileList est vidé au reset de input.value)
    setPendingFiles((prev) => [...prev, ...files]);
  };

  const uploadToExisting = async (list: FileList | null) => {
    if (!list || !list.length || !editing?.id) return;
    const ok = await importFiles(editing.id, Array.from(list));
    if (ok) {
      toast.success('Pièce jointe ajoutée');
      qc.invalidateQueries({ queryKey: ['aml-alert', editing.id] });
      qc.invalidateQueries({ queryKey: ['aml-alerts'] });
    }
  };

  const startNew = () => { setPendingFiles([]); setEditing({
    source: 'CENTIF_CI', title: '', centifPublicationDate: '', fileDownloadedAt: '',
    integratedAt: '', operatorName: operatorDefault, entriesAdded: '', entriesModified: '', entriesDeleted: '', notes: '',
  }); };
  const startEdit = (a: any) => { setPendingFiles([]); setEditing({
    id: a.id, source: a.source, title: a.title,
    centifPublicationDate: a.centifPublicationDate ? String(a.centifPublicationDate).slice(0, 10) : '',
    fileDownloadedAt: a.fileDownloadedAt ? String(a.fileDownloadedAt).slice(0, 10) : '',
    integratedAt: a.integratedAt ? String(a.integratedAt).slice(0, 10) : '',
    operatorName: a.operatorDisplayName ?? a.operatorName ?? '',
    entriesAdded: a.entriesAdded != null ? String(a.entriesAdded) : '',
    entriesModified: a.entriesModified != null ? String(a.entriesModified) : '',
    entriesDeleted: a.entriesDeleted != null ? String(a.entriesDeleted) : '',
    notes: a.notes ?? '',
  }); };

  const onSave = async () => {
    if (!editing || !editing.title.trim()) return;
    const payload = {
      source: editing.source,
      title: editing.title.trim(),
      centifPublicationDate: editing.centifPublicationDate || null,
      fileDownloadedAt: editing.fileDownloadedAt || null,
      integratedAt: editing.integratedAt || null,
      operatorName: editing.operatorName || null,
      entriesAdded: editing.entriesAdded === '' ? null : Number(editing.entriesAdded),
      entriesModified: editing.entriesModified === '' ? null : Number(editing.entriesModified),
      entriesDeleted: editing.entriesDeleted === '' ? null : Number(editing.entriesDeleted),
      notes: editing.notes || null,
    };
    if (editing.id) {
      const r: any = await update.mutateAsync({ id: editing.id, payload });
      if (r.success) setEditing(null);
      return;
    }
    const r: any = await create.mutateAsync(payload);
    if (!r.success) return;
    if (pendingFiles.length && r.data?.id) {
      await importFiles(r.data.id, pendingFiles);
      qc.invalidateQueries({ queryKey: ['aml-alerts'] });
    }
    setPendingFiles([]);
    setEditing(null);
  };

  return (
    <PageLayout
      title="Alertes"
      breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Alertes' }]}
      actions={!editing ? <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle alerte</Button> : undefined}
    >
      <p className="mb-4 text-sm text-slate-500">
        Alertes CENTIF-CI et mises à jour des listes de Sanctions Financières Ciblées (SFC). Chaque
        enregistrement matérialise une <strong>version de la base de criblage</strong> : la version
        courante (intégration la plus récente) est celle utilisée par les criblages suivants.
      </p>

      {editing && (
        <Card className="mb-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BellRing className="h-4 w-4" /> {editing.id ? "Modifier l'alerte" : 'Nouvelle alerte'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Source" options={Object.entries(ALERT_SOURCE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
              value={editing.source} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
            <Input label="Identité de l'opérateur" value={editing.operatorName}
              onChange={(e) => setEditing({ ...editing, operatorName: e.target.value })} />
            <Input label="Intitulé *" className="col-span-2" value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Ex. Communiqué CENTIF-CI n°04/2026 — actualisation liste nationale" />
            {/* min/max : borne l'année à 4 chiffres (sinon Chromium accepte « 12026 »). */}
            <Input label="Date de publication CENTIF-CI" type="date" min="1900-01-01" max="9999-12-31" value={editing.centifPublicationDate}
              onChange={(e) => setEditing({ ...editing, centifPublicationDate: e.target.value })} />
            <Input label="Date de téléchargement du fichier" type="date" min="1900-01-01" max="9999-12-31" value={editing.fileDownloadedAt}
              onChange={(e) => setEditing({ ...editing, fileDownloadedAt: e.target.value })} />
            <Input label="Date d'intégration dans l'outil interne" type="date" min="1900-01-01" max="9999-12-31" value={editing.integratedAt}
              onChange={(e) => setEditing({ ...editing, integratedAt: e.target.value })}
              helper="Détermine la version courante de la base de criblage." />
            <Input label="Nombre d'entrées ajoutées au référentiel" type="number" min="0" value={editing.entriesAdded}
              onChange={(e) => setEditing({ ...editing, entriesAdded: e.target.value })} />
            <Input label="Nombre d'entrées modifiées dans le référentiel" type="number" min="0" value={editing.entriesModified}
              onChange={(e) => setEditing({ ...editing, entriesModified: e.target.value })}
              helper="Modifications d'enregistrements déjà existants." />
            <Input label="Nombre d'entrées supprimées du référentiel" type="number" min="0" value={editing.entriesDeleted}
              onChange={(e) => setEditing({ ...editing, entriesDeleted: e.target.value })}
              helper="Enregistrements retirés de la liste (radiations)." />
          </div>
          <Textarea label="Notes" rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />

          {/* Pièces jointes — fichier téléchargé de la liste, communiqué CENTIF-CI, etc. */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pièces jointes (fichier téléchargé, communiqué…)</label>
            {editing.id ? (
              <>
                {editingDocs.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {editingDocs.map((doc: any) => (
                      <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{doc.name}</span>
                          <span className="shrink-0 text-slate-400">({formatBytes(doc.size)})</span>
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="sm" icon={<Eye className="h-3.5 w-3.5" />}
                            onClick={() => setPreviewing(doc)}>Voir</Button>
                          <Button variant="ghost" size="sm" icon={<ExternalLink className="h-3.5 w-3.5" />}
                            onClick={() => window.electron.documents.open(token, doc.id)}>Ouvrir</Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="secondary" size="sm" icon={<Paperclip className="h-3.5 w-3.5" />}
                  onClick={() => existingInputRef.current?.click()}>Ajouter un fichier</Button>
                <input ref={existingInputRef} type="file" multiple style={HIDDEN_FILE_INPUT_STYLE}
                  onChange={(e) => { uploadToExisting(e.target.files); e.target.value = ''; }} />
              </>
            ) : (
              <>
                {pendingFiles.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {pendingFiles.map((f, idx) => (
                      <li key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{f.name}</span>
                          <span className="shrink-0 text-slate-400">({formatBytes(f.size)})</span>
                        </span>
                        <button type="button" onClick={() => setPendingFiles((p) => p.filter((_, i) => i !== idx))}
                          className="shrink-0 text-slate-400 hover:text-red-600" aria-label="Retirer">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="secondary" size="sm" icon={<Paperclip className="h-3.5 w-3.5" />}
                  onClick={() => pendingInputRef.current?.click()}>Ajouter un fichier</Button>
                <input ref={pendingInputRef} type="file" multiple style={HIDDEN_FILE_INPUT_STYLE}
                  onChange={(e) => { addPendingFiles(e.target.files); e.target.value = ''; }} />
                <p className="mt-1 text-xs text-slate-400">Les fichiers seront rattachés à l'alerte à l'enregistrement.</p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={create.isPending || update.isPending} onClick={onSave}>Enregistrer</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="Aucune alerte" description="Aucune alerte CENTIF-CI / mise à jour SFC enregistrée."
            action={{ label: 'Nouvelle alerte', onClick: startNew }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Source</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Intitulé</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Publication</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Téléchargement</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Intégration</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Opérateur</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Pièces</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => {
                const docCount = a._count?.documents ?? 0;
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {a.reference}
                      {a.isCurrent && <Badge variant="success" className="ml-2">Version courante</Badge>}
                    </td>
                    <td className="px-4 py-3"><Badge variant="default">{ALERT_SOURCE_LABEL[a.source] ?? a.source}</Badge></td>
                    <td className="px-4 py-3 text-slate-700">{a.title}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.centifPublicationDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.fileDownloadedAt)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.integratedAt)}</td>
                    <td className="px-4 py-3 text-slate-500">{a.operatorDisplayName ?? a.operatorName ?? '—'}</td>
                    <td className="px-4 py-3">
                      {docCount > 0 ? (
                        <button type="button" onClick={() => setViewingId(a.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
                          <Paperclip className="h-3 w-3" /> {docCount}
                        </button>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(a)} />
                        {canDelete && <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(a)} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={viewingId != null} onClose={() => setViewingId(null)} title="Pièces jointes de l'alerte" size="sm">
        {viewingDocs.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Aucune pièce jointe.</p>
        ) : (
          <ul className="space-y-1.5">
            {viewingDocs.map((doc: any) => (
              <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">{doc.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">({formatBytes(doc.size)})</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" icon={<Eye className="h-3.5 w-3.5" />}
                    onClick={() => setPreviewing(doc)}>Voir</Button>
                  <Button variant="ghost" size="sm" icon={<ExternalLink className="h-3.5 w-3.5" />}
                    onClick={() => window.electron.documents.open(token, doc.id)}>Ouvrir</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <AttachmentViewerModal open={!!previewing} attachment={previewing} onClose={() => setPreviewing(null)} />

      <ConfirmDialog open={!!toDelete} title="Supprimer l'alerte"
        message={`Supprimer « ${toDelete?.title ?? ''} » ? Les criblages déjà exécutés qui référencent cette version ne sont pas modifiés.`}
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)} />
    </PageLayout>
  );
}
