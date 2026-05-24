import { useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import Badge from '../../../shared/components/ui/Badge';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import {
  useProjectTypes,
  useCreateProjectType,
  useUpdateProjectType,
  useDeleteProjectType,
} from '../../projects/hooks/useProjects';
import { PlusCircle, Edit, Trash2, Save, Briefcase } from 'lucide-react';

interface ProjectTypeRow {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  color?: string | null;
  isActive: boolean;
  _count?: { projects: number };
}

interface EditState {
  open: boolean;
  type: ProjectTypeRow | null;
}

/** Génère un code stable depuis un libellé : « Construction de bâtiments » → CONSTRUCTION_DE_BATIMENTS. */
function toCode(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export default function ProjectTypesSettingsTab() {
  // includeInactive=true pour permettre la gestion (réactivation, etc.).
  const { data: res, isLoading } = useProjectTypes(true);
  const create = useCreateProjectType();
  const update = useUpdateProjectType();
  const remove = useDeleteProjectType();

  const types: ProjectTypeRow[] = res?.success ? (res.data as ProjectTypeRow[]) ?? [] : [];

  const [edit, setEdit] = useState<EditState>({ open: false, type: null });
  const [confirm, setConfirm] = useState<{ open: boolean; type: ProjectTypeRow | null }>({
    open: false,
    type: null,
  });

  const openNew = () =>
    setEdit({ open: true, type: { id: 0, code: '', label: '', description: '', color: '', isActive: true } });
  const openEdit = (type: ProjectTypeRow) => setEdit({ open: true, type: { ...type } });
  const closeEdit = () => setEdit({ open: false, type: null });

  const onSave = async () => {
    if (!edit.type) return;
    const t = edit.type;
    const payload = {
      code: t.code || toCode(t.label),
      label: t.label.trim(),
      description: t.description || null,
      color: t.color || null,
      isActive: t.isActive,
    };
    if (!payload.label) return;
    const r: any = t.id > 0
      ? await update.mutateAsync({ id: t.id, payload })
      : await create.mutateAsync(payload);
    if (r.success) closeEdit();
  };

  const onDelete = async () => {
    if (!confirm.type) return;
    const r: any = await remove.mutateAsync(confirm.type.id);
    if (r.success) setConfirm({ open: false, type: null });
  };

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Types de projets
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Catalogue extensible des natures de projets : construction, bornage, bitumage, etc.
            Désactivez un type pour le retirer des nouveaux projets sans casser les projets existants.
          </p>
        </div>
        <Button icon={<PlusCircle className="h-4 w-4" />} onClick={openNew}>
          Nouveau type
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : types.length === 0 ? (
        <EmptyState
          title="Aucun type de projet"
          action={{ label: 'Nouveau type', onClick: openNew }}
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Libellé</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Code</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">Projets</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">Statut</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {types.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">
                  <span className="inline-flex items-center gap-2">
                    {t.color && (
                      <span className="h-3 w-3 rounded" style={{ background: t.color }} />
                    )}
                    {t.label}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{t.code}</td>
                <td className="px-3 py-2 text-slate-500 max-w-md truncate">{t.description ?? '—'}</td>
                <td className="px-3 py-2 text-center text-slate-600">{t._count?.projects ?? 0}</td>
                <td className="px-3 py-2 text-center">
                  <Badge variant={t.isActive ? 'success' : 'default'}>
                    {t.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                      onClick={() => openEdit(t)} />
                    <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => setConfirm({ open: true, type: t })} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal édition / création */}
      <Modal
        open={edit.open}
        onClose={closeEdit}
        title={edit.type?.id ? 'Modifier le type de projet' : 'Nouveau type de projet'}
      >
        {edit.type && (
          <div className="space-y-4">
            <Input
              label="Libellé"
              required
              value={edit.type.label}
              onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, label: e.target.value } }))}
              placeholder="ex: Construction de bâtiments"
            />
            <Input
              label="Code"
              value={edit.type.code}
              onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, code: e.target.value.toUpperCase() } }))}
              placeholder={edit.type.label ? toCode(edit.type.label) : 'CONSTRUCTION_BATIMENTS'}
            />
            <Textarea
              label="Description (optionnelle)"
              rows={3}
              value={edit.type.description ?? ''}
              onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, description: e.target.value } }))}
            />
            <div className="flex items-end gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Couleur</label>
                <input
                  type="color"
                  value={edit.type.color ?? '#2563EB'}
                  onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, color: e.target.value } }))}
                  className="block mt-1 h-9 w-16 border border-slate-300 rounded"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={edit.type.isActive}
                  onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, isActive: e.target.checked } }))}
                />
                Actif (proposé à la création de projets)
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeEdit}>Annuler</Button>
              <Button
                onClick={onSave}
                loading={create.isPending || update.isPending}
                icon={<Save className="h-4 w-4" />}
              >
                {edit.type.id ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, type: null })}
        onConfirm={onDelete}
        loading={remove.isPending}
        title="Supprimer le type de projet"
        message={
          confirm.type?._count?.projects
            ? `${confirm.type._count.projects} projet(s) utilisent ce type — la suppression sera refusée. Désactivez-le plutôt.`
            : `Supprimer définitivement le type « ${confirm.type?.label} » ?`
        }
        confirmLabel="Supprimer"
      />
    </Card>
  );
}
