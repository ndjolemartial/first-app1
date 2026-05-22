/**
 * Palettes de thèmes graphiques de l'application.
 *
 * Le même catalogue est utilisé côté main (pour styler les PDFs et exports
 * Excel) et côté renderer (CSS variables appliquées via `data-theme`). Toute
 * mise à jour ici doit être répercutée dans `src/renderer/styles/globals.css`
 * et `src/renderer/shared/theme/themes.ts`.
 */

export type ThemeKey = 'DEFAULT' | 'AFRIKIMMO' | 'DARK_GOLD';

export interface ThemePalette {
  /** Identifiant interne. */
  key:      ThemeKey;
  /** Libellé affiché dans le sélecteur. */
  label:    string;
  /** Description courte. */
  hint:     string;
  /** Couleur dominante (en-têtes, titres). */
  primary:  string;
  /** Couleur d'accent (boutons primaires, liens). */
  accent:   string;
  /** Fond principal des pages. */
  background: string;
  /** Surface des cartes / panneaux. */
  surface:  string;
  /** Couleur de texte principal. */
  text:     string;
  /** Couleur de texte secondaire (annotations, labels). */
  textMuted: string;
  /** Couleur de bordure. */
  border:   string;
  /** Couleur d'erreur / danger. */
  danger:   string;
  /** Indique si le thème est sombre (texte clair sur fond sombre). */
  isDark:   boolean;
}

/** Catalogue des thèmes disponibles. */
export const THEMES: Record<ThemeKey, ThemePalette> = {
  DEFAULT: {
    key:        'DEFAULT',
    label:      'Par défaut',
    hint:       'Thème clair, ardoise et bleu — style actuel de l\'application.',
    primary:    '#1E3A5F',
    accent:     '#2563EB',
    background: '#F8FAFC',
    surface:    '#FFFFFF',
    text:       '#1E293B',
    textMuted:  '#64748B',
    border:     '#E2E8F0',
    danger:     '#DC2626',
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
    textMuted:  '#6B7280',
    border:     '#E5E7EB',
    danger:     '#B91C1C',
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
    textMuted:  '#9CA3AF',
    border:     '#2D2D38',
    danger:     '#B22222',
    isDark:     true,
  },
};

/** Retourne la palette d'un thème ; à défaut, la palette par défaut. */
export function getTheme(key: string | null | undefined): ThemePalette {
  if (key && key in THEMES) return THEMES[key as ThemeKey];
  return THEMES.DEFAULT;
}

/**
 * Récupère la palette du thème actif pour un utilisateur donné. Utilisé par
 * les modules d'export PDF/Excel pour appliquer les couleurs personnalisées.
 */
export async function getThemeForUser(userId: number): Promise<ThemePalette> {
  try {
    const { getDb } = await import('./db.service');
    const user = await getDb().user.findUnique({ where: { id: userId }, select: { theme: true } });
    return getTheme(user?.theme);
  } catch {
    return THEMES.DEFAULT;
  }
}

/** Convertit un hex `#RRGGBB` en argb (`FFRRGGBB`) pour ExcelJS. */
export function hexToArgb(hex: string): string {
  const h = hex.replace('#', '').toUpperCase();
  return `FF${h.length === 6 ? h : '000000'}`;
}
