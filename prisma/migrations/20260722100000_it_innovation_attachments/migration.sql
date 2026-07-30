-- Pièces jointes des innovations IT : rattachement de documents GED à une
-- ItInnovation, sur le même principe que Document.crmActivityId /
-- socialPublicationId. `itInnovationPhase` repère la phase (1/2/3) justifiée
-- par la pièce jointe, pour affichage lors de la validation par étape.

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `itInnovationId` INTEGER NULL, ADD COLUMN `itInnovationPhase` INTEGER NULL;

ALTER TABLE `Document` ADD INDEX `Document_itInnovationId_idx`(`itInnovationId`);

ALTER TABLE `Document` ADD CONSTRAINT `Document_itInnovationId_fkey`
  FOREIGN KEY (`itInnovationId`) REFERENCES `ItInnovation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
