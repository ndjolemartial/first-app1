import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react';
import VisitorsTabs from '../components/VisitorsTabs';
import {
  useVisitObjects, useCreateVisitObject, useUpdateVisitObject, useDeleteVisitObject,
} from '../hooks/useVisitors';

interface VisitObject { id: number; label: string; isActive: boolean }

export default function VisitObjectsPage() {
  const { data: res, isLoading } = useVisitObjects(true);
  const create = useCreateVisitObject();
  const update = useUpdateVisitObject();
  const del = useDeleteVisitObject();

  const [newLabel, setNewLabel] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VisitObject | null>(null);

  const objects: VisitObject[] = res?.data ?? [];

  const add = async () => {
    const v = newLabel.trim();
    if (!v) return;
    const r = await create.mutateAsync(v);
    if (r.success) setNewLabel('');
  };

  const saveEdit = async (id: number) => {
    const v = editLabel.trim();
    if (!v) return;
    const r = await update.mutateAsync({ id, payload: { label: v } });
    if (r.success) { setEditId(null); setEditLabel(''); }
  };

  return (
    <PageLayout
      title="Gestion des visiteurs"
      breadcrumbs={[{ label: 'Gestion des visiteurs', to: '/visitors' }, { label: 'Objets de visite' }]}
    >
      <VisitorsTabs />

      <Card className="mb-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Objets de visite</h3>
        <p className="mb-3 text-xs text-slate-500">
          Ces valeurs alimentent le champ « Objet de visite » (sélecteur avec recherche) du formulaire interne et du formulaire web public.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1 max-w-sm">
            <Input
              label="Nouvel objet de visite"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            />
          </div>
          <Button icon={<Plus className="h-4 w-4" />} loading={create.isPending} onClick={add}>Ajouter</Button>
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <p className="p-6 text-sm text-slate-400">Chargement…</p>
        ) : objects.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Aucun objet de visite. Ajoutez-en un ci-dessus.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Libellé</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {objects.map((o) => (
                <tr key={o.id} className={o.isActive ? '' : 'bg-slate-50/60'}>
                  <td className="px-4 py-2">
                    {editId === o.id ? (
                      <input
                        autoFocus
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(o.id); if (e.key === 'Escape') setEditId(null); }}
                        className="w-full max-w-sm rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="font-medium text-slate-800">{o.label}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={o.isActive ? 'success' : 'default'}>{o.isActive ? 'Actif' : 'Inactif'}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      {editId === o.id ? (
                        <>
                          <button onClick={() => saveEdit(o.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Enregistrer"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded" title="Annuler"><X className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => update.mutate({ id: o.id, payload: { isActive: !o.isActive } })}
                            className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            title={o.isActive ? 'Désactiver' : 'Activer'}
                          >
                            {o.isActive ? 'Désactiver' : 'Activer'}
                          </button>
                          <button onClick={() => { setEditId(o.id); setEditLabel(o.label); }} className="p-1.5 text-slate-400 hover:text-blue-600" title="Renommer"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteTarget(o)} className="p-1.5 text-slate-400 hover:text-red-500" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer l'objet de visite"
        message={`Supprimer « ${deleteTarget?.label} » ? Les visites déjà enregistrées avec cet objet ne sont pas modifiées.`}
        onConfirm={async () => { if (deleteTarget) await del.mutateAsync(deleteTarget.id); setDeleteTarget(null); }}
        onClose={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
