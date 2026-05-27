import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { moneyToFrenchWords, decimalToFrenchWords, numberToFrenchWords } from '../../../shared/utils/numberToWords';
import { evaluateConditionals } from '../../../shared/utils/templateConditionals';

/** Une variable dynamique insérable dans un modèle de convention. */
export interface TemplateVariable {
  token: string;
  label: string;
}

export interface VariableGroup {
  group: string;
  items: TemplateVariable[];
}

/** Catalogue des variables dynamiques, regroupées par thème. */
export const CONVENTION_VARIABLE_GROUPS: VariableGroup[] = [
  {
    group: 'Convention',
    items: [
      { token: 'convention.reference', label: 'Référence' },
      { token: 'convention.type', label: 'Type de convention' },
      { token: 'convention.statut', label: 'Statut' },
      { token: 'convention.dateDebut', label: 'Date de début' },
      { token: 'convention.dateFin', label: 'Date de fin' },
      { token: 'convention.delai', label: 'Délai (durée)' },
      { token: 'convention.delai.enLettres', label: 'Délai (en lettres)' },
      { token: 'convention.dateSignature', label: 'Date de signature' },
      { token: 'convention.nombreTerrains', label: 'Nombre de terrains rattachés' },
      { token: 'convention.nombreTerrains.enLettres', label: 'Nombre de terrains rattachés (en lettres)' },
      { token: 'convention.prixVente', label: 'Prix de vente' },
      { token: 'convention.prixVente.enLettres', label: 'Prix de vente (en lettres)' },
      { token: 'convention.apportInitial', label: 'Apport initial' },
      { token: 'convention.apportInitial.enLettres', label: 'Apport initial (en lettres)' },
      { token: 'convention.loyer', label: 'Loyer mensuel' },
      { token: 'convention.loyer.enLettres', label: 'Loyer mensuel (en lettres)' },
      { token: 'convention.caution', label: 'Caution' },
      { token: 'convention.caution.enLettres', label: 'Caution (en lettres)' },
      { token: 'convention.honoraires', label: "Honoraires d'agence" },
      { token: 'convention.honoraires.enLettres', label: "Honoraires d'agence (en lettres)" },
      { token: 'convention.fraisOuvertureDossier', label: "Frais d'ouverture de dossier" },
      { token: 'convention.fraisOuvertureDossier.enLettres', label: "Frais d'ouverture de dossier (en lettres)" },
      { token: 'convention.modalitesPaiement', label: 'Modalités de paiement' },
      { token: 'convention.modePaiement', label: 'Mode de paiement' },
      { token: 'convention.nombreEcheances', label: "Nombre d'échéances" },
      { token: 'convention.nombreEcheances.enLettres', label: "Nombre d'échéances (en lettres)" },
    ],
  },
  {
    group: 'Échéancier',
    items: [
      { token: 'convention.echeancier', label: 'Tableau des échéances' },
      { token: 'convention.premiereEcheance', label: 'Date 1ère échéance' },
      { token: 'convention.derniereEcheance', label: 'Date dernière échéance' },
    ],
  },
  {
    group: 'Client principal',
    items: [
      { token: 'client.nomComplet', label: 'Nom complet' },
      { token: 'client.civilite', label: 'Civilité' },
      { token: 'client.telephone', label: 'Téléphone' },
      { token: 'client.email', label: 'E-mail' },
      { token: 'client.adresse', label: 'Adresse' },
      { token: 'client.ville', label: 'Ville' },
      { token: 'client.pays', label: 'Pays' },
      { token: 'client.typePieceIdentite', label: "Type de pièce d'identité" },
      { token: 'client.pieceIdentite', label: "Numéro pièce d'identité" },
      { token: 'client.nationalite', label: 'Nationalité' },
      { token: 'client.dateNaissance', label: 'Date de naissance' },
      { token: 'client.lieuNaissance', label: 'Lieu de naissance' },
    ],
  },
  {
    group: 'Souscripteur associé',
    items: [
      { token: 'souscripteur.nomComplet', label: 'Nom complet' },
      { token: 'souscripteur.civilite', label: 'Civilité' },
      { token: 'souscripteur.telephone', label: 'Téléphone' },
      { token: 'souscripteur.pays', label: 'Pays' },
      { token: 'souscripteur.dateNaissance', label: 'Date de naissance' },
      { token: 'souscripteur.lieuNaissance', label: 'Lieu de naissance' },
      { token: 'souscripteur.typePieceIdentite', label: "Type de pièce d'identité" },
      { token: 'souscripteur.pieceIdentite', label: "Numéro pièce d'identité" },
    ],
  },
  {
    group: 'Terrain',
    items: [
      { token: 'terrain.reference', label: 'Référence' },
      { token: 'terrain.ilot', label: "Numéro d'îlot" },
      { token: 'terrain.parcelle', label: 'Numéro de parcelle' },
      { token: 'terrain.superficie', label: 'Superficie (m²)' },
      { token: 'terrain.superficie.enLettres', label: 'Superficie en lettres (m²)' },
      { token: 'terrain.prixVente', label: 'Prix de vente du terrain' },
      { token: 'terrain.prixVente.enLettres', label: 'Prix de vente du terrain (en lettres)' },
      { token: 'terrain.titreFoncier', label: 'Titre foncier' },
      { token: 'terrain.lotissement', label: 'Lotissement (nom)' },
      { token: 'lotissement.nom', label: 'Nom du lotissement' },
      { token: 'lotissement.commune', label: 'Commune du lotissement' },
      { token: 'lotissement.ville', label: 'Ville du lotissement' },
      { token: 'lotissement.pays', label: 'Pays du lotissement' },
      { token: 'lotissement.natureTitre', label: 'Nature du titre sollicité (lotissement)' },
      { token: 'lotissement.numeroTitre', label: 'Numéro du titre obtenu (lotissement)' },
      { token: 'lotissement.documentsLivres', label: 'Documents livrés avec terrains' },
    ],
  },
  {
    group: 'Bien immobilier',
    items: [
      { token: 'bien.reference', label: 'Référence' },
      { token: 'bien.adresse', label: 'Adresse' },
      { token: 'bien.ville', label: 'Ville' },
      { token: 'bien.superficie', label: 'Superficie (m²)' },
      { token: 'bien.superficie.enLettres', label: 'Superficie en lettres (m²)' },
    ],
  },
  {
    group: 'Divers',
    items: [
      { token: 'agent.nomComplet', label: "Agent en charge" },
      { token: 'date.aujourdhui', label: "Date du jour" },
    ],
  },
];

