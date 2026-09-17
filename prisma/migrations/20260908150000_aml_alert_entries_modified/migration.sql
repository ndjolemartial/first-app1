-- Alertes CENTIF-CI / mises à jour SFC — nouveau champ « Nombre d'entrées
-- modifiées dans le référentiel » (saisie manuelle, à côté d'entriesAdded).
-- Rédigé à la main (prisma migrate dev non-interactif).

-- AlterTable
ALTER TABLE `AmlWatchlistAlert` ADD COLUMN `entriesModified` INTEGER NULL;
