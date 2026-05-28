/**
 * Couleur de fond du pied de page d'un modèle de convention ou d'attestation.
 *
 * Stockage en base :
 *   - `null` / `undefined` ⇒ valeur par défaut historique (`#dc2626`, rouge).
 *   - `'transparent'`       ⇒ aucun fond (texte rendu en sombre).
 *   - `'#rrggbb'`           ⇒ couleur personnalisée (hex 6 caractères).
 */

export const DEFAULT_FOOTER_BG = '#dc2626';
export const TRANSPARENT_FOOTER = 'transparent';

/** Palette proposée dans le sélecteur de couleur. */
export const FOOTER_BG_PRESETS: { value: string; label: string }[] = [
  { value: '#dc2626', label: 'Rouge' },
  { value: '#1E3A5F', label: 'Bleu ardoise' },
  { value: '#2563EB', label: 'Bleu' },
  { value: '#0F766E', label: 'Sarcelle' },
  { value: '#15803D', label: 'Vert' },
  { value: '#CA8A04', label: 'Ambre' },
  { value: '#7C3AED', label: 'Violet' },
  { value: '#334155', label: 'Ardoise' },
  { value: '#111827', label: 'Noir' },
];

/** Couleur effective utilisée pour le rendu (résout `null` ⇒ rouge par défaut). */
export function resolveFooterBg(value?: string | null): string {
  if (value === undefined || value === null || value === '') return DEFAULT_FOOTER_BG;
  return value;
}

/** Vrai si la valeur correspond à un fond transparent (aucune couleur). */
export function isTransparentFooter(value?: string | null): boolean {
  return value === TRANSPARENT_FOOTER;
}

/**
 * Couleur du texte adaptée à la couleur de fond : blanc sur fond sombre,
 * gris ardoise sombre sur fond clair ou transparent (luminance Rec. 709).
 */
export function footerTextColor(bg?: string | null): string {
  if (isTransparentFooter(bg)) return '#1e293b';
  const hex = (bg && bg.startsWith('#') ? bg : DEFAULT_FOOTER_BG).slice(1);
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? '#1e293b' : '#ffffff';
}
