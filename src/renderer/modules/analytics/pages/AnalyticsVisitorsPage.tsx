import PageLayout from '../../../shared/components/layout/PageLayout';
import { VisitorsTab } from '../components/AnalyticsSections';

export default function AnalyticsVisitorsPage() {
  return (
    <PageLayout
      title="Statistiques visiteurs"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Statistiques visiteurs' }]}
    >
      <VisitorsTab />
    </PageLayout>
  );
}
