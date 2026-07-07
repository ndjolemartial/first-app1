import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatDate } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useGedDocuments, useGedCategories, useUpdateGedDocument, openDocumentExternally } from '../hooks/useGed';
import { formatBytes, mimeGroup } from '../utils/gedTree';
import { FileText, ExternalLink, Eye } from 'lucide-react';

/** Rôles autorisés à classer un document (aligné sur WRITE_ROLES côté IPC). */
const CLASSIFY_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de visualisation des documents GED sans catégorie, avec classement
 * en ligne : un sélecteur de catégorie par document range immédiatement le
 * fichier (documents:update) et le retire de la liste.
 */
export default function UncategorizedDocsModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canClassify = CLASSIFY_ROLES.includes(role);

  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: res, isLoading } = useGedDocuments({ uncategorized: true }, page, limit, { enabled: open });
  const documents = res?.success ? res.data ?? [] : [];
  const total = res?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const { data: catRes } = useGedCategories();
  const categories = catRes?.success ? catRes.data ?? [] : [];
  const categoryOptions = categories.map((c: any) => ({ value: String(c.id), label: c.name }));

  const update = useUpdateGedDocument();
  const [savingId, setSavingId] = useState<number | null>(null);

  const classify = (docId: number, categoryId: string) => {
    if (!categoryId) return;
    setSavingId(docId);
    update.mutate(
      { id: docId, payload: { categoryId: Number(categoryId) } },
      { onSettled: () => setSavingId(null) },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Documents sans catégorie${total ? ` (${total})` : ''}`}
    >
      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Tous les documents sont classés. 🎉
        </p>
      ) : (
        <div className="space-y-3">
          {!canClassify && (
            <p className="text-xs text-amber-600">
              Vous n'avez pas les droits pour classer ces documents (consultation seule).
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {documents.map((d: any) => {
              const g = mimeGroup(d.type);
              return (
                <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{d.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {d.numeroArchive && (
                        <span className="font-mono font-semibold text-blue-700">{d.numeroArchive}</span>
                      )}
                      <span>{formatBytes(d.size)}</span>
                      <span>{formatDate(d.uploadedAt)}</span>
                    </div>
                  </div>
                  <Badge variant="default">{g.label}</Badge>
                  {canClassify && (
                    <div className="w-52 shrink-0">
                      <Select
                        options={categoryOptions}
                        placeholder="Choisir une catégorie…"
                        disabled={savingId === d.id || update.isPending}
                        defaultValue=""
                        onChange={(e) => classify(d.id, e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Eye className="h-4 w-4" />}
                      title="Ouvrir la fiche"
                      onClick={() => navigate(`/archiving/ged/${d.id}`)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink className="h-4 w-4" />}
                      title="Ouvrir avec l'application système"
                      onClick={() => openDocumentExternally(d.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-sm text-slate-500">
              <span>Page {page} / {totalPages}</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary" size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </Button>
                <Button
                  variant="secondary" size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