const TYPE_LABELS: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Location non meublée', RENTAL_FURNISHED: 'Location meublée',
  SALE: 'Vente', MANAGEMENT: 'Gestion', COMMERCIAL_LEASE: 'Bail commercial',
  SOUSCRIPTION: 'Souscription', AVENANT: 'Avenant', RESILIATION: 'Résiliation',
};
const STATUS_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon', ACTIVE: 'Actif', EXPIRE: 'Expiré',
  TERMINER: 'Terminé', ANNULE: 'Annulé', ATTENTE_SIGNATURE: 'Attente signature',
};
const MODALITES_LABELS: Record<string, string> = {
  CASH: 'Paiement comptant', SUR_3_MOIS: '3 mois', SUR_6_MOIS: '6 mois',
  SUR_9_MOIS: '9 mois', SUR_12_MOIS: '12 mois', SUR_24_MOIS: '24 mois',
  SUR_36_MOIS: '36 mois', SUR_48_MOIS: '48 mois', SUR_60_MOIS: '60 mois',
  SUR_PLUS_60_MOIS: '+ de 60 mois',
};
const METHOD_LABELS: Record<string, string> = {
  ESPECE: 'Espèces', CHEQUE: 'Chèque', TRANSFERT: 'Transfert',
  VIREMENT: 'Virement bancaire', MOBILE_MONEY: 'Mobile Money', NON_DEFINI: 'Non défini',
};

