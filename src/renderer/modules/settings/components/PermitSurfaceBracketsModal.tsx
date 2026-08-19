import { useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { usePermitSurfaceBrackets, useSavePermitSurfaceBracket, useDeletePermitSurfaceBracket } from '../../permits/hooks/usePermitLibrary';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Tranches de surface (`PermitFeeSurfaceBracket`) d'une prestation en
 * `calcMode = BAREME_SURFACE` — forfait par palier de surface (terrain pour
 * la catégorie Géomètre, surface bâtie pour les autres). La tranche dont
 * `[minSurface, maxSurface]` couvre la surface du projet est appliquée
 * (`permit-engine.service.ts` → `resolveBracket`) ; `maxSurface` vide = pas
 * de plafond (dernière tranche).
 */
export default function PermitSurfaceBracketsModal({ open, onClose, feeItem }: { open: boolean; onClose: () => void; feeItem: any }) {
  const { data } = usePermitSurfaceBrackets(feeItem?.id ?? 0);
  const save = useSavePermitSurfaceBracket();
  const del = useDeletePermitSurfaceBracket();
  const brackets: any[] = (data?.data ?? []).slice().sort((a: any, b: any) => Number(a.minSurface) - Number(b.minSurface));

  const [minSurface, setMinSurface] = useState('');
  const [maxSurface, setMaxSurface] = useState('');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [toDelete, setToDelete] = useState<any>(null);

  const onAdd = async () => {
    if (minSurface === '' || !value) return;
    const r = await save.mutateAsync({
      payload: { feeItemId: feeItem.id, minSurface: Number(minSurface), maxSurface: maxSurface === '' ? null : Number(maxSurface), value: Number(value), label: label || null },
    });
    if (r.success) { setMinSurface(''); setMaxSurface(''); setValue(''); setLabel(''); }
  };

  if (!feeItem) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Tranches de surface — ${feeItem.label}`} size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-2 items-end">
          <Input label="De (m²) *" type="number" min={0} value={minSurface} onChange={(e) => setMinSurface(e.target.value)} />
          <Input label="À (m², vide = ∞)" type="number" min={0} value={maxSurface} onChange={(e) => setMaxSurface(e.target.value)} />
          <Input label="Forfait (FCFA) *" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
          <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: 0-500 m²" />
          <Button size="sm" icon={<Plus className="h-4 w-4" />} loading={save.isPending} onClick={onAdd} disabled={minSurface === '' || !value}>Ajouter</Button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-y border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Tranche</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Libellé</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Forfait</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brackets.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">Aucune tranche — cette prestation ne sera jamais chiffrée tant qu'aucune tranche n'est définie.</td></tr>
            ) : brackets.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2 text-slate-600">{Number(b.minSurface)} — {b.maxSurface != null ? Number(b.maxSurface) : '∞'} m²</td>
                <td className="px-3 py-2 text-slate-600">{b.label ?? '—'}</td>
                <td className="px-3 py-2 text-right font-medium">{Number(b.value).toLocaleString('fr-FR')} FCFA</td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(b)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={!!toDelete} title="Supprimer la tranche" message="Supprimer cette tranche de surface ?"
        loading={del.isPending}
        onConfirm={async () => { await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)} />
    </Modal>
  );
}
