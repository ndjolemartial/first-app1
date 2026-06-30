import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, UserSearch, UserCheck, Home, Building2,
  FileText, Calculator, MessageSquare, CalendarClock, Archive, Settings,
  Map, Landmark, Percent, Wallet, Building, PiggyBank, Briefcase, FileSpreadsheet, UserCog, ReceiptText, CalendarDays, Clock,
  BarChart3, ChevronDown, UserPlus,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: string[];
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => 'children' in e;

const navItems: NavEntry[] = [
  { label: 'Tableau de bord', to: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Utilisateurs', to: '/users', icon: <Users className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT_TECHNIQUE'] },
  { label: 'Prospects', to: '/prospects', icon: <UserSearch className="h-5 w-5" /> },
  { label: 'Clients', to: '/clients', icon: <UserCheck className="h-5 w-5" /> },
  { label: 'Propriétaires', to: '/owners', icon: <Home className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Lotissements', to: '/lotissements', icon: <Map className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Terrains', to: '/terrains', icon: <Landmark className="h-5 w-5" /> },
  { label: 'Programmes immobiliers', to: '/programmes', icon: <Building className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Biens', to: '/properties', icon: <Building2 className="h-5 w-5" /> },
  { label: 'Devis', to: '/quotes', icon: <FileSpreadsheet className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY'] },
  { label: 'Conventions / Attestations', to: '/conventions', icon: <FileText className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE'] },
  { label: 'Commissions', to: '/commissions', icon: <Percent className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY'] },
  { label: 'Comptabilité', to: '/accounting', icon: <Calculator className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { label: 'Trésorerie', to: '/treasury', icon: <Wallet className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'] },
  { label: 'Budgets', to: '/budgets', icon: <PiggyBank className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'] },
  { label: 'Charges prévisionnelles', to: '/expenses', icon: <ReceiptText className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Communication', to: '/communication', icon: <MessageSquare className="h-5 w-5" /> },
  { label: 'Activités & CRM', to: '/crm', icon: <CalendarClock className="h-5 w-5" /> },
  { label: 'Archivage', to: '/archiving', icon: <Archive className="h-5 w-5" /> },
  { label: 'Projets', to: '/projects', icon: <Briefcase className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT_TECHNIQUE'] },
  {
    label: 'Gestion du personnel',
    icon: <UserCog className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'ADMIN', 'RH'],
    children: [
      { label: 'RH & Paie', to: '/hr/employees', icon: <Users className="h-5 w-5" /> },
      { label: 'Bulletins de paie', to: '/hr/payslips', icon: <ReceiptText className="h-5 w-5" /> },
      { label: 'Congés & absences', to: '/hr/leave', icon: <CalendarDays className="h-5 w-5" /> },
      { label: 'Pointage', to: '/hr/attendance', icon: <Clock className="h-5 w-5" /> },
    ],
  },
  { label: 'Gestion des visiteurs', to: '/visitors', icon: <UserPlus className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'ASSISTANTE_DIRECTION'] },
  { label: 'Analyses décisionnelles', to: '/analytics', icon: <BarChart3 className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Paramètres', to: '/settings', icon: <Settings className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'] },
];

/** Style commun aux liens de navigation (NavLink). */
function itemClass({ isActive }: { isActive: boolean }) {
  return clsx(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    isActive ? 'text-white' : 'hover:text-white',
  );
}
function itemStyle({ isActive }: { isActive: boolean }) {
  return {
    backgroundColor: isActive ? 'var(--theme-sidebar-active)' : 'transparent',
    color: isActive ? '#FFFFFF' : 'var(--theme-sidebar-text)',
  };
}

function SidebarLink({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  return (
    <NavLink to={item.to} className={(s) => clsx(itemClass(s), nested && 'pl-10 py-2')} style={itemStyle}>
      {item.icon}
      {item.label}
    </NavLink>
  );
}

function SidebarGroup({ group }: { group: NavGroup }) {
  const location = useLocation();
  const hasActiveChild = group.children.some((c) => location.pathname.startsWith(c.to.split('?')[0]));
  const [open, setOpen] = useState(hasActiveChild);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:text-white"
        style={{ color: hasActiveChild ? '#FFFFFF' : 'var(--theme-sidebar-text)' }}
      >
        {group.icon}
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.children.map((c) => <SidebarLink key={c.to} item={c} nested />)}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const canSee = (roles?: string[]) => !roles || (!!role && roles.includes(role));

  const visible: NavEntry[] = navItems
    .map((entry) => {
      if (!isGroup(entry)) return canSee(entry.roles) ? entry : null;
      if (!canSee(entry.roles)) return null;
      const children = entry.children.filter((c) => canSee(c.roles));
      return children.length > 0 ? { ...entry, children } : null;
    })
    .filter(Boolean) as NavEntry[];

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
        {visible.map((entry) =>
          isGroup(entry)
            ? <SidebarGroup key={entry.label} group={entry} />
            : <SidebarLink key={entry.to} item={entry} />,
        )}
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
