import PageLayout from '../../../shared/components/layout/PageLayout';
import { RecommendationsTab } from '../components/AnalyticsSections';

export default function AnalyticsRecommendationsPage() {
  return (
    <PageLayout
      title="Recommandations"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Recommandations' }]}
    >
      <RecommendationsTab />
    </PageLayout>
  );
}
