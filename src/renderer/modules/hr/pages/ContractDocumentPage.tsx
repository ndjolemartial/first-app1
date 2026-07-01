import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useContractRenderData, useMyContractRenderData, useContractTemplates } from '../hooks/useHr';
import { useCountries } from '../../../shared/hooks/useCountries';
import { mergeContractTemplate } from '../utils/contractTemplate';
import { footerTextColor, isTransparentFooter, resolveFooterBg } from '../../conventions/utils/footerColor';
import {
  pxToMm, buildHeaderTemplate, buildFooterTemplate, buildEndOfDocumentHtml,
  buildHeaderDocxHtml, buildFooterDocxHtml,
} from '../../../shared/utils/documentZones';
import { Printer, FileText, FileType2 } from 'lucide-react';

export default function ContractDocumentPage({ selfMode = false }: { selfMode?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cid = Number(id);
  // En self-service, on lit via l'IPC restreint à son propre contrat.
  const adminQ = useContractRenderData(selfMode ? 0 : cid);
  const selfQ = useMyContractRenderData(selfMode ? cid : 0);
  const renderRes = selfMode ? selfQ.data : adminQ.data;
  const isLoading = selfMode ? selfQ.isLoading : adminQ.isLoading;
  const { data: templatesRes } = useContractTemplates();
  const { data: countriesRes } = useCountries();
  const [templateId, setTemplateId] = useState<number | null>(null);

  const countriesMap = useMemo<Record<string, string>>(() => {
    const list = (countriesRes?.data ?? []) as Array<{ isoCode: string; name: string }>;
    const map: Record<string, string> = {};
    for (const c of list) map[c.isoCode] = c.name;
    return map;
  }, [countriesRes]);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;

  const data = renderRes?.data;
  const contract = data?.contract;
  const employee = data?.employee;
  const company = data?.company;
  if (!contract || !employee) return <div className="p-8 text-slate-500">Contrat introuvable.</div>;

  // Modèles correspondant au type du contrat ; le modèle par défaut en premier.
  const templates: any[] = (templatesRes?.data ?? [])
    .filter((t: any) => t.type === contract.type)
    .sort((a: any, b: any) => Number(b.isDefault) - Number(a.isDefault));
  const selected = templates.find((t) => t.id === templateId) ?? templates[0];

  const merge = (html: string | null | undefined) =>
    mergeContractTemplate(html, contract, employee, company, countriesMap);
  const mergedHeader = merge(selected?.header);
  const mergedBody = merge(selected?.body);
  const mergedFooter = merge(selected?.footer);
  const mergedEndOfDocument = merge(selected?.endOfDocument);

  const headerWidth = selected?.headerWidth ?? 100;
  const headerHeight = selected?.headerHeight ?? 140;
  const footerWidth = selected?.footerWidth ?? 100;
  const footerHeight = selected?.footerHeight ?? 140;
  const footerBgColor: string | null = selected?.footerBgColor ?? null;
  const endOfDocumentWidth = selected?.endOfDocumentWidth ?? 100;
  const endOfDocumentHeight = selected?.endOfDocumentHeight ?? 140;
  const endOfDocumentBgColor: string | null = selected?.endOfDocumentBgColor ?? null;

  const headerMm = pxToMm(headerHeight);
  const footerMm = pxToMm(footerHeight);
  const endOfDocBlock = buildEndOfDocumentHtml(
    mergedEndOfDocument, endOfDocumentWidth, endOfDocumentHeight, endOfDocumentBgColor,
  );
  const documentBodyHtml = `<div class="doc-body">${mergedBody}${endOfDocBlock}</div>`;
  const headerTemplate = buildHeaderTemplate(mergedHeader, headerWidth, headerMm);
  const footerTemplate = buildFooterTemplate(mergedFooter, footerWidth, footerMm, footerBgColor);

  const sanitizeFileName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  const employeeLabel = `${employee.lastName ?? ''} ${employee.firstName ?? ''}`;
  const sanitized = sanitizeFileName(employeeLabel);
  const exportFileName = sanitized ? `${contract.reference}-${sanitized}` : contract.reference;

  const handleExportPdf = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.exportDocumentPdf(token, {
      fileName: exportFileName, bodyHtml: documentBodyHtml, headerTemplate, footerTemplate, headerMm, footerMm,
    });
  };

  const handlePrint = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.printDocument(token, {
      fileName: exportFileName, bodyHtml: documentBodyHtml, headerTemplate, footerTemplate, headerMm, footerMm,
    });
  };

  const handleExportDocx = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
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
      title={`Document — ${contract.reference}`}
      breadcrumbs={selfMode
        ? [{ label: 'Mon espace RH', to: '/my-hr' }, { label: 'Contrat' }]
        : [
            { label: 'RH & Paie' },
            { label: employeeLabel.trim(), to: `/hr/employees/${employee.id}` },
            { label: 'Contrat' },
          ]}
      actions={
        selected && (
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
          title="Aucun modèle pour ce type de contrat"
          description={selfMode
            ? "Aucun modèle de contrat n'est disponible. Contactez le service RH."
            : 'Créez un modèle de contrat de travail correspondant au type de ce contrat pour générer le document.'}
          action={selfMode ? undefined : { label: 'Créer un modèle', onClick: () => navigate('/hr/contracts/templates/new') }}
        />
      ) : (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-end gap-3">
            <div className="w-72">
              <Select
                label="Modèle de contrat"
                options={templates.map((t) => ({
                  value: String(t.id),
                  label: t.isDefault ? `${t.name} (par défaut)` : t.name,
                }))}
                value={String(selected?.id ?? '')}
                onChange={(e) => setTemplateId(Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-slate-500 pb-2">
              Les variables dynamiques sont remplacées par les données de l'employé et du contrat.
            </p>
          </Card>

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
