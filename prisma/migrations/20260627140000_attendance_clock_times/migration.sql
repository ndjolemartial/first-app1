-- Pointage par QR Code : horodatage des heures d'arrivée et de départ.

ALTER TABLE `AttendanceRecord` ADD COLUMN `arrivalTime` DATETIME(3) NULL;
ALTER TABLE `AttendanceRecord` ADD COLUMN `departureTime` DATETIME(3) NULL;
