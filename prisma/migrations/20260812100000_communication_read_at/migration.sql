-- Date de première consultation d'un message ENTRANT dans l'app (null = non lu).

-- AlterTable
ALTER TABLE `Communication` ADD COLUMN `readAt` DATETIME(3) NULL;
