import { formatDate, formatCurrency, formatCivilite } from '../../../shared/utils/format';
import { moneyToFrenchWords } from '../../../shared/utils/numberToWords';
import { evaluateConditionals } from '../../../shared/utils/templateConditionals';
import { MODALITES_LABELS } from '../../conventions/utils/conventionTemplate';

export const QUOTE_TYPE_LABELS: Record<string, string> = {
  VENTE_TERRAIN: 'Vente de terrain',
  VENTE_BIEN: 'Vente de bien',
  PRESTATION: 'Prestation',
  FRAIS: 'Frais',
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  ENVOYE: 'Envoyé',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  EXPIRE: 'Expiré',
  ANNULE: 'Annulé',
};

export const QUOTE_STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  BROUILLON: 'default',
  ENVOYE: 'info',
  ACCEPTE: 'success',
  REFUSE: 'danger',
  EXPIRE: 'warning',
  ANNULE: 'default',
};

/** Échappe le HTML pour l'injection sûre dans le tableau des lignes. */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clientName(cl: any): string {
  if (!cl) return '';
  return cl.type === 'INDIVIDUEL'
    ? `${cl.lastName ?? ''} ${cl.firstName ?? ''}`.trim()
    : (cl.entreprise ?? '');
}

/** Terrains sélectionnés (relation multiple), avec repli sur le terrain scalaire unique. */
function quoteTerrainsList(q: any): any[] {
  const list = (q.terrains ?? []).map((l: any) => l.terrain).filter(Boolean);
  return list.length ? list : (q.terrain ? [q.terrain] : []);
}

/** Biens sélectionnés (relation multiple), avec repli sur le bien scalaire unique. */
function quotePropertiesList(q: any): any[] {
  const list = (q.properties ?? []).map((l: any) => l.property).filter(Boolean);
  return list.length ? list : (q.property ? [q.property] : []);
}

function joinFrenchList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

function terrainLabel(t: any): string {
  const lot = t.lotissement?.nom ? ` — Lot. ${t.lotissement.nom}` : '';
  return `${t.reference}${t.numeroParcelle ? ` (parcelle ${t.numeroParcelle})` : ''}${lot}`;
}

function propertyLabel(p: any): string {
  const loc = [p.address, p.city].filter(Boolean).join(', ');
  return `${p.reference}${loc ? ` — ${loc}` : ''}`;
}

/**
 * Désignation de l'objet du devis (terrain(s) / bien(s) / programme).
 * Énumère l'ensemble des terrains ou biens sélectionnés (sélection multiple),
 * et non uniquement le premier.
 */
function objetDesignation(q: any): string {
  const terrains = quoteTerrainsList(q);
  if (terrains.length) return joinFrenchList(terrains.map((t) => `Terrain ${terrainLabel(t)}`));
  const properties = quotePropertiesList(q);
  if (properties.length) return joinFrenchList(properties.map((p) => `Bien ${propertyLabel(p)}`));
  if (q.programme) return `Programme ${q.programme.nom}`;
  return '';
}

export interface QuoteItemGroup { category: string; items: any[]; subtotal: number; }

/** Vrai si au moins une ligne porte une catégorie (déclenche l'affichage par blocs). */
export function hasItemCategories(items: any[]): boolean {
  return (items ?? []).some((it) => (it.category ?? '').trim() !== '');
}

/**
 * Regroupe les lignes par catégorie (ordre de première apparition) et calcule
 * le sous-total de chaque groupe. Les lignes sans catégorie forment un groupe
 * de clé vide (affiché « Autres » lorsque d'autres catégories existent).
 */
export function groupItemsByCategory(items: any[]): QuoteItemGroup[] {
  const order: string[] = [];
  const map = new Map<string, any[]>();
  for (const it of items ?? []) {
    const key = (it.category ?? '').trim();
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(it);
  }
  return order.map((key) => {
    const list = map.get(key)!;
    const subtotal = list.reduce(
      (s, it) => s + Number(it.total ?? (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)),
      0,
    );
    return { category: key, items: list, subtotal: Math.round(subtotal * 100) / 100 };
  });
}

const TD = 'border:1px solid #cbd5e1;padding:4px 8px;';

/** Vrai si au moins une ligne porte une unité renseignée. */
export function hasItemUnits(items: any[]): boolean {
  return (items ?? []).some((it) => (it.unit ?? '').trim() !== '');
}

