import { useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { usePermitFeeItems, useSavePermitFeeItem, useDeletePermitFeeItem } from '../../permits/hooks/usePermitLibrary';
import { FEE_CATEGORY_LABELS, CALC_MODE_LABELS, MISSION_PHASE_LABELS, toOptions } from '../../permits/utils/permitLabels';
import PermitRateOverridesModal from './PermitRateOverridesModal';
import PermitSurfaceBracketsModal from './PermitSurfaceBracketsModal';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Edit, Trash2, Save, X, Percent, ListTree } from 'lucide-react';

interface EditState {
  id?: number; code: string; category: string; label: string; description: string;
  calcMode: string; missionPhase: string; defaultValue: string; unit: string; sortOrder: string; isActive: boolean;
}
/** Écriture : SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT (même liste que côté IPC, `checkLibExtendedWrite` dans `permit-library.ipc.ts` — mêmes règles d'accès que le module Devis construction). */
const LIB_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

const EMPTY: EditState = {
  code: '', category: 'ARCHITECTE', label: '', description: '', calcMode: 'POURCENTAGE_COUT_TRAVAUX',
  missionPhase: '', defaultValue: '0', unit: '', sortOrder: '0', isActive: true,
};

/**
 * Catalogue de prestations/frais/taxes du moteur de devis de permis de
 * construire (Module 18) — honoraires architecte (par phase de mission),
 * BET, géomètre, études, frais administratifs, taxes. `defaultValue`
 * s'interprète selon `calcMode` : % du coût des travaux, forfait, FCFA/m²
 * (terrain ou bâti), ou barème par tranche de surface (géré depuis la
 * fenêtre « Tranches »). Les surcharges par nature/standing/commune se
 * gèrent depuis la fenêtre « Surcharges de taux ».
 *
 * L'automatisation intelligente (ex. « ajouter Contrôle technique si R+4 et
 * plus ») se pilote via le champ `applicabilityRule` de chaque prestation —
 * réservé au seed/paramétrage développeur (même principe que les ouvrages du
 * Module 17, non exposé dans cette interface).
 */
export default function PermitFeeItemsSettingsTab() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const { data, isLoading } = usePermitFeeItems(categoryFilter ? { category: categoryFilter, includeInactive: true } : { includeInactive: true });
  const save = useSavePermitFeeItem();
  const del = useDeletePermitFeeItem();
  const items: any[] = data?.data ?? [];

  const role = useAuthStore((s) => s.user?.role);
  const canWrite = !!role && LIB_ADMIN_ROLES.includes(role);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [overridesFor, setOverridesFor] = useState<any>(null);
  const [bracketsFor, setBracketsFor] = useState<any>(null);

  const startNew = () => setEditing({ ...EMPTY });
  const startEdit = (it: any) => setEditing({
    id: it.id, code: it.code, category: it.category, label: it.label, description: it.description ?? '',
    calcMode: it.calcMode, missionPhase: it.missionPhase ?? '', defaultValue: String(Number(it.defaultValue)),
    unit: it.unit ?? '', sortOrder: String(it.sortOrder), isActive: it.isActive,
  });

  const onSave = async () => {
    if (!editing || !editing.code.trim() || !editing.label.trim()) return;
    const r = await save.mutateAsync({
      id: editing.id,
      payload: {
        code: editing.code.trim(), category: editing.category, label: editing.label.trim(),
        description: editing.description || null, calcMode: editing.calcMode,
        missionPhase: editing.category === 'ARCHITECTE' && editing.missionPhase ? editing.missionPhase : null,
        defaultValue: Number(editing.defaultValue) || 0, unit: editing.unit || null,
        sortOrder: Number(editing.sortOrder) || 0, isActive: editing.isActive,
      },
    });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select options={[{ value: '', label: 'Toutes catégories' }, ...toOptions(FEE_CATEGORY_LABELS)]} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-96" />
        <div className="flex-1" />
        {canWrite && !editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle prestation</Button>}
      </div>

      {canWrite && editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier la prestation' : 'Nouvelle prestation'}</h3>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Code *" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="Ex: ARCH_APS" />
            <div className="col-span-2">
              <Input label="Libellé *" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Ex: Honoraires — Avant-Projet Sommaire" />
            </div>
            <Select label="Catégorie" options={toOptions(FEE_CATEGORY_LABELS)} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
            {editing.category === 'ARCHITECTE' && (
              <Select label="Phase de mission" options={toOptions(MISSION_PHASE_LABELS)} placeholder="Toutes phases" value={editing.missionPhase} onChange={(e) => setEditing({ ...editing, missionPhase: e.target.value })} />
            )}
            <Select label="Mode de calcul" options={toOptions(CALC_MODE_LABELS)} value={editing.calcMode} onChange={(e) => setEditing({ ...editing, calcMode: e.target.value })} />
            <Input label="Valeur par défaut *" type="number" min={0} value={editing.defaultValue} onChange={(e) => setEditing({ ...editing, defaultValue: e.target.value })}
              helper={editing.calcMode === 'POURCENTAGE_COUT_TRAVAUX' ? '% du coût des travaux' : editing.calcMode === 'BAREME_SURFACE' ? 'Sans effet — géré par tranche' : 'FCFA'} />
            <Input label="Unité (affichage)" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} placeholder="Ex: % ou FCFA/m²" />
            <Input label="Ordre d'affichage" type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })} />
          </div>
          <Textarea label="Description" rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
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
          <div className="p-6"><SkeletonTable rows={10} /></div>
        ) : items.length === 0 ? (
          <EmptyState title="Aucune prestation" description="Créez les prestations du catalogue." action={canWrite ? { label: 'Nouvelle prestation', onClick: startNew } : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Prestation</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Catégorie</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Mode de calcul</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Valeur</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{it.label}</div>
                    <div className="text-xs text-slate-400">{it.code}{it.missionPhase ? ` · ${MISSION_PHASE_LABELS[it.missionPhase]}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{FEE_CATEGORY_LABELS[it.category] ?? it.category}</td>
                  <td className="px-4 py-3 text-slate-500">{CALC_MODE_LABELS[it.calcMode] ?? it.calcMode}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{it.calcMode === 'BAREME_SURFACE' ? `${it._count?.surfaceBrackets ?? 0} tranche(s)` : `${Number(it.defaultValue)}${it.unit ? ` ${it.unit}` : ''}`}</td>
                  <td className="px-4 py-3">{it.isActive ? <Badge variant="success">Actif</Badge> : <Badge variant="default">Inactif</Badge>}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {it.calcMode === 'BAREME_SURFACE' ? (
                        <Button variant="ghost" size="sm" icon={<ListTree className="h-4 w-4" />} onClick={() => setBracketsFor(it)} title="Tranches de surface" />
                      ) : (
                        <Button variant="ghost" size="sm" icon={<Percent className="h-4 w-4" />} onClick={() => setOverridesFor(it)} title="Surcharges de taux" />
                      )}
                      {canWrite && <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(it)} />}
                      {canWrite && <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(it)} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {canWrite && (
        <ConfirmDialog open={!!toDelete} title="Supprimer la prestation" message={`Supprimer « ${toDelete?.label ?? ''} » ?`} onConfirm={handleDelete} onClose={() => setToDelete(null)} />
      )}
      <PermitRateOverridesModal open={!!overridesFor} onClose={() => setOverridesFor(null)} feeItem={overridesFor} />
      <PermitSurfaceBracketsModal open={!!bracketsFor} onClose={() => setBracketsFor(null)} feeItem={bracketsFor} />
    </div>
  );
}
