/**
 * Registre des formules du moteur de devis de construction (Module 17).
 *
 * Chaque quantité d'ouvrage calculée par ratio (ConstructionWorkItem.formulaCode)
 * correspond à UNE entrée de ce registre. Ajouter une formule = ajouter un
 * coefficient au catalogue (ConstructionRatioDefinition) + une entrée ici —
 * jamais une migration.
 *
 * Les formules ne touchent jamais la base de données : elles reçoivent un
 * contexte pur (`FormulaContext`) construit par construction-engine.service.ts
 * à partir d'un ConstructionProject normalisé et d'un profil de coefficients
 * résolu.
 */

export interface ProjectInputs {
  buildingType: string;
  standing: string;
  levels: number;
  roomCount: number;
  livingRoomCount: number;
  bedroomCount: number;
  bathroomCount: number;
  showerRoomCount: number;
  wcCount: number;
  surfaceHabitable: number;
  surfaceConstruite: number | null;
  kitchenType: string;
  roofType: string;
  joineryType: string;
  interiorJoineryType: string;
  flooringType: string;
  acType: string;
  acRoomCount: number | null;
  hasFalseCeiling: boolean;
  terrainType: string;
  terrainSurface: number | null;
  sanitationType: string;
  hasWaterConnection: boolean;
  hasElectricityConnection: boolean;
  fenceLength: number;
  fenceHeight: number;
  fenceHasCrepissage: boolean;
  fenceHasChainageHaut: boolean;
  fencePostType: string;
  gateCount: number;
  hasPool: boolean;
  poolSurface: number;
  hasExteriorLayout: boolean;
  exteriorPavedSurface: number;
  hasLandscaping: boolean;
}

/** Métriques géométriques dérivées, calculées une seule fois par exécution. */
export interface DerivedMetrics {
  surfaceUtile: number;
  surfaceConstruite: number;
  empriseAuSol: number;
  perimetreBatiment: number;
  hauteurSousPlafond: number;
  mlMursExterieurs: number;
  mlCloisonsInterieures: number;
  surfaceMursExt: number;
  surfaceMursInt: number;
  nbFenetres: number;
  surfaceFenetres: number;
  nbPortesExt: number;
  nbPortesInt: number;
  surfaceOuvertures: number;
  nbPiecesHumides: number;
  nbPiecesClimatisees: number;
  coefTerrain: number;
}

export interface FormulaContext {
  p: ProjectInputs;
  /** Valeur d'un ratio pour le profil courant (repli sur la valeur par défaut du catalogue). */
  r: (code: string) => number;
  d: DerivedMetrics;
  /** Résolution mémoïsée + récursive d'une autre formule (détection de cycle). */
  q: (formulaCode: string) => number;
  warn: (message: string) => void;
}

export interface FormulaResult {
  qty: number;
  trace: string;
}

export type FormulaFn = (ctx: FormulaContext) => FormulaResult;

