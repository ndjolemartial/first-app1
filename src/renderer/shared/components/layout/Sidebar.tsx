import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, UserSearch, UserCheck, Home, Building2,
  FileText, Calculator, MessageSquare, CalendarClock, Archive, Settings,
  Map, Landmark, Percent, Wallet, Building, PiggyBank, Briefcase,
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
  { label: 'Propriétaires', to: '/owners', icon: <Home className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Lotissements', to: '/lotissements', icon: <Map className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Terrains', to: '/terrains', icon: <Landmark className="h-5 w-5" /> },
  { label: 'Programmes immobiliers', to: '/programmes', icon: <Building className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Biens', to: '/properties', icon: <Building2 className="h-5 w-5" /> },
  { label: 'Conventions / Attestations', to: '/conventions', icon: <FileText className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Commissions', to: '/commissions', icon: <Percent className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'READONLY'] },
  { label: 'Comptabilité', to: '/accounting', icon: <Calculator className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { label: 'Trésorerie', to: '/treasury', icon: <Wallet className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'] },
  { label: 'Budgets', to: '/budgets', icon: <PiggyBank className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'] },
  { label: 'Communication', to: '/communication', icon: <MessageSquare className="h-5 w-5" /> },
  { label: 'CRM', to: '/crm', icon: <CalendarClock className="h-5 w-5" /> },
  { label: 'Archivage', to: '/archiving', icon: <Archive className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Projets', to: '/projects', icon: <Briefcase className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Paramètres', to: '/settings', icon: <Settings className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
];

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);

  const visible = navItems.filter((item) =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <aside
      className="flex flex-col w-60 h-full"
      style={{ background: 'var(--theme-sidebar)', color: 'var(--theme-sidebar-text)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
        <div className="sidebar-placeholder h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">A</div>
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
                  ? 'text-white'
                  : 'hover:text-white',
              )
            }
            style={({ isActive }: { isActive: boolean }) => ({
              backgroundColor: isActive ? 'var(--theme-sidebar-active)' : 'transparent',
              color: isActive ? '#FFFFFF' : 'var(--theme-sidebar-text)',
            })}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="sidebar-placeholder h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
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
