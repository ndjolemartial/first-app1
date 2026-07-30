"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WIRE_TRANSFER_INTRO_HTML = exports.DEFAULT_WIRE_TRANSFER_COLUMN_WIDTHS = exports.WIRE_TRANSFER_COLUMN_HEADERS = void 0;
exports.renderWireTransferOrderHtml = renderWireTransferOrderHtml;
exports.buildWireTransferXlsx = buildWireTransferXlsx;
const exceljs_1 = __importDefault(require("exceljs"));
const theme_service_1 = require("./theme.service");
const numberToWords_1 = require("../utils/numberToWords");
/** En-têtes fixes des 8 colonnes du tableau (ordre non modifiable, largeurs éditables). */
exports.WIRE_TRANSFER_COLUMN_HEADERS = [
    'N°', 'Nom complet', 'Code Bancaire', 'Code Guichet', 'Numéro de compte', 'Clé RIB', 'Banque', 'Montant (FCFA)',
];
/** Largeurs par défaut des 8 colonnes, en % (somme = 100). */
exports.DEFAULT_WIRE_TRANSFER_COLUMN_WIDTHS = [5, 24, 11, 11, 17, 8, 14, 10];
/** Bloc d'introduction par défaut (4 lignes), avec variables `{{...}}` résolues à la génération. */
exports.DEFAULT_WIRE_TRANSFER_INTRO_HTML = '<p>Nous vous prions de bien vouloir procéder au virement des salaires du personnel ci-dessous énuméré.</p>' +
    '<p>Période concernée : <strong>{{periode}}</strong></p>' +
    '<p>Nombre de bénéficiaires : <strong>{{nombreBeneficiaires}}</strong></p>' +
    '<p>Montant total à virer : <strong>{{montantTotal}} FCFA</strong></p>';
