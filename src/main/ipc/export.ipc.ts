import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { getSession } from '../services/auth.service';
import { getDb } from '../services/db.service';
import { htmlToPdf, openPrintPreview } from '../services/pdf.service';
import { getThemeForUser, hexToArgb, type ThemePalette } from '../services/theme.service';
import { getSettings, SettingsKeys } from '../services/settings.service';
import { resolveStoragePath } from '../services/storage.service';
import { resolveListExportTemplate } from './list-export-templates.ipc';
import logger from '../utils/logger';

/** Format d'export pris en charge. */
type ExportFormat = 'pdf' | 'xlsx';

/** Sous-ensemble du modèle d'export de listes utilisé pour le rendu. */
interface ExportTemplate {
  orientation: string;
  accentColor: string;
  headerHtml: string | null;
  footerHtml: string | null;
  endOfDocument: string | null;
  showLogo: boolean;
  showGeneratedAt: boolean;
  showRowCount: boolean;
}

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
  /**
   * Index de colonne servant de clé de regroupement (facultatif). Quand la
   * valeur de cette colonne change d'une ligne à l'autre, le moteur insère une
   * délimitation nette + un espacement entre les groupes (PDF & Excel).
   */
  sectionBreakColumn?: number;
}

/** Convertit un fragment HTML en texte brut (pour l'en-tête / pied Excel). */
function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Charge le logo de l'entreprise en data-URI (`data:image/...;base64,...`) ou `null`. */
async function loadCompanyLogo(): Promise<string | null> {
  try {
    const map = await getSettings([SettingsKeys.companyLogo]);
    const logoRel = map[SettingsKeys.companyLogo];
    if (!logoRel) return null;
    const abs = resolveStoragePath(logoRel);
    if (!fs.existsSync(abs)) return null;
    const buf = fs.readFileSync(abs);
    const ext = path.extname(logoRel).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Construit la ligne de métadonnées selon les options du modèle. */
function buildMeta(p: ExportPayload, tpl: ExportTemplate): string {
  const parts: string[] = [];
  if (tpl.showGeneratedAt) parts.push(`Généré le ${new Date().toLocaleString('fr-FR')}`);
  if (tpl.showRowCount) parts.push(`${p.rows.length} ligne(s)`);
  return parts.join(' — ');
}

/**
 * Construit un classeur Excel (.xlsx) à partir des données tabulaires.
 */
async function buildXlsx(p: ExportPayload, theme: ThemePalette, tpl: ExportTemplate): Promise<Buffer> {
  const NAVY = hexToArgb(tpl.accentColor || theme.primary);
  const { title, subtitle, headers, rows, totalRow } = p;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Afrikimmo-App';
  wb.created = new Date();
  const ws = wb.addWorksheet('Export');
  const colCount = Math.max(headers.length, 1);

  let r = 1;

  // En-tête du modèle (texte) au-dessus du titre.
  const headerText = htmlToText(tpl.headerHtml);
  if (headerText) {
    for (const line of headerText.split('\n')) {
      ws.mergeCells(r, 1, r, colCount);
      const cell = ws.getCell(r, 1);
      cell.value = line;
      cell.font = { bold: true, size: 11, color: { argb: NAVY } };
      r++;
    }
  }

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

  const meta = buildMeta(p, tpl);
  if (meta) {
    ws.mergeCells(r, 1, r, colCount);
    const metaCell = ws.getCell(r, 1);
    metaCell.value = meta;
    metaCell.font = { size: 9, color: { argb: 'FF94A3B8' } };
    r++;
  }
  r++; // ligne vide de séparation

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

  const sbc = p.sectionBreakColumn;
  const mediumBottom = { style: 'medium' as const, color: { argb: NAVY } };
  let prevKey: string | undefined;
  rows.forEach((row, ri) => {
    // Délimitation + espacement entre groupes (changement de sectionBreakColumn).
    if (sbc != null && ri > 0 && row[sbc] !== prevKey) {
      const gap = ws.getRow(r);
      for (let ci = 0; ci < headers.length; ci++) {
        gap.getCell(ci + 1).border = { bottom: mediumBottom };
      }
      gap.height = 8;
      r++;
    }
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
    if (sbc != null) prevKey = row[sbc];
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

  // Bloc « Fin du document » (texte) sous le tableau.
  const endText = htmlToText(tpl.endOfDocument);
  if (endText) {
    r++; // ligne vide de séparation
    for (const line of endText.split('\n')) {
      ws.mergeCells(r, 1, r, colCount);
      const cell = ws.getCell(r, 1);
      cell.value = line;
      cell.font = { size: 10, color: { argb: 'FF0F172A' } };
      r++;
    }
  }

  // Pied de page du modèle (texte) sous le tableau.
  const footerText = htmlToText(tpl.footerHtml);
  if (footerText) {
    r++; // ligne vide de séparation
    for (const line of footerText.split('\n')) {
      ws.mergeCells(r, 1, r, colCount);
      const cell = ws.getCell(r, 1);
      cell.value = line;
      cell.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
      r++;
    }
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
 * Construit le document HTML imprimable pour la génération PDF. La couleur
 * d'accent, l'en-tête et le pied de page proviennent du modèle d'export ;
 * les nuances secondaires reprennent le thème actif de l'utilisateur.
 */
function buildHtml(
  p: ExportPayload,
  theme: ThemePalette,
  tpl: ExportTemplate,
  logoDataUri: string | null,
): string {
  const { title, subtitle, headers, rows, totalRow, sectionBreakColumn } = p;
  const meta = buildMeta(p, tpl);
  const thead = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  // Corps du tableau : insertion d'une délimitation + espacement entre groupes
  // quand la valeur de `sectionBreakColumn` change d'une ligne à l'autre.
  const bodyParts: string[] = [];
  let prevKey: string | undefined;
  rows.forEach((row, i) => {
    if (sectionBreakColumn != null && i > 0 && row[sectionBreakColumn] !== prevKey) {
      bodyParts.push(`<tr class="section-gap"><td colspan="${headers.length}"></td></tr>`);
    }
    bodyParts.push(`<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`);
    if (sectionBreakColumn != null) prevKey = row[sectionBreakColumn];
  });
  const tbody =
    bodyParts.join('') +
    (totalRow && totalRow.length
      ? `<tr class="total-row">${totalRow.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
      : '');
  // La couleur d'accent du modèle pilote l'en-tête de tableau et le titre.
  const primary  = tpl.accentColor || theme.primary;
  const accent   = tpl.accentColor || theme.accent;
  const muted    = theme.textMuted;
  const surface  = theme.surface;
  const border   = theme.border;
  const headerHtml = (tpl.headerHtml ?? '').trim();
  const footerHtml = (tpl.footerHtml ?? '').trim();
  const endOfDocument = (tpl.endOfDocument ?? '').trim();
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; }
  .doc-logo { float: right; margin: 0 0 8px 12px; }
  .doc-logo img { max-height: 64px; max-width: 170px; }
  .doc-header { color: ${primary}; font-size: 11px; margin-bottom: 8px; }
  .doc-endofdoc { color: #0f172a; font-size: 10px; margin-top: 16px; }
  .doc-footer { color: ${muted}; font-size: 9px; margin-top: 12px; border-top: 1px solid ${border}; padding-top: 6px; }
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
  /* Délimitation + espacement entre groupes (sectionBreakColumn). */
  tbody tr.section-gap td { background: #fff; border: none; border-bottom: 2px solid ${accent}; height: 12px; padding: 0; }
</style></head><body>
  ${logoDataUri ? `<div class="doc-logo"><img src="${logoDataUri}"/></div>` : ''}
  ${headerHtml ? `<div class="doc-header">${headerHtml}</div>` : ''}
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ''}
  ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  ${endOfDocument ? `<div class="doc-endofdoc">${endOfDocument}</div>` : ''}
  ${footerHtml ? `<div class="doc-footer">${footerHtml}</div>` : ''}
</body></html>`;
}

/**
 * Génère un PDF de la liste exportée. L'orientation provient du modèle.
 */
async function buildPdf(
  p: ExportPayload,
  theme: ThemePalette,
  tpl: ExportTemplate,
  logoDataUri: string | null,
): Promise<Buffer> {
  const landscape = tpl.orientation !== 'PORTRAIT';
  return htmlToPdf(buildHtml(p, theme, tpl, logoDataUri), { landscape });
}

/** Valeurs de repli si aucun modèle n'est disponible. */
const FALLBACK_TEMPLATE: ExportTemplate = {
  orientation: 'PAYSAGE',
  accentColor: '#1E3A5F',
  headerHtml: null,
  footerHtml: null,
  endOfDocument: null,
  showLogo: true,
  showGeneratedAt: true,
  showRowCount: true,
};

/** Résout le thème de l'utilisateur et le modèle d'export de listes courant. */
async function resolveThemeAndTemplate(userId: number): Promise<{ theme: ThemePalette; tpl: ExportTemplate }> {
  const theme = await getThemeForUser(userId);
  const resolved = await resolveListExportTemplate(getDb());
  const tpl: ExportTemplate = resolved
    ? {
        orientation: resolved.orientation,
        accentColor: resolved.accentColor,
        headerHtml: resolved.headerHtml,
        footerHtml: resolved.footerHtml,
        endOfDocument: resolved.endOfDocument,
        showLogo: resolved.showLogo,
        showGeneratedAt: resolved.showGeneratedAt,
        showRowCount: resolved.showRowCount,
      }
    : FALLBACK_TEMPLATE;
  return { theme, tpl };
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

      const { theme, tpl } = await resolveThemeAndTemplate(session.userId);

      const logoDataUri = payload.format === 'pdf' && tpl.showLogo ? await loadCompanyLogo() : null;
      const fileBuffer =
        payload.format === 'xlsx'
          ? await buildXlsx(payload, theme, tpl)
          : await buildPdf(payload, theme, tpl, logoDataUri);
      fs.writeFileSync(result.filePath, fileBuffer);
      logger.info(`Export ${ext} généré: ${result.filePath} (${payload.rows.length} lignes)`);
      return { success: true, data: { path: result.filePath } };
    } catch (error: any) {
      logger.error('export:generate error', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Aperçu avant impression d'une liste : génère le PDF en mémoire et l'ouvre
   * dans la fenêtre d'aperçu (impression directe avec choix d'imprimante),
   * sans imposer d'enregistrement de fichier.
   */
  ipcMain.handle('export:print', async (_event, payload: ExportPayload) => {
    try {
      const session = getSession(payload?.token);
      if (!session) return { success: false, error: 'Session expirée' };
      if (!Array.isArray(payload.headers) || !Array.isArray(payload.rows)) {
        return { success: false, error: 'Données d\'export invalides' };
      }
      const { theme, tpl } = await resolveThemeAndTemplate(session.userId);
      const logoDataUri = tpl.showLogo ? await loadCompanyLogo() : null;
      const pdf = await buildPdf(payload, theme, tpl, logoDataUri);
      await openPrintPreview(pdf, payload.title || payload.fileName);
      logger.info(`Aperçu impression liste: ${payload.fileName} (${payload.rows.length} lignes)`);
      return { success: true, data: { previewing: true } };
    } catch (error: any) {
      logger.error('export:print error', error.message);
      return { success: false, error: error.message };
    }
  });
}
