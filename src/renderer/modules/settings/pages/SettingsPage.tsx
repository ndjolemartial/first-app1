import { useState } from 'react';
import { Building2, HardDrive, Mail, MessageSquare, Images } from 'lucide-react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import { clsx } from 'clsx';
import CompanySettingsTab     from '../components/CompanySettingsTab';
import StorageSettingsTab     from '../components/StorageSettingsTab';
import EmailSettingsTab       from '../components/EmailSettingsTab';
import SmsSettingsTab         from '../components/SmsSettingsTab';
import SlideshowSettingsTab   from '../components/SlideshowSettingsTab';

type TabKey = 'company' | 'storage' | 'email' | 'sms' | 'slideshow';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'company',   label: 'Entreprise',         icon: <Building2 className="h-4 w-4" /> },
  { key: 'storage',   label: 'Stockage',           icon: <HardDrive className="h-4 w-4" /> },
  { key: 'email',     label: 'Email (SMTP)',       icon: <Mail className="h-4 w-4" /> },
  { key: 'sms',       label: 'SMS',                icon: <MessageSquare className="h-4 w-4" /> },
  { key: 'slideshow', label: 'Slideshow dashboard',icon: <Images className="h-4 w-4" /> },
];

export default function SettingsPage() {
  const [active, setActive] = useState<TabKey>('company');

  return (
    <PageLayout
      title="Paramètres de l'application"
      breadcrumbs={[{ label: 'Paramètres' }]}
    >
      <div className="flex gap-4">
        {/* Onglets verticaux */}
        <Card className="w-60 flex-shrink-0" padding={false}>
          <nav className="flex flex-col p-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
                  active === t.key
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </Card>

        {/* Contenu de l'onglet actif */}
        <div className="flex-1 min-w-0">
          {active === 'company'   && <CompanySettingsTab />}
          {active === 'storage'   && <StorageSettingsTab />}
          {active === 'email'     && <EmailSettingsTab />}
          {active === 'sms'       && <SmsSettingsTab />}
          {active === 'slideshow' && <SlideshowSettingsTab />}
        </div>
      </div>
    </PageLayout>
  );
}
