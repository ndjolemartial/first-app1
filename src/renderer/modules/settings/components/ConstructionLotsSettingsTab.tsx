import { useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useConstructionLots, useSaveConstructionLot, useDeleteConstructionLot } from '../../construction/hooks/useConstructionLibrary';
import { LOT_PHASE_LABELS, toOptions } from '../../construction/utils/constructionLabels';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface EditState { id?: number; code: string; numero: string; label: string; phase: string; description: string; isActive: boolean }
/** Écriture (Lots de travaux) : SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT (même liste que côté IPC, `checkLibExtendedWrite` dans `construction-library.ipc.ts`). */
const LIB_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/**
 * Les 22 lots de travaux du moteur de devis de construction (Module 17).
 * Se projettent 1-pour-1 sur `QuoteItem.category` à la conversion en devis.
 */
export default function ConstructionLotsSettingsTab() {
  const { data, isLoading } = useConstructionLots(true);
  const save = useSaveConstructionLot();
  const del = useDeleteConstructionLot();
  const lots: any[] = data?.data ?? [];

  const role = useAuthStore((s) => s.user?.role);
  const canWrite = !!role && LIB_ADMIN_ROLES.includes(role);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ code: '', numero: String((lots.length ?? 0) + 1), label: '', phase: 'GROS_OEUVRE', description: '', isActive: true });
  const startEdit = (l: any) => setEditing({ id: l.id, code: l.code, numero: String(l.numero), label: l.label, phase: l.phase, description: l.description ?? '', isActive: l.isActive });

  const onSave = async () => {
    if (!editing || !editing.code.trim() || !editing.label.trim()) return;
    const r = await save.mutateAsync({
      id: editing.id,
      payload: { code: editing.code.trim(), numero: Number(editing.numero) || 1, label: editing.label.trim(), phase: editing.phase, description: editing.description || null, isActive: editing.isActive },
    });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Les 22 lots de travaux du devis quantitatif et estimatif.</p>
        {canWrite && !editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouveau lot</Button>}
      </div>

      {canWrite && editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier le lot' : 'Nouveau lot'}</h3>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Code *" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="LOT01" />
            <Input label="Numéro *" type="number" value={editing.numero} onChange={(e) => setEditing({ ...editing, numero: e.target.value })} />
            <div className="col-span-2">
              <Input label="Libellé *" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Select label="Phase (Niveau 1)" options={toOptions(LOT_PHASE_LABELS)} value={editing.phase} onChange={(e) => setEditing({ ...editing, phase: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Input label="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
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
        ) : lots.length === 0 ? (
          <EmptyState title="Aucun lot" description="Créez les 22 lots du devis quantitatif." action={canWrite ? { label: 'Nouveau lot', onClick: startNew } : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">N°</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Libellé</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Phase</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Ouvrages</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                {canWrite && <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lots.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{l.numero}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{l.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{l.label}</td>
                  <td className="px-4 py-3 text-slate-500">{LOT_PHASE_LABELS[l.phase] ?? l.phase}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{l._count?.workItems ?? 0}</td>
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
        <ConfirmDialog open={!!toDelete} title="Supprimer le lot" message={`Supprimer le lot « ${toDelete?.label ?? ''} » ?`} onConfirm={handleDelete} onClose={() => setToDelete(null)} />
      )}
    </div>
  );
}
