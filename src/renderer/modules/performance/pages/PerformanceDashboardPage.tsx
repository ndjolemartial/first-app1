import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { formatDate } from '../../../shared/utils/format';
import { Trophy, TrendingUp, GraduationCap, ClipboardCheck, Target, Medal } from 'lucide-react';
import { usePerfDashboard } from '../hooks/usePerformance';

function StatTile({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: number | string; to?: string }) {
  const body = (
    <Card className="flex items-center gap-3">
      <div className="rounded-lg bg-blue-50 p-2 text-blue-600">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function PerformanceDashboardPage() {
  const { data, isLoading } = usePerfDashboard();
  const d = data?.success ? data.data : null;

  return (
    <PageLayout title="Performance — Tableau de bord" breadcrumbs={[{ label: 'Performances' }, { label: 'Tableau de bord' }]}>
      {isLoading || !d ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile icon={<ClipboardCheck className="h-5 w-5" />} label={`Évaluations ${new Date().getFullYear()}`} value={d.counters.evaluationsTotal} to="/performance/evaluations" />
            <StatTile icon={<Target className="h-5 w-5" />} label="Objectifs en cours" value={d.counters.objectivesActive} to="/performance/objectives" />
            <StatTile icon={<ClipboardCheck className="h-5 w-5" />} label="En attente de validation" value={d.counters.pending} to="/performance/evaluations" />
            <StatTile icon={<GraduationCap className="h-5 w-5" />} label="Besoins de formation" value={d.counters.trainingNeeds} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Top performers */}
            <Card>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Trophy className="h-4 w-4 text-amber-500" /> Meilleurs collaborateurs — {d.period?.label}</div>
              {d.topPerformers.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Aucune donnée sur la période.</p>
              ) : (
                <div className="space-y-2">
                  {d.topPerformers.map((p: any) => (
                    <div key={p.employeeId} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2">
                      <span className="flex items-center gap-2">
                        {p.rank <= 3 ? <Medal className={`h-4 w-4 ${p.rank === 1 ? 'text-amber-500' : p.rank === 2 ? 'text-slate-400' : 'text-orange-600'}`} /> : <span className="w-4 text-center text-xs text-slate-400">{p.rank}</span>}
                        <span className="text-sm font-medium text-slate-800">{p.employeeName}</span>
                        <span className="text-xs text-slate-400">{p.poste ?? ''}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">{p.score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/performance/rankings" className="mt-3 inline-block text-xs text-blue-600 hover:underline">Voir tous les classements →</Link>
            </Card>

            {/* Performance par service */}
            <Card>
              <div className="mb-3 text-sm font-semibold text-slate-700">Performance moyenne par service</div>
              {d.services.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Aucune évaluation validée cette année.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={d.services} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} fontSize={11} />
                    <YAxis type="category" dataKey="departement" width={110} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="avgScore" fill="#2563EB" radius={[0, 4, 4, 0]} name="Note moyenne" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* Tendance */}
          <Card>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><TrendingUp className="h-4 w-4" /> Tendance des notes validées (12 mois)</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={d.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="avgScore" stroke="#2563EB" strokeWidth={2} name="Note moyenne" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Besoins de formation */}
          <Card padding={false}>
            <div className="px-4 py-2 text-sm font-semibold text-slate-700 border-b border-slate-100">Besoins de formation identifiés</div>
            {d.trainingNeeds.length === 0 ? (
              <div className="p-6"><EmptyState icon={<GraduationCap className="h-8 w-8" />} title="Aucun besoin de formation" description="Les besoins issus des plans de progrès en cours apparaîtront ici." /></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {d.trainingNeeds.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-800">{t.employee}</span>
                      {t.departement && <Badge variant="default" className="ml-2">{t.departement}</Badge>}
                      <p className="text-xs text-slate-500">{t.trainingNeeds}</p>
                    </div>
                    {t.dueDate && <span className="text-xs text-slate-400">{formatDate(t.dueDate)}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