/** Vrai si au moins une ligne porte une référence (ou lot) renseignée. */
export function hasItemReferences(items: any[]): boolean {
  return (items ?? []).some((it) => (it.reference ?? '').trim() !== '');
}

/** Vrai si au moins une ligne de titre ou de sous-titre est présente. */
export function hasSectionLines(items: any[]): boolean {
  return (items ?? []).some((it) => it.lineType === 'TITLE' || it.lineType === 'SUBTITLE');
}

/**
 * Une ligne d'article (tr) du tableau. La colonne « Référence / LOT » n'est
 * incluse que si `showReference`, et la colonne « Unité » que si `showUnit`.
 * Chaque cellule porte un `title` pour afficher sa valeur complète au survol.
 */
function itemRow(it: any, showReference: boolean, showUnit: boolean): string {
  const qty = String(Number(it.quantity));
  const price = formatCurrency(Number(it.unitPrice));
  const total = formatCurrency(Number(it.total));
  return '<tr>'
    + (showReference ? `<td style="${TD}" title="${esc(it.reference ?? '')}">${esc(it.reference ?? '')}</td>` : '')
    + `<td style="${TD}" title="${esc(it.designation)}">${esc(it.designation)}</td>`
    + `<td style="${TD}text-align:right;" title="${esc(qty)}">${qty}</td>`
    + (showUnit ? `<td style="${TD}text-align:center;" title="${esc(it.unit ?? '')}">${esc(it.unit ?? '')}</td>` : '')
    + `<td style="${TD}text-align:right;" title="${esc(price)}">${price}</td>`
    + `<td style="${TD}text-align:right;" title="${esc(total)}">${total}</td>`
    + '</tr>';
}

/** Ligne de sous-titre (tr pleine largeur) au sein du tableau des articles. */
function subtitleRow(it: any, colCount: number): string {
  return `<tr><td colspan="${colCount}" style="${TD}background:#f8fafc;font-weight:bold;font-style:italic;">${esc(it.designation)}</td></tr>`;
}

function tableHead(showReference: boolean, showUnit: boolean, referenceLabel: string): string {
  return '<thead><tr style="background:#f1f5f9;">'
    + (showReference ? `<th style="${TD}text-align:left;">${esc(referenceLabel)}</th>` : '')
    + `<th style="${TD}text-align:left;">Désignation</th>`
    + `<th style="${TD}text-align:right;">Qté</th>`
    + (showUnit ? `<th style="${TD}text-align:center;">Unité</th>` : '')
    + `<th style="${TD}text-align:right;">Prix unitaire</th>`
    + `<th style="${TD}text-align:right;">Total</th>`
    + '</tr></thead>';
}

export interface QuoteItemSection { title: string | null; items: any[]; }

/** Découpe les lignes en sections : chaque ligne de titre (TITLE) démarre une nouvelle section. */
export function splitIntoSections(items: any[]): QuoteItemSection[] {
  const sections: QuoteItemSection[] = [];
  let current: QuoteItemSection | null = null;
  for (const it of items) {
    if (it.lineType === 'TITLE') {
      if (current) sections.push(current);
      current = { title: it.designation, items: [] };
    } else {
      if (!current) current = { title: null, items: [] };
      current.items.push(it);
    }
  }
  if (current) sections.push(current);
  return sections;
}

export interface QuoteItemSubsection { subtitle: string | null; items: any[]; }

/** Découpe les articles d'une section en sous-sections à chaque ligne de sous-titre (SUBTITLE). */
export function splitBySubtitle(items: any[]): QuoteItemSubsection[] {
  const subs: QuoteItemSubsection[] = [];
  let current: QuoteItemSubsection | null = null;
  for (const it of items) {
    if (it.lineType === 'SUBTITLE') {
      if (current) subs.push(current);
      current = { subtitle: it.designation, items: [] };
    } else {
      if (!current) current = { subtitle: null, items: [] };
      current.items.push(it);
    }
  }
  if (current) subs.push(current);
  return subs;
}

/**
 * Corps de tableau (lignes `<tr>`) pour une liste d'articles : regroupés par
 * catégorie (en-tête + sous-total) si au moins une catégorie est renseignée,
 * sinon à plat. Le groupe des articles **sans** catégorie (« AUTRES ») ne
 * porte ni en-tête ni ligne de sous-total — ses lignes restent à plat parmi
 * les groupes catégorisés. Utilisé aussi bien pour un devis sans section que
 * pour chaque sous-section d'un devis avec titres/sous-titres.
 */
