"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlToDocxWithTemplates = htmlToDocxWithTemplates;
const html_to_docx_1 = __importDefault(require("html-to-docx"));
/**
 * Conversion mm → twips. Le format DOCX exprime les longueurs en twips
 * (1 inch = 1440 twips ; 1 mm ≈ 56.7 twips).
 */
const mmToTwips = (mm) => Math.round(mm * 56.6929);
/**
 * Génère un fichier .docx à partir d'un corps HTML et de templates d'en-tête
 * et de pied de page (rendus sur chaque page par Word). Les marges sont
 * calibrées sur la hauteur du header / footer fournis (mm) avec 12 mm de
 * respiration.
 *
 * @param bodyHtml      Le contenu HTML du corps (sans header / footer).
 * @param headerHtml    HTML de l'en-tête (rendu sur chaque page).
 * @param footerHtml    HTML du pied de page (rendu sur chaque page).
 * @param headerMm      Hauteur en mm de l'en-tête (pour le calcul des marges).
 * @param footerMm      Hauteur en mm du pied de page.
 */
async function htmlToDocxWithTemplates(bodyHtml, headerHtml, footerHtml, headerMm, footerMm) {
    // Document HTML autonome contenant uniquement le corps.
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${bodyHtml}</body></html>`;
    // Marges en twips. Top/bottom incluent la hauteur du header/footer + 12 mm.
    // `gutter: 0` est obligatoire : sans cette valeur, html-to-docx écrit la
    // chaîne "undefined" dans l'attribut w:gutter du XML, ce qui rend le .docx
    // invalide pour Word (« Word a rencontré une erreur lors de l'ouverture »).
    const margins = {
        top: mmToTwips(headerMm + 12),
        bottom: mmToTwips(footerMm + 12),
        left: mmToTwips(18),
        right: mmToTwips(18),
        header: mmToTwips(6),
        footer: mmToTwips(6),
        gutter: 0,
    };
    return await (0, html_to_docx_1.default)(html, headerHtml || null, {
        orientation: 'portrait',
        pageSize: { width: mmToTwips(210), height: mmToTwips(297) }, // A4
        margins,
        header: !!headerHtml,
        footer: !!footerHtml,
        pageNumber: false, // déjà inséré dans le footerHtml via {{PAGE}} si besoin
        table: { row: { cantSplit: true } },
        font: 'Segoe UI',
        fontSize: 22, // half-points (22 = 11pt)
    }, footerHtml || null);
}
