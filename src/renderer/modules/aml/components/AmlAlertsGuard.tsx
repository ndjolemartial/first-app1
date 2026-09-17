import { Navigate, Outlet } from 'react-router-dom';
import { useMyAlertsAccess } from '../../settings/hooks/useSettings';

/**
 * Restreint la route `/aml/alerts` aux utilisateurs ayant accès aux
 * Alertes — SUPER_ADMIN/ADMIN/MANAGER par défaut, ou désignation
 * individuelle via Paramètres → « Alertes — accès » (contrairement au
 * reste du Module 19, CONFORMITE et ACCOUNTANT n'y sont pas inclus d'office).
 * Même principe que `AmlScreeningGuard`/`AmlRegistersGuard` : attend la
 * réponse du serveur avant de trancher pour ne pas rediriger à tort un
 * utilisateur légitime pendant le chargement.
 */
export default function AmlAlertsGuard() {
  const { data, isLoading } = useMyAlertsAccess();
  if (isLoading) return null;
  const hasAccess = data?.success && data.data?.hasAccess;
  if (!hasAccess) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
