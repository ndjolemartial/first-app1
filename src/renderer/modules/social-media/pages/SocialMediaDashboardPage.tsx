import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import PageLayout from '../../../shared/components/layout/PageLayout';
import SocialMediaTabs from '../components/SocialMediaTabs';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { PenTool, Eye, ThumbsUp, Users2, Share2, TrendingUp } from 'lucide-react';
import { useSocialDashboard } from '../hooks/useSocialMedia';
import { PLATFORM_TYPE_LABEL, type SocialPlatformType } from '../types/social-media.types';

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

export default function SocialMediaDashboardPage() {
  const { data, isLoading } = useSocialDashboard();
  const d = data?.success ? data.data : null;

  return (
    <PageLayout title="Réseaux Sociaux & Plateformes Web" breadcrumbs={[{ label: 'Réseaux Sociaux & Web' }, { label: 'Tableau de bord' }]}>
      <SocialMediaTabs />

      {isLoading || !d ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile icon={<Share2 className="h-5 w-5" />} label="Plateformes actives" value={`${d.counters.activePlatforms} / ${d.counters.platforms}`} to="/social-media/platforms" />
            <StatTile icon={<PenTool className="h-5 w-5" />} label="Publications & articles" value={d.counters.publicationsTotal} to="/social-media/publications" />
            <StatTile icon={<Eye className="h-5 w-5" />} label="Vues cumulées" value={d.counters.viewsTotal.toLocaleString('fr-FR')} />
            <StatTile icon={<ThumbsUp className="h-5 w-5" />} label="Interactions cumulées" value={d.counters.interactionsTotal.toLocaleString('fr-FR')} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile icon={<Users2 className="h-5 w-5" />} label="Abonnés (toutes plateformes actives)" value={d.counters.followersTotal.toLocaleString('fr-FR')} to="/social-media/followers" />
          </div>

          <Card>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <TrendingUp className="h-4 w-4" /> Publications, vues & interactions (12 mois)
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={d.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="publications" stroke="#1E3A5F" strokeWidth={2} name="Publications" dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="views" stroke="#2563EB" strokeWidth={2} name="Vues" dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="interactions" stroke="#F59E0B" strokeWidth={2} name="Interactions" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Users2 className="h-4 w-4" /> Évolution du nombre d’abonnés (12 mois, plateformes actives)
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={d.followersTrend}>
                <defs>
                  <linearGradient id="followersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2} fill="url(#followersGradient)" name="Abonnés" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card padding={false}>
            <div className="px-4 py-2 text-sm font-semibold text-slate-700 border-b border-slate-100">Répartition par plateforme</div>
            {d.byPlatform.length === 0 ? (
              <div className="p-6"><EmptyState icon={<Share2 className="h-8 w-8" />} title="Aucune plateforme" description="Ajoutez une plateforme pour commencer le suivi." /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Plateforme</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Publications</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Vues</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Interactions</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Abonnés</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.byPlatform.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{PLATFORM_TYPE_LABEL[p.type as SocialPlatformType]}</p>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{p.publications}</td>
                      <td className="px-4 py-2 text-slate-600">{p.views.toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-2 text-slate-600">{p.interactions.toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-2 text-slate-600">{p.followers !== null ? p.followers.toLocaleString('fr-FR') : '—'}</td>
                      <td className="px-4 py-2"><Badge variant={p.isActive ? 'success' : 'default'}>{p.isActive ? 'Actif' : 'Inactif'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
