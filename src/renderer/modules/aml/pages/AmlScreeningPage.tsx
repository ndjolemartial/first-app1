import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useAmlScreeningSummary, useAmlScreeningHits, useRunAmlScreening, useReviewAmlScreeningHit,
  useAmlWatchlistEntry,
} from '../hooks/useAml';
import WatchlistDetailModal from '../components/WatchlistDetailModal';
import {
  HIT_STATUS_LABEL, HIT_STATUS_VARIANT, SCREENING_ENTITY_TYPE_LABEL, screeningEntityRoute,
  WATCHLIST_TYPE_LABEL,
} from '../utils/aml.utils';
import { Radar, Play, ShieldCheck, ShieldX, ExternalLink, AlertTriangle } from 'lucide-react';

const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

export default function AmlScreeningPage() {
  const { data: summaryRes } = useAmlScreeningSummary();
  const summary: any = summaryRes?.data ?? null;

  const [status, setStatus] = useState('A_VERIFIER');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const filters = {
    status: status || undefined,
    entityType: entityType || undefined,
    search: search || undefined,
  };
  const { data, isLoading } = useAmlScreeningHits(filters);
  const hits: any[] = data?.data ?? [];

  const runScreening = useRunAmlScreening();
  const reviewHit = useReviewAmlScreeningHit();

  const [confirming, setConfirming] = useState<{ hit: any; status: 'CONFIRME' | 'FAUX_POSITIF' } | null>(null);
  const [viewingEntry, setViewingEntry] = useState<any>(null); // partiel (ligne) puis complet
  const { data: entryRes } = useAmlWatchlistEntry(viewingEntry?.id);
  const fullEntry = viewingEntry ? (entryRes?.data?.id === viewingEntry.id ? entryRes?.data : viewingEntry) : null;

  const doReview = async () => {
    if (!confirming) return;
    await reviewHit.mutateAsync({ id: confirming.hit.id, payload: { status: confirming.status } });
    setConfirming(null);
  };

  const byStatus: Record<string, number> = summary?.hitsByStatus ?? {};

  return (
    <PageLayout
      title="Criblage"
      breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Criblage' }]}
      actions={
        <Button icon={<Play className="h-4 w-4" />} loading={runScreening.isPending} onClick={() => runScreening.mutate()}>
          Lancer un criblage maintenant
        </Button>
      }
    >
      <p className="mb-4 text-sm text-slate-500">
        Croise l'ensemble des entités en relation d'affaires (Clients, Prospects, Propriétaires,
        Apporteurs d'affaires) avec le Référentiel de vigilance. Le criblage s'exécute automatiquement
        à l'ajout de chaque entité, à chaque mise à jour du référentiel, et selon la fréquence définie
        dans <em>Paramètres → Criblage — planification</em>.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Radar className="h-4 w-4" /> Version de la base
          </div>
          <div className="text-sm font-semibold text-slate-800">{summary?.currentBaseVersion ?? 'Référentiel interne'}</div>
          <div className="text-xs text-slate-400">
            {summary?.currentBaseIntegratedAt ? `Intégrée le ${new Date(summary.currentBaseIntegratedAt).toLocaleDateString('fr-FR')}` : 'Aucune alerte enregistrée'}
          </div>
        </Card>
        <Card className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Dernier criblage</div>
          <div className="text-sm font-semibold text-slate-800">{fmtDateTime(summary?.lastRun?.startedAt)}</div>
          <div className="text-xs text-slate-400">{summary?.lastRun ? summary.lastRun.reference : '—'}</div>
        </Card>
        <Card className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">À vérifier</div>
          <div className="text-2xl font-bold text-amber-600">{byStatus.A_VERIFIER ?? 0}</div>
          <div className="text-xs text-slate-400">{byStatus.CONFIRME ?? 0} confirmée(s) · {byStatus.FAUX_POSITIF ?? 0} faux positif(s)</div>
        </Card>
        <Card className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Périmètre criblé</div>
          <div className="text-sm font-semibold text-slate-800">
            {summary ? Object.values(summary.scopeCounts as Record<string, number>).reduce((a, b) => a + b, 0) : 0} entités
          </div>
          <div className="text-xs text-slate-400">{summary?.watchlistCount ?? 0} entrées de vigilance actives</div>
        </Card>
      </div>

      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select label="Statut" placeholder="Tous"
            options={Object.entries(HIT_STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={status} onChange={(e) => setStatus(e.target.value)} />
        </div>
        <div className="w-52">
          <Select label="Type d'entité" placeholder="Tous"
            options={Object.entries(SCREENING_ENTITY_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        </div>
        <div className="min-w-[220px] flex-1">
          <Input label="Rechercher" placeholder="Nom de l'entité, terme du référentiel…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : hits.length === 0 ? (
          <EmptyState title="Aucune correspondance" description="Aucune correspondance de criblage ne correspond à ces filtres." />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Entité</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Entrée du référentiel</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Terme</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Dernière détection</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hits.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={screeningEntityRoute(h.entityType, h.entityId)} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                      {h.entityLabel} <ExternalLink className="h-3 w-3" />
                    </Link>
                    <div className="text-xs text-slate-400">{h.entityTypeLabel ?? SCREENING_ENTITY_TYPE_LABEL[h.entityType]}</div>
                    {!h.stillMatching && <Badge variant="warning" className="mt-1">N'apparaît plus au dernier criblage</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {h.watchlist ? (
                      <button type="button" onClick={() => setViewingEntry(h.watchlist)}
                        className="inline-flex items-center gap-1 text-left font-medium text-blue-700 hover:underline">
                        {h.watchlist.name} <ExternalLink className="h-3 w-3 shrink-0" />
                      </button>
                    ) : <span className="font-medium text-slate-800">—</span>}
                    <div className="text-xs text-slate-400">
                      {h.watchlist ? (WATCHLIST_TYPE_LABEL[h.watchlist.listType] ?? h.watchlist.listType) : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500" title={h.matchDetail ?? undefined}>{h.matchedOn}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDateTime(h.lastDetectedAt)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={HIT_STATUS_VARIANT[h.status] ?? 'default'}>{HIT_STATUS_LABEL[h.status] ?? h.status}</Badge>
                    {h.amlProfileId && (
                      <Link to={`/aml/profiles/${h.amlProfileId}`} className="mt-1 block text-xs text-blue-700 hover:underline">
                        Profil LBC/FT rattaché
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {h.status !== 'CONFIRME' && (
                        <Button variant="ghost" size="sm" icon={<ShieldX className="h-4 w-4 text-red-600" />}
                          onClick={() => setConfirming({ hit: h, status: 'CONFIRME' })}>Confirmer</Button>
                      )}
                      {h.status !== 'FAUX_POSITIF' && (
                        <Button variant="ghost" size="sm" icon={<ShieldCheck className="h-4 w-4 text-green-600" />}
                          onClick={() => setConfirming({ hit: h, status: 'FAUX_POSITIF' })}>Faux positif</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <WatchlistDetailModal entry={fullEntry} onClose={() => setViewingEntry(null)} />

      <ConfirmDialog
        open={!!confirming}
        title={confirming?.status === 'CONFIRME' ? 'Confirmer la correspondance' : 'Marquer comme faux positif'}
        message={
          confirming?.status === 'CONFIRME'
            ? (confirming.hit.entityType === 'CLIENT' || confirming.hit.entityType === 'OWNER'
              ? `Confirmer que « ${confirming.hit.entityLabel} » correspond à « ${confirming.hit.matchedOn} ». Un profil LBC/FT en vigilance renforcée sera créé (s'il n'existe pas) et le score de risque recalculé.`
              : `Confirmer que « ${confirming?.hit.entityLabel} » correspond à « ${confirming?.hit.matchedOn} ».`)
            : `Marquer la correspondance « ${confirming?.hit.entityLabel} » ↔ « ${confirming?.hit.matchedOn} » comme faux positif.`
        }
        confirmLabel={confirming?.status === 'CONFIRME' ? 'Confirmer' : 'Faux positif'}
        loading={reviewHit.isPending}
        onConfirm={doReview}
        onClose={() => setConfirming(null)}
      />

      {summary && (byStatus.A_VERIFIER ?? 0) > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Correspondances par simple rapprochement de nom — chaque correspondance doit être qualifiée manuellement.
        </p>
      )}
    </PageLayout>
  );
}