/** Remplace les `{{variable}}` d'un fragment HTML par leur valeur (regex simple, pas de blocs conditionnels). */
function mergeVars(html, vars) {
    return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => vars[key] ?? '');
}
const fmtAmount = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));
const todayFr = () => new Date().toLocaleDateString('fr-FR');
/** Résout le bloc d'introduction (HTML, variables `{{...}}` remplacées) — partagé PDF/Excel. */
function resolveIntroHtml(template, periodLabel, beneficiaryCount, totalNet) {
    const introRaw = (template.introHtml && template.introHtml.trim()) || exports.DEFAULT_WIRE_TRANSFER_INTRO_HTML;
    return mergeVars(introRaw, {
        periode: periodLabel,
        nombreBeneficiaires: String(beneficiaryCount),
        montantTotal: fmtAmount(totalNet),
        dateEdition: todayFr(),
    });
}
/** Convertit un fragment HTML en lignes de texte brut (pour le rendu Excel du bloc d'introduction). */
function htmlToTextLines(html) {
    if (!html)
        return [];
    const text = String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/[ \t]+/g, ' ')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    return text;
}
/** Décompose une data-URI image (`data:image/png;base64,...`) pour `workbook.addImage`. ExcelJS ne prend en charge que png/jpeg/gif — `null` pour tout autre format (ex. svg), le logo est alors simplement omis de l'export Excel. */
function parseImageDataUri(dataUri) {
    if (!dataUri)
        return null;
    const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(dataUri);
    if (!m)
        return null;
    const extension = (m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase());
    return { base64: m[2], extension };
}
/** Rendu HTML complet (paysage) de l'ordre de virement, prêt pour `htmlToPdf`. */
function renderWireTransferOrderHtml(beneficiaries, periodLabel, logoDataUri, template) {
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const accent = (template.accentColor && template.accentColor.trim()) || '#1E3A5F';
    const widths = Array.isArray(template.columnWidths) && template.columnWidths.length === 8
        ? template.columnWidths
        : exports.DEFAULT_WIRE_TRANSFER_COLUMN_WIDTHS;
    const totalNet = beneficiaries.reduce((s, b) => s + b.netSalary, 0);
    const introHtml = resolveIntroHtml(template, periodLabel, beneficiaries.length, totalNet);
    const colgroup = widths.map((w) => `<col style="width:${w}%">`).join('');
    const thead = exports.WIRE_TRANSFER_COLUMN_HEADERS
        .map((h, i) => `<th class="${i === 0 || i === 7 ? 'num' : ''}">${esc(h)}</th>`)
        .join('');
    const rows = beneficiaries
        .map((b, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${esc(b.fullName)}</td>
      <td>${esc(b.bankCode || '—')}</td>
      <td>${esc(b.bankGuichetCode || '—')}</td>
      <td>${esc(b.bankAccountNumber || '—')}</td>
      <td>${esc(b.bankRibKey || '—')}</td>
      <td>${esc(b.bankName || '—')}</td>
      <td class="num">${fmtAmount(b.netSalary)}</td>
    </tr>`)
        .join('');
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; font-size: 11px; }
  .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${accent}; padding-bottom: 10px; }
  .head h1 { font-size: 20px; color: ${accent}; margin: 0; letter-spacing: .5px; }
  .logo { max-height: 80px; max-width: 220px; object-fit: contain; }
  .intro { margin-top: 14px; font-size: 11px; line-height: 1.6; }
  .intro p { margin: 3px 0; }
  .tbl-title { margin-top: 18px; margin-bottom: 6px; font-size: 13px; font-weight: bold; color: ${accent}; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; table-layout: fixed; }
  th { background: ${accent}; color: #fff; padding: 5px 6px; text-align: left; }
  th.num, td.num { text-align: right; }
  td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; overflow-wrap: break-word; }
  th, td { border-right: 1px solid #e2e8f0; }
  th:last-child, td:last-child { border-right: none; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tfoot td { font-weight: bold; background: #e2e8f0; padding: 6px; border-top: 2px solid ${accent}; }
  .amount-words { margin-top: 8px; font-size: 10.5px; font-style: italic; color: #334155; }
  .signature { margin-top: 36px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
  .signature .box { width: 240px; text-align: center; }
  .signature .lieu-date { font-size: 11px; margin-bottom: 44px; text-align: right; }
  .signature .label { font-weight: bold; font-size: 11px; border-top: 1px solid #94a3b8; padding-top: 4px; }
  .signature .name { font-size: 11px; margin-top: 3px; }
</style></head><body>
  <div class="head">
    <h1>ORDRE DE VIREMENT</h1>
    ${template.showLogo && logoDataUri ? `<img class="logo" src="${logoDataUri}"/>` : ''}
  </div>
  <div class="intro">${introHtml}</div>
  <div class="tbl-title">${esc(template.tableTitle || 'LISTE DES BÉNÉFICIAIRES')}</div>
  <table>
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${thead}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="7">TOTAL</td><td class="num">${fmtAmount(totalNet)}</td></tr></tfoot>
  </table>
  <div class="amount-words">Arrêté le présent ordre de virement à la somme de : <strong>${esc((0, numberToWords_1.moneyToFrenchWords)(totalNet))}</strong>.</div>
  <div class="signature">
    <div class="box">
      <div class="lieu-date">Fait à Abidjan, le ${todayFr()}</div>
      <div class="label">${esc(template.signatureLabel || 'Le Directeur Général')}</div>
      ${template.signatureName && template.signatureName.trim() ? `<div class="name">${esc(template.signatureName)}</div>` : ''}
    </div>
  </div>
</body></html>`;
}
/** Construit le classeur Excel (.xlsx) de l'ordre de virement. */
async function buildWireTransferXlsx(beneficiaries, periodLabel, template, logoDataUri) {
    const NAVY = (0, theme_service_1.hexToArgb)((template.accentColor && template.accentColor.trim()) || '#1E3A5F');
    const headers = exports.WIRE_TRANSFER_COLUMN_HEADERS;
    const colCount = headers.length;
    const totalNet = beneficiaries.reduce((s, b) => s + b.netSalary, 0);
    const wb = new exceljs_1.default.Workbook();
    wb.creator = 'Afrikimmo-App';
    wb.created = new Date();
    const ws = wb.addWorksheet('Ordre de virement', {
        pageSetup: {
            orientation: 'landscape',
            fitToPage: true,
            // Marges gauche/droite légèrement plus larges que le défaut Excel
            // (0.7 in) pour aérer le tableau à 8 colonnes, comme en PDF.
            margins: { left: 0.9, right: 0.9, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
        },
    });
    // Logo (haut à droite, en vis-à-vis du titre) — image flottante, ne consomme
    // pas de cellule ; les 2 premières lignes sont surélevées pour lui laisser
    // de la place (voir hauteurs de ligne plus bas).
    const logo = template.showLogo ? parseImageDataUri(logoDataUri) : null;
    if (logo) {
        const imageId = wb.addImage({ base64: logo.base64, extension: logo.extension });
        ws.addImage(imageId, {
            tl: { col: colCount - 2, row: 0.1 },
            ext: { width: 160, height: 60 },
        });
    }
    let r = 1;
    ws.mergeCells(r, 1, r, colCount - 2);
    const titleCell = ws.getCell(r, 1);
    titleCell.value = 'ORDRE DE VIREMENT';
    titleCell.font = { bold: true, size: 16, color: { argb: NAVY } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(r).height = 26;
    r++;
    ws.mergeCells(r, 1, r, colCount - 2);
    const periodCell = ws.getCell(r, 1);
    periodCell.value = `Période : ${periodLabel}`;
    periodCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    periodCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(r).height = 22;
    r += 2;
    // Bloc d'introduction (texte brut, une ligne par paragraphe — la mise en
    // forme HTML par ligne n'a pas d'équivalent direct en cellule Excel).
    const introLines = htmlToTextLines(resolveIntroHtml(template, periodLabel, beneficiaries.length, totalNet));
    for (const line of introLines) {
        ws.mergeCells(r, 1, r, colCount);
        const cell = ws.getCell(r, 1);
        cell.value = line;
        cell.font = { size: 10, color: { argb: 'FF0F172A' } };
        r++;
    }
    if (introLines.length > 0)
        r++;
    ws.mergeCells(r, 1, r, colCount);
    const tblTitleCell = ws.getCell(r, 1);
    tblTitleCell.value = template.tableTitle || 'LISTE DES BÉNÉFICIAIRES';
    tblTitleCell.font = { bold: true, size: 12, color: { argb: NAVY } };
    r++;
    const thin = { style: 'thin', color: { argb: 'FFE2E8F0' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const headerRow = ws.getRow(r);
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        cell.border = border;
        cell.alignment = { vertical: 'middle', horizontal: i === 0 || i === 7 ? 'right' : 'left' };
    });
    headerRow.height = 20;
    r++;
    beneficiaries.forEach((b, idx) => {
        const row = ws.getRow(r);
        const values = [
            idx + 1, b.fullName, b.bankCode || '', b.bankGuichetCode || '',
            b.bankAccountNumber || '', b.bankRibKey || '', b.bankName || '', b.netSalary,
        ];
        values.forEach((v, ci) => {
            const cell = row.getCell(ci + 1);
            cell.value = v;
            cell.border = border;
            cell.alignment = { vertical: 'middle', horizontal: ci === 0 || ci === 7 ? 'right' : 'left' };
            if (idx % 2 === 1)
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });
        r++;
    });
    ws.mergeCells(r, 1, r, colCount - 1);
    const totalLabelCell = ws.getCell(r, 1);
    totalLabelCell.value = 'TOTAL';
    totalLabelCell.font = { bold: true, color: { argb: NAVY } };
    totalLabelCell.alignment = { horizontal: 'right' };
    totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    const totalValCell = ws.getCell(r, colCount);
    totalValCell.value = totalNet;
    totalValCell.font = { bold: true, color: { argb: NAVY } };
    totalValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    totalValCell.alignment = { horizontal: 'right' };
    for (let ci = 1; ci <= colCount; ci++)
        ws.getRow(r).getCell(ci).border = border;
    r++;
    ws.mergeCells(r, 1, r, colCount);
    const amountWordsCell = ws.getCell(r, 1);
    amountWordsCell.value = `Arrêté le présent ordre de virement à la somme de : ${(0, numberToWords_1.moneyToFrenchWords)(totalNet)}.`;
    amountWordsCell.font = { italic: true, size: 9, color: { argb: 'FF334155' } };
    r += 3;
    ws.mergeCells(r, 1, r, colCount);
    const sigDateCell = ws.getCell(r, 1);
    sigDateCell.value = `Fait à Abidjan, le ${todayFr()}`;
    sigDateCell.alignment = { horizontal: 'right' };
    sigDateCell.font = { size: 10 };
    r += 3;
    ws.mergeCells(r, 1, r, colCount);
    const sigLabelCell = ws.getCell(r, 1);
    sigLabelCell.value = template.signatureLabel || 'Le Directeur Général';
    sigLabelCell.font = { bold: true, size: 10 };
    sigLabelCell.alignment = { horizontal: 'right' };
    if (template.signatureName && template.signatureName.trim()) {
        r++;
        ws.mergeCells(r, 1, r, colCount);
        const sigNameCell = ws.getCell(r, 1);
        sigNameCell.value = template.signatureName;
        sigNameCell.font = { size: 10 };
        sigNameCell.alignment = { horizontal: 'right' };
    }
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 14;
    ws.getColumn(5).width = 20;
    ws.getColumn(6).width = 10;
    ws.getColumn(7).width = 20;
    ws.getColumn(8).width = 16;
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
