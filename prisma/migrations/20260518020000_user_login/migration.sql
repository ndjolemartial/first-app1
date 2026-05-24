-- AlterTable : ajout du login de connexion (alternative à l'adresse email)
ALTER TABLE `User` ADD COLUMN `login` VARCHAR(191) NULL;

-- CreateIndex : le login doit être unique
CREATE UNIQUE INDEX `User_login_key` ON `User`(`login`);
