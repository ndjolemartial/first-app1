import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { canExportPrint } from '../../../shared/utils/exportPermissions';
import { useConvention } from '../hooks/useConventions';
import { useConventionTemplates } from '../hooks/useConventionTemplates';
import { useCountries } from '../../../shared/hooks/useCountries';
import { mergeTemplate } from '../utils/conventionTemplate';
import { footerTextColor, isTransparentFooter, resolveFooterBg } from '../utils/footerColor';
import {
  buildHeaderDocxHtml, buildFooterDocxHtml,
} from '../../../shared/utils/documentZones';
import { filterDefaultConventionTemplates, buildConventionDocumentHtml, conventionExportFileName } from '../utils/conventionDocument';
import { Printer, FileText, FileType2 } from 'lucide-react';

export default function ConventionDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: conventionRes, isLoading } = useConvention(Number(id));
  const { data: templatesRes } = useConventionTemplates();
  const { data: countriesRes } = useCountries();
  const [templateId, setTemplateId] = useState<number | null>(null);
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canExport = canExportPrint(role);

  // Code ISO → nom complet (« CI » → « Côte d'Ivoire »), pour que les
  // variables `{{*.pays}}` des modèles affichent le nom du pays.
  const countriesMap = useMemo<Record<string, string>>(() => {
    const list = (countriesRes?.data ?? []) as Array<{ isoCode: string; name: string }>;
    const map: Record<string, string> = {};
    for (const c of list) map[c.isoCode] = c.name;
    return map;
  }, [countriesRes]);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;

  const convention = conventionRes?.data;
  if (!convention) return <div className="p-8 text-slate-500">Convention introuvable.</div>;

  // On n'affiche que le modèle par défaut correspondant exactement au type et
  // à la nature (avenant ou souscription) de la convention en cours.
  const templates: any[] = filterDefaultConventionTemplates(templatesRes?.data ?? [], convention);
  const selected = templates.find((t) => t.id === templateId) ?? templates[0];

  const mergedHeader = mergeTemplate(selected?.header, convention, countriesMap);
  const mergedBody = mergeTemplate(selected?.body, convention, countriesMap);
  const mergedFooter = mergeTemplate(selected?.footer, convention, countriesMap);
  const mergedEndOfDocument = mergeTemplate(selected?.endOfDocument, convention, countriesMap);

  const headerWidth = selected?.headerWidth ?? 100;
  const headerHeight = selected?.headerHeight ?? 140;
  const footerWidth = selected?.footerWidth ?? 100;
  const footerHeight = selected?.footerHeight ?? 140;
  const footerBgColor: string | null = selected?.footerBgColor ?? null;
  const endOfDocumentWidth = selected?.endOfDocumentWidth ?? 100;
  const endOfDocumentHeight = selected?.endOfDocumentHeight ?? 140;
  const endOfDocumentBgColor: string | null = selected?.endOfDocumentBgColor ?? null;

  // Document complet (en-tête/pied de page en templates Chromium + corps) pour
  // l'export PDF/impression — même logique que la pièce jointe convention de
  // « Envoyer un message », factorisée dans conventionDocument.ts.
  const { bodyHtml: documentBodyHtml, headerTemplate, footerTemplate, headerMm, footerMm } =
    buildConventionDocumentHtml(convention, selected ?? null, countriesMap);

  const exportFileName = conventionExportFileName(convention);

  const handleExportPdf = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.exportDocumentPdf(token, {
      fileName: exportFileName,
      bodyHtml: documentBodyHtml,
      headerTemplate,
      footerTemplate,
      headerMm,
      footerMm,
    });
  };

  const handlePrint = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.printDocument(token, {
      fileName: exportFileName,
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
      fileName: exportFileName,
      bodyHtml: documentBodyHtml,
      headerTemplate: buildHeaderDocxHtml(mergedHeader),
      footerTemplate: buildFooterDocxHtml(mergedFooter, footerBgColor),
      headerMm,
      footerMm,
    });
  };

  return (
    <PageLayout
      title={`Document — ${convention.reference}`}
      breadcrumbs={[
        { label: 'Conventions', to: '/conventions' },
        { label: convention.reference, to: `/conventions/${id}` },
        { label: 'Document' },
      ]}
      actions={
        selected && canExport && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={<FileType2 className="h-4 w-4" />} onClick={handleExportDocx}>
              Exporter Word
            </Button>
            <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={handleExportPdf}>
              Exporter PDF
            </Button>
            <Button icon={<Printer className="h-4 w-4" />} onClick={handlePrint}>
              Imprimer
            </Button>
          </div>
        )
      }
    >
      {templates.length === 0 ? (
        <EmptyState
          title="Aucun modèle par défaut pour cette convention"
          description="Définissez un modèle par défaut correspondant au type (et à la nature) de cette convention pour générer le document."
          action={{ label: 'Créer un modèle', onClick: () => navigate('/conventions/templates/new') }}
        />
      ) : (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-end gap-3">
            <div className="w-72">
              <Select
                label="Modèle de convention"
                options={templates.map((t) => ({
                  value: String(t.id),
                  label: t.isDefault ? `${t.name} (par défaut)` : t.name,
                }))}
                value={String(selected?.id ?? '')}
                onChange={(e) => setTemplateId(Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-slate-500 pb-2">
              Les variables dynamiques sont remplacées par les données de la convention.
            </p>
          </Card>

          {/* Aperçu du document — `[&_.afk-hdr-preview_img]` force aussi
              les images de l'en-tête à 100 % de la largeur du bloc dans
              l'aperçu (cohérence avec le rendu PDF). */}
          <div className="bg-slate-100 rounded-lg p-6 overflow-x-auto">
            <div className="bg-white shadow-md mx-auto p-12 text-sm text-slate-800 leading-relaxed
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2
              [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2
              [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1
              [&_img]:max-w-full [&_img]:h-auto"
              style={{ width: '210mm', maxWidth: '100%' }}
            >
              {mergedHeader && (
                <div
                  className="afk-hdr-preview pb-3 mb-5 overflow-hidden [&_img]:!w-full [&_img]:!h-auto [&_img]:!max-w-none [&_img]:block"
                  style={{ width: `${headerWidth}%`, minHeight: headerHeight }}
                  dangerouslySetInnerHTML={{ __html: mergedHeader }}
                />
              )}
              {mergedBody
                ? <div dangerouslySetInnerHTML={{ __html: mergedBody }} />
                : <p className="text-slate-400 flex items-center gap-2"><FileText className="h-4 w-4" /> Modèle vide.</p>}
              {mergedEndOfDocument && (
                <div
                  className="mt-6 mx-auto"
                  style={{
                    width: `${endOfDocumentWidth}%`,
                    minHeight: endOfDocumentHeight,
                    backgroundColor: isTransparentFooter(endOfDocumentBgColor) ? 'transparent' : resolveFooterBg(endOfDocumentBgColor),
                    color: footerTextColor(endOfDocumentBgColor),
                    padding: '12px 16px',
                    boxSizing: 'border-box',
                  }}
                  dangerouslySetInnerHTML={{ __html: mergedEndOfDocument }}
                />
              )}
              {mergedFooter && (
                <div
                  className="mt-6 text-xs"
                  style={{
                    width: `${footerWidth}%`,
                    minHeight: footerHeight,
                    backgroundColor: isTransparentFooter(footerBgColor) ? 'transparent' : resolveFooterBg(footerBgColor),
                    color: footerTextColor(footerBgColor),
                  }}
                >
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
