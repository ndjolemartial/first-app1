import { formatDate, formatCurrency, formatCivilite } from '../../../shared/utils/format';
import { moneyToFrenchWords, decimalToFrenchWords, numberToFrenchWords } from '../../../shared/utils/numberToWords';
import { evaluateConditionals } from '../../../shared/utils/templateConditionals';
import {
  MODALITES_LABELS,
  buildInstallmentsTable,
  type VariableGroup,
} from './conventionTemplate';
import { lotsEnumeration } from './lotsEnumeration';

/** Catalogue des variables dynamiques disponibles dans un modèle d'attestation. */
export const ATTESTATION_VARIABLE_GROUPS: VariableGroup[] = [
  {
    group: 'Attestation',
    items: [
      { token: 'attestation.reference', label: 'Référence' },
      { token: 'attestation.type', label: 'Type' },
      { token: 'attestation.dateEmission', label: "Date d'émission" },
      { token: 'attestation.montant', label: 'Montant' },
      { token: 'attestation.montant.enLettres', label: 'Montant (en lettres)' },
      { token: 'attestation.notes', label: 'Notes' },
    ],
  },
  {
    group: 'Bénéficiaire (client principal)',
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
    group: 'Cédant / partie secondaire',
    items: [
      { token: 'cedant.nomComplet', label: 'Nom complet du cédant' },
      { token: 'cedant.civilite', label: 'Civilité' },
      { token: 'cedant.telephone', label: 'Téléphone' },
      { token: 'cedant.pays', label: 'Pays' },
      { token: 'cedant.typePieceIdentite', label: "Type de pièce d'identité" },
      { token: 'cedant.pieceIdentite', label: "Numéro pièce d'identité" },
      { token: 'cedant.dateNaissance', label: 'Date de naissance' },
      { token: 'cedant.lieuNaissance', label: 'Lieu de naissance' },
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
    group: 'Convention liée',
    items: [
      { token: 'convention.reference', label: 'Référence' },
      { token: 'convention.dateSignature', label: 'Date de signature' },
      { token: 'convention.delai', label: 'Délai (durée)' },
      { token: 'convention.delai.enLettres', label: 'Délai (en lettres)' },
      { token: 'convention.nombreTerrains', label: 'Nombre de terrains rattachés' },
      { token: 'convention.nombreTerrains.enLettres', label: 'Nombre de terrains rattachés (en lettres)' },
      { token: 'convention.lotsSouscrits', label: 'Énumération des lots souscrits' },
      { token: 'convention.fraisOuvertureDossier', label: "Frais d'ouverture de dossier" },
      { token: 'convention.fraisOuvertureDossier.enLettres', label: "Frais d'ouverture de dossier (en lettres)" },
      { token: 'convention.montantSouscription', label: 'Montant de souscription' },
      { token: 'convention.montantSouscription.enLettres', label: 'Montant de souscription (en lettres)' },
      { token: 'convention.lotissement.nom', label: 'Nom du lotissement' },
      { token: 'convention.lotissement.ville', label: 'Ville du lotissement' },
    ],
  },
  {
    // Variables disponibles uniquement lorsque l'attestation est liée à un
    // avenant (a.convention est un avenant et expose `parentConvention`).
    // Pour toute autre attestation, elles se résolvent à une chaîne vide.
    group: 'Avenant / convention initiale',
    items: [
      { token: 'avenant.numero', label: "Numéro d'avenant (1, 2, …)" },
      { token: 'avenant.numero.enLettres', label: "Numéro d'avenant (en lettres)" },
      { token: 'avenant.montantSupplementaire', label: 'Montant supplémentaire (transfert de site)' },
      { token: 'avenant.montantSupplementaire.enLettres', label: 'Montant supplémentaire (en lettres)' },
      { token: 'avenant.modalitesPaiement', label: 'Modalité de paiement du montant supplémentaire' },
      { token: 'avenant.nombreEcheances', label: "Nombre d'échéances (montant supplémentaire)" },
      { token: 'avenant.nombreEcheances.enLettres', label: "Nombre d'échéances du montant supplémentaire (en lettres)" },
      { token: 'avenant.echeancier', label: 'Tableau des échéances (montant supplémentaire)' },
      { token: 'convention.initiale.dateSignature', label: 'Date de signature de la convention initiale' },
      { token: 'convention.initiale.montantSouscription', label: 'Montant de souscription (convention initiale)' },
      { token: 'convention.initiale.montantSouscription.enLettres', label: 'Montant de souscription initial (en lettres)' },
      { token: 'convention.initiale.soldePayer', label: 'Solde à payer (convention initiale)' },
      { token: 'convention.initiale.soldePayer.enLettres', label: 'Solde à payer (en lettres)' },
      { token: 'convention.initiale.totalVersements', label: 'Total des versements effectués (convention initiale)' },
      { token: 'convention.initiale.totalVersements.enLettres', label: 'Total des versements effectués (en lettres)' },
      { token: 'convention.initiale.lotissement.nom', label: 'Nom du lotissement (convention initiale)' },
      { token: 'convention.initiale.lotissement.ville', label: 'Ville du lotissement (convention initiale)' },
      { token: 'convention.initiale.lotsSouscrits', label: 'Énumération des lots souscrits (convention initiale)' },
    ],
  },
  {
    group: 'Divers',
    items: [
      { token: 'agent.nomComplet', label: 'Agent émetteur' },
      { token: 'date.aujourdhui', label: 'Date du jour' },
    ],
  },
];

const TYPE_LABELS: Record<string, string> = {
  ATTRIBUTION: "Attestation d'attribution",
  CESSION: 'Attestation de cession',
  SOLDE: 'Attestation de solde',
  TRANSFERT_PROPRIETE: 'Attestation de transfert de propriété',
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
  if (months > 0 && e.getUTCDate() === s.getUTCDate()) return { count: months, unit: 'mois' };
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

/**
 * Calcule le solde restant à payer pour une convention de vente. Cf.
 * `computeSolde` dans conventionTemplate.ts — logique identique :
 *   - CASH → 0
 *   - échéancier → somme des échéances non `PAYE`/`ANNULE`
 *   - à défaut → `saleAmount − apportInitial`
 */
function computeSolde(parent: any): number | null {
  if (!parent) return null;
  const sale = Number(parent.saleAmount ?? 0);
  if (!sale) return null;
  if (parent.paymentModalites === 'CASH') return 0;
  const apport = Number(parent.apportInitial ?? 0);
  const installments: any[] = parent.installments ?? [];
  if (installments.length > 0) {
    return installments
      .filter((i) => i.status !== 'PAYE' && i.status !== 'ANNULE')
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  }
  return Math.max(0, sale - apport);
}

/**
 * Cumul des versements déjà effectués sur une convention de vente. Cf.
 * `computeVersements` dans conventionTemplate.ts — logique identique :
 *   - CASH → prix de vente intégral
 *   - sinon → apport initial + somme des échéances `PAYE`
 */
function computeVersements(parent: any): number | null {
  if (!parent) return null;
  const sale = Number(parent.saleAmount ?? 0);
  if (!sale) return null;
  if (parent.paymentModalites === 'CASH') return sale;
  const apport = Number(parent.apportInitial ?? 0);
  const installments: any[] = parent.installments ?? [];
  const paid = installments
    .filter((i) => i.status === 'PAYE')
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  return apport + paid;
}

/**
 * Numéro d'ordre de l'avenant attaché à l'attestation parmi les amendments
 * de la convention parente (1, 2, …). Retourne `null` quand l'attestation
 * n'est pas liée à un avenant (i.e. `a.convention.parentConvention` absent).
 */
function computeAvenantNumero(a: any): number | null {
  const list: any[] = a?.convention?.parentConvention?.amendments ?? [];
  if (list.length === 0) return null;
  const idx = list.findIndex((x) => Number(x.id) === Number(a.convention?.id));
  return idx >= 0 ? idx + 1 : null;
}

/**
 * Résout les variables {{token}} à partir d'une attestation chargée avec ses relations.
 *
 * @param countriesMap Mapping optionnel code ISO → nom du pays (ex. « CI » →
 * « Côte d'Ivoire »). Lorsqu'il est fourni, les variables `*.pays` rendent
 * le nom du pays au lieu du code stocké.
 */
export function resolveAttestationVariables(
  a: any,
  countriesMap?: Record<string, string>,
): Record<string, string> {
  if (!a) return {};
  const money = (v: any) => (v != null && v !== '' ? formatCurrency(Number(v)) : '');
  const moneyL = (v: any) => (v != null && v !== '' ? moneyToFrenchWords(v) : '');
  const numL = (v: any) => (v != null && v !== '' ? decimalToFrenchWords(v) : '');
  const date = (v: any) => (v ? formatDate(v) : '');
  const countryName = (code: string | null | undefined): string => {
    if (!code) return '';
    if (countriesMap && countriesMap[code]) return countriesMap[code];
    return code;
  };
  return {
    'attestation.reference': a.reference ?? '',
    'attestation.type': TYPE_LABELS[a.type] ?? a.type ?? '',
    'attestation.dateEmission': date(a.emittedAt),
    'attestation.montant': money(a.amount),
    'attestation.montant.enLettres': moneyL(a.amount),
    'attestation.notes': a.notes ?? '',
    'client.nomComplet': clientName(a.client),
    'client.civilite': a.client?.civilite ?? '',
    'client.telephone': a.client?.phone ?? a.client?.mobile ?? '',
    'client.email': a.client?.email ?? '',
    'client.adresse': a.client?.address ?? '',
    'client.ville': a.client?.city ?? '',
    'client.pays': countryName(a.client?.country),
    'client.typePieceIdentite': a.client?.idType?.label ?? '',
    'client.pieceIdentite': a.client?.idNumber ?? '',
    'client.nationalite': a.client?.nationality ?? '',
    'client.dateNaissance': date(a.client?.birthDate),
    'client.lieuNaissance': a.client?.birthPlace ?? '',
    'cedant.nomComplet': clientName(a.secondaryClient),
    'cedant.civilite': a.secondaryClient?.civilite ?? '',
    'cedant.telephone': a.secondaryClient?.phone ?? a.secondaryClient?.mobile ?? '',
    'cedant.pays': countryName(a.secondaryClient?.country),
    'cedant.typePieceIdentite': a.secondaryClient?.idType?.label ?? '',
    'cedant.pieceIdentite': a.secondaryClient?.idNumber ?? '',
    'cedant.dateNaissance': date(a.secondaryClient?.birthDate),
    'cedant.lieuNaissance': a.secondaryClient?.birthPlace ?? '',
    'terrain.reference': a.terrain?.reference ?? '',
    'terrain.ilot': a.terrain?.numeroIlot ?? '',
    'terrain.parcelle': a.terrain?.numeroParcelle ?? '',
    'terrain.superficie': a.terrain?.surface != null ? String(a.terrain.surface) : '',
    'terrain.superficie.enLettres': numL(a.terrain?.surface),
    'terrain.prixVente': money(a.terrain?.prixVente),
    'terrain.prixVente.enLettres': moneyL(a.terrain?.prixVente),
    'terrain.titreFoncier': a.terrain?.titreFoncier ?? '',
    'terrain.lotissement': a.terrain?.lotissement?.nom ?? '',
    'lotissement.nom': a.terrain?.lotissement?.nom ?? '',
    'lotissement.commune': a.terrain?.lotissement?.commune ?? '',
    'lotissement.ville': a.terrain?.lotissement?.ville ?? '',
    'lotissement.pays': countryName(a.terrain?.lotissement?.pays),
    'lotissement.natureTitre': a.terrain?.lotissement?.titleType?.label ?? '',
    'lotissement.numeroTitre': a.terrain?.lotissement?.titleNumber ?? '',
    'lotissement.documentsLivres': a.terrain?.lotissement?.titleType?.documentsLivres ?? '',
    'bien.reference': a.property?.reference ?? '',
    'bien.adresse': a.property?.address ?? '',
    'bien.ville': a.property?.city ?? '',
    'bien.superficie': a.property?.surface != null ? String(a.property.surface) : '',
    'bien.superficie.enLettres': numL(a.property?.surface),
    'convention.reference': a.convention?.reference ?? '',
    'convention.dateSignature': date(a.convention?.signedAt),
    'convention.delai': delayLabel(a.convention?.startDate, a.convention?.endDate),
    'convention.delai.enLettres': delayLabelInWords(a.convention?.startDate, a.convention?.endDate),
    'convention.nombreTerrains': a.convention?._count?.terrains != null
      ? String(a.convention._count.terrains)
      : '',
    'convention.nombreTerrains.enLettres': numL(a.convention?._count?.terrains),
    // Liste des lots souscrits via la convention (sinon retombe sur le terrain unique).
    'convention.lotsSouscrits': lotsEnumeration(
      (a.convention?.terrains ?? []).map((l: any) => l.terrain).filter(Boolean).length > 0
        ? (a.convention.terrains as any[]).map((l) => l.terrain).filter(Boolean)
        : (a.terrain ? [a.terrain] : []),
    ),
    'convention.fraisOuvertureDossier': money(a.convention?.fraisOuvertureDossier),
    'convention.fraisOuvertureDossier.enLettres': moneyL(a.convention?.fraisOuvertureDossier),
    // Lotissement de la convention liée — pris sur le premier terrain rattaché
    // (cohérence lotissement par convention garantie par la validation amont).
    'convention.lotissement.nom':
      a.convention?.terrains?.[0]?.terrain?.lotissement?.nom ?? '',
    'convention.lotissement.ville':
      a.convention?.terrains?.[0]?.terrain?.lotissement?.ville ?? '',
    // Montant de souscription = prix de vente (`saleAmount`) de la convention liée.
    'convention.montantSouscription': money(a.convention?.saleAmount),
    'convention.montantSouscription.enLettres': moneyL(a.convention?.saleAmount),
    // ── Avenant / convention initiale ─────────────────────────
    // Non-vide uniquement si l'attestation est liée à une convention qui est
    // elle-même un avenant (a.convention.parentConvention chargé).
    'avenant.numero': (() => {
      const n = computeAvenantNumero(a);
      return n != null ? String(n) : '';
    })(),
    'avenant.numero.enLettres': (() => {
      const n = computeAvenantNumero(a);
      return n != null ? numberToFrenchWords(n) : '';
    })(),
    'avenant.montantSupplementaire': money(a.convention?.additionalAmount),
    'avenant.montantSupplementaire.enLettres': moneyL(a.convention?.additionalAmount),
    // Modalités / échéancier du montant supplémentaire — non-vides
    // uniquement lorsque la convention liée est un avenant de transfert
    // de site (a.convention.type === 'AVENANT' && amendmentType === 'TRANSFERT_SITE').
    'avenant.modalitesPaiement':
      (a.convention?.type === 'AVENANT' && a.convention?.amendmentType === 'TRANSFERT_SITE')
        ? (MODALITES_LABELS[a.convention?.paymentModalites] ?? a.convention?.paymentModalites ?? '')
        : '',
    'avenant.nombreEcheances':
      (a.convention?.type === 'AVENANT' && a.convention?.amendmentType === 'TRANSFERT_SITE'
        && a.convention?.installmentCount != null)
        ? String(a.convention.installmentCount)
        : '',
    'avenant.nombreEcheances.enLettres':
      (a.convention?.type === 'AVENANT' && a.convention?.amendmentType === 'TRANSFERT_SITE')
        ? numL(a.convention?.installmentCount)
        : '',
    'avenant.echeancier':
      (a.convention?.type === 'AVENANT' && a.convention?.amendmentType === 'TRANSFERT_SITE')
        ? buildInstallmentsTable(a.convention?.installments)
        : '',
    'convention.initiale.dateSignature': date(a.convention?.parentConvention?.signedAt),
    'convention.initiale.montantSouscription': money(a.convention?.parentConvention?.saleAmount),
    'convention.initiale.montantSouscription.enLettres': moneyL(a.convention?.parentConvention?.saleAmount),
    'convention.initiale.soldePayer': (() => {
      const s = computeSolde(a.convention?.parentConvention);
      return s != null ? formatCurrency(s) : '';
    })(),
    'convention.initiale.soldePayer.enLettres': (() => {
      const s = computeSolde(a.convention?.parentConvention);
      return s != null ? moneyToFrenchWords(s) : '';
    })(),
    // Cumul des versements déjà effectués sur la convention initiale
    // (apport + échéances réglées, ou intégralité du prix pour un comptant).
    'convention.initiale.totalVersements': (() => {
      const v = computeVersements(a.convention?.parentConvention);
      return v != null ? formatCurrency(v) : '';
    })(),
    'convention.initiale.totalVersements.enLettres': (() => {
      const v = computeVersements(a.convention?.parentConvention);
      return v != null ? moneyToFrenchWords(v) : '';
    })(),
    // Lotissement de la convention initiale — pris sur le premier terrain
    // rattaché à la convention parente (cf. conventionTemplate.ts).
    'convention.initiale.lotissement.nom':
      a.convention?.parentConvention?.terrains?.[0]?.terrain?.lotissement?.nom ?? '',
    'convention.initiale.lotissement.ville':
      a.convention?.parentConvention?.terrains?.[0]?.terrain?.lotissement?.ville ?? '',
    // Énumération des lots souscrits sur la convention initiale —
    // formatage identique à {{convention.lotsSouscrits}}.
    'convention.initiale.lotsSouscrits': lotsEnumeration(
      (a.convention?.parentConvention?.terrains ?? [])
        .map((l: any) => l.terrain)
        .filter(Boolean),
    ),
    'agent.nomComplet': a.emittedBy ? `${a.emittedBy.lastName ?? ''} ${a.emittedBy.firstName ?? ''}`.trim() : '',
    'date.aujourdhui': formatDate(new Date()),
  };
}

/**
 * Remplace les variables {{token}} d'un texte HTML par les valeurs de l'attestation.
 * Un token inconnu est laissé tel quel pour signaler une éventuelle erreur.
 *
 * Les blocs conditionnels `{{#si …}}…{{/si}}` sont résolus avant la
 * substitution des variables. Les comparaisons se font sur les valeurs
 * brutes (ex. « MADAME »), tandis que la substitution finale affiche les
 * civilités formatées (« Madame »).
 */
export function mergeAttestationTemplate(
  html: string | null | undefined,
  attestation: any,
  countriesMap?: Record<string, string>,
): string {
  if (!html) return '';
  const vars = resolveAttestationVariables(attestation, countriesMap);
  const withConditions = evaluateConditionals(html, vars);
  const displayVars: Record<string, string> = {
    ...vars,
    'client.civilite': formatCivilite(vars['client.civilite']),
    'cedant.civilite': formatCivilite(vars['cedant.civilite']),
  };
  return withConditions.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, token) =>
    Object.prototype.hasOwnProperty.call(displayVars, token) ? displayVars[token] : `{{${token}}}`,
  );
}

export const ATTESTATION_TYPE_LABELS = TYPE_LABELS;
