import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAmlWatchlist, useCreateAmlWatchlistEntry, useUpdateAmlWatchlistEntry, useDeleteAmlWatchlistEntry } from '../hooks/useAml';
import { WATCHLIST_TYPE_LABEL, MARITAL_STATUS_LABEL } from '../utils/aml.utils';
import WatchlistDetailModal from '../components/WatchlistDetailModal';
import { Plus, Edit, Trash2, Save, X, Eye } from 'lucide-react';

interface EditState {
  id?: number; listType: string; personType: string; name: string; aliases: string;
  sex: string; nationality: string; ages: string[]; birthDates: string[]; birthPlace: string;
  relatedPersons: string; maritalStatus: string; spokenLanguage: string; residenceCountry: string;
  address: string; phone: string; profession: string; reason: string;
  sourceRef: string; notes: string;
}
// Écriture : rôles à plein accès + AGENT_TECHNIQUE (seul rôle du périmètre
// restreint AGENT/AGENT_TECHNIQUE/ASSISTANTE_DIRECTION autorisé à créer/
// modifier/supprimer une entrée — AGENT et ASSISTANTE_DIRECTION restent en
// lecture seule, cf. WATCHLIST_RESTRICTED_WRITE_ROLES dans aml.ipc.ts).
const AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT', 'AGENT_TECHNIQUE'];

const emptyEditState: Omit<EditState, 'listType' | 'personType'> = {
  name: '', aliases: '', sex: '', nationality: '', ages: [], birthDates: [], birthPlace: '',
  relatedPersons: '', maritalStatus: '', spokenLanguage: '', residenceCountry: '',
  address: '', phone: '', profession: '', reason: '', sourceRef: '', notes: '',
};

