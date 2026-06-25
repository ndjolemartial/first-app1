import { useState, useEffect } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useCreateFolder, useUpdateFolder, useDeleteFolder } from '../hooks/useGed';
import { useSelectableUsers } from '../../users/hooks/useUsers';
import { formatPersonName } from '../../../shared/utils/format';
import { toast } from '../../../shared/components/ui/Toast';
import { Plus, Trash2, Pencil, Users2, Share2 } from 'lucide-react';

interface SharedFolder {
  id: number;
  name: string;
  accessUserIds?: number[];
}

/** Modale de création / édition d'un dossier partagé (nom + utilisateurs autorisés). */
function ShareFolderModal({ open, folder, onClose }: {
  open: boolean;
  folder: SharedFolder | null;
  onClose: () => void;
}) {
  const { data: usersRes } = useSelectableUsers();
  const users: any[] = usersRes?.data ?? [];
  const create = useCreateFolder();
  const update = useUpdateFolder();

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setName(folder?.name ?? '');
      setSelected(new Set(folder?.accessUserIds ?? []));
    }
  }, [open, folder]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Nom requis'); return; }
    const userIds = [...selected];
    const r = folder
      ? await update.mutateAsync({ id: folder.id, payload: { name: trimmed, userIds } })
      : await create.mutateAsync({ name: trimmed, kind: 'SHARED', userIds });
    if (r?.success) {
      toast.success(folder ? 'Dossier partagé mis à jour' : 'Dossier partagé créé');
      onClose();
    } else {
      toast.error(typeof r?.error === 'string' ? r.error : 'Erreur');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={folder ? 'Modifier le dossier partagé' : 'Nouveau dossier partagé'}
      size="content"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} loading={create.isPending || update.isPending}>
            {folder ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Nom du dossier" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Users2 className="h-4 w-4 text-slate-500" /> Utilisateurs autorisés ({selected.size})
          </label>
          <p className="mb-2 text-xs text-slate-400">
            Ces utilisateurs pourront consulter et déposer des fichiers dans ce dossier.
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {users.length === 0 ? (
              <p className="px-1 py-2 text-sm text-slate-400">Aucun utilisateur.</p>
            ) : users.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={selected.has(u.id)}
                  onChange={() => toggle(u.id)}
                />
                <span className="text-slate-700">
                  {formatPersonName(u, `Utilisateur #${u.id}`)}
                  {u.matricule ? <span className="text-slate-400"> ({u.matricule})</span> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Gestion des dossiers partagés (lecture + dépôt) — réservée aux rôles
 * SUPER_ADMIN / ADMIN / MANAGER. L'accès est configuré à la création/modification.
 */
export default function SharedFoldersSection({ folders }: { folders: any[] }) {
  const sharedFolders = folders.filter((f) => f.kind === 'SHARED');
  const deleteFolder = useDeleteFolder();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SharedFolder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (f: SharedFolder) => { setEditing(f); setModalOpen(true); };

  return (
    <Card className="col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <Share2 className="h-4 w-4 text-slate-500" /> Dossiers partagés
        </h3>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nouveau dossier partagé
        </Button>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Dossiers accessibles uniquement aux utilisateurs que vous autorisez (lecture + dépôt de fichiers).
      </p>
      {sharedFolders.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun dossier partagé.</p>
      ) : (
        <div className="space-y-1">
          {sharedFolders.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm">
              <span className="flex-1 truncate text-slate-700">{f.name}</span>
              <span className="text-xs text-slate-400">{(f.accessUserIds?.length ?? 0)} utilisateur(s)</span>
              <button className="text-slate-400 hover:text-blue-600" onClick={() => openEdit(f)} title="Modifier les accès">
                <Pencil className="h-4 w-4" />
              </button>
              <button className="text-slate-400 hover:text-red-500" onClick={() => setDeleteTarget(f)} title="Supprimer">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ShareFolderModal open={modalOpen} folder={editing} onClose={() => setModalOpen(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteFolder.mutate(deleteTarget.id); setDeleteTarget(null); }}
        title="Supprimer le dossier partagé"
        message={`Supprimer le dossier « ${deleteTarget?.name ?? ''} » ? Les documents qu'il contient ne seront plus classés dans ce dossier.`}
        confirmLabel="Supprimer"
      />
    </Card>
  );
}
