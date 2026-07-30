-- ════════════════════════════════════════════════════════════════════
-- Migration : Nombre de parts IGR figé sur le bulletin de paie
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Le nombre de parts IGR d'un employé (Employee.igrParts) peut changer
--     au fil du temps (enfants, statut matrimonial). Jusqu'ici, l'ITS était
--     calculé avec la valeur en vigueur au moment du calcul (correct), mais
--     le document imprimé/rendu d'un bulletin ANCIEN affichait la valeur
--     ACTUELLE de l'employé — pouvant devenir incohérente avec l'ITS déjà
--     calculé si le nombre de parts a changé depuis.
--   - Ajoute `Payslip.igrParts`, figé à la génération, pour que la
--     modification ultérieure du profil de l'employé n'affecte jamais un
--     bulletin déjà émis (ni son calcul en cas de recalcul d'un brouillon,
--     ni son affichage).
--
--  Backfill : aucune valeur historique n'étant disponible pour les bulletins
--  déjà émis, on reprend le nombre de parts ACTUEL de chaque employé (seule
--  approximation possible) — pas pire que le comportement actuel (lecture
--  live), mais devient exact pour tout bulletin généré après cette migration.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `Payslip`
  ADD COLUMN `igrParts` DECIMAL(4, 1) NOT NULL DEFAULT 1;

UPDATE `Payslip` p
  JOIN `Employee` e ON e.`id` = p.`employeeId`
  SET p.`igrParts` = e.`igrParts`;
