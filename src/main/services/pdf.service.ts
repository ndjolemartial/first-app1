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
