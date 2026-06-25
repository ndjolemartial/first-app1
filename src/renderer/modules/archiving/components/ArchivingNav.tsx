import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuthStore } from '../../../shared/stores/auth.store';

// Rôles ayant accès complet au module Archivage (au-delà de l'espace personnel).
const FULL_ARCHIVING_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];

const TABS = [
  { label: 'Tableau de bord GED', to: '/archiving/ged/dashboard', full: true },
  { label: 'GED — Documents', to: '/archiving/ged', full: false },
  { label: 'Organisation', to: '/archiving/ged/settings', full: true },
  { label: 'Entités archivées', to: '/archiving/entities', full: true },
  { label: 'Politiques', to: '/archiving/policies', full: true },
];

/** Barre d'onglets du module Archivage (archivage d'entités + GED). */
export default function ArchivingNav() {
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const isFull = FULL_ARCHIVING_ROLES.includes(role);
  const tabs = isFull ? TABS : TABS.filter((t) => !t.full);
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            clsx(
              '-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
