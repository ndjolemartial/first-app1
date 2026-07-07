import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { Users, Tags } from 'lucide-react';
import { useAuthStore } from '../../../shared/stores/auth.store';

// Rôles autorisés à gérer les « Objets de visite » (onglet + page). MANAGER en
// est exclu : il accède au module visiteurs mais pas à la configuration des objets.
const OBJECT_TAB_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ASSISTANTE_DIRECTION'];

const TABS = [
  { to: '/visitors', label: 'Visiteurs', icon: <Users className="h-4 w-4" />, end: true },
  { to: '/visitors/objects', label: 'Objets de visite', icon: <Tags className="h-4 w-4" />, end: false, roles: OBJECT_TAB_ROLES },
];

/** Barre d'onglets du module Gestion des visiteurs. */
export default function VisitorsTabs() {
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const tabs = TABS.filter((t) => !t.roles || t.roles.includes(role));
  return (
    <div className="mb-4 flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )
          }
        >
          {t.icon}
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
