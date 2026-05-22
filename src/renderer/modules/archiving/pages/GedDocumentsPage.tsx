import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Pagination from '../../../shared/components/ui/Pagination';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { formatDate } from '../../../shared/utils/format';
import ArchivingNav from '../components/ArchivingNav';
import FolderTree from '../components/FolderTree';
import DocumentImportModal from '../components/DocumentImportModal';
import { useGedDocuments, useGedFolders, useGedCategories, useDeleteGedDocument, openDocumentExternally } from '../hooks/useGed';
import { hierOptions, formatBytes, mimeGroup } from '../utils/gedTree';
import { UploadCloud, Eye, ExternalLink, Trash2, FileText } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'PDF', label: 'PDF' },
  { value: 'IMAGE', label: 'Images' },
  { value: 'VIDEO', label: 'Vidéos' },
  { value: 'AUDIO', label: 'Audios' },
  { value: 'OFFICE', label: 'Bureautique' },
];

const GROUP_VARIANT: Record<string, any> = {
  PDF: 'danger', IMAGE: 'success', VIDEO: 'purple', AUDIO: 'info', OFFICE: 'warning', AUTRE: 'default',
};

export default function GedDocumentsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [typeGroup, setTypeGroup] = useState('');
  const [folderId, setFolderId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const filters = {
    search: search || undefined,
    categoryId: categoryId || undefined,
    typeGroup: typeGroup || undefined,
    folderId: folderId ?? undefined,
  };
  const { data, isLoading } = useGedDocuments(filters, page, 24);
  const { data: folderRes } = useGedFolders();
  const { data: catRes } = useGedCategories();
  const deleteDoc = useDeleteGedDocument();

  const documents: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const categoryOptions = hierOptions(catRes?.data ?? [], 'Toutes les catégories');

  return (
    <PageLayout
      title="GED — Documents"
      breadcrumbs={[{ label: 'Archivage', to: '/archiving' }, { label: 'GED' }]}
      actions={
        <Button icon={<UploadCloud className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
          Archiver des documents
        </Button>
      }
    >
      <ArchivingNav />

      <div className="grid grid-cols-[240px_1fr] gap-4">
        {/* Arborescence */}
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Dossiers</h3>
          <FolderTree
            folders={folderRes?.data ?? []}
            selectedId={folderId}
            onSelect={(id) => { setFolderId(id); setPage(1); }}
          />
        </Card>

        {/* Liste */}
        <div>
          <Card className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Input
                label="Rechercher"
                placeholder="Nom, numéro, description, texte OCR…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="w-52">
              <Select label="Catégorie" options={categoryOptions} value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} />
            </div>
            <div className="w-40">
              <Select label="Type" options={TYPE_OPTIONS} value={typeGroup}
                onChange={(e) => { setTypeGroup(e.target.value); setPage(1); }} />
            </div>
          </Card>

          <Card padding={false}>
            {isLoading ? (
              <div className="p-6"><SkeletonTable rows={8} /></div>
            ) : documents.length === 0 ? (
              <EmptyState
                title="Aucun document"
                description="Archivez vos premiers documents dans la GED."
                action={{ label: 'Archiver des documents', onClick: () => setImportOpen(true) }}
              />
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Numéro</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Nom</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Catégorie</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Taille</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Archivé le</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documents.map((d) => {
                      const g = mimeGroup(d.type);
                      return (
                        <tr key={d.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-blue-700">{d.numeroArchive ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="font-medium text-slate-900">{d.name}</span>
                            </div>
                            {d.folder && <p className="text-xs text-slate-400">{d.folder.name}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{d.documentCategory?.name ?? '—'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={GROUP_VARIANT[g.key] ?? 'default'}>{g.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{formatBytes(d.size)}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(d.uploadedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                                onClick={() => navigate(`/archiving/ged/${d.id}`)} />
                              <Button variant="ghost" size="sm" icon={<ExternalLink className="h-4 w-4" />}
                                onClick={() => openDocumentExternally(d.id)} />
                              <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />}
                                onClick={() => setDeleteTarget(d)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <Pagination page={page} total={total} limit={24} onPageChange={setPage} />
              </>
            )}
          </Card>
        </div>
      </div>

      <DocumentImportModal open={importOpen} onClose={() => setImportOpen(false)} defaultFolderId={folderId} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Mettre le document à la corbeille"
        message={`Retirer « ${deleteTarget?.name} » de la GED ?`}
        confirmLabel="Supprimer"
        loading={deleteDoc.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { await deleteDoc.mutateAsync(deleteTarget.id); setDeleteTarget(null); }}
      />
    </PageLayout>
  );
}
