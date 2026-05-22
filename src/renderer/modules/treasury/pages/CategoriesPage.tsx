import { useState } from 'react';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Modal from '../../../shared/components/ui/Modal';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  useTreasuryCategories, useCreateTreasuryCategory, useUpdateTreasuryCategory, useDeleteTreasuryCategory,
} from '../hooks/useTreasury';
import { DIRECTION_OPTIONS, DIRECTION_LABEL, TREASURY_WRITE_ROLES, TREASURY_ADMIN_ROLES } from '../utils/treasury.utils';
import { Plus, Pencil, Trash2, Tags } from 'lucide-react';

/** Modale de création / modification d'un objet d'opération. */
function CategoryModal({ category, onClose }: { category: any | null; onClose: () => void }) {
  const isEdit = !!category;
  const create = useCreateTreasuryCategory();
  const update = useUpdateTreasuryCategory();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      label: category?.label ?? '',
      direction: category?.direction ?? 'ENTREE',
      accountingCode: category?.accountingCode ?? '',
      isActive: category ? String(category.isActive) : 'true',
    },
  });
  const apiError = create.data && !create.data.success ? create.data.error
    : update.data && !update.data.success ? update.data.error
    : null;

  const onSubmit = async (data: any) => {
    const payload = {
      label: data.label,
      direction: data.direction,
      accountingCode: data.accountingCode || undefined,
      isActive: data.isActive !== 'false',
    };
    const r = isEdit
      ? await update.mutateAsync({ id: category.id, payload })
      : await create.mutateAsync(payload);
    if (r.success) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Modifier l\'objet d\'opération' : 'Nouvel objet d\'opération'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <Input
          label="Libellé"
          required
          placeholder="Ex : Encaissement loyer, Achat fournitures…"
          error={errors.label && 'Libellé requis'}
          {...register('label', { required: true })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Sens" required options={DIRECTION_OPTIONS} {...register('direction')} />
          <Input
            label="N° de compte comptable"
            placeholder="Ex : 301"
            {...register('accountingCode')}
          />
        </div>
        <Select
          label="Statut"
          options={[{ value: 'true', label: 'Actif' }, { value: 'false', label: 'Inactif' }]}
          {...register('isActive')}
        />
        {apiError && (
          <p className="text-xs text-red-600">
            {typeof apiError === 'string' ? apiError : 'Erreur lors de l\'enregistrement'}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canManage = TREASURY_WRITE_ROLES.includes(role);
  const canDelete = TREASURY_ADMIN_ROLES.includes(role);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: res, isLoading } = useTreasuryCategories();
  const categories = res?.data ?? [];
  const deleteCategory = useDeleteTreasuryCategory();

  const openCreate = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (c: any) => { setEditTarget(c); setModalOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const r = await deleteCategory.mutateAsync(deleteTarget.id);
    if (r.success) setDeleteTarget(null);
  };

  return (
    <PageLayout
      title="Objets d'opération"
      breadcrumbs={[{ label: 'Trésorerie', to: '/treasury' }, { label: 'Objets d\'opération' }]}
      actions={
        canManage && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nouvel objet
          </Button>
        )
      }
    >
      <p className="text-sm text-slate-500 mb-4 flex items-center gap-2">
        <Tags className="h-4 w-4 text-slate-400" />
        Définissez les natures possibles d'entrées et de sorties, chacune rattachée à un numéro de compte comptable.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : categories.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Aucun objet d'opération défini.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Libellé</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Sens</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">N° compte comptable</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.label}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.direction === 'ENTREE' ? 'success' : 'danger'}>
                      {DIRECTION_LABEL[c.direction] ?? c.direction}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.accountingCode || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.isActive ? 'success' : 'default'}>
                      {c.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canManage && (
                        <Button
                          size="sm" variant="ghost"
                          icon={<Pencil className="h-4 w-4" />}
                          onClick={() => openEdit(c)}
                        />
                      )}
                      {canDelete && (
                        <Button
                          size="sm" variant="ghost"
                          icon={<Trash2 className="h-4 w-4 text-red-500" />}
                          onClick={() => { deleteCategory.reset(); setDeleteTarget(c); }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && <CategoryModal category={editTarget} onClose={() => setModalOpen(false)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer l'objet d'opération"
        message={`Supprimer « ${deleteTarget?.label ?? ''} » ? Les opérations déjà enregistrées avec cet objet sont conservées.`}
        confirmLabel="Supprimer"
        loading={deleteCategory.isPending}
      />
    </PageLayout>
  );
}
