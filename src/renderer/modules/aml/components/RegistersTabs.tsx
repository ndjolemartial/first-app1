import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { BellRing, MessageSquare, Banknote, AlertTriangle } from 'lucide-react';

// Chaque volet a sa propre teinte — repère visuel constant (icône toujours
// colorée) renforcé à l'état actif (pastille + texte + liseré assortis).
const TABS = [
  {
    to: '/aml/registers/notifications',
    label: 'Notifications',
    icon: <BellRing className="h-4 w-4 text-amber-500" />,
    active: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  {
    to: '/aml/registers/exchanges',
    label: 'Échanges CENTIF-CI',
    icon: <MessageSquare className="h-4 w-4 text-sky-500" />,
    active: 'bg-sky-50 text-sky-800 ring-sky-200',
  },
  {
    to: '/aml/registers/dste',
    label: 'Grille DSTE',
    icon: <Banknote className="h-4 w-4 text-emerald-500" />,
    active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  {
    to: '/aml/registers/suspicious-operations',
    label: 'Opérations suspectes',
    icon: <AlertTriangle className="h-4 w-4 text-rose-500" />,
    active: 'bg-rose-50 text-rose-800 ring-rose-200',
  },
];

/**
 * Barre d'onglets des 4 « Registres LBC/FT » — accès géré par un seul et
 * même contrôle (indépendant des rôles, cf. AmlRegistersGuard), donc aucun
 * filtrage par onglet ici (contrairement à VisitorsTabs/SocialMediaTabs).
 */
export default function RegistersTabs() {
  return (
    <div className="mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all',
              isActive
                ? clsx('shadow-sm ring-1', t.active)
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-800',
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
