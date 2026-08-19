import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import Modal from '../../../shared/components/ui/Modal';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ExportMenu, { type ExportColumn } from '../../../shared/components/ExportMenu';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatCurrency, formatDate, formatDateTime } from '../../../shared/utils/format';
import { Printer } from 'lucide-react';
import {
  useExecutiveAnalytics, useFinancialAnalytics, usePortfolioAnalytics, useCrmAnalytics,
  useChargesAnalytics, useContractsAnalytics, useRiskAnalytics, useRecommendations,
  useFollowUpAnalytics, useVisitorsAnalytics, useCallsAnalytics,
} from '../hooks/useAnalytics';

const PALETTE = ['#1E3A5F', '#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B', '#14B8A6'];
const fmtK = (v: number) => `${(v / 1000).toFixed(0)}k`;

function Kpi({ label, value, tone, onClick }: { label: string; value: string; tone?: string; onClick?: () => void }) {
  const card = (
    <Card className={`flex flex-col gap-1 ${onClick ? 'cursor-pointer transition hover:border-blue-300 hover:shadow-md' : ''}`}>
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${tone ?? 'text-slate-900'}`}>{value}</span>
    </Card>
  );
  if (!onClick) return card;
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {card}
    </button>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </Card>
  );
}

function Loading() { return <Card>Chargement…</Card>; }

/* ─── 1. Exécutif ─── */
export function ExecutiveTab() {
  const { data } = useExecutiveAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="CA encaissé (année)" value={formatCurrency(d.caYear)} tone="text-emerald-600" />
        <Kpi label="CA encaissé (mois)" value={formatCurrency(d.caMonth)} />
        <Kpi label="Trésorerie" value={formatCurrency(d.treasuryBalance)} tone={d.treasuryBalance < 0 ? 'text-red-600' : undefined} />
        <Kpi label="Impayés (factures)" value={formatCurrency(d.unpaidAmount)} tone="text-amber-600" />
        <Kpi label="Échéances en retard" value={`${formatCurrency(d.overdueAmount)} (${d.overdueCount})`} tone={d.overdueCount ? 'text-red-600' : undefined} />
        <Kpi label="Conventions actives" value={String(d.activeConventions)} />
        <Kpi label="Stock disponible" value={String(d.stockDisponible)} />
        <Kpi label="Charges prévues" value={`${formatCurrency(d.forecastDue)} (${d.forecastDueCount})`} />
      </div>
      <ChartCard title="Évolution du chiffre d'affaires encaissé (12 mois)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={d.caEvolution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Line type="monotone" dataKey="encaisse" stroke="#2563EB" strokeWidth={2} name="Encaissé" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

/* ─── 2. Finance ─── */
export function FinancialTab() {
  const { data } = useFinancialAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Recettes (12 mois)" value={formatCurrency(d.totalRecettes)} tone="text-emerald-600" />
        <Kpi label="Dépenses (12 mois)" value={formatCurrency(d.totalDepenses)} tone="text-red-600" />
        <Kpi label="Résultat" value={formatCurrency(d.resultat)} tone={d.resultat < 0 ? 'text-red-600' : 'text-emerald-600'} />
        <Kpi label="Marge" value={`${d.marge} %`} />
        <Kpi label="Facturé (année)" value={formatCurrency(d.totalInvoiced)} />
        <Kpi label="Encaissé (année)" value={formatCurrency(d.collectedYear)} />
        <Kpi label="Taux de recouvrement" value={`${d.collectionRate} %`} tone={d.collectionRate < 80 ? 'text-amber-600' : 'text-emerald-600'} />
      </div>
      <ChartCard title="Recettes / Dépenses / Résultat (12 mois)">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={d.cashflow} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
            <Bar dataKey="recettes" fill="#10B981" name="Recettes" radius={[3, 3, 0, 0]} />
            <Bar dataKey="depenses" fill="#EF4444" name="Dépenses" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Recettes par type (année)">
        <SimpleAmountTable rows={d.revenueByType.map((r: any) => ({ key: r.type, amount: r.amount }))} />
      </ChartCard>
    </div>
  );
}

/* ─── 3. Portefeuille ─── */
export function PortfolioTab() {
  const { data } = usePortfolioAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Valeur du stock disponible" value={formatCurrency(d.stockValue)} />
        <Kpi label="Valeur vendue" value={formatCurrency(d.soldValue)} tone="text-emerald-600" />
        <Kpi label="Lotissements" value={String(d.lotissements)} />
        <Kpi label="Programmes" value={String(d.programmes)} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Biens par statut">
          <PieBlock data={d.propsByStatus} />
        </ChartCard>
        <ChartCard title="Terrains par statut">
          <PieBlock data={d.terrainsByStatus} />
        </ChartCard>
      </div>
      <ChartCard title="Biens par type">
        <CountTable rows={d.propsByType} />
      </ChartCard>
    </div>
  );
}

/* ─── 4. CRM ─── */
type CrmMetric =
  | 'prospectsTotal' | 'converted' | 'locataires' | 'souscripteurs'
  | 'activitiesPending' | 'activitiesOverdue' | 'prospectsBySource';

const PROSPECT_STATUS_LABEL: Record<string, string> = {
  NOUVEAU: 'Nouveau', CONTACTE: 'Contacté', QUALIFIE: 'Client potentiel',
  ENVOI_PROPOSITION: 'Proposition', NEGOCIATION_EN_COURS: 'Négociation', CONVERTI: 'Converti', PERDU: 'Perdu',
};
const PROSPECT_SOURCE_LABEL: Record<string, string> = {
  SITE_WEB_AFRIKIMMO: 'Site web', RECOMMENDATION: 'Recommandation', TELEPHONE: 'Téléphone',
  RESEAUX_SOCIAUX: 'Réseaux sociaux', EMAIL: 'Email', CONTACT_PERSONNEL: 'Contact personnel',
  PROSPECTION: 'Prospection', AUTRE: 'Autre',
};
const CONVENTION_TYPE_LABEL: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Location nue', RENTAL_FURNISHED: 'Location meublée', SALE: 'Vente',
  SOUSCRIPTION: 'Souscription', COMMERCIAL_LEASE: 'Bail commercial', MANAGEMENT: 'Gestion',
};
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  APPEL: 'Appel', EMAIL: 'Email', SMS: 'SMS', REUNION: 'Réunion',
  VISITE: 'Visite chantier / Sortie en clientèle / Courses', TASK: 'Tâche', RAPPEL: 'Rappel',
  DOCUMENT: 'Document', NOTIFICATION: 'Notification', CREATION_PUBLICATION: 'Créas / Publications / Articles',
};
const ACTIVITY_STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente', EN_TRAITEMENT: 'En cours', TRAITE: 'Traité', ANNULE: 'Annulé',
};

/** Fenêtre listant le détail d'un indicateur CRM cliqué (prospects, conventions ou activités). */
function CrmDetailModal({
  metric, source, title, onClose,
}: { metric: CrmMetric; source?: string; title: string; onClose: () => void }) {
  const token = useAuthStore((s) => s.token)!;
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'crm-detail', metric, source, page],
    queryFn: () => window.electron.analytics.crmDetail(token, metric, source ? { source } : undefined, page, limit),
  });

  const rows: any[] = data?.success ? (data as any).data ?? [] : [];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const entity = (data as any)?.entity as 'prospect' | 'convention' | 'activity' | undefined;

  return (
    <Modal open onClose={onClose} title={title} size="xl">
      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun résultat.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {entity === 'prospect' && (
                <>
                  <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Référence</th>
                      <th className="py-2 pr-3 font-medium">Nom</th>
                      <th className="py-2 pr-3 font-medium">Statut</th>
                      <th className="py-2 pr-3 font-medium">Source</th>
                      <th className="py-2 font-medium">Assigné à</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-3 font-mono text-xs">{p.reference}</td>
                        <td className="py-2 pr-3 text-slate-600">{`${p.lastName ?? ''} ${p.firstName ?? ''}`.trim()}</td>
                        <td className="py-2 pr-3"><Badge variant="default">{PROSPECT_STATUS_LABEL[p.status] ?? p.status}</Badge></td>
                        <td className="py-2 pr-3 text-slate-600">{PROSPECT_SOURCE_LABEL[p.source] ?? p.source}</td>
                        <td className="py-2 text-slate-600">
                          {p.assignedTo ? `${p.assignedTo.lastName ?? ''} ${p.assignedTo.firstName ?? ''}`.trim() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {entity === 'convention' && (
                <>
                  <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Référence</th>
                      <th className="py-2 pr-3 font-medium">Client</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">Montant</th>
                      <th className="py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 pr-3 font-mono text-xs">{c.reference}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {c.client?.type && c.client.type !== 'INDIVIDUEL'
                            ? (c.client?.entreprise ?? '—')
                            : (`${c.client?.lastName ?? ''} ${c.client?.firstName ?? ''}`.trim() || '—')}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{CONVENTION_TYPE_LABEL[c.type] ?? c.type}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-600">{formatCurrency(c.saleAmount ?? c.rentAmount ?? 0)}</td>
                        <td className="py-2 text-slate-600">{formatDate(c.signedAt ?? c.startDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {entity === 'activity' && (
                <>
                  <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Sujet</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">Statut</th>
                      <th className="py-2 pr-3 font-medium">Échéance</th>
                      <th className="py-2 font-medium">Assigné à</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-3 text-slate-800">{a.subject}</td>
                        <td className="py-2 pr-3 text-slate-600">{ACTIVITY_TYPE_LABEL[a.type] ?? a.type}</td>
                        <td className="py-2 pr-3"><Badge variant="warning">{ACTIVITY_STATUS_LABEL[a.status] ?? a.status}</Badge></td>
                        <td className="py-2 pr-3 text-slate-600">{formatDate(a.dueDate)}</td>
                        <td className="py-2 text-slate-600">
                          {a.user ? `${a.user.lastName ?? ''} ${a.user.firstName ?? ''}`.trim() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{total} résultat(s)</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Précédent</Button>
                <span className="px-2 py-1">{page} / {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Suivant</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function CrmTab() {
  const { data } = useCrmAnalytics();
  const [detail, setDetail] = useState<{ metric: CrmMetric; source?: string; title: string } | null>(null);
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Prospects" value={String(d.prospectsTotal)}
          onClick={() => setDetail({ metric: 'prospectsTotal', title: 'Tous les prospects' })} />
        <Kpi label="Convertis" value={String(d.converted)} tone="text-emerald-600"
          onClick={() => setDetail({ metric: 'converted', title: 'Prospects convertis' })} />
        <Kpi label="Taux de conversion" value={`${d.conversionRate} %`} />
        <Kpi label="Locataires (baux actifs)" value={String(d.locataires)}
          onClick={() => setDetail({ metric: 'locataires', title: 'Locataires (baux actifs)' })} />
        <Kpi label="Souscripteurs (ventes actives)" value={String(d.souscripteurs)}
          onClick={() => setDetail({ metric: 'souscripteurs', title: 'Souscripteurs (ventes actives)' })} />
        <Kpi label="Rappels en attente" value={String(d.activitiesPending)}
          onClick={() => setDetail({ metric: 'activitiesPending', title: 'Rappels en attente' })} />
        <Kpi label="Rappels en retard" value={String(d.activitiesOverdue)} tone={d.activitiesOverdue ? 'text-red-600' : undefined}
          onClick={() => setDetail({ metric: 'activitiesOverdue', title: 'Rappels en retard' })} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Pipeline prospects (statut)">
          <CountBar data={d.prospectsByStatus} />
        </ChartCard>
        <ChartCard title="Prospects par source (cliquer une part pour le détail)">
          <PieBlock
            data={d.prospectsBySource}
            onSliceClick={(key) => setDetail({
              metric: 'prospectsBySource', source: key,
              title: `Prospects — source : ${PROSPECT_SOURCE_LABEL[key] ?? key}`,
            })}
          />
        </ChartCard>
      </div>
      <ChartCard title="Clients par type">
        <CountTable rows={d.clientsByType} />
      </ChartCard>
      {detail && (
        <CrmDetailModal metric={detail.metric} source={detail.source} title={detail.title} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

/* ─── 5. Charges ─── */
export function ChargesTab() {
  const { data } = useChargesAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Charges prévues" value={`${formatCurrency(d.forecastPrevu)} (${d.forecastPrevuCount})`} />
        <Kpi label="Charges réglées (année)" value={`${formatCurrency(d.forecastRegle)} (${d.forecastRegleCount})`} tone="text-emerald-600" />
        <Kpi label="Charges en retard" value={`${formatCurrency(d.forecastOverdue)} (${d.forecastOverdueCount})`} tone={d.forecastOverdueCount ? 'text-red-600' : undefined} />
      </div>
      <ChartCard title="Évolution des dépenses (12 mois)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={d.depensesEvolution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Line type="monotone" dataKey="depenses" stroke="#EF4444" strokeWidth={2} name="Dépenses" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Dépenses par objet (année — top 10)">
        <SimpleAmountTable rows={d.expensesByCategory} />
      </ChartCard>
    </div>
  );
}

/* ─── 6. Contractuel ─── */
export function ContractsTab() {
  const { data } = useContractsAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Valeur des ventes actives" value={formatCurrency(d.totalSaleValue)} />
        <Kpi label="Encours échéances" value={`${formatCurrency(d.installmentsOutstanding)} (${d.installmentsOutstandingCount})`} tone="text-amber-600" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Conventions par type"><CountTable rows={d.byType} /></ChartCard>
        <ChartCard title="Conventions par statut"><CountBar data={d.byStatus} /></ChartCard>
      </div>
      <ChartCard title="Conventions arrivant à échéance (90 jours)">
        {d.expiring.length === 0 ? <p className="text-sm text-slate-500">Aucune.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Référence</th><th>Type</th><th>Client</th><th>Échéance</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {d.expiring.map((c: any) => (
                <tr key={c.id}>
                  <td className="py-1 font-mono text-xs">{c.reference}</td>
                  <td>{c.type}</td>
                  <td>{c.client?.entreprise || `${c.client?.firstName ?? ''} ${c.client?.lastName ?? ''}`.trim() || '—'}</td>
                  <td>{formatDate(c.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ChartCard>
    </div>
  );
}

/* ─── 6bis. Statistiques visiteurs ─── */
const VISITOR_SOURCE_LABEL: Record<string, string> = { QR: 'QR Code', INTERNE: 'Accueil' };

type VisitorsPeriod = 'today' | 'month' | 'total';

/** Fenêtre listant les visiteurs correspondant à une période cliquée (aujourd'hui / mois / total). */
function VisitorsPeriodModal({ period, onClose }: { period: VisitorsPeriod; onClose: () => void }) {
  const token = useAuthStore((s) => s.token)!;
  const [page, setPage] = useState(1);
  const limit = 10;

  const filters = (() => {
    const now = new Date();
    if (period === 'today') {
      return { dateFrom: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() };
    }
    if (period === 'month') {
      return { dateFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
    }
    return {};
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'visitors-period', period, page],
    queryFn: () => window.electron.visitors.list(token, filters, page, limit),
  });

  const visitors: any[] = data?.success ? data.data ?? [] : [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const title = period === 'today' ? "Visiteurs d'aujourd'hui" : period === 'month' ? 'Visiteurs du mois' : 'Tous les visiteurs';

  return (
    <Modal open onClose={onClose} title={title} size="xl">
      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : visitors.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun visiteur sur cette période.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Date / heure</th>
                  <th className="py-2 pr-3 font-medium">Nom & Prénoms</th>
                  <th className="py-2 pr-3 font-medium">Entreprise</th>
                  <th className="py-2 pr-3 font-medium">Objet de visite</th>
                  <th className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visitors.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{formatDateTime(v.visitedAt)}</td>
                    <td className="py-2 pr-3 text-slate-600">{`${v.lastName ?? ''} ${v.firstName ?? ''}`.trim() || '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{v.company || '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{v.objet}</td>
                    <td className="py-2">
                      <Badge variant={v.source === 'QR' ? 'info' : 'default'}>{VISITOR_SOURCE_LABEL[v.source] ?? v.source}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{total} visiteur(s)</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Précédent</Button>
                <span className="px-2 py-1">{page} / {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Suivant</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function VisitorsTab() {
  const { data } = useVisitorsAnalytics();
  const [period, setPeriod] = useState<VisitorsPeriod | null>(null);
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Visiteurs (aujourd'hui)" value={String(d.today)} onClick={() => setPeriod('today')} />
        <Kpi label="Visiteurs (mois)" value={String(d.month)} onClick={() => setPeriod('month')} />
        <Kpi label="Visiteurs (total)" value={String(d.total)} onClick={() => setPeriod('total')} />
      </div>
      <ChartCard title="Évolution mensuelle des visiteurs (12 mois)">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={d.evolution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total" stroke="#1E3A5F" strokeWidth={2} name="Total" dot={false} />
            <Line type="monotone" dataKey="qr" stroke="#2563EB" strokeWidth={2} name="QR (auto-enregistrement)" dot={false} />
            <Line type="monotone" dataKey="interne" stroke="#8B5CF6" strokeWidth={2} name="Interne (accueil)" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Visiteurs par objet de visite (top 10)">
        <CountTable rows={d.byObjet} />
      </ChartCard>
      {period && <VisitorsPeriodModal period={period} onClose={() => setPeriod(null)} />}
    </div>
  );
}

/* ─── 6ter. Statistiques appels ─── */
const CALL_STATUS_LABEL: Record<string, string> = {
  ABOUTI: 'Abouti',
  MANQUE: 'Manqué',
  OCCUPE: 'Occupé',
  MESSAGE_LAISSE: 'Message laissé',
};
const CALL_STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  ABOUTI: 'success',
  MANQUE: 'danger',
  OCCUPE: 'warning',
  MESSAGE_LAISSE: 'default',
};
const CALL_DIRECTION_LABEL: Record<string, string> = { ENTRANT: 'Entrant', SORTANT: 'Sortant' };

type CallsPeriod = 'today' | 'month' | 'total';

/** Fenêtre listant les appels correspondant à une période cliquée (aujourd'hui / mois / total). */
function CallsPeriodModal({ period, onClose }: { period: CallsPeriod; onClose: () => void }) {
  const token = useAuthStore((s) => s.token)!;
  const [page, setPage] = useState(1);
  const limit = 10;

  const filters = (() => {
    const now = new Date();
    if (period === 'today') {
      return { dateFrom: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() };
    }
    if (period === 'month') {
      return { dateFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
    }
    return {};
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'calls-period', period, page],
    queryFn: () => window.electron.calls.list(token, filters, page, limit),
  });

  const calls: any[] = data?.success ? data.data ?? [] : [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const title = period === 'today' ? "Appels d'aujourd'hui" : period === 'month' ? 'Appels du mois' : 'Tous les appels';

  return (
    <Modal open onClose={onClose} title={title} size="xl">
      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : calls.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun appel sur cette période.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Date / heure</th>
                  <th className="py-2 pr-3 font-medium">Sens</th>
                  <th className="py-2 pr-3 font-medium">Contact</th>
                  <th className="py-2 pr-3 font-medium">Objet</th>
                  <th className="py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{formatDateTime(c.calledAt)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={c.direction === 'ENTRANT' ? 'info' : 'purple'}>
                        {CALL_DIRECTION_LABEL[c.direction] ?? c.direction}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {`${c.lastName ?? ''} ${c.firstName ?? ''}`.trim() || c.company || '—'}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{c.objet}</td>
                    <td className="py-2">
                      <Badge variant={CALL_STATUS_VARIANT[c.status] ?? 'default'}>{CALL_STATUS_LABEL[c.status] ?? c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{total} appel(s)</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Précédent</Button>
                <span className="px-2 py-1">{page} / {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Suivant</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function CallsTab() {
  const { data } = useCallsAnalytics();
  const [period, setPeriod] = useState<CallsPeriod | null>(null);
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Appels (aujourd'hui)" value={String(d.today)} onClick={() => setPeriod('today')} />
        <Kpi label="Appels (mois)" value={String(d.month)} onClick={() => setPeriod('month')} />
        <Kpi label="Appels (total)" value={String(d.total)} onClick={() => setPeriod('total')} />
      </div>
      <ChartCard title="Évolution mensuelle des appels (12 mois)">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={d.evolution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total" stroke="#1E3A5F" strokeWidth={2} name="Total" dot={false} />
            <Line type="monotone" dataKey="entrant" stroke="#2563EB" strokeWidth={2} name="Entrants" dot={false} />
            <Line type="monotone" dataKey="sortant" stroke="#8B5CF6" strokeWidth={2} name="Sortants" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Appels par statut">
        <CountTable rows={d.byStatus.map((s: any) => ({ key: CALL_STATUS_LABEL[s.key] ?? s.key, count: s.count }))} />
      </ChartCard>
      {period && <CallsPeriodModal period={period} onClose={() => setPeriod(null)} />}
    </div>
  );
}

/* ─── 7. Risques ─── */
export function RiskTab() {
  const { data } = useRiskAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  const aging = [
    { label: '0-30 j', montant: d.aging.b0_30 },
    { label: '31-60 j', montant: d.aging.b31_60 },
    { label: '61-90 j', montant: d.aging.b61_90 },
    { label: '+90 j', montant: d.aging.b90p },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Échéances en retard" value={`${formatCurrency(d.overdueTotal)} (${d.overdueCount})`} tone="text-red-600" />
        <Kpi label="Factures impayées" value={`${formatCurrency(d.unpaidAmount)} (${d.unpaidCount})`} tone="text-amber-600" />
        <Kpi label="Conventions expirant (30 j)" value={String(d.expiringSoon)} />
        <Kpi label="Charges en retard" value={`${formatCurrency(d.forecastOverdue)} (${d.forecastOverdueCount})`} />
      </div>
      <ChartCard title="Vieillissement des impayés (échéances en retard)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={aging} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Bar dataKey="montant" fill="#EF4444" radius={[3, 3, 0, 0]} name="Reste dû" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Comptes en solde négatif">
        {d.negativeAccounts.length === 0
          ? <p className="text-sm text-emerald-600">Aucun compte en solde négatif.</p>
          : <SimpleAmountTable rows={d.negativeAccounts.map((a: any) => ({ key: a.name, amount: a.balance }))} />}
      </ChartCard>
    </div>
  );
}

/* ─── 8. Recommandations ─── */
export function RecommendationsTab() {
  const { data } = useRecommendations();
  if (!data?.success) return <Loading />;
  const d = data.data;
  const toneOf = (s: string) => (s === 'high' ? 'danger' : s === 'medium' ? 'warning' : 'info') as any;
  const labelOf = (s: string) => (s === 'high' ? 'Élevé' : s === 'medium' ? 'Moyen' : 'Faible');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Taux de recouvrement" value={`${d.summary.collectionRate} %`} tone={d.summary.collectionRate < 80 ? 'text-amber-600' : 'text-emerald-600'} />
        <Kpi label="Trésorerie" value={formatCurrency(d.summary.treasuryBalance)} tone={d.summary.treasuryBalance < 0 ? 'text-red-600' : undefined} />
        <Kpi label="Échéances en retard" value={formatCurrency(d.summary.overdueAmount)} />
        <Kpi label="Impayés" value={formatCurrency(d.summary.unpaidAmount)} />
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Recommandations</h3>
        <div className="space-y-2">
          {d.recommendations.map((r: any, i: number) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
              <Badge variant={toneOf(r.severity)}>{labelOf(r.severity)}</Badge>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800">{r.title} <span className="text-xs font-normal text-slate-400">· {r.domain}</span></div>
                <div className="text-sm text-slate-500">{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── 9. Suivi prospects & clients (fréquence & plan de suivi) ─── */
const FOLLOWUP_STATE_LABEL: Record<string, string> = {
  NORMAL: 'Normal',
  NEGLIGE: 'Négligé',
  DANGER: 'Danger de perte',
  CRITIQUE: 'Situation critique',
};
const FOLLOWUP_STATE_VARIANT: Record<string, 'success' | 'warning' | 'purple' | 'danger'> = {
  NORMAL: 'success',
  NEGLIGE: 'warning',
  DANGER: 'purple',
  CRITIQUE: 'danger',
};
const FOLLOWUP_STATES = ['NORMAL', 'NEGLIGE', 'DANGER', 'CRITIQUE'] as const;
/** Valeur sentinelle du filtre « Non assigné », distincte de '' (placeholder « Tous »). */
const UNASSIGNED_VALUE = '__unassigned__';

interface FollowUpItem {
  id: number;
  reference: string;
  name: string;
  status: string;
  assignedToId: number | null;
  assignedTo: string | null;
  lastActionAt: string;
  daysSince: number;
  state: string;
}

const FOLLOWUP_EXPORT_COLUMNS: ExportColumn<FollowUpItem>[] = [
  { header: 'Référence', cell: (i) => i.reference },
  { header: 'Nom', cell: (i) => i.name },
  { header: 'Assigné à', cell: (i) => i.assignedTo ?? 'Non assigné' },
  { header: 'Dernière action', cell: (i) => formatDate(i.lastActionAt) },
  { header: "Jours d'inaction", cell: (i) => i.daysSince },
  { header: 'État', cell: (i) => FOLLOWUP_STATE_LABEL[i.state] ?? i.state },
];

// Rôles à vue complète des listes de suivi : seuls eux peuvent exporter/
// imprimer ET filtrer par utilisateur assigné (ce filtre n'a pas d'intérêt
// pour les rôles restreints, qui ne consultent déjà que leur propre périmètre
// affecté — AGENT, AGENT_TECHNIQUE, ACCOUNTANT, ASSISTANTE_DIRECTION, READONLY).
const FOLLOWUP_EXPORT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

function FollowUpBlock({
  title, entityLabel, items, counts, basePath,
}: {
  title: string;
  entityLabel: string;
  items: FollowUpItem[];
  counts: { key: string; count: number }[];
  basePath: '/prospects' | '/clients' | '/commissions/referrers';
}) {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canExport = FOLLOWUP_EXPORT_ROLES.includes(role);
  const [filter, setFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [printing, setPrinting] = useState(false);
  const countMap = Object.fromEntries(counts.map((c) => [c.key, c.count]));

  // Utilisateurs assignés effectivement présents dans la liste (dont « Non
  // assigné »), pour alimenter le filtre sans appel serveur supplémentaire.
  // « Non assigné » utilise une valeur sentinelle distincte de la chaîne vide
  // (réservée au placeholder « Tous les utilisateurs ») pour éviter toute
  // collision entre « aucun filtre » et « filtrer sur les non-assignés ».
  const userOptions = Array.from(
    new Map(
      items.map((i) => [i.assignedToId != null ? String(i.assignedToId) : UNASSIGNED_VALUE, i.assignedTo ?? 'Non assigné']),
    ).entries(),
  )
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));

  const filtered = items
    .filter((i) => !filter || i.state === filter)
    .filter((i) => {
      if (!userFilter) return true;
      if (userFilter === UNASSIGNED_VALUE) return i.assignedToId == null;
      return String(i.assignedToId) === userFilter;
    });

  const fileName = `suivi-${entityLabel}s`.replace(/\s+/g, '-').toLowerCase();

  const handlePrint = async () => {
    if (filtered.length === 0) { toast.error('Aucune ligne à imprimer'); return; }
    setPrinting(true);
    try {
      const matrix = filtered.map((row) =>
        FOLLOWUP_EXPORT_COLUMNS.map((col) => {
          const v = col.cell(row);
          return v === null || v === undefined ? '' : String(v);
        }),
      );
      const pr = await window.electron.exporter.print(token, {
        fileName,
        title,
        headers: FOLLOWUP_EXPORT_COLUMNS.map((col) => col.header),
        rows: matrix,
      });
      if (!pr.success) toast.error(typeof pr.error === 'string' ? pr.error : "Erreur lors de l'impression");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'impression");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {FOLLOWUP_STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(filter === s ? '' : s)}
              className={`rounded-full transition ${filter === s ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
            >
              <Badge variant={FOLLOWUP_STATE_VARIANT[s]}>{FOLLOWUP_STATE_LABEL[s]} ({countMap[s] ?? 0})</Badge>
            </button>
          ))}
        </div>
      </div>
      {canExport && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="w-56">
            <Select
              label="Filtrer par utilisateur assigné"
              placeholder="Tous les utilisateurs"
              options={userOptions}
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <ExportMenu
              fileName={fileName}
              title={title}
              columns={FOLLOWUP_EXPORT_COLUMNS}
              fetchRows={async () => filtered}
            />
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} loading={printing} onClick={handlePrint}>
              Imprimer
            </Button>
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun {entityLabel} dans cette catégorie.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th className="py-1.5">Référence</th>
                <th>Nom</th>
                <th>Assigné à</th>
                <th>Dernière action</th>
                <th className="text-center">Jours d'inaction</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((i) => (
                <tr key={i.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`${basePath}/${i.id}/timeline`)}>
                  <td className="py-1.5 font-mono text-xs">{i.reference}</td>
                  <td className="text-slate-800">{i.name || '—'}</td>
                  <td className="text-slate-500">{i.assignedTo ?? '—'}</td>
                  <td className="text-slate-500">{formatDate(i.lastActionAt)}</td>
                  <td className="text-center font-medium tabular-nums">{i.daysSince}</td>
                  <td><Badge variant={FOLLOWUP_STATE_VARIANT[i.state]}>{FOLLOWUP_STATE_LABEL[i.state]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function ProspectFollowUpTab() {
  const { data } = useFollowUpAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <ChartCard title="Fréquence des actions de suivi sur prospects (12 mois)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={d.frequency} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="prospectActions" stroke="#8B5CF6" strokeWidth={2} name="Actions sur prospects" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <FollowUpBlock
        title="Prospects — plan de suivi (hors « Perdu »)"
        entityLabel="prospect"
        items={d.prospects.items}
        counts={d.prospects.counts}
        basePath="/prospects"
      />
    </div>
  );
}

