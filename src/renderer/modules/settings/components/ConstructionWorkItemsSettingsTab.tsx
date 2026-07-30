import { useMemo, useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import Modal from '../../../shared/components/ui/Modal';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useConstructionWorkItems, useSaveConstructionWorkItem, useDeleteWorkItem, useDuplicateWorkItem,
  useConstructionLots, useConstructionResources,
} from '../../construction/hooks/useConstructionLibrary';
import { formatCurrency } from '../../../shared/utils/format';
import { FORMULA_CATALOG } from '../../construction/utils/constructionFormulasCatalog';
import { Plus, Edit, Trash2, Save, X, Copy } from 'lucide-react';

interface ComponentRow { resourceId: number; resourceLabel?: string; quantityPerUnit: string; wastageRate: string }
interface EditState {
  id?: number; code: string; lotId: string; designation: string; unit: string; formulaCode: string;
  fixedQuantity: string; quantityMultiplier: string; percentOfTotalPct: string; isActive: boolean;
  components: ComponentRow[];
}

/** Bibliothèque d'ouvrages (recettes) — cœur du moteur de devis de construction. */
export default function ConstructionWorkItemsSettingsTab() {
  const [lotFilter, setLotFilter] = useState('');
  const { data: lotsRes } = useConstructionLots();
  const { data, isLoading } = useConstructionWorkItems({ includeInactive: true, lotId: lotFilter || undefined });
  const { data: resourcesRes } = useConstructionResources({ includeInactive: false }, 1, 500);
  const save = useSaveConstructionWorkItem();
  const del = useDeleteWorkItem();
  const duplicate = useDuplicateWorkItem();

  const lots: any[] = lotsRes?.data ?? [];
  const workItems: any[] = data?.data ?? [];
  const resources: any[] = resourcesRes?.data ?? [];
  const resourceOptions = resources.map((r) => ({ value: String(r.id), label: `${r.label} (${formatCurrency(Number(r.unitPrice))}/${r.unit})` }));

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ code: '', lotId: lots[0] ? String(lots[0].id) : '', designation: '', unit: '', formulaCode: '', fixedQuantity: '', quantityMultiplier: '1', percentOfTotalPct: '', isActive: true, components: [] });
  const startEdit = (wi: any) => setEditing({
    id: wi.id, code: wi.code, lotId: String(wi.lotId), designation: wi.designation, unit: wi.unit, formulaCode: wi.formulaCode ?? '',
    fixedQuantity: wi.fixedQuantity != null ? String(Number(wi.fixedQuantity)) : '', quantityMultiplier: String(Number(wi.quantityMultiplier ?? 1)),
    percentOfTotalPct: wi.percentOfTotalPct != null ? String(Number(wi.percentOfTotalPct)) : '', isActive: wi.isActive,
    components: (wi.components ?? []).map((c: any) => ({ resourceId: c.resourceId, resourceLabel: c.resource?.label, quantityPerUnit: String(Number(c.quantityPerUnit)), wastageRate: String(Number(c.wastageRate)) })),
  });

  const deboursSec = useMemo(() => {
    if (!editing) return 0;
    return editing.components.reduce((s, c) => {
      const res = resources.find((r) => r.id === c.resourceId);
      if (!res) return s;
      const qte = (Number(c.quantityPerUnit) || 0) * (1 + (Number(c.wastageRate) || 0) / 100);
      return s + qte * Number(res.unitPrice);
    }, 0);
  }, [editing, resources]);

  const addComponent = () => editing && setEditing({ ...editing, components: [...editing.components, { resourceId: 0, quantityPerUnit: '0', wastageRate: '0' }] });
  const setComponent = (i: number, patch: Partial<ComponentRow>) => editing && setEditing({ ...editing, components: editing.components.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const removeComponent = (i: number) => editing && setEditing({ ...editing, components: editing.components.filter((_, idx) => idx !== i) });

  const onSave = async () => {
    if (!editing || !editing.code.trim() || !editing.designation.trim() || !editing.unit.trim() || !editing.lotId) return;
    const payload = {
      code: editing.code.trim(), lotId: Number(editing.lotId), designation: editing.designation.trim(), unit: editing.unit.trim(),
      formulaCode: editing.formulaCode || null, fixedQuantity: editing.fixedQuantity ? Number(editing.fixedQuantity) : null,
      quantityMultiplier: Number(editing.quantityMultiplier) || 1, percentOfTotalPct: editing.percentOfTotalPct ? Number(editing.percentOfTotalPct) : null,
      isActive: editing.isActive,
      components: editing.components.filter((c) => c.resourceId > 0).map((c) => ({ resourceId: c.resourceId, quantityPerUnit: Number(c.quantityPerUnit) || 0, wastageRate: Number(c.wastageRate) || 0 })),
    };
    const r = await save.mutateAsync({ id: editing.id, payload });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select value={lotFilter} onChange={(e) => setLotFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Tous les lots</option>
          {lots.map((l: any) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        {!editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvel ouvrage</Button>}
      </div>

      {editing && (
        <Card className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier l’ouvrage' : 'Nouvel ouvrage'}</h3>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Code *" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="MAC.MUR.AGGLO15" />
            <Select label="Lot *" options={lots.map((l: any) => ({ value: String(l.id), label: l.label }))} value={editing.lotId} onChange={(e) => setEditing({ ...editing, lotId: e.target.value })} />
            <div className="col-span-2"><Input label="Désignation *" value={editing.designation} onChange={(e) => setEditing({ ...editing, designation: e.target.value })} /></div>
            <Input label="Unité *" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} placeholder="m², m³, u…" />
            <SearchSelect label="Formule (quantité)" options={FORMULA_CATALOG.map((f) => ({ value: f.code, label: `${f.label} (${f.code})` }))} value={editing.formulaCode}
              onChange={(v) => setEditing({ ...editing, formulaCode: v })} placeholder="Aucune (quantité fixe)" />
            <Input label="Quantité fixe (si pas de formule)" type="number" value={editing.fixedQuantity} onChange={(e) => setEditing({ ...editing, fixedQuantity: e.target.value })} />
            <Input label="Multiplicateur" type="number" step="0.01" value={editing.quantityMultiplier} onChange={(e) => setEditing({ ...editing, quantityMultiplier: e.target.value })} />
            <Input label="% du total des autres lots (forfait)" type="number" value={editing.percentOfTotalPct} onChange={(e) => setEditing({ ...editing, percentOfTotalPct: e.target.value })} helper="Ex: installation de chantier, nettoyage" />
          </div>

          {!editing.percentOfTotalPct && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-slate-700">Recette (déboursé sec = {formatCurrency(deboursSec)}{editing.unit ? `/${editing.unit}` : ''})</h4>
                <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={addComponent}>Ajouter une ressource</Button>
              </div>
              <div className="space-y-2">
                {editing.components.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1"><SearchSelect options={resourceOptions} value={c.resourceId ? String(c.resourceId) : ''} onChange={(v) => setComponent(i, { resourceId: Number(v) })} placeholder="Ressource…" /></div>
                    <Input className="w-32" type="number" step="0.00001" placeholder="Qté/unité" value={c.quantityPerUnit} onChange={(e) => setComponent(i, { quantityPerUnit: e.target.value })} />
                    <Input className="w-28" type="number" step="0.1" placeholder="Pertes %" value={c.wastageRate} onChange={(e) => setComponent(i, { wastageRate: e.target.value })} />
                    <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => removeComponent(i)} />
                  </div>
                ))}
                {editing.components.length === 0 && <p className="text-xs text-slate-400">Aucune ressource — le déboursé sec sera nul.</p>}
              </div>
            </div>
          )}

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
        ) : workItems.length === 0 ? (
          <EmptyState title="Aucun ouvrage" description="Constituez la bibliothèque d’ouvrages." action={{ label: 'Nouvel ouvrage', onClick: startNew }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Désignation</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Lot</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Unité</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Formule</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Composants</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workItems.map((wi) => (
                <tr key={wi.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{wi.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{wi.designation}</td>
                  <td className="px-4 py-3 text-slate-500">{wi.lot?.label}</td>
                  <td className="px-4 py-3 text-slate-500">{wi.unit}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs" title={wi.formulaCode ?? undefined}>
                    {wi.formulaCode
                      ? (FORMULA_CATALOG.find((f) => f.code === wi.formulaCode)?.label ?? wi.formulaCode)
                      : (wi.percentOfTotalPct ? `${Number(wi.percentOfTotalPct)}% forfait` : '—')}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{wi._count?.components ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => duplicate.mutate(wi.id)} />
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(wi)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(wi)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog open={!!toDelete} title="Supprimer l’ouvrage" message={`Supprimer « ${toDelete?.designation ?? ''} » ?`} onConfirm={handleDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}
