import { useEffect, useMemo, useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Modal from '../../../shared/components/ui/Modal';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useRatioProfiles, useRatioProfile, useSaveRatioProfile, useDeleteRatioProfile, useDuplicateRatioProfile, useRatioDefinitions,
} from '../../construction/hooks/useConstructionLibrary';
import { BUILDING_TYPE_LABELS, STANDING_LABELS, toOptions } from '../../construction/utils/constructionLabels';
import { Plus, Edit, Trash2, Copy, Save, X } from 'lucide-react';

/** Profils de coefficients par (type de bâtiment × standing) — moteur du Module 17. */
export default function ConstructionRatioProfilesSettingsTab() {
  const { data, isLoading } = useRatioProfiles();
  const { data: defsRes } = useRatioDefinitions();
  const del = useDeleteRatioProfile();
  const profiles: any[] = data?.data ?? [];
  const definitions: any[] = defsRes?.data ?? [];

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [duplicateOf, setDuplicateOf] = useState<any>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Un profil = un jeu de coefficients pour un couple (type de bâtiment × standing).</p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditingId('new')}>Nouveau profil</Button>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={4} /></div>
        ) : profiles.length === 0 ? (
          <EmptyState title="Aucun profil" description="Créez un profil de coefficients." action={{ label: 'Nouveau profil', onClick: () => setEditingId('new') }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type de bâtiment</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Standing</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Coefficients renseignés</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{BUILDING_TYPE_LABELS[p.buildingType]}</td>
                  <td className="px-4 py-3 text-slate-500">{STANDING_LABELS[p.standing]}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{p._count?.values ?? 0} / {definitions.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Copy className="h-4 w-4" />} title="Dupliquer" onClick={() => setDuplicateOf(p)} />
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => setEditingId(p.id)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(p)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editingId !== null && (
        <RatioProfileEditorModal id={editingId === 'new' ? undefined : editingId} definitions={definitions} onClose={() => setEditingId(null)} />
      )}

      {duplicateOf && (
        <DuplicateProfileModal profile={duplicateOf} onClose={() => setDuplicateOf(null)} />
      )}

      <ConfirmDialog open={!!toDelete} title="Supprimer le profil" message={`Supprimer le profil « ${toDelete?.name ?? ''} » ? Cette action est irréversible (les estimations déjà générées conservent leur snapshot de coefficients).`} onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }} onClose={() => setToDelete(null)} />
    </div>
  );
}

function RatioProfileEditorModal({ id, definitions, onClose }: { id?: number; definitions: any[]; onClose: () => void }) {
  const { data: profileRes } = useRatioProfile(id ?? 0);
  const save = useSaveRatioProfile();
  const profile = profileRes?.data;

  const [name, setName] = useState('');
  const [buildingType, setBuildingType] = useState('VILLA_BASSE');
  const [standing, setStanding] = useState('MOYEN_STANDING');
  const [values, setValues] = useState<Record<number, string>>({});

  useEffect(() => {
    if (profile) {
      setName(profile.name); setBuildingType(profile.buildingType); setStanding(profile.standing);
      const v: Record<number, string> = {};
      for (const val of profile.values ?? []) v[val.ratioDefinitionId] = String(Number(val.value));
      setValues(v);
    }
  }, [profile]);

  const categories = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of definitions) {
      const cat = d.category || 'Autres';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(d);
    }
    return [...map.entries()];
  }, [definitions]);

  const onSave = async () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(), buildingType, standing,
      values: Object.entries(values).filter(([, v]) => v !== '').map(([ratioDefinitionId, value]) => ({ ratioDefinitionId: Number(ratioDefinitionId), value: Number(value) })),
    };
    const r = await save.mutateAsync({ id, payload });
    if (r.success) onClose();
  };

  return (
    <Modal open onClose={onClose} title={id ? 'Modifier le profil' : 'Nouveau profil de coefficients'} size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={onSave}>Enregistrer</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Input label="Nom *" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Type de bâtiment" options={toOptions(BUILDING_TYPE_LABELS)} value={buildingType} onChange={(e) => setBuildingType(e.target.value)} />
          <Select label="Standing" options={toOptions(STANDING_LABELS)} value={standing} onChange={(e) => setStanding(e.target.value)} />
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
          {categories.map(([cat, defs]) => (
            <div key={cat}>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">{cat}</h4>
              <div className="grid grid-cols-2 gap-2">
                {defs.map((d) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-slate-600 truncate" title={d.label}>{d.label}</span>
                    <input type="number" step="0.0001" placeholder={String(Number(d.defaultValue))} value={values[d.id] ?? ''}
                      onChange={(e) => setValues({ ...values, [d.id]: e.target.value })}
                      className="w-28 px-2 py-1 border border-slate-200 rounded text-sm text-right" />
                    {d.unit && <span className="w-10 text-xs text-slate-400">{d.unit}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">Champ vide = valeur par défaut du catalogue (affichée en filigrane) utilisée pour ce profil.</p>
      </div>
    </Modal>
  );
}

function DuplicateProfileModal({ profile, onClose }: { profile: any; onClose: () => void }) {
  const [name, setName] = useState(`${profile.name} (copie)`);
  const [buildingType, setBuildingType] = useState(profile.buildingType);
  const [standing, setStanding] = useState(profile.standing);
  const duplicate = useDuplicateRatioProfile();

  const onConfirm = async () => {
    const r = await duplicate.mutateAsync({ id: profile.id, target: { name, buildingType, standing } });
    if (r.success) onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Dupliquer « ${profile.name} »`} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button loading={duplicate.isPending} onClick={onConfirm}>Dupliquer</Button></>}
    >
      <div className="space-y-3">
        <Input label="Nom du nouveau profil" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Type de bâtiment" options={toOptions(BUILDING_TYPE_LABELS)} value={buildingType} onChange={(e) => setBuildingType(e.target.value)} />
        <Select label="Standing" options={toOptions(STANDING_LABELS)} value={standing} onChange={(e) => setStanding(e.target.value)} />
      </div>
    </Modal>
  );
}
