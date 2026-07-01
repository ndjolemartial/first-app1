import { useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useEssaiCategories, useSaveEssaiCategory, useDeleteEssaiCategory,
} from '../../hr/hooks/useHr';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

const UNIT_OPTIONS = [
  { value: 'MOIS', label: 'Mois' },
  { value: 'JOURS', label: 'Jour(s)' },
];

interface EditState { id?: number; label: string; durationValue: string; durationUnit: string; isActive: boolean }

const unitLabel = (u: string, n: number) => (u === 'MOIS' ? (n > 1 ? 'mois' : 'mois') : (n > 1 ? 'jours' : 'jour'));

/**
 * Paramétrage des catégories socio-professionnelles et de leur délai d'essai.
 * Sert de référence pour les contrats ESSAI (auto-remplissage de la durée).
 */
export default function EssaiCategoriesSettingsTab() {
  const { data, isLoading } = useEssaiCategories(true);
  const save = useSaveEssaiCategory();
  const del = useDeleteEssaiCategory();
  const cats: any[] = data?.data ?? [];

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ label: '', durationValue: '1', durationUnit: 'MOIS', isActive: true });
  const startEdit = (c: any) => setEditing({
    id: c.id, label: c.label, durationValue: String(c.durationValue), durationUnit: c.durationUnit, isActive: c.isActive,
  });

  const onSave = async () => {
    if (!editing || !editing.label.trim()) return;
    const payload = {
      label: editing.label.trim(),
      durationValue: Number(editing.durationValue) || 1,
      durationUnit: editing.durationUnit,
      isActive: editing.isActive,
    };
    const r = await save.mutateAsync({ id: editing.id, payload });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => {
    if (toDelete) await del.mutateAsync(toDelete.id);
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Délais de la période d'essai par catégorie socio-professionnelle (renouvelable une fois).
        </p>
        {!editing && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle catégorie</Button>
        )}
      </div>

      {editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {editing.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Input label="Catégorie socio-professionnelle *" value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="Ex : Cadres, ingénieurs et assimilés" />
            </div>
            <Input label="Durée *" type="number" min="1" step="1" value={editing.durationValue}
              onChange={(e) => setEditing({ ...editing, durationValue: e.target.value })} />
            <Select label="Unité" options={UNIT_OPTIONS} value={editing.durationUnit}
              onChange={(e) => setEditing({ ...editing, durationUnit: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editing.isActive}
              onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={onSave}>Enregistrer</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : cats.length === 0 ? (
          <EmptyState
            title="Aucune catégorie"
            description="Définissez les délais d'essai par catégorie socio-professionnelle."
            action={{ label: 'Nouvelle catégorie', onClick: startNew }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Catégorie</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Délai d'essai</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cats.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.label}</td>
                  <td className="px-4 py-3 text-slate-600">{c.durationValue} {unitLabel(c.durationUnit, c.durationValue)}</td>
                  <td className="px-4 py-3">
                    {c.isActive
                      ? <Badge variant="success">Active</Badge>
                      : <Badge variant="default">Inactive</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                        title="Modifier" onClick={() => startEdit(c)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />}
                        title="Supprimer" onClick={() => setToDelete(c)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer la catégorie"
        message={`Supprimer la catégorie « ${toDelete?.label ?? ''} » ?`}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
