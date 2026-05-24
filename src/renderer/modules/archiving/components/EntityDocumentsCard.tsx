import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { FileText, Eye, ExternalLink, UploadCloud } from 'lucide-react';
import { formatDate } from '../../../shared/utils/format';
import DocumentImportModal from './DocumentImportModal';
import { DocumentLinks } from './DocumentLinksFields';
import { openDocumentExternally } from '../hooks/useGed';
import { formatBytes, mimeGroup } from '../utils/gedTree';

interface Props {
  /** Documents rattachés à l'entité (depuis le getById). */
  documents: any[];
  /** Rattachements pré-remplis pour le modal d'import. */
  defaultLinks: { [K in keyof DocumentLinks]?: number | string };
  /** Clé React Query à invalider après import (ex : ['client', 12]). */
  invalidateKey: readonly unknown[];
  /** Titre personnalisé (par défaut « Documents »). */
  title?: string;
}

/**
 * Carte « Documents » réutilisable pour les fiches détail.
 * Affiche les documents GED rattachés à l'entité et permet d'en archiver
 * un nouveau pré-rattaché à cette entité.
 */
export default function EntityDocumentsCard({
  documents,
  defaultLinks,
  invalidateKey,
  title = 'Documents',
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="h-4 w-4" /> {title} ({documents.length})
          </h3>
          <Button
            variant="secondary"
            size="sm"
            icon={<UploadCloud className="h-4 w-4" />}
            onClick={() => setImportOpen(true)}
          >
            Archiver un document
          </Button>
        </div>
        {documents.length === 0 ? (
          <p className="text-slate-400 text-sm">Aucun document rattaché.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((d) => {
              const g = mimeGroup(d.type);
              return (
                <li key={d.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <button
                    className="flex-1 text-left font-medium text-slate-800 hover:text-blue-700 hover:underline truncate"
                    onClick={() => navigate(`/archiving/ged/${d.id}`)}
                    title="Voir la fiche du document"
                  >
                    {d.name}
                  </button>
                  {d.numeroArchive && (
                    <span className="font-mono text-xs font-semibold text-blue-700">{d.numeroArchive}</span>
                  )}
                  <Badge variant="default">{g.label}</Badge>
                  <span className="text-xs text-slate-500 w-20 text-right">{formatBytes(d.size)}</span>
                  <span className="text-xs text-slate-500 w-24 text-right">{formatDate(d.uploadedAt)}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Eye className="h-4 w-4" />}
                      onClick={() => navigate(`/archiving/ged/${d.id}`)}
                      title="Ouvrir la fiche"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink className="h-4 w-4" />}
                      onClick={() => openDocumentExternally(d.id)}
                      title="Ouvrir avec l'application système"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <DocumentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultLinks={defaultLinks}
        onImported={() => qc.invalidateQueries({ queryKey: invalidateKey as any })}
      />
    </>
  );
}
