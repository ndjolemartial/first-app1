-- Ajout du type de contrat de travail « ESSAI » (contrat à l'essai).
ALTER TABLE `EmploymentContract`
  MODIFY `type` ENUM('CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE', 'ESSAI') NOT NULL DEFAULT 'CDI';
ALTER TABLE `ContractTemplate`
  MODIFY `type` ENUM('CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE', 'ESSAI') NOT NULL;
