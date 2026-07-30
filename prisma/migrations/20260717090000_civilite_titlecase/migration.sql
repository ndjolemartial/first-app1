-- ════════════════════════════════════════════════════════════════════
-- Migration : Civilité au format « Première lettre en majuscule »
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Renommer les valeurs de l'enum CiviliteType : MONSIEUR/MADAME/
--     MADEMOISELLE → Monsieur/Madame/Mademoiselle, sur User, Client,
--     Employee (seuls modèles porteurs de ce champ jusqu'ici).
--   - Ajouter le champ civilite (optionnel) à Owner, BusinessReferrer et
--     Prospect, qui n'en disposaient pas.
--
--  Méthode (colonne temporaire) : MySQL considère 'MONSIEUR' et 'Monsieur'
--  comme des valeurs d'ENUM dupliquées sous une collation insensible à la
--  casse (erreur 1291) — impossible de faire cohabiter les deux jeux de
--  valeurs dans une même définition ENUM. On passe donc par une colonne
--  VARCHAR temporaire pour convertir les données sans ambiguïté :
--   1) ajouter une colonne VARCHAR temporaire
--   2) y copier la valeur convertie (les valeurs existantes sont toutes en
--      majuscules, la comparaison n'est donc pas ambiguë)
--   3) supprimer l'ancienne colonne ENUM
--   4) renommer la colonne temporaire en ENUM(Monsieur/Madame/Mademoiselle)
-- ════════════════════════════════════════════════════════════════════

-- ── User ────────────────────────────────────────────────────────────
ALTER TABLE `User` ADD COLUMN `civilite_tmp` VARCHAR(20) NULL;
UPDATE `User` SET `civilite_tmp` = CASE `civilite`
  WHEN 'MONSIEUR' THEN 'Monsieur'
  WHEN 'MADAME' THEN 'Madame'
  WHEN 'MADEMOISELLE' THEN 'Mademoiselle'
  ELSE NULL
END;
ALTER TABLE `User` DROP COLUMN `civilite`;
ALTER TABLE `User` CHANGE COLUMN `civilite_tmp` `civilite` ENUM('Monsieur','Madame','Mademoiselle') NULL;

-- ── Client ──────────────────────────────────────────────────────────
ALTER TABLE `Client` ADD COLUMN `civilite_tmp` VARCHAR(20) NULL;
UPDATE `Client` SET `civilite_tmp` = CASE `civilite`
  WHEN 'MONSIEUR' THEN 'Monsieur'
  WHEN 'MADAME' THEN 'Madame'
  WHEN 'MADEMOISELLE' THEN 'Mademoiselle'
  ELSE 'Monsieur'
END;
ALTER TABLE `Client` DROP COLUMN `civilite`;
ALTER TABLE `Client` CHANGE COLUMN `civilite_tmp` `civilite` ENUM('Monsieur','Madame','Mademoiselle') NOT NULL DEFAULT 'Monsieur';

-- ── Employee ────────────────────────────────────────────────────────
ALTER TABLE `Employee` ADD COLUMN `civilite_tmp` VARCHAR(20) NULL;
UPDATE `Employee` SET `civilite_tmp` = CASE `civilite`
  WHEN 'MONSIEUR' THEN 'Monsieur'
  WHEN 'MADAME' THEN 'Madame'
  WHEN 'MADEMOISELLE' THEN 'Mademoiselle'
  ELSE NULL
END;
ALTER TABLE `Employee` DROP COLUMN `civilite`;
ALTER TABLE `Employee` CHANGE COLUMN `civilite_tmp` `civilite` ENUM('Monsieur','Madame','Mademoiselle') NULL;

-- ── Nouveau champ civilite (optionnel) sur Owner / BusinessReferrer / Prospect ──
ALTER TABLE `Owner`
  ADD COLUMN `civilite` ENUM('Monsieur','Madame','Mademoiselle') NULL;

ALTER TABLE `BusinessReferrer`
  ADD COLUMN `civilite` ENUM('Monsieur','Madame','Mademoiselle') NULL;

ALTER TABLE `Prospect`
  ADD COLUMN `civilite` ENUM('Monsieur','Madame','Mademoiselle') NULL;
