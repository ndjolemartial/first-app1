-- AlterTable: ajout de la référence métier de l'utilisateur (USR-YYYY-NNNN)
ALTER TABLE `User` ADD COLUMN `reference` VARCHAR(191) NULL;

-- Backfill des utilisateurs existants : séquence par année de création (ordre createdAt, id)
UPDATE `User` u
JOIN (
  SELECT
    id,
    CONCAT(
      'USR-', YEAR(createdAt), '-',
      LPAD(ROW_NUMBER() OVER (PARTITION BY YEAR(createdAt) ORDER BY createdAt, id), 4, '0')
    ) AS ref
  FROM `User`
) g ON g.id = u.id
SET u.reference = g.ref;

-- Verrouillage : colonne obligatoire + unicité (comme les autres références métier)
ALTER TABLE `User` MODIFY COLUMN `reference` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `User_reference_key` ON `User`(`reference`);
