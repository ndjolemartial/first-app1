import {
  footerTextColor, isTransparentFooter, resolveFooterBg,
} from '../../modules/conventions/utils/footerColor';

/**
 * Construction des zones En-tête / Pied de page / Fin du document d'un document
 * imprimable (conventions, contrats de travail…). Partagé entre les pages
 * « Document » de chaque module. Le rendu PDF/Impression injecte l'en-tête et
 * le pied de page dans les marges de chaque page via Chromium
 * (`displayHeaderFooter` de `printToPDF`) ; la « Fin du document » est inline,
 * insérée une seule fois à la suite du corps.
 */

/** Conversion pixels → millimètres (96 DPI CSS). */
export const pxToMm = (px: number): number => Math.round(px * 0.26458333 * 100) / 100;

/**
 * HTML inline du template d'en-tête transmis à Chromium via
 * `displayHeaderFooter`. Les styles doivent être inline (la taille de police par
 * défaut est 0 = invisible). Les images sont forcées à 100 % de la largeur du
 * bloc ; tout débordement vertical est rogné (`overflow:hidden`).
 */
export function buildHeaderTemplate(mergedHeader: string, headerWidth: number, headerMm: number): string {
  const inner = mergedHeader || '';
  return ''
    + `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1e293b;width:100%;height:${headerMm}mm;max-height:${headerMm}mm;overflow:hidden;padding:0 18mm;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;">`
      + '<style>'
        + '.afk-hdr,.afk-hdr * { box-sizing:border-box; }'
        + '.afk-hdr h1{font-size:13pt;font-weight:700;margin:0 0 2pt;line-height:1.2;}'
        + '.afk-hdr h2{font-size:11pt;font-weight:600;margin:0 0 2pt;line-height:1.2;}'
        + '.afk-hdr h3{font-size:10pt;font-weight:600;margin:0 0 2pt;line-height:1.2;}'
        + '.afk-hdr p{margin:1pt 0;line-height:1.3;}'
        + '.afk-hdr ul,.afk-hdr ol{margin:1pt 0;padding-left:14pt;}'
        + '.afk-hdr img{width:100%;height:auto;max-width:100%;display:block;}'
      + '</style>'
      + `<div class="afk-hdr" style="width:${headerWidth}%;height:100%;overflow:hidden;">${inner}</div>`
    + '</div>';
}

/**
 * Template simplifié de l'en-tête pour l'export Word — `html-to-docx` ne gère
 * pas les constructions CSS avancées. Les images sont forcées à 100 % via leur
 * attribut style (Word n'interprète pas les sélecteurs de classe).
 */
export function buildHeaderDocxHtml(mergedHeader: string): string {
  if (!mergedHeader) return '';
  const html = mergedHeader.replace(/<img\b([^>]*)>/gi, (_m, attrs: string) => {
    const hasStyle = /\bstyle\s*=\s*"/i.test(attrs);
    const cleaned = attrs.replace(/\bstyle\s*=\s*"([^"]*)"/i, (_s, prev: string) => {
      const stripped = prev.replace(/(?:^|;)\s*(?:width|height|max-width)\s*:[^;]*/gi, '').trim();
      return `style="${stripped ? stripped + ';' : ''}width:100%;height:auto;"`;
    });
    return `<img${hasStyle ? cleaned : attrs + ' style="width:100%;height:auto;"'}>`;
  });
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1e293b;">${html}</div>`;
}

/**
 * Bloc HTML « Fin du document » inséré à la suite du corps (signatures,
 * mentions finales…) — inline dans le flux, une seule occurrence.
 */
export function buildEndOfDocumentHtml(
  mergedHtml: string, widthPct: number, minHeightPx: number, bgColor: string | null | undefined,
): string {
  if (!mergedHtml) return '';
  const transparent = isTransparentFooter(bgColor);
  const bg = transparent ? 'transparent' : resolveFooterBg(bgColor);
  const fg = footerTextColor(bgColor);
  return ''
    + `<div style="margin: 24px auto 0; width: ${widthPct}%; min-height: ${minHeightPx}px;`
      + ` background-color: ${bg}; color: ${fg}; padding: 12px 16px; box-sizing: border-box;`
      + ' -webkit-print-color-adjust: exact; print-color-adjust: exact;">'
      + mergedHtml
    + '</div>';
}

/** Template simplifié du pied de page pour l'export Word. */
export function buildFooterDocxHtml(mergedFooter: string, footerBgColor: string | null | undefined): string {
  if (!mergedFooter) return '';
  if (isTransparentFooter(footerBgColor)) {
    return `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1e293b;padding:6pt 0;">${mergedFooter}</div>`;
  }
  // `background-color` sur un `<div>` n'est pas converti en shading Word ; on
  // utilise une table à une cellule (shading `<w:shd>` nativement supporté).
  const bg = resolveFooterBg(footerBgColor);
  const fg = footerTextColor(footerBgColor);
  return ''
    + '<table style="width:100%;border-collapse:collapse;">'
      + '<tr>'
        + `<td style="background-color:${bg};color:${fg};padding:6pt 10pt;font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;">`
          + mergedFooter
        + '</td>'
      + '</tr>'
    + '</table>';
}

/**
 * Template du pied de page : bandeau coloré + contenu utilisateur à gauche +
 * numéro de page à droite (`pageNumber` / `totalPages` auto-remplis par Chromium).
 */
export function buildFooterTemplate(
  mergedFooter: string, footerWidth: number, footerMm: number, footerBgColor: string | null | undefined,
): string {
  const inner = mergedFooter || '';
  const transparent = isTransparentFooter(footerBgColor);
  const bg = transparent ? 'transparent' : resolveFooterBg(footerBgColor);
  const fg = footerTextColor(footerBgColor);
  return ''
    + `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:${fg};width:100%;height:${footerMm}mm;max-height:${footerMm}mm;overflow:hidden;padding:0 18mm;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;">`
      + '<style>'
        + '.afk-ftr,.afk-ftr * { box-sizing:border-box; }'
        + '.afk-ftr h1,.afk-ftr h2,.afk-ftr h3{font-size:11pt;font-weight:600;margin:0;line-height:1.2;}'
        + '.afk-ftr p{margin:1pt 0;line-height:1.3;}'
      + '</style>'
      + `<div style="width:${footerWidth}%;background-color:${bg};height:100%;overflow:hidden;">`
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12pt;padding:8pt 12pt 0;">'
          + `<div class="afk-ftr" style="flex:1;min-width:0;">${inner}</div>`
          + '<div style="flex-shrink:0;font-size:9pt;white-space:nowrap;">'
            + 'Page <span class="pageNumber"></span> / <span class="totalPages"></span>'
          + '</div>'
        + '</div>'
      + '</div>'
    + '</div>';
}
