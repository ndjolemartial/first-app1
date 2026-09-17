-- Grille DSTE (Registres LBC/FT) — auto-recensement des transactions en
-- espèces au-delà du seuil paramétrable. sourceType/sourceId servent de clé
-- de déduplication pour l'auto-détection (aml-dste.service.ts) ; NULL
-- (saisie manuelle) reste autorisé en plusieurs exemplaires. Rédigé à la
-- main (prisma migrate dev non-interactif).

-- AlterTable
ALTER TABLE `AmlDsteRecord`
  ADD COLUMN `sourceType` VARCHAR(191) NULL,
  ADD COLUMN `sourceId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `AmlDsteRecord_sourceType_sourceId_key` ON `AmlDsteRecord`(`sourceType`, `sourceId`);
