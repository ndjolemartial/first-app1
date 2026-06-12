-- AddColumn: date de la convention héritée (base antérieure), renseignée pour les
-- types AVENANT_DELAI_HERITE et AVENANT_RESILIATION_HERITE.
ALTER TABLE `Convention` ADD COLUMN `priorConventionDate` DATETIME(3) NULL;
