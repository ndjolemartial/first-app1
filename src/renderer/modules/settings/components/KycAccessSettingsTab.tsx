import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ShieldCheck, Save } from 'lucide-react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useUsers } from '../../users/hooks/useUsers';
import { useKycAuthorizedUsers, useUpdateKycAuthorizedUsers } from '../hooks/useSettings';
import { formatPersonName } from '../../../shared/utils/format';
import { roleLabel } from '../../../shared/utils/roleLabel';

/** Normalise pour une recherche insensible à la casse / aux accents. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const RESTRICTED_ROLES = ['AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION', 'READONLY'];

/**
 * Paramétrage des utilisateurs individuellement autorisés à utiliser les
 * boutons « Fiche KYC » / « Fiche KYC non renseignée » (Clients, Propriétaires,
 * Apporteurs d'affaire) alors que leur rôle (AGENT, AGENT_TECHNIQUE,
 * ASSISTANTE_DIRECTION, READONLY) en est par défaut exclu. Tous les autres
 * rôles conservent un accès complet, indépendamment de cette liste.
 */
export default function KycAccessSettingsTab() {
  const { data: usersRes, isLoading: usersLoading } = useUsers({ isActive: true }, 1, 1000);
  const users: any[] = (usersRes?.data ?? []).filter((u: any) => RESTRICTED_ROLES.includes(u.role));
  const { data: authorizedRes, isLoading } = useKycAuthorizedUsers();
  const update = useUpdateKycAuthorizedUsers();

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
        <ShieldCheck className="h-4 w-4 text-slate-500" />
        <h3 className="font-semibold text-slate-700">Fiche KYC — accès individuel</h3>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Les boutons <strong>« Fiche KYC »</strong> et <strong>« Fiche KYC non renseignée »</strong> (Clients,
        Propriétaires, Apporteurs d'affaire) sont, par défaut, masqués pour les rôles <strong>Agent, Agent
        technique, Assistante de direction et Lecture seule</strong>. Tous les autres rôles y ont un accès
        complet, sans restriction. Sélectionnez ci-dessous les utilisateurs de ces 4 rôles qui doivent malgré
        tout y avoir accès individuellement.
      </p>

      <Input
        placeholder="Rechercher un utilisateur…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3"
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          {users.length === 0 ? 'Aucun utilisateur actif dans ces rôles.' : 'Aucun résultat.'}
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
