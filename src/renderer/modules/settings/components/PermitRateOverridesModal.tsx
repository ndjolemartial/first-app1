import { useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { usePermitRateOverrides, useSavePermitRateOverride, useDeletePermitRateOverride } from '../../permits/hooks/usePermitLibrary';
import { usePermitCommunes } from '../../permits/hooks/usePermitLibrary';
import { NATURE_LABELS, STANDING_LABELS, toOptions } from '../../permits/utils/permitLabels';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Surcharges de taux (`PermitFeeRateOverride`) d'une prestation du
 * catalogue — la combinaison la plus spécifique (nature + standing +
 * commune) l'emporte sur `defaultValue` au calcul (`permit-engine.service.ts`
 * → `resolveRate`). Chaque dimension est optionnelle.
 */
export default function PermitRateOverridesModal({ open, onClose, feeItem }: { open: boolean; onClose: () => void; feeItem: any }) {
  const { data } = usePermitRateOverrides(feeItem?.id ?? 0);
  const { data: communesRes } = usePermitCommunes();
  const save = useSavePermitRateOverride();
  const del = useDeletePermitRateOverride();
  const overrides: any[] = data?.data ?? [];
  const communeOptions = (communesRes?.data ?? []).map((c: any) => ({ value: String(c.id), label: c.nom }));

  const [nature, setNature] = useState('');
  const [standing, setStanding] = useState('');
  const [communeId, setCommuneId] = useState('');
  const [value, setValue] = useState('');
  const [toDelete, setToDelete] = useState<any>(null);

  const onAdd = async () => {
    if (!value) return;
    const r = await save.mutateAsync({
      payload: { feeItemId: feeItem.id, nature: nature || null, standing: standing || null, communeId: communeId ? Number(communeId) : null, value: Number(value) },
    });
    if (r.success) { setNature(''); setStanding(''); setCommuneId(''); setValue(''); }
  };

  if (!feeItem) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Surcharges de taux — ${feeItem.label}`} size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Valeur par défaut du catalogue : <strong>{Number(feeItem.defaultValue)}</strong>{feeItem.unit ? ` ${feeItem.unit}` : ''}.
          Chaque surcharge ci-dessous ne s'applique que si toutes ses dimensions renseignées correspondent au projet ;
          la surcharge la plus spécifique (le plus de dimensions renseignées) l'emporte.
        </p>

        <div className="grid grid-cols-4 gap-2 items-end">
          <Select label="Nature" options={toOptions(NATURE_LABELS)} placeholder="Toutes" value={nature} onChange={(e) => setNature(e.target.value)} />
          <Select label="Standing" options={toOptions(STANDING_LABELS)} placeholder="Tous" value={standing} onChange={(e) => setStanding(e.target.value)} />
          <Select label="Commune" options={communeOptions} placeholder="Toutes" value={communeId} onChange={(e) => setCommuneId(e.target.value)} />
          <Input label="Valeur *" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" icon={<Plus className="h-4 w-4" />} loading={save.isPending} onClick={onAdd} disabled={!value}>Ajouter</Button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-y border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Nature</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Standing</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Commune</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Valeur</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {overrides.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Aucune surcharge — valeur par défaut appliquée dans tous les cas.</td></tr>
            ) : overrides.map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2 text-slate-600">{o.nature ? NATURE_LABELS[o.nature] : 'Toutes'}</td>
                <td className="px-3 py-2 text-slate-600">{o.standing ? STANDING_LABELS[o.standing] : 'Tous'}</td>
                <td className="px-3 py-2 text-slate-600">{o.commune?.nom ?? 'Toutes'}</td>
                <td className="px-3 py-2 text-right font-medium">{Number(o.value)}</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(o)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={!!toDelete} title="Supprimer la surcharge" message="Supprimer cette surcharge de taux ?"
        loading={del.isPending}
        onConfirm={async () => { await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)} />
    </Modal>
  );
}
