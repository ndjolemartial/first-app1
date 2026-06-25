-- AddColumn: signature personnelle d'envoi de messages (module Communication).
ALTER TABLE `User` ADD COLUMN `messageSignature` TEXT NULL;
