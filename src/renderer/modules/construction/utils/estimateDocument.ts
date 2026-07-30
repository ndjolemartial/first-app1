import { formatCurrency, formatDate, formatPersonName } from '../../../shared/utils/format';

/**
 * Construction des 5 documents exportables d'une estimation (Module 17) :
 * Gros œuvre, Second œuvre, Finitions (le devis détaillé scindé en 3 corps
 * de métier classiques du BTP), Main d'œuvre (quantitatif + coût de la
 * main d'œuvre, jusque-là uniquement visible en écran, jamais dans un
 * document exportable) et DQE Complet (cumul des 22 lots + cascade de prix).
 *
 * Le regroupement en 3 catégories réutilise `ConstructionEstimateLine.lotPhase`
 * (7 valeurs, déjà calculées par le moteur pour le Niveau 1) — aucune
 * nouvelle donnée en base, uniquement une reclassification d'affichage.
 */

export type EstimateDocCategory = 'GROS_OEUVRE' | 'SECOND_OEUVRE' | 'FINITIONS';

/** Regroupement des 7 phases du moteur (Niveau 1) en 3 corps de métier classiques du BTP. */
const PHASE_TO_CATEGORY: Record<string, EstimateDocCategory> = {
  GROS_OEUVRE: 'GROS_OEUVRE',
  SECOND_OEUVRE: 'SECOND_OEUVRE',
  ELECTRICITE: 'SECOND_OEUVRE',
  PLOMBERIE: 'SECOND_OEUVRE',
  VRD: 'SECOND_OEUVRE',
  FINITIONS: 'FINITIONS',
  AMENAGEMENTS: 'FINITIONS',
};

export const CATEGORY_LABELS: Record<EstimateDocCategory, string> = {
  GROS_OEUVRE: 'Gros œuvre',
  SECOND_OEUVRE: 'Second œuvre',
  FINITIONS: 'Finitions',
};

export function categoryOfLine(line: { lotPhase: string }): EstimateDocCategory {
  return PHASE_TO_CATEGORY[line.lotPhase] ?? 'SECOND_OEUVRE';
}

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TD = 'border:1px solid #cbd5e1;padding:5px 8px;';

export interface LotGroup { lotCode: string; lotLabel: string; items: any[]; subtotal: number }

/** Regroupe des lignes d'estimation par lot (ordre de première apparition), avec sous-total. */
export function groupLinesByLot(lines: any[]): LotGroup[] {
  const order: string[] = [];
  const map = new Map<string, any[]>();
  for (const l of lines) {
    if (!map.has(l.lotCode)) { map.set(l.lotCode, []); order.push(l.lotCode); }
    map.get(l.lotCode)!.push(l);
  }
  return order.map((code) => {
    const items = map.get(code)!;
    const subtotal = items.reduce((s, it) => s + Number(it.montantHT), 0);
    return { lotCode: code, lotLabel: items[0].lotLabel, items, subtotal };
  });
}

/** Table HTML des ouvrages (désignation/qté/unité/PU/montant), groupés par lot avec sous-total. */
export function buildLotItemsTable(lines: any[]): { html: string; total: number } {
  const groups = groupLinesByLot(lines);
  const total = lines.reduce((s, l) => s + Number(l.montantHT), 0);
  const rows = groups.map((g) => {
    const header = `<tr><td colspan="5" style="${TD}background:#e2e8f0;font-weight:bold;">${esc(g.lotLabel)}</td></tr>`;
    const body = g.items.map((it) => `<tr>`
      + `<td style="${TD}" title="${esc(it.designation)}">${esc(it.designation)}</td>`
      + `<td style="${TD}text-align:right;">${Number(it.quantity)}</td>`
      + `<td style="${TD}text-align:center;">${esc(it.unit ?? '')}</td>`
      + `<td style="${TD}text-align:right;">${formatCurrency(Number(it.prixUnitaireHT))}</td>`
      + `<td style="${TD}text-align:right;">${formatCurrency(Number(it.montantHT))}</td>`
      + `</tr>`).join('');
    const sub = `<tr><td colspan="4" style="${TD}text-align:right;font-style:italic;">Sous-total ${esc(g.lotLabel)}</td>`
      + `<td style="${TD}text-align:right;font-style:italic;">${formatCurrency(g.subtotal)}</td></tr>`;
    return header + body + sub;
  }).join('');
  // Le total est une ligne de <tbody> (et non un <tfoot>) : les moteurs de
  // rendu PDF/impression (Chromium) répètent un <tfoot> sur chaque page d'un
  // tableau qui se scinde sur plusieurs pages — il n'apparaîtrait donc plus
  // seulement en fin de document mais au bas de chaque page.
  const totalRow = `<tr style="background:#f8fafc;font-weight:bold;"><td colspan="4" style="${TD}text-align:right;">TOTAL HT</td><td style="${TD}text-align:right;">${formatCurrency(total)}</td></tr>`;
  const html = groups.length === 0 ? '<p style="color:#94a3b8;">Aucune ligne pour cette catégorie sur ce projet.</p>' : ''
    + '<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:9.5pt;">'
    + '<thead><tr style="background:#f1f5f9;">'
    + `<th style="${TD}text-align:left;">Désignation</th><th style="${TD}text-align:right;">Qté</th>`
    + `<th style="${TD}text-align:center;">Unité</th><th style="${TD}text-align:right;">P.U. HT</th><th style="${TD}text-align:right;">Montant HT</th>`
    + '</tr></thead>'
    + `<tbody>${rows}${totalRow}</tbody>`
    + '</table>';
  return { html, total };
}

