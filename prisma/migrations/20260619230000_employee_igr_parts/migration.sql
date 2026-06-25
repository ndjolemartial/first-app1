-- Employé : nombre de parts IGR (quotient familial), affiché sur le bulletin.
ALTER TABLE `Employee` ADD COLUMN `igrParts` DECIMAL(4, 1) NOT NULL DEFAULT 1;
