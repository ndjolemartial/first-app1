import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useQuote } from '../hooks/useQuotes';
import { useQuoteTemplates } from '../hooks/useQuoteTemplates';
import { useCompanySettings } from '../../settings/hooks/useSettings';
import { useLogoData } from '../../settings/hooks/useSettings';
import { mergeQuoteTemplate } from '../utils/quoteTemplate';
import { Printer, FileType2, FileText } from 'lucide-react';

const escHtml = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * En-tête « papier à en-tête » : coordonnées de l'entreprise à gauche, logo à
 * droite (comme sur les factures). Construit à partir des paramètres entreprise
 * et du logo (data URL). Renvoie '' si aucune donnée entreprise n'est définie.
 */
function buildCompanyHeader(company: any, logo: { mimeType: string; base64: string } | null): string {
  if (!company?.name && !logo) return '';
  const lines: string[] = [];
  if (company?.address) {
    for (const l of String(company.address).split(/\r?\n/).filter(Boolean)) lines.push(escHtml(l));
  }
  const phones = [company?.phoneFixed, company?.phoneMobile1, company?.phoneMobile2].filter(Boolean).join(' / ');
  if (phones) lines.push(`Tél : ${escHtml(phones)}`);
  if (company?.registreCommerce) lines.push(`RCCM : ${escHtml(company.registreCommerce)}`);

  const info = ''
    + `<div style="font-weight:bold;font-size:13pt;color:#1E3A5F;">${escHtml(company?.name ?? '')}</div>`
    + (company?.slogan ? `<div style="font-style:italic;color:#475569;">${escHtml(company.slogan)}</div>` : '')
    + lines.map((l) => `<div>${l}</div>`).join('');
  const logoImg = logo
    ? `<img src="data:${logo.mimeType};base64,${logo.base64}" style="max-height:80px;max-width:200px;object-fit:contain;" />`
    : '';
  return ''
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;'
    + 'margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">'
    + `<div style="font-size:10pt;line-height:1.45;color:#334155;">${info}</div>`
    + `<div style="text-align:right;flex-shrink:0;">${logoImg}</div>`
    + '</div>';
}

function buildHeaderTemplate(header: string, widthPct: number, mm: number): string {
  if (!header) return '<div></div>';
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1e293b;width:100%;height:${mm}mm;max-height:${mm}mm;overflow:hidden;padding:0 18mm;box-sizing:border-box;">`
    + `<div style="width:${widthPct}%;height:100%;overflow:hidden;">${header}</div></div>`;
}
function buildFooterTemplate(footer: string, _widthPct: number, mm: number): string {
  // Pied de page ancré en bas : numéro de page (petite ligne à droite) puis
  // bandeau pleine largeur (auto-stylé par le contenu du modèle) collé au bord
  // inférieur de la page.
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;color:#475569;width:100%;height:${mm}mm;max-height:${mm}mm;overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;">`
    + '<div style="text-align:right;padding:0 4mm 2pt;white-space:nowrap;font-size:8pt;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    + `<div style="width:100%;">${footer || ''}</div>`
    + '</div>';
}

// Marges du document devis : 2,5 cm sur les quatre côtés (override explicite).
const QUOTE_MARGINS_MM = { top: 25, bottom: 25, left: 25, right: 25 };

