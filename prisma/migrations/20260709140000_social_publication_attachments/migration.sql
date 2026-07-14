-- Pièces jointes des publications & articles (réseaux sociaux & web) : rattachement
-- de documents GED à une SocialPublication, sur le même principe que
-- Document.crmActivityId pour les activités CRM.

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `socialPublicationId` INTEGER NULL;

ALTER TABLE `Document` ADD INDEX `Document_socialPublicationId_idx`(`socialPublicationId`);

ALTER TABLE `Document` ADD CONSTRAINT `Document_socialPublicationId_fkey`
  FOREIGN KEY (`socialPublicationId`) REFERENCES `SocialPublication`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
