import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import { WATCHLIST_TYPE_LABEL, MARITAL_STATUS_LABEL, WATCHLIST_LIST_TYPE_VARIANT } from '../utils/aml.utils';
import { User, Building2, MapPin, ShieldAlert, FileText, Calendar } from 'lucide-react';

/** Ligne « libellé / valeur » d'une section de la fiche détail — masquée si vide. */
function DetailField({ label, value, full }: { label: string; value?: React.ReactNode; full?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <div className={full ? 'col-span-2' : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

/** Section colorée de la fiche détail — masquée entièrement si aucun champ enfant n'est rendu. */
function DetailSection(
  { icon, title, tone, hasContent, children }:
  { icon: React.ReactNode; title: string; tone: 'indigo' | 'amber' | 'emerald' | 'rose' | 'slate'; hasContent: boolean; children: React.ReactNode },
) {
  if (!hasContent) return null;
  const tones: Record<string, string> = {
    indigo: 'border-indigo-100 bg-indigo-50/70',
    amber: 'border-amber-100 bg-amber-50/70',
    emerald: 'border-emerald-100 bg-emerald-50/70',
    rose: 'border-rose-100 bg-rose-50/70',
    slate: 'border-slate-200 bg-slate-50',
  };
  const titleTones: Record<string, string> = {
    indigo: 'text-indigo-700', amber: 'text-amber-700', emerald: 'text-emerald-700', rose: 'text-rose-700', slate: 'text-slate-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className={`mb-3 flex items-center gap-2 text-sm font-semibold ${titleTones[tone]}`}>
        {icon} {title}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </div>
  );
}

/** Fiche en lecture seule, riche et colorée, de l'ensemble des informations d'une entrée du référentiel de vigilance. */
export default function WatchlistDetailModal({ entry, onClose }: { entry: any | null; onClose: () => void }) {
  if (!entry) return null;
  const birthDates: string[] = Array.isArray(entry.birthDates) ? entry.birthDates : [];
  const ages: number[] = Array.isArray(entry.ages) ? entry.ages : [];
  const aliases: string[] = Array.isArray(entry.aliases) ? entry.aliases : [];
  const fmtDate = (d: string) => { const dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR'); };
  const isMorale = entry.personType === 'MORALE';

  const hasIdentity = aliases.length > 0 || !!entry.nationality || !!entry.maritalStatus || !!entry.spokenLanguage || !!entry.profession;
  const hasBirth = ages.length > 0 || birthDates.length > 0 || !!entry.birthPlace || !!entry.relatedPersons;
  const hasContact = !!entry.residenceCountry || !!entry.address || !!entry.phone;
  const hasListing = !!entry.sourceRef || !!entry.reason;
  const hasNotes = !!entry.notes;

  return (
    <Modal open={!!entry} onClose={onClose} title="Fiche du référentiel de vigilance" size="xl"
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <div className="space-y-4">
        {/* En-tête : avatar, nom, badges */}
        <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            {isMorale ? <Building2 className="h-7 w-7" /> : <User className="h-7 w-7" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-slate-900">{entry.name}</h3>
            {aliases.length > 0 && <p className="mt-0.5 truncate text-sm text-slate-500">Alias : {aliases.join(', ')}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={WATCHLIST_LIST_TYPE_VARIANT[entry.listType] ?? 'default'}>{WATCHLIST_TYPE_LABEL[entry.listType] ?? entry.listType}</Badge>
              <Badge variant="purple">{isMorale ? 'Personne morale' : 'Personne physique'}</Badge>
              {entry.sex && <Badge variant="info">{entry.sex === 'M' ? 'Masculin' : 'Féminin'}</Badge>}
              {!entry.isActive && <Badge variant="warning">Inactive</Badge>}
            </div>
          </div>
        </div>

        <DetailSection icon={<User className="h-4 w-4" />} title="Identité" tone="indigo" hasContent={hasIdentity}>
          <DetailField label="Nationalité" value={entry.nationality} />
          <DetailField label="Situation matrimoniale" value={entry.maritalStatus ? MARITAL_STATUS_LABEL[entry.maritalStatus] : undefined} />
          <DetailField label="Langue parlée" value={entry.spokenLanguage} />
          <DetailField label="Profession" value={entry.profession} />
        </DetailSection>

        <DetailSection icon={<Calendar className="h-4 w-4" />} title="Naissance & filiation" tone="amber" hasContent={hasBirth}>
          <DetailField label="Âges" value={ages.length ? ages.join(', ') : undefined} />
          <DetailField label="Dates de naissance" value={birthDates.length ? birthDates.map(fmtDate).join(', ') : undefined} />
          <DetailField label="Lieu de naissance" value={entry.birthPlace} full />
          <DetailField label="Ascendants, descendants, conjoint(e), parents ou proches" value={entry.relatedPersons} full />
        </DetailSection>

        <DetailSection icon={<MapPin className="h-4 w-4" />} title="Résidence & contact" tone="emerald" hasContent={hasContact}>
          <DetailField label="Pays de résidence habituel" value={entry.residenceCountry} />
          <DetailField label="Numéro de téléphone utilisé" value={entry.phone} />
          <DetailField label="Adresse" value={entry.address} full />
        </DetailSection>

        <DetailSection icon={<ShieldAlert className="h-4 w-4" />} title="Inscription sur la liste" tone="rose" hasContent={hasListing}>
          <DetailField label="Référence dans la liste source" value={entry.sourceRef} full />
          <DetailField label="Motif" value={entry.reason} full />
        </DetailSection>

        <DetailSection icon={<FileText className="h-4 w-4" />} title="Notes" tone="slate" hasContent={hasNotes}>
          <DetailField label="Notes" value={entry.notes} full />
        </DetailSection>
      </div>
    </Modal>
  );
}