/** Table HTML du besoin en main d'œuvre (corps de métier, heures, hommes·jours, montant). */
export function buildLaborTable(resourceLines: any[]): { html: string; totalHeures: number; totalMontant: number } {
  const HEURES_PAR_JOUR = 8;
  const rows = resourceLines.filter((r) => r.resourceType === 'MAIN_OEUVRE');
  const totalHeures = rows.reduce((s, r) => s + Number(r.quantity), 0);
  const totalMontant = rows.reduce((s, r) => s + Number(r.montant), 0);
  const body = rows.map((r) => `<tr>`
    + `<td style="${TD}" title="${esc(r.resourceLabel)}">${esc(r.resourceLabel)}</td>`
    + `<td style="${TD}text-align:right;">${Number(r.quantity)} h</td>`
    + `<td style="${TD}text-align:right;">${Math.round((Number(r.quantity) / HEURES_PAR_JOUR) * 100) / 100}</td>`
    + `<td style="${TD}text-align:right;">${formatCurrency(Number(r.unitPrice))}</td>`
    + `<td style="${TD}text-align:right;">${formatCurrency(Number(r.montant))}</td>`
    + `</tr>`).join('');
  // Total en dernière ligne de <tbody> (voir commentaire de buildLotItemsTable) :
  // un <tfoot> se répéterait sur chaque page du document PDF/imprimé.
  const totalRow = `<tr style="background:#f8fafc;font-weight:bold;"><td style="${TD}">TOTAL</td><td style="${TD}text-align:right;">${totalHeures} h</td>`
    + `<td style="${TD}text-align:right;">${Math.round((totalHeures / HEURES_PAR_JOUR) * 100) / 100}</td><td style="${TD}"></td>`
    + `<td style="${TD}text-align:right;">${formatCurrency(totalMontant)}</td></tr>`;
  const html = rows.length === 0 ? '<p style="color:#94a3b8;">Aucun besoin en main d\'œuvre calculé pour ce projet.</p>' : ''
    + '<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:9.5pt;">'
    + '<thead><tr style="background:#f1f5f9;">'
    + `<th style="${TD}text-align:left;">Corps de métier</th><th style="${TD}text-align:right;">Heures</th>`
    + `<th style="${TD}text-align:right;">Hommes·jours</th><th style="${TD}text-align:right;">Taux horaire</th><th style="${TD}text-align:right;">Montant</th>`
    + '</tr></thead>'
    + `<tbody>${body}${totalRow}</tbody>`
    + '</table>';
  return { html, totalHeures, totalMontant };
}

/** En-tête « papier à en-tête » (coordonnées entreprise + logo), même principe que les autres documents de l'app. */
export function buildCompanyHeader(company: any, logo: { mimeType: string; base64: string } | null): string {
  if (!company?.name && !logo) return '';
  const lines: string[] = [];
  if (company?.address) for (const l of String(company.address).split(/\r?\n/).filter(Boolean)) lines.push(esc(l));
  const phones = [company?.phoneFixed, company?.phoneMobile1, company?.phoneMobile2].filter(Boolean).join(' / ');
  if (phones) lines.push(`Tél : ${esc(phones)}`);
  if (company?.registreCommerce) lines.push(`RCCM : ${esc(company.registreCommerce)}`);
  const info = `<div style="font-weight:bold;font-size:13pt;color:#1E3A5F;">${esc(company?.name ?? '')}</div>`
    + (company?.slogan ? `<div style="font-style:italic;color:#475569;">${esc(company.slogan)}</div>` : '')
    + lines.map((l) => `<div>${l}</div>`).join('');
  const logoImg = logo ? `<img src="data:${logo.mimeType};base64,${logo.base64}" style="max-height:80px;max-width:200px;object-fit:contain;" />` : '';
  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">'
    + `<div style="font-size:10pt;line-height:1.45;color:#334155;">${info}</div>`
    + `<div style="text-align:right;flex-shrink:0;">${logoImg}</div>`
    + '</div>';
}

