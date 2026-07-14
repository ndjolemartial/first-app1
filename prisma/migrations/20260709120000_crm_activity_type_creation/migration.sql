-- CRM : nouveau type d'activité « Créas, Publications ou articles ».

-- AlterTable
ALTER TABLE `CrmActivity` MODIFY `type` ENUM('NOTIFICATION', 'APPEL', 'EMAIL', 'SMS', 'REUNION', 'VISITE', 'TASK', 'RAPPEL', 'DOCUMENT', 'CREATION_PUBLICATION') NOT NULL;
