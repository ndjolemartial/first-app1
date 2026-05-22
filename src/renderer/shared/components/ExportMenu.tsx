import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import Button from './ui/Button';
import { toast } from './ui/Toast';
import { useAuthStore } from '../stores/auth.store';

/** Définition d'une colonne exportable : libellé + extracteur de valeur. */
export interface ExportColumn<T = any> {
  header: string;
  cell: (row: T) => string | number | null | undefined;
}

interface ExportMenuProps<T = any> {
  /** Nom de fichier de base, sans extension (ex: "prospects"). */
  fileName: string;
  /** Titre affiché en tête du document exporté. */
  title: string;
  /** Colonnes du document. */
  columns: ExportColumn<T>[];
  /** Récupère l'intégralité des lignes correspondant au filtre courant. */
  fetchRows: () => Promise<T[]>;
  /** Résumé lisible du filtre appliqué (facultatif). */
  subtitle?: string;
  /** Ligne de total / solde affichée en pied du tableau exporté (facultatif). */
  totalRow?: (string | number)[];
}

/**
 * Bouton « Exporter » réutilisable pour les pages de liste.
 * Propose l'export PDF et Excel des données filtrées courantes.
 */
export default function ExportMenu<T>({
  fileName,
  title,
  columns,
  fetchRows,
  subtitle,
  totalRow,
}: ExportMenuProps<T>) {
  const token = useAuthStore((s) => s.token)!;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setOpen(false);
    setBusy(format);
    try {
      const rows = await fetchRows();
      if (!rows || rows.length === 0) {
        toast.error('Aucune donnée à exporter');
        return;
      }
      const headers = columns.map((c) => c.header);
      const matrix = rows.map((row) =>
        columns.map((c) => {
          const v = c.cell(row);
          return v === null || v === undefined ? '' : String(v);
        }),
      );
      const res = await window.electron.exporter.generate(token, {
        format,
        fileName,
        title,
        subtitle,
        headers,
        rows: matrix,
        totalRow: totalRow?.map((c) => (c === null || c === undefined ? '' : String(c))),
      });
      if (!res.success) {
        toast.error(typeof res.error === 'string' ? res.error : "Erreur lors de l'export");
      } else if (!res.data?.canceled) {
        toast.success(`Export ${format === 'pdf' ? 'PDF' : 'Excel'} enregistré`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'export");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        icon={<Download className="h-4 w-4" />}
        loading={!!busy}
        onClick={() => setOpen((o) => !o)}
      >
        Exporter
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg border border-slate-200 shadow-lg z-20 py-1">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => handleExport('pdf')}
          >
            <FileText className="h-4 w-4 text-red-500" /> Exporter en PDF
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => handleExport('xlsx')}
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" /> Exporter en Excel
          </button>
        </div>
      )}
    </div>
  );
}
