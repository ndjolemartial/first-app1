"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openPrintPreview = openPrintPreview;
exports.htmlToPdf = htmlToPdf;
exports.htmlToPdfWithTemplates = htmlToPdfWithTemplates;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * Ouvre un aperçu avant impression d'un PDF déjà généré, sans le télécharger.
 *
 * Le document est écrit dans un fichier temporaire puis affiché dans une
 * fenêtre dédiée s'appuyant sur le visualiseur PDF intégré de Chromium
 * (`plugins: true`). Ce visualiseur fournit nativement :
 *   - un aperçu fidèle page par page ;
 *   - un bouton « Imprimer » ouvrant la boîte de dialogue système (imprimante
 *     par défaut du poste présélectionnée, choix d'une autre imprimante,
 *     nombre de copies, recto-verso…) et lançant l'impression directe ;
 *   - un bouton « Enregistrer » optionnel (le téléchargement n'est plus imposé).
 *
 * Le fichier temporaire est supprimé à la fermeture de la fenêtre.
 */
async function openPrintPreview(pdf, title) {
    const tmpFile = path_1.default.join(electron_1.app.getPath('temp'), `afrikimmo-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`);
    fs_1.default.writeFileSync(tmpFile, pdf);
    const parent = electron_1.BrowserWindow.getFocusedWindow() ?? undefined;
    const win = new electron_1.BrowserWindow({
        width: 900,
        height: 1000,
        title,
        parent,
        autoHideMenuBar: true,
        webPreferences: { plugins: true },
    });
    win.setMenuBarVisibility(false);
    win.on('closed', () => {
        try {
            fs_1.default.unlinkSync(tmpFile);
        }
        catch {
            /* fichier temporaire déjà supprimé */
        }
    });
    await win.loadFile(tmpFile);
    // Le visualiseur PDF peut écraser le titre — on le repositionne.
    win.setTitle(title);
}
/** Pied de page injecté par Chromium : « Page X / Y » centré, en bas à droite. */
const PAGE_NUMBER_FOOTER = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 8pt; color: #64748b;
              width: 100%; padding: 0 10mm; text-align: right;">
    Page <span class="pageNumber"></span> / <span class="totalPages"></span>
  </div>`;
/**
 * Convertit un document HTML en PDF via le moteur de rendu Electron.
 *
 * Active par défaut la numérotation de page (« Page X / Y » en bas à droite)
 * via le mécanisme natif Chromium `displayHeaderFooter`. La marge basse est
 * portée à 14 mm pour laisser de la place au pied de page.
 *
 * @param html      Document HTML complet à imprimer.
 * @param options   `landscape` : orientation paysage (défaut : portrait).
 *                  `pageNumbers` : afficher « Page X / Y » (défaut : true).
 *                  `margins` : surcharge ponctuelle des marges (in), fusionnée
 *                  avec les marges par défaut — n'affecte que l'appel courant.
 */
async function htmlToPdf(html, options = {}) {
    const tmpFile = path_1.default.join(electron_1.app.getPath('temp'), `afrikimmo-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
    fs_1.default.writeFileSync(tmpFile, html, 'utf-8');
    const win = new electron_1.BrowserWindow({ show: false, webPreferences: { sandbox: false } });
    try {
        await win.loadFile(tmpFile);
        const withPageNumbers = options.pageNumbers ?? true;
        // Marge basse renforcée par défaut (0.55 in ≈ 14 mm) pour le pied de page de numérotation.
        const defaultMargins = { top: 0.4, bottom: withPageNumbers ? 0.55 : 0.4, left: 0.4, right: 0.4 };
        return await win.webContents.printToPDF({
            landscape: options.landscape ?? false,
            printBackground: true,
            pageSize: 'A4',
            margins: { ...defaultMargins, ...options.margins },
            displayHeaderFooter: withPageNumbers,
            headerTemplate: '<span></span>',
            footerTemplate: withPageNumbers ? PAGE_NUMBER_FOOTER : '<span></span>',
        });
    }
    finally {
        win.destroy();
        try {
            fs_1.default.unlinkSync(tmpFile);
        }
        catch {
            /* fichier temporaire déjà supprimé */
        }
    }
}
/**
 * Convertit un document HTML en PDF avec en-tête et pied de page enrichis,
 * rendus par Chromium dans les marges de **chaque** page (y compris la
 * dernière). Utilise le mécanisme natif `displayHeaderFooter` de
 * `webContents.printToPDF` : les templates HTML sont automatiquement répétés.
 *
 * Les balises `<span class="pageNumber"></span>` et `<span class="totalPages">`
 * sont auto-remplies par Chromium avec le numéro de page courant et le total.
 *
 * @param bodyHtml         Le contenu HTML du corps (sans header / footer).
 * @param headerTemplate   HTML du bandeau d'en-tête (avec ses styles inline).
 * @param footerTemplate   HTML du pied de page (avec ses styles inline).
 * @param headerMm         Hauteur de l'en-tête en mm (pour calculer la marge haute).
 * @param footerMm         Hauteur du pied de page en mm (pour la marge basse).
 */
async function htmlToPdfWithTemplates(bodyHtml, headerTemplate, footerTemplate, headerMm, footerMm, marginsMm) {
    // Document HTML autonome contenant uniquement le corps (les en-tête /
    // pied de page sont gérés par les templates Chromium).
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5pt; color: #1e293b; line-height: 1.55; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 17pt; margin: 8pt 0; }
h2 { font-size: 13.5pt; margin: 8pt 0; }
p { margin: 5pt 0; }
img { max-width: 100%; height: auto; }
ul { list-style: disc; padding-left: 20pt; }
ol { list-style: decimal; padding-left: 20pt; }
</style></head><body>${bodyHtml}</body></html>`;
    const tmpFile = path_1.default.join(electron_1.app.getPath('temp'), `afrikimmo-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
    fs_1.default.writeFileSync(tmpFile, html, 'utf-8');
    const win = new electron_1.BrowserWindow({ show: false, webPreferences: { sandbox: false } });
    try {
        await win.loadFile(tmpFile);
        // Conversion mm → inches (Electron attend les marges en inches).
        const mmToIn = (mm) => mm / 25.4;
        // Marges explicites si fournies (ex. devis : 25 mm sur les 4 côtés), sinon
        // marge sup. = hauteur en-tête + 12 mm, marge inf. = hauteur pied + 12 mm,
        // marges latérales = 18 mm.
        const margins = marginsMm
            ? {
                top: mmToIn(marginsMm.top),
                bottom: mmToIn(marginsMm.bottom),
                left: mmToIn(marginsMm.left),
                right: mmToIn(marginsMm.right),
            }
            : {
                top: mmToIn(headerMm + 12),
                bottom: mmToIn(footerMm + 12),
                left: mmToIn(18),
                right: mmToIn(18),
            };
        return await win.webContents.printToPDF({
            landscape: false,
            printBackground: true,
            pageSize: 'A4',
            displayHeaderFooter: true,
            margins,
            headerTemplate,
            footerTemplate,
        });
    }
    finally {
        win.destroy();
        try {
            fs_1.default.unlinkSync(tmpFile);
        }
        catch {
            /* fichier temporaire déjà supprimé */
        }
    }
}
