import PageLayout from '../../../shared/components/layout/PageLayout';
import { ExecutiveTab } from '../components/AnalyticsSections';

export default function AnalyticsExecutivePage() {
  return (
    <PageLayout
      title="Tableau de bord"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Tableau de bord' }]}
    >
      <ExecutiveTab />
    </PageLayout>
  );
}
