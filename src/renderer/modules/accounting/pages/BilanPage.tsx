import { useMemo, useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatCurrency } from '../../../shared/utils/format';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  FileSpreadsheet, FileText, TrendingUp, TrendingDown, Wallet, ChevronDown, ChevronUp, BarChart3, Scale,
} from 'lucide-react';
import {
  useBilanResultat, useBilanActifPassif, useExportBilan,
  type BilanScope, type BilanPeriodType, type ResultatFilters, type ActifPassifFilters,
} from '../hooks/useBilan';
import { useLotissements } from '../../lotissements/hooks/useLotissements';
import { useProgrammes } from '../../programmes/hooks/useProgrammes';
import { useOwners } from '../../owners/hooks/useOwners';
import { useAuthStore } from '../../../shared/stores/auth.store';

/**
 * Rôles ayant accès aux vues « direction » du bilan : onglet Actif/Passif et
 * historique d'évolution complet (jusqu'à 12 mois). Les rôles MANAGER /
 * ACCOUNTANT voient désormais le graphique d'évolution et l'incluent dans
 * l'export, mais limité aux 6 derniers mois (borné côté backend).
 */
const DIRECTION_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

// ── Constantes UI ────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 'month',      label: 'Ce mois' },
  { value: 'last-month', label: 'Mois dernier' },
  { value: 'quarter',    label: 'Ce trimestre' },
  { value: 'semester',   label: 'Ce semestre' },
  { value: 'year',       label: 'Cette année' },
  { value: 'custom',     label: 'Période personnalisée' },
];

/** Périodes accessibles hors direction : court / moyen terme. */
const RESTRICTED_PERIODS = new Set<BilanPeriodType>(['month', 'last-month', 'quarter', 'semester']);

const SCOPE_OPTIONS = [
  { value: 'global',      label: 'Global (toute l\'entreprise)' },
  { value: 'lotissement', label: 'Par lotissement' },
  { value: 'programme',   label: 'Par programme immobilier' },
  { value: 'owner',       label: 'Par propriétaire' },
];

