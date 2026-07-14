import PageLayout from '../../../shared/components/layout/PageLayout';
import { ContractsTab } from '../components/AnalyticsSections';

export default function AnalyticsContractsPage() {
  return (
    <PageLayout
      title="Contractuel"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Contractuel' }]}
    >
      <ContractsTab />
    </PageLayout>
  );
}
