import { useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Badge from '../../../shared/components/ui/Badge';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import {
  useIdTypes, useCreateIdType, useUpdateIdType, useDeleteIdType,
  type IdDocumentType,
} from '../../../shared/hooks/useIdTypes';
import { PlusCircle, Edit, Trash2, Save, IdCard, Star } from 'lucide-react';

interface EditState {
  open: boolean;
  type: (IdDocumentType & { id: number }) | null;
}

/** Génère un code stable depuis un libellé : « Permis de conduire » → PERMIS_DE_CONDUIRE. */
function toCode(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/** Onglet Paramètres › Types de pièces d'identité (catalogue extensible). */
export default function IdDocumentTypesSettingsTab() {
  const { data: res, isLoading } = useIdTypes(true);
  const create = useCreateIdType();
  const update = useUpdateIdType();
  const remove = useDeleteIdType();

  const types: IdDocumentType[] = res?.success ? (res.data as IdDocumentType[]) ?? [] : [];

  const [edit, setEdit] = useState<EditState>({ open: false, type: null });
  const [confirm, setConfirm] = useState<{ open: boolean; type: IdDocumentType | null }>({
    open: false, type: null,
  });

  const openNew = () =>
    setEdit({ open: true, type: { id: 0, code: '', label: '', isDefault: false, isActive: true } });
  const openEdit = (type: IdDocumentType) => setEdit({ open: true, type: { ...type } });
  const closeEdit = () => setEdit({ open: false, type: null });

  const onSave = async () => {
    if (!edit.type) return;
    const t = edit.type;
    const payload = {
      code: t.code || toCode(t.label),
      label: t.label.trim(),
      isDefault: t.isDefault,
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
            <IdCard className="h-4 w-4" /> Types de pièces d'identité
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Catalogue extensible des pièces d'identité acceptées : CNI, passeport, permis de conduire, etc.
            Le type marqué par défaut sera pré-sélectionné dans les nouvelles fiches clients et propriétaires.
          </p>
        </div>
        <Button icon={<PlusCircle className="h-4 w-4" />} onClick={openNew}>
          Nouveau type
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : types.length === 0 ? (
        <EmptyState
          title="Aucun type de pièce d'identité"
          action={{ label: 'Nouveau type', onClick: openNew }}
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Libellé</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Code</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">Par défaut</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">Statut</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {types.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">{t.label}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{t.code}</td>
                <td className="px-3 py-2 text-center">
                  {t.isDefault && <Star className="h-4 w-4 inline text-amber-500 fill-amber-400" />}
                </td>
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
                      disabled={t.isDefault}
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
        title={edit.type?.id ? "Modifier le type de pièce d'identité" : "Nouveau type de pièce d'identité"}
      >
        {edit.type && (
          <div className="space-y-4">
            <Input
              label="Libellé"
              required
              value={edit.type.label}
              onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, label: e.target.value } }))}
              placeholder="ex: Passeport"
            />
            <Input
              label="Code"
              value={edit.type.code}
              onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, code: e.target.value.toUpperCase() } }))}
              placeholder={edit.type.label ? toCode(edit.type.label) : 'PASSEPORT'}
            />
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={edit.type.isDefault}
                  onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, isDefault: e.target.checked } }))}
                />
                Type par défaut (un seul à la fois)
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={edit.type.isActive}
                  onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, isActive: e.target.checked } }))}
                />
                Actif (proposé dans les formulaires)
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
        title="Supprimer le type de pièce d'identité"
        message={`Supprimer définitivement le type « ${confirm.type?.label} » ? Les fiches qui le référencent verront leur champ vidé.`}
        confirmLabel="Supprimer"
      />
    </Card>
  );
}
