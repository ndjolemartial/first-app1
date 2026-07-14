import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import { ProspectFollowUpTab, ClientFollowUpTab } from '../components/AnalyticsSections';

const SUB_TABS = [
  { key: 'prospects', label: 'Suivi prospects' },
  { key: 'clients', label: 'Suivi clients' },
] as const;

export default function AnalyticsFollowUpPage() {
  const [active, setActive] = useState<(typeof SUB_TABS)[number]['key']>('prospects');

  return (
    <PageLayout
      title="Suivi Prospects & Clients"
      breadcrumbs={[{ label: 'Analyses décisionnelles' }, { label: 'Suivi Prospects & Clients' }]}
    >
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              active === t.key ? 'border-[#2563EB] text-[#1E3A5F]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active === 'prospects' ? <ProspectFollowUpTab /> : <ClientFollowUpTab />}
    </PageLayout>
  );
}