function articleRowsBody(items: any[], showReference: boolean, showUnit: boolean, colCount: number): string {
  if (!items.length) return '';
  if (!hasItemCategories(items)) {
    return items.map((it) => itemRow(it, showReference, showUnit)).join('');
  }
  const subLabelSpan = colCount - 1;
  return groupItemsByCategory(items).map((g) => {
    const rows = g.items.map((it) => itemRow(it, showReference, showUnit)).join('');
    if (!g.category) return rows;
    const label = esc(g.category);
    const header = `<tr><td colspan="${colCount}" style="${TD}background:#e2e8f0;font-weight:bold;">${label}</td></tr>`;
    const sub = `<tr><td colspan="${subLabelSpan}" style="${TD}text-align:right;font-style:italic;">Sous-total ${label}</td>`
      + `<td style="${TD}text-align:right;font-style:italic;">${formatCurrency(g.subtotal)}</td></tr>`;
    return header + rows + sub;
  }).join('');
}

/**
 * Tableau HTML des lignes du devis.
 *
 * - Les lignes de **titre** (`lineType` TITLE) découpent le devis en sections :
 *   le titre s'affiche en évidence au-dessus d'un tableau dédié.
 * - Au sein d'une section (ou du devis entier s'il n'y a pas de titre), les
 *   lignes de **sous-titre** (SUBTITLE) découpent les articles en sous-blocs,
 *   chacun affiché sous son propre repère pleine largeur.
 * - Dans chaque sous-bloc, si des **catégories** sont renseignées, les lignes
 *   restent disposées par blocs (en-tête de catégorie + sous-total) exactement
 *   comme en l'absence de titre/sous-titre ; sinon la liste reste à plat.
 *
 * Les colonnes « Référence / LOT » et « Unité » n'apparaissent que si au
 * moins une ligne porte respectivement une référence ou une unité.
 */
/** Libellé par défaut de la colonne « Référence / LOT », modifiable par devis. */
export const DEFAULT_REFERENCE_COLUMN_LABEL = 'Référence / LOT';

function buildItemsTable(items: any[], referenceLabel: string): string {
  if (!items?.length) return '';
  const showReference = hasItemReferences(items);
  const showUnit = hasItemUnits(items);
  // Nombre total de colonnes.
  const colCount = 4 + (showReference ? 1 : 0) + (showUnit ? 1 : 0);

  if (hasSectionLines(items)) {
    return splitIntoSections(items).map((section) => {
      const heading = section.title
        ? `<div style="font-weight:bold;font-size:1.05em;text-transform:uppercase;margin-top:14px;margin-bottom:4px;">${esc(section.title)}</div>`
        : '';
      if (!section.items.length) return heading;
      const body = splitBySubtitle(section.items).map((sub) => {
        const subHeading = sub.subtitle ? subtitleRow({ designation: sub.subtitle }, colCount) : '';
        return subHeading + articleRowsBody(sub.items, showReference, showUnit, colCount);
      }).join('');
      const table = '<table style="width:100%;border-collapse:collapse;margin-top:4px;">'
        + tableHead(showReference, showUnit, referenceLabel)
        + `<tbody>${body}</tbody>`
        + '</table>';
      return heading + table;
    }).join('');
  }

  return ''
    + '<table style="width:100%;border-collapse:collapse;margin-top:8px;">'
    + tableHead(showReference, showUnit, referenceLabel)
    + `<tbody>${articleRowsBody(items, showReference, showUnit, colCount)}</tbody>`
    + '</table>';
}

