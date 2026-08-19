import { useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { usePermitCommunes, useSavePermitCommune, useDeletePermitCommune } from '../../permits/hooks/usePermitLibrary';
import { ZONE_TYPE_LABELS, toOptions } from '../../permits/utils/permitLabels';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface EditState { id?: number; nom: string; district: string; region: string; zoneType: string; isActive: boolean }
/** Écriture : SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT (même liste que côté IPC, `checkLibExtendedWrite` dans `permit-library.ipc.ts` — mêmes règles d'accès que le module Devis construction). */
const LIB_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/**
 * Communes et districts (Module 18) — utilisés pour la localisation d'un
 * projet de permis et pour les surcharges de taux par commune du catalogue
 * de prestations.
 */
export default function PermitCommunesSettingsTab() {
  const { data, isLoading } = usePermitCommunes(true);
  const save = useSavePermitCommune();
  const del = useDeletePermitCommune();
  const communes: any[] = data?.data ?? [];

  const role = useAuthStore((s) => s.user?.role);
  const canWrite = !!role && LIB_ADMIN_ROLES.includes(role);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ nom: '', district: '', region: '', zoneType: 'URBAINE', isActive: true });
  const startEdit = (c: any) => setEditing({ id: c.id, nom: c.nom, district: c.district ?? '', region: c.region ?? '', zoneType: c.zoneType, isActive: c.isActive });

  const onSave = async () => {
    if (!editing || !editing.nom.trim()) return;
    const r = await save.mutateAsync({
      id: editing.id,
      payload: { nom: editing.nom.trim(), district: editing.district || null, region: editing.region || null, zoneType: editing.zoneType, isActive: editing.isActive },
    });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Communes et districts de Côte d'Ivoire — sélectionnables sur un projet de permis de construire et pour surcharger un taux par commune dans le catalogue de prestations.</p>
        {canWrite && !editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle commune</Button>}
      </div>

      {canWrite && editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier la commune' : 'Nouvelle commune'}</h3>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Commune *" value={editing.nom} onChange={(e) => setEditing({ ...editing, nom: e.target.value })} placeholder="Ex: Cocody" />
            <Input label="District" value={editing.district} onChange={(e) => setEditing({ ...editing, district: e.target.value })} placeholder="Ex: Abidjan" />
            <Input label="Région" value={editing.region} onChange={(e) => setEditing({ ...editing, region: e.target.value })} />
            <Select label="Zone" options={toOptions(ZONE_TYPE_LABELS)} value={editing.zoneType} onChange={(e) => setEditing({ ...editing, zoneType: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="rounded border-slate-300" />
            Actif
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={onSave}>Enregistrer</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : communes.length === 0 ? (
          <EmptyState title="Aucune commune" description="Créez les communes du référentiel." action={canWrite ? { label: 'Nouvelle commune', onClick: startNew } : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Commune</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">District</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Région</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Zone</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                {canWrite && <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {communes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.nom}</td>
                  <td className="px-4 py-3 text-slate-500">{c.district ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.region ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{ZONE_TYPE_LABELS[c.zoneType]}</td>
                  <td className="px-4 py-3">{c.isActive ? <Badge variant="success">Actif</Badge> : <Badge variant="default">Inactif</Badge>}</td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(c)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(c)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {canWrite && (
        <ConfirmDialog open={!!toDelete} title="Supprimer la commune" message={`Supprimer « ${toDelete?.nom ?? ''} » ?`} onConfirm={handleDelete} onClose={() => setToDelete(null)} />
      )}
    </div>
  );
}
