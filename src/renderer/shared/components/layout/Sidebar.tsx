import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, UserSearch, UserCheck, Home, Building2,
  FileText, Calculator, MessageSquare, CalendarClock, Archive, Settings,
  Map, Landmark, Percent,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', to: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Utilisateurs', to: '/users', icon: <Users className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Prospects', to: '/prospects', icon: <UserSearch className="h-5 w-5" /> },
  { label: 'Clients', to: '/clients', icon: <UserCheck className="h-5 w-5" /> },
  { label: 'Propriétaires', to: '/owners', icon: <Home className="h-5 w-5" /> },
  { label: 'Biens', to: '/properties', icon: <Building2 className="h-5 w-5" /> },
  { label: 'Lotissements', to: '/lotissements', icon: <Map className="h-5 w-5" /> },
  { label: 'Terrains', to: '/terrains', icon: <Landmark className="h-5 w-5" /> },
  { label: 'Contrats', to: '/contracts', icon: <FileText className="h-5 w-5" /> },
  { label: 'Comptabilité', to: '/accounting', icon: <Calculator className="h-5 w-5" /> },
  { label: 'Commissions', to: '/commissions', icon: <Percent className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'] },
  { label: 'Communication', to: '/communication', icon: <MessageSquare className="h-5 w-5" /> },
  { label: 'CRM', to: '/crm', icon: <CalendarClock className="h-5 w-5" /> },
  { label: 'Archivage', to: '/archiving', icon: <Archive className="h-5 w-5" /> },
];

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);

  const visible = navItems.filter((item) =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <aside className="flex flex-col w-60 bg-[#1E3A5F] text-slate-200 h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
        <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">A</div>
        <span className="font-bold text-white text-base tracking-wide">Afrikimmo</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-slate-400 truncate">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
