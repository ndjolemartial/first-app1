import { Navigate, Outlet } from 'react-router-dom';
import { useMyRegistersAccess } from '../../settings/hooks/useSettings';

/**
 * Restreint les routes `/aml/registers/*` aux utilisateurs ayant accès aux
 * Registres LBC/FT — indépendamment du rôle (SUPER_ADMIN/ADMIN/CONFORMITE/
 * MANAGER/ACCOUNTANT par défaut, ou désignation individuelle via Paramètres
 * → « Registres LBC/FT — accès »), donc pas un simple `RoleGuard` à liste de
 * rôles statique. Attend la réponse du serveur avant de trancher (contraire-
 * ment à `useKycAccess`, « faux pendant le chargement » redirigerait ici à
 * tort un utilisateur légitime avant que la requête n'ait résolu).
 */
export default function AmlRegistersGuard() {
  const { data, isLoading } = useMyRegistersAccess();
  if (isLoading) return null;
  const hasAccess = data?.success && data.data?.hasAccess;
  if (!hasAccess) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
