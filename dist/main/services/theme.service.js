"use strict";
/**
 * Palettes de thèmes graphiques de l'application.
 *
 * Le même catalogue est utilisé côté main (pour styler les PDFs et exports
 * Excel) et côté renderer (CSS variables appliquées via `data-theme`). Toute
 * mise à jour ici doit être répercutée dans `src/renderer/styles/globals.css`
 * et `src/renderer/shared/theme/themes.ts`.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.THEMES = void 0;
exports.getTheme = getTheme;
exports.getThemeForUser = getThemeForUser;
exports.hexToArgb = hexToArgb;
/** Catalogue des thèmes disponibles. */
exports.THEMES = {
    DEFAULT: {
        key: 'DEFAULT',
        label: 'Par défaut',
        hint: 'Thème clair, ardoise et bleu — style actuel de l\'application.',
        primary: '#1E3A5F',
        accent: '#2563EB',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        text: '#1E293B',
        textMuted: '#64748B',
        border: '#E2E8F0',
        danger: '#DC2626',
        isDark: false,
    },
    AFRIKIMMO: {
        key: 'AFRIKIMMO',
        label: 'Afrikimmo',
        hint: 'Inspiré du site afrikimmo.ci — bleu marine profond + accents rouges.',
        primary: '#0E2A47',
        accent: '#C8102E',
        background: '#FFFFFF',
        surface: '#F8F9FA',
        text: '#1F2937',
        textMuted: '#6B7280',
        border: '#E5E7EB',
        danger: '#B91C1C',
        isDark: false,
    },
    DARK_GOLD: {
        key: 'DARK_GOLD',
        label: 'Dark Rouge',
        hint: 'Mode sombre — accents rouges.',
        primary: '#C8102E',
        accent: '#C8102E',
        background: '#0D0D10',
        surface: '#1A1A20',
        text: '#E5E5E5',
        textMuted: '#9CA3AF',
        border: '#2D2D38',
        danger: '#B22222',
        isDark: true,
    },
};
/** Retourne la palette d'un thème ; à défaut, la palette par défaut. */
function getTheme(key) {
    if (key && key in exports.THEMES)
        return exports.THEMES[key];
    return exports.THEMES.DEFAULT;
}
/**
 * Récupère la palette du thème actif pour un utilisateur donné. Utilisé par
 * les modules d'export PDF/Excel pour appliquer les couleurs personnalisées.
 */
async function getThemeForUser(userId) {
    try {
        const { getDb } = await Promise.resolve().then(() => __importStar(require('./db.service')));
        const user = await getDb().user.findUnique({ where: { id: userId }, select: { theme: true } });
        return getTheme(user?.theme);
    }
    catch {
        return exports.THEMES.DEFAULT;
    }
}
/** Convertit un hex `#RRGGBB` en argb (`FFRRGGBB`) pour ExcelJS. */
function hexToArgb(hex) {
    const h = hex.replace('#', '').toUpperCase();
    return `FF${h.length === 6 ? h : '000000'}`;
}
