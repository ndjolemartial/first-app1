import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Users } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { useTreasuryUsers, useSetAccountViewers } from '../../treasury/hooks/useTreasury';
import { formatPersonName } from '../../../shared/utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Compte ciblé (id, name, viewers: [{ userId }]). */
  account: any | null;
}

/** Normalise pour une recherche insensible à la casse / aux accents. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Fenêtre de paramétrage de la liste d'affichage d'un compte de trésorerie :
 * sélectionne les utilisateurs pour lesquels le compte apparaît dans le bloc
 * « Comptes de trésorerie ». Les SUPER_ADMIN / ADMIN voient tous les comptes ;
 * laisser la liste vide masque le compte aux autres rôles.
 */
export default function AccountViewersModal({ open, onClose, account }: Props) {
  const { data: usersRes } = useTreasuryUsers();
  const users: any[] = usersRes?.data ?? [];
  const setViewers = useSetAccountViewers();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');

  // Initialise la sélection à l'ouverture (ou au changement de compte).
  useEffect(() => {
    if (open && account) {
      setSelected(new Set((account.viewers ?? []).map((v: any) => Number(v.userId))));
      setQuery('');
    }
  }, [open, account]);

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
    if (!account) return;
    const r = await setViewers.mutateAsync({ id: account.id, userIds: [...selected] });
    if (r.success) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Affichage du compte${account ? ` — ${account.name}` : ''}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} loading={setViewers.isPending}>
            Enregistrer ({selected.size})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg bg-blue-50/60 px-3 py-2.5 text-xs text-slate-600">
          <Users className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <p>
            Sélectionnez les utilisateurs pour lesquels ce compte s'affiche dans le bloc
            « Comptes de trésorerie ». Les rôles SUPER ADMIN et ADMIN voient tous les comptes.
            Une liste vide masque le compte aux autres rôles.
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
                    <span className="text-xs text-slate-500">{u.role}</span>
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
