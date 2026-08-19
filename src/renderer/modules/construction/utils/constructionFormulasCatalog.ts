/**
 * Catalogue de référence des formules de calcul du moteur de devis de
 * construction (Module 17) — reflet lisible (français, sans code) du
 * registre `FORMULAS` de `src/main/services/construction-formulas.ts`.
 *
 * Purement documentaire côté renderer : n'influence aucun calcul, sert à
 * « faire ressortir » les formules dans Paramètres → « Moteur de devis
 * construction » → « Formules de calcul » et dans le sélecteur de formule
 * de la Bibliothèque d'ouvrages. Toute formule ajoutée/modifiée dans
 * `construction-formulas.ts` doit être répercutée ici à la main.
 */

export interface FormulaCatalogEntry {
  code: string;
  category: string;
  label: string;
  description: string;
}

export const FORMULA_CATALOG: FormulaCatalogEntry[] = [
  // ── Terrassements ────────────────────────────────────────────────────
  { code: 'QTE_DECAPAGE', category: 'Terrassements', label: 'Décapage de terre végétale',
    description: "Emprise au sol × coefficient de décapage." },
  { code: 'QTE_FOUILLES_RIGOLES', category: 'Terrassements', label: 'Fouilles en rigoles (semelles filantes)',
    description: "Linéaire de semelles (périmètre du bâtiment + part des refends porteurs) × largeur × profondeur de fouille × coefficient du type de terrain." },
  { code: 'QTE_FOUILLES_PUITS', category: 'Terrassements', label: 'Fouilles en puits (semelles isolées)',
    description: "Nombre de poteaux (emprise au sol ÷ surface par poteau) × volume de fouille unitaire × coefficient du type de terrain." },
  { code: 'QTE_REMBLAI', category: 'Terrassements', label: 'Remblai',
    description: "Emprise au sol × coefficient de décapage × épaisseur de remblai." },

  // ── Fondations ───────────────────────────────────────────────────────
  { code: 'QTE_BETON_PROPRETE', category: 'Fondations', label: 'Béton de propreté',
    description: "Linéaire de semelles (murs + refends) × largeur de semelle × épaisseur de béton de propreté." },
  { code: 'QTE_BETON_SEMELLES', category: 'Fondations', label: 'Béton armé des semelles filantes',
    description: "Linéaire de semelles × largeur × épaisseur × majoration selon le nombre de niveaux × coefficient du type de terrain." },
  { code: 'QTE_MACONNERIE_SOUBASSEMENT', category: 'Fondations', label: 'Maçonnerie de soubassement',
    description: "Périmètre du bâtiment × hauteur de soubassement." },
  { code: 'QTE_CHAINAGE_BAS', category: 'Fondations', label: 'Chaînage bas',
    description: "Périmètre du bâtiment + linéaire des refends intérieurs." },

  // ── Béton armé ───────────────────────────────────────────────────────
  { code: 'QTE_BETON_POTEAUX', category: 'Béton armé', label: 'Béton armé des poteaux',
    description: "Surface construite × volume de béton de poteaux par m² construit." },
  { code: 'QTE_BETON_POUTRES', category: 'Béton armé', label: 'Béton armé des poutres',
    description: "Surface construite × volume de béton de poutres par m² construit." },
  { code: 'QTE_DALLE_SURFACE', category: 'Béton armé', label: 'Surface de dalle (planchers + toiture-terrasse)',
    description: "Emprise au sol × (niveaux − 1) pour les planchers d'étage, + emprise au sol si la toiture est en dalle pleine ou mixte." },
  { code: 'QTE_BETON_DALLE', category: 'Béton armé', label: 'Béton armé des dalles',
    description: "Surface de dalle (QTE_DALLE_SURFACE) × épaisseur de dalle." },
  { code: 'QTE_ACIER_HA', category: 'Béton armé', label: 'Acier haute adhérence (HA)',
    description: "Somme, pour semelles/poteaux/poutres/dalle, du volume de béton correspondant × son ratio d'acier au m³." },
  { code: 'QTE_COFFRAGE', category: 'Béton armé', label: 'Coffrage poteaux/poutres',
    description: "(Volume béton poteaux + volume béton poutres) × coefficient de surface de coffrage par m³." },
  { code: 'QTE_ESCALIER', category: 'Béton armé', label: 'Escaliers',
    description: "(Niveaux − 1) × nombre d'escaliers par niveau supplémentaire." },

  // ── Maçonnerie & enduits ─────────────────────────────────────────────
  { code: 'QTE_MACONNERIE_AGGLO15', category: 'Maçonnerie & enduits', label: 'Maçonnerie agglos de 15 (murs porteurs)',
    description: "Surface des murs extérieurs + part des cloisons intérieures montées en agglo 15, moins la surface des ouvertures (déduction partielle)." },
  { code: 'QTE_MACONNERIE_AGGLO10', category: 'Maçonnerie & enduits', label: 'Maçonnerie agglos de 10 (cloisons)',
    description: "Surface des cloisons intérieures × part non montée en agglo 15 (complément)." },
  { code: 'QTE_ENDUIT_INTERIEUR', category: 'Maçonnerie & enduits', label: 'Enduit intérieur',
    description: "2 × surface des cloisons intérieures (deux faces) + surface intérieure des murs extérieurs (une face)." },
  { code: 'QTE_ENDUIT_EXTERIEUR', category: 'Maçonnerie & enduits', label: 'Enduit extérieur',
    description: "Surface des murs extérieurs moins la surface des ouvertures (déduction partielle)." },
  { code: 'QTE_LINTEAUX', category: 'Maçonnerie & enduits', label: 'Linteaux',
    description: "Nombre total d'ouvertures (fenêtres + portes extérieures + portes intérieures) × linéaire de linteau par ouverture." },

  // ── Électricité ──────────────────────────────────────────────────────
  { code: 'QTE_PRISES_COURANT', category: 'Électricité', label: 'Prises de courant',
    description: "Chambres × taux/chambre + séjours × taux/séjour + forfait cuisine + circulations × niveaux + pièces climatisées × taux/clim + équipement piscine le cas échéant." },
  { code: 'QTE_POINTS_LUMINEUX', category: 'Électricité', label: 'Points lumineux',
    description: "Nombre de pièces × points lumineux par pièce." },
  { code: 'QTE_INTERRUPTEURS', category: 'Électricité', label: 'Interrupteurs',
    description: "Nombre de points lumineux (QTE_POINTS_LUMINEUX) × interrupteurs par point lumineux." },
  { code: 'QTE_TABLEAU', category: 'Électricité', label: 'Tableaux électriques',
    description: "Niveaux × tableaux par niveau (minimum 1)." },
  { code: 'QTE_ALIM_CLIM', category: 'Électricité', label: 'Alimentations climatisation',
    description: "Nombre de pièces climatisées." },
  { code: 'QTE_ECLAIRAGE_EXT', category: 'Électricité', label: 'Points d’éclairage extérieur',
    description: "Forfait de base + nombre de portails × points d'éclairage par portail." },

  // ── Plomberie sanitaire ──────────────────────────────────────────────
  { code: 'QTE_ALIM_EF', category: 'Plomberie sanitaire', label: 'Alimentation eau froide',
    description: "Nombre de pièces humides (SDB + SDE + WC + cuisine équipée) × linéaire d'alimentation par pièce humide." },
  { code: 'QTE_EVAC_PVC100', category: 'Plomberie sanitaire', label: 'Évacuation PVC Ø100',
    description: "Nombre de pièces humides × linéaire d'évacuation Ø100 par pièce humide." },
  { code: 'QTE_EVAC_PVC40', category: 'Plomberie sanitaire', label: 'Évacuation PVC Ø40',
    description: "Nombre de pièces humides × linéaire d'évacuation Ø40 par pièce humide." },
  { code: 'QTE_REGARD', category: 'Plomberie sanitaire', label: 'Regards d’évacuation',
    description: "Niveaux × regards par niveau (minimum 1)." },

  // ── Revêtements sols & murs ──────────────────────────────────────────
  { code: 'QTE_CARRELAGE_SOL', category: 'Revêtements sols & murs', label: 'Carrelage sol (pièces sèches)',
    description: "Surface utile × coefficient de revêtement de sol × part carrelée, moins la surface déjà comptée en pièces humides." },
  { code: 'QTE_CARRELAGE_ANTIDERAPANT', category: 'Revêtements sols & murs', label: 'Carrelage antidérapant (pièces humides)',
    description: "Nombre de pièces humides × surface moyenne par pièce humide." },
  { code: 'QTE_PLINTHES', category: 'Revêtements sols & murs', label: 'Plinthes',
    description: "Surface carrelée totale (sol + pièces humides) × linéaire de plinthe par m² carrelé." },
  { code: 'QTE_FAIENCE', category: 'Revêtements sols & murs', label: 'Faïence murale',
    description: "Nombre de pièces humides × surface de faïence par pièce humide." },
  { code: 'QTE_CHAPE', category: 'Revêtements sols & murs', label: 'Chape de ragréage',
    description: "Surface carrelée totale (sol + pièces humides), base de pose avant revêtement." },

  // ── Peinture ─────────────────────────────────────────────────────────
  { code: 'QTE_ENDUIT_LISSAGE', category: 'Peinture', label: 'Enduit de lissage',
    description: "= surface d'enduit intérieur (QTE_ENDUIT_INTERIEUR)." },
  { code: 'QTE_PEINTURE_EAU_INT', category: 'Peinture', label: 'Peinture intérieure',
    description: "= surface d'enduit intérieur (QTE_ENDUIT_INTERIEUR)." },
  { code: 'QTE_PEINTURE_EXT', category: 'Peinture', label: 'Peinture extérieure',
    description: "= surface d'enduit extérieur (QTE_ENDUIT_EXTERIEUR)." },

  // ── Charpente, couverture & étanchéité ───────────────────────────────
  { code: 'QTE_TOITURE_SURFACE', category: 'Charpente, couverture & étanchéité', label: 'Surface de toiture',
    description: "Emprise au sol × coefficient de débord de toiture." },
  { code: 'QTE_ETANCHEITE_TERRASSE', category: 'Charpente, couverture & étanchéité', label: 'Étanchéité toiture-terrasse',
    description: "= emprise au sol (surface à étancher en toiture-terrasse)." },

  // ── Menuiserie aluminium / bois ───────────────────────────────────────
  { code: 'QTE_MENUISERIE_EXT', category: 'Menuiserie aluminium / bois', label: 'Menuiserie extérieure',
    description: "= surface des ouvertures extérieures (fenêtres + portes)." },
  { code: 'QTE_PORTES_INTERIEURES', category: 'Menuiserie aluminium / bois', label: 'Portes intérieures',
    description: "= nombre de portes intérieures." },

  // ── Climatisation & ventilation ───────────────────────────────────────
  { code: 'QTE_CLIM_SPLIT', category: 'Climatisation & ventilation', label: 'Splits de climatisation',
    description: "= nombre de pièces climatisées." },
  { code: 'QTE_VENTILATION', category: 'Climatisation & ventilation', label: 'Gaines de ventilation',
    description: "Surface utile × linéaire de gaine par m²." },
  { code: 'QTE_GAINABLE_SURFACE', category: 'Climatisation & ventilation', label: 'Surface climatisée (gainable centralisé)',
    description: "= surface utile du logement." },

  // ── Faux plafond ─────────────────────────────────────────────────────
  { code: 'QTE_FAUX_PLAFOND', category: 'Faux plafond', label: 'Faux plafond',
    description: "Surface utile × part de surface sous faux plafond." },

  // ── Appareils sanitaires ─────────────────────────────────────────────
  { code: 'QTE_WC_TOTAL', category: 'Appareils sanitaires', label: 'Cuvettes WC',
    description: "WC indépendants + salles de bains + salles d'eau." },
  { code: 'QTE_LAVABO', category: 'Appareils sanitaires', label: 'Lavabos',
    description: "Salles de bains + salles d'eau + lavabos supplémentaires (invités)." },
  { code: 'QTE_DOUCHE', category: 'Appareils sanitaires', label: 'Douches',
    description: "Salles d'eau + salles de bains × part équipée en douche." },
  { code: 'QTE_BAIGNOIRE', category: 'Appareils sanitaires', label: 'Baignoires',
    description: "Salles de bains × part équipée en baignoire." },

  // ── Assainissement / VRD ─────────────────────────────────────────────
  { code: 'QTE_VRD_SURFACE', category: 'Assainissement / VRD', label: 'Surface VRD',
    description: "Maximum entre la surface du terrain renseignée et 1,5 × l'emprise au sol (estimation à défaut), × part VRD." },

  // ── Clôture & portail ────────────────────────────────────────────────
  { code: 'QTE_CLOTURE_ML', category: 'Clôture & portail', label: 'Clôture — infrastructure (ml)',
    description: "= longueur de clôture renseignée — base des rubriques fouille, fondation, ferraillage et chaînage bas, dimensionnées indépendamment de la hauteur du mur." },
  { code: 'QTE_CLOTURE_SURFACE', category: 'Clôture & portail', label: 'Clôture — surface du mur (m²)',
    description: "= longueur de clôture × hauteur de clôture (2,00 m par défaut si non renseignée) — base des rubriques montage du mur et crépissage : c'est ici que la hauteur pèse sur le montant du devis." },
  { code: 'QTE_CLOTURE_POTEAUX', category: 'Clôture & portail', label: 'Clôture — poteaux',
    description: "= nombre de poteaux, à raison d'un poteau tous les 3 ml plus les deux extrémités (indépendant de la hauteur) — type sortant ou simple selon le choix renseigné sur le projet." },
  { code: 'QTE_PORTAILS', category: 'Clôture & portail', label: 'Portails',
    description: "= nombre de portails renseigné sur le projet." },

  // ── Aménagements extérieurs ──────────────────────────────────────────
  { code: 'QTE_DALLAGE_EXT', category: 'Aménagements extérieurs', label: 'Dallage / pavage extérieur',
    description: "= surface dallée/pavée renseignée sur le projet." },
  { code: 'QTE_ESPACES_VERTS', category: 'Aménagements extérieurs', label: 'Espaces verts',
    description: "(Surface du terrain − emprise au sol − surface dallée extérieure) × part en espaces verts." },

  // ── Piscine ──────────────────────────────────────────────────────────
  { code: 'QTE_PISCINE_STRUCTURE', category: 'Piscine', label: 'Structure de piscine',
    description: "= surface de piscine renseignée sur le projet." },

  // ── Forfait ──────────────────────────────────────────────────────────
  { code: 'QTE_FORFAIT', category: 'Forfait', label: 'Quantité forfaitaire',
    description: "Quantité fixe = 1 — utilisé pour un ouvrage sans formule de calcul par ratio (quantité ou % du total saisi directement sur l'ouvrage)." },
];

export const FORMULA_LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  FORMULA_CATALOG.map((f) => [f.code, f.label]),
);
