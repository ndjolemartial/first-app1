import { useMemo, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import { FORMULA_CATALOG } from '../../construction/utils/constructionFormulasCatalog';
import { Search } from 'lucide-react';

/**
 * Référence en lecture seule de toutes les formules de calcul du moteur de
 * devis de construction (Module 17) — reflet de `construction-formulas.ts`
 * (process principal), maintenu à la main dans `constructionFormulasCatalog.ts`
 * (renderer). Aucune écriture ici : ajouter/modifier une formule se fait
 * toujours dans le code (registre `FORMULAS`), jamais depuis cet écran.
 */
export default function ConstructionFormulasSettingsTab() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FORMULA_CATALOG;
    return FORMULA_CATALOG.filter((f) =>
      f.code.toLowerCase().includes(q) || f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
  }, [search]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, typeof FORMULA_CATALOG>();
    for (const f of filtered) {
      if (!map.has(f.category)) { map.set(f.category, []); order.push(f.category); }
      map.get(f.category)!.push(f);
    }
    return order.map((category) => ({ category, items: map.get(category)! }));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Les {FORMULA_CATALOG.length} formules qui calculent la quantité de chaque ouvrage à partir des caractéristiques
        du projet (surfaces, pièces, coefficients de standing…). Référence en lecture seule — le calcul lui-même vit dans
        le code (`construction-formulas.ts`) et n'est modifiable que par un développeur.
      </p>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text" placeholder="Rechercher (code, libellé, description)…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {groups.length === 0 ? (
        <Card><p className="text-sm text-slate-400 text-center py-6">Aucune formule ne correspond à la recherche.</p></Card>
      ) : (
        groups.map((g) => (
          <Card key={g.category} className="!p-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">{g.category}</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {g.items.map((f) => (
                  <tr key={f.code} className="align-top">
                    <td className="px-4 py-3 w-56">
                      <div className="font-medium text-slate-900">{f.label}</div>
                      <div className="font-mono text-xs text-slate-400 mt-0.5">{f.code}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))
      )}
    </div>
  );
}
