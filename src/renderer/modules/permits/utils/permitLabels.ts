/** Libellés français des énumérations du moteur de devis de permis de construire (Module 18). */

export const NATURE_LABELS: Record<string, string> = {
  VILLA: 'Villa',
  IMMEUBLE: 'Immeuble',
  COMMERCE: 'Commerce',
  BUREAU: 'Bureau',
  HOTEL: 'Hôtel',
  USINE: 'Usine',
  ENTREPOT: 'Entrepôt',
};

export const STANDING_LABELS: Record<string, string> = {
  ECONOMIQUE: 'Économique',
  STANDARD: 'Standard',
  MOYEN_STANDING: 'Moyen standing',
  HAUT_STANDING: 'Haut standing',
  LUXE: 'Luxe',
};

export const ZONE_TYPE_LABELS: Record<string, string> = {
  URBAINE: 'Urbaine',
  RURALE: 'Rurale',
};

export const MISSION_PHASE_LABELS: Record<string, string> = {
  ESQUISSE: 'Esquisse',
  APS: 'Avant-Projet Sommaire (APS)',
  APD: 'Avant-Projet Détaillé (APD)',
  PLANS_EXECUTION: "Plans d'exécution",
  SUIVI_CHANTIER: 'Suivi de chantier',
  RECEPTION: 'Réception des travaux',
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  ESTIME: 'Estimé',
  DEVIS_EMIS: 'Devis émis',
  ARCHIVE: 'Archivé',
};

export const PROJECT_STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  BROUILLON: 'default',
  ESTIME: 'info',
  DEVIS_EMIS: 'success',
  ARCHIVE: 'default',
};

export const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  VALIDE: 'Validée',
  CONVERTI: 'Convertie en devis',
  OBSOLETE: 'Obsolète',
};

export const FEE_CATEGORY_LABELS: Record<string, string> = {
  ARCHITECTE: 'Honoraires Architecte',
  BET_STRUCTURE: 'BET Structure',
  BET_FLUIDES: 'BET Fluides',
  BET_ELECTRICITE: 'BET Électricité',
  BET_VRD: 'BET VRD',
  BET_GEOTECHNIQUE: 'BET Géotechnique',
  GEOMETRE: 'Géomètre',
  ETUDE_SOL: 'Étude de sol',
  ETUDE_HYDROLOGIE: 'Étude hydrologique',
  ETUDE_ENVIRONNEMENT: "Étude d'impact environnemental",
  ETUDE_INCENDIE: 'Étude sécurité incendie',
  FRAIS_ADMINISTRATIF: 'Frais administratifs',
  TAXE: 'Taxes',
};

export const CALC_MODE_LABELS: Record<string, string> = {
  POURCENTAGE_COUT_TRAVAUX: '% du coût des travaux',
  FORFAIT: 'Forfait',
  PAR_M2_TERRAIN: 'FCFA / m² de terrain',
  PAR_M2_BATI: 'FCFA / m² bâti',
  BAREME_SURFACE: 'Barème par tranche de surface',
};

export function toOptions(labels: Record<string, string>): { value: string; label: string }[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

const currencyFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
export function formatFcfa(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${currencyFormatter.format(v)} FCFA`;
}
