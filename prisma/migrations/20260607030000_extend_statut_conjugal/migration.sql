-- AlterEnum StatutConjugalType : ajout de DIVORCE et VEUF.
-- En MySQL l'enum est défini par colonne : modifier chaque table l'utilisant.
ALTER TABLE `Client` MODIFY COLUMN `statutConjugal`
  ENUM('CELIBATAIRE','MARIEE','CONCUBINAGE','DIVORCE','VEUF') NOT NULL DEFAULT 'CELIBATAIRE';

ALTER TABLE `User` MODIFY COLUMN `statutConjugal`
  ENUM('CELIBATAIRE','MARIEE','CONCUBINAGE','DIVORCE','VEUF') NULL;
