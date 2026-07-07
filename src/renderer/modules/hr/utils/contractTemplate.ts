import { formatDate, formatCurrency, formatCivilite } from '../../../shared/utils/format';
import { moneyToFrenchWords } from '../../../shared/utils/numberToWords';
import { evaluateConditionals } from '../../../shared/utils/templateConditionals';

/**
 * Variables dynamiques et fusion des modèles de contrats de travail.
 * Calqué sur `modules/conventions/utils/conventionTemplate.ts` : le rendu
 * (zones En-tête / Corps / Fin du document / Pied de page) est effectué côté
 * renderer puis exporté via `documentExport`.
 */

export interface TemplateVariable { token: string; label: string }
export interface VariableGroup { group: string; items: TemplateVariable[] }

/** Catalogue des variables insérables dans un modèle de contrat de travail. */
export const CONTRACT_VARIABLE_GROUPS: VariableGroup[] = [
  {
    group: 'Entreprise',
    items: [
      { token: 'entreprise.nom', label: "Nom de l'entreprise (sigle)" },
      { token: 'entreprise.denomination', label: "Dénomination sociale de l'entreprise" },
      { token: 'entreprise.rccm', label: 'RCCM' },
      { token: 'entreprise.contribuable', label: 'Compte contribuable' },
      { token: 'entreprise.adresse', label: 'Adresse' },
      { token: 'entreprise.telephone', label: 'Téléphone' },
      { token: 'entreprise.representant.civilite', label: 'Représentant légal — civilité' },
      { token: 'entreprise.representant.nomComplet', label: 'Représentant légal — nom complet' },
      { token: 'entreprise.representant.fonction', label: 'Représentant légal — fonction' },
    ],
  },
  {
    group: 'Employé',
    items: [
      { token: 'employe.civilite', label: 'Civilité' },
      { token: 'employe.nomComplet', label: 'Nom complet' },
      { token: 'employe.nom', label: 'Nom' },
      { token: 'employe.prenoms', label: 'Prénoms' },
      { token: 'employe.sexe', label: 'Sexe' },
      { token: 'employe.dateNaissance', label: 'Date de naissance' },
      { token: 'employe.lieuNaissance', label: 'Lieu de naissance' },
      { token: 'employe.nationalite', label: 'Nationalité' },
      { token: 'employe.situationMatrimoniale', label: 'Situation matrimoniale' },
      { token: 'employe.nombreEnfants', label: "Nombre d'enfants" },
      { token: 'employe.adresse', label: 'Adresse' },
      { token: 'employe.email', label: 'E-mail' },
      { token: 'employe.telephone', label: 'Téléphone' },
      { token: 'employe.pieceIdentite', label: "Pièce d'identité" },
      { token: 'employe.cnps', label: 'N° CNPS' },
      { token: 'employe.cmu', label: 'N° CMU' },
      { token: 'employe.matricule', label: 'Matricule' },
      { token: 'employe.poste', label: 'Poste' },
      { token: 'employe.departement', label: 'Département' },
      { token: 'employe.banque', label: 'Banque' },
      { token: 'employe.rib', label: 'RIB / IBAN' },
    ],
  },
  {
    group: 'Contrat',
    items: [
      { token: 'contrat.reference', label: 'Référence' },
      { token: 'contrat.typeLibelle', label: 'Type de contrat' },
      { token: 'contrat.statut', label: 'Statut' },
      { token: 'contrat.poste', label: 'Poste' },
      { token: 'contrat.categorie', label: 'Catégorie' },
      { token: 'contrat.dateDebut', label: 'Date de début' },
      { token: 'contrat.dateFin', label: 'Date de fin' },
      { token: 'contrat.finEssai', label: "Fin de période d'essai" },
      { token: 'contrat.duree', label: 'Durée du contrat (hors CDI)' },
      { token: 'contrat.heuresHebdo', label: 'Heures hebdomadaires' },
      { token: 'contrat.salaireBase', label: 'Salaire de base' },
      { token: 'contrat.salaireBase.enLettres', label: 'Salaire de base (en lettres)' },
      { token: 'contrat.sursalaire', label: 'Sursalaire' },
      { token: 'contrat.primeAnciennete', label: "Prime d'ancienneté" },
      { token: 'contrat.salaireBrut', label: 'Salaire brut' },
      { token: 'contrat.salaireBrut.enLettres', label: 'Salaire brut (en lettres)' },
      { token: 'contrat.its', label: 'Retenue ITS' },
      { token: 'contrat.cnps', label: 'Retenue CNPS (salarié)' },
      { token: 'contrat.cmu', label: 'Retenue CMU (salarié)' },
      { token: 'contrat.totalRetenues', label: 'Total des retenues' },
      { token: 'contrat.transport', label: 'Prime de transport' },
      { token: 'contrat.salaireNet', label: 'Salaire net' },
      { token: 'contrat.salaireNet.enLettres', label: 'Salaire net (en lettres)' },
    ],
  },
  {
    // Variables non vides uniquement pour un avenant CDD (contrat initial rattaché).
    group: 'Avenant CDD / contrat initial',
    items: [
      { token: 'contrat.numeroAvenant', label: "Numéro de l'avenant (CDD)" },
      { token: 'contratParent.reference', label: 'Référence du contrat initial (CDD / ESSAI)' },
      { token: 'contratParent.dateDebut', label: 'Date de début du contrat initial' },
      { token: 'contratParent.dateFin', label: 'Date de fin du contrat initial (ou fin d\'essai)' },
      { token: 'contratParent.finEssai', label: "Fin de période d'essai du contrat initial" },
      { token: 'contratParent.poste', label: 'Poste (contrat initial)' },
    ],
  },
  {
    // Fonction de l'employé (référentiel) sélectionnée sur le contrat.
    group: "Fonction de l'employé",
    items: [
      { token: 'contrat.fonction.titre', label: 'Titre de la fonction' },
      { token: 'contrat.fonction.contenu', label: 'Contenu de la fonction (liste)' },
    ],
  },
  {
    // Objectifs assignés sélectionnés sur le contrat (titre + contenu en liste).
    group: 'Objectifs assignés',
    items: [
      { token: 'contrat.objectifs.titre', label: 'Titre des objectifs assignés' },
      { token: 'contrat.objectifs.contenu', label: 'Contenu des objectifs assignés (liste)' },
    ],
  },
  {
    // Commissions sur activité sélectionnées sur le contrat (libellé + taux).
    group: 'Commissions sur activité',
    items: [
      { token: 'contrat.commissionsActivite', label: 'Commissions sur activité (liste : libellé + taux)' },
    ],
  },
  {
    // Employé désigné comme autorité responsable sur le contrat — vide sinon.
    group: 'Autorité responsable',
    items: [
      { token: 'autorite.civilite', label: 'Civilité' },
      { token: 'autorite.nomComplet', label: 'Nom complet' },
      { token: 'autorite.fonction', label: 'Fonction' },
    ],
  },
  {
    group: 'Signature',
    items: [
      { token: 'contrat.signataireEmploye', label: 'Libellé du signataire (Le Salarié, Le Stagiaire…)' },
    ],
  },
  {
    group: 'Divers',
    items: [
      { token: 'lieu', label: 'Lieu (ville)' },
      { token: 'date.aujourdhui', label: 'Date du jour' },
    ],
  },
];

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  CDI: 'Contrat à Durée Indéterminée',
  CDD: 'Contrat à Durée Déterminée',
  STAGE: 'Convention de Stage',
  INTERIM: 'Contrat de Travail Temporaire (Intérim)',
  CONSULTANT: 'Contrat de Prestation / Consultance',
  APPRENTISSAGE: "Contrat d'Apprentissage",
  ESSAI: "Contrat à l'Essai",
  AVENANT_CDD: 'Avenant à un Contrat à Durée Déterminée',
  RENOUVELLEMENT_ESSAI: "Lettre de Renouvellement de la Période d'Essai",
};

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  ACTIF: 'Actif', SUSPENDU: 'Suspendu', TERMINE: 'Terminé', RESILIE: 'Résilié',
};

