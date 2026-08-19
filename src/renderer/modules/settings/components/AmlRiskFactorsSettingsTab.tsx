import { useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAmlRiskFactors, useCreateAmlRiskFactor, useUpdateAmlRiskFactor, useDeleteAmlRiskFactor } from '../../aml/hooks/useAml';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface EditState { id?: number; code: string; label: string; category: string; weight: string; isAutoDetected: boolean }
const AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];

export default function AmlRiskFactorsSettingsTab() {
  const { data, isLoading } = useAmlRiskFactors(true);
  const create = useCreateAmlRiskFactor();
  const update = useUpdateAmlRiskFactor();
  const del = useDeleteAmlRiskFactor();
  const factors: any[] = data?.data ?? [];

  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = AML_ROLES.includes(role);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ code: '', label: '', category: '', weight: '1', isAutoDetected: false });
  const startEdit = (f: any) => setEditing({ id: f.id, code: f.code, label: f.label, category: f.category ?? '', weight: String(f.weight), isAutoDetected: f.isAutoDetected });

  const onSave = async () => {
    if (!editing || !editing.code.trim() || !editing.label.trim()) return;
    const payload = { code: editing.code.trim(), label: editing.label.trim(), category: editing.category || null, weight: Number(editing.weight) || 1, isAutoDetected: editing.isAutoDetected };
    const r: any = editing.id ? await update.mutateAsync({ id: editing.id, payload }) : await create.mutateAsync(payload);
    if (r.success) setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Catalogue des facteurs de risque LBC/FT et de leur poids dans le score de risque. ⚠️ Valeurs de référence indicatives, à valider avec le chargé de conformité désigné.
        </p>
        {canWrite && !editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouveau facteur</Button>}
      </div>

      {canWrite && editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier le facteur' : 'Nouveau facteur'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code *" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} disabled={!!editing.id} />
            <Input label="Libellé *" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            <Input label="Catégorie" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Client, PPE, Transaction…" />
            <Input label="Poids" type="number" value={editing.weight} onChange={(e) => setEditing({ ...editing, weight: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editing.isAutoDetected} onChange={(e) => setEditing({ ...editing, isAutoDetected: e.target.checked })} className="rounded border-slate-300" />
            Détecté automatiquement par le moteur de scoring
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={create.isPending || update.isPending} onClick={onSave}>Enregistrer</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : factors.length === 0 ? (
          <EmptyState title="Aucun facteur de risque" action={canWrite ? { label: 'Nouveau facteur', onClick: startNew } : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Code</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Libellé</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Catégorie</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Poids</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Détection</th>
                {canWrite && <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {factors.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{f.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{f.label}</td>
                  <td className="px-4 py-3 text-slate-500">{f.category ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{f.weight}</td>
                  <td className="px-4 py-3">{f.isAutoDetected ? <Badge variant="info">Auto</Badge> : <Badge variant="default">Manuel</Badge>}</td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(f)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(f)} />
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
        <ConfirmDialog open={!!toDelete} title="Désactiver le facteur" message={`Désactiver « ${toDelete?.label ?? ''} » ?`}
          onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }} onClose={() => setToDelete(null)} />
      )}
    </div>
  );
}
