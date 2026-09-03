import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useProformaInvoice, useDeleteProformaInvoice } from '../hooks/useProforma';
import { useCompanySettings, useLogoData } from '../../settings/hooks/useSettings';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { Printer, FileType2, FileText, Trash2 } from 'lucide-react';

const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const SOURCE_LABEL: Record<string, string> = { QUOTE: 'Devis', CONVENTION: 'Convention' };

const escHtml = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n: unknown) => `${new Intl.NumberFormat('fr-FR').format(Number(n ?? 0))}`;

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

/** Construit le corps HTML fixe du document (pas de modèle personnalisable — document simple et non ambigu). */
function buildProformaHtml(p: any, company: any, logo: { mimeType: string; base64: string } | null): string {
  const items: Array<{ designation: string; quantity: number; unit: string | null; unitPrice: number; total: number }> = p.items ?? [];
  const rows = items.map((it) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escHtml(it.designation)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmt(it.quantity)}${it.unit ? ` ${escHtml(it.unit)}` : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmt(it.unitPrice)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${fmt(it.total)}</td>
    </tr>`).join('');

  const recipientLines = [p.recipientLabel, p.recipientPhone && `Tél : ${p.recipientPhone}`, p.recipientEmail].filter(Boolean).map(escHtml).join('<br>');

  return ''
    + buildCompanyHeader(company, logo)
    + '<div style="text-align:center;margin:8px 0 18px;">'
    + '<div style="font-size:18pt;font-weight:bold;color:#1E3A5F;letter-spacing:1px;">FACTURE PROFORMA</div>'
    + `<div style="font-size:11pt;color:#475569;">N° ${escHtml(p.reference)} — émise le ${escHtml(formatDate(p.issueDate))}</div>`
    + '</div>'
    + '<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:16px;font-size:10.5pt;">'
    + `<div><div style="font-weight:bold;color:#334155;margin-bottom:2px;">Destinataire</div><div>${recipientLines || '—'}</div></div>`
    + `<div style="text-align:right;"><div style="font-weight:bold;color:#334155;margin-bottom:2px;">Objet</div><div style="max-width:260px;">${escHtml(p.designation)}</div></div>`
    + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:10.5pt;">'
    + '<thead><tr style="background:#1E3A5F;color:#fff;">'
    + '<th style="padding:6px 8px;text-align:left;">Désignation</th>'
    + '<th style="padding:6px 8px;text-align:right;">Quantité</th>'
    + '<th style="padding:6px 8px;text-align:right;">Prix unitaire</th>'
    + '<th style="padding:6px 8px;text-align:right;">Montant</th>'
    + '</tr></thead>'
    + `<tbody>${rows}</tbody>`
    + '</table>'
    + '<div style="margin:12px 0 0 auto;width:280px;font-size:10.5pt;">'
    + `<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Sous-total</span><span>${fmt(p.subtotal)} FCFA</span></div>`
    + (Number(p.taxRate) > 0
      ? `<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>TVA (${fmt(p.taxRate)}%)</span><span>${fmt(p.taxAmount)} FCFA</span></div>`
      : '')
    + `<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:2px solid #1E3A5F;font-weight:bold;font-size:12pt;color:#1E3A5F;"><span>TOTAL</span><span>${fmt(p.total)} FCFA</span></div>`
    + '</div>'
    + (p.validUntil ? `<div style="margin-top:14px;font-size:10pt;color:#334155;">Valable jusqu'au ${escHtml(formatDate(p.validUntil))}.</div>` : '')
    + (p.notes ? `<div style="margin-top:8px;font-size:10pt;color:#334155;">${escHtml(p.notes).replace(/\n/g, '<br>')}</div>` : '')
    + '<div style="margin-top:18px;padding:8px 12px;background:#fef9c3;border:1px solid #eab308;border-radius:6px;font-size:9.5pt;color:#78350f;text-align:center;">'
    + 'Ce document est une facture Proforma et ne vaut pas facture comptable définitive.'
    + '</div>';
}

const MARGINS_MM = { top: 20, bottom: 20, left: 20, right: 20 };

export default function ProformaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canDelete = !!role && DELETE_ROLES.includes(role);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: res, isLoading } = useProformaInvoice(Number(id));
  const { data: companyRes } = useCompanySettings();
  const { data: logoRes } = useLogoData();
  const del = useDeleteProformaInvoice();

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;
  const p = res?.data;
  if (!p) return <div className="p-8 text-slate-500">Facture Proforma introuvable.</div>;

  const company = companyRes?.success ? companyRes.data : null;
  const logo = logoRes?.success ? (logoRes.data as { mimeType: string; base64: string } | null) : null;
  const bodyHtml = `<div class="doc-body">${buildProformaHtml(p, company, logo)}</div>`;
  const fileName = p.reference;
  const emptyTemplate = '<div></div>';

  const handleExportPdf = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.exportDocumentPdf(token, {
      fileName, bodyHtml, headerTemplate: emptyTemplate, footerTemplate: emptyTemplate,
      headerMm: 1, footerMm: 1, marginsMm: MARGINS_MM,
    });
  };
  const handlePrint = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.printDocument(token, {
      fileName, bodyHtml, headerTemplate: emptyTemplate, footerTemplate: emptyTemplate,
      headerMm: 1, footerMm: 1, marginsMm: MARGINS_MM,
    });
  };
  const handleExportDocx = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    await window.electron.documentExport.exportDocumentDocx(token, {
      fileName, bodyHtml, headerTemplate: '', footerTemplate: '', headerMm: 1, footerMm: 1,
    });
  };

  return (
    <PageLayout
      title={p.reference}
      breadcrumbs={[{ label: 'Factures Proforma', to: '/proforma' }, { label: p.reference }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<FileType2 className="h-4 w-4" />} onClick={handleExportDocx}>Exporter Word</Button>
          <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={handleExportPdf}>Exporter PDF</Button>
          <Button icon={<Printer className="h-4 w-4" />} onClick={handlePrint}>Imprimer</Button>
          {canDelete && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>Supprimer</Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="default">{SOURCE_LABEL[p.sourceType] ?? p.sourceType}</Badge>
          <span className="text-sm text-slate-500">
            {p.sourceType === 'QUOTE' ? `Depuis le devis ${p.quoteReference}` : `Depuis la convention ${p.conventionReference}`}
          </span>
        </div>

        <Card>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><div className="text-slate-500">Destinataire</div><div className="font-medium">{p.recipientLabel || '—'}</div></div>
            <div><div className="text-slate-500">Émise le</div><div className="font-medium">{formatDate(p.issueDate)}</div></div>
            <div><div className="text-slate-500">Objet</div><div className="font-medium">{p.designation}</div></div>
            <div><div className="text-slate-500">Valable jusqu'au</div><div className="font-medium">{p.validUntil ? formatDate(p.validUntil) : '—'}</div></div>
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Désignation</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Quantité</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Prix unitaire</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(p.items ?? []).map((it: any, i: number) => (
                <tr key={i}>
                  <td className="px-4 py-2">{it.designation}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(Number(it.quantity))}{it.unit ? ` ${it.unit}` : ''}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(Number(it.unitPrice))}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(Number(it.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-slate-100 flex justify-end">
            <div className="w-64 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Sous-total</span><span>{formatCurrency(Number(p.subtotal))}</span></div>
              {Number(p.taxRate) > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">TVA ({Number(p.taxRate)}%)</span><span>{formatCurrency(Number(p.taxAmount))}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-1"><span>Total</span><span>{formatCurrency(Number(p.total))}</span></div>
            </div>
          </div>
        </Card>

        {p.notes && <Card><div className="text-sm text-slate-500 mb-1">Notes</div><div className="text-sm whitespace-pre-line">{p.notes}</div></Card>}
      </div>

      <ConfirmDialog open={deleteOpen} title="Supprimer la facture Proforma"
        message={`Supprimer définitivement ${p.reference} ?`}
        confirmLabel="Supprimer" loading={del.isPending}
        onConfirm={async () => { const r = await del.mutateAsync(p.id); if (r.success) navigate('/proforma'); }}
        onClose={() => setDeleteOpen(false)} />
    </PageLayout>
  );
}
