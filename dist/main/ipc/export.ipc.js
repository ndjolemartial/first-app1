"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExportIPC = registerExportIPC;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const exceljs_1 = __importDefault(require("exceljs"));
const auth_service_1 = require("../services/auth.service");
const pdf_service_1 = require("../services/pdf.service");
const theme_service_1 = require("../services/theme.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Construit un classeur Excel (.xlsx) à partir des données tabulaires.
 */
async function buildXlsx(p, theme) {
    const NAVY = (0, theme_service_1.hexToArgb)(theme.primary);
    const { title, subtitle, headers, rows, totalRow } = p;
    const wb = new exceljs_1.default.Workbook();
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
    const thin = { style: 'thin', color: { argb: 'FFE2E8F0' } };
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
            if (len > maxLen)
                maxLen = len;
        }
        if (totalRow) {
            const tl = (totalRow[i] ?? '').length;
            if (tl > maxLen)
                maxLen = tl;
        }
        ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 12), 50);
    });
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
/** Échappe une valeur pour une insertion HTML sûre. */
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
/**
 * Construit le document HTML imprimable pour la génération PDF. Les couleurs
 * d'en-tête et accents reprennent le thème actif de l'utilisateur.
 */
function buildHtml(p, theme) {
    const { title, subtitle, headers, rows, totalRow } = p;
    const meta = `Généré le ${new Date().toLocaleString('fr-FR')} — ${rows.length} ligne(s)`;
    const thead = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    const tbody = rows.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('') +
        (totalRow && totalRow.length
            ? `<tr class="total-row">${totalRow.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
            : '');
    const primary = theme.primary;
    const accent = theme.accent;
    const muted = theme.textMuted;
    const surface = theme.surface;
    const border = theme.border;
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
async function buildPdf(p, theme) {
    return (0, pdf_service_1.htmlToPdf)(buildHtml(p, theme), { landscape: true });
}
/**
 * Enregistre le handler IPC d'export de listes (PDF / Excel).
 */
function registerExportIPC() {
    electron_1.ipcMain.handle('export:generate', async (_event, payload) => {
        try {
            const session = (0, auth_service_1.getSession)(payload?.token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            if (payload.format !== 'pdf' && payload.format !== 'xlsx') {
                return { success: false, error: 'Format d\'export non pris en charge' };
            }
            if (!Array.isArray(payload.headers) || !Array.isArray(payload.rows)) {
                return { success: false, error: 'Données d\'export invalides' };
            }
            const ext = payload.format;
            const parent = electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0] ?? undefined;
            const result = await electron_1.dialog.showSaveDialog(parent, {
                title: 'Enregistrer l\'export',
                defaultPath: path_1.default.join(electron_1.app.getPath('documents'), `${payload.fileName}.${ext}`),
                filters: [
                    { name: ext === 'pdf' ? 'Document PDF' : 'Classeur Excel', extensions: [ext] },
                ],
            });
            if (result.canceled || !result.filePath) {
                return { success: true, data: { canceled: true } };
            }
            const theme = await (0, theme_service_1.getThemeForUser)(session.userId);
            const fileBuffer = payload.format === 'xlsx' ? await buildXlsx(payload, theme) : await buildPdf(payload, theme);
            fs_1.default.writeFileSync(result.filePath, fileBuffer);
            logger_1.default.info(`Export ${ext} généré: ${result.filePath} (${payload.rows.length} lignes)`);
            return { success: true, data: { path: result.filePath } };
        }
        catch (error) {
            logger_1.default.error('export:generate error', error.message);
            return { success: false, error: error.message };
        }
    });
}
