-- Contrat de travail : détail de rémunération (CDI/CDD) saisi manuellement.
ALTER TABLE `EmploymentContract`
  ADD COLUMN `sursalaire` DECIMAL(15, 2) NULL,
  ADD COLUMN `primeAnciennete` DECIMAL(15, 2) NULL,
  ADD COLUMN `grossSalary` DECIMAL(15, 2) NULL,
  ADD COLUMN `its` DECIMAL(15, 2) NULL,
  ADD COLUMN `cnps` DECIMAL(15, 2) NULL,
  ADD COLUMN `totalDeductions` DECIMAL(15, 2) NULL,
  ADD COLUMN `transportAllowance` DECIMAL(15, 2) NULL,
  ADD COLUMN `netSalary` DECIMAL(15, 2) NULL;
