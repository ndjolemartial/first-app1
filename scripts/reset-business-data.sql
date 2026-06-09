-- Réinitialisation des données métier Afrikimmo
-- Conserve : Users, Lotissements, Programmes, Prospects, Modèles/Paramètres,
--            Budgets, Comptes de trésorerie, références.
-- Vide : Client, Owner, BusinessReferrer, Convention, Property, Terrain
--        + dépendances strictes ; nettoyage chirurgical des tables polymorphes.

SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

-- ── Nettoyage chirurgical : seules les lignes pointant vers les entités supprimées ──
DELETE FROM Document
 WHERE clientId IS NOT NULL OR ownerId IS NOT NULL OR propertyId IS NOT NULL
    OR conventionId IS NOT NULL OR terrainId IS NOT NULL OR referrerId IS NOT NULL
    OR invoiceId IS NOT NULL OR commissionId IS NOT NULL OR attestationId IS NOT NULL;

DELETE FROM CrmActivity
 WHERE clientId IS NOT NULL OR ownerId IS NOT NULL OR propertyId IS NOT NULL
    OR conventionId IS NOT NULL OR terrainId IS NOT NULL OR invoiceId IS NOT NULL
    OR installmentId IS NOT NULL;

DELETE FROM Communication
 WHERE clientId IS NOT NULL OR ownerId IS NOT NULL OR conventionId IS NOT NULL;

DELETE FROM TreasuryOperation
 WHERE paymentId IS NOT NULL OR installmentId IS NOT NULL OR commissionId IS NOT NULL;

-- ── Conservation avec rupture de lien (entités hors périmètre) ──
UPDATE Prospect SET clientId = NULL, convertedAt = NULL
 WHERE clientId IS NOT NULL;

UPDATE Project SET clientId = NULL, ownerId = NULL, terrainId = NULL
 WHERE clientId IS NOT NULL OR ownerId IS NOT NULL OR terrainId IS NOT NULL;

-- ── Vidage complet : dépendances strictes (enfants d'abord) ──
DELETE FROM Payment;
DELETE FROM InvoiceItem;
DELETE FROM SaleInstallment;
DELETE FROM Invoice;
DELETE FROM ConventionProperty;
DELETE FROM ConventionTerrain;
DELETE FROM Attestation;
DELETE FROM Commission;
DELETE FROM PropertyPhoto;
DELETE FROM TerrainPhoto;

-- ── Vidage complet : les 6 tables demandées ──
DELETE FROM Convention;
DELETE FROM Property;
DELETE FROM Terrain;
DELETE FROM Client;
DELETE FROM Owner;
DELETE FROM BusinessReferrer;

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;

-- ── Remise à zéro des compteurs auto-increment des tables vidées ──
ALTER TABLE Client AUTO_INCREMENT = 1;
ALTER TABLE Owner AUTO_INCREMENT = 1;
ALTER TABLE BusinessReferrer AUTO_INCREMENT = 1;
ALTER TABLE Convention AUTO_INCREMENT = 1;
ALTER TABLE Property AUTO_INCREMENT = 1;
ALTER TABLE Terrain AUTO_INCREMENT = 1;
ALTER TABLE Invoice AUTO_INCREMENT = 1;
ALTER TABLE InvoiceItem AUTO_INCREMENT = 1;
ALTER TABLE Payment AUTO_INCREMENT = 1;
ALTER TABLE SaleInstallment AUTO_INCREMENT = 1;
ALTER TABLE Attestation AUTO_INCREMENT = 1;
ALTER TABLE Commission AUTO_INCREMENT = 1;
ALTER TABLE PropertyPhoto AUTO_INCREMENT = 1;
ALTER TABLE TerrainPhoto AUTO_INCREMENT = 1;
