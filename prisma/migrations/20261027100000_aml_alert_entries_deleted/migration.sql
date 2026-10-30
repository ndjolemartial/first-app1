-- Alertes CENTIF-CI / mises à jour SFC — nouveau champ « Nombre d'entrées
-- supprimées du référentiel » (saisie manuelle, à côté d'entriesAdded /
-- entriesModified).
-- Rédigé à la main (prisma migrate dev non-interactif).

-- AlterTable
ALTER TABLE `AmlWatchlistAlert` ADD COLUMN `entriesDeleted` INTEGER NULL;
