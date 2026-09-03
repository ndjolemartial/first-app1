-- Journées à horaire de départ (et éventuellement d'arrivée) réduit, valables
-- pour toute l'entreprise (ex. journée continue se terminant à 12h/14h) —
-- remplacent, pour cette seule date, les seuils globaux
-- attendance.expectedArrival/expectedDeparture dans le calcul des Retards &
-- Départs précipités.
CREATE TABLE `AttendanceSpecialDay` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `expectedDeparture` VARCHAR(191) NOT NULL,
    `expectedArrival` VARCHAR(191) NULL,
    `label` VARCHAR(191) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AttendanceSpecialDay_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AttendanceSpecialDay` ADD CONSTRAINT `AttendanceSpecialDay_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
