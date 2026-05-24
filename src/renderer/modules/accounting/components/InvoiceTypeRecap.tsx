import { ShoppingBag, CalendarClock, Building2, Wallet, FileSignature, ArrowDownToLine, Lock, FileQuestion, LucideIcon } from 'lucide-react';

type InvoiceType =
  | 'VENTE'
  | 'ECHEANCE_VENTE'
  | 'FRAIS_AGENCE'
  | 'FRAIS_DE_GESTION'
  | 'FRAIS_DEMARCHES_ACD'
  | 'AVANCE'
  | 'CAUTION'
  | 'OTHER';

interface TypeDef {
  key: InvoiceType;
  label: string;
  Icon: LucideIcon;
  /** Couleur tailwind appliquée en arrière-plan de l'avatar quand actif/présent. */
  color: string;
}

// Ordre d'affichage des avatars dans la barre.
const TYPES: TypeDef[] = [
  { key: 'VENTE',               label: 'Vente',                Icon: ShoppingBag,    color: 'bg-emerald-500' },
  { key: 'ECHEANCE_VENTE',      label: 'Échéance vente',       Icon: CalendarClock,  color: 'bg-teal-500'    },
  { key: 'FRAIS_AGENCE',        label: 'Frais agence',         Icon: Building2,      color: 'bg-indigo-500'  },
  { key: 'FRAIS_DE_GESTION',    label: 'Frais de gestion',     Icon: Wallet,         color: 'bg-blue-500'    },
  { key: 'FRAIS_DEMARCHES_ACD', label: 'Frais démarches ACD',  Icon: FileSignature,  color: 'bg-violet-500'  },
  { key: 'AVANCE',              label: 'Avance',               Icon: ArrowDownToLine, color: 'bg-amber-500'  },
  { key: 'CAUTION',             label: 'Caution',              Icon: Lock,           color: 'bg-rose-500'    },
  { key: 'OTHER',               label: 'Autre',                Icon: FileQuestion,   color: 'bg-slate-500'   },
];

interface Props {
  stats?: Record<string, number>;
  /** Type actuellement sélectionné (filtre actif), '' = aucun. */
  selectedType: string;
  /** Notifie la sélection : passer la même valeur que `selectedType` désactive. */
  onSelect: (type: string) => void;
  isLoading?: boolean;
}

export default function InvoiceTypeRecap({ stats, selectedType, onSelect, isLoading }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">
        Récapitulatif par type
      </p>
      <div className="flex flex-wrap gap-4">
        {TYPES.map(({ key, label, Icon, color }) => {
          const count = stats?.[key] ?? 0;
          const isSelected = selectedType === key;
          const isEmpty = count === 0;
          // Désactivé visuellement si zéro et non sélectionné. Toujours cliquable
          // (le clic retire le filtre s'il était actif).
          const containerClass = isSelected
            ? 'ring-2 ring-offset-2 ring-blue-500'
            : isEmpty
              ? 'opacity-40 hover:opacity-70'
              : 'hover:scale-105';
          const bgClass = isEmpty && !isSelected ? 'bg-slate-300' : color;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(isSelected ? '' : key)}
              title={`${label} — ${count} facture${count > 1 ? 's' : ''}`}
              aria-label={`${label} : ${count} factures`}
              aria-pressed={isSelected}
              disabled={isLoading}
              className={`relative flex flex-col items-center gap-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full ${containerClass}`}
            >
              <div className={`relative h-12 w-12 rounded-full ${bgClass} text-white flex items-center justify-center shadow-sm`}>
                <Icon className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center justify-center tabular-nums">
                  {count}
                </span>
              </div>
              <span className="text-[11px] text-slate-600 max-w-[80px] truncate text-center">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
