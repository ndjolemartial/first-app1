-- AlterTable: ajout de la référence métier du prospect (PSP-YYYY-NNNN)
ALTER TABLE `Prospect` ADD COLUMN `reference` VARCHAR(191) NULL;

-- Backfill des prospects existants : séquence par année de création (ordre createdAt, id)
UPDATE `Prospect` p
JOIN (
  SELECT
    id,
    CONCAT(
      'PSP-', YEAR(createdAt), '-',
      LPAD(ROW_NUMBER() OVER (PARTITION BY YEAR(createdAt) ORDER BY createdAt, id), 4, '0')
    ) AS ref
  FROM `Prospect`
) g ON g.id = p.id
SET p.reference = g.ref;

-- Verrouillage : colonne obligatoire + unicité (comme les autres références métier)
ALTER TABLE `Prospect` MODIFY COLUMN `reference` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `Prospect_reference_key` ON `Prospect`(`reference`);
