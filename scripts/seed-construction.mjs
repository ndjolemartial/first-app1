/**
 * Seed idempotent de la bibliothèque du moteur de devis de construction
 * (Module 17) : 22 lots (bibliothèque d'ouvrages complète sur les 22 — les
 * 12 lots complémentaires — charpente/couverture, menuiserie alu/bois,
 * climatisation, faux plafond, appareils sanitaires, cuisine, assainissement,
 * VRD, clôture, aménagements extérieurs, piscine — portent des ouvrages
 * CONDITIONNELS n'apparaissant sur un devis que si le projet a la
 * caractéristique correspondante, ex. pas de piscine ⇒ pas de ligne piscine),
 * familles/localités de référence, bordereau de prix (~90 ressources),
 * ~70 ouvrages (recettes) au total, catalogue de coefficients (~60) et
 * 2 profils de coefficients (Villa basse × Moyen standing / Haut standing).
 *
 * ⚠️ Les prix, ratios et compositions d'ouvrages livrés ici sont des valeurs
 * de référence INDICATIVES (marché ivoirien, ordre de grandeur) — à vérifier
 * et ajuster avant toute exploitation commerciale (cf. CLAUDE.md Module 17).
 *
 * Idempotent : réexécutable sans doublon (upsert par code/label unique).
 * Usage : node scripts/seed-construction.mjs [--demo] [--reset-prices]
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const args = process.argv.slice(2);
const withDemo = args.includes('--demo');
const resetPrices = args.includes('--reset-prices');

// ── 1. Les 22 lots ──────────────────────────────────────────────────────
const LOTS = [
  ['LOT01', 1, 'Installation de chantier & travaux préparatoires', 'GROS_OEUVRE'],
  ['LOT02', 2, 'Terrassements', 'GROS_OEUVRE'],
  ['LOT03', 3, 'Fondations', 'GROS_OEUVRE'],
  ['LOT04', 4, 'Béton armé / Structure', 'GROS_OEUVRE'],
  ['LOT05', 5, 'Maçonnerie & enduits', 'GROS_OEUVRE'],
  ['LOT06', 6, 'Charpente, couverture & étanchéité', 'GROS_OEUVRE'],
  ['LOT07', 7, 'Menuiserie aluminium & vitrerie', 'SECOND_OEUVRE'],
  ['LOT08', 8, 'Menuiserie bois', 'SECOND_OEUVRE'],
  ['LOT09', 9, 'Électricité', 'ELECTRICITE'],
  ['LOT10', 10, 'Plomberie sanitaire', 'PLOMBERIE'],
  ['LOT11', 11, 'Climatisation & ventilation', 'SECOND_OEUVRE'],
  ['LOT12', 12, 'Revêtements sols & murs', 'FINITIONS'],
  ['LOT13', 13, 'Faux plafond', 'FINITIONS'],
  ['LOT14', 14, 'Peinture', 'FINITIONS'],
  ['LOT15', 15, 'Appareils sanitaires', 'PLOMBERIE'],
  ['LOT16', 16, 'Cuisine', 'SECOND_OEUVRE'],
  ['LOT17', 17, 'Assainissement', 'VRD'],
  ['LOT18', 18, 'VRD (voirie & réseaux divers)', 'VRD'],
  ['LOT19', 19, 'Clôture & portail', 'AMENAGEMENTS'],
  ['LOT20', 20, 'Aménagements extérieurs', 'AMENAGEMENTS'],
  ['LOT21', 21, 'Piscine', 'AMENAGEMENTS'],
  ['LOT22', 22, 'Nettoyage & réception', 'FINITIONS'],
];

// ── 2. Familles de ressources ────────────────────────────────────────────
const FAMILIES = [
  'Ciments & liants', 'Agrégats', 'Aciers', 'Agglomérés', 'Coffrage', 'Couverture',
  'Revêtements', 'Peinture', 'Électricité', 'Plomberie / sanitaires', 'Main d\'œuvre', 'Transport / matériel',
  'Menuiserie', 'Climatisation', 'Faux plafond', 'Appareils sanitaires', 'Cuisine',
  'Assainissement', 'VRD', 'Clôture', 'Aménagements extérieurs', 'Piscine',
];

// ── 3. Localités (coefficient de prix vs Abidjan = référence) ──────────
const LOCALITIES = [
  ['Abidjan', 'Sud', 1.000],
  ['Grand-Bassam / Bingerville', 'Sud', 1.020],
  ['Yamoussoukro', 'Centre', 1.060],
  ['Bouaké', 'Centre-Nord', 1.080],
  ['Daloa', 'Centre-Ouest', 1.090],
  ['San-Pédro', 'Sud-Ouest', 1.070],
  ['Korhogo', 'Nord', 1.140],
  ['Man', 'Ouest', 1.150],
];

// ── 4. Bordereau des prix de base (rendu chantier Abidjan, FCFA) ───────
// [code, label, type, family, unit, unitPrice, quality]
const RESOURCES = [
  // Ciments & liants
  ['MAT.CIMENT.CPJ35', 'Ciment CPJ 35 — sac de 50 kg', 'MATERIAU', 'Ciments & liants', 'sac', 4500, 'CPJ 35'],
  ['MAT.CIMENT.CPA45', 'Ciment CPA 45 — sac de 50 kg', 'MATERIAU', 'Ciments & liants', 'sac', 5600, 'CPA 45'],
  ['MAT.CHAUX', 'Chaux hydraulique — sac de 50 kg', 'MATERIAU', 'Ciments & liants', 'sac', 6000, null],
  // Agrégats
  ['MAT.SABLE.LAGUNE', 'Sable de lagune', 'MATERIAU', 'Agrégats', 'm³', 12000, null],
  ['MAT.SABLE.MER', 'Sable de mer', 'MATERIAU', 'Agrégats', 'm³', 10000, null],
  ['MAT.GRAVIER.5_15', 'Gravier 5/15', 'MATERIAU', 'Agrégats', 'm³', 18000, null],
  ['MAT.GRAVIER.15_25', 'Gravier 15/25', 'MATERIAU', 'Agrégats', 'm³', 17000, null],
  ['MAT.LATERITE', 'Latérite (remblai)', 'MATERIAU', 'Agrégats', 'm³', 8000, null],
  // Aciers
  ['MAT.FER.HA8', 'Fer à béton HA 8', 'MATERIAU', 'Aciers', 'kg', 650, 'HA Fe500'],
  ['MAT.FER.HA10', 'Fer à béton HA 10', 'MATERIAU', 'Aciers', 'kg', 645, 'HA Fe500'],
  ['MAT.FER.HA12', 'Fer à béton HA 12', 'MATERIAU', 'Aciers', 'kg', 640, 'HA Fe500'],
  ['MAT.FER.HA14', 'Fer à béton HA 14', 'MATERIAU', 'Aciers', 'kg', 640, 'HA Fe500'],
  ['MAT.FIL.ATTACHE', 'Fil d\'attache recuit', 'MATERIAU', 'Aciers', 'kg', 1400, null],
  // Agglomérés
  ['MAT.AGGLO.15', 'Agglo creux de 15', 'MATERIAU', 'Agglomérés', 'u', 400, null],
  ['MAT.AGGLO.20', 'Agglo creux de 20', 'MATERIAU', 'Agglomérés', 'u', 500, null],
  ['MAT.AGGLO.10', 'Agglo creux de 10', 'MATERIAU', 'Agglomérés', 'u', 330, null],
  // Coffrage
  ['MAT.BOIS.COFFRAGE', 'Bois de coffrage (amorti)', 'MATERIAU', 'Coffrage', 'm²', 2500, null],
  ['MAT.HUILE.DECOFFRAGE', 'Huile de décoffrage', 'MATERIAU', 'Coffrage', 'l', 2500, null],
  // Couverture
  ['MAT.TOLE.BAC.ALU', 'Tôle bac aluminium', 'MATERIAU', 'Couverture', 'm²', 9000, null],
  ['MAT.BOIS.CHARPENTE', 'Bois de charpente', 'MATERIAU', 'Couverture', 'm³', 350000, null],
  ['MAT.ETANCHEITE.BICOUCHE', 'Étanchéité bicouche', 'MATERIAU', 'Couverture', 'm²', 12000, null],
  // Revêtements
  ['MAT.CARRELAGE.GRES.40', 'Carrelage grès 40×40 standard', 'MATERIAU', 'Revêtements', 'm²', 6500, 'standard'],
  ['MAT.CARRELAGE.GRES.CERAME.60', 'Carrelage grès cérame 60×60', 'MATERIAU', 'Revêtements', 'm²', 12500, 'grès cérame'],
  ['MAT.FAIENCE.MURALE', 'Faïence murale', 'MATERIAU', 'Revêtements', 'm²', 7500, null],
  ['MAT.PLINTHE', 'Plinthe carrelage', 'MATERIAU', 'Revêtements', 'ml', 1500, null],
  ['MAT.COLLE.CARRELAGE', 'Colle à carrelage — sac 25 kg', 'MATERIAU', 'Revêtements', 'sac', 3800, null],
  ['MAT.JOINT.CARRELAGE', 'Joint de carrelage', 'MATERIAU', 'Revêtements', 'kg', 2500, null],
  // Peinture
  ['MAT.PEINTURE.EAU', 'Peinture à eau', 'MATERIAU', 'Peinture', 'l', 1100, null],
  ['MAT.PEINTURE.GLYCERO', 'Peinture glycéro (extérieure)', 'MATERIAU', 'Peinture', 'l', 2400, null],
  ['MAT.ENDUIT.LISSAGE', 'Enduit de lissage — sac', 'MATERIAU', 'Peinture', 'sac', 4500, null],
  // Électricité
  ['MAT.FIL.1_5', 'Fil électrique 1,5 mm²', 'MATERIAU', 'Électricité', 'ml', 130, null],
  ['MAT.FIL.2_5', 'Fil électrique 2,5 mm²', 'MATERIAU', 'Électricité', 'ml', 210, null],
  ['MAT.GAINE.ICTA16', 'Gaine ICTA 16', 'MATERIAU', 'Électricité', 'ml', 260, null],
  ['MAT.PRISE.2P_T', 'Prise 2P+T', 'MATERIAU', 'Électricité', 'u', 2500, null],
  ['MAT.INTERRUPTEUR', 'Interrupteur simple/va-et-vient', 'MATERIAU', 'Électricité', 'u', 2000, null],
  ['MAT.POINT.LUMINEUX', 'Point lumineux (douille + accessoires)', 'MATERIAU', 'Électricité', 'u', 3500, null],
  ['MAT.TABLEAU.DIVISIONNAIRE', 'Tableau divisionnaire équipé', 'MATERIAU', 'Électricité', 'u', 85000, null],
  ['MAT.APPLIQUE.EXT', 'Applique / point lumineux extérieur', 'MATERIAU', 'Électricité', 'u', 6500, null],
  // Plomberie / sanitaires
  ['MAT.PVC.100', 'Tuyau PVC évacuation Ø100', 'MATERIAU', 'Plomberie / sanitaires', 'ml', 4500, null],
  ['MAT.PVC.40', 'Tuyau PVC évacuation Ø40', 'MATERIAU', 'Plomberie / sanitaires', 'ml', 1300, null],
  ['MAT.PPR.20', 'Tube PPR Ø20 (alimentation)', 'MATERIAU', 'Plomberie / sanitaires', 'ml', 1800, null],
  ['MAT.REGARD.BETON', 'Regard de visite préfabriqué', 'MATERIAU', 'Plomberie / sanitaires', 'u', 35000, null],
  ['MAT.ALIM.COMPTEUR', 'Kit alimentation générale + compteur', 'MATERIAU', 'Plomberie / sanitaires', 'forfait', 150000, null],
  // Main d'œuvre (taux horaires)
  ['MO.MACON', 'Maçon (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 1250, null],
  ['MO.MANOEUVRE', 'Manœuvre (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 750, null],
  ['MO.FERRAILLEUR', 'Ferrailleur (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 1500, null],
  ['MO.COFFREUR', 'Coffreur (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 1500, null],
  ['MO.CARRELEUR', 'Carreleur (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 1500, null],
  ['MO.PEINTRE', 'Peintre (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 1250, null],
  ['MO.ELECTRICIEN', 'Électricien (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 1875, null],
  ['MO.PLOMBIER', 'Plombier (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 1875, null],
  ['MO.CHARPENTIER', 'Charpentier (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 1500, null],
  ['MO.CHEF.CHANTIER', 'Chef de chantier (heure)', 'MAIN_OEUVRE', "Main d'œuvre", 'h', 2500, null],
  // Transport / matériel
  ['TR.CAMION.10T', 'Rotation camion 10T', 'TRANSPORT', 'Transport / matériel', 'rotation', 45000, null],
  ['MTL.BETONNIERE', 'Location bétonnière (jour)', 'MATERIEL', 'Transport / matériel', 'jour', 25000, null],
  // Charpente & couverture (complément)
  ['MAT.TUILE', 'Tuile de couverture', 'MATERIAU', 'Couverture', 'm²', 8500, null],
  ['MAT.CHARPENTE.METAL', 'Charpente métallique (structure)', 'MATERIAU', 'Couverture', 'm²', 15000, null],
  // Menuiserie
  ['MAT.ALU.FENETRE.STD', 'Châssis alu standard + vitrage clair', 'MATERIAU', 'Menuiserie', 'm²', 45000, 'standard'],
  ['MAT.ALU.FENETRE.TEINTE', 'Châssis alu + vitrage teinté/feuilleté', 'MATERIAU', 'Menuiserie', 'm²', 65000, 'teinté'],
  ['MAT.PORTE.BOIS.INT', 'Porte intérieure bois (bloc-porte)', 'MATERIAU', 'Menuiserie', 'u', 45000, null],
  ['MAT.PORTE.BOIS.EXT', 'Porte/fenêtre extérieure bois massif', 'MATERIAU', 'Menuiserie', 'm²', 55000, 'bois massif'],
  ['MO.MENUISIER', 'Menuisier (heure)', 'MAIN_OEUVRE', 'Main d\'œuvre', 'h', 1500, null],
  // Climatisation & ventilation
  ['MAT.CLIM.SPLIT.9000', 'Climatiseur split 9000-12000 BTU', 'MATERIAU', 'Climatisation', 'u', 285000, null],
  ['MAT.GAINE.VENTIL', 'Gaine de ventilation', 'MATERIAU', 'Climatisation', 'ml', 3500, null],
  ['MAT.CLIM.GAINABLE', 'Kit climatisation gainable (par m²)', 'MATERIAU', 'Climatisation', 'm²', 45000, null],
  ['MO.FRIGORISTE', 'Frigoriste / technicien clim (heure)', 'MAIN_OEUVRE', 'Main d\'œuvre', 'h', 2000, null],
  // Faux plafond
  ['MAT.PLAFOND.PVC', 'Dalles de faux plafond PVC', 'MATERIAU', 'Faux plafond', 'm²', 6500, null],
  ['MAT.OSSATURE.PLAFOND', 'Ossature métallique faux plafond', 'MATERIAU', 'Faux plafond', 'm²', 3500, null],
  ['MO.PLAQUISTE', 'Plaquiste / poseur faux plafond (heure)', 'MAIN_OEUVRE', 'Main d\'œuvre', 'h', 1500, null],
  // Appareils sanitaires
  ['MAT.WC.COMPLET', 'WC complet avec réservoir', 'MATERIAU', 'Appareils sanitaires', 'u', 85000, null],
  ['MAT.LAVABO.COMPLET', 'Lavabo + robinetterie', 'MATERIAU', 'Appareils sanitaires', 'u', 65000, null],
  ['MAT.DOUCHE.COMPLETE', 'Receveur de douche + robinetterie + paroi', 'MATERIAU', 'Appareils sanitaires', 'u', 145000, null],
  ['MAT.BAIGNOIRE.COMPLETE', 'Baignoire + robinetterie', 'MATERIAU', 'Appareils sanitaires', 'u', 285000, null],
  // Cuisine
  ['MAT.CUIS.PAILLASSE', 'Paillasse cuisine carrelée', 'MATERIAU', 'Cuisine', 'forfait', 250000, null],
  ['MAT.CUIS.EQUIPEE.STD', 'Cuisine équipée standard (meubles hauts/bas)', 'MATERIAU', 'Cuisine', 'forfait', 1500000, 'standard'],
  ['MAT.CUIS.EQUIPEE.HAUT', 'Cuisine équipée haut de gamme', 'MATERIAU', 'Cuisine', 'forfait', 4500000, 'haut de gamme'],
  ['MAT.EVIER.CUISINE', 'Évier inox + robinetterie', 'MATERIAU', 'Cuisine', 'u', 95000, null],
  // Assainissement
  ['MAT.FOSSE.SEPTIQUE', 'Fosse septique préfabriquée + puisard', 'MATERIAU', 'Assainissement', 'forfait', 950000, null],
  ['MAT.FOSSE.EPANDAGE', 'Fosse toutes eaux + champ d\'épandage', 'MATERIAU', 'Assainissement', 'forfait', 1650000, null],
  ['MAT.MICROSTATION', 'Micro-station d\'épuration', 'MATERIAU', 'Assainissement', 'forfait', 3200000, null],
  ['MAT.RACCORDEMENT.RESEAU', 'Raccordement réseau collectif (frais + tranchée)', 'MATERIAU', 'Assainissement', 'forfait', 450000, null],
  // VRD
  ['MAT.PAVE.AUTOBLOQUANT', 'Pavé autobloquant', 'MATERIAU', 'VRD', 'm²', 9500, null],
  ['MAT.GRAVIER.VRD', 'Grave concassée (fondation voirie)', 'MATERIAU', 'VRD', 'm³', 15000, null],
  // Clôture
  ['MAT.PORTAIL.METAL', 'Portail métallique coulissant', 'MATERIAU', 'Clôture', 'u', 650000, null],
  ['MO.SOUDEUR', 'Soudeur / métallier (heure)', 'MAIN_OEUVRE', 'Main d\'œuvre', 'h', 1750, null],
  // Aménagements extérieurs
  ['MAT.PAVE.EXT', 'Pavé décoratif extérieur', 'MATERIAU', 'Aménagements extérieurs', 'm²', 8500, null],
  ['MAT.GAZON.PLANTATION', 'Gazon + plantations', 'MATERIAU', 'Aménagements extérieurs', 'm²', 3500, null],
  // Piscine
  ['MAT.PISCINE.STRUCTURE', 'Structure béton + étanchéité + carrelage piscine', 'MATERIAU', 'Piscine', 'm²', 385000, null],
  ['MAT.PISCINE.FILTRATION', 'Groupe de filtration + pompe + local technique', 'MATERIAU', 'Piscine', 'forfait', 2800000, null],
];

// ── 5. Ouvrages (recettes) — 8 lots de fond + 2 forfaits ────────────────
// [code, lotCode, designation, unit, formulaCode|null, components:[[resourceCode, quantityPerUnit, wastageRate], …]]
const WORK_ITEMS = [
  // LOT02 — Terrassements
  ['TERR.DECAPAGE', 'LOT02', 'Décapage de la terre végétale', 'm²', 'QTE_DECAPAGE', [['MO.MANOEUVRE', 0.08, 0]]],
  ['TERR.FOUILLES.RIGOLES', 'LOT02', 'Fouilles en rigoles', 'm³', 'QTE_FOUILLES_RIGOLES', [['MO.MANOEUVRE', 1.2, 0], ['TR.CAMION.10T', 0.05, 0]]],
  ['TERR.FOUILLES.PUITS', 'LOT02', 'Fouilles en puits (semelles isolées)', 'm³', 'QTE_FOUILLES_PUITS', [['MO.MANOEUVRE', 1.4, 0]]],
  ['TERR.REMBLAI', 'LOT02', 'Remblai compacté en latérite', 'm³', 'QTE_REMBLAI', [['MAT.LATERITE', 1.15, 5], ['MO.MANOEUVRE', 0.6, 0]]],

  // LOT03 — Fondations
  ['FOND.BETON.PROPRETE', 'LOT03', 'Béton de propreté', 'm³', 'QTE_BETON_PROPRETE', [
    ['MAT.CIMENT.CPJ35', 4.5, 2], ['MAT.SABLE.LAGUNE', 0.45, 5], ['MAT.GRAVIER.5_15', 0.8, 5], ['MO.MACON', 1.5, 0], ['MO.MANOEUVRE', 2.5, 0],
  ]],
  ['FOND.BETON.SEMELLES', 'LOT03', 'Béton armé pour semelles filantes', 'm³', 'QTE_BETON_SEMELLES', [
    ['MAT.CIMENT.CPJ35', 7.5, 2], ['MAT.SABLE.LAGUNE', 0.42, 5], ['MAT.GRAVIER.15_25', 0.82, 5],
    ['MAT.FER.HA10', 62, 3], ['MAT.FIL.ATTACHE', 1.2, 0], ['MO.MACON', 2.2, 0], ['MO.MANOEUVRE', 3.5, 0], ['MO.FERRAILLEUR', 1.5, 0],
  ]],
  ['FOND.MACONNERIE.SOUBASSEMENT', 'LOT03', 'Maçonnerie de soubassement en agglo 20', 'm²', 'QTE_MACONNERIE_SOUBASSEMENT', [
    ['MAT.AGGLO.20', 12.5, 3], ['MAT.CIMENT.CPJ35', 0.22, 2], ['MAT.SABLE.LAGUNE', 0.026, 5], ['MO.MACON', 0.6, 0], ['MO.MANOEUVRE', 0.6, 0],
  ]],
  ['FOND.CHAINAGE.BAS', 'LOT03', 'Chaînage bas', 'ml', 'QTE_CHAINAGE_BAS', [
    ['MAT.CIMENT.CPJ35', 0.9, 2], ['MAT.SABLE.LAGUNE', 0.05, 5], ['MAT.GRAVIER.5_15', 0.09, 5],
    ['MAT.FER.HA10', 5.5, 3], ['MO.MACON', 0.3, 0], ['MO.FERRAILLEUR', 0.2, 0],
  ]],

  // LOT04 — Béton armé
  ['BA.POTEAUX', 'LOT04', 'Poteaux en béton armé', 'm³', 'QTE_BETON_POTEAUX', [
    ['MAT.CIMENT.CPJ35', 8, 2], ['MAT.SABLE.LAGUNE', 0.4, 5], ['MAT.GRAVIER.15_25', 0.8, 5],
    ['MAT.FER.HA12', 110, 3], ['MAT.FIL.ATTACHE', 2, 0], ['MO.COFFREUR', 4, 0], ['MO.FERRAILLEUR', 3, 0], ['MO.MACON', 2, 0],
  ]],
  ['BA.POUTRES', 'LOT04', 'Poutres et chaînages hauts en béton armé', 'm³', 'QTE_BETON_POUTRES', [
    ['MAT.CIMENT.CPJ35', 8, 2], ['MAT.SABLE.LAGUNE', 0.4, 5], ['MAT.GRAVIER.15_25', 0.8, 5],
    ['MAT.FER.HA12', 120, 3], ['MAT.FIL.ATTACHE', 2, 0], ['MO.COFFREUR', 3.5, 0], ['MO.FERRAILLEUR', 3, 0], ['MO.MACON', 2, 0],
  ]],
  ['BA.DALLE', 'LOT04', 'Dalle pleine en béton armé', 'm²', 'QTE_DALLE_SURFACE', [
    ['MAT.CIMENT.CPJ35', 0.95, 2], ['MAT.SABLE.LAGUNE', 0.048, 5], ['MAT.GRAVIER.15_25', 0.096, 5],
    ['MAT.FER.HA10', 9.6, 3], ['MO.COFFREUR', 0.5, 0], ['MO.FERRAILLEUR', 0.35, 0], ['MO.MACON', 0.3, 0],
  ]],
  ['BA.ACIER.HA', 'LOT04', 'Acier HA façonné et posé (toutes structures)', 'kg', 'QTE_ACIER_HA', [['MO.FERRAILLEUR', 0.03, 0]]],
  ['BA.COFFRAGE', 'LOT04', 'Coffrage bois traditionnel', 'm²', 'QTE_COFFRAGE', [['MAT.BOIS.COFFRAGE', 1, 15], ['MAT.HUILE.DECOFFRAGE', 0.1, 0], ['MO.COFFREUR', 0.6, 0]]],
  ['BA.ESCALIER', 'LOT04', 'Escalier en béton armé', 'u', 'QTE_ESCALIER', [
    ['MAT.CIMENT.CPJ35', 45, 2], ['MAT.SABLE.LAGUNE', 2.2, 5], ['MAT.GRAVIER.15_25', 4.4, 5],
    ['MAT.FER.HA10', 180, 3], ['MO.COFFREUR', 12, 0], ['MO.FERRAILLEUR', 8, 0], ['MO.MACON', 10, 0],
  ]],

  // LOT05 — Maçonnerie & enduits
  ['MAC.MUR.AGGLO15', 'LOT05', 'Mur en agglos creux de 15', 'm²', 'QTE_MACONNERIE_AGGLO15', [
    ['MAT.AGGLO.15', 12.5, 3], ['MAT.CIMENT.CPJ35', 0.18, 2], ['MAT.SABLE.LAGUNE', 0.022, 5], ['MO.MACON', 0.55, 0], ['MO.MANOEUVRE', 0.55, 0],
  ]],
  ['MAC.MUR.AGGLO10', 'LOT05', 'Cloison en agglos creux de 10', 'm²', 'QTE_MACONNERIE_AGGLO10', [
    ['MAT.AGGLO.10', 12.5, 3], ['MAT.CIMENT.CPJ35', 0.14, 2], ['MAT.SABLE.LAGUNE', 0.017, 5], ['MO.MACON', 0.45, 0], ['MO.MANOEUVRE', 0.4, 0],
  ]],
  ['MAC.ENDUIT.INT', 'LOT05', 'Enduit intérieur au mortier de ciment', 'm²', 'QTE_ENDUIT_INTERIEUR', [
    ['MAT.CIMENT.CPJ35', 0.12, 2], ['MAT.SABLE.LAGUNE', 0.018, 5], ['MO.MACON', 0.35, 0], ['MO.MANOEUVRE', 0.3, 0],
  ]],
  ['MAC.ENDUIT.EXT', 'LOT05', 'Enduit extérieur tyrolien', 'm²', 'QTE_ENDUIT_EXTERIEUR', [
    ['MAT.CIMENT.CPJ35', 0.15, 2], ['MAT.SABLE.LAGUNE', 0.02, 5], ['MO.MACON', 0.4, 0], ['MO.MANOEUVRE', 0.35, 0],
  ]],
  ['MAC.LINTEAUX', 'LOT05', 'Linteaux préfabriqués', 'ml', 'QTE_LINTEAUX', [
    ['MAT.CIMENT.CPJ35', 0.6, 2], ['MAT.FER.HA8', 3.5, 3], ['MO.MACON', 0.4, 0],
  ]],

  // LOT09 — Électricité
  ['ELEC.PRISE', 'LOT09', 'Point prise 2P+T', 'u', 'QTE_PRISES_COURANT', [
    ['MAT.PRISE.2P_T', 1, 2], ['MAT.FIL.2_5', 8, 5], ['MAT.GAINE.ICTA16', 8, 5], ['MO.ELECTRICIEN', 0.8, 0],
  ]],
  ['ELEC.POINT.LUMINEUX', 'LOT09', 'Point lumineux', 'u', 'QTE_POINTS_LUMINEUX', [
    ['MAT.POINT.LUMINEUX', 1, 2], ['MAT.FIL.1_5', 6, 5], ['MAT.GAINE.ICTA16', 6, 5], ['MO.ELECTRICIEN', 0.7, 0],
  ]],
  ['ELEC.INTERRUPTEUR', 'LOT09', 'Interrupteur simple / va-et-vient', 'u', 'QTE_INTERRUPTEURS', [
    ['MAT.INTERRUPTEUR', 1, 2], ['MAT.FIL.1_5', 4, 5], ['MO.ELECTRICIEN', 0.5, 0],
  ]],
  ['ELEC.TABLEAU', 'LOT09', 'Tableau électrique divisionnaire équipé', 'u', 'QTE_TABLEAU', [
    ['MAT.TABLEAU.DIVISIONNAIRE', 1, 0], ['MO.ELECTRICIEN', 4, 0],
  ]],
  ['ELEC.ALIM.CLIM', 'LOT09', 'Alimentation électrique dédiée climatiseur', 'u', 'QTE_ALIM_CLIM', [
    ['MAT.FIL.2_5', 10, 5], ['MAT.GAINE.ICTA16', 10, 5], ['MO.ELECTRICIEN', 1.2, 0],
  ]],
  ['ELEC.ECLAIRAGE.EXT', 'LOT09', 'Point d\'éclairage extérieur', 'u', 'QTE_ECLAIRAGE_EXT', [
    ['MAT.APPLIQUE.EXT', 1, 2], ['MAT.FIL.2_5', 12, 5], ['MO.ELECTRICIEN', 1, 0],
  ]],

  // LOT10 — Plomberie sanitaire
  ['PLB.ALIM.EF', 'LOT10', 'Alimentation eau froide (tube PPR)', 'ml', 'QTE_ALIM_EF', [['MAT.PPR.20', 1.05, 5], ['MO.PLOMBIER', 0.3, 0]]],
  ['PLB.EVAC.100', 'LOT10', 'Évacuation PVC Ø100', 'ml', 'QTE_EVAC_PVC100', [['MAT.PVC.100', 1.05, 5], ['MO.PLOMBIER', 0.35, 0]]],
  ['PLB.EVAC.40', 'LOT10', 'Évacuation PVC Ø40', 'ml', 'QTE_EVAC_PVC40', [['MAT.PVC.40', 1.05, 5], ['MO.PLOMBIER', 0.25, 0]]],
  ['PLB.REGARD', 'LOT10', 'Regard de visite', 'u', 'QTE_REGARD', [['MAT.REGARD.BETON', 1, 0], ['MO.PLOMBIER', 1.5, 0], ['MO.MANOEUVRE', 2, 0]]],
  ['PLB.ALIM.GENERALE', 'LOT10', 'Alimentation générale + compteur', 'forfait', 'QTE_FORFAIT', [['MAT.ALIM.COMPTEUR', 1, 0], ['MO.PLOMBIER', 4, 0]]],

  // LOT12 — Revêtements
  ['REV.CARRELAGE.SOL', 'LOT12', 'Carrelage grès cérame au sol', 'm²', 'QTE_CARRELAGE_SOL', [
    ['MAT.CARRELAGE.GRES.CERAME.60', 1.08, 8], ['MAT.COLLE.CARRELAGE', 0.2, 3], ['MAT.JOINT.CARRELAGE', 0.5, 3], ['MO.CARRELEUR', 0.6, 0],
  ]],
  ['REV.CARRELAGE.ANTIDERAPANT', 'LOT12', 'Carrelage antidérapant pièces humides', 'm²', 'QTE_CARRELAGE_ANTIDERAPANT', [
    ['MAT.CARRELAGE.GRES.40', 1.08, 8], ['MAT.COLLE.CARRELAGE', 0.2, 3], ['MAT.JOINT.CARRELAGE', 0.5, 3], ['MO.CARRELEUR', 0.65, 0],
  ]],
  ['REV.PLINTHES', 'LOT12', 'Plinthes carrelage', 'ml', 'QTE_PLINTHES', [['MAT.PLINTHE', 1.05, 5], ['MO.CARRELEUR', 0.15, 0]]],
  ['REV.FAIENCE', 'LOT12', 'Faïence murale', 'm²', 'QTE_FAIENCE', [
    ['MAT.FAIENCE.MURALE', 1.08, 8], ['MAT.COLLE.CARRELAGE', 0.2, 3], ['MAT.JOINT.CARRELAGE', 0.4, 3], ['MO.CARRELEUR', 0.55, 0],
  ]],
  ['REV.CHAPE', 'LOT12', 'Chape de ravoirage', 'm²', 'QTE_CHAPE', [
    ['MAT.CIMENT.CPJ35', 0.1, 2], ['MAT.SABLE.LAGUNE', 0.03, 5], ['MO.MACON', 0.25, 0],
  ]],

  // LOT14 — Peinture
  ['PEINT.ENDUIT.LISSAGE', 'LOT14', 'Enduit de lissage avant peinture', 'm²', 'QTE_ENDUIT_LISSAGE', [
    ['MAT.ENDUIT.LISSAGE', 0.25, 5], ['MO.PEINTRE', 0.2, 0],
  ]],
  ['PEINT.EAU.INT', 'LOT14', 'Peinture à eau 2 couches — intérieur', 'm²', 'QTE_PEINTURE_EAU_INT', [
    ['MAT.PEINTURE.EAU', 0.3, 5], ['MO.PEINTRE', 0.25, 0],
  ]],
  ['PEINT.EXT.FACADE', 'LOT14', 'Peinture extérieure façade', 'm²', 'QTE_PEINTURE_EXT', [
    ['MAT.PEINTURE.GLYCERO', 0.35, 5], ['MO.PEINTRE', 0.3, 0],
  ]],
];

// Ouvrages forfaitaires (% du total des autres lignes) — lots 1 et 22.
const PERCENT_WORK_ITEMS = [
  ['INST.CHANTIER', 'LOT01', 'Installation, repli de chantier et implantation', 'forfait', 2.5],
  ['NETT.RECEPTION', 'LOT22', 'Nettoyage général et réception', 'forfait', 1.0],
];

// ── 5bis. Ouvrages conditionnels — 12 lots restants (charpente, menuiserie,
// climatisation, faux plafond, appareils sanitaires, cuisine, assainissement,
// VRD, clôture, aménagements extérieurs, piscine) — format objet car chacun
// porte une règle d'applicabilité (`applicabilityRule`) selon les
// caractéristiques du projet (toiture, menuiserie, climatisation, standing…).
const WORK_ITEMS_V2 = [
  // LOT06 — Charpente, couverture & étanchéité
  {
    code: 'CHARP.BOIS.TOLE', lotCode: 'LOT06', designation: 'Charpente bois + couverture tôle', unit: 'm²', formulaCode: 'QTE_TOITURE_SURFACE',
    rule: { all: [{ field: 'roofType', eq: 'CHARPENTE_BOIS_TOLE' }] },
    components: [['MAT.BOIS.CHARPENTE', 0.025, 10], ['MAT.TOLE.BAC.ALU', 1.05, 5], ['MO.CHARPENTIER', 0.4, 0]],
  },
  {
    code: 'CHARP.BOIS.TUILE', lotCode: 'LOT06', designation: 'Charpente bois + couverture tuile', unit: 'm²', formulaCode: 'QTE_TOITURE_SURFACE',
    rule: { all: [{ field: 'roofType', eq: 'CHARPENTE_BOIS_TUILE' }] },
    components: [['MAT.BOIS.CHARPENTE', 0.03, 10], ['MAT.TUILE', 1.1, 8], ['MO.CHARPENTIER', 0.5, 0]],
  },
  {
    code: 'CHARP.METAL.BAC', lotCode: 'LOT06', designation: 'Charpente métallique + couverture bac alu', unit: 'm²', formulaCode: 'QTE_TOITURE_SURFACE',
    rule: { all: [{ field: 'roofType', eq: 'CHARPENTE_METALLIQUE_BAC' }] },
    components: [['MAT.CHARPENTE.METAL', 1, 5], ['MAT.TOLE.BAC.ALU', 1.05, 5], ['MO.CHARPENTIER', 0.35, 0]],
  },
  {
    code: 'ETANCH.TERRASSE', lotCode: 'LOT06', designation: 'Étanchéité toiture-terrasse', unit: 'm²', formulaCode: 'QTE_ETANCHEITE_TERRASSE',
    rule: { all: [{ field: 'roofType', in: ['DALLE_PLEINE', 'MIXTE_DALLE_CHARPENTE'] }] },
    components: [['MAT.ETANCHEITE.BICOUCHE', 1.05, 5], ['MO.MACON', 0.15, 0]],
  },

  // LOT07 — Menuiserie aluminium & vitrerie
  {
    code: 'MENUIS.ALU.STANDARD', lotCode: 'LOT07', designation: 'Menuiserie extérieure aluminium standard', unit: 'm²', formulaCode: 'QTE_MENUISERIE_EXT',
    rule: { all: [{ field: 'joineryType', in: ['ALUMINIUM_STANDARD', 'METALLIQUE', 'MIXTE_ALU_BOIS'] }] },
    components: [['MAT.ALU.FENETRE.STD', 1, 3], ['MO.MENUISIER', 0.5, 0]],
  },
  {
    code: 'MENUIS.ALU.TEINTE', lotCode: 'LOT07', designation: 'Menuiserie extérieure aluminium vitrage teinté', unit: 'm²', formulaCode: 'QTE_MENUISERIE_EXT',
    rule: { all: [{ field: 'joineryType', eq: 'ALUMINIUM_VITRAGE_TEINTE' }] },
    components: [['MAT.ALU.FENETRE.TEINTE', 1, 3], ['MO.MENUISIER', 0.5, 0]],
  },

  // LOT08 — Menuiserie bois
  {
    code: 'MENUIS.BOIS.PORTE.INT', lotCode: 'LOT08', designation: 'Portes intérieures bois (blocs-portes)', unit: 'u', formulaCode: 'QTE_PORTES_INTERIEURES',
    rule: null,
    components: [['MAT.PORTE.BOIS.INT', 1, 2], ['MO.MENUISIER', 1.2, 0]],
  },
  {
    code: 'MENUIS.BOIS.EXT', lotCode: 'LOT08', designation: 'Menuiserie extérieure bois massif', unit: 'm²', formulaCode: 'QTE_MENUISERIE_EXT',
    rule: { all: [{ field: 'joineryType', eq: 'BOIS_MASSIF' }] },
    components: [['MAT.PORTE.BOIS.EXT', 1, 3], ['MO.MENUISIER', 0.6, 0]],
  },

  // LOT11 — Climatisation & ventilation
  {
    code: 'CLIM.SPLIT', lotCode: 'LOT11', designation: 'Climatiseur split — fourniture et pose', unit: 'u', formulaCode: 'QTE_CLIM_SPLIT',
    rule: { all: [{ field: 'acType', in: ['SPLIT_PARTIEL', 'SPLIT_TOUTES_PIECES'] }] },
    components: [['MAT.CLIM.SPLIT.9000', 1, 0], ['MO.FRIGORISTE', 3, 0]],
  },
  {
    code: 'VENTIL.MECA', lotCode: 'LOT11', designation: 'Ventilation mécanique', unit: 'ml', formulaCode: 'QTE_VENTILATION',
    rule: { all: [{ field: 'acType', eq: 'VENTILATION_SEULE' }] },
    components: [['MAT.GAINE.VENTIL', 1.05, 5], ['MO.FRIGORISTE', 0.2, 0]],
  },
  {
    code: 'CLIM.GAINABLE', lotCode: 'LOT11', designation: 'Climatisation gainable centralisée', unit: 'm²', formulaCode: 'QTE_GAINABLE_SURFACE',
    rule: { all: [{ field: 'acType', eq: 'GAINABLE_CENTRALISE' }] },
    components: [['MAT.CLIM.GAINABLE', 1, 0], ['MO.FRIGORISTE', 0.15, 0]],
  },

  // LOT13 — Faux plafond
  {
    code: 'FAUX.PLAFOND', lotCode: 'LOT13', designation: 'Faux plafond en dalles PVC', unit: 'm²', formulaCode: 'QTE_FAUX_PLAFOND',
    rule: { all: [{ field: 'hasFalseCeiling', eq: true }] },
    components: [['MAT.PLAFOND.PVC', 1.05, 5], ['MAT.OSSATURE.PLAFOND', 1, 3], ['MO.PLAQUISTE', 0.35, 0]],
  },

  // LOT15 — Appareils sanitaires
  {
    code: 'SAN.WC', lotCode: 'LOT15', designation: 'WC complet posé', unit: 'u', formulaCode: 'QTE_WC_TOTAL', rule: null,
    components: [['MAT.WC.COMPLET', 1, 2], ['MAT.PVC.40', 1.5, 5], ['MO.PLOMBIER', 2, 0]],
  },
  {
    code: 'SAN.LAVABO', lotCode: 'LOT15', designation: 'Lavabo posé', unit: 'u', formulaCode: 'QTE_LAVABO', rule: null,
    components: [['MAT.LAVABO.COMPLET', 1, 2], ['MO.PLOMBIER', 1.5, 0]],
  },
  {
    code: 'SAN.DOUCHE', lotCode: 'LOT15', designation: 'Douche complète posée', unit: 'u', formulaCode: 'QTE_DOUCHE', rule: null,
    components: [['MAT.DOUCHE.COMPLETE', 1, 2], ['MO.PLOMBIER', 2.5, 0]],
  },
  {
    code: 'SAN.BAIGNOIRE', lotCode: 'LOT15', designation: 'Baignoire posée', unit: 'u', formulaCode: 'QTE_BAIGNOIRE', rule: null,
    components: [['MAT.BAIGNOIRE.COMPLETE', 1, 2], ['MO.PLOMBIER', 3, 0]],
  },

  // LOT16 — Cuisine
  {
    code: 'CUIS.PAILLASSE', lotCode: 'LOT16', designation: 'Cuisine simple paillasse', unit: 'forfait', formulaCode: 'QTE_FORFAIT',
    rule: { all: [{ field: 'kitchenType', eq: 'SIMPLE_PAILLASSE' }] },
    components: [['MAT.CUIS.PAILLASSE', 1, 0], ['MO.MACON', 8, 0]],
  },
  {
    code: 'CUIS.EQUIPEE.STANDARD', lotCode: 'LOT16', designation: 'Cuisine équipée standard', unit: 'forfait', formulaCode: 'QTE_FORFAIT',
    rule: { all: [{ field: 'kitchenType', eq: 'EQUIPEE_STANDARD' }] },
    components: [['MAT.CUIS.EQUIPEE.STD', 1, 0], ['MO.MENUISIER', 12, 0]],
  },
  {
    code: 'CUIS.EQUIPEE.HAUT', lotCode: 'LOT16', designation: 'Cuisine équipée haut de gamme', unit: 'forfait', formulaCode: 'QTE_FORFAIT',
    rule: { all: [{ field: 'kitchenType', eq: 'EQUIPEE_HAUT_DE_GAMME' }] },
    components: [['MAT.CUIS.EQUIPEE.HAUT', 1, 0], ['MO.MENUISIER', 16, 0]],
  },
  {
    code: 'CUIS.EVIER', lotCode: 'LOT16', designation: 'Évier de cuisine + robinetterie', unit: 'u', formulaCode: 'QTE_FORFAIT',
    rule: { all: [{ field: 'kitchenType', ne: 'NUE' }] },
    components: [['MAT.EVIER.CUISINE', 1, 0], ['MO.PLOMBIER', 1.5, 0]],
  },

  // LOT17 — Assainissement
  {
    code: 'ASSAIN.FOSSE.PUISARD', lotCode: 'LOT17', designation: 'Fosse septique + puisard', unit: 'forfait', formulaCode: 'QTE_FORFAIT',
    rule: { all: [{ field: 'sanitationType', eq: 'FOSSE_SEPTIQUE_PUISARD' }] },
    components: [['MAT.FOSSE.SEPTIQUE', 1, 0], ['MO.MANOEUVRE', 8, 0]],
  },
  {
    code: 'ASSAIN.FOSSE.EPANDAGE', lotCode: 'LOT17', designation: 'Fosse toutes eaux + champ d\'épandage', unit: 'forfait', formulaCode: 'QTE_FORFAIT',
    rule: { all: [{ field: 'sanitationType', eq: 'FOSSE_TOUTES_EAUX_EPANDAGE' }] },
    components: [['MAT.FOSSE.EPANDAGE', 1, 0], ['MO.MANOEUVRE', 12, 0]],
  },
  {
    code: 'ASSAIN.MICROSTATION', lotCode: 'LOT17', designation: 'Micro-station d\'épuration', unit: 'forfait', formulaCode: 'QTE_FORFAIT',
    rule: { all: [{ field: 'sanitationType', eq: 'MICRO_STATION' }] },
    components: [['MAT.MICROSTATION', 1, 0], ['MO.PLOMBIER', 10, 0]],
  },
  {
    code: 'ASSAIN.RACCORDEMENT', lotCode: 'LOT17', designation: 'Raccordement au réseau collectif', unit: 'forfait', formulaCode: 'QTE_FORFAIT',
    rule: { all: [{ field: 'sanitationType', eq: 'RACCORDEMENT_RESEAU_COLLECTIF' }] },
    components: [['MAT.RACCORDEMENT.RESEAU', 1, 0], ['MO.MANOEUVRE', 6, 0]],
  },

  // LOT18 — VRD
  {
    code: 'VRD.VOIRIE', lotCode: 'LOT18', designation: 'Voirie et accès (pavage)', unit: 'm²', formulaCode: 'QTE_VRD_SURFACE', rule: null,
    components: [['MAT.PAVE.AUTOBLOQUANT', 1.05, 5], ['MAT.GRAVIER.VRD', 0.1, 5], ['MO.MANOEUVRE', 0.3, 0]],
  },

  // LOT19 — Clôture & portail
  {
    code: 'CLOT.MUR', lotCode: 'LOT19', designation: 'Mur de clôture en agglos', unit: 'ml', formulaCode: 'QTE_CLOTURE_ML',
    rule: { all: [{ field: 'fenceLength', gt: 0 }] },
    components: [['MAT.AGGLO.20', 25, 3], ['MAT.CIMENT.CPJ35', 0.4, 2], ['MAT.SABLE.LAGUNE', 0.05, 5], ['MAT.FER.HA10', 3, 3], ['MO.MACON', 1.2, 0], ['MO.MANOEUVRE', 1, 0]],
  },
  {
    code: 'CLOT.PORTAIL', lotCode: 'LOT19', designation: 'Portail métallique coulissant', unit: 'u', formulaCode: 'QTE_PORTAILS',
    rule: { all: [{ field: 'gateCount', gt: 0 }] },
    components: [['MAT.PORTAIL.METAL', 1, 0], ['MO.SOUDEUR', 6, 0]],
  },

  // LOT20 — Aménagements extérieurs
  {
    code: 'AMEN.DALLAGE', lotCode: 'LOT20', designation: 'Dallage / pavage extérieur', unit: 'm²', formulaCode: 'QTE_DALLAGE_EXT',
    rule: { all: [{ field: 'exteriorPavedSurface', gt: 0 }] },
    components: [['MAT.PAVE.EXT', 1.05, 5], ['MO.MACON', 0.3, 0]],
  },
  {
    code: 'AMEN.ESPACES.VERTS', lotCode: 'LOT20', designation: 'Espaces verts (gazon + plantations)', unit: 'm²', formulaCode: 'QTE_ESPACES_VERTS',
    rule: { all: [{ field: 'hasLandscaping', eq: true }] },
    components: [['MAT.GAZON.PLANTATION', 1, 10], ['MO.MANOEUVRE', 0.2, 0]],
  },

  // LOT21 — Piscine
  {
    code: 'PISCINE.STRUCTURE', lotCode: 'LOT21', designation: 'Structure, étanchéité et carrelage piscine', unit: 'm²', formulaCode: 'QTE_PISCINE_STRUCTURE',
    rule: { all: [{ field: 'hasPool', eq: true }] },
    components: [['MAT.PISCINE.STRUCTURE', 1, 5], ['MO.MACON', 2, 0], ['MO.CARRELEUR', 1, 0]],
  },
  {
    code: 'PISCINE.FILTRATION', lotCode: 'LOT21', designation: 'Groupe de filtration et local technique', unit: 'forfait', formulaCode: 'QTE_FORFAIT',
    rule: { all: [{ field: 'hasPool', eq: true }] },
    components: [['MAT.PISCINE.FILTRATION', 1, 0], ['MO.PLOMBIER', 8, 0]],
  },
];

// ── 6. Catalogue des coefficients (64 codes du registre de formules) ───
// [code, category, unit, ÉCONOMIQUE, STANDARD, MOYEN_STANDING, HAUT_STANDING, LUXE]
// La progression par standing est la même quel que soit le type de bâtiment —
// la différenciation par type (villa/duplex/triplex/immeuble…) vient des
// caractéristiques du projet (niveaux, pièces, surface) traversant les mêmes
// formules, pas d'un jeu de coefficients distinct (cf. § 7).
const RATIOS = [
  ['COEF_COFFRAGE_PAR_M3', 'Béton armé', 'm²/m³', 5.5, 6.0, 6.0, 6.5, 7.0],
  ['COEF_DECAPAGE', 'Terrassements & fondations', 'ratio', 1.10, 1.10, 1.12, 1.15, 1.18],
  ['COEF_DEDUCTION_OUVERTURES', 'Géométrie', 'ratio', 0.75, 0.78, 0.80, 0.80, 0.82],
  ['COEF_FORME_PERIMETRE', 'Géométrie', 'ratio', 1.05, 1.08, 1.10, 1.12, 1.15],
  ['COEF_REVETEMENT_SOL', 'Revêtements & finitions', 'ratio', 1.05, 1.08, 1.10, 1.15, 1.20],
  ['COEF_SURFACE_CONSTRUITE_SUR_UTILE', 'Géométrie', 'ratio', 1.10, 1.12, 1.15, 1.18, 1.22],
  ['COEF_TERRAIN_MARECAGEUX', 'Terrassements & fondations', 'ratio', 1.60, 1.60, 1.60, 1.60, 1.60],
  ['COEF_TERRAIN_PENTE', 'Terrassements & fondations', 'ratio', 1.25, 1.25, 1.25, 1.25, 1.25],
  ['COEF_TERRAIN_PLAT', 'Terrassements & fondations', 'ratio', 1.00, 1.00, 1.00, 1.00, 1.00],
  ['COEF_TERRAIN_ROCHEUX', 'Terrassements & fondations', 'ratio', 1.80, 1.80, 1.80, 1.80, 1.80],
  ['EPAISSEUR_BETON_PROPRETE', 'Terrassements & fondations', 'm', 0.05, 0.05, 0.05, 0.05, 0.05],
  ['EPAISSEUR_DALLE', 'Béton armé', 'm', 0.10, 0.12, 0.12, 0.15, 0.18],
  ['EPAISSEUR_REMBLAI', 'Terrassements & fondations', 'm', 0.15, 0.18, 0.20, 0.25, 0.25],
  ['EPAISSEUR_SEMELLE', 'Terrassements & fondations', 'm', 0.35, 0.38, 0.40, 0.45, 0.50],
  ['HAUTEUR_SOUBASSEMENT', 'Terrassements & fondations', 'm', 0.30, 0.35, 0.40, 0.50, 0.55],
  ['HAUTEUR_SOUS_PLAFOND', 'Géométrie', 'm', 2.70, 2.80, 3.00, 3.20, 3.50],
  ['INTERRUPTEURS_PAR_POINT_LUMINEUX', 'Électricité', 'ratio', 0.85, 0.88, 0.90, 0.95, 1.00],
  ['LARGEUR_SEMELLE', 'Terrassements & fondations', 'm', 0.50, 0.55, 0.60, 0.60, 0.65],
  ['MAJORATION_SEMELLE_PAR_NIVEAU', 'Terrassements & fondations', 'ratio', 0.12, 0.13, 0.15, 0.18, 0.20],
  ['ML_ALIM_EF_PAR_PIECE_HUMIDE', 'Plomberie & sanitaires', 'ml', 3, 3.5, 4, 5, 6],
  ['ML_CLOISON_PAR_M2_UTILE', 'Géométrie', 'ml/m²', 0.32, 0.35, 0.42, 0.48, 0.55],
  ['ML_EVAC_PVC100_PAR_PIECE_HUMIDE', 'Plomberie & sanitaires', 'ml', 2.5, 2.8, 3, 3.5, 4],
  ['ML_EVAC_PVC40_PAR_PIECE_HUMIDE', 'Plomberie & sanitaires', 'ml', 2.5, 2.8, 3, 3.5, 4],
  ['ML_LINTEAU_PAR_OUVERTURE', 'Maçonnerie & enduits', 'ml', 1.0, 1.05, 1.2, 1.3, 1.4],
  ['ML_PLINTHE_PAR_M2_CARRELAGE', 'Revêtements & finitions', 'ml/m²', 0.55, 0.55, 0.55, 0.55, 0.55],
  ['NB_ESCALIER_PAR_NIVEAU_SUP', 'Béton armé', 'u', 1, 1, 1, 1, 1],
  ['NB_FENETRES_PAR_PIECE', 'Géométrie', 'nb', 0.6, 0.7, 1.0, 1.2, 1.4],
  ['NB_PORTES_EXT', 'Géométrie', 'nb', 1, 2, 2, 3, 4],
  ['NB_PORTES_INT_PAR_PIECE', 'Géométrie', 'nb', 0.8, 0.9, 1.0, 1.0, 1.0],
  ['NB_REGARD_PAR_NIVEAU', 'Plomberie & sanitaires', 'nb', 2, 2, 2, 3, 3],
  ['PART_CLOISON_AGGLO15', 'Maçonnerie & enduits', 'ratio', 0.50, 0.55, 0.70, 0.85, 1.00],
  ['PART_MURS_PORTEURS', 'Terrassements & fondations', 'ratio', 0.35, 0.38, 0.45, 0.50, 0.55],
  ['PART_SOL_CARRELE', 'Revêtements & finitions', 'ratio', 0.80, 0.90, 1.00, 1.00, 1.00],
  ['POINTS_ECLAIRAGE_EXTERIEUR_BASE', 'Électricité', 'nb', 1, 2, 2, 4, 6],
  ['POINTS_ECLAIRAGE_EXTERIEUR_PAR_PORTAIL', 'Électricité', 'nb', 1, 1, 1, 2, 3],
  ['POINTS_LUMINEUX_PAR_PIECE', 'Électricité', 'nb', 1.0, 1.2, 2.0, 3.0, 4.0],
  ['PRISES_CIRCULATION_PAR_NIVEAU', 'Électricité', 'nb', 1, 1, 1, 2, 3],
  ['PRISES_CUISINE', 'Électricité', 'nb', 3, 4, 5, 6, 8],
  ['PRISES_EQUIPEMENT_PISCINE', 'Électricité', 'nb', 2, 2, 2, 3, 4],
  ['PRISES_PAR_CHAMBRE', 'Électricité', 'nb', 2, 3, 4, 5, 6],
  ['PRISES_PAR_CLIM', 'Électricité', 'nb', 1, 1, 1, 1, 1],
  ['PRISES_PAR_SEJOUR', 'Électricité', 'nb', 4, 5, 6, 8, 10],
  ['RATIO_ACIER_SEMELLES', 'Béton armé', 'kg/m³', 50, 55, 60, 70, 80],
  ['RATIO_ACIER_POTEAUX', 'Béton armé', 'kg/m³', 90, 100, 110, 130, 150],
  ['RATIO_ACIER_POUTRES', 'Béton armé', 'kg/m³', 100, 110, 120, 140, 160],
  ['RATIO_ACIER_DALLE', 'Béton armé', 'kg/m³', 70, 75, 80, 95, 110],
  ['SURFACE_FAIENCE_PAR_PIECE_HUMIDE', 'Revêtements & finitions', 'm²', 6, 8, 10, 13, 16],
  ['SURFACE_MOY_FENETRE', 'Géométrie', 'm²', 1.4, 1.6, 2.0, 2.4, 2.8],
  ['SURFACE_MOY_PIECE_HUMIDE', 'Revêtements & finitions', 'm²', 3.0, 3.5, 4.5, 5.5, 7.0],
  ['SURFACE_MOY_PORTE_EXT', 'Géométrie', 'm²', 1.8, 1.9, 2.0, 2.2, 2.5],
  ['SURFACE_PAR_POTEAU', 'Terrassements & fondations', 'm²', 18, 17, 16, 14, 12],
  ['SURPLUS_LARGEUR_BETON_PROPRETE', 'Terrassements & fondations', 'm', 0.05, 0.05, 0.05, 0.05, 0.05],
  ['TABLEAU_PAR_NIVEAU', 'Électricité', 'nb', 1, 1, 1, 1, 1],
  ['VOLUME_FOUILLE_PUITS_UNITAIRE', 'Terrassements & fondations', 'm³', 0.5, 0.55, 0.6, 0.7, 0.8],
  ['VOLUME_POTEAUX_PAR_M2', 'Béton armé', 'm³/m²', 0.015, 0.017, 0.020, 0.024, 0.028],
  ['VOLUME_POUTRES_PAR_M2', 'Béton armé', 'm³/m²', 0.018, 0.020, 0.025, 0.030, 0.035],
  ['COEF_DEBORD_TOITURE', 'Charpente & couverture', 'ratio', 1.10, 1.12, 1.15, 1.20, 1.25],
  ['COEF_ESPACES_VERTS_PART', 'Aménagements extérieurs', 'ratio', 0.15, 0.20, 0.25, 0.35, 0.45],
  ['COEF_VRD_PART', 'VRD', 'ratio', 0.08, 0.10, 0.12, 0.15, 0.18],
  ['LAVABO_SUPP_INVITES', 'Plomberie & sanitaires', 'nb', 0, 0, 0, 1, 2],
  ['ML_GAINE_VENTIL_PAR_M2', 'Climatisation & ventilation', 'ml/m²', 0.15, 0.15, 0.15, 0.15, 0.15],
  ['PART_BAIGNOIRE', 'Plomberie & sanitaires', 'ratio', 0, 0, 0.5, 1.0, 1.0],
  ['PART_DOUCHE_DANS_SDB', 'Plomberie & sanitaires', 'ratio', 0.2, 0.25, 0.3, 0.5, 0.7],
  ['PART_FAUX_PLAFOND', 'Faux plafond', 'ratio', 0.0, 0.10, 0.40, 0.70, 1.00],
];

// Colonnes de valeurs (index dans chaque ligne de RATIOS) par standing.
const STANDING_VALUE_INDEX = { ECONOMIQUE: 3, STANDARD: 4, MOYEN_STANDING: 5, HAUT_STANDING: 6, LUXE: 7 };
const STANDING_LABELS = { ECONOMIQUE: 'Économique', STANDARD: 'Standard', MOYEN_STANDING: 'Moyen standing', HAUT_STANDING: 'Haut standing', LUXE: 'Luxe' };

// Les 9 types de bâtiment de ConstructionBuildingType. Les 5 premiers sont
// des typologies résidentielles où les formules du registre (chambres,
// séjour, cuisine, SDE/SDB…) s'appliquent directement — même jeu de
// coefficients par standing, la différenciation entre villa/duplex/triplex/
// immeuble venant des caractéristiques du projet (niveaux, pièces, surface),
// pas d'un profil distinct. Les 4 derniers (Bureau/Commerce/Entrepôt/Autre)
// sont non résidentiels : le registre de formules actuel n'a pas de notion
// de bureaux/surface de vente/quai de chargement — les mêmes coefficients
// résidentiels sont repris à titre indicatif (mieux qu'une absence totale de
// profil), signalé explicitement dans la description de chaque profil.
const RESIDENTIAL_BUILDING_TYPES = ['VILLA_BASSE', 'VILLA_DUPLEX', 'VILLA_TRIPLEX', 'MAISON_ECONOMIQUE', 'IMMEUBLE_R_PLUS'];
const NON_RESIDENTIAL_BUILDING_TYPES = ['BUREAU', 'COMMERCE', 'ENTREPOT_HANGAR', 'AUTRE'];
const BUILDING_TYPE_LABELS = {
  VILLA_BASSE: 'Villa basse', VILLA_DUPLEX: 'Villa duplex', VILLA_TRIPLEX: 'Villa triplex',
  MAISON_ECONOMIQUE: 'Maison économique', IMMEUBLE_R_PLUS: 'Immeuble (R+2 et plus)',
  BUREAU: 'Bureau', COMMERCE: 'Commerce', ENTREPOT_HANGAR: 'Entrepôt / hangar', AUTRE: 'Autre',
};

async function main() {
  console.log('── Moteur de devis de construction — seed ──');

  // 1. Lots
  for (const [code, numero, label, phase] of LOTS) {
    await db.constructionLot.upsert({ where: { code }, create: { code, numero, label, phase }, update: { numero, label, phase } });
  }
  console.log(`✓ ${LOTS.length} lots`);

  // 2. Familles
  for (const label of FAMILIES) {
    await db.constructionResourceFamily.upsert({ where: { label }, create: { label }, update: {} });
  }
  console.log(`✓ ${FAMILIES.length} familles de ressources`);

  // 3. Localités
  for (const [label, region, priceCoefficient] of LOCALITIES) {
    await db.constructionLocality.upsert({ where: { label }, create: { label, region, priceCoefficient }, update: { region, priceCoefficient } });
  }
  console.log(`✓ ${LOCALITIES.length} localités`);

  // 4. Ressources
  for (const [code, label, type, family, unit, unitPrice, quality] of RESOURCES) {
    const data = { label, type, family, unit, quality, referenceCity: 'Abidjan', priceIsIndicative: true };
    if (resetPrices) data.unitPrice = unitPrice;
    await db.constructionResource.upsert({
      where: { code },
      create: { code, ...data, unitPrice },
      update: data,
    });
  }
  console.log(`✓ ${RESOURCES.length} ressources (bordereau de prix)`);

  // 5. Ouvrages + recettes
  const lotIdByCode = Object.fromEntries((await db.constructionLot.findMany()).map((l) => [l.code, l.id]));
  const resourceIdByCode = Object.fromEntries((await db.constructionResource.findMany()).map((r) => [r.code, r.id]));

  for (const [code, lotCode, designation, unit, formulaCode, components] of WORK_ITEMS) {
    const lotId = lotIdByCode[lotCode];
    const header = { lotId, designation, unit, formulaCode, isActive: true };
    const workItem = await db.constructionWorkItem.upsert({ where: { code }, create: { code, ...header }, update: header });
    await db.constructionWorkItemComponent.deleteMany({ where: { workItemId: workItem.id } });
    await db.constructionWorkItemComponent.createMany({
      data: components.map(([resourceCode, quantityPerUnit, wastageRate], i) => ({
        workItemId: workItem.id, resourceId: resourceIdByCode[resourceCode], quantityPerUnit, wastageRate, sortOrder: i,
      })),
    });
  }
  for (const [code, lotCode, designation, unit, percentOfTotalPct] of PERCENT_WORK_ITEMS) {
    const lotId = lotIdByCode[lotCode];
    const header = { lotId, designation, unit, percentOfTotalPct, isActive: true };
    await db.constructionWorkItem.upsert({ where: { code }, create: { code, ...header }, update: header });
  }
  for (const { code, lotCode, designation, unit, formulaCode, rule, components } of WORK_ITEMS_V2) {
    const lotId = lotIdByCode[lotCode];
    const header = { lotId, designation, unit, formulaCode, applicabilityRule: rule ?? null, isActive: true };
    const workItem = await db.constructionWorkItem.upsert({ where: { code }, create: { code, ...header }, update: header });
    await db.constructionWorkItemComponent.deleteMany({ where: { workItemId: workItem.id } });
    await db.constructionWorkItemComponent.createMany({
      data: components.map(([resourceCode, quantityPerUnit, wastageRate], i) => ({
        workItemId: workItem.id, resourceId: resourceIdByCode[resourceCode], quantityPerUnit, wastageRate, sortOrder: i,
      })),
    });
  }
  const totalWorkItems = WORK_ITEMS.length + PERCENT_WORK_ITEMS.length + WORK_ITEMS_V2.length;
  console.log(`✓ ${totalWorkItems} ouvrages (dont ${PERCENT_WORK_ITEMS.length} forfaitaires, ${WORK_ITEMS_V2.length} conditionnels sur les 12 lots complémentaires)`);

  // 6. Catalogue des coefficients (defaultValue = palier STANDARD, repli générique)
  for (const row of RATIOS) {
    const [code, category, unit] = row;
    const defaultValue = row[STANDING_VALUE_INDEX.STANDARD];
    await db.constructionRatioDefinition.upsert({ where: { code }, create: { code, label: code, category, unit, defaultValue }, update: { category, unit, defaultValue } });
  }
  console.log(`✓ ${RATIOS.length} coefficients au catalogue`);

  // 7. Profils de coefficients — les 9 types de bâtiment × les 5 standings (45 profils)
  const defIdByCode = Object.fromEntries((await db.constructionRatioDefinition.findMany()).map((d) => [d.code, d.id]));
  const ALL_BUILDING_TYPES = [...RESIDENTIAL_BUILDING_TYPES, ...NON_RESIDENTIAL_BUILDING_TYPES];
  const PROFILES = [];
  for (const buildingType of ALL_BUILDING_TYPES) {
    for (const standing of Object.keys(STANDING_VALUE_INDEX)) {
      const isNonResidential = NON_RESIDENTIAL_BUILDING_TYPES.includes(buildingType);
      PROFILES.push({
        buildingType, standing,
        name: `${BUILDING_TYPE_LABELS[buildingType]} — ${STANDING_LABELS[standing]}`,
        valueIndex: STANDING_VALUE_INDEX[standing],
        description: isNonResidential
          ? `Coefficients résidentiels repris à titre indicatif — le registre de formules actuel (chambres, séjour, cuisine, SDE/SDB…) n'a pas de formules dédiées à la typologie « ${BUILDING_TYPE_LABELS[buildingType]} ». À corriger/adapter avant tout usage commercial sur ce type de bâtiment.`
          : null,
      });
    }
  }
  for (const p of PROFILES) {
    const profile = await db.constructionRatioProfile.upsert({
      where: { buildingType_standing: { buildingType: p.buildingType, standing: p.standing } },
      create: { buildingType: p.buildingType, standing: p.standing, name: p.name, description: p.description },
      update: { name: p.name, description: p.description },
    });
    await db.constructionRatioValue.deleteMany({ where: { profileId: profile.id } });
    await db.constructionRatioValue.createMany({
      data: RATIOS.map((row) => ({ profileId: profile.id, ratioDefinitionId: defIdByCode[row[0]], value: row[p.valueIndex] })),
    });
  }
  console.log(`✓ ${PROFILES.length} profils de coefficients (${ALL_BUILDING_TYPES.length} types de bâtiment × 5 standings)`);

  // 8. Projet de démonstration (optionnel)
  if (withDemo) {
    const existing = await db.constructionProject.findFirst({ where: { reference: 'PC-DEMO-0001' } });
    if (!existing) {
      await db.constructionProject.create({
        data: {
          reference: 'PC-DEMO-0001', nom: 'Villa Riviera — M. Koné', status: 'BROUILLON',
          buildingType: 'VILLA_BASSE', standing: 'HAUT_STANDING', levels: 1, roomCount: 5, livingRoomCount: 1,
          bedroomCount: 4, bathroomCount: 0, showerRoomCount: 3, wcCount: 1, surfaceHabitable: 180,
          kitchenType: 'EQUIPEE_STANDARD', roofType: 'DALLE_PLEINE', joineryType: 'ALUMINIUM_STANDARD',
          flooringType: 'CARRELAGE_GRES_CERAME', acType: 'SPLIT_PARTIEL', terrainType: 'PLAT', ville: 'Abidjan',
          sanitationType: 'FOSSE_SEPTIQUE_PUISARD', fenceLength: 90, gateCount: 1,
          description: 'Projet de démonstration reproduisant l\'exemple de référence du moteur de devis de construction.',
        },
      });
      console.log('✓ Projet de démonstration PC-DEMO-0001 créé');
    } else {
      console.log('• Projet de démonstration déjà présent');
    }
  }

  console.log('── Terminé ──');
  console.log('⚠️  Prix, ratios et compositions d\'ouvrages : valeurs de référence indicatives — à vérifier avant exploitation commerciale.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
