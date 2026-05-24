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
      { token: 'terrain.prixVente', label: 'Prix de vente du terrain' },
      { token: 'terrain.titreFoncier', label: 'Titre foncier' },
      { token: 'terrain.lotissement', label: 'Lotissement (nom)' },
      { token: 'lotissement.nom', label: 'Nom du lotissement' },
      { token: 'lotissement.commune', label: 'Commune du lotissement' },
      { token: 'lotissement.ville', label: 'Ville du lotissement' },
      { token: 'lotissement.pays', label: 'Pays du lotissement' },
      { token: 'lotissement.natureTitre', label: 'Nature du titre sollicité (lotissement)' },
      { token: 'lotissement.numeroTitre', label: 'Numéro du titre obtenu (lotissement)' },
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
      { token: 'convention.delai', label: 'Délai (durée)' },
      { token: 'convention.nombreTerrains', label: 'Nombre de terrains rattachés' },
      { token: 'convention.fraisOuvertureDossier', label: "Frais d'ouverture de dossier" },
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

/** Calcule un libellé de délai (« 12 mois », « 18 mois », etc.) à partir des dates. */
function delayLabel(startVal?: string | Date | null, endVal?: string | Date | null): string {
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
    'client.pays': a.client?.country ?? '',
    'client.typePieceIdentite': a.client?.idType?.label ?? '',
    'client.pieceIdentite': a.client?.idNumber ?? '',
    'client.nationalite': a.client?.nationality ?? '',
    'client.dateNaissance': date(a.client?.birthDate),
    'client.lieuNaissance': a.client?.birthPlace ?? '',
    'cedant.nomComplet': clientName(a.secondaryClient),
    'cedant.civilite': a.secondaryClient?.civilite ?? '',
    'cedant.telephone': a.secondaryClient?.phone ?? a.secondaryClient?.mobile ?? '',
    'cedant.pays': a.secondaryClient?.country ?? '',
    'cedant.typePieceIdentite': a.secondaryClient?.idType?.label ?? '',
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
    'lotissement.nom': a.terrain?.lotissement?.nom ?? '',
    'lotissement.commune': a.terrain?.lotissement?.commune ?? '',
    'lotissement.ville': a.terrain?.lotissement?.ville ?? '',
    'lotissement.pays': a.terrain?.lotissement?.pays ?? '',
    'lotissement.natureTitre': a.terrain?.lotissement?.titleType?.label ?? '',
    'lotissement.numeroTitre': a.terrain?.lotissement?.titleNumber ?? '',
    'bien.reference': a.property?.reference ?? '',
    'bien.adresse': a.property?.address ?? '',
    'bien.ville': a.property?.city ?? '',
    'bien.superficie': a.property?.surface != null ? String(a.property.surface) : '',
    'convention.reference': a.convention?.reference ?? '',
    'convention.dateSignature': date(a.convention?.signedAt),
    'convention.delai': delayLabel(a.convention?.startDate, a.convention?.endDate),
    'convention.nombreTerrains': a.convention?._count?.terrains != null
      ? String(a.convention._count.terrains)
      : '',
    'convention.fraisOuvertureDossier': money(a.convention?.fraisOuvertureDossier),
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
