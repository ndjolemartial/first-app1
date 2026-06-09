import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Input from '../ui/Input';
import PriceTierEditor from './PriceTierEditor';

/** Superficies prédéfinies (m²) toujours proposées dans la grille. */
export const PREDEFINED_SURFACES = [400, 500, 600];

/** Matrice de prix : { superficie: { modalite: montant } }. */
export type SurfacePriceMatrix = Record<string, Record<string, number | ''>>;

interface Props {
  value: SurfacePriceMatrix;
  onChange: (next: SurfacePriceMatrix) => void;
}

/** Clé de superficie normalisée (entier sans décimale superflue) : 500.00 → "500". */
export const surfaceKey = (s: number | string | null | undefined): string => {
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : '';
};

/**
 * Sélectionne, dans une matrice de prix indexée par superficie, la ligne
 * correspondant à une superficie donnée — par **tranche** : superficie définie
 * la plus proche (correspondance exacte privilégiée, sinon écart absolu minimal,
 * départage vers la plus petite superficie). Ignore les lignes vides.
 */
export function nearestSurfaceRow<T extends Record<string, unknown>>(
  matrix: Record<string, T> | null | undefined,
  surface: number | string | null | undefined,
): T | null {
  if (!matrix) return null;
  const s = Number(surface);
  if (!Number.isFinite(s)) return null;
  // Candidats : superficies réellement renseignées (ligne non vide).
  const candidates = Object.keys(matrix).filter(
    (k) => Number.isFinite(Number(k)) && matrix[k] && Object.keys(matrix[k]).length > 0,
  );
  if (candidates.length === 0) return null;
  const exact = surfaceKey(s);
  if (candidates.includes(exact)) return matrix[exact];
  let bestKey = candidates[0];
  let bestDiff = Math.abs(Number(bestKey) - s);
  for (const k of candidates) {
    const diff = Math.abs(Number(k) - s);
    if (diff < bestDiff || (diff === bestDiff && Number(k) < Number(bestKey))) {
      bestDiff = diff;
      bestKey = k;
    }
  }
  return matrix[bestKey];
}

/**
 * Éditeur de grille de prix par superficie ET modalité de paiement (lotissement).
 * Affiche les superficies prédéfinies + celles déjà saisies, avec ajout/retrait
 * de superficies personnalisées. Chaque ligne réutilise PriceTierEditor.
 */
export default function SurfacePriceMatrixEditor({ value, onChange }: Props) {
  const [newSurface, setNewSurface] = useState('');

  const predefined = PREDEFINED_SURFACES.map(String);
  const customKeys = Object.keys(value)
    .filter((k) => !predefined.includes(k))
    .sort((a, b) => Number(a) - Number(b));
  const surfaces = [...predefined, ...customKeys];

  const setRow = (surf: string, row: Record<string, number | ''>) =>
    onChange({ ...value, [surf]: row });

  const addSurface = () => {
    const n = Number(newSurface);
    if (!newSurface || !Number.isFinite(n) || n <= 0) return;
    const key = String(n);
    if (!(key in value)) onChange({ ...value, [key]: {} });
    setNewSurface('');
  };

  const removeSurface = (surf: string) => {
    const next = { ...value };
    delete next[surf];
    onChange(next);
  };

  return (
    <div className="border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        Grille de prix par superficie et échéance
      </p>
      <p className="text-xs text-slate-400 mb-3">
        Définissez le prix selon la superficie du terrain et la modalité de paiement.
        Les terrains de ce lotissement héritent du prix de la superficie correspondante.
      </p>

      <div className="space-y-3">
        {surfaces.map((surf) => {
          const isCustom = !predefined.includes(surf);
          return (
            <div key={surf} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-700">Superficie {surf} m²</h4>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => removeSurface(surf)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Retirer
                  </button>
                )}
              </div>
              <PriceTierEditor
                value={value[surf] ?? {}}
                onChange={(row) => setRow(surf, row)}
                title={null}
                description={null}
                className=""
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-end gap-2 mt-3">
        <div className="w-56">
          <Input
            label="Ajouter une superficie (m²)"
            type="number"
            min="1"
            step="1"
            placeholder="Ex : 750"
            value={newSurface}
            onChange={(e) => setNewSurface(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={addSurface}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      </div>
    </div>
  );
}
