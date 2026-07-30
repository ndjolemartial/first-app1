-- Un employé n'appartient qu'à une seule filière de carrière à la fois
-- (contrairement à un poste, qui peut figurer dans plusieurs profils de
-- carrière) : ajoute un lien explicite Employee -> CareerProfile.

-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `careerProfileId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Employee_careerProfileId_idx` ON `Employee`(`careerProfileId`);

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_careerProfileId_fkey` FOREIGN KEY (`careerProfileId`) REFERENCES `CareerProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