function clientName(cl: any): string {
  if (!cl) return '';
  return cl.type === 'INDIVIDUEL'
    ? `${cl.lastName ?? ''} ${cl.firstName ?? ''}`.trim()
    : (cl.entreprise ?? '');
}

/** Décompose un délai en (nombre, unité) à partir de deux dates ; null si invalide. */
function delayValueAndUnit(
  startVal?: string | Date | null,
  endVal?: string | Date | null,
): { count: number; unit: 'mois' | 'jour' } | null {
  if (!startVal || !endVal) return null;
  const s = new Date(startVal);
  const e = new Date(endVal);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  // Si l'écart correspond à un nombre exact de mois, on l'exprime en mois.
  if (months > 0 && e.getUTCDate() === s.getUTCDate()) return { count: months, unit: 'mois' };
  // Sinon, on retombe sur un nombre de jours.
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000);
  if (days > 0) return { count: days, unit: 'jour' };
  return null;
}

/** Calcule un libellé de délai (« 12 mois », « 18 mois », etc.) à partir des dates. */
function delayLabel(startVal?: string | Date | null, endVal?: string | Date | null): string {
  const r = delayValueAndUnit(startVal, endVal);
  if (!r) return '';
  if (r.unit === 'mois') return `${r.count} mois`;
  return `${r.count} jour${r.count > 1 ? 's' : ''}`;
}

/** Variante en lettres du délai (« douze mois », « trois jours », etc.). */
function delayLabelInWords(startVal?: string | Date | null, endVal?: string | Date | null): string {
  const r = delayValueAndUnit(startVal, endVal);
  if (!r) return '';
  const words = numberToFrenchWords(r.count);
  if (r.unit === 'mois') return `${words} mois`;
  return `${words} jour${r.count > 1 ? 's' : ''}`;
}

/** Construit un tableau HTML de l'échéancier de vente à partir des échéances d'une convention. */
function buildInstallmentsTable(installments: any[]): string {
  if (!installments || installments.length === 0) return '';
  const cell = 'border:1px solid #94a3b8;padding:4px 8px;';
  const head = `${cell}background:#f1f5f9;font-weight:bold;`;
  let total = 0;
  const rows = installments.map((i) => {
    const amount = Number(i.amount) || 0;
    total += amount;
    return `<tr>`
      + `<td style="${cell}text-align:center">${i.installmentNumber ?? ''}</td>`
      + `<td style="${cell}">${i.dueDate ? formatDate(i.dueDate) : ''}</td>`
      + `<td style="${cell}text-align:right">${formatCurrency(amount)}</td>`
      + `</tr>`;
  }).join('');
  return `<table style="border-collapse:collapse;width:100%;margin:8px 0">`
    + `<thead><tr>`
    + `<th style="${head}text-align:center">N°</th>`
    + `<th style="${head}text-align:left">Date d'échéance</th>`
    + `<th style="${head}text-align:right">Montant</th>`
    + `</tr></thead><tbody>${rows}`
    + `<tr><td colspan="2" style="${cell}font-weight:bold">Total</td>`
    + `<td style="${cell}text-align:right;font-weight:bold">${formatCurrency(total)}</td></tr>`
    + `</tbody></table>`;
}

/**
 * Résout les variables dynamiques à partir d'une convention complète
 * (telle que renvoyée par conventions:getById).
 */
