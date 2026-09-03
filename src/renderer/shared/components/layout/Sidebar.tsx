import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, UserSearch, UserCheck, Home, Building2,
  FileText, Calculator, MessageSquare, CalendarClock, Archive, Settings,
  Map, Landmark, Percent, Wallet, Building, PiggyBank, Briefcase, FileSpreadsheet, UserCog, ReceiptText, CalendarDays, Clock,
  BarChart3, ChevronDown, UserPlus, IdCard, Trophy, Gauge, Target, ClipboardCheck, Sliders,
  Share2, PenTool, Users2, AlarmClockOff, TrendingUp, AlertTriangle, Lightbulb, Radar, Phone,
  Handshake, Rocket, HardHat, Scale, ShieldAlert, GraduationCap,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { roleLabel } from '../../utils/roleLabel';
import { TABS as SETTINGS_TABS, ADMIN_ROLES as SETTINGS_ADMIN_ROLES } from '../../../modules/settings/pages/SettingsPage';
import { useMyTemplatePermissions } from '../../../modules/communication/hooks/useCommunication';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: string[];
  /**
   * Sous-chemins de `to` à exclure de la correspondance « actif » — ex :
   * /commissions/referrers, qui a son propre point d'entrée sous « Tierce
   * partie » et ne doit donc pas sélectionner aussi le menu « Commissions ».
   */
  matchExcludePrefixes?: string[];
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
  { label: 'Activités & CRM', to: '/crm', icon: <CalendarClock className="h-5 w-5" /> },
  { label: 'Communication', to: '/communication', icon: <MessageSquare className="h-5 w-5" /> },
  {
    label: 'Réseaux Sociaux & Web',
    icon: <Share2 className="h-5 w-5" />,
    // Groupe visible dès qu'un sous-onglet l'est pour le rôle : Publications &
    // articles est ouvert à tous sauf READONLY, d'où cette liste large.
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'RH'],
    children: [
      { label: 'Tableau de bord', to: '/social-media/dashboard', icon: <Gauge className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      { label: 'Publications & articles', to: '/social-media/publications', icon: <PenTool className="h-5 w-5" /> },
      { label: 'Abonnés', to: '/social-media/followers', icon: <Users2 className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANTE_DIRECTION', 'AGENT_TECHNIQUE'] },
      { label: 'Plateformes', to: '/social-media/platforms', icon: <Share2 className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    ],
  },
  {
    label: 'Innovations IT',
    to: '/innovations',
    icon: <Rocket className="h-5 w-5" />,
    // Création/gestion réservée aux rôles techniques (mêmes rôles que le
    // RoleGuard de router.tsx) : AGENT_TECHNIQUE (porteur, restreint à ses
    // propres innovations) + SUPER_ADMIN/ADMIN/MANAGER/RH (vue complète).
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RH', 'AGENT_TECHNIQUE'],
  },
  {
    label: 'Prospects & Clients',
    icon: <Users2 className="h-5 w-5" />,
    children: [
      { label: 'Prospects', to: '/prospects', icon: <UserSearch className="h-5 w-5" /> },
      { label: 'Clients', to: '/clients', icon: <UserCheck className="h-5 w-5" /> },
      // Périmètre inchangé (déplacé depuis « Analyses décisionnelles ») :
      // tous les rôles sauf RH.
      {
        label: 'Suivi Prospects & Clients', to: '/analytics/followup', icon: <Radar className="h-5 w-5" />,
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'AGENT_TECHNIQUE', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'READONLY'],
      },
    ],
  },
  {
    label: 'Tierce partie',
    icon: <Handshake className="h-5 w-5" />,
    // Groupe ouvert à tous : Apporteurs d'affaire est accessible à tout rôle
    // (vue filtrée pour les rôles non privilégiés) — Propriétaires reste
    // restreint via son propre `roles`, aligné sur le RoleGuard de /owners.
    children: [
      { label: 'Propriétaires', to: '/owners', icon: <Home className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
      { label: 'Apporteurs d\'affaire', to: '/commissions/referrers', icon: <UserPlus className="h-5 w-5" /> },
    ],
  },
  { label: 'Lotissements', to: '/lotissements', icon: <Map className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Terrains', to: '/terrains', icon: <Landmark className="h-5 w-5" /> },
  { label: 'Programmes immobiliers', to: '/programmes', icon: <Building className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  { label: 'Biens', to: '/properties', icon: <Building2 className="h-5 w-5" /> },
  { label: 'Projets', to: '/projects', icon: <Briefcase className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT_TECHNIQUE'] },
  {
    label: 'Devis & Calculateurs',
    icon: <FileSpreadsheet className="h-5 w-5" />,
    // Mêmes rôles pour les 3 sous-menus (Devis, Devis construction, Devis
    // permis de construire) — portés au niveau du groupe plutôt que dupliqués
    // sur chaque enfant.
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY'],
    children: [
      { label: 'Devis', to: '/quotes', icon: <FileSpreadsheet className="h-5 w-5" /> },
      { label: 'Devis construction', to: '/construction', icon: <HardHat className="h-5 w-5" /> },
      { label: 'Devis permis de construire', to: '/permits', icon: <Scale className="h-5 w-5" /> },
      { label: 'Factures Proforma', to: '/proforma', icon: <ReceiptText className="h-5 w-5" /> },
    ],
  },
  { label: 'Conventions / Attestations', to: '/conventions', icon: <FileText className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE'] },
  {
    label: 'Commissions', to: '/commissions', icon: <Percent className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY'],
    // Les pages Apporteurs d'affaire sont accessibles sous /commissions/referrers
    // mais ont leur propre entrée sous « Tierce partie » — elles ne doivent pas
    // sélectionner aussi « Commissions ». Seul un accès aux commissions d'un
    // apporteur (ex: /commissions/beneficiary/REFERRER/:id, depuis le bouton
    // « Commissions » d'une ligne ou de la fiche apporteur) reste couvert.
    matchExcludePrefixes: ['/commissions/referrers'],
  },
  { label: 'Comptabilité', to: '/accounting', icon: <Calculator className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { label: 'Trésorerie', to: '/treasury', icon: <Wallet className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { label: 'Budgets', to: '/budgets', icon: <PiggyBank className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { label: 'Charges prévisionnelles', to: '/expenses', icon: <ReceiptText className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'] },
  {
    label: 'Gestion du personnel',
    icon: <UserCog className="h-5 w-5" />,
    // Groupe visible de tous : « Retards & Départs précipités » est accessible
    // à tout rôle (auto-consultation pour les rôles hors SUPER_ADMIN/ADMIN/
    // MANAGER — cf. le sous-menu). Les autres sous-menus restent restreints
    // individuellement (« Congés & absences » porte donc désormais sa propre
    // liste, identique au périmètre historique du groupe).
    children: [
      { label: 'RH & Paie', to: '/hr/employees', icon: <Users className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER', 'ASSISTANTE_DIRECTION'] },
      { label: 'Bulletins de paie', to: '/hr/payslips', icon: <ReceiptText className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER'] },
      { label: 'Congés & absences', to: '/hr/leave', icon: <CalendarDays className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER', 'ASSISTANTE_DIRECTION'] },
      { label: 'Pointage', to: '/hr/attendance', icon: <Clock className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RH', 'MANAGER', 'ASSISTANTE_DIRECTION'] },
      { label: 'Retards & Départs précipités', to: '/hr/lateness', icon: <AlarmClockOff className="h-5 w-5" /> },
    ],
  },
  {
    label: 'Performances',
    icon: <Trophy className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'ADMIN', 'RH', 'MANAGER'],
    children: [
      { label: 'Tableau de bord', to: '/performance/dashboard', icon: <Gauge className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RH'] },
      { label: 'Objectifs', to: '/performance/objectives', icon: <Target className="h-5 w-5" /> },
      { label: 'Évaluations', to: '/performance/evaluations', icon: <ClipboardCheck className="h-5 w-5" /> },
      { label: 'Classements', to: '/performance/rankings', icon: <Trophy className="h-5 w-5" /> },
      { label: 'Configuration', to: '/performance/settings', icon: <Sliders className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RH'] },
    ],
  },
  // Self-service : accessible à tout utilisateur connecté (son propre dossier).
  { label: 'Mon espace RH', to: '/my-hr', icon: <IdCard className="h-5 w-5" /> },
  { label: 'Gestion des visiteurs', to: '/visitors', icon: <UserPlus className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'ASSISTANTE_DIRECTION', 'MANAGER'] },
  {
    label: 'Gestion des appels', to: '/calls', icon: <Phone className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANTE_DIRECTION', 'ACCOUNTANT'],
  },
  {
    label: 'Analyses décisionnelles',
    icon: <BarChart3 className="h-5 w-5" />,
    // Groupe ouvert aussi au MANAGER, mais seulement pour CRM & Clients,
    // Statistiques visiteurs et Statistiques appels — les autres sous-menus
    // restent réservés à SUPER_ADMIN/ADMIN. (« Suivi Prospects & Clients »
    // déplacé dans le groupe « Prospects & Clients ».)
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
    children: [
      { label: 'Tableau de bord', to: '/analytics/executive', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Finances et rentabilité', to: '/analytics/financial', icon: <TrendingUp className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Portefeuille', to: '/analytics/portfolio', icon: <Building2 className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'CRM & Clients', to: '/analytics/crm', icon: <Users className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      { label: 'Suivi Prospects & Clients', to: '/analytics/followup', icon: <Radar className="h-5 w-5" /> },
      { label: 'Charges', to: '/analytics/charges', icon: <ReceiptText className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Contractuel', to: '/analytics/contracts', icon: <FileText className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Statistiques visiteurs', to: '/analytics/visitors', icon: <UserPlus className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      { label: 'Statistiques appels', to: '/analytics/calls', icon: <Phone className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      { label: 'Risques', to: '/analytics/risk', icon: <AlertTriangle className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Recommandations', to: '/analytics/recommendations', icon: <Lightbulb className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ],
  },
  {
    label: 'Conformité LBC/FT',
    icon: <ShieldAlert className="h-5 w-5" />,
    // Rôle CONFORMITE dédié (Module 19), calqué sur RH — accès exclusif,
    // aucune équivalence checkRole. SUPER_ADMIN/ADMIN gardent la supervision.
    // MANAGER et ACCOUNTANT ont été ajoutés en plein accès (parité ADMIN).
    // AGENT / AGENT_TECHNIQUE / ASSISTANTE_DIRECTION / READONLY : accès
    // restreint à « Formations » et « Référentiel de vigilance » uniquement
    // (roles du groupe élargi à l'union des deux périmètres ; chaque enfant
    // réservé au périmètre plein accès porte désormais son propre `roles`
    // explicite).
    roles: ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION', 'READONLY'],
    children: [
      { label: 'Tableau de bord', to: '/aml/dashboard', icon: <Gauge className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'] },
      { label: 'Profils LBC/FT', to: '/aml/profiles', icon: <UserCheck className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'] },
      { label: 'Revues de transaction', to: '/aml/reviews', icon: <Radar className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'] },
      { label: 'Déclarations de soupçon', to: '/aml/suspicious-reports', icon: <AlertTriangle className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'] },
      { label: 'Formations', to: '/aml/training', icon: <GraduationCap className="h-5 w-5" /> },
      { label: 'Référentiel de vigilance', to: '/aml/watchlist', icon: <AlertTriangle className="h-5 w-5" /> },
    ],
  },
  // Visibilité calculée dynamiquement dans Sidebar() (hasAnySettingsAccess),
  // pas par un simple rôle statique : dépend de la liste des onglets visibles
  // (SettingsPage.TABS) ET de la désignation individuelle éventuelle comme
  // éditeur de modèles de messages manuels (indépendante du rôle).
  { label: 'GED - Archivage', to: '/archiving', icon: <Archive className="h-5 w-5" /> },
  { label: 'Utilisateurs', to: '/users', icon: <Users className="h-5 w-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT_TECHNIQUE'] },
  { label: 'Paramètres', to: '/settings', icon: <Settings className="h-5 w-5" /> },
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

/** Correspondance « actif » d'un lien de navigation, avec exclusions optionnelles de sous-chemins. */
function isNavItemActive(pathname: string, item: NavItem): boolean {
  const base = item.to.split('?')[0];
  const matches = pathname === base || pathname.startsWith(`${base}/`);
  if (!matches) return false;
  if (item.matchExcludePrefixes?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  return true;
}

function SidebarLink({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  const location = useLocation();
  const isActive = isNavItemActive(location.pathname, item);
  return (
    <Link to={item.to} className={clsx(itemClass({ isActive }), nested && 'pl-10 py-2')} style={itemStyle({ isActive })}>
      {item.icon}
      {item.label}
    </Link>
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

  // « Paramètres » ne doit apparaître que si l'utilisateur a effectivement
  // accès à au moins un onglet de la page Paramètres : soit un rôle admin,
  // soit un onglet explicitement ouvert à son rôle (SettingsPage.TABS), soit
  // une désignation individuelle comme éditeur de modèles de messages manuels
  // (indépendante du rôle — cf. commTemplates dans SettingsPage.tsx).
  const { data: templatePermRes } = useMyTemplatePermissions();
  const isSettingsAdmin = !!role && SETTINGS_ADMIN_ROLES.includes(role);
  const hasRoleTaggedTab = !!role && SETTINGS_TABS.some((t) => t.roles?.includes(role));
  const canManageManualTemplates = templatePermRes?.data?.canManageManual ?? false;
  const hasAnySettingsAccess = isSettingsAdmin || hasRoleTaggedTab || canManageManualTemplates;

  const visible: NavEntry[] = (navItems
    .map((entry) => {
      if (!isGroup(entry)) return canSee(entry.roles) ? entry : null;
      if (!canSee(entry.roles)) return null;
      const children = entry.children.filter((c) => canSee(c.roles));
      return children.length > 0 ? { ...entry, children } : null;
    })
    .filter(Boolean) as NavEntry[])
    .filter((entry) => isGroup(entry) || entry.to !== '/settings' || hasAnySettingsAccess);

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
            <p className="text-xs text-slate-400 truncate">{roleLabel(user?.role)}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
