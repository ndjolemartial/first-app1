import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Badge from '../../../shared/components/ui/Badge';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import ArchivingNav from '../components/ArchivingNav';
import {
  useGedCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useGedFolders, useCreateFolder, useUpdateFolder, useDeleteFolder,
  useGedTags, useCreateTag, useUpdateTag, useDeleteTag,
} from '../hooks/useGed';
import { hierOptions } from '../utils/gedTree';
import { Plus, Trash2, Pencil, Check, X, FolderTree as FolderTreeIcon, Tags, Layers } from 'lucide-react';

/** Champ d'édition en ligne (renommage). */
function InlineEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value);
  return (
    <div className="flex flex-1 items-center gap-1">
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) onSave(text.trim());
          if (e.key === 'Escape') onCancel();
        }}
        className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button className="text-emerald-600 hover:text-emerald-700" onClick={() => text.trim() && onSave(text.trim())}>
        <Check className="h-4 w-4" />
      </button>
      <button className="text-slate-400 hover:text-slate-600" onClick={onCancel}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Section générique de gestion d'une arborescence (catégories ou dossiers). */
function TreeSection({
  title, icon, items, onCreate, onRename, onDelete, creating,
}: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  onCreate: (name: string, parentId: number | null) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  creating: boolean;
}) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const byId = new Map(items.map((i) => [i.id, i]));

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), parentId ? Number(parentId) : null);
    setName('');
    setParentId('');
  };

  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">{icon} {title}</h3>

      <div className="mb-4 flex items-end gap-2">
        <div className="flex-1"><Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="w-44">
          <Select label="Parent" options={hierOptions(items, '— Racine —')} value={parentId} onChange={(e) => setParentId(e.target.value)} />
        </div>
        <Button onClick={submit} loading={creating} icon={<Plus className="h-4 w-4" />}>Ajouter</Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun élément.</p>
      ) : (
        <div className="space-y-1">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-1.5 text-sm">
              {editingId === it.id ? (
                <InlineEdit
                  value={it.name}
                  onSave={(v) => { onRename(it.id, v); setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <span className="flex-1 text-slate-700">
                    {it.parentId && byId.get(it.parentId) && (
                      <span className="text-xs text-slate-400">{byId.get(it.parentId)!.name} › </span>
                    )}
                    {it.name}
                  </span>
                  {it._count && <Badge variant="default">{it._count.documents}</Badge>}
                  <button className="text-slate-400 hover:text-blue-600" onClick={() => setEditingId(it.id)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="text-slate-400 hover:text-red-500" onClick={() => setDeleteTarget(it)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Supprimer « ${deleteTarget?.name} »`}
        message="Les documents rattachés ne sont pas supprimés mais perdront ce classement."
        confirmLabel="Supprimer"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
      />
    </Card>
  );
}

export default function GedSettingsPage() {
  const { data: catRes } = useGedCategories();
  const { data: folderRes } = useGedFolders();
  const { data: tagRes } = useGedTags();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [tagName, setTagName] = useState('');
  const [editingTag, setEditingTag] = useState<number | null>(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState<any>(null);
  const tags: any[] = tagRes?.data ?? [];

  return (
    <PageLayout
      title="Organisation de la GED"
      breadcrumbs={[{ label: 'Archivage', to: '/archiving' }, { label: 'Organisation' }]}
    >
      <ArchivingNav />

      <div className="grid grid-cols-2 gap-6">
        <TreeSection
          title="Catégories"
          icon={<Layers className="h-4 w-4 text-slate-500" />}
          items={catRes?.data ?? []}
          creating={createCategory.isPending}
          onCreate={(name, parentId) => createCategory.mutate({ name, parentId })}
          onRename={(id, name) => updateCategory.mutate({ id, payload: { name } })}
          onDelete={(id) => deleteCategory.mutate(id)}
        />

        <TreeSection
          title="Dossiers"
          icon={<FolderTreeIcon className="h-4 w-4 text-slate-500" />}
          items={folderRes?.data ?? []}
          creating={createFolder.isPending}
          onCreate={(name, parentId) => createFolder.mutate({ name, parentId })}
          onRename={(id, name) => updateFolder.mutate({ id, payload: { name } })}
          onDelete={(id) => deleteFolder.mutate(id)}
        />

        {/* Étiquettes */}
        <Card className="col-span-2">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <Tags className="h-4 w-4 text-slate-500" /> Étiquettes
          </h3>
          <div className="mb-4 flex items-end gap-2">
            <div className="w-64"><Input label="Nouvelle étiquette" value={tagName} onChange={(e) => setTagName(e.target.value)} /></div>
            <Button
              onClick={() => { if (tagName.trim()) { createTag.mutate({ name: tagName.trim() }); setTagName(''); } }}
              loading={createTag.isPending}
              icon={<Plus className="h-4 w-4" />}
            >
              Ajouter
            </Button>
          </div>
          {tags.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune étiquette.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {tags.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-1.5 text-sm">
                  {editingTag === t.id ? (
                    <InlineEdit
                      value={t.name}
                      onSave={(v) => { updateTag.mutate({ id: t.id, payload: { name: v } }); setEditingTag(null); }}
                      onCancel={() => setEditingTag(null)}
                    />
                  ) : (
                    <>
                      <span className="flex-1 truncate text-slate-700">{t.name}</span>
                      <button className="text-slate-400 hover:text-blue-600" onClick={() => setEditingTag(t.id)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="text-slate-400 hover:text-red-500" onClick={() => setDeleteTagTarget(t)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleteTagTarget}
        title={`Supprimer l'étiquette « ${deleteTagTarget?.name} »`}
        message="L'étiquette est retirée de tous les documents. Si elle est aussi utilisée par des prospects, elle y reste conservée."
        confirmLabel="Supprimer"
        loading={deleteTag.isPending}
        onClose={() => setDeleteTagTarget(null)}
        onConfirm={async () => { await deleteTag.mutateAsync(deleteTagTarget.id); setDeleteTagTarget(null); }}
      />
    </PageLayout>
  );
}
