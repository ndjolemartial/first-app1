-- Un même poste peut désormais appartenir à plusieurs profils de carrière
-- (ex. filières transverses), mais ne peut apparaître qu'une seule fois au
-- sein d'un même profil : remplace l'unicité globale du poste par une
-- unicité (profil, poste).

-- DropIndex
ALTER TABLE `CareerProfileStep` DROP INDEX `CareerProfileStep_poste_key`;

-- CreateIndex
ALTER TABLE `CareerProfileStep` ADD UNIQUE INDEX `CareerProfileStep_careerProfileId_poste_key` (`careerProfileId`, `poste`);
