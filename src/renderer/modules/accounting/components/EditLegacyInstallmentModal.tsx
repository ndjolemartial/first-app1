import { useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import { toast } from '../../../shared/components/ui/Toast';
import { formatCurrency } from '../../../shared/utils/format';
import { useUpdateLegacyInstallment } from '../hooks/useAccounting';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { Search, X, Plus } from 'lucide-react';

interface Props {
  installment: any;
  onClose: () => void;
}

/** Date ISO/serialisée → valeur yyyy-mm-dd pour un <input type="date">. */
function toDateInput(v: any): string {
  if (!v) return '';
  return String(v).slice(0, 10);
}

/**
 * Édition d'une échéance héritée : détails de souscription, date, montant et
 * rattachement d'un ou plusieurs terrains. Les frais de démarches ACD des
 * terrains rattachés constituent l'assiette de la commission ACD.
 */
export default function EditLegacyInstallmentModal({ installment, onClose }: Props) {
  const updateInstallment = useUpdateLegacyInstallment();
  const [detailsSouscription, setDetailsSouscription] = useState<string>(installment.detailsSouscription ?? '');
  const [dueDate, setDueDate] = useState<string>(toDateInput(installment.dueDate));
  const [amount, setAmount] = useState<string>(String(Number(installment.amount)));
  const [search, setSearch] = useState('');
  // Terrains rattachés (initialisés depuis les liaisons existantes).
  const [selected, setSelected] = useState<any[]>(
    (installment.terrainLinks ?? []).map((l: any) => l.terrain).filter(Boolean),
  );

  // Les échéances héritées portent sur des terrains déjà affectés au client :
  // par défaut, on propose les terrains attribués au client de l'échéance. Une
  // recherche libre permet d'élargir à l'ensemble des terrains si besoin.
  const terrainFilters = search.trim()
    ? { search: search.trim() }
    : (installment.clientId ? { clientId: installment.clientId } : {});
  const { data: terrainsRes, isLoading: terrainsLoading } = useTerrains(terrainFilters, 1, 50);
  const results = (terrainsRes?.data ?? []).filter((t: any) => !selected.some((s) => s.id === t.id));

  const acdTotal = selected.reduce((s, t) => s + Number(t.acdDemarchesAmount ?? 0), 0);

  const addTerrain = (t: any) => setSelected((prev) => (prev.some((p) => p.id === t.id) ? prev : [...prev, t]));
  const removeTerrain = (id: number) => setSelected((prev) => prev.filter((t) => t.id !== id));

  const onSubmit = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error('Montant invalide'); return; }
    if (!dueDate) { toast.error("Date d'échéance requise"); return; }
    const r = await updateInstallment.mutateAsync({
      installmentId: installment.id,
      detailsSouscription: detailsSouscription.trim() || null,
      dueDate,
      amount: amt,
      terrainIds: selected.map((t) => t.id),
    });
    if (r.success) {
      toast.success('Échéance mise à jour');
      onClose();
    } else {
      toast.error(typeof r.error === 'string' ? r.error : "Échec de la mise à jour de l'échéance");
    }
  };

  const terrainLabel = (t: any) =>
    `${t.reference}${t.lotissement?.nom ? ` · ${t.lotissement.nom}` : ''}${(t.numeroIlot || t.numeroParcelle) ? ` (îlot ${t.numeroIlot ?? '—'} / parc. ${t.numeroParcelle ?? '—'})` : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Modifier l'échéance héritée</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Détails de souscription</label>
            <textarea
              rows={2}
              value={detailsSouscription}
              onChange={(e) => setDetailsSouscription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date d'échéance</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Montant (FCFA)</label>
              <input
                type="number" step="1" min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Terrains rattachés */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Terrains rattachés</label>

            {selected.length === 0 ? (
              <p className="text-xs text-slate-400 mb-2">Aucun terrain rattaché.</p>
            ) : (
              <ul className="mb-2 divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {selected.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-slate-700">{terrainLabel(t)}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-500">
                        ACD&nbsp;: {Number(t.acdDemarchesAmount ?? 0) > 0 ? formatCurrency(Number(t.acdDemarchesAmount)) : '—'}
                      </span>
                      <button onClick={() => removeTerrain(t.id)} className="text-slate-400 hover:text-red-600" title="Retirer">
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Total ACD */}
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-500">Assiette frais de démarches ACD (somme)</span>
              <span className="font-semibold text-slate-800">{formatCurrency(acdTotal)}</span>
            </div>

            {/* Recherche / ajout de terrains */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un terrain (référence, îlot, parcelle…)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {terrainsLoading ? (
                <p className="p-3 text-xs text-slate-400">Chargement…</p>
              ) : results.length === 0 ? (
                <p className="p-3 text-xs text-slate-400">Aucun terrain à ajouter.</p>
              ) : (
                results.map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addTerrain(t)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-50"
                  >
                    <span className="text-slate-700">{terrainLabel(t)}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      {Number(t.acdDemarchesAmount ?? 0) > 0 && <span>ACD {formatCurrency(Number(t.acdDemarchesAmount))}</span>}
                      <Plus className="h-4 w-4 text-indigo-600" />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={onSubmit} loading={updateInstallment.isPending}>Enregistrer</Button>
        </div>
      </div>
    </div>
  );
}
