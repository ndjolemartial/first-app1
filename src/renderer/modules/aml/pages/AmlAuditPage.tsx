import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { useAmlAlerts, useAmlScreeningRuns } from '../hooks/useAml';
import { ALERT_SOURCE_LABEL, SCREENING_TRIGGER_LABEL } from '../utils/aml.utils';
import { FileCheck2, DatabaseZap } from 'lucide-react';

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('fr-FR') : '—');
const fmtDateExport = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');
const RUN_STATUS_LABEL: Record<string, string> = { EN_COURS: 'En cours', TERMINE: 'Terminé', ECHEC: 'Échec' };

const RUN_STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  EN_COURS: 'warning', TERMINE: 'success', ECHEC: 'danger',
};

function scopeLabel(r: any): string {
  const parts: string[] = [];
  if (r.scopeClients) parts.push('Clients');
  if (r.scopeProspects) parts.push('Prospects');
  if (r.scopeOwners) parts.push('Propriétaires');
  if (r.scopeReferrers) parts.push("Apporteurs d'affaires");
  return parts.length === 4 ? 'Portefeuille complet' : parts.join(', ') || '—';
}

const ALERT_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: 'Référence', cell: (a) => a.reference + (a.isCurrent ? ' (courante)' : '') },
  { header: 'Source', cell: (a) => ALERT_SOURCE_LABEL[a.source] ?? a.source },
  { header: 'Intitulé', cell: (a) => a.title },
  { header: 'Publication CENTIF-CI', cell: (a) => fmtDateExport(a.centifPublicationDate) },
  { header: 'Téléchargement fichier', cell: (a) => fmtDateExport(a.fileDownloadedAt) },
  { header: "Intégration dans l'outil", cell: (a) => fmtDateExport(a.integratedAt) },
  { header: 'Entrées ajoutées', cell: (a) => (a.entriesAdded ?? '') },
  { header: 'Entrées modifiées', cell: (a) => (a.entriesModified ?? '') },
  { header: 'Entrées supprimées', cell: (a) => (a.entriesDeleted ?? '') },
  { header: 'Opérateur', cell: (a) => a.operatorDisplayName ?? a.operatorName ?? '' },
];

const RUN_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: 'Référence', cell: (r) => r.reference },
  { header: 'Date & heure', cell: (r) => (r.startedAt ? new Date(r.startedAt).toLocaleString('fr-FR') : '') },
  { header: 'Déclencheur', cell: (r) => SCREENING_TRIGGER_LABEL[r.trigger] ?? r.trigger },
  { header: 'Version de la base', cell: (r) => r.baseVersionLabel ?? (r.baseAlert ? r.baseAlert.reference : 'Référentiel interne') },
  { header: 'Périmètre', cell: (r) => scopeLabel(r) },
  { header: 'Entités criblées', cell: (r) => r.entitiesScreened },
  { header: 'Correspondances', cell: (r) => r.hitsTotal },
  { header: 'Nouvelles', cell: (r) => r.hitsNew },
  { header: 'Opérateur', cell: (r) => r.operatorDisplayName ?? r.operatorName ?? '' },
  { header: 'Résultat', cell: (r) => RUN_STATUS_LABEL[r.status] ?? r.status },
];

