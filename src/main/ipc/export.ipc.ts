import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { getSession } from '../services/auth.service';
import { htmlToPdf } from '../services/pdf.service';
import { getThemeForUser, hexToArgb, type ThemePalette } from '../services/theme.service';
import logger from '../utils/logger';

/** Format d'export pris en charge. */
type ExportFormat = 'pdf' | 'xlsx';

interface ExportPayload {
  token: string;
  format: ExportFormat;
  /** Nom de fichier de base, sans extension. */
  fileName: string;
  /** Titre affiché en tête du document. */
  title: string;
  /** Résumé du filtre appliqué (facultatif). */
  subtitle?: string;
  /** Libellés des colonnes. */
  headers: string[];
  /** Lignes de données déjà converties en chaînes. */
  rows: string[][];
  /** Ligne de total / solde affichée en pied de tableau (facultatif). */
  totalRow?: string[];
}

/**
 * Construit un classeur Excel (.xlsx) à partir des données tabulaires.
 */
async function buildXlsx(p: ExportPayload, theme: ThemePalette): Promise<Buffer> {
  const NAVY = hexToArgb(theme.primary);
  const { title, subtitle, headers, rows, totalRow } = p;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Afrikimmo-App';
  wb.created = new Date();
  const ws = wb.addWorksheet('Export');
  const colCount = Math.max(headers.length, 1);

  let r = 1;
  ws.mergeCells(r, 1, r, colCount);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: NAVY } };
  r++;

  if (subtitle) {
    ws.mergeCells(r, 1, r, colCount);
    const subCell = ws.getCell(r, 1);
    subCell.value = subtitle;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    r++;
  }

  ws.mergeCells(r, 1, r, colCount);
  const metaCell = ws.getCell(r, 1);
  metaCell.value = `Généré le ${new Date().toLocaleString('fr-FR')} — ${rows.length} ligne(s)`;
  metaCell.font = { size: 9, color: { argb: 'FF94A3B8' } };
  r += 2; // ligne vide de séparation

  const thin = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  const headerRow = ws.getRow(r);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { vertical: 'middle' };
    cell.border = border;
  });
  headerRow.height = 20;
  r++;

  rows.forEach((row, ri) => {
    const dataRow = ws.getRow(r);
    for (let ci = 0; ci < headers.length; ci++) {
      const cell = dataRow.getCell(ci + 1);
      cell.value = row[ci] ?? '';
      cell.border = border;
      cell.alignment = { vertical: 'middle' };
      if (ri % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
    }
    r++;
  });

  // Ligne de total / solde en pied de tableau.
  if (totalRow && totalRow.length) {
    const totalR = ws.getRow(r);
    for (let ci = 0; ci < headers.length; ci++) {
      const cell = totalR.getCell(ci + 1);
      cell.value = totalRow[ci] ?? '';
      cell.font = { bold: true, color: { argb: NAVY } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = border;
      cell.alignment = { vertical: 'middle' };
    }
    totalR.height = 20;
    r++;
  }

  headers.forEach((h, i) => {
    let maxLen = h.length;
    for (const row of rows) {
      const len = (row[i] ?? '').length;
      if (len > maxLen) maxLen = len;
    }
    if (totalRow) {
      const tl = (totalRow[i] ?? '').length;
      if (tl > maxLen) maxLen = tl;
    }
    ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 12), 50);
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as unknown as ArrayBuffer);
}

/** Échappe une valeur pour une insertion HTML sûre. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Construit le document HTML imprimable pour la génération PDF. Les couleurs
 * d'en-tête et accents reprennent le thème actif de l'utilisateur.
 */
function buildHtml(p: ExportPayload, theme: ThemePalette): string {
  const { title, subtitle, headers, rows, totalRow } = p;
  const meta = `Généré le ${new Date().toLocaleString('fr-FR')} — ${rows.length} ligne(s)`;
  const thead = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const tbody =
    rows.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('') +
    (totalRow && totalRow.length
      ? `<tr class="total-row">${totalRow.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
      : '');
  const primary  = theme.primary;
  const accent   = theme.accent;
  const muted    = theme.textMuted;
  const surface  = theme.surface;
  const border   = theme.border;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; }
  h1 { font-size: 16px; color: ${primary}; margin: 0 0 4px; border-bottom: 2px solid ${accent}; padding-bottom: 4px; display: inline-block; }
  .sub { color: ${muted}; font-style: italic; font-size: 10px; margin-bottom: 2px; }
  .meta { color: ${muted}; opacity: .7; font-size: 9px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: ${primary}; color: #fff; text-align: left; padding: 6px 8px; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid ${border}; font-size: 9px; }
  tbody tr:nth-child(even) td { background: ${surface}; }
  tbody tr.total-row td { background: ${border}; font-weight: bold; color: ${primary}; font-size: 10px; }
</style></head><body>
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ''}
  <div class="meta">${escapeHtml(meta)}</div>
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
</body></html>`;
}

/**
 * Génère un PDF paysage de la liste exportée.
 */
async function buildPdf(p: ExportPayload, theme: ThemePalette): Promise<Buffer> {
  return htmlToPdf(buildHtml(p, theme), { landscape: true });
}

/**
 * Enregistre le handler IPC d'export de listes (PDF / Excel).
 */
export function registerExportIPC(): void {
  ipcMain.handle('export:generate', async (_event, payload: ExportPayload) => {
    try {
      const session = getSession(payload?.token);
      if (!session) return { success: false, error: 'Session expirée' };
      if (payload.format !== 'pdf' && payload.format !== 'xlsx') {
        return { success: false, error: 'Format d\'export non pris en charge' };
      }
      if (!Array.isArray(payload.headers) || !Array.isArray(payload.rows)) {
        return { success: false, error: 'Données d\'export invalides' };
      }

      const ext = payload.format;
      const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
      const result = await dialog.showSaveDialog(parent!, {
        title: 'Enregistrer l\'export',
        defaultPath: path.join(app.getPath('documents'), `${payload.fileName}.${ext}`),
        filters: [
          { name: ext === 'pdf' ? 'Document PDF' : 'Classeur Excel', extensions: [ext] },
        ],
      });
      if (result.canceled || !result.filePath) {
        return { success: true, data: { canceled: true } };
      }

      const theme = await getThemeForUser(session.userId);
      const fileBuffer =
        payload.format === 'xlsx' ? await buildXlsx(payload, theme) : await buildPdf(payload, theme);
      fs.writeFileSync(result.filePath, fileBuffer);
      logger.info(`Export ${ext} généré: ${result.filePath} (${payload.rows.length} lignes)`);
      return { success: true, data: { path: result.filePath } };
    } catch (error: any) {
      logger.error('export:generate error', error.message);
      return { success: false, error: error.message };
    }
  });
}
