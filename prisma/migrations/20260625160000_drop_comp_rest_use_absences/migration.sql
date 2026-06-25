-- « Repos compensateur » redéfini : cumul des absences (maladie, maternité,
-- paternité, exceptionnelle) au lieu d'un type de congé dédié + compteur manuel.

-- Retire le type de congé dédié du formulaire de demande (liste les types actifs).
UPDATE `LeaveType` SET `isActive` = 0 WHERE `code` = 'REPOS_COMPENSATEUR';

-- Supprime le compteur manuel devenu inutile.
ALTER TABLE `Employee` DROP COLUMN `compRestAccrued`;
