import PageLayout from '../../../shared/components/layout/PageLayout';
import { CallsTab } from '../components/AnalyticsSections';

export default function AnalyticsCallsPage() {
  return (
    <PageLayout
      title="Statistiques appels"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Statistiques appels' }]}
    >
      <CallsTab />
    </PageLayout>
  );
}
