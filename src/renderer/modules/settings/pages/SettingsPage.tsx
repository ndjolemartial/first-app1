import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, HardDrive, Mail, MessageSquare, Images, FileText, FileSignature, Award, Briefcase, Tags, Landmark, IdCard, Layers, Bell, BookOpen, ChevronDown, ChevronRight, Inbox, Printer } from 'lucide-react';
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
import RemindersSettingsTab            from '../components/RemindersSettingsTab';
import CommTemplatesSettingsTab        from '../components/CommTemplatesSettingsTab';

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
  | 'treasuryCategories'
  | 'reminders'
  | 'commTemplates';

type GroupKey = 'communication' | 'treasury' | 'printedTemplates';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  group?: GroupKey;
}

interface GroupDef {
  key: GroupKey;
  label: string;
  icon: React.ReactNode;
}

const GROUPS: GroupDef[] = [
  { key: 'communication',    label: 'Gestion Mails / SMS',  icon: <Inbox className="h-4 w-4" /> },
  { key: 'printedTemplates', label: "Modèles d'imprimés",   icon: <Printer className="h-4 w-4" /> },
  { key: 'treasury',         label: 'Opérations bancaires', icon: <Landmark className="h-4 w-4" /> },
];

const TABS: TabDef[] = [
  { key: 'company',              label: 'Entreprise',              icon: <Building2 className="h-4 w-4" /> },
  { key: 'storage',              label: 'Stockage',                icon: <HardDrive className="h-4 w-4" /> },
  // ── Groupe « Gestion Mails / SMS » ──────────────────────────
  { key: 'email',                label: 'Email (SMTP)',            icon: <Mail className="h-4 w-4" />,           group: 'communication' },
  { key: 'sms',                  label: 'SMS',                     icon: <MessageSquare className="h-4 w-4" />,  group: 'communication' },
  { key: 'commTemplates',        label: 'Modèles email / SMS',     icon: <BookOpen className="h-4 w-4" />,       group: 'communication' },
  { key: 'reminders',            label: 'Politique de relance',    icon: <Bell className="h-4 w-4" />,           group: 'communication' },
  // ─────────────────────────────────────────────────────────────
  { key: 'slideshow',            label: 'Slideshow dashboard',     icon: <Images className="h-4 w-4" /> },
  // ── Groupe « Modèles d'imprimés » ───────────────────────────
  { key: 'invoiceTemplates',     label: 'Modèles de factures',     icon: <FileText className="h-4 w-4" />,      group: 'printedTemplates' },
  { key: 'conventionTemplates',  label: 'Modèles de conventions',  icon: <FileSignature className="h-4 w-4" />, group: 'printedTemplates' },
  { key: 'attestationTemplates', label: "Modèles d'attestations",  icon: <Award className="h-4 w-4" />,         group: 'printedTemplates' },
  { key: 'projectTypes',         label: 'Types de projets',        icon: <Briefcase className="h-4 w-4" /> },
  { key: 'idDocumentTypes',      label: "Types de pièces d'identité", icon: <IdCard className="h-4 w-4" /> },
  { key: 'lotissementTitleTypes', label: 'Natures de titres de lotissement', icon: <Layers className="h-4 w-4" /> },
  // ── Groupe « Opérations bancaires » ─────────────────────────
  { key: 'treasuryAccounts',     label: "Comptes d'opérations",    icon: <Landmark className="h-4 w-4" />, group: 'treasury' },
  { key: 'treasuryCategories',   label: "Objets d'opération",      icon: <Tags className="h-4 w-4" />,     group: 'treasury' },
];

const TAB_KEYS = TABS.map((t) => t.key) as TabKey[];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [active, setActive] = useState<TabKey>(
    initialTab && (TAB_KEYS as string[]).includes(initialTab) ? (initialTab as TabKey) : 'company'
  );

  // Groupes ouverts ; on initialise ouverts ceux qui contiennent l'onglet actif.
  const [openGroups, setOpenGroups] = useState<Set<GroupKey>>(() => {
    const set = new Set<GroupKey>();
    const activeTab = TABS.find((t) => t.key === active);
    if (activeTab?.group) set.add(activeTab.group);
    return set;
  });

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (TAB_KEYS as string[]).includes(t) && t !== active) {
      setActive(t as TabKey);
      const tabDef = TABS.find((x) => x.key === t);
      if (tabDef?.group) {
        setOpenGroups((prev) => (prev.has(tabDef.group!) ? prev : new Set([...prev, tabDef.group!])));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSelect = (key: TabKey): void => {
    setActive(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'company') next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: true });
    // Garde le groupe parent ouvert quand on clique sur un de ses enfants.
    const tabDef = TABS.find((t) => t.key === key);
    if (tabDef?.group) {
      setOpenGroups((prev) => (prev.has(tabDef.group!) ? prev : new Set([...prev, tabDef.group!])));
    }
  };

  const toggleGroup = (key: GroupKey): void => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Construit l'ordre d'affichage : items hors groupe restent en place ;
  // chaque groupe est inséré (header + enfants) à la position de son premier
  // enfant dans `TABS`, pour conserver l'ordre voulu sans dupliquer la liste.
  const navItems = useMemo(() => {
    const items: Array<
      | { kind: 'tab'; tab: TabDef }
      | { kind: 'group'; group: GroupDef; children: TabDef[] }
    > = [];
    const groupInserted = new Set<GroupKey>();
    for (const tab of TABS) {
      if (tab.group) {
        if (groupInserted.has(tab.group)) continue;
        const groupDef = GROUPS.find((g) => g.key === tab.group);
        if (!groupDef) continue;
        const children = TABS.filter((t) => t.group === tab.group);
        items.push({ kind: 'group', group: groupDef, children });
        groupInserted.add(tab.group);
      } else {
        items.push({ kind: 'tab', tab });
      }
    }
    return items;
  }, []);

  const renderTabButton = (tab: TabDef, indented: boolean): React.ReactNode => (
    <button
      key={tab.key}
      onClick={() => handleSelect(tab.key)}
      className={clsx(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
        indented && 'ml-3 pl-5',
        active === tab.key
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-50',
      )}
    >
      {tab.icon}
      {tab.label}
    </button>
  );

  return (
    <PageLayout
      title="Paramètres de l'application"
      breadcrumbs={[{ label: 'Paramètres' }]}
    >
      <div className="flex gap-4">
        {/* Onglets verticaux */}
        <Card className="w-60 flex-shrink-0" padding={false}>
          <nav className="flex flex-col p-2">
            {navItems.map((item) => {
              if (item.kind === 'tab') return renderTabButton(item.tab, false);
              const groupOpen = openGroups.has(item.group.key);
              const groupHasActive = item.children.some((c) => c.key === active);
              return (
                <div key={item.group.key} className="flex flex-col">
                  <button
                    onClick={() => toggleGroup(item.group.key)}
                    className={clsx(
                      'flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
                      groupHasActive && !groupOpen
                        ? 'text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      {item.group.icon}
                      {item.group.label}
                    </span>
                    {groupOpen
                      ? <ChevronDown className="h-4 w-4 text-slate-400" />
                      : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </button>
                  {groupOpen && (
                    <div className="flex flex-col mt-1 border-l border-slate-200 ml-4">
                      {item.children.map((child) => renderTabButton(child, true))}
                    </div>
                  )}
                </div>
              );
            })}
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
          {active === 'reminders'            && <RemindersSettingsTab />}
          {active === 'commTemplates'        && <CommTemplatesSettingsTab />}
        </div>
      </div>
    </PageLayout>
  );
}
