-- Suivi de remise et d'ouverture des emails sortants.

-- AlterTable
ALTER TABLE `Communication` ADD COLUMN `deliveredAt` DATETIME(3) NULL,
    ADD COLUMN `openedAt` DATETIME(3) NULL;
