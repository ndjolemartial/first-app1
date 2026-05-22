import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const TABS = [
  { label: 'Tableau de bord GED', to: '/archiving/ged/dashboard' },
  { label: 'GED — Documents', to: '/archiving/ged' },
  { label: 'Organisation', to: '/archiving/ged/settings' },
  { label: 'Entités archivées', to: '/archiving/entities' },
  { label: 'Politiques', to: '/archiving/policies' },
];

/** Barre d'onglets du module Archivage (archivage d'entités + GED). */
export default function ArchivingNav() {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.map((t) => (
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
