-- AddColumn: comptes de trésorerie par défaut d'un utilisateur (entrée / sortie),
-- préremplis dans le champ « Compte » du formulaire de nouvelle opération.
ALTER TABLE `User` ADD COLUMN `defaultAccountEntreeId` INTEGER NULL;
ALTER TABLE `User` ADD COLUMN `defaultAccountSortieId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `User`
  ADD CONSTRAINT `User_defaultAccountEntreeId_fkey`
  FOREIGN KEY (`defaultAccountEntreeId`) REFERENCES `BankAccount`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User`
  ADD CONSTRAINT `User_defaultAccountSortieId_fkey`
  FOREIGN KEY (`defaultAccountSortieId`) REFERENCES `BankAccount`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
