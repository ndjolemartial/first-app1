import PageLayout from '../../../shared/components/layout/PageLayout';
import { RiskTab } from '../components/AnalyticsSections';

export default function AnalyticsRiskPage() {
  return (
    <PageLayout
      title="Risques"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Risques' }]}
    >
      <RiskTab />
    </PageLayout>
  );
}
