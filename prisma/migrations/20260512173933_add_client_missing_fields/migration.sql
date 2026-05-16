/*
  Warnings:

  - You are about to alter the column `civilite` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(16))` to `Enum(EnumId(4))`.

*/
-- AlterTable
ALTER TABLE `Client` ADD COLUMN `status` ENUM('ACTIF', 'INACTIF', 'VIP', 'SUSPENDU') NOT NULL DEFAULT 'ACTIF',
    ADD COLUMN `statutConjugal` ENUM('CELIBATAIRE', 'MARIEE', 'CONCUBINAGE') NOT NULL DEFAULT 'CELIBATAIRE',
    MODIFY `civilite` ENUM('MONSIEUR', 'MADAME', 'MADEMOISELLE') NOT NULL DEFAULT 'MONSIEUR';