const round = (v: number, dp = 2): number => Math.round(v * 10 ** dp) / 10 ** dp;
const f = (v: number, dp = 2): string => round(v, dp).toLocaleString('fr-FR', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Calcule les métriques géométriques dérivées à partir des caractéristiques du projet. */
export function computeDerivedMetrics(p: ProjectInputs, r: (code: string) => number): DerivedMetrics {
  const surfaceUtile = p.surfaceHabitable;
  const surfaceConstruite = p.surfaceConstruite ?? surfaceUtile * r('COEF_SURFACE_CONSTRUITE_SUR_UTILE');
  const empriseAuSol = surfaceConstruite / Math.max(1, p.levels);
  const perimetreBatiment = 4 * Math.sqrt(Math.max(0, empriseAuSol)) * r('COEF_FORME_PERIMETRE');
  const hauteurSousPlafond = r('HAUTEUR_SOUS_PLAFOND');
  const mlMursExterieurs = perimetreBatiment * p.levels;
  const mlCloisonsInterieures = surfaceUtile * r('ML_CLOISON_PAR_M2_UTILE');
  const surfaceMursExt = mlMursExterieurs * hauteurSousPlafond;
  const surfaceMursInt = mlCloisonsInterieures * hauteurSousPlafond;
  const nbFenetres = Math.ceil(p.roomCount * r('NB_FENETRES_PAR_PIECE'));
  const surfaceFenetres = nbFenetres * r('SURFACE_MOY_FENETRE');
  const nbPortesExt = Math.round(r('NB_PORTES_EXT'));
  const nbPortesInt = Math.ceil(p.roomCount * r('NB_PORTES_INT_PAR_PIECE'));
  const surfaceOuvertures = surfaceFenetres + nbPortesExt * r('SURFACE_MOY_PORTE_EXT');
  const nbPiecesHumides = p.bathroomCount + p.showerRoomCount + p.wcCount + (p.kitchenType !== 'NUE' ? 1 : 0);
  const nbPiecesClimatisees = p.acRoomCount ?? (
    p.acType === 'SPLIT_PARTIEL' ? p.bedroomCount + p.livingRoomCount
      : (p.acType === 'SPLIT_TOUTES_PIECES' || p.acType === 'GAINABLE_CENTRALISE') ? p.roomCount
        : 0
  );
  const coefTerrain = p.terrainType === 'FORTE_PENTE' || p.terrainType === 'LEGERE_PENTE' ? r('COEF_TERRAIN_PENTE')
    : p.terrainType === 'MARECAGEUX_REMBLAI' ? r('COEF_TERRAIN_MARECAGEUX')
      : p.terrainType === 'ROCHEUX' ? r('COEF_TERRAIN_ROCHEUX')
        : r('COEF_TERRAIN_PLAT');

  return {
    surfaceUtile, surfaceConstruite, empriseAuSol, perimetreBatiment, hauteurSousPlafond,
    mlMursExterieurs, mlCloisonsInterieures, surfaceMursExt, surfaceMursInt,
    nbFenetres, surfaceFenetres, nbPortesExt, nbPortesInt, surfaceOuvertures,
    nbPiecesHumides, nbPiecesClimatisees, coefTerrain,
  };
}

export const FORMULAS: Record<string, FormulaFn> = {};

// ── Terrassements ────────────────────────────────────────────────────────

FORMULAS['QTE_DECAPAGE'] = ({ d, r }) => {
  const qty = d.empriseAuSol * r('COEF_DECAPAGE');
  return { qty, trace: `${f(d.empriseAuSol)} m² d'emprise au sol × ${r('COEF_DECAPAGE')} (COEF_DECAPAGE) = ${f(qty)} m²` };
};

FORMULAS['QTE_FOUILLES_RIGOLES'] = ({ d, r }) => {
  const largeur = r('LARGEUR_SEMELLE') + 2 * r('SURPLUS_LARGEUR_BETON_PROPRETE');
  const profondeur = r('EPAISSEUR_SEMELLE') + r('EPAISSEUR_BETON_PROPRETE') + r('HAUTEUR_SOUBASSEMENT');
  const mlSemelles = d.perimetreBatiment + d.mlCloisonsInterieures * r('PART_MURS_PORTEURS');
  const qty = mlSemelles * largeur * profondeur * d.coefTerrain;
  return {
    qty,
    trace: `${f(mlSemelles)} ml × ${f(largeur)} m (largeur) × ${f(profondeur)} m (profondeur) × ${d.coefTerrain} (terrain) = ${f(qty)} m³`,
  };
};

FORMULAS['QTE_FOUILLES_PUITS'] = ({ d, r }) => {
  const nbPoteaux = Math.ceil(d.empriseAuSol / Math.max(1, r('SURFACE_PAR_POTEAU')));
  const qty = nbPoteaux * r('VOLUME_FOUILLE_PUITS_UNITAIRE') * d.coefTerrain;
  return {
    qty,
    trace: `${nbPoteaux} poteaux (${f(d.empriseAuSol)} m² / ${r('SURFACE_PAR_POTEAU')} m²) × ${r('VOLUME_FOUILLE_PUITS_UNITAIRE')} m³ × ${d.coefTerrain} (terrain) = ${f(qty)} m³`,
  };
};

FORMULAS['QTE_REMBLAI'] = ({ d, r }) => {
  const qty = d.empriseAuSol * r('COEF_DECAPAGE') * r('EPAISSEUR_REMBLAI');
  return { qty, trace: `${f(d.empriseAuSol)} m² × ${r('COEF_DECAPAGE')} × ${r('EPAISSEUR_REMBLAI')} m = ${f(qty)} m³` };
};

// ── Fondations ───────────────────────────────────────────────────────────

FORMULAS['QTE_BETON_PROPRETE'] = ({ d, r }) => {
  const largeur = r('LARGEUR_SEMELLE') + 2 * r('SURPLUS_LARGEUR_BETON_PROPRETE');
  const mlSemelles = d.perimetreBatiment + d.mlCloisonsInterieures;
  const qty = mlSemelles * largeur * r('EPAISSEUR_BETON_PROPRETE');
  return { qty, trace: `${f(mlSemelles)} ml × ${f(largeur)} m × ${r('EPAISSEUR_BETON_PROPRETE')} m = ${f(qty)} m³` };
};

FORMULAS['QTE_BETON_SEMELLES'] = ({ p, d, r }) => {
  const mlSemelles = d.perimetreBatiment + d.mlCloisonsInterieures * r('PART_MURS_PORTEURS');
  const majoration = 1 + (p.levels - 1) * r('MAJORATION_SEMELLE_PAR_NIVEAU');
  const qty = mlSemelles * r('LARGEUR_SEMELLE') * r('EPAISSEUR_SEMELLE') * majoration * d.coefTerrain;
  return {
    qty,
    trace: `${f(mlSemelles)} ml × ${r('LARGEUR_SEMELLE')} m × ${r('EPAISSEUR_SEMELLE')} m × ${f(majoration)} (niveaux) × ${d.coefTerrain} (terrain) = ${f(qty)} m³`,
  };
};

FORMULAS['QTE_MACONNERIE_SOUBASSEMENT'] = ({ d, r }) => {
  const qty = d.perimetreBatiment * r('HAUTEUR_SOUBASSEMENT');
  return { qty, trace: `${f(d.perimetreBatiment)} ml × ${r('HAUTEUR_SOUBASSEMENT')} m = ${f(qty)} m²` };
};

FORMULAS['QTE_CHAINAGE_BAS'] = ({ d }) => {
  const qty = d.perimetreBatiment + d.mlCloisonsInterieures;
  return { qty, trace: `${f(d.perimetreBatiment)} ml (périmètre) + ${f(d.mlCloisonsInterieures)} ml (refends) = ${f(qty)} ml` };
};

// ── Béton armé ───────────────────────────────────────────────────────────

FORMULAS['QTE_BETON_POTEAUX'] = ({ d, r }) => {
  const qty = d.surfaceConstruite * r('VOLUME_POTEAUX_PAR_M2');
  return { qty, trace: `${f(d.surfaceConstruite)} m² construits × ${r('VOLUME_POTEAUX_PAR_M2')} m³/m² = ${f(qty)} m³` };
};

FORMULAS['QTE_BETON_POUTRES'] = ({ d, r }) => {
  const qty = d.surfaceConstruite * r('VOLUME_POUTRES_PAR_M2');
  return { qty, trace: `${f(d.surfaceConstruite)} m² construits × ${r('VOLUME_POUTRES_PAR_M2')} m³/m² = ${f(qty)} m³` };
};

/** Surface de dalle en béton (planchers intermédiaires + toiture-terrasse le cas échéant). */
FORMULAS['QTE_DALLE_SURFACE'] = ({ p, d }) => {
  const dallesEtage = d.empriseAuSol * Math.max(0, p.levels - 1);
  const dalleToiture = p.roofType === 'DALLE_PLEINE' || p.roofType === 'MIXTE_DALLE_CHARPENTE' ? d.empriseAuSol : 0;
  const qty = dallesEtage + dalleToiture;
  return {
    qty,
    trace: `${f(dallesEtage)} m² (planchers d'étage) + ${f(dalleToiture)} m² (toiture-terrasse) = ${f(qty)} m²`,
  };
};

FORMULAS['QTE_BETON_DALLE'] = ({ r, q }) => {
  const surface = q('QTE_DALLE_SURFACE');
  const qty = surface * r('EPAISSEUR_DALLE');
  return { qty, trace: `${f(surface)} m² × ${r('EPAISSEUR_DALLE')} m = ${f(qty)} m³` };
};

FORMULAS['QTE_ACIER_HA'] = ({ r, q }) => {
  const parts: Array<[string, string]> = [
    ['QTE_BETON_SEMELLES', 'RATIO_ACIER_SEMELLES'],
    ['QTE_BETON_POTEAUX', 'RATIO_ACIER_POTEAUX'],
    ['QTE_BETON_POUTRES', 'RATIO_ACIER_POUTRES'],
    ['QTE_BETON_DALLE', 'RATIO_ACIER_DALLE'],
  ];
  let qty = 0;
  const bits: string[] = [];
  for (const [volCode, ratioCode] of parts) {
    const v = q(volCode);
    const k = r(ratioCode);
    qty += v * k;
    bits.push(`${f(v)} m³ × ${k} kg/m³`);
  }
  return { qty, trace: `${bits.join(' + ')} = ${f(qty, 0)} kg` };
};

FORMULAS['QTE_COFFRAGE'] = ({ r, q }) => {
  const volume = q('QTE_BETON_POTEAUX') + q('QTE_BETON_POUTRES');
  const qty = volume * r('COEF_COFFRAGE_PAR_M3');
  return { qty, trace: `(${f(q('QTE_BETON_POTEAUX'))} + ${f(q('QTE_BETON_POUTRES'))}) m³ × ${r('COEF_COFFRAGE_PAR_M3')} m²/m³ = ${f(qty)} m²` };
};

FORMULAS['QTE_ESCALIER'] = ({ p, r }) => {
  const qty = Math.max(0, p.levels - 1) * r('NB_ESCALIER_PAR_NIVEAU_SUP');
  return { qty, trace: `${Math.max(0, p.levels - 1)} niveau(x) supplémentaire(s) × ${r('NB_ESCALIER_PAR_NIVEAU_SUP')} = ${f(qty, 0)} u` };
};

// ── Maçonnerie & enduits ─────────────────────────────────────────────────

FORMULAS['QTE_MACONNERIE_AGGLO15'] = ({ d, r }) => {
  const partCloison = r('PART_CLOISON_AGGLO15');
  const deduc = r('COEF_DEDUCTION_OUVERTURES');
  const brut = d.surfaceMursExt + d.surfaceMursInt * partCloison;
  const qty = Math.max(0, brut - d.surfaceOuvertures * deduc);
  return {
    qty,
    trace: `(${f(d.surfaceMursExt)} m² murs ext + ${f(d.surfaceMursInt)} × ${partCloison} cloisons) − ${f(d.surfaceOuvertures)} m² ouvertures × ${deduc} = ${f(qty)} m²`,
  };
};

FORMULAS['QTE_MACONNERIE_AGGLO10'] = ({ d, r }) => {
  const partCloison = 1 - r('PART_CLOISON_AGGLO15');
  const qty = d.surfaceMursInt * partCloison;
  return { qty, trace: `${f(d.surfaceMursInt)} m² cloisons × ${f(partCloison)} (part agglo 10) = ${f(qty)} m²` };
};

FORMULAS['QTE_ENDUIT_INTERIEUR'] = ({ d }) => {
  const qty = 2 * d.surfaceMursInt + d.surfaceMursExt;
  return { qty, trace: `2 × ${f(d.surfaceMursInt)} m² (cloisons, 2 faces) + ${f(d.surfaceMursExt)} m² (face intérieure murs ext.) = ${f(qty)} m²` };
};

FORMULAS['QTE_ENDUIT_EXTERIEUR'] = ({ d, r }) => {
  const qty = Math.max(0, d.surfaceMursExt - d.surfaceOuvertures * r('COEF_DEDUCTION_OUVERTURES'));
  return { qty, trace: `${f(d.surfaceMursExt)} m² murs ext − ${f(d.surfaceOuvertures)} m² ouvertures × ${r('COEF_DEDUCTION_OUVERTURES')} = ${f(qty)} m²` };
};

FORMULAS['QTE_LINTEAUX'] = ({ d, r }) => {
  const nbOuvertures = d.nbFenetres + d.nbPortesExt + d.nbPortesInt;
  const qty = nbOuvertures * r('ML_LINTEAU_PAR_OUVERTURE');
  return { qty, trace: `${nbOuvertures} ouvertures × ${r('ML_LINTEAU_PAR_OUVERTURE')} ml = ${f(qty)} ml` };
};

// ── Électricité ──────────────────────────────────────────────────────────

FORMULAS['QTE_PRISES_COURANT'] = ({ p, r, d }) => {
  const parChambre = r('PRISES_PAR_CHAMBRE');
  const parSejour = r('PRISES_PAR_SEJOUR');
  const cuisine = r('PRISES_CUISINE');
  const circul = r('PRISES_CIRCULATION_PAR_NIVEAU');
  const parClim = r('PRISES_PAR_CLIM');
  const piscine = p.hasPool ? r('PRISES_EQUIPEMENT_PISCINE') : 0;
  const qty = Math.ceil(
    p.bedroomCount * parChambre
    + p.livingRoomCount * parSejour
    + cuisine
    + circul * p.levels
    + d.nbPiecesClimatisees * parClim
    + piscine,
  );
  return {
    qty,
    trace: `${p.bedroomCount}ch×${parChambre} + ${p.livingRoomCount}séj×${parSejour} + ${cuisine} (cuisine) `
      + `+ ${circul}×${p.levels} (circulations) + ${d.nbPiecesClimatisees}×${parClim} (clim)`
      + (piscine ? ` + ${piscine} (piscine)` : '') + ` = ${qty} u`,
  };
};

FORMULAS['QTE_POINTS_LUMINEUX'] = ({ p, r }) => {
  const qty = Math.ceil(p.roomCount * r('POINTS_LUMINEUX_PAR_PIECE'));
  return { qty, trace: `${p.roomCount} pièces × ${r('POINTS_LUMINEUX_PAR_PIECE')} = ${qty} u` };
};

FORMULAS['QTE_INTERRUPTEURS'] = ({ r, q }) => {
  const points = q('QTE_POINTS_LUMINEUX');
  const qty = Math.ceil(points * r('INTERRUPTEURS_PAR_POINT_LUMINEUX'));
  return { qty, trace: `${points} points lumineux × ${r('INTERRUPTEURS_PAR_POINT_LUMINEUX')} = ${qty} u` };
};

FORMULAS['QTE_TABLEAU'] = ({ p, r }) => {
  const qty = Math.max(1, Math.round(p.levels * r('TABLEAU_PAR_NIVEAU')));
  return { qty, trace: `${p.levels} niveau(x) × ${r('TABLEAU_PAR_NIVEAU')} = ${qty} u` };
};

FORMULAS['QTE_ALIM_CLIM'] = ({ d }) => {
  const qty = d.nbPiecesClimatisees;
  return { qty, trace: `${qty} pièce(s) climatisée(s) = ${qty} u` };
};

FORMULAS['QTE_ECLAIRAGE_EXT'] = ({ p, r }) => {
  const qty = r('POINTS_ECLAIRAGE_EXTERIEUR_BASE') + p.gateCount * r('POINTS_ECLAIRAGE_EXTERIEUR_PAR_PORTAIL');
  return { qty, trace: `${r('POINTS_ECLAIRAGE_EXTERIEUR_BASE')} (base) + ${p.gateCount} portail(s) × ${r('POINTS_ECLAIRAGE_EXTERIEUR_PAR_PORTAIL')} = ${f(qty, 0)} u` };
};

// ── Plomberie sanitaire ──────────────────────────────────────────────────

FORMULAS['QTE_ALIM_EF'] = ({ d, r }) => {
  const qty = d.nbPiecesHumides * r('ML_ALIM_EF_PAR_PIECE_HUMIDE');
  return { qty, trace: `${d.nbPiecesHumides} pièces humides × ${r('ML_ALIM_EF_PAR_PIECE_HUMIDE')} ml = ${f(qty)} ml` };
};

FORMULAS['QTE_EVAC_PVC100'] = ({ d, r }) => {
  const qty = d.nbPiecesHumides * r('ML_EVAC_PVC100_PAR_PIECE_HUMIDE');
  return { qty, trace: `${d.nbPiecesHumides} pièces humides × ${r('ML_EVAC_PVC100_PAR_PIECE_HUMIDE')} ml = ${f(qty)} ml` };
};

FORMULAS['QTE_EVAC_PVC40'] = ({ d, r }) => {
  const qty = d.nbPiecesHumides * r('ML_EVAC_PVC40_PAR_PIECE_HUMIDE');
  return { qty, trace: `${d.nbPiecesHumides} pièces humides × ${r('ML_EVAC_PVC40_PAR_PIECE_HUMIDE')} ml = ${f(qty)} ml` };
};

FORMULAS['QTE_REGARD'] = ({ p, r }) => {
  const qty = Math.max(1, Math.round(p.levels * r('NB_REGARD_PAR_NIVEAU')));
  return { qty, trace: `${p.levels} niveau(x) × ${r('NB_REGARD_PAR_NIVEAU')} = ${qty} u` };
};

// ── Revêtements sols & murs ──────────────────────────────────────────────

FORMULAS['QTE_CARRELAGE_SOL'] = ({ d, r }) => {
  const coef = r('COEF_REVETEMENT_SOL');
  const part = r('PART_SOL_CARRELE');
  const qty = Math.max(0, d.surfaceUtile * coef * part - d.nbPiecesHumides * r('SURFACE_MOY_PIECE_HUMIDE'));
  return {
    qty,
    trace: `${f(d.surfaceUtile)} m² × ${coef} (COEF_REVETEMENT_SOL) × ${part} (PART_SOL_CARRELE) − pièces humides = ${f(qty)} m²`,
  };
};

FORMULAS['QTE_CARRELAGE_ANTIDERAPANT'] = ({ d, r }) => {
  const qty = d.nbPiecesHumides * r('SURFACE_MOY_PIECE_HUMIDE');
  return { qty, trace: `${d.nbPiecesHumides} pièces humides × ${r('SURFACE_MOY_PIECE_HUMIDE')} m² = ${f(qty)} m²` };
};

FORMULAS['QTE_PLINTHES'] = ({ r, q }) => {
  const surface = q('QTE_CARRELAGE_SOL') + q('QTE_CARRELAGE_ANTIDERAPANT');
  const qty = surface * r('ML_PLINTHE_PAR_M2_CARRELAGE');
  return { qty, trace: `${f(surface)} m² carrelés × ${r('ML_PLINTHE_PAR_M2_CARRELAGE')} ml/m² = ${f(qty)} ml` };
};

FORMULAS['QTE_FAIENCE'] = ({ d, r }) => {
  const qty = d.nbPiecesHumides * r('SURFACE_FAIENCE_PAR_PIECE_HUMIDE');
  return { qty, trace: `${d.nbPiecesHumides} pièces humides × ${r('SURFACE_FAIENCE_PAR_PIECE_HUMIDE')} m² = ${f(qty)} m²` };
};

FORMULAS['QTE_CHAPE'] = ({ r, q }) => {
  const qty = q('QTE_CARRELAGE_SOL') + q('QTE_CARRELAGE_ANTIDERAPANT');
  return { qty, trace: `${f(q('QTE_CARRELAGE_SOL'))} m² (sol) + ${f(q('QTE_CARRELAGE_ANTIDERAPANT'))} m² (pièces humides) = ${f(qty)} m² (base de ${r('COEF_REVETEMENT_SOL')})` };
};

// ── Peinture ─────────────────────────────────────────────────────────────

FORMULAS['QTE_ENDUIT_LISSAGE'] = ({ q }) => {
  const qty = q('QTE_ENDUIT_INTERIEUR');
  return { qty, trace: `= surface d'enduit intérieur (QTE_ENDUIT_INTERIEUR) = ${f(qty)} m²` };
};

FORMULAS['QTE_PEINTURE_EAU_INT'] = ({ q }) => {
  const qty = q('QTE_ENDUIT_INTERIEUR');
  return { qty, trace: `= surface d'enduit intérieur (QTE_ENDUIT_INTERIEUR) = ${f(qty)} m²` };
};

FORMULAS['QTE_PEINTURE_EXT'] = ({ q }) => {
  const qty = q('QTE_ENDUIT_EXTERIEUR');
  return { qty, trace: `= surface d'enduit extérieur (QTE_ENDUIT_EXTERIEUR) = ${f(qty)} m²` };
};

// ── Charpente, couverture & étanchéité (LOT06) ──────────────────────────

FORMULAS['QTE_TOITURE_SURFACE'] = ({ d, r }) => {
  const qty = d.empriseAuSol * r('COEF_DEBORD_TOITURE');
  return { qty, trace: `${f(d.empriseAuSol)} m² d'emprise au sol × ${r('COEF_DEBORD_TOITURE')} (débord de toiture) = ${f(qty)} m²` };
};

FORMULAS['QTE_ETANCHEITE_TERRASSE'] = ({ d }) => {
  const qty = d.empriseAuSol;
  return { qty, trace: `= emprise au sol (toiture-terrasse) = ${f(qty)} m²` };
};

// ── Menuiserie aluminium / bois (LOT07 / LOT08) ─────────────────────────

FORMULAS['QTE_MENUISERIE_EXT'] = ({ d }) => {
  const qty = d.surfaceOuvertures;
  return { qty, trace: `= surface des ouvertures extérieures (fenêtres + portes) = ${f(qty)} m²` };
};

FORMULAS['QTE_PORTES_INTERIEURES'] = ({ d }) => {
  const qty = d.nbPortesInt;
  return { qty, trace: `= nombre de portes intérieures = ${qty} u` };
};

// ── Climatisation & ventilation (LOT11) ─────────────────────────────────

FORMULAS['QTE_CLIM_SPLIT'] = ({ d }) => {
  const qty = d.nbPiecesClimatisees;
  return { qty, trace: `= pièces climatisées = ${qty} u` };
};

FORMULAS['QTE_VENTILATION'] = ({ d, r }) => {
  const qty = d.surfaceUtile * r('ML_GAINE_VENTIL_PAR_M2');
  return { qty, trace: `${f(d.surfaceUtile)} m² × ${r('ML_GAINE_VENTIL_PAR_M2')} ml/m² = ${f(qty)} ml` };
};

FORMULAS['QTE_GAINABLE_SURFACE'] = ({ d }) => {
  const qty = d.surfaceUtile;
  return { qty, trace: `= surface utile (climatisation gainable) = ${f(qty)} m²` };
};

// ── Faux plafond (LOT13) ─────────────────────────────────────────────────

FORMULAS['QTE_FAUX_PLAFOND'] = ({ d, r }) => {
  const qty = d.surfaceUtile * r('PART_FAUX_PLAFOND');
  return { qty, trace: `${f(d.surfaceUtile)} m² × ${r('PART_FAUX_PLAFOND')} (part sous faux plafond) = ${f(qty)} m²` };
};

// ── Appareils sanitaires (LOT15) ─────────────────────────────────────────

FORMULAS['QTE_WC_TOTAL'] = ({ p }) => {
  const qty = p.wcCount + p.bathroomCount + p.showerRoomCount;
  return { qty, trace: `${p.wcCount} WC indépendants + ${p.bathroomCount} SDB + ${p.showerRoomCount} SDE = ${qty} u` };
};

FORMULAS['QTE_LAVABO'] = ({ p, r }) => {
  const qty = p.bathroomCount + p.showerRoomCount + r('LAVABO_SUPP_INVITES');
  return { qty, trace: `${p.bathroomCount} SDB + ${p.showerRoomCount} SDE + ${r('LAVABO_SUPP_INVITES')} (invités) = ${f(qty, 0)} u` };
};

FORMULAS['QTE_DOUCHE'] = ({ p, r }) => {
  const qty = p.showerRoomCount + p.bathroomCount * r('PART_DOUCHE_DANS_SDB');
  return { qty, trace: `${p.showerRoomCount} SDE + ${p.bathroomCount} SDB × ${r('PART_DOUCHE_DANS_SDB')} = ${f(qty, 0)} u` };
};

FORMULAS['QTE_BAIGNOIRE'] = ({ p, r }) => {
  const qty = p.bathroomCount * r('PART_BAIGNOIRE');
  return { qty, trace: `${p.bathroomCount} SDB × ${r('PART_BAIGNOIRE')} = ${f(qty, 0)} u` };
};

// ── Assainissement / VRD (LOT17 / LOT18) ─────────────────────────────────

FORMULAS['QTE_VRD_SURFACE'] = ({ p, d, r }) => {
  const base = Math.max(p.terrainSurface ?? 0, d.empriseAuSol * 1.5);
  const qty = base * r('COEF_VRD_PART');
  return { qty, trace: `max(${f(p.terrainSurface ?? 0)} m² terrain, ${f(d.empriseAuSol * 1.5)} m² estimé) × ${r('COEF_VRD_PART')} (COEF_VRD_PART) = ${f(qty)} m²` };
};

// ── Clôture (LOT19) ────────────────────────────────────────────────────────

// La clôture est détaillée en rubriques distinctes plutôt qu'un seul ouvrage
// lumpé, sur deux bases de quantité :
//  - QTE_CLOTURE_ML : longueur brute — infrastructure (fouille, fondation,
//    ferraillage, chaînage bas, chaînage haut optionnel), dimensionnée
//    indépendamment de la hauteur du mur dans ce modèle simplifié
//    (semelle/chaînage standard).
//  - QTE_CLOTURE_SURFACE : longueur × hauteur — surface réelle du mur, base
//    du montage (agglos) et du crépissage, qui sont les deux rubriques dont
//    le coût dépend directement de la hauteur saisie.
// Les poteaux (QTE_CLOTURE_POTEAUX) sont comptés à l'unité, indépendamment
// de la hauteur.

FORMULAS['QTE_CLOTURE_ML'] = ({ p }) => {
  const qty = p.fenceLength;
  return { qty, trace: `= longueur de clôture = ${f(qty)} ml` };
};

FORMULAS['QTE_CLOTURE_SURFACE'] = ({ p }) => {
  const qty = p.fenceLength * p.fenceHeight;
  return { qty, trace: `${f(p.fenceLength)} ml × ${f(p.fenceHeight)} m (hauteur) = ${f(qty)} m²` };
};

// 1 poteau tous les 3 ml + les deux extrémités — convention BTP courante pour
// un mur de clôture en agglos.
const FENCE_POST_SPACING_M = 3;

FORMULAS['QTE_CLOTURE_POTEAUX'] = ({ p }) => {
  if (p.fenceLength <= 0) return { qty: 0, trace: 'Longueur de clôture nulle = 0 u' };
  const qty = Math.ceil(p.fenceLength / FENCE_POST_SPACING_M) + 1;
  return { qty, trace: `${f(p.fenceLength)} ml, 1 poteau / ${FENCE_POST_SPACING_M} ml + extrémités = ${qty} u` };
};

FORMULAS['QTE_PORTAILS'] = ({ p }) => {
  const qty = p.gateCount;
  return { qty, trace: `= nombre de portails = ${qty} u` };
};

// ── Aménagements extérieurs (LOT20) ───────────────────────────────────────

FORMULAS['QTE_DALLAGE_EXT'] = ({ p }) => {
  const qty = p.exteriorPavedSurface;
  return { qty, trace: `= surface dallée/pavée renseignée = ${f(qty)} m²` };
};

FORMULAS['QTE_ESPACES_VERTS'] = ({ p, d, r }) => {
  const terrain = p.terrainSurface ?? d.empriseAuSol * 2;
  const qty = Math.max(0, terrain - d.empriseAuSol - p.exteriorPavedSurface) * r('COEF_ESPACES_VERTS_PART');
  return { qty, trace: `(${f(terrain)} m² terrain − ${f(d.empriseAuSol)} m² emprise − ${f(p.exteriorPavedSurface)} m² dallage) × ${r('COEF_ESPACES_VERTS_PART')} = ${f(qty)} m²` };
};

// ── Piscine (LOT21) ────────────────────────────────────────────────────────

FORMULAS['QTE_PISCINE_STRUCTURE'] = ({ p }) => {
  const qty = p.poolSurface;
  return { qty, trace: `= surface de piscine renseignée = ${f(qty)} m²` };
};

/** Ouvrage forfaitaire (quantité fixe = 1) — utilisé quand aucune formule ne s'applique. */
FORMULAS['QTE_FORFAIT'] = () => ({ qty: 1, trace: 'Forfait (quantité fixe = 1)' });

// ── Règle d'applicabilité déclarative ────────────────────────────────────
// Extraite dans un module partagé (applicability-rule.ts), générique et
// réutilisé tel quel par le moteur de devis de permis de construire.
// Ré-exportée ici pour ne rien changer aux imports existants.

export type { ApplicabilityRule } from './applicability-rule';
export { isApplicable } from './applicability-rule';
