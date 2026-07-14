import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { Gauge, PenTool, Users2, Share2 } from 'lucide-react';
import { useAuthStore } from '../../../shared/stores/auth.store';

// Mêmes listes de rôles que les RoleGuard de router.tsx / Sidebar.tsx pour ce module.
const DASHBOARD_PLATFORMS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const FOLLOWERS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANTE_DIRECTION', 'AGENT_TECHNIQUE'];

const TABS = [
  { to: '/social-media/dashboard', label: 'Tableau de bord', icon: <Gauge className="h-4 w-4" />, end: true, roles: DASHBOARD_PLATFORMS_ROLES },
  { to: '/social-media/publications', label: 'Publications & articles', icon: <PenTool className="h-4 w-4" />, end: false },
  { to: '/social-media/followers', label: 'Abonnés', icon: <Users2 className="h-4 w-4" />, end: false, roles: FOLLOWERS_ROLES },
  { to: '/social-media/platforms', label: 'Plateformes', icon: <Share2 className="h-4 w-4" />, end: false, roles: DASHBOARD_PLATFORMS_ROLES },
];

/** Barre d'onglets du module Réseaux Sociaux & Plateformes Web. */
export default function SocialMediaTabs() {
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
