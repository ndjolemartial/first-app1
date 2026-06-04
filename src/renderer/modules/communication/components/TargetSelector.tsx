import { useMemo, useState } from 'react';
import SearchSelect, { SearchSelectOption } from '../../../shared/components/ui/SearchSelect';
import Button from '../../../shared/components/ui/Button';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useClients } from '../../clients/hooks/useClients';
import { useOwners } from '../../owners/hooks/useOwners';
import { useConventions } from '../../conventions/hooks/useConventions';
import { X, User, Building2, FileText } from 'lucide-react';

/**
 * Cible d'un envoi de message — entité rattachée + destinataire résolu côté
 * serveur. La résolution (et donc le `to` final) est volontairement déléguée
 * à l'IPC `communication:resolveTarget` pour garantir la cohérence
 * (clientId/ownerId/conventionId stampés sur Communication).
 */
export interface MessageTarget {
  to:      string;
  label:   string;
  targets: { clientId?: number; ownerId?: number; conventionId?: number };
}

interface Props {
  channel:  'EMAIL' | 'SMS' | 'WHATSAPP';
  value:    MessageTarget | null;
  onChange: (target: MessageTarget | null) => void;
}

type EntityKind = 'CLIENT' | 'OWNER' | 'CONVENTION';

const KIND_TABS: Array<{ kind: EntityKind; label: string; icon: any }> = [
  { kind: 'CLIENT',     label: 'Client',       icon: User },
  { kind: 'OWNER',      label: 'Propriétaire', icon: Building2 },
  { kind: 'CONVENTION', label: 'Convention',   icon: FileText },
];

function clientLabel(c: any): string {
  if (c.type === 'ENTREPRISE') return c.entreprise || `Client #${c.id}`;
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || `Client #${c.id}`;
}
function ownerLabel(o: any): string {
  if (o.type === 'ENTREPRISE') return o.companyName || `Propriétaire #${o.id}`;
  return `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() || `Propriétaire #${o.id}`;
}
function conventionLabel(c: any): string {
  const ref = c.reference || `#${c.id}`;
  const client = c.client ? clientLabel(c.client) : '';
  return client ? `${ref} — ${client}` : ref;
}

export default function TargetSelector({ channel, value, onChange }: Props) {
  const [kind, setKind] = useState<EntityKind>('CLIENT');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore((s) => s.token);

  // Charge un large pool d'entités pour le combobox — la recherche est locale.
  const { data: clientsRes }     = useClients({},     1, 1000);
  const { data: ownersRes }      = useOwners({},      1, 1000);
  const { data: conventionsRes } = useConventions({}, 1, 1000);

  const options: SearchSelectOption[] = useMemo(() => {
    if (kind === 'CLIENT') {
      return (clientsRes?.data ?? []).map((c: any) => ({
        value: String(c.id),
        label: clientLabel(c),
      }));
    }
    if (kind === 'OWNER') {
      return (ownersRes?.data ?? []).map((o: any) => ({
        value: String(o.id),
        label: ownerLabel(o),
      }));
    }
    return (conventionsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: conventionLabel(c),
    }));
  }, [kind, clientsRes, ownersRes, conventionsRes]);

  const handleSelect = async (idStr: string) => {
    if (!idStr) { onChange(null); return; }
    setError(null);
    setResolving(true);
    try {
      const r = await window.electron.communication.resolveTarget(token!, {
        entityType: kind,
        entityId:   Number(idStr),
        channel,
      });
      if (!r.success) {
        setError(String(r.error ?? 'Erreur de résolution'));
        onChange(null);
        return;
      }
      onChange(r.data!);
    } finally {
      setResolving(false);
    }
  };

  if (value) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 flex items-center justify-between">
        <div className="text-sm">
          <p className="text-slate-500 text-xs">Destinataire ciblé</p>
          <p className="font-medium text-slate-900">{value.label}</p>
          <p className="text-slate-500 text-xs mt-0.5">{value.to}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-white"
          aria-label="Effacer la sélection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-700">Cibler une entité (optionnel)</p>
        <p className="text-xs text-slate-400">le destinataire sera rempli automatiquement</p>
      </div>
      <div className="flex gap-1 bg-white p-1 rounded-md w-fit border border-slate-200">
        {KIND_TABS.map(({ kind: k, label, icon: Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              kind === k ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <SearchSelect
        options={options}
        value=""
        onChange={handleSelect}
        disabled={resolving}
        placeholder={
          kind === 'CLIENT'     ? 'Rechercher un client…'
        : kind === 'OWNER'      ? 'Rechercher un propriétaire…'
                                : 'Rechercher une convention…'
        }
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
