"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGeoIPC = registerGeoIPC;
const electron_1 = require("electron");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
/** Coordonnée décimale obligatoire (latitude/longitude réelles). */
const NUM = String.raw `(-?\d{1,3}\.\d+)`;
/**
 * Motifs de coordonnées rencontrés dans les liens Google Maps / OpenStreetMap,
 * par ordre de priorité (le marqueur `!3d!4d` est le plus précis).
 */
const COORD_PATTERNS = [
    new RegExp(`!3d${NUM}!4d${NUM}`),
    new RegExp(`@${NUM},${NUM}`),
    new RegExp(`[?&](?:q|query|ll|sll|center|destination|daddr|saddr|mlat[^=]*)=${NUM}[,/]\\s*${NUM}`),
    new RegExp(`/(?:search|place|dir)/${NUM},\\s*${NUM}`),
    new RegExp(`^\\s*${NUM}\\s*,\\s*${NUM}\\s*$`),
];
/**
 * Extrait la première paire de coordonnées valides trouvée dans une chaîne.
 */
function extractCoords(text) {
    for (const re of COORD_PATTERNS) {
        const m = text.match(re);
        if (!m)
            continue;
        const latitude = Number(m[1]);
        const longitude = Number(m[2]);
        if (Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180) {
            return { latitude, longitude };
        }
    }
    return null;
}
/** Tente l'extraction sur la chaîne brute puis sur sa version décodée. */
function extractAll(text) {
    const direct = extractCoords(text);
    if (direct)
        return direct;
    try {
        return extractCoords(decodeURIComponent(text));
    }
    catch {
        return null;
    }
}
/**
 * Enregistre les handlers IPC liés à la géolocalisation.
 */
function registerGeoIPC() {
    /**
     * Résout un lien de localisation (Google Maps, lien raccourci maps.app.goo.gl,
     * OpenStreetMap…) ou des coordonnées brutes en latitude/longitude décimales.
     */
    electron_1.ipcMain.handle('geo:resolveMapLink', async (_event, { token, link }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const raw = String(link ?? '').trim();
            if (!raw)
                return { success: false, error: 'Lien vide' };
            // 1. Coordonnées directes, ou URL complète contenant déjà les coordonnées
            const direct = extractAll(raw);
            if (direct)
                return { success: true, data: direct };
            // 2. Doit désormais être une URL http(s) à résoudre
            if (!/^https?:\/\//i.test(raw)) {
                return {
                    success: false,
                    error: 'Lien non reconnu — collez un lien Google Maps ou des coordonnées « latitude, longitude ».',
                };
            }
            // 3. Suivre les redirections (liens raccourcis maps.app.goo.gl / goo.gl/maps)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            let finalUrl = raw;
            let body = '';
            try {
                const res = await fetch(raw, {
                    redirect: 'follow',
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                });
                finalUrl = res.url || raw;
                body = await res.text().catch(() => '');
            }
            finally {
                clearTimeout(timeout);
            }
            // 4. Extraire les coordonnées de l'URL finale, puis du corps de la réponse
            const coords = extractAll(finalUrl) ?? extractAll(body);
            if (!coords) {
                return { success: false, error: 'Coordonnées introuvables dans ce lien.' };
            }
            logger_1.default.info(`geo:resolveMapLink résolu → ${coords.latitude}, ${coords.longitude}`);
            return { success: true, data: coords };
        }
        catch (error) {
            const reason = error?.name === 'AbortError' ? 'délai dépassé' : error?.message ?? 'erreur inconnue';
            logger_1.default.error('geo:resolveMapLink error', reason);
            return { success: false, error: `Impossible de résoudre le lien (${reason}).` };
        }
    });
}
