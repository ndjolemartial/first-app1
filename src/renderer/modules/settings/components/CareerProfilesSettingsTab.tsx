import { useEffect, useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useJobPositions, usePayrollRates } from '../../hr/hooks/useHr';
import {
  useCareerProfiles,
  useCreateCareerProfile,
  useUpdateCareerProfile,
  useDeleteCareerProfile,
  useDuplicateCareerProfile,
} from '../../hr/hooks/useCareerProfiles';
import JobPositionModal from '../../hr/components/JobPositionModal';
import DepartmentModal from '../../hr/components/DepartmentModal';
import { Plus, Edit, Trash2, Save, X, ArrowUp, ArrowDown, Briefcase, Settings2, Crown, Copy } from 'lucide-react';

interface StepDraft {
  poste: string;
  rolePrincipal: string;
  competencesDiplomes: string;
  categorieSocioPro: string;
  categorieCode: string;
  avantages: string;
}

function ProfileForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: any;
  onSave: (data: { name: string; description: string; isActive: boolean; steps: { poste: string; order: number; rolePrincipal: string | null; competencesDiplomes: string | null; categorieSocioPro: string | null; categorieCode: string | null; avantages: string | null }[] }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { data: postesRes } = useJobPositions();
  const posteOptions = [
    { value: '', label: '— Choisir un poste —' },
    ...((postesRes?.data ?? []) as any[]).map((p) => ({ value: p.label, label: p.label })),
  ];
  const { data: ratesRes } = usePayrollRates();
  const salaryCategories = ((ratesRes?.data as any)?.salaryCategories ?? []) as { code: string; label?: string }[];
  const norm = (l?: string) => (l && l.trim() ? l.trim().toLowerCase() : '');
  // Les groupes (catégories socio-professionnelles) et leurs codes proviennent tous deux de la
  // grille des catégories de Paramètres → Paie, afin de garantir une correspondance exacte entre
  // la catégorie choisie et les codes proposés (ex : « Ingénieurs et cadres assimilés » → 1A…3B).
  const categorieOptions = [
    { value: '', label: '— Catégorie socio-professionnelle (optionnel) —' },
    ...Array.from(new Set(salaryCategories.map((c) => c.label).filter((l): l is string => !!l && !!l.trim())))
      .map((label) => ({ value: label, label })),
  ];
  const codesForCategorie = (categorieSocioPro: string): string[] => {
    if (!categorieSocioPro.trim()) return [];
    return Array.from(new Set(
      salaryCategories
        .filter((c) => norm(c.label) === norm(categorieSocioPro))
        .map((c) => c.code)
        .filter((code) => code && code.trim()),
    ));
  };

  // Codes déjà sélectionnés pour une étape (stockés en un seul champ texte,
  // séparés par des virgules — ex. « A1, A2 »).
  const parseCodes = (categorieCode: string): string[] =>
    categorieCode.split(',').map((c) => c.trim()).filter(Boolean);

  const toggleCode = (idx: number, code: string) =>
    setSteps((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      const current = parseCodes(s.categorieCode);
      const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
      return { ...s, categorieCode: next.join(', ') };
    }));

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [steps, setSteps] = useState<StepDraft[]>(
    initial?.steps?.length
      ? initial.steps.map((s: any) => ({
          poste: s.poste,
          rolePrincipal: s.rolePrincipal ?? '',
          competencesDiplomes: s.competencesDiplomes ?? '',
          categorieSocioPro: s.categorieSocioPro ?? '',
          categorieCode: s.categorieCode ?? '',
          avantages: s.avantages ?? '',
        }))
      : [{ poste: '', rolePrincipal: '', competencesDiplomes: '', categorieSocioPro: '', categorieCode: '', avantages: '' }],
  );
  const [error, setError] = useState<string | null>(null);

  const patchStep = (idx: number, patch: Partial<StepDraft>) =>
    setSteps((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      const next = { ...s, ...patch };
      // Le code catégorie est dépendant de la catégorie socio-professionnelle : le réinitialiser si elle change.
      if ('categorieSocioPro' in patch && patch.categorieSocioPro !== s.categorieSocioPro) next.categorieCode = '';
      return next;
    }));

  const moveStep = (idx: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx));
  const addStep = () => setSteps((prev) => [...prev, { poste: '', rolePrincipal: '', competencesDiplomes: '', categorieSocioPro: '', categorieCode: '', avantages: '' }]);

  const handleSubmit = () => {
    setError(null);
    if (!name.trim()) { setError('Le nom du profil est requis.'); return; }
    const cleaned = steps.filter((s) => s.poste.trim());
    if (cleaned.length === 0) { setError('Au moins une étape (poste) est requise.'); return; }
    const postes = cleaned.map((s) => s.poste.trim());
    if (new Set(postes).size !== postes.length) { setError('Un même poste ne peut apparaître qu\'une seule fois dans la filière.'); return; }
    onSave({
      name: name.trim(),
      description: description.trim(),
      isActive,
      steps: cleaned.map((s, i) => ({
        poste: s.poste.trim(),
        order: i + 1,
        rolePrincipal: s.rolePrincipal.trim() || null,
        competencesDiplomes: s.competencesDiplomes.trim() || null,
        categorieSocioPro: s.categorieSocioPro.trim() || null,
        categorieCode: s.categorieCode.trim() || null,
        avantages: s.avantages.trim() || null,
      })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Nom du profil *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Filière commerciale" />
        <div className="flex items-end gap-2 pb-2">
          <input type="checkbox" id="cp-active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
          <label htmlFor="cp-active" className="text-sm text-slate-700">Profil actif (visible dans « Mon espace RH »)</label>
        </div>
      </div>
      <Textarea label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-2">
          Étapes de la filière (du premier au dernier niveau) *
        </label>
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {idx + 1}
              </span>
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <Select
                    options={posteOptions}
                    value={step.poste}
                    onChange={(e) => patchStep(idx, { poste: e.target.value })}
                  />
                  <Select
                    options={categorieOptions}
                    value={step.categorieSocioPro}
                    onChange={(e) => patchStep(idx, { categorieSocioPro: e.target.value })}
                  />
                  <div className="flex min-h-[42px] flex-wrap content-start gap-1 rounded-lg border border-slate-300 px-2 py-1.5">
                    {!step.categorieSocioPro.trim() ? (
                      <span className="py-1 text-xs text-slate-400">Choisir d'abord une catégorie</span>
                    ) : codesForCategorie(step.categorieSocioPro).length === 0 ? (
                      <span className="py-1 text-xs text-slate-400">Aucun code pour cette catégorie</span>
                    ) : (
                      codesForCategorie(step.categorieSocioPro).map((code) => {
                        const selected = parseCodes(step.categorieCode).includes(code);
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => toggleCode(idx, code)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                              selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {code}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <Input
                    placeholder="Rôle principal à ce niveau (optionnel)"
                    value={step.rolePrincipal}
                    onChange={(e) => patchStep(idx, { rolePrincipal: e.target.value })}
                  />
                </div>
                <Textarea
                  rows={2}
                  placeholder="Compétences et diplômes requis (optionnel)"
                  value={step.competencesDiplomes}
                  onChange={(e) => patchStep(idx, { competencesDiplomes: e.target.value })}
                />
                <Textarea
                  rows={2}
                  placeholder="Avantages liés à ce poste (optionnel)"
                  value={step.avantages}
                  onChange={(e) => patchStep(idx, { avantages: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button variant="ghost" size="sm" icon={<ArrowUp className="h-4 w-4" />} onClick={() => moveStep(idx, -1)} disabled={idx === 0} />
                <Button variant="ghost" size="sm" icon={<ArrowDown className="h-4 w-4" />} onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} />
                <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />} onClick={() => removeStep(idx)} disabled={steps.length === 1} />
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={addStep}>
          Ajouter une étape
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" icon={<X className="h-4 w-4" />} onClick={onCancel}>Annuler</Button>
        <Button type="button" loading={loading} icon={<Save className="h-4 w-4" />} onClick={handleSubmit}>Enregistrer</Button>
      </div>
    </div>
  );
}

export default function CareerProfilesSettingsTab() {
  const { data: res, isLoading } = useCareerProfiles();
  const profiles = res?.data ?? [];
  const createProfile = useCreateCareerProfile();
  const updateProfile = useUpdateCareerProfile();
  const deleteProfile = useDeleteCareerProfile();
  const duplicateProfile = useDuplicateCareerProfile();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [jobPositionModalOpen, setJobPositionModalOpen] = useState(false);
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);

  const handleCreate = async (data: any) => {
    const r = await createProfile.mutateAsync(data);
    if (r.success) setCreating(false);
  };

  const handleUpdate = async (data: any) => {
    const r = await updateProfile.mutateAsync({ id: editing.id, payload: data });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => {
    await deleteProfile.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Profils de carrière</h2>
          <p className="text-sm text-slate-500">
            Filières métier regroupant plusieurs postes selon un ordre de progression. Chaque employé
            retrouve, dans « Mon espace RH », le(s) profil(s) rattaché(s) à son poste actuel avec sa position mise en évidence.
            Un même poste peut appartenir à plusieurs profils, mais ne peut apparaître qu'une seule fois au sein d'un même profil.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Settings2 className="h-4 w-4" />} onClick={() => setJobPositionModalOpen(true)}>
            Gérer les postes
          </Button>
          <Button variant="secondary" icon={<Settings2 className="h-4 w-4" />} onClick={() => setDepartmentModalOpen(true)}>
            Gérer les départements
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Nouveau profil
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-4 shadow-lg">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-400/10" />
        <div className="absolute -left-6 -bottom-8 h-24 w-24 rounded-full bg-amber-400/10" />
        <div className="relative flex items-start gap-3">
          <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-sm font-semibold leading-relaxed text-transparent">
            Les promotions dans l'entreprise prennent en compte plusieurs paramètres que sont : Ancienneté + compétences +
            performances/KPI + niveau d'autonomie + responsabilités + capacité managériale + formation/diplôme.
          </p>
        </div>
      </div>

      {creating && (
        <Card>
          <h3 className="font-semibold text-slate-800 mb-4">Nouveau profil de carrière</h3>
          <ProfileForm onSave={handleCreate} onCancel={() => setCreating(false)} loading={createProfile.isPending} />
        </Card>
      )}

      {isLoading ? (
        <Card><SkeletonTable rows={3} /></Card>
      ) : profiles.length === 0 ? (
        <Card><p className="py-8 text-center text-slate-400">Aucun profil de carrière. Créez-en un.</p></Card>
      ) : (
        <div className="space-y-4">
          {profiles.map((p: any) => (
            <Card key={p.id}>
              {editing?.id === p.id ? (
                <>
                  <h3 className="font-semibold text-slate-800 mb-4">Modifier — {p.name}</h3>
                  <ProfileForm initial={p} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={updateProfile.isPending} />
                </>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="h-4 w-4 text-indigo-500" />
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      {!p.isActive && <Badge variant="default">Inactif</Badge>}
                    </div>
                    {p.description && <p className="text-sm text-slate-500 mb-2">{p.description}</p>}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.steps.map((s: any, idx: number) => (
                        <span key={s.id} className="flex items-center gap-1.5">
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-medium">
                            {idx + 1}. {s.poste}
                          </span>
                          {idx < p.steps.length - 1 && <span className="text-slate-300">→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="secondary" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => setEditing(p)}>
                      Modifier
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Copy className="h-4 w-4" />}
                      loading={duplicateProfile.isPending}
                      onClick={() => duplicateProfile.mutate(p.id)}
                      title="Dupliquer ce profil"
                    />
                    <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteTarget(p)} />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer le profil de carrière"
        message={`Supprimer le profil « ${deleteTarget?.name} » ? Ses postes redeviendront disponibles pour un autre profil.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <JobPositionModal open={jobPositionModalOpen} onClose={() => setJobPositionModalOpen(false)} />
      <DepartmentModal open={departmentModalOpen} onClose={() => setDepartmentModalOpen(false)} />
    </div>
  );
}
