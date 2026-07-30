import { Fragment, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useConstructionEstimate, useEstimateSummary, useEstimateMaterials, useEstimateLabor, useDeleteEstimate } from '../hooks/useConstructionEstimates';
import ConvertToQuoteModal from '../components/ConvertToQuoteModal';
import { formatCurrency } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useCompanySettings, useLogoData } from '../../settings/hooks/useSettings';
import {
  groupLinesByLot, CATEGORY_LABELS, buildCategoryDocumentHtml, buildLaborDocumentHtml, buildFullDqeDocumentHtml,
  type EstimateDocCategory,
} from '../utils/estimateDocument';
import { ESTIMATE_STATUS_LABELS, PRECISION_LEVEL_LABELS, RESOURCE_TYPE_LABELS, LOT_PHASE_LABELS } from '../utils/constructionLabels';
import { AlertTriangle, FileSpreadsheet, ExternalLink, FileDown, Trash2 } from 'lucide-react';

type Tab = 'devis' | 'materiaux' | 'main-oeuvre' | 'marge';
/** Suppression : réservée à SUPER_ADMIN/ADMIN/MANAGER (même liste que côté IPC, `DELETE_ROLES` dans `construction-projects.ipc.ts`). */
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Conversion en devis commercial : réservée à SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT (même liste que côté IPC, `WRITE_ROLES` dans `construction-projects.ipc.ts`). */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

