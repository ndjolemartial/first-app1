-- CreateTable: liste d'affichage d'un compte de trésorerie (compte ↔ utilisateur).
-- Détermine quels utilisateurs non-admin voient le compte dans le bloc
-- « Comptes de trésorerie » du tableau de bord.
CREATE TABLE `BankAccountViewer` (
    `bankAccountId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `BankAccountViewer_userId_idx`(`userId`),
    PRIMARY KEY (`bankAccountId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BankAccountViewer`
  ADD CONSTRAINT `BankAccountViewer_bankAccountId_fkey`
  FOREIGN KEY (`bankAccountId`) REFERENCES `BankAccount`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankAccountViewer`
  ADD CONSTRAINT `BankAccountViewer_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
