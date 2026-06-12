import { getDb } from './db.service';
import logger from '../utils/logger';

const LEGACY_NAME = 'Devis (par défaut)';
const CLASSIQUE = 'Devis — Classique';
const MODERNE = 'Devis — Moderne';
const COMPACT = 'Devis — Compact';

/**
 * Construit le corps d'un modèle de devis. La couleur d'accent pilote la ligne
 * TOTAL (fond) et le séparateur. `titleBar` affiche le titre en bandeau coloré ;
 * `amountWords` ajoute la mention « Arrêté à la somme de … ».
 * Blocs conditionnels non imbriqués (contrainte du moteur).
 */
function buildBody(opts: { accent: string; titleBar?: boolean; amountWords?: boolean }): string {
  const { accent, titleBar, amountWords } = opts;
  const title = titleBar
    ? `<div style="background:${accent};color:#ffffff;text-align:center;padding:8px;font-size:16pt;font-weight:bold;`
      + '-webkit-print-color-adjust:exact;print-color-adjust:exact;">DEVIS {{devis.reference}}</div>'
    : `<h1 style="text-align:center;color:${accent};">DEVIS {{devis.reference}}</h1>`;
  return [
    title,
    `<p style="text-align:right;">Date : {{devis.dateEmission}}{{#si devis.validite}} — Valable jusqu'au {{devis.validite}}{{/si}}</p>`,
    `<p><strong>Client :</strong> {{client.civilite}} {{client.nomComplet}}{{#si client.telephone}} — {{client.telephone}}{{/si}}{{#si client.email}} — {{client.email}}{{/si}}</p>`,
    `{{#si objet.designation}}<p><strong>Objet :</strong> {{objet.designation}}</p>{{/si}}`,
    `{{devis.lignes}}`,
    `<table style="width:55%;margin-left:auto;margin-top:8px;border-collapse:collapse;">`
    + `<tr><td style="padding:3px 8px;">Sous-total</td><td style="padding:3px 8px;text-align:right;">{{devis.sousTotal}}</td></tr>`
    + `{{#si devis.remise}}<tr><td style="padding:3px 8px;">Remise</td><td style="padding:3px 8px;text-align:right;">- {{devis.remise}}</td></tr>{{/si}}`
    + `{{#si devis.montantTva}}<tr><td style="padding:3px 8px;">TVA ({{devis.tva}} %)</td><td style="padding:3px 8px;text-align:right;">{{devis.montantTva}}</td></tr>{{/si}}`
    + `<tr><td colspan="2" style="border-top:2px solid ${accent};font-size:0;line-height:0;padding:0;">&nbsp;</td></tr>`
    + `<tr style="background:${accent};color:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact;">`
    + `<td style="padding:7px 8px;font-weight:bold;">TOTAL</td>`
    + `<td style="padding:7px 8px;text-align:right;font-weight:bold;">{{devis.total}}</td></tr>`
    + `</table>`,
    amountWords ? `<p style="text-align:right;">Arrêté à la somme de {{devis.total.enLettres}}.</p>` : '',
    `{{#si devis.modalites}}<p><strong>Modalités de paiement :</strong> {{devis.modalites}}</p>{{/si}}`,
    `{{#si devis.acompte}}<p><strong>Acompte attendu :</strong> {{devis.acompte}}</p>{{/si}}`,
    `{{#si devis.conditions}}<p><strong>Conditions :</strong> {{devis.conditions}}</p>{{/si}}`,
    `<p style="margin-top:24px;">Fait le {{date.aujourdhui}}{{#si agent.nomComplet}}, par {{agent.nomComplet}}{{/si}}.</p>`,
    `<p style="margin-top:32px;">Bon pour accord (date et signature du client) :</p>`,
  ].filter(Boolean).join('\n');
}

/** Pied de page : bandeau coloré, texte blanc centré (auto-stylé). */
function buildFooter(color: string, text: string): string {
  return `<div style="background:${color};color:#ffffff;text-align:center;padding:6px 0;font-weight:600;`
    + `-webkit-print-color-adjust:exact;print-color-adjust:exact;">${text}</div>`;
}

interface TemplateDef { name: string; body: string; footer: string; isDefault: boolean }

const TEMPLATES: TemplateDef[] = [
  {
    name: CLASSIQUE, isDefault: true,
    body: buildBody({ accent: '#1E3A5F', amountWords: true }),
    footer: buildFooter('#7f1d1d', 'Merci pour votre confiance'),
  },
  {
    name: MODERNE, isDefault: false,
    body: buildBody({ accent: '#0F766E', titleBar: true, amountWords: true }),
    footer: buildFooter('#0F766E', 'Merci de votre confiance — à très bientôt'),
  },
  {
    name: COMPACT, isDefault: false,
    body: buildBody({ accent: '#334155' }),
    footer: buildFooter('#334155', 'Merci pour votre confiance'),
  },
];

/**
 * Met en place les modèles de devis. Désormais éditables dans Paramètres : on
 * crée chaque modèle s'il est absent (par nom) sans écraser les éditions de
 * l'utilisateur. Migration unique : l'ancien modèle « Devis (par défaut) »
 * (généré par le code) est renommé en « Devis — Classique » et rafraîchi.
 * Garantit qu'un modèle par défaut existe. Fire-and-forget.
 */
export async function seedDefaultQuoteTemplate(): Promise<void> {
  const db = getDb() as any;

  // Migration de l'ancien modèle géré par le code → Classique (une seule fois).
  const legacy = await db.quoteTemplate.findFirst({ where: { deletedAt: null, name: LEGACY_NAME }, select: { id: true } });
  const classique = await db.quoteTemplate.findFirst({ where: { deletedAt: null, name: CLASSIQUE }, select: { id: true } });
  if (legacy && !classique) {
    const def = TEMPLATES[0];
    await db.quoteTemplate.update({
      where: { id: legacy.id },
      data: { name: CLASSIQUE, body: def.body, footer: def.footer, isDefault: true },
    });
    logger.info('Quote template migrated: « Devis (par défaut) » → « Devis — Classique »');
  }

  // Crée les modèles absents (sans écraser ceux qui existent déjà).
  for (const t of TEMPLATES) {
    const exists = await db.quoteTemplate.findFirst({ where: { deletedAt: null, name: t.name }, select: { id: true } });
    if (exists) continue;
    await db.quoteTemplate.create({
      data: { name: t.name, body: t.body, footer: t.footer, isActive: true, isDefault: t.isDefault },
    });
    logger.info(`Quote template created: ${t.name}`);
  }

  // Garantit qu'un modèle par défaut existe.
  const anyDefault = await db.quoteTemplate.findFirst({ where: { deletedAt: null, isDefault: true }, select: { id: true } });
  if (!anyDefault) {
    const fallback = await db.quoteTemplate.findFirst({ where: { deletedAt: null, name: CLASSIQUE }, select: { id: true } });
    if (fallback) await db.quoteTemplate.update({ where: { id: fallback.id }, data: { isDefault: true } });
  }
}
