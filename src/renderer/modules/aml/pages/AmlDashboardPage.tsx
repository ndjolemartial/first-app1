import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import { useAmlDashboard } from '../hooks/useAml';
import { RISK_LEVEL_LABEL, REPORT_STATUS_LABEL } from '../utils/aml.utils';
import {
  ShieldCheck, ShieldAlert, ShieldX, UserRound, ListChecks, Radar, ScanEye,
  BellRing, ScanSearch, Target, FileWarning,
} from 'lucide-react';

/* ─── Palette de sections ─────────────────────────────────────── */
type Tone = 'indigo' | 'amber' | 'blue' | 'rose';

const SECTION: Record<Tone, { border: string; accent: string; head: string }> = {
  indigo: { border: 'border-indigo-200', accent: 'border-l-indigo-500', head: 'border-indigo-200 bg-indigo-50 text-indigo-900' },
  amber: { border: 'border-amber-200', accent: 'border-l-amber-500', head: 'border-amber-200 bg-amber-50 text-amber-900' },
  blue: { border: 'border-blue-200', accent: 'border-l-blue-500', head: 'border-blue-200 bg-blue-50 text-blue-900' },
  rose: { border: 'border-rose-200', accent: 'border-l-rose-500', head: 'border-rose-200 bg-rose-50 text-rose-900' },
};

function Section({ tone, title, subtitle, children }: {
  tone: Tone; title: string; subtitle?: string; children: React.ReactNode;
}) {
  const s = SECTION[tone];
  return (
    <Card className={`mb-5 overflow-hidden border-l-4 ${s.border} ${s.accent}`} padding={false}>
      <div className={`border-b px-4 py-2.5 text-sm font-semibold ${s.head}`}>
        {title}
        {subtitle && <span className="ml-2 font-normal opacity-70">— {subtitle}</span>}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

/* ─── Tuile compteur ──────────────────────────────────────────── */
type TileColor = 'emerald' | 'amber' | 'rose' | 'purple' | 'blue' | 'slate';

const TILE: Record<TileColor, { bg: string; icon: string; value: string }> = {
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', value: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-500', value: 'text-amber-700' },
  rose: { bg: 'bg-rose-50', icon: 'text-rose-500', value: 'text-rose-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-500', value: 'text-purple-700' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-500', value: 'text-blue-700' },
  slate: { bg: 'bg-slate-50', icon: 'text-slate-400', value: 'text-slate-800' },
};

function Tile({ color, icon, label, value }: {
  color: TileColor; icon: React.ReactNode; label: string; value: number | undefined;
}) {
  const t = TILE[color];
  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 ${t.bg}`}>
      <span className={t.icon}>{icon}</span>
      <div className="min-w-0">
        <div className={`text-2xl font-bold ${t.value}`}>{value ?? 0}</div>
        <div className="text-xs leading-tight text-slate-500">{label}</div>
      </div>
    </div>
  );
}

const RISK_TILE: Record<string, { color: TileColor; icon: React.ReactNode }> = {
  FAIBLE: { color: 'emerald', icon: <ShieldCheck className="h-5 w-5" /> },
  MOYEN: { color: 'amber', icon: <ShieldAlert className="h-5 w-5" /> },
  ELEVE: { color: 'rose', icon: <ShieldX className="h-5 w-5" /> },
};

const REPORT_TILE_COLOR: Record<string, TileColor> = {
  BROUILLON: 'slate',
  VALIDEE_INTERNE: 'amber',
  TRANSMISE_CENTIF: 'blue',
  CLASSEE_SANS_SUITE: 'emerald',
};

const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('fr-FR') : null);

export default function AmlDashboardPage() {
  const { data } = useAmlDashboard();
  const overview = data?.data;
  const lastScreening = fmtDateTime(overview?.lastScreeningAt);

  return (
    <PageLayout title="Conformité LBC/FT — Tableau de bord" breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Tableau de bord' }]}>
      {/* ── Profils de vigilance ── */}
      <Section tone="indigo" title="Profils de vigilance">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(['FAIBLE', 'MOYEN', 'ELEVE'] as const).map((level) => (
            <Tile
              key={level}
              color={RISK_TILE[level].color}
              icon={RISK_TILE[level].icon}
              label={`Profils — risque ${RISK_LEVEL_LABEL[level]}`}
              value={overview?.byRiskLevel?.[level]}
            />
          ))}
          <Tile color="purple" icon={<UserRound className="h-5 w-5" />}
            label="Personnes politiquement exposées" value={overview?.pepCount} />
        </div>
      </Section>

      {/* ── Files à traiter ── */}
      <Section tone="amber" title="À traiter" subtitle="files d'attente">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile color="amber" icon={<ListChecks className="h-5 w-5" />}
            label="Correspondances de vigilance à vérifier" value={overview?.matchesToVerify} />
          <Tile color="amber" icon={<ScanEye className="h-5 w-5" />}
            label="Correspondances de criblage à vérifier" value={overview?.screeningHitsToVerify} />
          <Tile color="amber" icon={<Radar className="h-5 w-5" />}
            label="Revues de transaction ouvertes" value={overview?.reviewsOpen} />
        </div>
      </Section>

      {/* ── Alertes, Criblages & Correspondances ── */}
      <Section
        tone="blue"
        title="Alertes, Criblages & Correspondances"
        subtitle={lastScreening ? `dernier criblage le ${lastScreening}` : undefined}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile color="blue" icon={<BellRing className="h-5 w-5" />}
            label="Nombre d'alertes" value={overview?.alertsCount} />
          <Tile color="blue" icon={<ScanSearch className="h-5 w-5" />}
            label="Nombre de criblages" value={overview?.screeningRunsCount} />
          <Tile color="blue" icon={<Target className="h-5 w-5" />}
            label="Nombre de correspondances" value={overview?.screeningHitsCount} />
        </div>
      </Section>

      {/* ── Déclarations de soupçon ── */}
      <Section tone="rose" title="Déclarations de soupçon" subtitle="par statut">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(['BROUILLON', 'VALIDEE_INTERNE', 'TRANSMISE_CENTIF', 'CLASSEE_SANS_SUITE'] as const).map((s) => (
            <Tile
              key={s}
              color={REPORT_TILE_COLOR[s]}
              icon={<FileWarning className="h-5 w-5" />}
              label={REPORT_STATUS_LABEL[s] ?? s}
              value={overview?.reportsByStatus?.[s]}
            />
          ))}
        </div>
      </Section>
    </PageLayout>
  );
}
