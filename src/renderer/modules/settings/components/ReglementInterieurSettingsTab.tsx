import { useEffect, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { FileText, Check, Trash2 } from 'lucide-react';

/**
 * Ciblage du « Règlement intérieur » : l'administrateur sélectionne un document
 * déjà archivé dans la GED. Ce document est ensuite consultable et imprimable
 * par tout le personnel dans « Mon espace RH → Règlement intérieur ».
 */
export default function ReglementInterieurSettingsTab() {
  const token = useAuthStore((s) => s.token)!;
  const [current, setCurrent] = useState<{ documentId: number | null; document: any } | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCurrent = async () => {
    const r = await window.electron.settings.getReglementInterieur(token);
    if (r.success) setCurrent(r.data as any);
  };
  useEffect(() => { loadCurrent(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await window.electron.documents.list(token, { search: search || undefined }, 1, 20);
        if (!cancelled && r.success) setResults((r.data as any[]) ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, search]);

  const select = async (id: number) => {
    setSaving(true);
    try {
      const r = await window.electron.settings.setReglementInterieur(token, id);
      if (r.success) { toast.success('Règlement intérieur défini'); await loadCurrent(); }
      else toast.error(String(r.error));
    } finally { setSaving(false); }
  };

  const clear = async () => {
    setSaving(true);
    try {
      const r = await window.electron.settings.setReglementInterieur(token, null);
      if (r.success) { toast.success('Règlement intérieur retiré'); await loadCurrent(); }
      else toast.error(String(r.error));
    } finally { setSaving(false); }
  };

  const currentId = current?.document?.id ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Document du règlement intérieur</h3>
        <p className="mb-3 text-xs text-slate-500">
          Sélectionnez le document (déjà archivé dans la GED) qui sera consultable et imprimable
          par tout le personnel dans « Mon espace RH ».
        </p>
        {current?.document ? (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <FileText className="h-4 w-4 text-emerald-600" />
              {current.document.name}
              {current.document.numeroArchive && <span className="text-xs text-slate-500">({current.document.numeroArchive})</span>}
            </span>
            <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} loading={saving} onClick={clear}>
              Retirer
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
            {current && current.documentId === null && current.document === null
              ? 'Aucun document défini.'
              : 'Aucun document défini.'}
          </p>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Choisir un document archivé</h3>
        <Input label="Rechercher dans la GED" placeholder="Nom, n° d'archive, description…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="mt-3">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun document trouvé.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {results.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm text-slate-800">{doc.name}</span>
                    {doc.numeroArchive && <span className="shrink-0 text-xs text-slate-400">{doc.numeroArchive}</span>}
                  </span>
                  {currentId === doc.id ? (
                    <Badge variant="success">Sélectionné</Badge>
                  ) : (
                    <Button variant="secondary" size="sm" icon={<Check className="h-4 w-4" />}
                      loading={saving} onClick={() => select(doc.id)}>
                      Sélectionner
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
