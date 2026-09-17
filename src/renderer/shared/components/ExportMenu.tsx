import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, Printer, ChevronDown } from 'lucide-react';
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
  /**
   * Ligne de total / solde affichée en pied du tableau exporté (facultatif).
   * Tableau fixe, ou fonction recevant les lignes effectivement exportées
   * (pour calculer un total sur l'ensemble des données filtrées).
   */
  totalRow?: (string | number)[] | ((rows: T[]) => (string | number)[]);
  /**
   * Index de colonne de regroupement : quand sa valeur change d'une ligne à
   * l'autre, le document insère une délimitation + un espacement entre groupes.
   */
  sectionBreakColumn?: number;
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
  sectionBreakColumn,
}: ExportMenuProps<T>) {
  const token = useAuthStore((s) => s.token)!;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | 'print' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  /** Construit le payload commun (headers / matrice / ligne de total) à partir des lignes filtrées. */
  const buildPayload = async () => {
    const rows = await fetchRows();
    if (!rows || rows.length === 0) return null;
    const headers = columns.map((c) => c.header);
    const matrix = rows.map((row) =>
      columns.map((c) => {
        const v = c.cell(row);
        return v === null || v === undefined ? '' : String(v);
      }),
    );
    const resolvedTotal = typeof totalRow === 'function' ? totalRow(rows) : totalRow;
    return {
      fileName,
      title,
      subtitle,
      headers,
      rows: matrix,
      totalRow: resolvedTotal?.map((c) => (c === null || c === undefined ? '' : String(c))),
      ...(sectionBreakColumn != null ? { sectionBreakColumn } : {}),
    };
  };

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setOpen(false);
    setBusy(format);
    try {
      const payload = await buildPayload();
      if (!payload) {
        toast.error('Aucune donnée à exporter');
        return;
      }
      const res = await window.electron.exporter.generate(token, { format, ...payload });
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

  const handlePrint = async () => {
    setOpen(false);
    setBusy('print');
    try {
      const payload = await buildPayload();
      if (!payload) {
        toast.error('Aucune donnée à imprimer');
        return;
      }
      const res = await window.electron.exporter.print(token, payload);
      if (!res.success) {
        toast.error(typeof res.error === 'string' ? res.error : "Erreur lors de l'impression");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'impression");
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
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 text-slate-500" /> Imprimer la liste
          </button>
        </div>
      )}
    </div>
  );
}
