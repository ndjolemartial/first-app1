-- Adresses en copie/copie cachée d'un message ENTRANT — exception de
-- visibilité pour un utilisateur sans droit sur l'entité rattachée.

-- AlterTable
ALTER TABLE `Communication` ADD COLUMN `ccAddresses` TEXT NULL;
