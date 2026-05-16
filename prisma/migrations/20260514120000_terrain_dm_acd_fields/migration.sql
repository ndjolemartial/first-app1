-- AlterTable
ALTER TABLE `Terrain`
  ADD COLUMN `numeroDM`  VARCHAR(191) NULL AFTER `viabilise`,
  ADD COLUMN `numeroACD` VARCHAR(191) NULL AFTER `titreFoncier`;
