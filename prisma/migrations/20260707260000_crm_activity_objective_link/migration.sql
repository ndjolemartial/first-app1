-- Lien tâche CRM → objectif de performance (Mesure manuelle) + quantité réalisée.

-- AlterTable
ALTER TABLE `CrmActivity` ADD COLUMN `objectiveId` INTEGER NULL,
    ADD COLUMN `objectiveRealized` DECIMAL(15, 2) NULL;

-- CreateIndex
CREATE INDEX `CrmActivity_objectiveId_idx` ON `CrmActivity`(`objectiveId`);

-- AddForeignKey
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_objectiveId_fkey` FOREIGN KEY (`objectiveId`) REFERENCES `PerformanceObjective`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
