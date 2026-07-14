import PageLayout from '../../../shared/components/layout/PageLayout';
import { CrmTab } from '../components/AnalyticsSections';

export default function AnalyticsCrmPage() {
  return (
    <PageLayout
      title="CRM & Clients"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'CRM & Clients' }]}
    >
      <CrmTab />
    </PageLayout>
  );
}
