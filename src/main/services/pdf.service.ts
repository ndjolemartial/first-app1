import { BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Convertit un document HTML en PDF via le moteur de rendu Electron.
 *
 * @param html      Document HTML complet à imprimer.
 * @param options   `landscape` : orientation paysage (défaut : portrait).
 */
export async function htmlToPdf(
  html: string,
  options: { landscape?: boolean } = {},
): Promise<Buffer> {
  const tmpFile = path.join(
    app.getPath('temp'),
    `afrikimmo-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`,
  );
  fs.writeFileSync(tmpFile, html, 'utf-8');
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
  try {
    await win.loadFile(tmpFile);
    return await win.webContents.printToPDF({
      landscape: options.landscape ?? false,
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
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
