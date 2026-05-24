import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, HardDrive, Mail, MessageSquare, Images, FileText, FileSignature, Award, Briefcase, Tags, Landmark, IdCard, Layers } from 'lucide-react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import { clsx } from 'clsx';
import CompanySettingsTab              from '../components/CompanySettingsTab';
import StorageSettingsTab              from '../components/StorageSettingsTab';
import EmailSettingsTab                from '../components/EmailSettingsTab';
import SmsSettingsTab                  from '../components/SmsSettingsTab';
import SlideshowSettingsTab            from '../components/SlideshowSettingsTab';
import InvoiceTemplatesSettingsTab     from '../components/InvoiceTemplatesSettingsTab';
import ConventionTemplatesSettingsTab  from '../components/ConventionTemplatesSettingsTab';
import AttestationTemplatesSettingsTab from '../components/AttestationTemplatesSettingsTab';
import ProjectTypesSettingsTab         from '../components/ProjectTypesSettingsTab';
import IdDocumentTypesSettingsTab      from '../components/IdDocumentTypesSettingsTab';
import LotissementTitleTypesSettingsTab from '../components/LotissementTitleTypesSettingsTab';
import TreasuryCategoriesSettingsTab   from '../components/TreasuryCategoriesSettingsTab';
import TreasuryAccountsSettingsTab     from '../components/TreasuryAccountsSettingsTab';

type TabKey =
  | 'company'
  | 'storage'
  | 'email'
  | 'sms'
  | 'slideshow'
  | 'invoiceTemplates'
  | 'conventionTemplates'
  | 'attestationTemplates'
  | 'projectTypes'
  | 'idDocumentTypes'
  | 'lotissementTitleTypes'
  | 'treasuryAccounts'
  | 'treasuryCategories';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'company',              label: 'Entreprise',              icon: <Building2 className="h-4 w-4" /> },
  { key: 'storage',              label: 'Stockage',                icon: <HardDrive className="h-4 w-4" /> },
  { key: 'email',                label: 'Email (SMTP)',            icon: <Mail className="h-4 w-4" /> },
  { key: 'sms',                  label: 'SMS',                     icon: <MessageSquare className="h-4 w-4" /> },
  { key: 'slideshow',            label: 'Slideshow dashboard',     icon: <Images className="h-4 w-4" /> },
  { key: 'invoiceTemplates',     label: 'Modèles de factures',     icon: <FileText className="h-4 w-4" /> },
  { key: 'conventionTemplates',  label: 'Modèles de conventions',  icon: <FileSignature className="h-4 w-4" /> },
  { key: 'attestationTemplates', label: "Modèles d'attestations",  icon: <Award className="h-4 w-4" /> },
  { key: 'projectTypes',         label: 'Types de projets',        icon: <Briefcase className="h-4 w-4" /> },
  { key: 'idDocumentTypes',      label: "Types de pièces d'identité", icon: <IdCard className="h-4 w-4" /> },
  { key: 'lotissementTitleTypes', label: 'Natures de titres de lotissement', icon: <Layers className="h-4 w-4" /> },
  { key: 'treasuryAccounts',     label: "Comptes d'opérations",    icon: <Landmark className="h-4 w-4" /> },
  { key: 'treasuryCategories',   label: "Objets d'opération",      icon: <Tags className="h-4 w-4" /> },
];

const TAB_KEYS = TABS.map((t) => t.key) as TabKey[];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [active, setActive] = useState<TabKey>(
    initialTab && (TAB_KEYS as string[]).includes(initialTab) ? (initialTab as TabKey) : 'company'
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (TAB_KEYS as string[]).includes(t) && t !== active) setActive(t as TabKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSelect = (key: TabKey) => {
    setActive(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'company') next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

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
                onClick={() => handleSelect(t.key)}
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
          {active === 'company'              && <CompanySettingsTab />}
          {active === 'storage'              && <StorageSettingsTab />}
          {active === 'email'                && <EmailSettingsTab />}
          {active === 'sms'                  && <SmsSettingsTab />}
          {active === 'slideshow'            && <SlideshowSettingsTab />}
          {active === 'invoiceTemplates'     && <InvoiceTemplatesSettingsTab />}
          {active === 'conventionTemplates'  && <ConventionTemplatesSettingsTab />}
          {active === 'attestationTemplates' && <AttestationTemplatesSettingsTab />}
          {active === 'projectTypes'         && <ProjectTypesSettingsTab />}
          {active === 'idDocumentTypes'      && <IdDocumentTypesSettingsTab />}
          {active === 'lotissementTitleTypes' && <LotissementTitleTypesSettingsTab />}
          {active === 'treasuryAccounts'     && <TreasuryAccountsSettingsTab />}
          {active === 'treasuryCategories'   && <TreasuryCategoriesSettingsTab />}
        </div>
      </div>
    </PageLayout>
  );
}