export default function AmlAuditPage() {
  const { data: alertsRes, isLoading: alertsLoading } = useAmlAlerts(1, 100);
  const { data: runsRes, isLoading: runsLoading } = useAmlScreeningRuns({}, 1, 100);
  const alerts: any[] = alertsRes?.data ?? [];
  const runs: any[] = runsRes?.data ?? [];

  return (
    <PageLayout title="Preuves de contrôle, Traçabilité & Audit"
      breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Preuves de contrôle, Traçabilité & Audit' }]}
    >
      <p className="mb-4 text-sm text-slate-500">
        Registre auto-alimenté à des fins d'audit. Deux volets distincts : en <span className="font-medium text-indigo-700">indigo</span>, la
        <strong> preuve de mise à jour de la base de criblage</strong> (versions successives du référentiel) ; en{' '}
        <span className="font-medium text-emerald-700">vert</span>, la <strong>preuve de chaque criblage exécuté</strong> par l'outil.
      </p>

      {/* ── Volet 1 — INDIGO : mises à jour de la base de criblage ── */}
      <Card className="mb-8 overflow-hidden border-indigo-200 border-l-4 border-l-indigo-500" padding={false}>
        <div className="flex items-center justify-between gap-2 border-b border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900">
          <span className="flex items-center gap-2">
            <DatabaseZap className="h-4 w-4 text-indigo-600" /> Preuve de mise à jour de la base de criblage
          </span>
          {alerts.length > 0 && (
            <ExportMenu fileName="preuve-maj-base-criblage" title="Preuve de mise à jour de la base de criblage"
              columns={ALERT_EXPORT_COLUMNS} fetchRows={async () => alerts} />
          )}
        </div>
        {alertsLoading ? (
          <div className="p-6"><SkeletonTable rows={4} /></div>
        ) : alerts.length === 0 ? (
          <EmptyState title="Aucune mise à jour enregistrée" description="Enregistrez les alertes CENTIF-CI / mises à jour SFC depuis l'interface « Alertes »." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-indigo-100 bg-indigo-50/60">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-indigo-700">Référence</th>
                  <th className="px-4 py-3 text-left font-medium text-indigo-700">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-indigo-700">Intitulé</th>
                  <th className="px-4 py-3 text-left font-medium text-indigo-700">Publication CENTIF-CI</th>
                  <th className="px-4 py-3 text-left font-medium text-indigo-700">Téléchargement fichier</th>
                  <th className="px-4 py-3 text-left font-medium text-indigo-700">Intégration dans l'outil</th>
                  <th className="px-4 py-3 text-left font-medium text-indigo-700">Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50">
                {alerts.map((a) => (
                  <tr key={a.id} className="hover:bg-indigo-50/50">
                    <td className="px-4 py-3 font-semibold text-indigo-800">
                      {a.reference}{a.isCurrent && <Badge variant="success" className="ml-2">Courante</Badge>}
                    </td>
                    <td className="px-4 py-3"><Badge variant="default">{ALERT_SOURCE_LABEL[a.source] ?? a.source}</Badge></td>
                    <td className="px-4 py-3 text-slate-700">{a.title}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.centifPublicationDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.fileDownloadedAt)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.integratedAt)}</td>
                    <td className="px-4 py-3 text-slate-500">{a.operatorDisplayName ?? a.operatorName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Volet 2 — VERT : criblages exécutés ── */}
      <Card className="overflow-hidden border-emerald-200 border-l-4 border-l-emerald-500" padding={false}>
        <div className="flex items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900">
          <span className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-emerald-600" /> Preuve de criblage
          </span>
          {runs.length > 0 && (
            <ExportMenu fileName="preuve-de-criblage" title="Preuve de criblage"
              columns={RUN_EXPORT_COLUMNS} fetchRows={async () => runs} />
          )}
        </div>
        {runsLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : runs.length === 0 ? (
          <EmptyState title="Aucun criblage exécuté" description="Le premier criblage est généré au prochain déclenchement (manuel, planifié, ajout d'entité ou mise à jour du référentiel)." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-emerald-100 bg-emerald-50/60">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-emerald-700">Référence</th>
                  <th className="px-4 py-3 text-left font-medium text-emerald-700">Date &amp; heure</th>
                  <th className="px-4 py-3 text-left font-medium text-emerald-700">Déclencheur</th>
                  <th className="px-4 py-3 text-left font-medium text-emerald-700">Version de la base</th>
                  <th className="px-4 py-3 text-left font-medium text-emerald-700">Périmètre</th>
                  <th className="px-4 py-3 text-right font-medium text-emerald-700">Entités</th>
                  <th className="px-4 py-3 text-right font-medium text-emerald-700">Corresp. (nouv.)</th>
                  <th className="px-4 py-3 text-left font-medium text-emerald-700">Opérateur</th>
                  <th className="px-4 py-3 text-left font-medium text-emerald-700">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-emerald-50/50">
                    <td className="px-4 py-3 font-semibold text-emerald-800">{r.reference}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDateTime(r.startedAt)}</td>
                    <td className="px-4 py-3"><Badge variant="default">{SCREENING_TRIGGER_LABEL[r.trigger] ?? r.trigger}</Badge></td>
                    <td className="px-4 py-3 text-slate-500" title={r.baseVersionLabel ?? undefined}>
                      {r.baseAlert
                        ? <span className="font-medium text-indigo-700">{r.baseAlert.reference}</span>
                        : <span className="text-slate-400">Référentiel interne</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{scopeLabel(r)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.entitiesScreened}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.hitsTotal} ({r.hitsNew})</td>
                    <td className="px-4 py-3 text-slate-500">{r.operatorDisplayName ?? r.operatorName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={RUN_STATUS_VARIANT[r.status] ?? 'default'}>
                        {r.status === 'TERMINE' ? 'Terminé' : r.status === 'EN_COURS' ? 'En cours' : 'Échec'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
