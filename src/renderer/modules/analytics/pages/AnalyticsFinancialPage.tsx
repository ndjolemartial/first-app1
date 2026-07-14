import PageLayout from '../../../shared/components/layout/PageLayout';
import { FinancialTab } from '../components/AnalyticsSections';

export default function AnalyticsFinancialPage() {
  return (
    <PageLayout
      title="Finances et rentabilité"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Finances et rentabilité' }]}
    >
      <FinancialTab />
    </PageLayout>
  );
}
