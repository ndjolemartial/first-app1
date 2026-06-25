import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import {
  LayoutDashboard, TrendingUp, Building2, Users, ReceiptText, FileText, AlertTriangle, Lightbulb,
} from 'lucide-react';
import {
  useExecutiveAnalytics, useFinancialAnalytics, usePortfolioAnalytics, useCrmAnalytics,
  useChargesAnalytics, useContractsAnalytics, useRiskAnalytics, useRecommendations,
} from '../hooks/useAnalytics';

const PALETTE = ['#1E3A5F', '#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B', '#14B8A6'];
const fmtK = (v: number) => `${(v / 1000).toFixed(0)}k`;

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${tone ?? 'text-slate-900'}`}>{value}</span>
    </Card>
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
function ExecutiveTab() {
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
function FinancialTab() {
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
function PortfolioTab() {
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
function CrmTab() {
  const { data } = useCrmAnalytics();
  if (!data?.success) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Prospects" value={String(d.prospectsTotal)} />
        <Kpi label="Convertis" value={String(d.converted)} tone="text-emerald-600" />
        <Kpi label="Taux de conversion" value={`${d.conversionRate} %`} />
        <Kpi label="Locataires (baux actifs)" value={String(d.locataires)} />
        <Kpi label="Souscripteurs (ventes actives)" value={String(d.souscripteurs)} />
        <Kpi label="Rappels en attente" value={String(d.activitiesPending)} />
        <Kpi label="Rappels en retard" value={String(d.activitiesOverdue)} tone={d.activitiesOverdue ? 'text-red-600' : undefined} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Pipeline prospects (statut)">
          <CountBar data={d.prospectsByStatus} />
        </ChartCard>
        <ChartCard title="Prospects par source">
          <PieBlock data={d.prospectsBySource} />
        </ChartCard>
      </div>
      <ChartCard title="Clients par type">
        <CountTable rows={d.clientsByType} />
      </ChartCard>
    </div>
  );
}

/* ─── 5. Charges ─── */
function ChargesTab() {
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
function ContractsTab() {
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

/* ─── 7. Risques ─── */
function RiskTab() {
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
function RecommendationsTab() {
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

/* ─── Helpers de rendu ─── */
function PieBlock({ data }: { data: { key: string; count: number }[] }) {
  const rows = data.filter((d) => d.count > 0);
  if (rows.length === 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={rows} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.key} (${e.count})`}>
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

const TABS = [
  { key: 'executive', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" />, comp: <ExecutiveTab /> },
  { key: 'financial', label: 'Finance & rentabilité', icon: <TrendingUp className="h-4 w-4" />, comp: <FinancialTab /> },
  { key: 'portfolio', label: 'Portefeuille', icon: <Building2 className="h-4 w-4" />, comp: <PortfolioTab /> },
  { key: 'crm', label: 'CRM & clients', icon: <Users className="h-4 w-4" />, comp: <CrmTab /> },
  { key: 'charges', label: 'Charges', icon: <ReceiptText className="h-4 w-4" />, comp: <ChargesTab /> },
  { key: 'contracts', label: 'Contractuel', icon: <FileText className="h-4 w-4" />, comp: <ContractsTab /> },
  { key: 'risk', label: 'Risques', icon: <AlertTriangle className="h-4 w-4" />, comp: <RiskTab /> },
  { key: 'reco', label: 'Recommandations', icon: <Lightbulb className="h-4 w-4" />, comp: <RecommendationsTab /> },
];

export default function AnalyticsPage() {
  const [active, setActive] = useState('executive');
  const current = TABS.find((t) => t.key === active) ?? TABS[0];
  return (
    <PageLayout title="Analyses décisionnelles" breadcrumbs={[{ label: 'Analyses décisionnelles' }]}>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
              active === t.key ? 'border-[#2563EB] text-[#1E3A5F]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {current.comp}
    </PageLayout>
  );
}
