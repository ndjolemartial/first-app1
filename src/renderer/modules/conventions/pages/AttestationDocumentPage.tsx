import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAttestation } from '../hooks/useAttestations';
import { useAttestationTemplates } from '../hooks/useAttestationTemplates';
import { useCountries } from '../../../shared/hooks/useCountries';
import { mergeAttestationTemplate } from '../utils/attestationTemplate';
import { Printer, FileText, FileType2 } from 'lucide-react';

/** Conversion pixels → millimètres (96 DPI CSS). */
const pxToMm = (px: number): number => Math.round(px * 0.26458333 * 100) / 100;

/** Template HTML inline de l'en-tête (rendu par Chromium dans la marge haute). */
function buildHeaderTemplate(mergedHeader: string, headerWidth: number, headerMm: number): string {
  const inner = mergedHeader || '';
  return ''
    + `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1e293b;width:100%;height:${headerMm}mm;max-height:${headerMm}mm;overflow:hidden;padding:0 18mm;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;">`
      + '<style>'
        + '.afk-hdr,.afk-hdr * { box-sizing:border-box; }'
        + '.afk-hdr h1{font-size:13pt;font-weight:700;margin:0 0 2pt;line-height:1.2;}'
        + '.afk-hdr h2{font-size:11pt;font-weight:600;margin:0 0 2pt;line-height:1.2;}'
        + '.afk-hdr h3{font-size:10pt;font-weight:600;margin:0 0 2pt;line-height:1.2;}'
        + '.afk-hdr p{margin:1pt 0;line-height:1.3;}'
        + '.afk-hdr ul,.afk-hdr ol{margin:1pt 0;padding-left:14pt;}'
        + '.afk-hdr img{max-width:100%;max-height:100%;height:auto;width:auto;display:inline-block;vertical-align:middle;}'
      + '</style>'
      + `<div class="afk-hdr" style="width:${headerWidth}%;height:100%;overflow:hidden;">${inner}</div>`
    + '</div>';
}

/**
 * Templates simplifiés (HTML basique, sans `<style>`, sans flex ni
 * `position`) pour l'export Word — `html-to-docx` ne sait pas interpréter
 * les constructions CSS avancées des templates PDF.
 */
function buildHeaderDocxHtml(mergedHeader: string): string {
  if (!mergedHeader) return '';
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1e293b;">${mergedHeader}</div>`;
}

function buildFooterDocxHtml(mergedFooter: string): string {
  if (!mergedFooter) return '';
  // `background-color` sur un `<div>` n'est pas converti en shading Word par
  // html-to-docx. On utilise une table à une cellule : le shading de cellule
  // (`<w:shd>`) est nativement supporté par Word.
  return ''
    + '<table style="width:100%;border-collapse:collapse;">'
      + '<tr>'
        + '<td style="background-color:#dc2626;color:#ffffff;padding:6pt 10pt;font-family:\'Segoe UI\',Arial,sans-serif;font-size:10pt;">'
          + mergedFooter
        + '</td>'
      + '</tr>'
    + '</table>';
}

/** Template HTML inline du pied de page (bandeau rouge + numéro de page). */
function buildFooterTemplate(mergedFooter: string, footerWidth: number, footerMm: number): string {
  const inner = mergedFooter || '';
  return ''
    + `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#ffffff;width:100%;height:${footerMm}mm;max-height:${footerMm}mm;overflow:hidden;padding:0 18mm;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;">`
      + '<style>'
        + '.afk-ftr,.afk-ftr * { box-sizing:border-box; }'
        + '.afk-ftr h1,.afk-ftr h2,.afk-ftr h3{font-size:11pt;font-weight:600;margin:0;line-height:1.2;}'
        + '.afk-ftr p{margin:1pt 0;line-height:1.3;}'
      + '</style>'
      + `<div style="width:${footerWidth}%;background-color:#dc2626;height:100%;overflow:hidden;">`
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12pt;padding:8pt 12pt 0;">'
          + `<div class="afk-ftr" style="flex:1;min-width:0;">${inner}</div>`
          + '<div style="flex-shrink:0;font-size:9pt;white-space:nowrap;">'
            + 'Page <span class="pageNumber"></span> / <span class="totalPages"></span>'
          + '</div>'
        + '</div>'
      + '</div>'
    + '</div>';
}