const SEXE_LABEL: Record<string, string> = { MASCULIN: 'Masculin', FEMININ: 'Féminin' };

const MARITAL_LABEL: Record<string, string> = {
  CELIBATAIRE: 'Célibataire', 'MARIE(E)': 'Marié(e)', CONCUBINAGE: 'Concubinage',
};

/**
 * Convertit un contenu multiligne (une ligne = un élément) en liste HTML à
 * puces. Le texte de chaque ligne est échappé. Chaîne vide si aucun élément.
 */
export function fonctionContenuToList(txt?: string | null): string {
  const items = String(txt ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!items.length) return '';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<ul>' + items.map((i) => `<li>${esc(i)}</li>`).join('') + '</ul>';
}

/**
 * Rend les commissions sur activité d'un contrat en liste HTML à puces
 * « Libellé — taux % ». Chaîne vide si aucune ligne.
 */
export function commissionsToList(list?: Array<{ label?: string; rate?: number | string }> | null): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = (Array.isArray(list) ? list : [])
    .filter((c) => c && c.label != null && String(c.label).trim() !== '')
    .map((c) => `<li>${esc(String(c.label))} — ${esc(String(c.rate ?? ''))} %</li>`);
  if (!rows.length) return '';
  return '<ul>' + rows.join('') + '</ul>';
}

