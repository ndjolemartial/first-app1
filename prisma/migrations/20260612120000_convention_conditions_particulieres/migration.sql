-- AddColumn: conditions particulières (texte multi-lignes) choisies dans le
-- formulaire de convention pour les types hérités, parmi la liste configurée
-- dans les Paramètres.
ALTER TABLE `Convention` ADD COLUMN `conditionsParticulieres` TEXT NULL;