/** Résout les variables {{token}} d'un devis chargé avec ses relations. */
export function resolveQuoteVariables(q: any): Record<string, string> {
  if (!q) return {};
  const money = (v: any) => (v != null && v !== '' && Number(v) !== 0 ? formatCurrency(Number(v)) : '');
  const date = (v: any) => (v ? formatDate(v) : '');
  return {
    'devis.reference': q.reference ?? '',
    'devis.objet': q.objet ?? '',
    'devis.type': QUOTE_TYPE_LABELS[q.type] ?? q.type ?? '',
    'devis.dateEmission': date(q.issueDate),
    'devis.validite': date(q.validUntil),
    'devis.lignes': buildItemsTable(q.items ?? [], q.referenceColumnLabel || DEFAULT_REFERENCE_COLUMN_LABEL),
    'devis.sousTotal': formatCurrency(Number(q.subtotal ?? 0)),
    'devis.remise': money(q.discountAmount),
    // Pourcentage de remise (vide si la remise est un montant fixe).
    'devis.remisePourcentage': q.discountIsPercent && q.discountPercent != null ? `${Number(q.discountPercent)} %` : '',
    'devis.tva': q.taxRate != null ? String(Number(q.taxRate)) : '0',
    'devis.montantTva': money(q.taxAmount),
    'devis.total': formatCurrency(Number(q.total ?? 0)),
    'devis.total.enLettres': moneyToFrenchWords(Number(q.total ?? 0)),
    'devis.modalites': q.paymentModalites && q.paymentModalites !== 'CASH'
      ? (MODALITES_LABELS[q.paymentModalites] ?? q.paymentModalites)
      : (q.paymentModalites === 'CASH' ? 'Comptant' : ''),
    'devis.nombreEcheances': q.installmentCount != null ? String(q.installmentCount) : '',
    'devis.acompte': money(q.depositExpected),
    // Pourcentage d'acompte (vide si l'acompte est un montant fixe).
    'devis.acomptePourcentage': q.depositIsPercent && q.depositPercent != null ? `${Number(q.depositPercent)} %` : '',
    'devis.conditions': q.conditions ?? '',
    'devis.notes': q.notes ?? '',
    'client.nomComplet': clientName(q.client) || (q.prospect ? `${q.prospect.lastName ?? ''} ${q.prospect.firstName ?? ''}`.trim() : ''),
    'client.civilite': q.client?.civilite ?? '',
    'client.telephone': q.client?.phone ?? q.client?.mobile ?? q.prospect?.phone ?? '',
    'client.email': q.client?.email ?? q.prospect?.email ?? '',
    'client.adresse': q.client?.address ?? '',
    'client.ville': q.client?.city ?? '',
    'objet.designation': objetDesignation(q),
    // Terrain(s) — variables singulières alignées sur le 1ᵉʳ terrain
    // sélectionné (compatibilité) ; `terrains.liste` énumère l'ensemble.
    'terrain.reference': q.terrain?.reference ?? '',
    'terrain.ilot': q.terrain?.numeroIlot ?? '',
    'terrain.parcelle': q.terrain?.numeroParcelle ?? '',
    'terrain.superficie': q.terrain?.surface != null ? String(q.terrain.surface) : '',
    'terrain.nombre': String(quoteTerrainsList(q).length),
    'terrains.liste': joinFrenchList(quoteTerrainsList(q).map(terrainLabel)),
    'lotissement.nom': q.terrain?.lotissement?.nom ?? '',
    'lotissement.ville': q.terrain?.lotissement?.ville ?? '',
    // Bien(s) — mêmes conventions que les terrains.
    'bien.reference': q.property?.reference ?? '',
    'bien.adresse': q.property?.address ?? '',
    'bien.ville': q.property?.city ?? '',
    'bien.nombre': String(quotePropertiesList(q).length),
    'biens.liste': joinFrenchList(quotePropertiesList(q).map(propertyLabel)),
    // Émetteur du devis : nom commercial s'il est renseigné, sinon « nom + prénom ».
    'agent.nomComplet': q.agent
      ? (q.agent.nomCommercial?.trim() || `${q.agent.lastName ?? ''} ${q.agent.firstName ?? ''}`.trim())
      : '',
    'date.aujourdhui': formatDate(new Date()),
  };
}

/** Remplace les variables {{token}} et les blocs conditionnels d'un modèle de devis. */
export function mergeQuoteTemplate(html: string | null | undefined, quote: any): string {
  if (!html) return '';
  const vars = resolveQuoteVariables(quote);
  const withConditions = evaluateConditionals(html, vars);
  const displayVars: Record<string, string> = {
    ...vars,
    'client.civilite': formatCivilite(vars['client.civilite']),
  };
  return withConditions.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, token) =>
    Object.prototype.hasOwnProperty.call(displayVars, token) ? displayVars[token] : `{{${token}}}`,
  );
}