export default function ConstructionEstimatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const estimateId = Number(id);
  const [tab, setTab] = useState<Tab>('devis');
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const role = useAuthStore((s) => s.user?.role);
  const canDelete = !!role && DELETE_ROLES.includes(role);
  const canWrite = !!role && WRITE_ROLES.includes(role);
  const deleteEstimate = useDeleteEstimate();

  const { data: res, isLoading } = useConstructionEstimate(estimateId);
  const { data: summaryRes } = useEstimateSummary(estimateId);
  const { data: materialsRes } = useEstimateMaterials(estimateId);
  const { data: laborRes } = useEstimateLabor(estimateId);

  const estimate = res?.data;
  const summary = summaryRes?.data;
  const materials = materialsRes?.data ?? [];
  const labor = laborRes?.data ?? [];

  const groups = useMemo(() => (estimate ? groupLinesByLot(estimate.lines) : []), [estimate]);

  const token = useAuthStore((s) => s.token);
  const { data: companyRes } = useCompanySettings();
  const { data: logoRes } = useLogoData();
  const [exporting, setExporting] = useState<string | null>(null);

  if (isLoading || !estimate) {
    return <PageLayout title="Estimation" breadcrumbs={[{ label: 'Devis construction', to: '/construction' }]}><div className="p-6 text-slate-400">Chargement…</div></PageLayout>;
  }

  const warnings: string[] = estimate.warnings ?? [];

  const company = companyRes?.success ? companyRes.data : null;
  const logo = logoRes?.success ? (logoRes.data as { mimeType: string; base64: string } | null) : null;

  const handleExport = async (kind: EstimateDocCategory | 'MAIN_OEUVRE' | 'DQE') => {
    if (!token) return;
    setExporting(kind);
    try {
      const bodyHtml =
        kind === 'MAIN_OEUVRE' ? buildLaborDocumentHtml(estimate, estimate.project, company, logo)
        : kind === 'DQE' ? buildFullDqeDocumentHtml(estimate, estimate.project, company, logo)
        : buildCategoryDocumentHtml(estimate, estimate.project, company, logo, kind);
      const suffix = kind === 'MAIN_OEUVRE' ? 'main-oeuvre' : kind === 'DQE' ? 'dqe-complet' : CATEGORY_LABELS[kind].toLowerCase().replace(/\s+/g, '-');
      await window.electron.documentExport.exportDocumentPdf(token, {
        fileName: `${estimate.reference}-${suffix}`,
        bodyHtml,
        headerTemplate: '<div></div>',
        footerTemplate: '<div style="width:100%;text-align:right;padding:0 18mm;font-size:8pt;color:#64748b;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        headerMm: 6,
        footerMm: 10,
        marginsMm: { top: 20, bottom: 18, left: 18, right: 18 },
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <PageLayout
      title={estimate.reference}
      breadcrumbs={[
        { label: 'Devis construction', to: '/construction' },
        { label: estimate.project?.nom ?? '', to: `/construction/projects/${estimate.projectId}` },
        { label: estimate.reference },
      ]}
      actions={<>
        {estimate.quoteId ? (
          <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />} onClick={() => navigate(`/quotes/${estimate.quoteId}`)}>
            Voir le devis {estimate.quoteReference}
          </Button>
        ) : canWrite ? (
          <Button icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setConvertOpen(true)}>Créer le devis</Button>
        ) : null}
        {canDelete && (
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>Supprimer</Button>
        )}
      </>}
    >
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Badge variant={estimate.status === 'CONVERTI' ? 'success' : 'default'}>{ESTIMATE_STATUS_LABELS[estimate.status]}</Badge>
        <span className="text-sm text-slate-500">{PRECISION_LEVEL_LABELS[estimate.precisionLevel]}</span>
        {estimate.ratioProfileName && <span className="text-sm text-slate-500">Profil : {estimate.ratioProfileName}</span>}
        <span className="text-sm text-slate-500">Couverture bibliothèque : {estimate.coveragePct != null ? Number(estimate.coveragePct) : '—'}%</span>
      </div>

      {warnings.length > 0 && (
        <div className="mb-4 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <ul className="list-disc pl-4 space-y-0.5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><div className="text-sm text-slate-500">Total HT</div><div className="text-xl font-bold text-slate-900">{formatCurrency(Number(estimate.totalHT))}</div></Card>
        <Card><div className="text-sm text-slate-500">Total TTC</div><div className="text-xl font-bold text-slate-900">{formatCurrency(Number(estimate.totalTTC))}</div></Card>
        <Card><div className="text-sm text-slate-500">Déboursé sec</div><div className="text-xl font-bold text-slate-600">{formatCurrency(Number(estimate.totalDeboursSec))}</div></Card>
        <Card><div className="text-sm text-slate-500">Marge prévisionnelle</div><div className="text-xl font-bold text-green-600">{formatCurrency(Number(estimate.totalMarge))}</div></Card>
      </div>

      <Card className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Documents à exporter (PDF)</h3>
        <p className="text-xs text-slate-500 mb-3">
          Le devis détaillé se décompose en 4 documents par corps de métier — gros œuvre, second œuvre et finitions
          (ouvrages, matériaux inclus), et main d'œuvre (isolée et chiffrée séparément, incluse dans le prix de chaque
          ouvrage du devis détaillé mais jamais visible à part) — plus un DQE complet cumulant l'ensemble.
        </p>
        <div className="flex flex-wrap gap-2">
          {(['GROS_OEUVRE', 'SECOND_OEUVRE', 'FINITIONS'] as EstimateDocCategory[]).map((cat) => (
            <Button key={cat} variant="secondary" size="sm" icon={<FileDown className="h-4 w-4" />}
              loading={exporting === cat} onClick={() => handleExport(cat)}>
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
          <Button variant="secondary" size="sm" icon={<FileDown className="h-4 w-4" />} loading={exporting === 'MAIN_OEUVRE'} onClick={() => handleExport('MAIN_OEUVRE')}>
            Main d'œuvre
          </Button>
          <Button size="sm" icon={<FileDown className="h-4 w-4" />} loading={exporting === 'DQE'} onClick={() => handleExport('DQE')}>
            DQE Complet
          </Button>
        </div>
      </Card>

      <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
        {([
          ['devis', 'Devis détaillé'], ['materiaux', 'Quantitatif matériaux'],
          ['main-oeuvre', 'Besoin main d’œuvre'], ['marge', 'Marge prévisionnelle'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'devis' && (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Désignation</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Qté</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-600">Unité</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">P.U. HT</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Montant HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((g) => (
                <Fragment key={g.lotCode}>
                  <tr className="bg-slate-100/70">
                    <td colSpan={5} className="px-4 py-2 font-semibold text-slate-700">{g.lotLabel}</td>
                  </tr>
                  {g.items.map((it: any) => (
                    <tr key={it.id} className="hover:bg-slate-50" title={it.formulaTrace ?? undefined}>
                      <td className="px-4 py-2 pl-8 text-slate-700">{it.designation}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{Number(it.quantity)}</td>
                      <td className="px-4 py-2 text-center text-slate-500">{it.unit}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(Number(it.prixUnitaireHT))}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-800">{formatCurrency(Number(it.montantHT))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="px-4 py-1.5 text-right italic text-slate-500">Sous-total {g.lotLabel}</td>
                    <td className="px-4 py-1.5 text-right italic text-slate-600">{formatCurrency(g.subtotal)}</td>
                  </tr>
                </Fragment>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-right">TOTAL HT</td>
                <td className="px-4 py-3 text-right">{formatCurrency(Number(estimate.totalHT))}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'materiaux' && (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Ressource</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Famille</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Quantité</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-600">Unité</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">P.U.</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materials.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700">{r.resourceLabel}</td>
                  <td className="px-4 py-2 text-slate-500">{r.family ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{Number(r.quantity)}</td>
                  <td className="px-4 py-2 text-center text-slate-500">{r.unit}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(Number(r.unitPrice))}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-800">{formatCurrency(Number(r.montant))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={5} className="px-4 py-3 text-right">TOTAL</td>
                <td className="px-4 py-3 text-right">{formatCurrency(materials.reduce((s: number, r: any) => s + Number(r.montant), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {tab === 'main-oeuvre' && (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Corps de métier</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Heures</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Homme·jours</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {labor.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700">{r.resourceLabel}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{Number(r.quantity)} h</td>
                  <td className="px-4 py-2 text-right text-slate-600">{r.hommeJours}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-800">{formatCurrency(Number(r.montant))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-right">TOTAL</td>
                <td className="px-4 py-3 text-right">{labor.reduce((s: number, r: any) => s + Number(r.quantity), 0)} h</td>
                <td className="px-4 py-3 text-right">{labor.reduce((s: number, r: any) => s + Number(r.hommeJours), 0)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(labor.reduce((s: number, r: any) => s + Number(r.montant), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {tab === 'marge' && summary && (
        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Cascade déboursé sec → prix de vente</h3>
          <div className="space-y-2 max-w-lg">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Déboursé sec (DS)</span><span className="font-medium">{formatCurrency(summary.totalDeboursSec)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">+ Frais de chantier</span><span className="font-medium">{formatCurrency(summary.totalFraisChantier)}</span></div>
            <div className="flex justify-between text-sm border-t border-slate-100 pt-2"><span className="text-slate-600">= Coût de réalisation</span><span className="font-semibold">{formatCurrency(summary.totalDeboursSec + summary.totalFraisChantier)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">+ Frais généraux</span><span className="font-medium">{formatCurrency(summary.totalFraisGeneraux)}</span></div>
            <div className="flex justify-between text-sm border-t border-slate-100 pt-2"><span className="text-slate-600">= Prix de revient</span><span className="font-semibold">{formatCurrency(summary.totalDeboursSec + summary.totalFraisChantier + summary.totalFraisGeneraux)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">+ Marge</span><span className="font-medium text-green-600">{formatCurrency(summary.totalMarge)}</span></div>
            <div className="flex justify-between text-base border-t border-slate-200 pt-2"><span className="font-semibold text-slate-900">= Prix de vente HT</span><span className="font-bold text-slate-900">{formatCurrency(summary.totalHT)}</span></div>
            <div className="flex justify-between text-sm text-slate-500 pt-1"><span>Taux de marge sur prix de vente</span><span>{summary.tauxMargeSurPV}%</span></div>
          </div>

          <h3 className="text-sm font-semibold text-slate-900 mt-6 mb-3">Répartition par phase</h3>
          <div className="space-y-1.5 max-w-lg">
            {summary.byPhase.map((p: any) => (
              <div key={p.phase} className="flex justify-between text-sm">
                <span className="text-slate-600">{LOT_PHASE_LABELS[p.phase] ?? p.phase}</span>
                <span className="font-medium text-slate-800">{formatCurrency(p.montantHT)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConvertToQuoteModal open={convertOpen} onClose={() => setConvertOpen(false)} estimate={estimate} />

      <ConfirmDialog open={deleteOpen} title="Supprimer l'estimation"
        message={`Supprimer l'estimation ${estimate.reference} ?`}
        confirmLabel="Supprimer" loading={deleteEstimate.isPending}
        onConfirm={async () => { const r = await deleteEstimate.mutateAsync(estimate.id); if (r.success) navigate(`/construction/projects/${estimate.projectId}`); }}
        onClose={() => setDeleteOpen(false)} />
    </PageLayout>
  );
}
