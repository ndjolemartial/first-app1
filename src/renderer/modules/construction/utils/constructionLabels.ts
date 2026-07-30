/** Libellés français des énumérations du moteur de devis de construction (Module 17). */

export const BUILDING_TYPE_LABELS: Record<string, string> = {
  VILLA_BASSE: 'Villa basse (plain-pied)',
  VILLA_DUPLEX: 'Villa duplex (R+1)',
  VILLA_TRIPLEX: 'Villa triplex (R+2)',
  MAISON_ECONOMIQUE: 'Maison économique',
  IMMEUBLE_R_PLUS: 'Immeuble (R+2 et plus)',
  BUREAU: 'Bureau',
  COMMERCE: 'Commerce',
  ENTREPOT_HANGAR: 'Entrepôt / hangar',
  AUTRE: 'Autre',
};

export const STANDING_LABELS: Record<string, string> = {
  ECONOMIQUE: 'Économique',
  STANDARD: 'Standard',
  MOYEN_STANDING: 'Moyen standing',
  HAUT_STANDING: 'Haut standing',
  LUXE: 'Luxe',
};

export const ROOF_TYPE_LABELS: Record<string, string> = {
  DALLE_PLEINE: 'Dalle pleine (toiture-terrasse)',
  CHARPENTE_BOIS_TOLE: 'Charpente bois + tôle',
  CHARPENTE_BOIS_TUILE: 'Charpente bois + tuile',
  CHARPENTE_METALLIQUE_BAC: 'Charpente métallique + bac alu',
  MIXTE_DALLE_CHARPENTE: 'Mixte dalle / charpente',
};

export const JOINERY_TYPE_LABELS: Record<string, string> = {
  ALUMINIUM_STANDARD: 'Aluminium standard',
  ALUMINIUM_VITRAGE_TEINTE: 'Aluminium vitrage teinté',
  PVC: 'PVC',
  BOIS_MASSIF: 'Bois massif',
  METALLIQUE: 'Métallique',
  MIXTE_ALU_BOIS: 'Mixte alu / bois',
};

export const FLOORING_TYPE_LABELS: Record<string, string> = {
  CHAPE_LISSEE: 'Chape lissée',
  CARRELAGE_GRES_STANDARD: 'Carrelage grès standard',
  CARRELAGE_GRES_CERAME: 'Carrelage grès cérame',
  GRANITO: 'Granito',
  MARBRE: 'Marbre',
  PARQUET_BOIS: 'Parquet bois',
  MIXTE: 'Mixte',
};

export const AC_TYPE_LABELS: Record<string, string> = {
  AUCUNE: 'Aucune',
  VENTILATION_SEULE: 'Ventilation seule',
  SPLIT_PARTIEL: 'Split (chambres seulement)',
  SPLIT_TOUTES_PIECES: 'Split (toutes pièces)',
  GAINABLE_CENTRALISE: 'Gainable centralisée',
};

export const KITCHEN_TYPE_LABELS: Record<string, string> = {
  NUE: 'Nue (maçonnerie seule)',
  SIMPLE_PAILLASSE: 'Simple paillasse',
  EQUIPEE_STANDARD: 'Équipée standard',
  EQUIPEE_HAUT_DE_GAMME: 'Équipée haut de gamme',
};

export const TERRAIN_TYPE_LABELS: Record<string, string> = {
  PLAT: 'Plat',
  LEGERE_PENTE: 'Légère pente',
  FORTE_PENTE: 'Forte pente',
  MARECAGEUX_REMBLAI: 'Marécageux / remblai',
  ROCHEUX: 'Rocheux',
};

export const SANITATION_TYPE_LABELS: Record<string, string> = {
  FOSSE_SEPTIQUE_PUISARD: 'Fosse septique + puisard',
  FOSSE_TOUTES_EAUX_EPANDAGE: 'Fosse toutes eaux + épandage',
  MICRO_STATION: 'Micro-station',
  RACCORDEMENT_RESEAU_COLLECTIF: 'Raccordement réseau collectif',
  AUCUN: 'Aucun',
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

export const PRECISION_LEVEL_LABELS: Record<string, string> = {
  NIVEAU_1: 'Niveau 1 — Estimation rapide',
  NIVEAU_2: 'Niveau 2 — Devis détaillé',
  NIVEAU_3: 'Niveau 3 — DQE (métrés réels)',
};

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  MATERIAU: 'Matériau',
  MAIN_OEUVRE: 'Main d’œuvre',
  TRANSPORT: 'Transport',
  MATERIEL: 'Matériel',
  SOUS_TRAITANCE: 'Sous-traitance',
};

export const LOT_PHASE_LABELS: Record<string, string> = {
  GROS_OEUVRE: 'Gros œuvre',
  SECOND_OEUVRE: 'Second œuvre',
  ELECTRICITE: 'Électricité',
  PLOMBERIE: 'Plomberie',
  FINITIONS: 'Finitions',
  VRD: 'VRD',
  AMENAGEMENTS: 'Aménagements',
};

export function toOptions(labels: Record<string, string>): { value: string; label: string }[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}
