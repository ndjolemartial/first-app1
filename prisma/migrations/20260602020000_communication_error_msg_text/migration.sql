-- ── Communication.errorMsg : VARCHAR(191) \xE9tait trop court ─────────────────
-- Les r\xE9ponses HTTP d'erreur des fournisseurs SMS/WhatsApp (Twilio, Orange,
-- Brevo…) contiennent souvent du JSON d\xE9taill\xE9 qui d\xE9passe 191 caract\xE8res.
-- On passe la colonne en TEXT (65535 octets en MariaDB) pour pouvoir
-- journaliser la r\xE9ponse compl\xE8te sans tronquer en base.
ALTER TABLE `Communication` MODIFY `errorMsg` TEXT NULL;
