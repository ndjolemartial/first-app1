-- AlterTable : préférence de thème graphique de l'utilisateur (DEFAULT, AFRIKIMMO, DARK_GOLD)
ALTER TABLE `User` ADD COLUMN `theme` VARCHAR(32) NOT NULL DEFAULT 'DEFAULT';
