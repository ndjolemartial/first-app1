-- AlterTable: élargir Document.path (chemins réseau UNC d'archives héritées > 191).
ALTER TABLE `Document` MODIFY COLUMN `path` VARCHAR(500) NOT NULL;
