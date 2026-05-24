-- AlterTable : compte de trésorerie rattaché à un utilisateur (compte privé)
ALTER TABLE `BankAccount` ADD COLUMN `linkedUserId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `BankAccount` ADD CONSTRAINT `BankAccount_linkedUserId_fkey` FOREIGN KEY (`linkedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
