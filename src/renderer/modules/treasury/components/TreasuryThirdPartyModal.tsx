import { useState } from 'react';
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useTreasuryThirdParties,
  useCreateTreasuryThirdParty,
  useUpdateTreasuryThirdParty,
  useDeleteTreasuryThirdParty,
} from '../hooks/useTreasury';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Notifié après création d'un tiers (pour le pré-sélectionner dans le formulaire). */
  onCreated?: (id: number) => void;
}

/**
 * Fenêtre d'édition des tiers de trésorerie (bénéficiaires / émetteurs).
 * Permet d'ajouter, modifier et supprimer les valeurs (Nom complet, Contacts)
 * proposées dans le champ « À destination de » / « En provenance de ».
 */
export default function TreasuryThirdPartyModal({ open, onClose, onCreated }: Props) {
  const { data: res } = useTreasuryThirdParties();
  const list: any[] = res?.success ? res.data ?? [] : [];

  const create = useCreateTreasuryThirdParty();
  const update = useUpdateTreasuryThirdParty();
  const remove = useDeleteTreasuryThirdParty();

  // Édition : null = formulaire d'ajout ; sinon id du tiers en cours d'édition.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fullName, setFullName] = useState('');
  const [contacts, setContacts] = useState('');
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<any | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setContacts('');
    setError('');
  };

  const startEdit = (tp: any) => {
    setEditingId(tp.id);
    setFullName(tp.fullName ?? '');
    setContacts(tp.contacts ?? '');
    setError('');
  };

  const handleSubmit = async () => {
    const name = fullName.trim();
    if (!name) {
      setError('Le nom complet est requis.');
      return;
    }
    const payload = { fullName: name, contacts: contacts.trim() || undefined };
    if (editingId) {
      const r: any = await update.mutateAsync({ id: editingId, payload });
      if (r.success) resetForm();
      else setError(typeof r.error === 'string' ? r.error : 'Erreur lors de l\'enregistrement');
    } else {
      const r: any = await create.mutateAsync(payload);
      if (r.success) {
        onCreated?.(r.data.id);
        resetForm();
      } else {
        setError(typeof r.error === 'string' ? r.error : 'Erreur lors de l\'enregistrement');
      }
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
        title="Tiers de trésorerie (bénéficiaires / émetteurs)"
        size="lg"
        footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
      >
        <div className="space-y-5">
          {/* Formulaire d'ajout / d'édition */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {editingId ? 'Modifier le tiers' : 'Ajouter un tiers'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nom complet"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex : Société XYZ, Jean Dupont…"
              />
              <Input
                label="Contacts"
                value={contacts}
                onChange={(e) => setContacts(e.target.value)}
                placeholder="Téléphone, email…"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              {editingId && (
                <Button variant="secondary" size="sm" icon={<X className="h-4 w-4" />} onClick={resetForm}>
                  Annuler
                </Button>
              )}
              <Button
                size="sm"
                icon={editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                loading={create.isPending || update.isPending}
                onClick={handleSubmit}
              >
                {editingId ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </div>

          {/* Liste des tiers existants */}
          {list.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun tiers enregistré.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {list.map((tp) => (
                <li key={tp.id} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{tp.fullName}</p>
                    {tp.contacts && <p className="text-xs text-slate-500 truncate">{tp.contacts}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil className="h-4 w-4" />}
                    onClick={() => startEdit(tp)}
                    title="Modifier"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="h-4 w-4 text-red-500" />}
                    onClick={() => setToDelete(tp)}
                    title="Supprimer"
                  />
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
        title="Supprimer le tiers"
        message={`Supprimer « ${toDelete?.fullName} » ? Les opérations déjà rattachées ne seront pas modifiées.`}
        confirmLabel="Supprimer"
        loading={remove.isPending}
      />
    </>
  );
}
