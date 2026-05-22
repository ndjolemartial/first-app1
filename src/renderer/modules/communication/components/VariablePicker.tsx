import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Braces, ChevronDown } from 'lucide-react';
import { COMM_VARIABLE_GROUPS, variableToken } from '../utils/variables';

interface VariablePickerProps {
  /** Appelé avec le jeton complet à insérer — ex. `{{firstName}}`. */
  onInsert: (token: string) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Sélecteur de variables dynamiques.
 *
 * Affiche, sous forme de menu déroulant, le catalogue des variables groupées.
 * Un clic sur une variable transmet son jeton (`{{cle}}`) au parent, qui se
 * charge de l'insérer à la position du curseur dans le champ concerné.
 */
export default function VariablePicker({ onInsert, label = 'Insérer une variable', disabled }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        <Braces className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className={clsx('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-80 w-72 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {COMM_VARIABLE_GROUPS.map((g) => (
            <div key={g.group} className="mb-2 last:mb-0">
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {g.group}
              </p>
              <div className="flex flex-wrap gap-1">
                {g.variables.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    title={variableToken(v.key)}
                    onClick={() => {
                      onInsert(variableToken(v.key));
                      setOpen(false);
                    }}
                    className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
