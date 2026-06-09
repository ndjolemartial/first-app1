-- AlterTable: ajout de la référence métier du client (CLI-YYYY-NNNN)
ALTER TABLE `Client` ADD COLUMN `reference` VARCHAR(191) NULL;

-- Backfill des clients existants : séquence par année de création (ordre createdAt, id)
UPDATE `Client` c
JOIN (
  SELECT
    id,
    CONCAT(
      'CLI-', YEAR(createdAt), '-',
      LPAD(ROW_NUMBER() OVER (PARTITION BY YEAR(createdAt) ORDER BY createdAt, id), 4, '0')
    ) AS ref
  FROM `Client`
) g ON g.id = c.id
SET c.reference = g.ref;

-- Verrouillage : colonne obligatoire + unicité (comme les autres références métier)
ALTER TABLE `Client` MODIFY COLUMN `reference` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `Client_reference_key` ON `Client`(`reference`);
