/**
 * Catalogue des thèmes graphiques disponibles côté renderer.
 *
 * Les palettes effectives sont définies dans `src/renderer/styles/globals.css`
 * (CSS custom properties appliquées via `data-theme="…"` sur <html>). Cette
 * source de vérité est seulement utilisée pour le sélecteur de thème (aperçus,
 * libellés) et le typage. Les couleurs réelles sont copies du fichier CSS.
 */

export type ThemeKey = 'DEFAULT' | 'AFRIKIMMO' | 'DARK_GOLD';

export const THEME_KEYS: ThemeKey[] = ['DEFAULT', 'AFRIKIMMO', 'DARK_GOLD'];

export interface ThemePreview {
  key:        ThemeKey;
  label:      string;
  hint:       string;
  primary:    string;
  accent:     string;
  background: string;
  surface:    string;
  text:       string;
  isDark:     boolean;
}

export const THEME_PREVIEWS: Record<ThemeKey, ThemePreview> = {
  DEFAULT: {
    key:        'DEFAULT',
    label:      'Par défaut',
    hint:       'Thème clair, ardoise et bleu — style actuel de l\'application.',
    primary:    '#1E3A5F',
    accent:     '#2563EB',
    background: '#F8FAFC',
    surface:    '#FFFFFF',
    text:       '#1E293B',
    isDark:     false,
  },
  AFRIKIMMO: {
    key:        'AFRIKIMMO',
    label:      'Afrikimmo',
    hint:       'Inspiré du site afrikimmo.ci — bleu marine profond + accents rouges.',
    primary:    '#0E2A47',
    accent:     '#C8102E',
    background: '#FFFFFF',
    surface:    '#F8F9FA',
    text:       '#1F2937',
    isDark:     false,
  },
  DARK_GOLD: {
    key:        'DARK_GOLD',
    label:      'Dark Rouge',
    hint:       'Mode sombre — accents rouges.',
    primary:    '#C8102E',
    accent:     '#C8102E',
    background: '#0D0D10',
    surface:    '#1A1A20',
    text:       '#E5E5E5',
    isDark:     true,
  },
};

/** Normalise un identifiant de thème inconnu vers DEFAULT. */
export function normalizeTheme(key: string | null | undefined): ThemeKey {
  if (key === 'AFRIKIMMO' || key === 'DARK_GOLD' || key === 'DEFAULT') return key;
  return 'DEFAULT';
}

/** Clé localStorage du dernier thème utilisé, indépendante de l'auth. */
const THEME_STORAGE_KEY = 'afrikimmo-theme';

/**
 * Applique un thème sur le document : positionne `data-theme="…"` sur <html>
 * et persiste le choix en localStorage afin que la page de connexion
 * (visible avant authentification) hérite du dernier thème utilisé.
 */
export function applyTheme(key: string | null | undefined): void {
  const theme = normalizeTheme(key);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch { /* localStorage indisponible — on ignore */ }
}

/** Lit le dernier thème appliqué (depuis localStorage). À utiliser au démarrage. */
export function loadStoredTheme(): ThemeKey {
  try {
    if (typeof localStorage !== 'undefined') {
      return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
    }
  } catch { /* ignore */ }
  return 'DEFAULT';
}