const PIE_COLORS = ['#1E3A5F', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#EFF6FF'];

// ── Composants ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, variant, icon: Icon }: {
  label: string; value: number; variant: 'recettes' | 'depenses' | 'resultat'; icon: React.ComponentType<{ className?: string }>;
}) {
  const tone = variant === 'recettes'
    ? { box: 'bg-emerald-50', text: 'text-emerald-700', val: 'text-emerald-900' }
    : variant === 'depenses'
      ? { box: 'bg-rose-50', text: 'text-rose-700', val: 'text-rose-900' }
      : { box: value >= 0 ? 'bg-blue-50' : 'bg-amber-50',
          text: value >= 0 ? 'text-blue-700' : 'text-amber-700',
          val:  value >= 0 ? 'text-blue-900' : 'text-amber-900' };
  return (
    <Card padding={false} className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`rounded-lg p-2 ${tone.box}`}>
          <Icon className={`h-4 w-4 ${tone.text}`} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${tone.val}`}>{formatCurrency(value)}</p>
    </Card>
  );
}

function SectionTable({ title, rows, total, emptyMsg }: {
  title: string;
  rows: Array<{ label: string; montant: number }>;
  total?: number;
  emptyMsg?: string;
}) {
  const t = total ?? rows.reduce((s, r) => s + r.montant, 0);
  return (
    <Card padding={false} className="overflow-hidden">
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50/50">
          <tr>
            <th className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 px-4 py-2">Catégorie</th>
            <th className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500 px-4 py-2">Montant</th>
            <th className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500 px-4 py-2 w-20">Part</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="text-center text-slate-400 italic py-6">{emptyMsg ?? 'Aucune donnée'}</td></tr>
          ) : rows.map((r) => (
            <tr key={r.label} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-slate-700">{r.label}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-900 font-medium">{formatCurrency(r.montant)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-500 text-xs">
                {t > 0 ? `${((r.montant / t) * 100).toFixed(1)} %` : '—'}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-100 font-bold">
            <td className="px-4 py-2 text-slate-800">TOTAL</td>
            <td className="px-4 py-2 text-right tabular-nums text-slate-900">{formatCurrency(t)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-slate-500 text-xs">100 %</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

function BilanSection({ title, items, total }: {
  title: string;
  items: Array<{ label: string; montant: number }>;
  total: number;
}) {
  return (
    <>
      <tr className="bg-slate-50">
        <td className="px-4 py-2 font-semibold text-slate-700 text-sm">{title}</td>
        <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-700 text-sm">{formatCurrency(total)}</td>
      </tr>
      {items.length === 0 ? (
        <tr><td colSpan={2} className="px-4 py-1.5 text-center text-slate-400 italic text-xs">—</td></tr>
      ) : items.map((it, i) => (
        <tr key={`${title}-${i}`} className="hover:bg-slate-50">
          <td className="px-4 py-1.5 pl-8 text-slate-600 text-xs">{it.label}</td>
          <td className="px-4 py-1.5 text-right tabular-nums text-slate-700 text-xs">{formatCurrency(it.montant)}</td>
        </tr>
      ))}
    </>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────

export default function BilanPage() {
  const userRole = useAuthStore((s) => s.user?.role ?? '');
  const isDirector = DIRECTION_ROLES.has(userRole);
  const [tab, setTab] = useState<'resultat' | 'actif-passif'>('resultat');
  const [scope, setScope] = useState<BilanScope>('global');
  const [scopeId, setScopeId] = useState<number | undefined>(undefined);
  const [periodType, setPeriodType] = useState<BilanPeriodType>('month');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [showMethod, setShowMethod] = useState(false);

  // Listes pour le sélecteur d'entité (chargées uniquement quand pertinent).
  const lotissements = useLotissements({}, 1, 200);
  const programmes   = useProgrammes({}, 1, 200);
  const owners       = useOwners({}, 1, 500);

  const entityOptions = useMemo(() => {
    if (scope === 'lotissement') {
      const items = (lotissements.data?.data ?? []) as any[];
      return [
        { value: '', label: 'Sélectionnez un lotissement' },
        ...items.map((l) => ({ value: String(l.id), label: `${l.reference} — ${l.nom}` })),
      ];
    }
    if (scope === 'programme') {
      const items = (programmes.data?.data ?? []) as any[];
      return [
        { value: '', label: 'Sélectionnez un programme' },
        ...items.map((p) => ({ value: String(p.id), label: `${p.reference} — ${p.nom}` })),
      ];
    }
    if (scope === 'owner') {
      const items = (owners.data?.data ?? []) as any[];
      return [
        { value: '', label: 'Sélectionnez un propriétaire' },
        ...items.map((o) => ({
          value: String(o.id),
          label: o.type === 'ENTREPRISE'
            ? (o.companyName ?? `Propriétaire #${o.id}`)
            : `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim(),
        })),
      ];
    }
    return [];
  }, [scope, lotissements.data, programmes.data, owners.data]);

  // ── Requêtes ──────────────────────────────────────────────────────────────

  const resultatFilters: ResultatFilters = {
    periodType, scope, scopeId,
    periodStart: periodType === 'custom' ? periodStart : undefined,
    periodEnd:   periodType === 'custom' ? periodEnd   : undefined,
  };
  const resultatQuery = useBilanResultat(resultatFilters);

  const actifPassifFilters: ActifPassifFilters = { asOfDate, scope, scopeId };
  const actifPassifQuery = useBilanActifPassif(actifPassifFilters, isDirector);

  const exporter = useExportBilan();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleScopeChange = (v: string) => {
    setScope(v as BilanScope);
    setScopeId(undefined);
  };

  const triggerExport = (format: 'pdf' | 'xlsx') => {
    if (tab === 'resultat') {
      const d = resultatQuery.data?.data;
      if (!d) return;
      // L'évolution est désormais affichée pour tous les rôles ayant accès au
      // bilan et incluse telle quelle dans l'export. Le backend la borne déjà
      // aux 6 derniers mois pour MANAGER / ACCOUNTANT.
      exporter.mutate({
        type: 'resultat', format, data: d,
        meta: {
          title:    `Compte de résultat — ${d.periode.label}`,
          subtitle: `Édité le ${new Date().toLocaleDateString('fr-FR')}`,
          scope:    d.scope.label,
        },
      });
    } else {
      const d = actifPassifQuery.data?.data;
      if (!d) return;
      const dateStr = new Date(d.asOfDate).toLocaleDateString('fr-FR');
      exporter.mutate({
        type: 'actif-passif', format, data: d,
        meta: {
          title:    `Bilan Actif/Passif au ${dateStr}`,
          subtitle: `Édité le ${new Date().toLocaleDateString('fr-FR')}`,
          scope:    d.scope.label,
        },
      });
    }
  };

  // ── Données dérivées pour les graphiques ──────────────────────────────────

  const resultat = resultatQuery.data?.data;
  const evolutionChart = useMemo(() =>
    (resultat?.evolution ?? []).map((e) => ({
      name: e.label,
      Recettes: e.recettes,
      Dépenses: e.depenses,
      Résultat: e.resultat,
    })), [resultat]);

  // Titre du graphique : la direction voit l'historique complet ; pour les
  // autres rôles, la série est bornée aux 6 dernières sous-périodes — on précise
  // donc l'unité réelle (mois / trimestres / semestres) selon la période choisie.
  const evolutionTitle = isDirector
    ? 'Évolution'
    : periodType === 'quarter'
      ? 'Évolution (6 derniers trimestres)'
      : periodType === 'semester'
        ? 'Évolution (6 derniers semestres)'
        : 'Évolution (6 derniers mois)';

  const recettesPie = useMemo(() =>
    (resultat?.recettes ?? []).slice(0, 8).map((r) => ({ name: r.categorie, value: r.montant })),
    [resultat]);

  const actifPassif = actifPassifQuery.data?.data;
  const equilibreDelta = actifPassif ? actifPassif.totalActif - actifPassif.totalPassif : 0;
  const equilibreOk = Math.abs(equilibreDelta) < 1;

  // ── Rendu ────────────────────────────────────────────────────────────────

  const scopeIncomplete = scope !== 'global' && !scopeId;
  const isLoading = tab === 'resultat' ? resultatQuery.isLoading : actifPassifQuery.isLoading;
  const error = tab === 'resultat' ? resultatQuery.data?.error : actifPassifQuery.data?.error;

  return (
    <PageLayout
      title="Bilan comptable"
      breadcrumbs={[{ label: 'Comptabilité', to: '/accounting' }, { label: 'Bilan' }]}
      actions={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<FileText className="h-4 w-4" />}
            onClick={() => triggerExport('pdf')}
            disabled={scopeIncomplete || isLoading || exporter.isPending}
            loading={exporter.isPending && exporter.variables?.format === 'pdf'}
          >
            Exporter PDF
          </Button>
          <Button
            variant="secondary"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={() => triggerExport('xlsx')}
            disabled={scopeIncomplete || isLoading || exporter.isPending}
            loading={exporter.isPending && exporter.variables?.format === 'xlsx'}
          >
            Exporter Excel
          </Button>
        </div>
      }
    >
      {/* ── Onglets ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-slate-200 mb-6">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'resultat' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setTab('resultat')}
        >
          <BarChart3 className="h-4 w-4" /> Compte de résultat
        </button>
        {isDirector && (
          <button
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'actif-passif' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setTab('actif-passif')}
          >
            <Scale className="h-4 w-4" /> Bilan Actif/Passif
          </button>
        )}
      </div>

      {/* ── Barre de filtres ────────────────────────────────────────────── */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Select
            label="Périmètre"
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={(e) => handleScopeChange(e.target.value)}
          />
          {scope !== 'global' && (
            <Select
              label={scope === 'lotissement' ? 'Lotissement' : scope === 'programme' ? 'Programme' : 'Propriétaire'}
              options={entityOptions}
              value={scopeId ? String(scopeId) : ''}
              onChange={(e) => setScopeId(e.target.value ? Number(e.target.value) : undefined)}
            />
          )}
          {tab === 'resultat' ? (
            <>
              <Select
                label="Période"
                options={isDirector ? PERIOD_OPTIONS : PERIOD_OPTIONS.filter((o) => RESTRICTED_PERIODS.has(o.value as BilanPeriodType))}
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as BilanPeriodType)}
              />
              {periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" label="Du" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                  <Input type="date" label="Au" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              )}
            </>
          ) : (
            <Input
              type="date"
              label="Date d'arrêté"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          )}
        </div>
      </Card>

      {scopeIncomplete && (
        <Card><p className="text-slate-500 text-sm italic">Sélectionnez une entité pour afficher le bilan.</p></Card>
      )}

      {!scopeIncomplete && error && (
        <Card><p className="text-rose-600 text-sm">Erreur : {typeof error === 'string' ? error : 'données indisponibles'}</p></Card>
      )}

      {!scopeIncomplete && isLoading && <Card><SkeletonTable rows={8} /></Card>}

      {/* ── Onglet : Compte de résultat ─────────────────────────────────── */}
      {!scopeIncomplete && !isLoading && tab === 'resultat' && resultat && (
        <>
          <div className="mb-4 text-sm text-slate-500">
            Période : <strong className="text-slate-700">{resultat.periode.label}</strong>
            {' · '}
            Périmètre : <strong className="text-slate-700">{resultat.scope.label}</strong>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KpiCard label="Recettes"      value={resultat.totalRecettes} variant="recettes" icon={TrendingUp}   />
            <KpiCard label="Dépenses"      value={resultat.totalDepenses} variant="depenses" icon={TrendingDown} />
            <KpiCard label="Résultat net"  value={resultat.resultat}      variant="resultat" icon={Wallet}       />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{evolutionTitle}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={evolutionChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v as number)} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Recettes" fill="#10b981" />
                  <Bar dataKey="Dépenses" fill="#f43f5e" />
                  <Line type="monotone" dataKey="Résultat" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Répartition des recettes</h3>
              {recettesPie.length === 0 ? (
                <p className="text-slate-400 italic text-sm text-center py-10">Aucune recette</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={recettesPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                      {recettesPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionTable
              title="Recettes par catégorie"
              rows={resultat.recettes.map((r) => ({ label: r.categorie, montant: r.montant }))}
              total={resultat.totalRecettes}
              emptyMsg="Aucune recette sur la période"
            />
            <SectionTable
              title="Dépenses par catégorie"
              rows={resultat.depenses.map((d) => ({ label: d.categorie, montant: d.montant }))}
              total={resultat.totalDepenses}
              emptyMsg="Aucune dépense sur la période"
            />
          </div>
        </>
      )}

      {/* ── Onglet : Bilan Actif/Passif ─────────────────────────────────── */}
      {!scopeIncomplete && !isLoading && tab === 'actif-passif' && actifPassif && (
        <>
          <div className="mb-4 text-sm text-slate-500">
            Date d'arrêté : <strong className="text-slate-700">{new Date(actifPassif.asOfDate).toLocaleDateString('fr-FR')}</strong>
            {' · '}
            Périmètre : <strong className="text-slate-700">{actifPassif.scope.label}</strong>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card padding={false} className="overflow-hidden">
              <div className="bg-slate-800 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-white">ACTIF</h3>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <BilanSection title="Immobilisations"      items={actifPassif.actif.immobilisations} total={actifPassif.actif.totalImmobilisations} />
                  <BilanSection title="Créances clients"     items={actifPassif.actif.creances}        total={actifPassif.actif.totalCreances} />
                  <BilanSection title="Échéances à recevoir" items={actifPassif.actif.echeances}       total={actifPassif.actif.totalEcheances} />
                  <BilanSection title="Trésorerie"           items={actifPassif.actif.tresorerie}      total={actifPassif.actif.totalTresorerie} />
                  <tr className="bg-blue-50 font-bold">
                    <td className="px-4 py-2.5 text-blue-900">TOTAL ACTIF</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-900">{formatCurrency(actifPassif.totalActif)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <Card padding={false} className="overflow-hidden">
              <div className="bg-slate-800 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-white">PASSIF</h3>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50">
                    <td className="px-4 py-2 font-semibold text-slate-700 text-sm">Capitaux propres</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-700 text-sm">{formatCurrency(actifPassif.passif.capitauxPropres)}</td>
                  </tr>
                  <BilanSection title="Cautions reçues"      items={actifPassif.passif.cautions}            total={actifPassif.passif.totalCautions} />
                  <BilanSection title="Avances reçues"       items={actifPassif.passif.avances}             total={actifPassif.passif.totalAvances} />
                  <BilanSection title="Dettes propriétaires" items={actifPassif.passif.dettesProprietaires} total={actifPassif.passif.totalDettesProprietaires} />
                  <tr className="bg-blue-50 font-bold">
                    <td className="px-4 py-2.5 text-blue-900">TOTAL PASSIF</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-900">{formatCurrency(actifPassif.totalPassif)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>

          <Card className={equilibreOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
            <div className="flex items-center gap-3">
              <Scale className={`h-5 w-5 ${equilibreOk ? 'text-emerald-700' : 'text-amber-700'}`} />
              <div>
                <p className={`text-sm font-semibold ${equilibreOk ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {equilibreOk ? 'Bilan équilibré' : 'Bilan déséquilibré'}
                </p>
                <p className={`text-xs ${equilibreOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {equilibreOk
                    ? 'Total Actif = Total Passif (bouclage par les capitaux propres).'
                    : `Écart de ${formatCurrency(Math.abs(equilibreDelta))} entre Actif et Passif.`}
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ── Encart méthodologie ──────────────────────────────────────────── */}
      {!scopeIncomplete && !isLoading && (
        <Card className="mt-6">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            onClick={() => setShowMethod(!showMethod)}
          >
            {showMethod ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Méthodologie de calcul
          </button>
          {showMethod && (
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p>
                <strong>Recettes</strong> — paiements de factures sur la période, factures payées sans paiement
                explicite, et opérations de trésorerie d'entrée manuelles (non liées à une facture).
              </p>
              <p>
                <strong>Dépenses</strong> — toutes les sorties de trésorerie sur la période, regroupées par
                catégorie d'opération.
              </p>
              <p>
                <strong>Immobilisations</strong> — biens et terrains non vendus à la valeur de vente indicative
                (<em>salePrice</em>). Pas d'amortissement comptabilisé.
              </p>
              <p>
                <strong>Capitaux propres</strong> — ligne de bouclage (Total Actif − autres passifs). Ce bilan
                n'est pas une comptabilité d'engagement.
              </p>
              <p>
                <strong>Dettes propriétaires</strong> — calculées par approximation : paiements clients sur les
                conventions liées au propriétaire, moins les frais de gestion facturés, moins les sorties de
                trésorerie dont la catégorie contient « reversement ».
              </p>
              <p>
                <strong>Périmètre analytique</strong> — sur scope ≠ global, les opérations de trésorerie
                manuelles non rattachées à une convention/paiement n'apparaissent pas dans le périmètre.
              </p>
              <p className="text-slate-400 italic pt-2 border-t border-slate-100">
                Ce bilan est un outil de pilotage interne. Pour un bilan SYSCOA certifié, prévoir une seconde
                itération avec amortissements, modèle de reversement structuré et export DGI.
              </p>
            </div>
          )}
        </Card>
      )}
    </PageLayout>
  );
}
