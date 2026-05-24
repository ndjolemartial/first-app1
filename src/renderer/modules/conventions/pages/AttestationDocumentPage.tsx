import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useAttestation } from '../hooks/useAttestations';
import { useAttestationTemplates } from '../hooks/useAttestationTemplates';
import { mergeAttestationTemplate } from '../utils/attestationTemplate';
import { Printer, FileText } from 'lucide-react';

/** Feuille de style appliquée au document imprimé / exporté en PDF. */
const PRINT_CSS = `
@page {
  size: A4;
  margin: 18mm;
  @bottom-right {
    content: "Page " counter(page) " / " counter(pages);
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 8pt;
    color: #64748b;
  }
}
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5pt; color: #1e293b; line-height: 1.55; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 17pt; margin: 8pt 0; }
h2 { font-size: 13.5pt; margin: 8pt 0; }
p { margin: 5pt 0; }
img { max-width: 100%; height: auto; }
ul { list-style: disc; padding-left: 20pt; }
ol { list-style: decimal; padding-left: 20pt; }
.doc-header { padding-bottom: 10pt; margin-bottom: 18pt; }
.doc-footer { padding-top: 10pt; margin-top: 22pt; font-size: 9pt; color: #475569; }
`;

/**
 * Imprime un fragment HTML isolé dans un iframe (Chromium permet « Enregistrer en PDF »).
 * Le titre passé est utilisé comme nom de fichier par défaut dans le dialogue
 * de Microsoft Print to PDF : Chromium se sert du `document.title` de la page
 * parente pour pré-remplir le nom de fichier, on l'écrase donc temporairement.
 */
function printDocument(innerHtml: string, title: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${innerHtml}</body></html>`);
  doc.close();
  iframe.contentWindow?.focus();
  const previousTitle = document.title;
  document.title = title;
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      document.title = previousTitle;
    }, 1000);
  }, 300);
}

export default function AttestationDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: attestationRes, isLoading } = useAttestation(Number(id));
  const { data: templatesRes } = useAttestationTemplates();
  const [templateId, setTemplateId] = useState<number | null>(null);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;

  const attestation = attestationRes?.data;
  if (!attestation) return <div className="p-8 text-slate-500">Attestation introuvable.</div>;

  // Modèles du même type que l'attestation, modèle par défaut sélectionné en priorité.
  const templates: any[] = (templatesRes?.data ?? []).filter((t: any) => t.type === attestation.type);
  const selected = templates.find((t) => t.id === templateId)
    ?? templates.find((t) => t.isDefault)
    ?? templates[0];

  const mergedHeader = mergeAttestationTemplate(selected?.header, attestation);
  const mergedBody = mergeAttestationTemplate(selected?.body, attestation);
  const mergedFooter = mergeAttestationTemplate(selected?.footer, attestation);

  const headerWidth = selected?.headerWidth ?? 100;
  const footerWidth = selected?.footerWidth ?? 100;
  const headerHeight = selected?.headerHeight ?? 140;
  const footerHeight = selected?.footerHeight ?? 140;

  const documentHtml =
    (mergedHeader ? `<div class="doc-header" style="width:${headerWidth}%;min-height:${headerHeight}px">${mergedHeader}</div>` : '')
    + `<div class="doc-body">${mergedBody}</div>`
    + (mergedFooter ? `<div class="doc-footer" style="width:${footerWidth}%;min-height:${footerHeight}px">${mergedFooter}</div>` : '');

  return (
    <PageLayout
      title={`Document — ${attestation.reference}`}
      breadcrumbs={[
        { label: 'Conventions', to: '/conventions' },
        { label: 'Attestations', to: '/conventions/attestations' },
        { label: attestation.reference, to: `/conventions/attestations/${id}` },
        { label: 'Document' },
      ]}
      actions={
        selected && (
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => printDocument(documentHtml, attestation.reference)}>
            Imprimer / Exporter PDF
          </Button>
        )
      }
    >
      {templates.length === 0 ? (
        <EmptyState
          title="Aucun modèle pour ce type d'attestation"
          description="Créez d'abord un modèle correspondant au type de cette attestation pour générer le document."
          action={{ label: 'Créer un modèle', onClick: () => navigate('/conventions/attestation-templates/new') }}
        />
      ) : (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-end gap-3">
            <div className="w-72">
              <Select
                label="Modèle d'attestation"
                options={templates.map((t) => ({
                  value: String(t.id),
                  label: t.isDefault ? `${t.name} (par défaut)` : t.name,
                }))}
                value={String(selected?.id ?? '')}
                onChange={(e) => setTemplateId(Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-slate-500 pb-2">
              Les variables dynamiques sont remplacées par les données de l'attestation.
            </p>
          </Card>

          {/* Aperçu du document */}
          <div className="bg-slate-100 rounded-lg p-6 overflow-x-auto">
            <div className="bg-white shadow-md mx-auto p-12 text-sm text-slate-800 leading-relaxed
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2
              [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2
              [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1
              [&_img]:max-w-full [&_img]:h-auto"
              style={{ width: '210mm', maxWidth: '100%' }}
            >
              {mergedHeader && (
                <div className="pb-3 mb-5" style={{ width: `${headerWidth}%`, minHeight: headerHeight }}
                  dangerouslySetInnerHTML={{ __html: mergedHeader }} />
              )}
              {mergedBody
                ? <div dangerouslySetInnerHTML={{ __html: mergedBody }} />
                : <p className="text-slate-400 flex items-center gap-2"><FileText className="h-4 w-4" /> Modèle vide.</p>}
              {mergedFooter && (
                <div className="pt-3 mt-6 text-xs text-slate-500" style={{ width: `${footerWidth}%`, minHeight: footerHeight }}
                  dangerouslySetInnerHTML={{ __html: mergedFooter }} />
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
