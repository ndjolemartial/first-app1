import { useMemo, useState } from 'react';
import SearchSelect from './ui/SearchSelect';
import { useCatalog } from '../hooks/useCatalog';
import { formatCurrency } from '../utils/format';

export interface CatalogPick {
  designation: string;
  unitPrice: number;
  category: string | null;
}

interface Props {
  /** Appelé avec la désignation et le prix de l'article choisi. */
  onPick: (item: CatalogPick) => void;
  label?: string;
  placeholder?: string;
}

/**
 * Sélecteur d'article du catalogue (prestations / produits). À chaque choix,
 * remonte la désignation et le prix unitaire pour pré-remplir une ligne de
 * devis ou de facture, puis se réinitialise. Affiche uniquement les articles
 * actifs.
 */
export default function CatalogPicker({ onPick, label, placeholder = 'Choisir dans le catalogue…' }: Props) {
  const { data: res } = useCatalog({});
  const [value, setValue] = useState('');
  const items: any[] = res?.data ?? [];

  const options = useMemo(() => [
    { value: '', label: placeholder },
    ...items.map((it) => ({
      value: String(it.id),
      label: `${it.designation} — ${formatCurrency(Number(it.unitPrice))}${it.unit ? ` / ${it.unit}` : ''}${it.category ? ` (${it.category})` : ''}`,
    })),
  ], [items, placeholder]);

  if (items.length === 0) return null;

  return (
    <SearchSelect
      label={label}
      options={options}
      value={value}
      placeholder={placeholder}
      onChange={(v) => {
        const it = items.find((i) => String(i.id) === v);
        if (it) onPick({ designation: it.designation, unitPrice: Number(it.unitPrice), category: it.category ?? null });
        setValue('');
      }}
    />
  );
}
