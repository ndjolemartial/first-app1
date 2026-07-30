import { useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useRatioDefinitions, useSaveRatioDefinition, useDeleteRatioDefinition } from '../../construction/hooks/useConstructionLibrary';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface EditState { id?: number; code: string; label: string; category: string; unit: string; defaultValue: string; description: string; isActive: boolean }

/**
 * Catalogue des coefficients/ratios du moteur de devis de construction — un
 * nouveau coefficient s'ajoute ici, puis une entrée est ajoutée au registre
 * de formules côté code (construction-formulas.ts) si besoin d'une nouvelle
 * formule ; les coefficients déjà référencés par le registre existant ne
 * nécessitent qu'une ligne ici.
 */
export default function ConstructionRatioDefsSettingsTab() {
  const { data, isLoading } = useRatioDefinitions(true);
  const save = useSaveRatioDefinition();
  const del = useDeleteRatioDefinition();
  const defs: any[] = data?.data ?? [];

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ code: '', label: '', category: '', unit: '', defaultValue: '0', description: '', isActive: true });
  const startEdit = (d: any) => setEditing({ id: d.id, code: d.code, label: d.label, category: d.category ?? '', unit: d.unit ?? '', defaultValue: String(Number(d.defaultValue)), description: d.description ?? '', isActive: d.isActive });

  const onSave = async () => {
    if (!editing || !editing.code.trim() || !editing.label.trim()) return;
    const payload = { code: editing.code.trim(), label: editing.label.trim(), category: editing.category || null, unit: editing.unit || null, defaultValue: Number(editing.defaultValue) || 0, description: editing.description || null, isActive: editing.isActive };
    const r = await save.mutateAsync({ id: editing.id, payload });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Catalogue des coefficients utilisés par le registre de formules.</p>
        {!editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouveau coefficient</Button>}
      </div>

      {editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier le coefficient' : 'Nouveau coefficient'}</h3>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Code *" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="COEF_REVETEMENT_SOL" />
            <div className="col-span-2"><Input label="Libellé *" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></div>
            <Input label="Catégorie" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Géométrie, Électricité…" />
            <Input label="Unité" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} placeholder="ratio, %, nb, m²…" />
            <Input label="Valeur par défaut *" type="number" step="0.0001" value={editing.defaultValue} onChange={(e) => setEditing({ ...editing, defaultValue: e.target.value })} />
            <div className="col-span-2"><Input label="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
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
        ) : defs.length === 0 ? (
          <EmptyState title="Aucun coefficient" description="Constituez le catalogue de coefficients." action={{ label: 'Nouveau coefficient', onClick: startNew }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Libellé</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Catégorie</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Valeur par défaut</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Unité</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {defs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{d.label}{!d.isActive && <Badge variant="default" className="ml-2">inactif</Badge>}</td>
                  <td className="px-4 py-3 text-slate-500">{d.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{Number(d.defaultValue)}</td>
                  <td className="px-4 py-3 text-slate-500">{d.unit ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(d)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(d)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog open={!!toDelete} title="Supprimer le coefficient" message={`Supprimer « ${toDelete?.label ?? ''} » ?`} onConfirm={handleDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}
