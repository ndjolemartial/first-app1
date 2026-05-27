import { ipcMain, dialog, shell } from 'electron';
import fs from 'fs';
import { z } from 'zod';
import { getSession } from '../services/auth.service';
import { htmlToPdfWithTemplates } from '../services/pdf.service';
import { htmlToDocxWithTemplates } from '../services/docx.service';
import logger from '../utils/logger';

/**
 * Export PDF d'un document de convention ou d'attestation avec en-tête et
 * pied de page répétés sur chaque page (via le moteur natif Chromium
 * `displayHeaderFooter` de `printToPDF`).
 */

const payloadSchema = z.object({
  token:          z.string(),
  fileName:       z.string().min(1),
  bodyHtml:       z.string(),
  headerTemplate: z.string(),
  footerTemplate: z.string(),
  headerMm:       z.number().positive(),
  footerMm:       z.number().positive(),
});

export function registerDocumentExportIPC(): void {
  ipcMain.handle('documents:exportDocumentPdf', async (_event, payload: any) => {
    try {
      const parsed = payloadSchema.safeParse(payload);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      }
      const session = getSession(parsed.data.token);
      if (!session) return { success: false, error: 'Session expirée' };

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `${parsed.data.fileName}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return { success: true, data: { canceled: true } };

      const pdf = await htmlToPdfWithTemplates(
        parsed.data.bodyHtml,
        parsed.data.headerTemplate,
        parsed.data.footerTemplate,
        parsed.data.headerMm,
        parsed.data.footerMm,
      );
      fs.writeFileSync(filePath, pdf);
      shell.showItemInFolder(filePath);
      logger.info(`Document PDF exporté : ${filePath}`);
      return { success: true, data: { filePath, canceled: false } };
    } catch (err: any) {
      logger.error('documents:exportDocumentPdf', err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * Export Word (.docx) du même document, avec en-tête et pied de page
   * répétés sur chaque page via `html-to-docx`.
   */
  ipcMain.handle('documents:exportDocumentDocx', async (_event, payload: any) => {
    try {
      const parsed = payloadSchema.safeParse(payload);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      }
      const session = getSession(parsed.data.token);
      if (!session) return { success: false, error: 'Session expirée' };

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `${parsed.data.fileName}.docx`,
        filters: [{ name: 'Word', extensions: ['docx'] }],
      });
      if (canceled || !filePath) return { success: true, data: { canceled: true } };

      const docx = await htmlToDocxWithTemplates(
        parsed.data.bodyHtml,
        parsed.data.headerTemplate,
        parsed.data.footerTemplate,
        parsed.data.headerMm,
        parsed.data.footerMm,
      );
      fs.writeFileSync(filePath, docx);
      shell.showItemInFolder(filePath);
      logger.info(`Document Word exporté : ${filePath}`);
      return { success: true, data: { filePath, canceled: false } };
    } catch (err: any) {
      logger.error('documents:exportDocumentDocx', err.message);
      return { success: false, error: err.message };
    }
  });
}