export default function AttestationDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: attestationRes, isLoading } = useAttestation(Number(id));
  const { data: templatesRes } = useAttestationTemplates();
  const { data: countriesRes } = useCountries();
  const [templateId, setTemplateId] = useState<number | null>(null);

  // Code ISO → nom complet (« CI » → « Côte d'Ivoire »), pour que les
  // variables `{{*.pays}}` des modèles affichent le nom du pays.
  const countriesMap = useMemo<Record<string, string>>(() => {
    const list = (countriesRes?.data ?? []) as Array<{ isoCode: string; name: string }>;
    const map: Record<string, string> = {};
    for (const c of list) map[c.isoCode] = c.name;
    return map;
  }, [countriesRes]);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;

  const attestation = attestationRes?.data;
  if (!attestation) return <div className="p-8 text-slate-500">Attestation introuvable.</div>;

  // Modèles du même type que l'attestation, modèle par défaut sélectionné en priorité.
  const templates: any[] = (templatesRes?.data ?? []).filter((t: any) => t.type === attestation.type);
  const selected = templates.find((t) => t.id === templateId)
    ?? templates.find((t) => t.isDefault)
    ?? templates[0];

  const mergedHeader = mergeAttestationTemplate(selected?.header, attestation, countriesMap);
  const mergedBody = mergeAttestationTemplate(selected?.body, attestation, countriesMap);
  const mergedFooter = mergeAttestationTemplate(selected?.footer, attestation, countriesMap);

  const headerWidth = selected?.headerWidth ?? 100;
  const footerWidth = selected?.footerWidth ?? 100;
  const headerHeight = selected?.headerHeight ?? 140;
  const footerHeight = selected?.footerHeight ?? 140;

  // Corps du document seul ; les en-têtes et pied de page sont injectés par
  // Chromium dans les marges via les templates ci-dessous (printToPDF).
  const headerMm = pxToMm(headerHeight);
  const footerMm = pxToMm(footerHeight);
  const documentBodyHtml = `<div class="doc-body">${mergedBody}</div>`;
  const headerTemplate = buildHeaderTemplate(mergedHeader, headerWidth, headerMm);
  const footerTemplate = buildFooterTemplate(mergedFooter, footerWidth, footerMm);

  const handleExportPdf = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.exportDocumentPdf(token, {
      fileName: attestation.reference,
      bodyHtml: documentBodyHtml,
      headerTemplate,
      footerTemplate,
      headerMm,
      footerMm,
    });
  };

  const handleExportDocx = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    // Word ne supporte pas les templates PDF (style, flex, pageNumber) :
    // on utilise des templates simplifiés (HTML basique).
    await window.electron.documentExport.exportDocumentDocx(token, {
      fileName: attestation.reference,
      bodyHtml: documentBodyHtml,
      headerTemplate: buildHeaderDocxHtml(mergedHeader),
      footerTemplate: buildFooterDocxHtml(mergedFooter),
      headerMm,
      footerMm,
    });
  };

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
          <div className="flex gap-2">
            <Button variant="secondary" icon={<FileType2 className="h-4 w-4" />} onClick={handleExportDocx}>
              Exporter Word
            </Button>
            <Button icon={<Printer className="h-4 w-4" />} onClick={handleExportPdf}>
              Exporter PDF
            </Button>
          </div>
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
                <div className="mt-6 text-xs text-white bg-red-600" style={{ width: `${footerWidth}%`, minHeight: footerHeight }}>
                  <div className="pt-3 px-3" dangerouslySetInnerHTML={{ __html: mergedFooter }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
