-- Option par boîte email : recevoir tous les messages (pas seulement les
-- réponses à un envoi de l'app).

-- AlterTable
ALTER TABLE `MailAccount` ADD COLUMN `receiveAllMessages` BOOLEAN NOT NULL DEFAULT false;
