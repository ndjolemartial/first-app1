import { useMemo, useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { formatDate } from '../../../shared/utils/format';
import { useLateness, useUnjustifyLateness, useTolerateLateness, useUntolerateLateness } from '../hooks/useHr';
import { useLatenessSettings } from '../../settings/hooks/useSettings';
import LatenessJustifyModal, { type LatenessLineForModal } from '../components/LatenessJustifyModal';
import { MONTH_OPTIONS } from '../types/hr.types';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Clock, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

/** Rôles à vue complète (tous les collaborateurs éligibles, filtre et actions de justification). */
const LATENESS_FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const now = new Date();
// '0' = sentinel « toutes les années » / « tous les mois » (0 est une valeur
// falsy, traitée côté IPC exactement comme une absence de filtre).
const YEAR_OPTIONS = [
  { value: '0', label: 'Toutes les années' },
  ...Array.from({ length: 4 }, (_, i) => ({ value: String(now.getFullYear() - i), label: String(now.getFullYear() - i) })),
];
const LATENESS_MONTH_OPTIONS = [{ value: '0', label: 'Tous les mois' }, ...MONTH_OPTIONS];

/** Heure 'HH:MM' à partir d'un horodatage ISO, ou '—'. */
const hhmm = (v?: string | null): string =>
  v ? new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

/** '1h30' à partir d'un nombre de minutes. */
function fmtMinutes(min: number): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/** Date d'une ligne (ISO renvoyé par l'IPC) → 'YYYY-MM-DD'. */
const toDateStr = (d: string): string => d.slice(0, 10);

export default function LatenessPage() {
  const role = useAuthStore((s) => s.user?.role ?? '');
  const isFullAccess = LATENESS_FULL_ACCESS_ROLES.includes(role);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showJustified, setShowJustified] = useState(false);
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [justifyTarget, setJustifyTarget] = useState<LatenessLineForModal | null>(null);
  const [unjustifyTarget, setUnjustifyTarget] = useState<any>(null);
  const [tolerateTarget, setTolerateTarget] = useState<any>(null);
  const [untolerateTarget, setUntolerateTarget] = useState<any>(null);

  // Toujours récupérer l'ensemble des journées (justifiées/tolérées incluses) :
  // les cumuls affichés doivent rester exacts même quand la case « Afficher
  // aussi les journées justifiées ou tolérées » est décochée. Cette case ne
  // filtre alors que les lignes du tableau, pas les totaux.
  const { data, isLoading } = useLateness({ year, month });
  const unjustify = useUnjustifyLateness();
  const tolerate = useTolerateLateness();
  const untolerate = useUntolerateLateness();
  const { data: latenessSettingsRes } = useLatenessSettings();
  const toleranceMinutes = latenessSettingsRes?.success ? latenessSettingsRes.data?.toleranceMinutes ?? 15 : 15;

  const lines: any[] = data?.success ? data.data ?? [] : [];

  const employeeOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const l of lines) seen.set(l.employeeId, l.employeeName);
    return [
      { value: '', label: 'Tous les collaborateurs' },
      ...[...seen.entries()]
        .map(([id, name]) => ({ value: String(id), label: name }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    ];
  }, [lines]);

  const matching = lines.filter((l) => {
    if (employeeFilter && String(l.employeeId) !== employeeFilter) return false;
    if (search && !`${l.employeeName} ${l.matricule}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filtered = showJustified
    ? matching
    : matching.filter((l) => !l.justification?.justified && !l.justification?.tolerated);

  const totalUnjustifiedMinutes = matching
    .filter((l) => !l.justification?.justified && !l.justification?.tolerated)
    .reduce((sum, l) => sum + l.totalMinutes, 0);
  const totalJustifiedMinutes = matching
    .filter((l) => l.justification?.justified)
    .reduce((sum, l) => sum + l.totalMinutes, 0);
  const totalToleratedMinutes = matching
    .filter((l) => l.justification?.tolerated)
    .reduce((sum, l) => sum + l.totalMinutes, 0);

  return (
    <PageLayout
      title="Retards & Départs précipités"
      breadcrumbs={[{ label: 'Gestion du personnel' }, { label: 'Retards & Départs précipités' }]}
    >
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Select label="Année" options={YEAR_OPTIONS} value={String(year)} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div className="w-44">
          <Select label="Mois" options={LATENESS_MONTH_OPTIONS} value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} />
        </div>
        {isFullAccess && (
          <div className="w-60">
            <Select label="Collaborateur" options={employeeOptions} value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} />
          </div>
        )}
        <div className="flex-1 min-w-[180px]">
          <Input label="Rechercher" placeholder="Nom, matricule…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
          <input type="checkbox" checked={showJustified} onChange={(e) => setShowJustified(e.target.checked)} />
          Afficher aussi les journées justifiées ou tolérées
        </label>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          Cumul non justifié sur la période : <span className="font-semibold text-slate-900">{fmtMinutes(totalUnjustifiedMinutes)}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-slate-400" />
          Cumul justifié sur la période : <span className="font-semibold text-slate-900">{fmtMinutes(totalJustifiedMinutes)}</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          Cumul toléré sur la période : <span className="font-semibold text-slate-900">{fmtMinutes(totalToleratedMinutes)}</span>
        </div>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Aucune journée de retard ou de départ précipité" description="Rien à signaler sur la période sélectionnée." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Collaborateur</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Arrivée</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Départ</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Retard</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Départ précipité</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                {isFullAccess && <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l, i) => {
                const justified = !!l.justification?.justified;
                const tolerated = !!l.justification?.tolerated;
                const withinTolerance = l.totalMinutes <= toleranceMinutes;
                return (
                  <tr key={`${l.employeeId}-${i}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{l.employeeName}</p>
                      <p className="text-xs text-slate-400">{l.matricule}{l.poste ? ` — ${l.poste}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(l.date)}</td>
                    <td className="px-4 py-3 text-slate-600">{hhmm(l.arrivalTime)}</td>
                    <td className="px-4 py-3 text-slate-600">{hhmm(l.departureTime)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtMinutes(l.lateMinutes)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtMinutes(l.earlyMinutes)}</td>
                    <td className="px-4 py-3">
                      {justified ? (
                        <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1 inline" />Justifiée</Badge>
                      ) : tolerated ? (
                        <Badge variant="info"><ShieldCheck className="h-3 w-3 mr-1 inline" />Tolérée</Badge>
                      ) : (
                        <Badge variant="warning"><XCircle className="h-3 w-3 mr-1 inline" />Non justifiée</Badge>
                      )}
                    </td>
                    {isFullAccess && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {justified ? (
                            <Button variant="ghost" size="sm" onClick={() => setUnjustifyTarget(l)}>Retirer</Button>
                          ) : tolerated ? (
                            <Button variant="ghost" size="sm" onClick={() => setUntolerateTarget(l)}>Retirer</Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => setJustifyTarget({ employeeId: l.employeeId, employeeName: l.employeeName, date: toDateStr(l.date) })}
                              >
                                Justifier
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!withinTolerance}
                                title={!withinTolerance ? `Dépasse la limite de tolérance (${toleranceMinutes} min)` : undefined}
                                onClick={() => setTolerateTarget(l)}
                                className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400"
                              >
                                Tolérer
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <LatenessJustifyModal line={justifyTarget} onClose={() => setJustifyTarget(null)} />

      <ConfirmDialog
        open={!!unjustifyTarget}
        title="Retirer la justification"
        message={unjustifyTarget ? `Retirer la justification de la journée du ${formatDate(unjustifyTarget.date)} pour ${unjustifyTarget.employeeName} ?` : ''}
        onConfirm={async () => {
          if (unjustifyTarget) await unjustify.mutateAsync({ employeeId: unjustifyTarget.employeeId, date: toDateStr(unjustifyTarget.date) });
          setUnjustifyTarget(null);
        }}
        onClose={() => setUnjustifyTarget(null)}
      />

      <ConfirmDialog
        open={!!tolerateTarget}
        title="Tolérer la journée"
        message={tolerateTarget
          ? `Marquer la journée du ${formatDate(tolerateTarget.date)} (${fmtMinutes(tolerateTarget.totalMinutes)}) comme tolérée pour ${tolerateTarget.employeeName} ? Cette journée ne comptera plus dans le cumul non justifié ni dans le KPI de performance associé.`
          : ''}
        onConfirm={async () => {
          if (tolerateTarget) await tolerate.mutateAsync({ employeeId: tolerateTarget.employeeId, date: toDateStr(tolerateTarget.date) });
          setTolerateTarget(null);
        }}
        onClose={() => setTolerateTarget(null)}
      />

      <ConfirmDialog
        open={!!untolerateTarget}
        title="Retirer la tolérance"
        message={untolerateTarget ? `Retirer la tolérance de la journée du ${formatDate(untolerateTarget.date)} pour ${untolerateTarget.employeeName} ?` : ''}
        onConfirm={async () => {
          if (untolerateTarget) await untolerate.mutateAsync({ employeeId: untolerateTarget.employeeId, date: toDateStr(untolerateTarget.date) });
          setUntolerateTarget(null);
        }}
        onClose={() => setUntolerateTarget(null)}
      />
    </PageLayout>
  );
}
