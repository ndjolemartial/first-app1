import { Navigate, Outlet } from 'react-router-dom';
import { useMyScreeningAccess } from '../../settings/hooks/useSettings';

/**
 * Restreint la route `/aml/screening` aux utilisateurs ayant accès au
 * Criblage — SUPER_ADMIN/ADMIN/MANAGER par défaut, ou désignation
 * individuelle via Paramètres → « Criblage — accès » (contrairement au
 * reste du Module 19, CONFORMITE et ACCOUNTANT n'y sont pas inclus d'office).
 * Même principe que `AmlRegistersGuard` : attend la réponse du serveur avant
 * de trancher pour ne pas rediriger à tort un utilisateur légitime pendant
 * le chargement.
 */
export default function AmlScreeningGuard() {
  const { data, isLoading } = useMyScreeningAccess();
  if (isLoading) return null;
  const hasAccess = data?.success && data.data?.hasAccess;
  if (!hasAccess) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