export default function AmlWatchlistPage() {
  const [search, setSearch] = useState('');
  const [listTypeFilter, setListTypeFilter] = useState('');
  const [personTypeFilter, setPersonTypeFilter] = useState('');
  const { data, isLoading } = useAmlWatchlist({
    search: search || undefined, listType: listTypeFilter || undefined, personType: personTypeFilter || undefined,
  });
  const create = useCreateAmlWatchlistEntry();
  const update = useUpdateAmlWatchlistEntry();
  const del = useDeleteAmlWatchlistEntry();
  const entries: any[] = data?.data ?? [];

  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = AML_ROLES.includes(role);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);

  const startNew = () => setEditing({ listType: 'ONU', personType: 'PHYSIQUE', ...emptyEditState });
  const startEdit = (w: any) => setEditing({
    id: w.id, listType: w.listType, personType: w.personType, name: w.name, aliases: (w.aliases ?? []).join(', '),
    sex: w.sex ?? '', nationality: w.nationality ?? '',
    ages: Array.isArray(w.ages) ? w.ages.map((a: number) => String(a)) : [],
    birthDates: Array.isArray(w.birthDates) ? w.birthDates.map((d: string) => String(d).slice(0, 10)) : [],
    birthPlace: w.birthPlace ?? '', relatedPersons: w.relatedPersons ?? '', maritalStatus: w.maritalStatus ?? '',
    spokenLanguage: w.spokenLanguage ?? '', residenceCountry: w.residenceCountry ?? '', address: w.address ?? '',
    phone: w.phone ?? '', profession: w.profession ?? '', reason: w.reason ?? '',
    sourceRef: w.sourceRef ?? '', notes: w.notes ?? '',
  });

  const onSave = async () => {
    if (!editing || !editing.name.trim()) return;
    const payload = {
      listType: editing.listType, personType: editing.personType, name: editing.name.trim(),
      aliases: editing.aliases.split(',').map((a) => a.trim()).filter(Boolean),
      sex: editing.sex || null, nationality: editing.nationality || null,
      ages: editing.ages.filter((a) => a !== '').map(Number),
      birthDates: editing.birthDates.filter(Boolean),
      birthPlace: editing.birthPlace || null,
      relatedPersons: editing.relatedPersons || null, maritalStatus: editing.maritalStatus || null,
      spokenLanguage: editing.spokenLanguage || null, residenceCountry: editing.residenceCountry || null,
      address: editing.address || null, phone: editing.phone || null, profession: editing.profession || null,
      reason: editing.reason || null, sourceRef: editing.sourceRef || null, notes: editing.notes || null,
    };
    const r: any = editing.id ? await update.mutateAsync({ id: editing.id, payload }) : await create.mutateAsync(payload);
    if (r.success) setEditing(null);
  };

  const setAgeAt = (idx: number, value: string) =>
    setEditing((e) => e && { ...e, ages: e.ages.map((a, i) => (i === idx ? value : a)) });
  const removeAgeAt = (idx: number) =>
    setEditing((e) => e && { ...e, ages: e.ages.filter((_, i) => i !== idx) });
  const addAge = () => setEditing((e) => e && { ...e, ages: [...e.ages, ''] });

  const setBirthDateAt = (idx: number, value: string) =>
    setEditing((e) => e && { ...e, birthDates: e.birthDates.map((d, i) => (i === idx ? value : d)) });
  const removeBirthDateAt = (idx: number) =>
    setEditing((e) => e && { ...e, birthDates: e.birthDates.filter((_, i) => i !== idx) });
  const addBirthDate = () => setEditing((e) => e && { ...e, birthDates: [...e.birthDates, ''] });

  return (
    <PageLayout title="Référentiel de vigilance" breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Référentiel de vigilance' }]}
      actions={canWrite && !editing ? <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle entrée</Button> : undefined}
    >
      <p className="mb-4 text-sm text-slate-500">
        Référentiel de vigilance (Sanctions Financières Ciblées (SFC) / Personnes Politiquement Exposées (PPE))
      </p>

      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input label="Rechercher" placeholder="Nom et prénoms, alias, nationalité, pays de résidence, réf. liste source…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-52">
          <Select label="Type de liste" placeholder="Toutes les listes"
            options={Object.entries(WATCHLIST_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={listTypeFilter} onChange={(e) => setListTypeFilter(e.target.value)} />
        </div>
        <div className="w-52">
          <Select label="Type de personne" placeholder="Tous types"
            options={[{ value: 'PHYSIQUE', label: 'Personne physique' }, { value: 'MORALE', label: 'Personne morale' }]}
            value={personTypeFilter} onChange={(e) => setPersonTypeFilter(e.target.value)} />
        </div>
      </Card>

      {canWrite && editing && (
        <Card className="mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? "Modifier l'entrée" : 'Nouvelle entrée'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Liste" options={Object.entries(WATCHLIST_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
              value={editing.listType} onChange={(e) => setEditing({ ...editing, listType: e.target.value })} />
            <Select label="Type" options={[{ value: 'PHYSIQUE', label: 'Personne physique' }, { value: 'MORALE', label: 'Personne morale' }]}
              value={editing.personType} onChange={(e) => setEditing({ ...editing, personType: e.target.value })} />

            <Input label="Nom et prénoms *" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="col-span-2" />
            <Input label="Alias (séparés par des virgules)" value={editing.aliases} onChange={(e) => setEditing({ ...editing, aliases: e.target.value })} className="col-span-2" />

            <Select label="Sexe" placeholder="Non précisé"
              options={[{ value: 'M', label: 'Masculin' }, { value: 'F', label: 'Féminin' }]}
              value={editing.sex} onChange={(e) => setEditing({ ...editing, sex: e.target.value })} />
            <Input label="Nationalité" value={editing.nationality} onChange={(e) => setEditing({ ...editing, nationality: e.target.value })} />

          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Âges</label>
              <div className="space-y-2">
                {editing.ages.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input type="number" min="0" max="150" value={a} onChange={(e) => setAgeAt(idx, e.target.value)} className="flex-1" />
                    <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={() => removeAgeAt(idx)} />
                  </div>
                ))}
                <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={addAge}>
                  Ajouter un âge
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Dates de naissance</label>
              <div className="space-y-2">
                {editing.birthDates.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input type="date" value={d} onChange={(e) => setBirthDateAt(idx, e.target.value)} className="flex-1" />
                    <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={() => removeBirthDateAt(idx)} />
                  </div>
                ))}
                <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={addBirthDate}>
                  Ajouter une date de naissance
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Lieu de naissance" value={editing.birthPlace} onChange={(e) => setEditing({ ...editing, birthPlace: e.target.value })} />
            <Select label="Situation matrimoniale" placeholder="Non précisée"
              options={Object.entries(MARITAL_STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
              value={editing.maritalStatus} onChange={(e) => setEditing({ ...editing, maritalStatus: e.target.value })} />

            <Input label="Langue parlée" value={editing.spokenLanguage} onChange={(e) => setEditing({ ...editing, spokenLanguage: e.target.value })} />
            <Input label="Pays de résidence habituel" value={editing.residenceCountry} onChange={(e) => setEditing({ ...editing, residenceCountry: e.target.value })} />

            <Input label="Numéro de téléphone utilisé" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            <Input label="Profession" value={editing.profession} onChange={(e) => setEditing({ ...editing, profession: e.target.value })} />

            <Input label="Référence dans la liste source" value={editing.sourceRef} onChange={(e) => setEditing({ ...editing, sourceRef: e.target.value })} className="col-span-2" />
          </div>

          <Textarea label="Adresse" rows={2} value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
          <Textarea label="Identité ascendants, descendants, conjoint(e), parents ou proches" rows={2}
            value={editing.relatedPersons} onChange={(e) => setEditing({ ...editing, relatedPersons: e.target.value })} />
          <Textarea label="Motif (raison de l'inscription sur la liste)" rows={2} value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} />
          <Textarea label="Notes" rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={create.isPending || update.isPending} onClick={onSave}>Enregistrer</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : entries.length === 0 ? (
          search || listTypeFilter || personTypeFilter ? (
            <EmptyState title="Aucun résultat" description="Aucune entrée ne correspond à ces filtres." />
          ) : (
            <EmptyState title="Référentiel vide" description="Aucune entrée de vigilance enregistrée." action={canWrite ? { label: 'Nouvelle entrée', onClick: startNew } : undefined} />
          )
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Nom et prénoms</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Liste</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Nationalité</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{w.name}</td>
                  <td className="px-4 py-3"><Badge variant="default">{WATCHLIST_TYPE_LABEL[w.listType]}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{w.personType === 'PHYSIQUE' ? 'Physique' : 'Morale'}</td>
                  <td className="px-4 py-3 text-slate-500">{w.nationality ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => setViewing(w)} />
                      {canWrite && (
                        <>
                          <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(w)} />
                          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(w)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {canWrite && (
        <ConfirmDialog open={!!toDelete} title="Retirer l'entrée" message={`Retirer « ${toDelete?.name ?? ''} » du référentiel ?`}
          onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }} onClose={() => setToDelete(null)} />
      )}

      <WatchlistDetailModal entry={viewing} onClose={() => setViewing(null)} />
    </PageLayout>
  );
}
