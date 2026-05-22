import { formatDate, formatCurrency } from '../../../shared/utils/format';

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
      { token: 'convention.dateSignature', label: 'Date de signature' },
      { token: 'convention.prixVente', label: 'Prix de vente' },
      { token: 'convention.apportInitial', label: 'Apport initial' },
      { token: 'convention.loyer', label: 'Loyer mensuel' },
      { token: 'convention.caution', label: 'Caution' },
      { token: 'convention.honoraires', label: "Honoraires d'agence" },
      { token: 'convention.modalitesPaiement', label: 'Modalités de paiement' },
      { token: 'convention.modePaiement', label: 'Mode de paiement' },
      { token: 'convention.nombreEcheances', label: "Nombre d'échéances" },
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
      { token: 'client.pieceIdentite', label: "Pièce d'identité" },
      { token: 'client.nationalite', label: 'Nationalité' },
    ],
  },
  {
    group: 'Souscripteur associé',
    items: [
      { token: 'souscripteur.nomComplet', label: 'Nom complet' },
      { token: 'souscripteur.telephone', label: 'Téléphone' },
    ],
  },
  {
    group: 'Terrain',
    items: [
      { token: 'terrain.reference', label: 'Référence' },
      { token: 'terrain.ilot', label: "Numéro d'îlot" },
      { token: 'terrain.parcelle', label: 'Numéro de parcelle' },
      { token: 'terrain.superficie', label: 'Superficie (m²)' },
      { token: 'terrain.prixVente', label: 'Prix de vente du terrain' },
      { token: 'terrain.titreFoncier', label: 'Titre foncier' },
      { token: 'terrain.lotissement', label: 'Lotissement' },
    ],
  },
  {
    group: 'Bien immobilier',
    items: [
      { token: 'bien.reference', label: 'Référence' },
      { token: 'bien.adresse', label: 'Adresse' },
      { token: 'bien.ville', label: 'Ville' },
      { token: 'bien.superficie', label: 'Superficie (m²)' },
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
    ? `${cl.firstName ?? ''} ${cl.lastName ?? ''}`.trim()
    : (cl.entreprise ?? '');
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
  const date = (v: any) => (v ? formatDate(v) : '');
  return {
    'convention.reference': c.reference ?? '',
    'convention.type': TYPE_LABELS[c.type] ?? c.type ?? '',
    'convention.statut': STATUS_LABELS[c.status] ?? c.status ?? '',
    'convention.dateDebut': date(c.startDate),
    'convention.dateFin': date(c.endDate),
    'convention.dateSignature': date(c.signedAt),
    'convention.prixVente': money(c.saleAmount),
    'convention.apportInitial': money(c.apportInitial),
    'convention.loyer': money(c.rentAmount),
    'convention.caution': money(c.deposit),
    'convention.honoraires': money(c.agencyFees),
    'convention.modalitesPaiement': MODALITES_LABELS[c.paymentModalites] ?? c.paymentModalites ?? '',
    'convention.modePaiement': METHOD_LABELS[c.paymentMethod] ?? c.paymentMethod ?? '',
    'convention.nombreEcheances': c.installmentCount != null ? String(c.installmentCount) : '',
    'convention.premiereEcheance': date(c.firstInstallmentDate),
    'convention.derniereEcheance': date(c.lastInstallmentDate),
    'convention.echeancier': buildInstallmentsTable(c.installments),
    'client.nomComplet': clientName(c.client),
    'client.civilite': c.client?.civilite ?? '',
    'client.telephone': c.client?.phone ?? c.client?.mobile ?? '',
    'client.email': c.client?.email ?? '',
    'client.adresse': c.client?.address ?? '',
    'client.ville': c.client?.city ?? '',
    'client.pieceIdentite': c.client?.idNumber ?? '',
    'client.nationalite': c.client?.nationality ?? '',
    'souscripteur.nomComplet': clientName(c.secondaryClient),
    'souscripteur.telephone': c.secondaryClient?.phone ?? c.secondaryClient?.mobile ?? '',
    'terrain.reference': c.terrain?.reference ?? '',
    'terrain.ilot': c.terrain?.numeroIlot ?? '',
    'terrain.parcelle': c.terrain?.numeroParcelle ?? '',
    'terrain.superficie': c.terrain?.surface != null ? String(c.terrain.surface) : '',
    'terrain.prixVente': money(c.terrain?.prixVente),
    'terrain.titreFoncier': c.terrain?.titreFoncier ?? '',
    'terrain.lotissement': c.terrain?.lotissement?.nom ?? '',
    'bien.reference': c.property?.reference ?? '',
    'bien.adresse': c.property?.address ?? '',
    'bien.ville': c.property?.city ?? '',
    'bien.superficie': c.property?.surface != null ? String(c.property.surface) : '',
    'agent.nomComplet': c.agent ? `${c.agent.firstName ?? ''} ${c.agent.lastName ?? ''}`.trim() : '',
    'date.aujourdhui': formatDate(new Date()),
  };
}

/**
 * Remplace les variables {{token}} d'un texte HTML par les valeurs de la convention.
 * Un token inconnu est laissé tel quel pour signaler une éventuelle erreur.
 */
export function mergeTemplate(html: string | null | undefined, convention: any): string {
  if (!html) return '';
  const vars = resolveConventionVariables(convention);
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, token) =>
    Object.prototype.hasOwnProperty.call(vars, token) ? vars[token] : `{{${token}}}`,
  );
}
