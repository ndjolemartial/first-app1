import { formatDate, formatCurrency } from '../../../shared/utils/format';
import type { VariableGroup } from './conventionTemplate';

/** Catalogue des variables dynamiques disponibles dans un modèle d'attestation. */
export const ATTESTATION_VARIABLE_GROUPS: VariableGroup[] = [
  {
    group: 'Attestation',
    items: [
      { token: 'attestation.reference', label: 'Référence' },
      { token: 'attestation.type', label: 'Type' },
      { token: 'attestation.dateEmission', label: "Date d'émission" },
      { token: 'attestation.montant', label: 'Montant' },
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
      { token: 'client.pieceIdentite', label: "Pièce d'identité" },
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
      { token: 'cedant.pieceIdentite', label: "Pièce d'identité" },
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
    group: 'Convention liée',
    items: [
      { token: 'convention.reference', label: 'Référence' },
      { token: 'convention.dateSignature', label: 'Date de signature' },
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

/** Résout les variables {{token}} à partir d'une attestation chargée avec ses relations. */
export function resolveAttestationVariables(a: any): Record<string, string> {
  if (!a) return {};
  const money = (v: any) => (v != null && v !== '' ? formatCurrency(Number(v)) : '');
  const date = (v: any) => (v ? formatDate(v) : '');
  return {
    'attestation.reference': a.reference ?? '',
    'attestation.type': TYPE_LABELS[a.type] ?? a.type ?? '',
    'attestation.dateEmission': date(a.emittedAt),
    'attestation.montant': money(a.amount),
    'attestation.notes': a.notes ?? '',
    'client.nomComplet': clientName(a.client),
    'client.civilite': a.client?.civilite ?? '',
    'client.telephone': a.client?.phone ?? a.client?.mobile ?? '',
    'client.email': a.client?.email ?? '',
    'client.adresse': a.client?.address ?? '',
    'client.ville': a.client?.city ?? '',
    'client.pieceIdentite': a.client?.idNumber ?? '',
    'client.nationalite': a.client?.nationality ?? '',
    'client.dateNaissance': date(a.client?.birthDate),
    'client.lieuNaissance': a.client?.birthPlace ?? '',
    'cedant.nomComplet': clientName(a.secondaryClient),
    'cedant.civilite': a.secondaryClient?.civilite ?? '',
    'cedant.telephone': a.secondaryClient?.phone ?? a.secondaryClient?.mobile ?? '',
    'cedant.pieceIdentite': a.secondaryClient?.idNumber ?? '',
    'cedant.dateNaissance': date(a.secondaryClient?.birthDate),
    'cedant.lieuNaissance': a.secondaryClient?.birthPlace ?? '',
    'terrain.reference': a.terrain?.reference ?? '',
    'terrain.ilot': a.terrain?.numeroIlot ?? '',
    'terrain.parcelle': a.terrain?.numeroParcelle ?? '',
    'terrain.superficie': a.terrain?.surface != null ? String(a.terrain.surface) : '',
    'terrain.prixVente': money(a.terrain?.prixVente),
    'terrain.titreFoncier': a.terrain?.titreFoncier ?? '',
    'terrain.lotissement': a.terrain?.lotissement?.nom ?? '',
    'bien.reference': a.property?.reference ?? '',
    'bien.adresse': a.property?.address ?? '',
    'bien.ville': a.property?.city ?? '',
    'bien.superficie': a.property?.surface != null ? String(a.property.surface) : '',
    'convention.reference': a.convention?.reference ?? '',
    'convention.dateSignature': date(a.convention?.signedAt),
    'agent.nomComplet': a.emittedBy ? `${a.emittedBy.lastName ?? ''} ${a.emittedBy.firstName ?? ''}`.trim() : '',
    'date.aujourdhui': formatDate(new Date()),
  };
}

/**
 * Remplace les variables {{token}} d'un texte HTML par les valeurs de l'attestation.
 * Un token inconnu est laissé tel quel pour signaler une éventuelle erreur.
 */
export function mergeAttestationTemplate(html: string | null | undefined, attestation: any): string {
  if (!html) return '';
  const vars = resolveAttestationVariables(attestation);
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, token) =>
    Object.prototype.hasOwnProperty.call(vars, token) ? vars[token] : `{{${token}}}`,
  );
}

export const ATTESTATION_TYPE_LABELS = TYPE_LABELS;
