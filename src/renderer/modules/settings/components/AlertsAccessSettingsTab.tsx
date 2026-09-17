import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { BellRing, Save } from 'lucide-react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useUsers } from '../../users/hooks/useUsers';
import { useAlertsAuthorizedUsers, useUpdateAlertsAuthorizedUsers } from '../hooks/useSettings';
import { formatPersonName } from '../../../shared/utils/format';
import { roleLabel } from '../../../shared/utils/roleLabel';

/** Normalise pour une recherche insensible à la casse / aux accents. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Rôles à plein accès par défaut aux Alertes — contrairement au reste du
// Module 19, CONFORMITE et ACCOUNTANT n'y sont PAS inclus d'office : ils
// doivent donc pouvoir être sélectionnés ci-dessous comme n'importe quel
// autre rôle.
const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/**
 * Paramétrage des utilisateurs individuellement autorisés à accéder à
 * l'interface « Alertes » (`/aml/alerts`) alors que leur rôle n'en fait pas
 * partie par défaut — seuls SUPER_ADMIN, ADMIN et MANAGER y accèdent
 * d'office, contrairement au reste du module 19 (CONFORMITE et ACCOUNTANT
 * y compris).
 */
export default function AlertsAccessSettingsTab() {
  const { data: usersRes, isLoading: usersLoading } = useUsers({ isActive: true }, 1, 1000);
  const users: any[] = (usersRes?.data ?? []).filter((u: any) => !FULL_ACCESS_ROLES.includes(u.role));
  const { data: authorizedRes, isLoading } = useAlertsAuthorizedUsers();
  const update = useUpdateAlertsAuthorizedUsers();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (authorizedRes?.success) {
      setSelected(new Set((authorizedRes.data?.userIds ?? []).map((id: number) => Number(id))));
    }
  }, [authorizedRes]);

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

  const save = () => update.mutate([...selected]);

  if (isLoading || usersLoading) return <Card><SkeletonTable rows={5} /></Card>;

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-slate-500" />
        <h3 className="font-semibold text-slate-700">Alertes — accès</h3>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        L'interface <strong>Alertes</strong> est accessible aux rôles <strong>SUPER_ADMIN, ADMIN et
        MANAGER</strong> par défaut — contrairement au reste du module Conformité LBC/FT, les rôles
        <strong> CONFORMITE et ACCOUNTANT (Comptable) n'y ont pas accès d'office</strong>. Sélectionnez
        ci-dessous les employés qui doivent malgré tout y avoir accès individuellement.
      </p>

      <Input
        placeholder="Rechercher un utilisateur…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3"
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          {users.length === 0 ? 'Aucun utilisateur actif en dehors des rôles à plein accès.' : 'Aucun résultat.'}
        </p>
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
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

      <div className="flex justify-end pt-4">
        <Button icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={save}>
          Enregistrer ({selected.size})
        </Button>
      </div>
    </Card>
  );
}
