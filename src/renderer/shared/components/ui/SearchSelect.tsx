import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { clsx } from 'clsx';
import { Check, ChevronDown, X } from 'lucide-react';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';

export interface SearchSelectOption {
  value: string;
  label: string;
}

interface SearchSelectProps {
  label?: string;
  /**
   * Liste des options. Une option dont `value` vaut '' est traitée comme libellé
   * indicatif (placeholder) et non comme un choix sélectionnable.
   */
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

/** Normalise une chaîne pour une recherche insensible à la casse et aux accents. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Champ de sélection avec saisie assistée (combobox filtrable).
 *
 * L'utilisateur peut taper pour filtrer la liste — pratique lorsque le nombre
 * d'éléments est élevé (clients, biens, conventions…). Navigable au clavier
 * (flèches, Entrée, Échap) et compatible avec les écrans tactiles.
 */
export default function SearchSelect({
  label,
  options,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  disabled,
  required,
  name,
  id,
  className,
}: SearchSelectProps) {
  const autoId = useId();
  const fieldId = id ?? `searchselect-${autoId}`;
  const listId = `${fieldId}-list`;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  // L'option « vide » sert de libellé indicatif, pas d'élément sélectionnable.
  const emptyOption = options.find((o) => o.value === '');
  const realOptions = useMemo(() => options.filter((o) => o.value !== ''), [options]);
  const selected = realOptions.find((o) => o.value === value);
  const resolvedPlaceholder = placeholder ?? emptyOption?.label ?? 'Sélectionner…';

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return realOptions;
    return realOptions.filter((o) => normalize(o.label).includes(q));
  }, [realOptions, query]);

  // Ferme la liste lors d'un clic à l'extérieur du composant.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        onBlur?.();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, onBlur]);

  // Maintient l'élément surligné visible lors du défilement clavier.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const openList = () => {
    if (disabled || open) return;
    setQuery('');
    setHighlight(Math.max(0, realOptions.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const closeList = () => {
    setOpen(false);
    setQuery('');
    onBlur?.();
  };

  const commit = (opt: SearchSelectOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setHighlight(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          openList();
        } else {
          setHighlight((h) => Math.min(h + 1, filtered.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        break;
      case 'Enter':
        if (open && filtered[highlight]) {
          e.preventDefault();
          commit(filtered[highlight]);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          closeList();
        }
        break;
      default:
        break;
    }
  };

  const inputDisplay = open ? query : selected?.label ?? '';

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={fieldId}
          name={name}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={inputDisplay}
          placeholder={open && selected ? selected.label : resolvedPlaceholder}
          title={selected?.label ?? ''}
          onFocus={openList}
          onClick={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            // Ignore si le focus reste dans le composant (clic sur une option).
            if (containerRef.current?.contains(e.relatedTarget as Node)) return;
            closeList();
          }}
          className={clsx(
            'w-full rounded-lg border px-3 py-2 pr-16 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 bg-white',
            error ? 'border-red-400 focus:ring-red-400' : 'border-slate-300',
            className,
          )}
        />
        {value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Effacer la sélection"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <ChevronDown
          className={clsx(
            'absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none transition-transform',
            open && 'rotate-180',
          )}
        />
        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">Aucun résultat</li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  title={opt.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(opt)}
                  onMouseEnter={() => setHighlight(i)}
                  className={clsx(
                    'flex items-start justify-between gap-2 px-3 py-2 text-sm cursor-pointer',
                    i === highlight ? 'bg-blue-50 text-blue-700' : 'text-slate-700',
                  )}
                >
                  <span className="whitespace-normal break-words">{opt.label}</span>
                  {opt.value === value && (
                    <Check className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface FormSearchSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  options: SearchSelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  /** Notifié après mise à jour de la valeur — pour les effets de bord (pré-remplissage…). */
  onValueChange?: (value: string) => void;
}

/**
 * Variante de {@link SearchSelect} branchée sur react-hook-form via `Controller`.
 * Évite d'avoir à câbler manuellement `value`/`onChange` sur chaque formulaire.
 */
export function FormSearchSelect<T extends FieldValues>({
  control,
  name,
  error,
  onValueChange,
  ...rest
}: FormSearchSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SearchSelect
          {...rest}
          name={field.name}
          value={field.value == null || field.value === '' ? '' : String(field.value)}
          onChange={(v) => {
            field.onChange(v);
            onValueChange?.(v);
          }}
          onBlur={field.onBlur}
          error={error ?? fieldState.error?.message}
        />
      )}
    />
  );
}