export default function QuoteDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quoteRes, isLoading } = useQuote(Number(id));
  const { data: templatesRes } = useQuoteTemplates();
  const { data: companyRes } = useCompanySettings();
  const { data: logoRes } = useLogoData();
  const [templateId, setTemplateId] = useState<number | null>(null);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;
  const quote = quoteRes?.data;
  if (!quote) return <div className="p-8 text-slate-500">Devis introuvable.</div>;

  const templates: any[] = templatesRes?.data ?? [];
  const selected = templates.find((t) => t.id === templateId) ?? templates.find((t) => t.isDefault) ?? templates[0];

  const mergedHeader = mergeQuoteTemplate(selected?.header, quote);
  const mergedBody = mergeQuoteTemplate(selected?.body, quote);
  const mergedFooter = mergeQuoteTemplate(selected?.footer, quote);

  const headerWidth = selected?.headerWidth ?? 100;
  const footerWidth = selected?.footerWidth ?? 100;
  // En-tête (page) vide pour les devis (l'en-tête entreprise est dans le corps) ;
  // pied de page = bandeau « Merci… ». Hauteurs réduites (les marges réelles du
  // PDF sont fixées à 25 mm via QUOTE_MARGINS_MM).
  const headerMm = 13;
  const footerMm = 13;

  const company = companyRes?.success ? companyRes.data : null;
  const logo = logoRes?.success ? (logoRes.data as { mimeType: string; base64: string } | null) : null;
  const companyHeader = buildCompanyHeader(company, logo);

  const documentBodyHtml = `<div class="doc-body">${companyHeader}${mergedBody}</div>`;
  const fileName = `${quote.reference}`;

  const handleExportPdf = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.exportDocumentPdf(token, {
      fileName, bodyHtml: documentBodyHtml,
      headerTemplate: buildHeaderTemplate(mergedHeader, headerWidth, headerMm),
      footerTemplate: buildFooterTemplate(mergedFooter, footerWidth, footerMm),
      headerMm, footerMm,
      marginsMm: QUOTE_MARGINS_MM,
    });
  };
  const handlePrint = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.printDocument(token, {
      fileName, bodyHtml: documentBodyHtml,
      headerTemplate: buildHeaderTemplate(mergedHeader, headerWidth, headerMm),
      footerTemplate: buildFooterTemplate(mergedFooter, footerWidth, footerMm),
      headerMm, footerMm,
      marginsMm: QUOTE_MARGINS_MM,
    });
  };
  const handleExportDocx = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.exportDocumentDocx(token, {
      fileName, bodyHtml: documentBodyHtml,
      headerTemplate: mergedHeader ? `<div>${mergedHeader}</div>` : '',
      footerTemplate: mergedFooter ? `<div>${mergedFooter}</div>` : '',
      headerMm, footerMm,
    });
  };

  return (
    <PageLayout
      title={`Document — ${quote.reference}`}
      breadcrumbs={[{ label: 'Devis', to: '/quotes' }, { label: quote.reference, to: `/quotes/${id}` }, { label: 'Document' }]}
      actions={selected && (
        <div className="flex gap-2">
          <Button variant="secondary" icon={<FileType2 className="h-4 w-4" />} onClick={handleExportDocx}>Exporter Word</Button>
          <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={handleExportPdf}>Exporter PDF</Button>
          <Button icon={<Printer className="h-4 w-4" />} onClick={handlePrint}>Imprimer</Button>
        </div>
      )}
    >
      {templates.length === 0 ? (
        <EmptyState
          title="Aucun modèle de devis"
          description="Créez d'abord un modèle de devis pour générer le document."
          action={{ label: 'Retour au devis', onClick: () => navigate(`/quotes/${id}`) }}
        />
      ) : (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-end gap-3">
            <div className="w-72">
              <Select label="Modèle de devis"
                options={templates.map((t) => ({ value: String(t.id), label: t.isDefault ? `${t.name} (par défaut)` : t.name }))}
                value={String(selected?.id ?? '')} onChange={(e) => setTemplateId(Number(e.target.value))} />
            </div>
            <p className="text-xs text-slate-500 pb-2">Les variables dynamiques sont remplacées par les données du devis.</p>
          </Card>

          <div className="bg-slate-100 rounded-lg p-6 overflow-x-auto">
            <div className="bg-white shadow-md mx-auto p-12 text-sm text-slate-800 leading-relaxed
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2 [&_table]:my-2 [&_p]:my-1"
              style={{ width: '210mm', maxWidth: '100%' }}>
              {mergedHeader && <div className="pb-3 mb-5" dangerouslySetInnerHTML={{ __html: mergedHeader }} />}
              {companyHeader && <div dangerouslySetInnerHTML={{ __html: companyHeader }} />}
              {mergedBody
                ? <div dangerouslySetInnerHTML={{ __html: mergedBody }} />
                : <p className="text-slate-400 flex items-center gap-2"><FileText className="h-4 w-4" /> Modèle vide.</p>}
              {mergedFooter && <div className="mt-8" dangerouslySetInnerHTML={{ __html: mergedFooter }} />}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