/** Libellé du signataire employé selon le type de contrat. */
/**
 * Durée d'un contrat = différence entre la date de fin et la date de début,
 * exprimée en mois si l'écart correspond à un nombre entier de mois, sinon en
 * jours. Chaîne vide si les dates sont absentes/invalides.
 */
function contractDurationLabel(startVal?: string | Date | null, endVal?: string | Date | null): string {
  if (!startVal || !endVal) return '';
  const s = new Date(startVal);
  const e = new Date(endVal);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
  const months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  if (months > 0 && e.getUTCDate() === s.getUTCDate()) return `${months} mois`;
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000);
  if (days > 0) return `${days} jour${days > 1 ? 's' : ''}`;
  return '';
}

function signataireLabel(type: string): string {
  switch (type) {
    case 'STAGE': return 'Le Stagiaire';
    case 'CONSULTANT': return 'Le Consultant';
    case 'APPRENTISSAGE': return "L'Apprenti";
    default: return 'Le Salarié';
  }
}

/**
 * Résout les variables {{token}} d'un contrat à partir des données de rendu
 * (contrat + employé + entreprise) renvoyées par `hr:contracts:getRenderData`.
 */
export function resolveContractVariables(
  contract: any,
  employee: any,
  company: any,
  countriesMap?: Record<string, string>,
): Record<string, string> {
  const e = employee ?? {};
  const c = contract ?? {};
  const co = company ?? {};
  const money = (v: any) => (v != null && v !== '' ? formatCurrency(Number(v)) : '');
  const moneyL = (v: any) => (v != null && v !== '' ? moneyToFrenchWords(v) : '');
  const date = (v: any) => (v ? formatDate(v) : '');
  const countryName = (code: string | null | undefined): string => {
    if (!code) return '';
    if (countriesMap && countriesMap[code]) return countriesMap[code];
    return code;
  };
  const nomComplet = `${e.lastName ?? ''} ${e.firstName ?? ''}`.trim();
  const isWork = !['STAGE', 'CONSULTANT'].includes(c.type);
  return {
    'entreprise.nom': co.name ?? '',
    'entreprise.denomination': co.denomination ?? '',
    'entreprise.rccm': co.registre ?? '',
    'entreprise.contribuable': co.contribuable ?? '',
    'entreprise.adresse': co.address ?? '',
    'entreprise.telephone': co.phone ?? '',
    // Représentant légal (employé sélectionné dans les paramètres entreprise).
    'entreprise.representant.civilite': formatCivilite(co.legalRep?.civilite),
    'entreprise.representant.nomComplet': `${co.legalRep?.lastName ?? ''} ${co.legalRep?.firstName ?? ''}`.trim(),
    'entreprise.representant.fonction': co.legalRep?.poste ?? '',
    'employe.civilite': e.civilite ?? '',
    'employe.nomComplet': nomComplet,
    'employe.nom': e.lastName ?? '',
    'employe.prenoms': e.firstName ?? '',
    'employe.sexe': e.sexe ? (SEXE_LABEL[e.sexe] ?? e.sexe) : '',
    'employe.dateNaissance': date(e.birthDate),
    'employe.lieuNaissance': e.birthPlace ?? '',
    'employe.nationalite': countryName(e.nationality),
    'employe.situationMatrimoniale': e.maritalStatus ? (MARITAL_LABEL[e.maritalStatus] ?? e.maritalStatus) : '',
    'employe.nombreEnfants': e.childrenCount != null ? String(e.childrenCount) : '',
    'employe.adresse': [e.address, e.city].filter(Boolean).join(', '),
    'employe.email': e.email ?? '',
    'employe.telephone': e.phone ?? e.mobile ?? '',
    'employe.pieceIdentite': e.idNumber ?? '',
    'employe.cnps': e.cnpsNumber ?? '',
    'employe.cmu': e.cmuNumber ?? '',
    'employe.matricule': e.matricule ?? '',
    'employe.poste': e.poste ?? '',
    'employe.departement': e.departement ?? '',
    'employe.banque': e.bankName ?? '',
    'employe.rib': e.bankRib ?? '',
    'contrat.reference': c.reference ?? '',
    'contrat.typeLibelle': CONTRACT_TYPE_LABEL[c.type] ?? c.type ?? '',
    'contrat.statut': CONTRACT_STATUS_LABEL[c.status] ?? c.status ?? '',
    'contrat.poste': c.poste ?? '',
    'contrat.categorie': c.categorie ?? '',
    'contrat.dateDebut': date(c.startDate),
    'contrat.dateFin': date(c.endDate),
    'contrat.finEssai': date(c.trialEndDate),
    // Durée du contrat = fin − début (sauf CDI, à durée indéterminée). Pour un
    // essai, on retient la fin de période d'essai à défaut de date de fin.
    'contrat.duree': c.type === 'CDI' ? '' : contractDurationLabel(c.startDate, c.endDate ?? c.trialEndDate),
    'contrat.heuresHebdo': c.weeklyHours != null ? String(c.weeklyHours) : '40',
    'contrat.salaireBase': money(c.baseSalary),
    'contrat.salaireBase.enLettres': moneyL(c.baseSalary),
    'contrat.sursalaire': money(c.sursalaire),
    'contrat.primeAnciennete': money(c.primeAnciennete),
    'contrat.salaireBrut': money(c.grossSalary),
    'contrat.salaireBrut.enLettres': moneyL(c.grossSalary),
    'contrat.its': money(c.its),
    'contrat.cnps': money(c.cnps),
    'contrat.cmu': money(c.cmu),
    'contrat.totalRetenues': money(c.totalDeductions),
    'contrat.transport': money(c.transportAllowance),
    'contrat.salaireNet': money(c.netSalary),
    'contrat.salaireNet.enLettres': moneyL(c.netSalary),
    'contrat.signataireEmploye': signataireLabel(c.type),
    // Fonction de l'employé : titre + contenu rendu en liste à puces.
    'contrat.fonction.titre': c.fonction?.titre ?? '',
    'contrat.fonction.contenu': fonctionContenuToList(c.fonction?.contenu),
    // Objectifs assignés : titre + contenu rendu en liste à puces.
    'contrat.objectifs.titre': c.objective?.titre ?? '',
    'contrat.objectifs.contenu': fonctionContenuToList(c.objective?.contenu),
    // Commissions sur activité : liste « libellé — taux % ».
    'contrat.commissionsActivite': commissionsToList(c.activityCommissions),
    // Autorité responsable (employé sélectionné sur le contrat).
    'autorite.civilite': formatCivilite(c.responsibleAuthority?.civilite),
    'autorite.nomComplet': `${c.responsibleAuthority?.lastName ?? ''} ${c.responsibleAuthority?.firstName ?? ''}`.trim(),
    'autorite.fonction': c.responsibleAuthority?.poste ?? '',
    // Numéro de l'avenant (rang parmi les avenants du CDD parent) — vide hors avenant CDD.
    'contrat.numeroAvenant': c.avenantNumber != null ? String(c.avenantNumber) : '',
    // Contrat initial rattaché (avenant CDD / renouvellement d'essai) — vide sinon.
    'contratParent.reference': c.parentContract?.reference ?? '',
    'contratParent.dateDebut': date(c.parentContract?.startDate),
    // Fin du contrat initial : date de fin (CDD), à défaut fin de période
    // d'essai (ESSAI dont la durée est portée par trialEndDate).
    'contratParent.dateFin': date(c.parentContract?.endDate ?? c.parentContract?.trialEndDate),
    'contratParent.finEssai': date(c.parentContract?.trialEndDate),
    'contratParent.poste': c.parentContract?.poste ?? '',
    // Drapeau pour les blocs conditionnels {{#si contrat.estContratTravail}}…{{/si}}
    'contrat.estContratTravail': isWork ? '1' : '',
    'lieu': e.city || 'Abidjan',
    'date.aujourdhui': formatDate(new Date()),
  };
}

/**
 * Remplace les variables {{token}} d'un HTML de modèle par les valeurs du
 * contrat. Les blocs conditionnels `{{#si …}}…{{/si}}` sont résolus avant la
 * substitution. La civilité est affichée formatée (« Monsieur »).
 */
export function mergeContractTemplate(
  html: string | null | undefined,
  contract: any,
  employee: any,
  company: any,
  countriesMap?: Record<string, string>,
): string {
  if (!html) return '';
  const vars = resolveContractVariables(contract, employee, company, countriesMap);
  const withConditions = evaluateConditionals(html, vars);
  const displayVars: Record<string, string> = {
    ...vars,
    'employe.civilite': formatCivilite(vars['employe.civilite']),
  };
  return withConditions.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, token) =>
    Object.prototype.hasOwnProperty.call(displayVars, token) ? displayVars[token] : `{{${token}}}`,
  );
}
