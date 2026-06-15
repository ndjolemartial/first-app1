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

/** Désignation de l'objet du devis (terrain / bien / programme). */
function objetDesignation(q: any): string {
  if (q.terrain) {
    const lot = q.terrain.lotissement?.nom ? ` — Lot. ${q.terrain.lotissement.nom}` : '';
    return `Terrain ${q.terrain.reference}${q.terrain.numeroParcelle ? ` (parcelle ${q.terrain.numeroParcelle})` : ''}${lot}`;
  }
  if (q.property) return `Bien ${q.property.reference} — ${q.property.address ?? ''}`;
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

/** Une ligne d'article (tr) du tableau. */
function itemRow(it: any): string {
  return '<tr>'
    + `<td style="${TD}">${esc(it.designation)}</td>`
    + `<td style="${TD}text-align:right;">${Number(it.quantity)}</td>`
    + `<td style="${TD}text-align:right;">${formatCurrency(Number(it.unitPrice))}</td>`
    + `<td style="${TD}text-align:right;">${formatCurrency(Number(it.total))}</td>`
    + '</tr>';
}

/**
 * Tableau HTML des lignes du devis. Si des catégories sont renseignées, les
 * lignes sont disposées par blocs (en-tête de catégorie + sous-total) ; sinon
 * la liste reste à plat.
 */
function buildItemsTable(items: any[]): string {
  if (!items?.length) return '';
  const grouped = hasItemCategories(items);
  let body: string;
  if (!grouped) {
    body = items.map(itemRow).join('');
  } else {
    body = groupItemsByCategory(items).map((g) => {
      const label = esc(g.category || 'AUTRES');
      const header = `<tr><td colspan="4" style="${TD}background:#e2e8f0;font-weight:bold;">${label}</td></tr>`;
      const rows = g.items.map(itemRow).join('');
      const sub = `<tr><td colspan="3" style="${TD}text-align:right;font-style:italic;">Sous-total ${label}</td>`
        + `<td style="${TD}text-align:right;font-style:italic;">${formatCurrency(g.subtotal)}</td></tr>`;
      return header + rows + sub;
    }).join('');
  }
  return ''
    + '<table style="width:100%;border-collapse:collapse;margin-top:8px;">'
    + '<thead><tr style="background:#f1f5f9;">'
    + `<th style="${TD}text-align:left;">Désignation</th>`
    + `<th style="${TD}text-align:right;">Qté</th>`
    + `<th style="${TD}text-align:right;">Prix unitaire</th>`
    + `<th style="${TD}text-align:right;">Total</th>`
    + '</tr></thead>'
    + `<tbody>${body}</tbody>`
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
    'devis.lignes': buildItemsTable(q.items ?? []),
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
    'terrain.reference': q.terrain?.reference ?? '',
    'terrain.ilot': q.terrain?.numeroIlot ?? '',
    'terrain.parcelle': q.terrain?.numeroParcelle ?? '',
    'terrain.superficie': q.terrain?.surface != null ? String(q.terrain.surface) : '',
    'lotissement.nom': q.terrain?.lotissement?.nom ?? '',
    'lotissement.ville': q.terrain?.lotissement?.ville ?? '',
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
