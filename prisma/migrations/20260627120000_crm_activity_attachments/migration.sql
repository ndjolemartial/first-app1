-- Pièces jointes d'une activité CRM : un document GED peut être rattaché à une
-- activité (relation distincte du lien `documentId` qui pointe une archive unique).

ALTER TABLE `Document` ADD COLUMN `crmActivityId` INTEGER NULL;

ALTER TABLE `Document` ADD INDEX `Document_crmActivityId_idx`(`crmActivityId`);

ALTER TABLE `Document` ADD CONSTRAINT `Document_crmActivityId_fkey`
  FOREIGN KEY (`crmActivityId`) REFERENCES `CrmActivity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
