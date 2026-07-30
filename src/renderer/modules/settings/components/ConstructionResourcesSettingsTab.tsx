import { useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Modal from '../../../shared/components/ui/Modal';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useConstructionResources, useSaveConstructionResource, useDeleteConstructionResource, useUpdateResourcePrice,
} from '../../construction/hooks/useConstructionLibrary';
import { RESOURCE_TYPE_LABELS, toOptions } from '../../construction/utils/constructionLabels';
import { formatCurrency } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Edit, Trash2, Save, X, TrendingUp } from 'lucide-react';

interface EditState { id?: number; code: string; label: string; type: string; family: string; unit: string; quality: string; unitPrice: string; supplierName: string; isActive: boolean }
interface PriceState { id: number; label: string; unitPrice: string; source: string; note: string }
/** Écriture (Bordereau des prix) : SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT (même liste que côté IPC, `checkLibExtendedWrite` dans `construction-library.ipc.ts`). */
const LIB_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/** Bordereau des prix de base — bibliothèque de ressources du moteur de devis de construction. */
export default function ConstructionResourcesSettingsTab() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const { data, isLoading } = useConstructionResources({ includeInactive: true, search: search || undefined, type: type || undefined });
  const save = useSaveConstructionResource();
  const del = useDeleteConstructionResource();
  const updatePrice = useUpdateResourcePrice();
  const resources: any[] = data?.data ?? [];

  const role = useAuthStore((s) => s.user?.role);
  const canWrite = !!role && LIB_ADMIN_ROLES.includes(role);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [priceEdit, setPriceEdit] = useState<PriceState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ code: '', label: '', type: 'MATERIAU', family: '', unit: '', quality: '', unitPrice: '0', supplierName: '', isActive: true });
  const startEdit = (r: any) => setEditing({
    id: r.id, code: r.code, label: r.label, type: r.type, family: r.family ?? '', unit: r.unit, quality: r.quality ?? '',
    unitPrice: String(Number(r.unitPrice)), supplierName: r.supplierName ?? '', isActive: r.isActive,
  });

  const onSave = async () => {
    if (!editing || !editing.code.trim() || !editing.label.trim() || !editing.unit.trim()) return;
    const payload = {
      code: editing.code.trim(), label: editing.label.trim(), type: editing.type, family: editing.family || null,
      unit: editing.unit.trim(), quality: editing.quality || null, unitPrice: Number(editing.unitPrice) || 0,
      supplierName: editing.supplierName || null, isActive: editing.isActive,
    };
    const r = await save.mutateAsync({ id: editing.id, payload });
    if (r.success) setEditing(null);
  };

  const onSavePrice = async () => {
    if (!priceEdit) return;
    const r = await updatePrice.mutateAsync({ id: priceEdit.id, payload: { unitPrice: Number(priceEdit.unitPrice) || 0, source: priceEdit.source || 'Relevé fournisseur', note: priceEdit.note || null } });
    if (r.success) setPriceEdit(null);
  };

  const handleDelete = async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
        Les prix livrés par défaut sont des valeurs de référence indicatives du marché ivoirien qui peuvent varier au fil du temps — Mettre donc continuellement à jour ou faire des rapprochements par période.
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-3 flex-1">
          <input type="text" placeholder="Rechercher (code, libellé, famille)…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-xs px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="">Tous les types</option>
            {toOptions(RESOURCE_TYPE_LABELS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {canWrite && !editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle ressource</Button>}
      </div>

      {canWrite && editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier la ressource' : 'Nouvelle ressource'}</h3>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Code *" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="MAT.CIMENT.CPJ35" />
            <div className="col-span-2"><Input label="Libellé *" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></div>
            <Select label="Type" options={toOptions(RESOURCE_TYPE_LABELS)} value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} />
            <Input label="Famille" value={editing.family} onChange={(e) => setEditing({ ...editing, family: e.target.value })} placeholder="Ciments & liants" />
            <Input label="Unité *" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} placeholder="sac, m³, kg, u…" />
            <Input label="Qualité / marque" value={editing.quality} onChange={(e) => setEditing({ ...editing, quality: e.target.value })} />
            <Input label="Prix courant (FCFA)" type="number" value={editing.unitPrice} onChange={(e) => setEditing({ ...editing, unitPrice: e.target.value })} />
            <Input label="Fournisseur de référence" value={editing.supplierName} onChange={(e) => setEditing({ ...editing, supplierName: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="rounded border-slate-300" />
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
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : resources.length === 0 ? (
          <EmptyState title="Aucune ressource" description="Constituez le bordereau de prix de base." action={canWrite ? { label: 'Nouvelle ressource', onClick: startNew } : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Libellé</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Unité</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Prix courant</th>
                {canWrite && <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resources.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.label}
                    {r.priceIsIndicative && <Badge variant="warning" className="ml-2">indicatif</Badge>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{RESOURCE_TYPE_LABELS[r.type] ?? r.type}</td>
                  <td className="px-4 py-3 text-slate-500">{r.unit}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(Number(r.unitPrice))}</td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<TrendingUp className="h-4 w-4" />} title="Mettre à jour le prix"
                          onClick={() => setPriceEdit({ id: r.id, label: r.label, unitPrice: String(Number(r.unitPrice)), source: '', note: '' })} />
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(r)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(r)} />
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
        <Modal open={!!priceEdit} onClose={() => setPriceEdit(null)} title={`Mettre à jour le prix — ${priceEdit?.label ?? ''}`} size="sm"
          footer={<><Button variant="secondary" onClick={() => setPriceEdit(null)}>Annuler</Button><Button loading={updatePrice.isPending} onClick={onSavePrice}>Enregistrer</Button></>}
        >
          {priceEdit && (
            <div className="space-y-3">
              <Input label="Nouveau prix (FCFA)" type="number" value={priceEdit.unitPrice} onChange={(e) => setPriceEdit({ ...priceEdit, unitPrice: e.target.value })} />
              <Input label="Source" value={priceEdit.source} onChange={(e) => setPriceEdit({ ...priceEdit, source: e.target.value })} placeholder="Relevé fournisseur, facture…" />
              <Input label="Note" value={priceEdit.note} onChange={(e) => setPriceEdit({ ...priceEdit, note: e.target.value })} />
              <p className="text-xs text-slate-500">Le changement s’appliquera à toutes les prochaines générations d’estimation utilisant cette ressource — les estimations déjà générées restent inchangées.</p>
            </div>
          )}
        </Modal>
      )}

      {canWrite && (
        <ConfirmDialog open={!!toDelete} title="Supprimer la ressource" message={`Supprimer « ${toDelete?.label ?? ''} » ?`} onConfirm={handleDelete} onClose={() => setToDelete(null)} />
      )}
    </div>
  );
}
