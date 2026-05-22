/**
 * Catalogue des variables dynamiques disponibles dans les emails et SMS.
 *
 * Une variable s'écrit `{{cle}}` dans le corps ou le sujet d'un message.
 * Elle est destinée à être remplacée par sa valeur réelle au moment de
 * l'envoi (ex. `{{firstName}}` → « Awa »).
 */

export interface CommVariable {
  /** Clé technique, telle qu'écrite entre accolades — ex. `firstName`. */
  key: string;
  /** Libellé lisible affiché dans le sélecteur. */
  label: string;
}

export interface CommVariableGroup {
  group: string;
  variables: CommVariable[];
}

export const COMM_VARIABLE_GROUPS: CommVariableGroup[] = [
  {
    group: 'Destinataire',
    variables: [
      { key: 'civilite', label: 'Civilité' },
      { key: 'firstName', label: 'Prénom' },
      { key: 'lastName', label: 'Nom' },
      { key: 'fullName', label: 'Nom complet' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Téléphone' },
    ],
  },
  {
    group: 'Bien / Programme / Terrain',
    variables: [
      { key: 'propertyRef', label: 'Référence du bien' },
      { key: 'propertyAddress', label: 'Adresse du bien' },
      { key: 'programmeNom', label: 'Nom du programme' },
      { key: 'terrainRef', label: 'Référence du terrain' },
    ],
  },
  {
    group: 'Convention',
    variables: [
      { key: 'conventionRef', label: 'Référence de la convention' },
      { key: 'conventionType', label: 'Type de convention' },
      { key: 'startDate', label: 'Date de début' },
      { key: 'endDate', label: 'Date de fin' },
    ],
  },
  {
    group: 'Paiement / Échéance',
    variables: [
      { key: 'amount', label: 'Montant' },
      { key: 'rentAmount', label: 'Montant du loyer' },
      { key: 'dueDate', label: "Date d'échéance" },
      { key: 'installmentNumber', label: "Numéro d'échéance" },
    ],
  },
  {
    group: 'Agence',
    variables: [
      { key: 'agencyName', label: "Nom de l'agence" },
      { key: 'agentName', label: "Nom de l'agent" },
      { key: 'date', label: 'Date du jour' },
    ],
  },
];

/** Liste à plat de toutes les variables du catalogue. */
export const ALL_COMM_VARIABLES: CommVariable[] = COMM_VARIABLE_GROUPS.flatMap((g) => g.variables);

/** Construit le jeton à insérer dans un message — ex. `firstName` → `{{firstName}}`. */
export function variableToken(key: string): string {
  return `{{${key}}}`;
}
