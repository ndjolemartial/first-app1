import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

interface RoleGuardProps {
  allowedRoles: string[];
}

/**
 * Restreint l'accès aux routes enfants aux utilisateurs dont le rôle est
 * inclus dans `allowedRoles`. Redirige vers le tableau de bord sinon.
 * La sécurité réelle est appliquée côté main (handlers IPC) ; ce guard sert
 * uniquement à empêcher l'affichage de pages auxquelles l'utilisateur n'a
 * de toute façon pas accès.
 */
export default function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
