-- Ajout de EN_COURS_LOTISSEMENT dans l'enum LotissementStatus
-- et mise à jour de la valeur par défaut du champ statut

ALTER TABLE `Lotissement`
  MODIFY COLUMN `statut`
    ENUM('EN_COURS_LOTISSEMENT','EN_COURS','OUVERT','PARTIELLEMENT_VENDU','COMPLET','FERME')
    NOT NULL DEFAULT 'EN_COURS_LOTISSEMENT';
