import Input from '../ui/Input';

/**
 * Modalités de paiement (alignées sur l'enum Prisma `PaymentModalites`).
 * Réutilisé par les éditeurs de grille de prix et le formulaire de convention.
 */
export const PAYMENT_MODALITES: { value: string; label: string }[] = [
  { value: 'CASH', label: 'Comptant' },
  { value: 'SUR_3_MOIS', label: '3 mois' },
  { value: 'SUR_6_MOIS', label: '6 mois' },
  { value: 'SUR_9_MOIS', label: '9 mois' },
  { value: 'SUR_12_MOIS', label: '12 mois' },
  { value: 'SUR_24_MOIS', label: '24 mois' },
  { value: 'SUR_36_MOIS', label: '36 mois' },
  { value: 'SUR_48_MOIS', label: '48 mois' },
  { value: 'SUR_60_MOIS', label: '60 mois' },
  { value: 'SUR_PLUS_60_MOIS', label: '+ de 60 mois' },
];

/** Grille de prix : { modalite: montant }. Une modalité absente = pas de prix défini. */
export type PriceTiers = Record<string, number>;

interface Props {
  /** Valeurs en cours d'édition (chaîne vide quand le champ est vidé). */
  value: Record<string, number | ''>;
  onChange: (next: Record<string, number | ''>) => void;
  /** Grille héritée (ex : lotissement) — affichée en placeholder si non surchargée. */
  inherited?: PriceTiers | null;
  /** En-tête : passer `null`/'' pour ne rien afficher (cas embarqué dans une matrice). */
  title?: string | null;
  description?: string | null;
  /** Classe du conteneur (par défaut une séparation supérieure). */
  className?: string;
}

/**
 * Éditeur de grille de prix de vente par modalité de paiement.
 * Un champ laissé vide n'est pas envoyé : il hérite de la grille parente (le cas
 * échéant) ou reste non défini.
 */
export default function PriceTierEditor({
  value,
  onChange,
  inherited,
  title = 'Grille de prix de vente par échéance',
  description,
  className = 'border-t border-slate-100 pt-4',
}: Props) {
  const setTier = (modalite: string, raw: string) => {
    const next = { ...value };
    if (raw === '') delete next[modalite];
    else next[modalite] = Number(raw);
    onChange(next);
  };

  const fmt = (n: number) => n.toLocaleString('fr-FR');

  return (
    <div className={className}>
      {title ? (
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{title}</p>
      ) : null}
      {description ? <p className="text-xs text-slate-400 mb-3">{description}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PAYMENT_MODALITES.map((m) => {
          const inheritedVal = inherited?.[m.value];
          return (
            <Input
              key={m.value}
              label={m.label}
              type="number"
              min="0"
              step="1000"
              value={value[m.value] ?? ''}
              placeholder={inheritedVal != null ? `Hérité : ${fmt(inheritedVal)}` : 'FCFA'}
              onChange={(e) => setTier(m.value, e.target.value)}
            />
          );
        })}
      </div>
    </div>
  );
}
