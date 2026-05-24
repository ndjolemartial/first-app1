-- AlterTable : LONGTEXT pour héberger des images embarquées (data URL) dans les modèles
ALTER TABLE `ContractTemplate` MODIFY `header` LONGTEXT NULL;
ALTER TABLE `ContractTemplate` MODIFY `body` LONGTEXT NOT NULL;
ALTER TABLE `ContractTemplate` MODIFY `footer` LONGTEXT NULL;
