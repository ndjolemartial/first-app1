import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { FileText } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { useUsers } from '../../users/hooks/useUsers';
import { useManualTemplateEditors, useUpdateManualTemplateEditors } from '../hooks/useSettings';
import { formatPersonName } from '../../../shared/utils/format';
import { roleLabel } from '../../../shared/utils/roleLabel';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Normalise pour une recherche insensible à la casse / aux accents. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Fenêtre de paramétrage des utilisateurs désignés (en plus de SUPER_ADMIN /
 * ADMIN, toujours en accès complet) autorisés à consulter, créer et modifier
 * les modèles de messages de type « manuel » — jamais les modèles « auto ».
 */
export default function ManualTemplateEditorsModal({ open, onClose }: Props) {
  const { data: usersRes } = useUsers({ isActive: true }, 1, 1000);
  const users: any[] = usersRes?.data ?? [];
  const { data: editorsRes } = useManualTemplateEditors();
  const update = useUpdateManualTemplateEditors();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');

  // Initialise la sélection à l'ouverture, depuis la liste enregistrée.
  useEffect(() => {
    if (open) {
      setSelected(new Set((editorsRes?.data?.userIds ?? []).map((id: number) => Number(id))));
      setQuery('');
    }
  }, [open, editorsRes]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return users;
    return users.filter((u) =>
      norm(`${formatPersonName(u, '')} ${u.matricule ?? ''} ${u.role ?? ''}`).includes(q),
    );
  }, [users, query]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSave = async () => {
    const r = await update.mutateAsync([...selected]);
    if (r.success) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Utilisateurs autorisés — modèles manuels"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} loading={update.isPending}>
            Enregistrer ({selected.size})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg bg-blue-50/60 px-3 py-2.5 text-xs text-slate-600">
          <FileText className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <p>
            Les utilisateurs sélectionnés ci-dessous voient l'onglet « Modèles de messages » et
            peuvent y consulter, créer et modifier des modèles de type <strong>manuel</strong>
            uniquement — jamais les modèles « auto » (relances automatiques), et sans pouvoir en
            supprimer. SUPER ADMIN et ADMIN gardent, par leur rôle, un accès complet indépendant
            de cette liste.
          </p>
        </div>

        <Input
          placeholder="Rechercher un utilisateur…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucun utilisateur.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
            {filtered.map((u) => {
              const checked = selected.has(u.id);
              return (
                <li key={u.id}>
                  <label
                    className={clsx(
                      'flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50',
                      checked && 'bg-blue-50/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(u.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-slate-800">
                        {formatPersonName(u, `Utilisateur #${u.id}`)}
                      </span>
                      {u.matricule && <span className="ml-2 text-xs text-slate-400">{u.matricule}</span>}
                    </span>
                    <span className="text-xs text-slate-500">{roleLabel(u.role)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
