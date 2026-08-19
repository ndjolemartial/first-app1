import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAmlProfile, useCreateAmlProfile, useUpdateAmlProfile } from '../hooks/useAml';
import { PEP_CATEGORY_LABEL, VIGILANCE_TYPE_LABEL, subjectDisplayName } from '../utils/aml.utils';

export default function AmlProfileFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const { data } = useAmlProfile(isEdit ? Number(id) : undefined);
  const existing = data?.data;
  const create = useCreateAmlProfile();
  const update = useUpdateAmlProfile();

  const [subjectType, setSubjectType] = useState<'CLIENT' | 'OWNER'>('CLIENT');
  const [subjectId, setSubjectId] = useState('');
  const [isPep, setIsPep] = useState(false);
  const [pepCategory, setPepCategory] = useState('');
  const [pepFunction, setPepFunction] = useState('');
  const [hasRiskyCountryLink, setHasRiskyCountryLink] = useState(false);
  const [sourceOfFunds, setSourceOfFunds] = useState('');
  const [sourceOfWealth, setSourceOfWealth] = useState('');
  const [vigilanceType, setVigilanceType] = useState('NORMALE');
  const [nextReviewDate, setNextReviewDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!existing) return;
    setIsPep(existing.isPep);
    setPepCategory(existing.pepCategory ?? '');
    setPepFunction(existing.pepFunction ?? '');
    setHasRiskyCountryLink(existing.hasRiskyCountryLink);
    setSourceOfFunds(existing.sourceOfFunds ?? '');
    setSourceOfWealth(existing.sourceOfWealth ?? '');
    setVigilanceType(existing.vigilanceType);
    setNextReviewDate(existing.nextReviewDate ? String(existing.nextReviewDate).slice(0, 10) : '');
    setNotes(existing.notes ?? '');
  }, [existing]);

  const handleSubjectSearch = async (query: string) => {
    const res: any = await window.electron.aml.profiles.subjectsWithoutProfile(token, subjectType, query || undefined);
    if (!res.success) return [];
    return res.data.map((s: any) => ({ value: String(s.id), label: subjectDisplayName(s) }));
  };

  const submit = async () => {
    const payload: any = {
      isPep, pepCategory: isPep ? (pepCategory || null) : null, pepFunction: isPep ? (pepFunction || null) : null,
      hasRiskyCountryLink, sourceOfFunds: sourceOfFunds || null, sourceOfWealth: sourceOfWealth || null,
      vigilanceType, nextReviewDate: nextReviewDate || null, notes: notes || null,
    };
    if (isEdit) {
      const res: any = await update.mutateAsync({ id: Number(id), payload });
      if (res.success) navigate(`/aml/profiles/${id}`);
    } else {
      if (!subjectId) return;
      const res: any = await create.mutateAsync({ ...payload, subjectType, subjectId: Number(subjectId) });
      if (res.success) navigate(`/aml/profiles/${res.data.id}`);
    }
  };

  const canSubmit = isEdit ? true : !!subjectId;

  return (
    <PageLayout
      title={isEdit ? 'Modifier le profil LBC/FT' : 'Nouveau profil LBC/FT'}
      breadcrumbs={[{ label: 'Conformité LBC/FT', to: '/aml/profiles' }, { label: 'Profils', to: '/aml/profiles' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <Card className="max-w-2xl space-y-4">
        {!isEdit && (
          <>
            <Select label="Type de sujet" required
              options={[{ value: 'CLIENT', label: 'Client' }, { value: 'OWNER', label: 'Propriétaire' }]}
              value={subjectType} onChange={(e) => { setSubjectType(e.target.value as 'CLIENT' | 'OWNER'); setSubjectId(''); }} />
            <SearchSelect label="Sujet (client ou propriétaire sans profil existant)" required
              options={[]} value={subjectId} onChange={setSubjectId}
              placeholder="Rechercher un nom…" onSearch={handleSubjectSearch} />
          </>
        )}
        {isEdit && existing && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Sujet : <span className="font-medium text-slate-900">{subjectDisplayName(existing.subject)}</span>
            {' '}({existing.subjectType === 'CLIENT' ? 'Client' : 'Propriétaire'})
          </div>
        )}

        <div className="flex items-center gap-2">
          <input id="isPep" type="checkbox" checked={isPep} onChange={(e) => setIsPep(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          <label htmlFor="isPep" className="text-sm font-medium text-slate-700">Personne politiquement exposée (PPE)</label>
        </div>
        {isPep && (
          <div className="grid grid-cols-2 gap-3">
            <Select label="Catégorie PPE" placeholder="Non précisée"
              options={Object.entries(PEP_CATEGORY_LABEL).map(([v, l]) => ({ value: v, label: l }))}
              value={pepCategory} onChange={(e) => setPepCategory(e.target.value)} />
            <Input label="Fonction exercée" value={pepFunction} onChange={(e) => setPepFunction(e.target.value)} />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input id="riskyCountry" type="checkbox" checked={hasRiskyCountryLink} onChange={(e) => setHasRiskyCountryLink(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          <label htmlFor="riskyCountry" className="text-sm font-medium text-slate-700">Lien avec un pays à risque</label>
        </div>

        <Select label="Type de vigilance"
          options={Object.entries(VIGILANCE_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          value={vigilanceType} onChange={(e) => setVigilanceType(e.target.value)} />

        <Textarea label="Origine des fonds" rows={2} value={sourceOfFunds} onChange={(e) => setSourceOfFunds(e.target.value)} />
        <Textarea label="Origine du patrimoine" rows={2} value={sourceOfWealth} onChange={(e) => setSourceOfWealth(e.target.value)} />
        <Input label="Prochaine date de revue" type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} />
        <Textarea label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={() => navigate(-1)}>Annuler</Button>
          <Button onClick={submit} disabled={!canSubmit || create.isPending || update.isPending} loading={create.isPending || update.isPending}>
            {isEdit ? 'Enregistrer' : 'Créer le profil'}
          </Button>
        </div>
      </Card>
    </PageLayout>
  );
}
