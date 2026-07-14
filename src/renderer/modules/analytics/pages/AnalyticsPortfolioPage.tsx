import PageLayout from '../../../shared/components/layout/PageLayout';
import { PortfolioTab } from '../components/AnalyticsSections';

export default function AnalyticsPortfolioPage() {
  return (
    <PageLayout
      title="Portefeuille"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Portefeuille' }]}
    >
      <PortfolioTab />
    </PageLayout>
  );
}
