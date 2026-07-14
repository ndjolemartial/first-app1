import PageLayout from '../../../shared/components/layout/PageLayout';
import { ChargesTab } from '../components/AnalyticsSections';

export default function AnalyticsChargesPage() {
  return (
    <PageLayout
      title="Charges"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Charges' }]}
    >
      <ChargesTab />
    </PageLayout>
  );
}
