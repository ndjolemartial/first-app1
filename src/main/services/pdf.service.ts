import { BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';

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
 */
export async function htmlToPdf(
  html: string,
  options: { landscape?: boolean; pageNumbers?: boolean } = {},
): Promise<Buffer> {
  const tmpFile = path.join(
    app.getPath('temp'),
    `afrikimmo-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`,
  );
  fs.writeFileSync(tmpFile, html, 'utf-8');
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
  try {
    await win.loadFile(tmpFile);
    const withPageNumbers = options.pageNumbers ?? true;
    return await win.webContents.printToPDF({
      landscape: options.landscape ?? false,
      printBackground: true,
      pageSize: 'A4',
      // Marge basse renforcée (0.55 in ≈ 14 mm) pour le pied de page de numérotation.
      margins: { top: 0.4, bottom: withPageNumbers ? 0.55 : 0.4, left: 0.4, right: 0.4 },
      displayHeaderFooter: withPageNumbers,
      headerTemplate: '<span></span>',
      footerTemplate: withPageNumbers ? PAGE_NUMBER_FOOTER : '<span></span>',
    });
  } finally {
    win.destroy();
    try {
      fs.unlinkSync(tmpFile);
    } catch {
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
export async function htmlToPdfWithTemplates(
  bodyHtml: string,
  headerTemplate: string,
  footerTemplate: string,
  headerMm: number,
  footerMm: number,
): Promise<Buffer> {
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

  const tmpFile = path.join(
    app.getPath('temp'),
    `afrikimmo-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`,
  );
  fs.writeFileSync(tmpFile, html, 'utf-8');

  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
  try {
    await win.loadFile(tmpFile);
    // Conversion mm → inches (Electron attend les marges en inches).
    const mmToIn = (mm: number): number => mm / 25.4;
    // Marge = hauteur du bandeau + 10 mm de respiration (5 mm de chaque côté).
    // Marge sup. = hauteur en-tête + 12 mm de respiration (8 mm avant + 4 mm après).
    // Marge inf. = hauteur pied + 12 mm.
    return await win.webContents.printToPDF({
      landscape: false,
      printBackground: true,
      pageSize: 'A4',
      displayHeaderFooter: true,
      margins: {
        top: mmToIn(headerMm + 12),
        bottom: mmToIn(footerMm + 12),
        left: mmToIn(18),
        right: mmToIn(18),
      },
      headerTemplate,
      footerTemplate,
    });
  } finally {
    win.destroy();
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* fichier temporaire déjà supprimé */
    }
  }
}
