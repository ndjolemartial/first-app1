import { useEffect, useRef, useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatDate } from '../../../shared/utils/format';
import { Trophy, Save, History, Medal, Maximize2, Crown, X, Eye, Trash2 } from 'lucide-react';
import { useRanking, useRankingHistory, useSnapshotRanking, useRankingSnapshot, useDeleteRankingSnapshot } from '../hooks/usePerformance';
import { PERIOD_LABEL, type RankingEntry, type RankingPeriodType } from '../types/performance.types';

// Style du bouton « Projeter Classement » : fond jaune or + base dorée « en
// dessous » (Tailwind v4 : important en suffixe « classe! »).
const PROJECT_BTN_CLASS =
  'bg-amber-400! text-slate-900! hover:bg-amber-500! border-transparent! shadow-[0_4px_0_0_#d97706] active:translate-y-0.5 active:shadow-[0_2px_0_0_#d97706] disabled:opacity-50';

const PERIOD_OPTIONS = (Object.keys(PERIOD_LABEL) as RankingPeriodType[]).map((v) => ({ value: v, label: PERIOD_LABEL[v] }));
const BASIS_OPTIONS = [
  { value: '', label: 'Automatique (mixte)' },
  { value: 'KPI', label: 'Score KPI pondéré' },
  { value: 'EVALUATION', label: 'Note d’évaluation' },
];

function rankBadge(rank: number) {
  if (rank === 1) return <Medal className="h-4 w-4 text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-orange-600" />;
  return <span className="text-slate-500 tabular-nums">{rank}</span>;
}

