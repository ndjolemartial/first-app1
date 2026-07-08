import { useState } from 'react';
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useQuoteUnits, useSaveQuoteUnit, useDeleteQuoteUnit } from '../hooks/useQuotes';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Notifié après création d'une unité (pour la pré-sélectionner sur la ligne). */
  onCreated?: (label: string) => void;
}

/**
 * Fenêtre d'édition des unités de mesure (référentiel partagé avec le module
 * Performances). Permet d'ajouter, renommer et supprimer les valeurs proposées
 * dans la colonne « Unité » des lignes de devis.
 */
export default function QuoteUnitModal({ open, onClose, onCreated }: Props) {
  const { data: res } = useQuoteUnits();
  const list: any[] = res?.success ? res.data ?? [] : [];

  const save = useSaveQuoteUnit();
  const remove = useDeleteQuoteUnit();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<any | null>(null);

  const resetForm = () => { setEditingId(null); setLabel(''); setError(''); };
  const startEdit = (u: any) => { setEditingId(u.id); setLabel(u.label ?? ''); setError(''); };

  const handleSubmit = async () => {
    const name = label.trim();
    if (!name) { setError('Le libellé est requis.'); return; }
    const r: any = await save.mutateAsync({ id: editingId ?? undefined, payload: { label: name } });
    if (r.success) {
      if (!editingId) onCreated?.(r.data.label);
      resetForm();
    } else {
      setError(typeof r.error === 'string' ? r.error : 'Erreur lors de l’enregistrement');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await remove.mutateAsync(toDelete.id);
    if (editingId === toDelete.id) resetForm();
    setToDelete(null);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Unités de mesure"
        size="lg"
        footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">{editingId ? 'Modifier l’unité' : 'Ajouter une unité'}</h3>
            <Input
              label="Libellé de l’unité"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex : m², kg, pièce, jour, forfait…"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              {editingId && (
                <Button variant="secondary" size="sm" icon={<X className="h-4 w-4" />} onClick={resetForm}>Annuler</Button>
              )}
              <Button
                size="sm"
                icon={editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                loading={save.isPending}
                onClick={handleSubmit}
              >
                {editingId ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </div>

          {list.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune unité enregistrée.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 max-h-72 overflow-y-auto">
              {list.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50">
                  <span className="flex-1 min-w-0 truncate font-medium text-slate-800">{u.label}</span>
                  <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => startEdit(u)} title="Modifier" />
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />} onClick={() => setToDelete(u)} title="Supprimer" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Supprimer l’unité"
        message={`Supprimer « ${toDelete?.label} » ? Les lignes de devis utilisant déjà cette unité ne seront pas modifiées.`}
        confirmLabel="Supprimer"
        loading={remove.isPending}
      />
    </>
  );
}
