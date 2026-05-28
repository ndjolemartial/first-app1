import { Ban } from 'lucide-react';
import {
  DEFAULT_FOOTER_BG, FOOTER_BG_PRESETS, TRANSPARENT_FOOTER, isTransparentFooter, resolveFooterBg,
} from '../utils/footerColor';

interface Props {
  /** Valeur stockée : `null`/`undefined` (défaut), `'transparent'` ou hex `#rrggbb`. */
  value: string | null | undefined;
  onChange: (next: string | null) => void;
}

/**
 * Sélecteur de couleur de fond pour le pied de page des modèles.
 * Propose une palette, un sélecteur libre et un bouton "Aucune couleur".
 */
export default function FooterColorPicker({ value, onChange }: Props) {
  const effective = resolveFooterBg(value);
  const transparent = isTransparentFooter(value);
  const isCustom = !transparent && !FOOTER_BG_PRESETS.some((p) => p.value.toLowerCase() === effective.toLowerCase());

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => onChange(TRANSPARENT_FOOTER)}
        className={`flex items-center gap-1 h-7 px-2 rounded border text-xs transition
          ${transparent ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
        title="Aucune couleur de fond"
      >
        <Ban className="h-3 w-3" /> Aucune
      </button>
      {FOOTER_BG_PRESETS.map((p) => {
        const active = !transparent && effective.toLowerCase() === p.value.toLowerCase();
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={`h-7 w-7 rounded border transition ${active ? 'ring-2 ring-offset-1 ring-blue-600 border-blue-600' : 'border-slate-300 hover:scale-110'}`}
            style={{ backgroundColor: p.value }}
            title={p.label}
            aria-label={p.label}
          />
        );
      })}
      <label
        className={`relative flex items-center gap-1 h-7 px-2 rounded border text-xs cursor-pointer transition
          ${isCustom ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
        title="Couleur personnalisée"
      >
        <span
          className="h-3 w-3 rounded-sm border border-slate-300"
          style={{ backgroundColor: transparent ? '#ffffff' : effective }}
        />
        Perso
        {/* L'input recouvre le label (opacity 0) pour que le sélecteur natif
            de Chromium s'ancre sur la position visible du bouton. */}
        <input
          type="color"
          value={transparent ? DEFAULT_FOOTER_BG : effective}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Couleur personnalisée"
        />
      </label>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="ml-1 text-xs text-slate-500 hover:text-slate-700 underline"
        title="Restaurer la couleur par défaut (rouge)"
      >
        Par défaut
      </button>
    </div>
  );
}
