import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import { useAmlDashboard } from '../hooks/useAml';
import { RISK_LEVEL_LABEL } from '../utils/aml.utils';

export default function AmlDashboardPage() {
  const { data } = useAmlDashboard();
  const overview = data?.data;

  return (
    <PageLayout title="Conformité LBC/FT — Tableau de bord" breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Tableau de bord' }]}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(['FAIBLE', 'MOYEN', 'ELEVE'] as const).map((level) => (
          <Card key={level} className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Profils — risque {RISK_LEVEL_LABEL[level]}</span>
            <span className="text-xl font-bold text-slate-900">{overview?.byRiskLevel?.[level] ?? 0}</span>
          </Card>
        ))}
        <Card className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Personnes politiquement exposées</span>
          <span className="text-xl font-bold text-slate-900">{overview?.pepCount ?? 0}</span>
        </Card>
        <Card className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Correspondances à vérifier</span>
          <span className="text-xl font-bold text-slate-900">{overview?.matchesToVerify ?? 0}</span>
        </Card>
        <Card className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Revues de transaction ouvertes</span>
          <span className="text-xl font-bold text-slate-900">{overview?.reviewsOpen ?? 0}</span>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Déclarations de soupçon par statut</h3>
        <div className="grid grid-cols-4 gap-3">
          {['BROUILLON', 'VALIDEE_INTERNE', 'TRANSMISE_CENTIF', 'CLASSEE_SANS_SUITE'].map((s) => (
            <div key={s} className="rounded-lg bg-slate-50 p-3 text-center">
              <div className="text-2xl font-bold text-slate-900">{overview?.reportsByStatus?.[s] ?? 0}</div>
              <div className="text-xs text-slate-500">{s}</div>
            </div>
          ))}
        </div>
      </Card>
    </PageLayout>
  );
}
