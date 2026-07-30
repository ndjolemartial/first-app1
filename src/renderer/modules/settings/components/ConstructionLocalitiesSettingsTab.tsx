import { useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useConstructionLocalities, useSaveConstructionLocality, useDeleteConstructionLocality } from '../../construction/hooks/useConstructionLibrary';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface EditState { id?: number; label: string; region: string; priceCoefficient: string; isActive: boolean }
/** Écriture (Localités) : SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT (même liste que côté IPC, `checkLibExtendedWrite` dans `construction-library.ipc.ts`). */
const LIB_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/**
 * Localités du bordereau de prix (Module 17) : coefficient multiplicateur
 * appliqué au prix de référence (Abidjan = 1,000) selon la ville du projet.
 * Sélectionnées sur le formulaire « Nouveau projet de construction »
 * (champ « Localité (bordereau de prix) ») — laisser ce champ vide applique
 * par défaut le coefficient d'Abidjan.
 */
export default function ConstructionLocalitiesSettingsTab() {
  const { data, isLoading } = useConstructionLocalities(true);
  const save = useSaveConstructionLocality();
  const del = useDeleteConstructionLocality();
  const localities: any[] = data?.data ?? [];

  const role = useAuthStore((s) => s.user?.role);
  const canWrite = !!role && LIB_ADMIN_ROLES.includes(role);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ label: '', region: '', priceCoefficient: '1', isActive: true });
  const startEdit = (l: any) => setEditing({ id: l.id, label: l.label, region: l.region ?? '', priceCoefficient: String(Number(l.priceCoefficient)), isActive: l.isActive });

  const onSave = async () => {
    if (!editing || !editing.label.trim()) return;
    const r = await save.mutateAsync({
      id: editing.id,
      payload: { label: editing.label.trim(), region: editing.region || null, priceCoefficient: Number(editing.priceCoefficient) || 1, isActive: editing.isActive },
    });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Coefficient de prix par ville — appliqué au bordereau de prix (Abidjan = 1,000, référence). Laisser le champ « Localité » vide sur un projet applique ce coefficient par défaut.</p>
        {canWrite && !editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle localité</Button>}
      </div>

      {canWrite && editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier la localité' : 'Nouvelle localité'}</h3>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Ville *" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Ex: Bouaké" />
            <Input label="Région" value={editing.region} onChange={(e) => setEditing({ ...editing, region: e.target.value })} />
            <Input label="Coefficient de prix *" type="number" min={0} step="0.001" value={editing.priceCoefficient}
              onChange={(e) => setEditing({ ...editing, priceCoefficient: e.target.value })} helper="1,000 = prix de référence (Abidjan)" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="rounded border-slate-300" />
            Actif
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={onSave}>Enregistrer</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : localities.length === 0 ? (
          <EmptyState title="Aucune localité" description="Créez les villes du bordereau de prix." action={canWrite ? { label: 'Nouvelle localité', onClick: startNew } : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Ville</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Région</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Coefficient</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                {canWrite && <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {localities.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{l.label}</td>
                  <td className="px-4 py-3 text-slate-500">{l.region ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{Number(l.priceCoefficient).toFixed(3)}</td>
                  <td className="px-4 py-3">{l.isActive ? <Badge variant="success">Actif</Badge> : <Badge variant="default">Inactif</Badge>}</td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(l)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(l)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {canWrite && (
        <ConfirmDialog open={!!toDelete} title="Supprimer la localité" message={`Supprimer « ${toDelete?.label ?? ''} » ?`} onConfirm={handleDelete} onClose={() => setToDelete(null)} />
      )}
    </div>
  );
}
