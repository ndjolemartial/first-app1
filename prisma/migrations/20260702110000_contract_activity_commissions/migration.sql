-- Commissions sur activité auxquelles l'employé a droit pour un contrat.
-- Instantané JSON : tableau de { key, label, rate } (taux en %).
ALTER TABLE `EmploymentContract`
  ADD COLUMN `activityCommissions` JSON NULL;