export function resolveConventionVariables(c: any): Record<string, string> {
  if (!c) return {};
  const money = (v: any) => (v != null && v !== '' ? formatCurrency(Number(v)) : '');
  const moneyL = (v: any) => (v != null && v !== '' ? moneyToFrenchWords(v) : '');
  const numL = (v: any) => (v != null && v !== '' ? decimalToFrenchWords(v) : '');
  const date = (v: any) => (v ? formatDate(v) : '');
  // Liste des terrains / biens rattachés (table pivot) — concaténation lisible des champs.
  const terrains: any[] = (c.terrains ?? []).map((l: any) => l.terrain).filter(Boolean);
  const properties: any[] = (c.properties ?? []).map((l: any) => l.property).filter(Boolean);
  const joinComma = (xs: (string | null | undefined)[]) =>
    xs.filter((x) => x != null && x !== '').join(', ');
  const joinBreak = (xs: (string | null | undefined)[]) =>
    xs.filter((x) => x != null && x !== '').join('<br>');
  return {
    'convention.reference': c.reference ?? '',
    'convention.type': TYPE_LABELS[c.type] ?? c.type ?? '',
    'convention.statut': STATUS_LABELS[c.status] ?? c.status ?? '',
    'convention.dateDebut': date(c.startDate),
    'convention.dateFin': date(c.endDate),
    'convention.delai': delayLabel(c.startDate, c.endDate),
    'convention.delai.enLettres': delayLabelInWords(c.startDate, c.endDate),
    'convention.dateSignature': date(c.signedAt),
    'convention.nombreTerrains': String(terrains.length),
    'convention.nombreTerrains.enLettres': numL(terrains.length),
    'convention.prixVente': money(c.saleAmount),
    'convention.prixVente.enLettres': moneyL(c.saleAmount),
    'convention.apportInitial': money(c.apportInitial),
    'convention.apportInitial.enLettres': moneyL(c.apportInitial),
    'convention.loyer': money(c.rentAmount),
    'convention.loyer.enLettres': moneyL(c.rentAmount),
    'convention.caution': money(c.deposit),
    'convention.caution.enLettres': moneyL(c.deposit),
    'convention.honoraires': money(c.agencyFees),
    'convention.honoraires.enLettres': moneyL(c.agencyFees),
    'convention.fraisOuvertureDossier': money(c.fraisOuvertureDossier),
    'convention.fraisOuvertureDossier.enLettres': moneyL(c.fraisOuvertureDossier),
    'convention.modalitesPaiement': MODALITES_LABELS[c.paymentModalites] ?? c.paymentModalites ?? '',
    'convention.modePaiement': METHOD_LABELS[c.paymentMethod] ?? c.paymentMethod ?? '',
    'convention.nombreEcheances': c.installmentCount != null ? String(c.installmentCount) : '',
    'convention.nombreEcheances.enLettres': numL(c.installmentCount),
    'convention.premiereEcheance': date(c.firstInstallmentDate),
    'convention.derniereEcheance': date(c.lastInstallmentDate),
    'convention.echeancier': buildInstallmentsTable(c.installments),
    'client.nomComplet': clientName(c.client),
    'client.civilite': c.client?.civilite ?? '',
    'client.telephone': c.client?.phone ?? c.client?.mobile ?? '',
    'client.email': c.client?.email ?? '',
    'client.adresse': c.client?.address ?? '',
    'client.ville': c.client?.city ?? '',
    'client.pays': c.client?.country ?? '',
    'client.typePieceIdentite': c.client?.idType?.label ?? '',
    'client.pieceIdentite': c.client?.idNumber ?? '',
    'client.nationalite': c.client?.nationality ?? '',
    'client.dateNaissance': date(c.client?.birthDate),
    'client.lieuNaissance': c.client?.birthPlace ?? '',
    'souscripteur.nomComplet': clientName(c.secondaryClient),
    'souscripteur.civilite': c.secondaryClient?.civilite ?? '',
    'souscripteur.telephone': c.secondaryClient?.phone ?? c.secondaryClient?.mobile ?? '',
    'souscripteur.pays': c.secondaryClient?.country ?? '',
    'souscripteur.dateNaissance': date(c.secondaryClient?.birthDate),
    'souscripteur.lieuNaissance': c.secondaryClient?.birthPlace ?? '',
    'souscripteur.typePieceIdentite': c.secondaryClient?.idType?.label ?? '',
    'souscripteur.pieceIdentite': c.secondaryClient?.idNumber ?? '',
    // Terrains : virgule pour les champs courts, retour à la ligne pour l'adresse / lotissement.
    'terrain.reference': joinComma(terrains.map((t) => t.reference)),
    'terrain.ilot': joinComma(terrains.map((t) => t.numeroIlot)),
    'terrain.parcelle': joinComma(terrains.map((t) => t.numeroParcelle)),
    'terrain.superficie': joinComma(terrains.map((t) => (t.surface != null ? String(t.surface) : ''))),
    'terrain.superficie.enLettres': joinComma(terrains.map((t) => (t.surface != null ? decimalToFrenchWords(t.surface) : ''))),
    'terrain.prixVente': joinComma(terrains.map((t) => (t.prixVente != null ? formatCurrency(Number(t.prixVente)) : ''))),
    'terrain.prixVente.enLettres': joinComma(terrains.map((t) => (t.prixVente != null ? moneyToFrenchWords(t.prixVente) : ''))),
    'terrain.titreFoncier': joinComma(terrains.map((t) => t.titreFoncier)),
    'terrain.lotissement': joinComma(terrains.map((t) => t.lotissement?.nom)),
    'lotissement.nom': joinComma(terrains.map((t) => t.lotissement?.nom)),
    'lotissement.commune': joinComma(terrains.map((t) => t.lotissement?.commune)),
    'lotissement.ville': joinComma(terrains.map((t) => t.lotissement?.ville)),
    'lotissement.pays': joinComma(terrains.map((t) => t.lotissement?.pays)),
    'lotissement.natureTitre': joinComma(terrains.map((t) => t.lotissement?.titleType?.label)),
    'lotissement.numeroTitre': joinComma(terrains.map((t) => t.lotissement?.titleNumber)),
    // Liste des documents livrés ; on prend la première valeur non-vide
    // pour éviter de répéter le même libellé si plusieurs terrains partagent
    // le même type de titre.
    'lotissement.documentsLivres': (() => {
      const seen = new Set<string>();
      const docs: string[] = [];
      for (const t of terrains) {
        const v = (t.lotissement?.titleType?.documentsLivres ?? '').trim();
        if (v && !seen.has(v)) { seen.add(v); docs.push(v); }
      }
      return docs.join('\n');
    })(),
    // Biens : virgule pour les références, retour à la ligne pour les adresses (plus lisible).
    'bien.reference': joinComma(properties.map((p) => p.reference)),
    'bien.adresse': joinBreak(properties.map((p) => p.address)),
    'bien.ville': joinComma(properties.map((p) => p.city)),
    'bien.superficie': joinComma(properties.map((p) => (p.surface != null ? String(p.surface) : ''))),
    'bien.superficie.enLettres': joinComma(properties.map((p) => (p.surface != null ? decimalToFrenchWords(p.surface) : ''))),
    'agent.nomComplet': c.agent ? `${c.agent.lastName ?? ''} ${c.agent.firstName ?? ''}`.trim() : '',
    'date.aujourdhui': formatDate(new Date()),
  };
}

/**
 * Remplace les variables {{token}} d'un texte HTML par les valeurs de la convention.
 * Un token inconnu est laissé tel quel pour signaler une éventuelle erreur.
 *
 * Les blocs conditionnels `{{#si …}}…{{/si}}` sont résolus avant la
 * substitution des variables.
 */
export function mergeTemplate(html: string | null | undefined, convention: any): string {
  if (!html) return '';
  const vars = resolveConventionVariables(convention);
  const withConditions = evaluateConditionals(html, vars);
  return withConditions.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, token) =>
    Object.prototype.hasOwnProperty.call(vars, token) ? vars[token] : `{{${token}}}`,
  );
}
