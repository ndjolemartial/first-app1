-- Mise à jour des lignes existantes avant modification de l'enum
UPDATE `Prospect` SET `source` = 'PROSPECTION' WHERE `source` = 'MANUAL';

-- AlterTable : remplacement de MANUAL par PROSPECTION dans l'enum source
ALTER TABLE `Prospect`
  MODIFY COLUMN `source` ENUM(
    'SITE_WEB_AFRIKIMMO',
    'RECOMMENDATION',
    'TELEPHONE',
    'RESEAUX_SOCIAUX',
    'EMAIL',
    'CONTACT_PERSONNEL',
    'AUTRE',
    'PROSPECTION'
  ) NOT NULL DEFAULT 'PROSPECTION';
