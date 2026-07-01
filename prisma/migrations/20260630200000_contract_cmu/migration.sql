-- Retenue CMU (part salariale) au niveau du contrat de travail.
ALTER TABLE `EmploymentContract` ADD COLUMN `cmu` DECIMAL(15, 2) NULL;