function destinataireLabel(project: any): string {
  if (project?.client) return formatPersonName(project.client, '');
  if (project?.prospect) return `${project.prospect.firstName ?? ''} ${project.prospect.lastName ?? ''}`.trim();
  return '—';
}

function projectInfoBlock(project: any, estimate: any): string {
  return '<table style="width:100%;margin:10px 0 16px;font-size:9.5pt;">'
    + `<tr><td style="padding:2px 0;color:#64748b;">Projet</td><td style="padding:2px 0;font-weight:600;">${esc(project?.nom)} (${esc(project?.reference)})</td>`
    + `<td style="padding:2px 0;color:#64748b;">Destinataire</td><td style="padding:2px 0;font-weight:600;">${esc(destinataireLabel(project))}</td></tr>`
    + `<tr><td style="padding:2px 0;color:#64748b;">Estimation</td><td style="padding:2px 0;">${esc(estimate?.reference)} (v${estimate?.version})</td>`
    + `<td style="padding:2px 0;color:#64748b;">Date</td><td style="padding:2px 0;">${formatDate(estimate?.generatedAt)}</td></tr>`
    + '</table>';
}

function titleBlock(title: string): string {
  return `<div style="margin:6px 0 14px;padding:10px 14px;border:1.5px solid #1E3A5F;border-radius:6px;background:#f1f5f9;text-align:center;">`
    + `<span style="font-size:14pt;font-weight:bold;color:#1E3A5F;">${esc(title)}</span></div>`;
}

/** Corps HTML complet du document « Gros œuvre » / « Second œuvre » / « Finitions ». */
export function buildCategoryDocumentHtml(
  estimate: any, project: any, company: any, logo: { mimeType: string; base64: string } | null, category: EstimateDocCategory,
): string {
  const lines = (estimate.lines ?? []).filter((l: any) => categoryOfLine(l) === category);
  const { html } = buildLotItemsTable(lines);
  return '<div class="doc-body">'
    + buildCompanyHeader(company, logo)
    + titleBlock(`DEVIS — ${CATEGORY_LABELS[category].toUpperCase()}`)
    + projectInfoBlock(project, estimate)
    + html
    + '</div>';
}

/** Corps HTML complet du document « Main d'œuvre ». */
export function buildLaborDocumentHtml(estimate: any, project: any, company: any, logo: { mimeType: string; base64: string } | null): string {
  const { html } = buildLaborTable(estimate.resourceLines ?? []);
  return '<div class="doc-body">'
    + buildCompanyHeader(company, logo)
    + titleBlock('DEVIS — MAIN D\'ŒUVRE')
    + projectInfoBlock(project, estimate)
    + `<p style="font-size:9.5pt;color:#475569;margin-bottom:4px;">Quantitatif et coût de la main d'œuvre nécessaire à la réalisation du projet, par corps de métier — déboursé main d'œuvre inclus dans le prix de chaque ouvrage du devis détaillé, ici isolé et chiffré séparément.</p>`
    + html
    + '</div>';
}

/** Corps HTML complet du document « DQE Complet » (cumul des 22 lots + cascade de prix). */
export function buildFullDqeDocumentHtml(estimate: any, project: any, company: any, logo: { mimeType: string; base64: string } | null): string {
  const { html } = buildLotItemsTable(estimate.lines ?? []);
  const cascade = '<table style="width:60%;margin:16px 0 0;font-size:9.5pt;">'
    + row('Déboursé sec (DS)', estimate.totalDeboursSec)
    + row('+ Frais de chantier', estimate.totalFraisChantier)
    + row('= Coût de réalisation', Number(estimate.totalDeboursSec) + Number(estimate.totalFraisChantier), true)
    + row('+ Frais généraux', estimate.totalFraisGeneraux)
    + row('= Prix de revient', Number(estimate.totalDeboursSec) + Number(estimate.totalFraisChantier) + Number(estimate.totalFraisGeneraux), true)
    + row('+ Marge', estimate.totalMarge)
    + row('= TOTAL HT', estimate.totalHT, true)
    + row('+ TVA', estimate.totalTVA)
    + row('= TOTAL TTC', estimate.totalTTC, true)
    + '</table>';
  return '<div class="doc-body">'
    + buildCompanyHeader(company, logo)
    + titleBlock('DEVIS QUANTITATIF ESTIMATIF COMPLET (DQE)')
    + projectInfoBlock(project, estimate)
    + html
    + cascade
    + '</div>';

  function row(label: string, value: unknown, strong = false): string {
    const style = strong ? 'font-weight:bold;border-top:1px solid #cbd5e1;' : '';
    return `<tr><td style="padding:3px 6px;${style}">${esc(label)}</td><td style="padding:3px 6px;text-align:right;${style}">${formatCurrency(Number(value))}</td></tr>`;
  }
}
