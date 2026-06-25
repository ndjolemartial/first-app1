-- AddColumn: intégration du logo dans la signature personnelle des messages.
ALTER TABLE `User` ADD COLUMN `messageSignatureLogo` BOOLEAN NOT NULL DEFAULT false;