/** Vue plein écran « présentation » du classement (podium + liste). */
function FullscreenRanking({
  entries, periodLabel, basis, onClose,
}: { entries: RankingEntry[]; periodLabel: string; basis: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Fullscreen natif (best-effort) + fermeture sur Échap / sortie de plein écran.
  useEffect(() => {
    const el = ref.current;
    el?.requestFullscreen?.().catch(() => { /* superposition suffit si refusé */ });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onFsChange = () => { if (!document.fullscreenElement) onClose(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [onClose]);

  const winner = entries[0];
  const second = entries[1];
  const third = entries[2];
  const rest = entries.slice(3);

  const PodiumCard = ({ e, place }: { e: RankingEntry; place: 2 | 3 }) => (
    <div className={`flex flex-col items-center rounded-2xl border px-6 py-5 text-center shadow-lg backdrop-blur ${
      place === 2 ? 'border-slate-300/40 bg-slate-200/10' : 'border-orange-400/30 bg-orange-500/10'
    }`}>
      <Medal className={`h-10 w-10 ${place === 2 ? 'text-slate-300' : 'text-orange-400'}`} />
      <div className="mt-2 text-2xl font-bold text-white">{e.rank}<sup>e</sup></div>
      <div className="mt-1 text-lg font-semibold text-white">{e.employeeName}</div>
      <div className="text-sm text-slate-300">{e.poste ?? '—'}</div>
      <div className="mt-2 text-3xl font-extrabold tabular-nums text-white">{e.score.toFixed(1)}</div>
    </div>
  );

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
    >
      {/* Barre supérieure */}
      <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-slate-900/70 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-amber-400" />
          <div>
            <div className="text-lg font-semibold">Classement — {periodLabel}</div>
            <div className="text-xs text-slate-400">Base : {basis === 'KPI' ? 'score KPI pondéré' : 'note d’évaluation'} · {entries.length} collaborateur(s)</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          <X className="h-4 w-4" /> Quitter
        </button>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Vainqueur — mis en belle évidence */}
        {winner && (
          <div className="relative mx-auto mb-8 max-w-2xl overflow-hidden rounded-3xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 p-8 text-center text-amber-950 shadow-2xl ring-4 ring-amber-200/40">
            <div className="pointer-events-none absolute -right-6 -top-6 opacity-20">
              <Crown className="h-40 w-40" />
            </div>
            <Crown className="mx-auto h-20 w-20 drop-shadow-md" />
            <div className="mt-2 text-sm font-bold uppercase tracking-wider">1<sup>er</sup> · Meilleur collaborateur</div>
            <div className="mt-2 text-4xl font-extrabold">{winner.employeeName}</div>
            <div className="mt-1 text-base font-medium text-amber-900/80">
              {winner.poste ?? '—'}{winner.departement ? ` · ${winner.departement}` : ''}
            </div>
            <div className="mt-4 text-6xl font-black tabular-nums drop-shadow-sm">{winner.score.toFixed(1)}</div>
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-900/70">points</div>
          </div>
        )}

        {/* 2e et 3e */}
        {(second || third) && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {second && <PodiumCard e={second} place={2} />}
            {third && <PodiumCard e={third} place={3} />}
          </div>
        )}

        {/* Reste du classement */}
        {rest.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {rest.map((e) => (
              <div key={e.employeeId} className="flex items-center gap-4 border-b border-white/5 px-5 py-3 last:border-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-bold tabular-nums text-white/80">{e.rank}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">{e.employeeName}</div>
                  <div className="truncate text-xs text-slate-400">{e.poste ?? '—'}{e.departement ? ` · ${e.departement}` : ''}</div>
                </div>
                <div className="text-xl font-bold tabular-nums text-white">{e.score.toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RankingsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [periodType, setPeriodType] = useState<RankingPeriodType>('SEMAINE');
  const [refDate, setRefDate] = useState(today);
  const [basis, setBasis] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  // Mode d'affichage du bloc de classement : projection (défaut) ou par ligne.
  const [displayMode, setDisplayMode] = useState<'projection' | 'ligne'>('projection');

  // Revisualisation / suppression d'un classement archivé.
  const [viewSnapshotId, setViewSnapshotId] = useState<number | null>(null);
  const [deleteSnapshotId, setDeleteSnapshotId] = useState<number | null>(null);
  const { data: snapRes } = useRankingSnapshot(viewSnapshotId ?? undefined);
  const deleteSnap = useDeleteRankingSnapshot();
  const snapshotData = snapRes?.success ? snapRes.data : null;
  const snapshotEntries: RankingEntry[] = (snapshotData?.entries ?? []).map((en: any) => ({
    employeeId: en.employee?.id ?? en.employeeId,
    employeeName: `${en.employee?.lastName ?? ''} ${en.employee?.firstName ?? ''}`.trim() || '—',
    matricule: en.employee?.matricule ?? '',
    poste: en.employee?.poste ?? null,
    departement: en.employee?.departement ?? null,
    score: Number(en.score),
    rank: en.rank,
    linked: true,
  }));

  const { data, isLoading } = useRanking(periodType, refDate, basis || undefined);
  const { data: histRes } = useRankingHistory();
  const snapshot = useSnapshotRanking();

  const result = data?.success ? data.data : null;
  const entries: RankingEntry[] = result?.entries ?? [];
  const history = histRes?.success ? histRes.data ?? [] : [];

  return (
    <PageLayout
      title="Classements du personnel"
      breadcrumbs={[{ label: 'Performances', to: '/performance/dashboard' }, { label: 'Classements' }]}
      actions={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Maximize2 className="h-4 w-4" />}
            disabled={entries.length === 0}
            onClick={() => setFullscreen(true)}
            className={PROJECT_BTN_CLASS}
          >
            Projeter Classement
          </Button>
          <Button
            icon={<Save className="h-4 w-4" />}
            loading={snapshot.isPending}
            onClick={() => snapshot.mutate({ periodType, refDate, basis: basis || undefined })}
          >
            Archiver ce classement
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select label="Période" options={PERIOD_OPTIONS} value={periodType} onChange={(e) => setPeriodType(e.target.value as RankingPeriodType)} />
            <Input label="Date de référence" type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
            <Select label="Base du classement" options={BASIS_OPTIONS} value={basis} onChange={(e) => setBasis(e.target.value)} />
          </div>
          {result && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {result.period.label} — base : {result.basis === 'KPI' ? 'score KPI pondéré' : 'note d’évaluation'} · {entries.length} collaborateur(s)
              </p>
              <select
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value as 'projection' | 'ligne')}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Mode d'affichage du classement"
              >
                <option value="projection">Affichage par projection</option>
                <option value="ligne">Affichage par ligne</option>
              </select>
            </div>
          )}
        </Card>

        <Card padding={displayMode === 'projection'}>
          {displayMode === 'projection' ? (
            // Affichage par projection : le contenu du classement n'est pas
            // affiché en ligne — il se consulte via la projection plein écran.
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <Trophy className="h-10 w-10 text-amber-500" />
              <p className="max-w-md text-sm text-slate-600">
                Veuillez cliquer sur le bouton « Projeter Classement » pour visualiser le
                Classement en fonction de la période définie.
              </p>
              <Button
                icon={<Maximize2 className="h-4 w-4" />}
                disabled={entries.length === 0}
                onClick={() => setFullscreen(true)}
                className={PROJECT_BTN_CLASS}
              >
                Projeter Classement
              </Button>
              {entries.length === 0 && !isLoading && (
                <p className="text-xs text-slate-400">Aucun collaborateur à classer sur cette période.</p>
              )}
            </div>
          ) : isLoading ? (
            <div className="p-4"><SkeletonTable /></div>
          ) : entries.length === 0 ? (
            <EmptyState icon={<Trophy className="h-10 w-10" />} title="Aucun classement" description="Aucun collaborateur actif à classer sur cette période, ou aucune donnée disponible." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 w-16">Rang</th>
                    <th className="px-4 py-2">Collaborateur</th>
                    <th className="px-4 py-2">Poste</th>
                    <th className="px-4 py-2">Service</th>
                    <th className="px-4 py-2 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.employeeId} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2">{rankBadge(e.rank)}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {e.employeeName}
                        <span className="ml-2 text-xs text-slate-400">{e.matricule}</span>
                        {!e.linked && <span className="ml-2 text-[10px] text-amber-600">(compte non lié)</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{e.poste ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{e.departement ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">{e.score.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {history.length > 0 && (
          <Card>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <History className="h-4 w-4" /> Historique des classements archivés
            </div>
            <div className="space-y-1">
              {history.slice(0, 12).map((h: any) => (
                <div key={h.id} className="flex items-center justify-between gap-3 rounded border border-slate-100 px-3 py-1.5 text-sm">
                  <span className="text-slate-700">{PERIOD_LABEL[h.periodType as RankingPeriodType]} — {formatDate(h.periodStart)}</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <Badge variant={h.basis === 'KPI' ? 'info' : 'success'}>{h.basis === 'KPI' ? 'KPI' : 'Évaluation'}</Badge>
                      {h._count?.entries ?? 0} classé(s)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      onClick={() => setViewSnapshotId(h.id)}
                      title="Revoir ce classement (projection)"
                    >
                      Revoir
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => setDeleteSnapshotId(h.id)}
                      title="Supprimer ce classement archivé"
                      className="text-red-600! hover:bg-red-50!"
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {fullscreen && result && (
        <FullscreenRanking
          entries={entries}
          periodLabel={result.period.label}
          basis={result.basis}
          onClose={() => setFullscreen(false)}
        />
      )}

      {/* Revisualisation d'un classement archivé (même projection plein écran). */}
      {viewSnapshotId != null && snapshotData && (
        <FullscreenRanking
          entries={snapshotEntries}
          periodLabel={`${PERIOD_LABEL[snapshotData.periodType as RankingPeriodType]} — ${formatDate(snapshotData.periodStart)}`}
          basis={snapshotData.basis}
          onClose={() => setViewSnapshotId(null)}
        />
      )}

      <ConfirmDialog
        open={deleteSnapshotId != null}
        onClose={() => setDeleteSnapshotId(null)}
        onConfirm={async () => {
          if (deleteSnapshotId == null) return;
          await deleteSnap.mutateAsync(deleteSnapshotId);
          if (viewSnapshotId === deleteSnapshotId) setViewSnapshotId(null);
          setDeleteSnapshotId(null);
        }}
        title="Supprimer le classement archivé"
        message="Supprimer définitivement ce classement archivé et ses entrées ? Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={deleteSnap.isPending}
      />
    </PageLayout>
  );
}