export function ClientFollowUpTab() {
  const { data } = useFollowUpAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <ChartCard title="Fréquence des actions de suivi sur clients (12 mois)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={d.frequency} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="clientActions" stroke="#2563EB" strokeWidth={2} name="Actions sur clients" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <FollowUpBlock
        title="Clients — plan de suivi (hors « Suspendu »)"
        entityLabel="client"
        items={d.clients.items}
        counts={d.clients.counts}
        basePath="/clients"
      />
    </div>
  );
}

export function ReferrerFollowUpTab() {
  const { data } = useFollowUpAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <ChartCard title="Fréquence des actions de suivi sur apporteurs d'affaire (12 mois)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={d.frequency} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="referrerActions" stroke="#059669" strokeWidth={2} name="Actions sur apporteurs" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <FollowUpBlock
        title="Apporteurs d'affaire — plan de suivi (hors inactifs)"
        entityLabel="apporteur d'affaire"
        items={d.referrers.items}
        counts={d.referrers.counts}
        basePath="/commissions/referrers"
      />
    </div>
  );
}

/* ─── Helpers de rendu ─── */
function PieBlock({ data, onSliceClick }: { data: { key: string; count: number }[]; onSliceClick?: (key: string) => void }) {
  const rows = data.filter((d) => d.count > 0);
  if (rows.length === 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={rows} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={80}
          label={(e: any) => `${e.key} (${e.count})`}
          onClick={onSliceClick ? (entry: any) => onSliceClick(entry.key) : undefined}
          style={onSliceClick ? { cursor: 'pointer' } : undefined}
        >
          {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function CountBar({ data }: { data: { key: string; count: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="key" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#2563EB" radius={[3, 3, 0, 0]} name="Nombre" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CountTable({ rows }: { rows: { key: string; count: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.key}><td className="py-1.5 text-slate-700">{r.key}</td><td className="py-1.5 text-right font-medium">{r.count}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function SimpleAmountTable({ rows }: { rows: { key: string; amount: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>;
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.key}><td className="py-1.5 text-slate-700">{r.key}</td><td className="py-1.5 text-right font-medium tabular-nums">{formatCurrency(r.amount)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
