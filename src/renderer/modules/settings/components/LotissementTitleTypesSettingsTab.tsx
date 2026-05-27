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
  useTitleTypes, useCreateTitleType, useUpdateTitleType, useDeleteTitleType,
  type LotissementTitleType,
} from '../../../shared/hooks/useTitleTypes';
import { PlusCircle, Edit, Trash2, Save, FileSignature, Star } from 'lucide-react';

interface EditState {
  open: boolean;
  type: (LotissementTitleType & { id: number }) | null;
}

function toCode(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/** Onglet Paramètres › Natures de titres de lotissement. */
export default function LotissementTitleTypesSettingsTab() {
  const { data: res, isLoading } = useTitleTypes(true);
  const create = useCreateTitleType();
  const update = useUpdateTitleType();
  const remove = useDeleteTitleType();

  const types: LotissementTitleType[] = res?.success ? (res.data as LotissementTitleType[]) ?? [] : [];

  const [edit, setEdit] = useState<EditState>({ open: false, type: null });
  const [confirm, setConfirm] = useState<{ open: boolean; type: LotissementTitleType | null }>({
    open: false, type: null,
  });

  const openNew = () =>
    setEdit({ open: true, type: { id: 0, code: '', label: '', documentsLivres: '', isDefault: false, isActive: true } });
  const openEdit = (type: LotissementTitleType) => setEdit({ open: true, type: { ...type } });
  const closeEdit = () => setEdit({ open: false, type: null });

  const onSave = async () => {
    if (!edit.type) return;
    const t = edit.type;
    const payload = {
      code: t.code || toCode(t.label),
      label: t.label.trim(),
      documentsLivres: (t.documentsLivres ?? '').trim() || null,
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
            <FileSignature className="h-4 w-4" /> Natures de titres de lotissement
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Catalogue extensible des titres administratifs sollicités pour un lotissement :
            arrêté d'approbation, permis d'aménager, etc. Le titre par défaut sera pré-sélectionné
            à la création d'un nouveau lotissement.
          </p>
        </div>
        <Button icon={<PlusCircle className="h-4 w-4" />} onClick={openNew}>
          Nouveau titre
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : types.length === 0 ? (
        <EmptyState
          title="Aucune nature de titre"
          action={{ label: 'Nouveau titre', onClick: openNew }}
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Libellé</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Code</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Documents livrés avec terrains</th>
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
                <td className="px-3 py-2 text-slate-600 max-w-md">
                  {t.documentsLivres
                    ? <span className="whitespace-pre-line text-xs">{t.documentsLivres}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
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

      <Modal
        open={edit.open}
        onClose={closeEdit}
        title={edit.type?.id ? 'Modifier la nature de titre' : 'Nouvelle nature de titre'}
      >
        {edit.type && (
          <div className="space-y-4">
            <Input
              label="Libellé"
              required
              value={edit.type.label}
              onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, label: e.target.value } }))}
              placeholder="ex: Permis d'aménager"
            />
            <Input
              label="Code"
              value={edit.type.code}
              onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, code: e.target.value.toUpperCase() } }))}
              placeholder={edit.type.label ? toCode(edit.type.label) : 'PERMIS_AMENAGER'}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Documents livrés avec terrains
              </label>
              <textarea
                value={edit.type.documentsLivres ?? ''}
                onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, documentsLivres: e.target.value } }))}
                placeholder="ex : ACD, plan de masse, situation géographique"
                rows={3}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Substitué dans les modèles via la variable <code>{'{{lotissement.documentsLivres}}'}</code>.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={edit.type.isDefault}
                  onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, isDefault: e.target.checked } }))}
                />
                Titre par défaut (un seul à la fois)
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={edit.type.isActive}
                  onChange={(e) => setEdit((s) => ({ ...s, type: { ...s.type!, isActive: e.target.checked } }))}
                />
                Actif (proposé à la création de lotissements)
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
        title="Supprimer la nature de titre"
        message={`Supprimer définitivement « ${confirm.type?.label} » ? Les lotissements qui le référencent verront leur champ vidé.`}
        confirmLabel="Supprimer"
      />
    </Card>
  );
}
