import { useEffect, useMemo, useState } from 'react';
import SearchSelect, { SearchSelectOption } from '../../../shared/components/ui/SearchSelect';
import Button from '../../../shared/components/ui/Button';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { useClients } from '../../clients/hooks/useClients';
import { useOwners } from '../../owners/hooks/useOwners';
import { useConventions } from '../../conventions/hooks/useConventions';
import { X, User, Building2, FileText, UserRound } from 'lucide-react';

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
  /**
   * Valeurs des variables ({{firstName}}, {{conventionRef}}…) résolues côté
   * serveur pour l'entité ciblée. Utilisées pour substituer immédiatement les
   * variables d'un modèle dans le formulaire d'envoi.
   */
  variables?: Record<string, string>;
}

interface Props {
  channel:  'EMAIL' | 'SMS' | 'WHATSAPP';
  value:    MessageTarget | null;
  onChange: (target: MessageTarget | null) => void;
  /** Notifie le parent quand l'onglet « Particulier » (saisie libre) est actif. */
  onParticulierChange?: (isParticulier: boolean) => void;
}

type EntityKind = 'CLIENT' | 'OWNER' | 'CONVENTION' | 'PARTICULIER';

// Onglets de ciblage par entité — réservés aux rôles privilégiés.
const ENTITY_TABS: Array<{ kind: EntityKind; label: string; icon: any }> = [
  { kind: 'CLIENT',     label: 'Client',       icon: User },
  { kind: 'OWNER',      label: 'Propriétaire', icon: Building2 },
  { kind: 'CONVENTION', label: 'Convention',   icon: FileText },
];

// Onglet « Particulier » : saisie libre du destinataire, visible par TOUS les rôles.
const PARTICULIER_TAB = { kind: 'PARTICULIER' as EntityKind, label: 'Particulier', icon: UserRound };

// Rôles autorisés à cibler une entité (Client / Propriétaire / Convention).
// Les autres rôles ne voient que l'onglet « Particulier ».
const ENTITY_TARGET_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

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

export default function TargetSelector({ channel, value, onChange, onParticulierChange }: Props) {
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canTargetEntities = ENTITY_TARGET_ROLES.includes(role);
  // Onglets visibles : Client/Propriétaire/Convention (privilégiés) puis Particulier,
  // ou uniquement Particulier pour les autres rôles.
  const tabs = canTargetEntities ? [...ENTITY_TABS, PARTICULIER_TAB] : [PARTICULIER_TAB];

  const [kind, setKind] = useState<EntityKind>(canTargetEntities ? 'CLIENT' : 'PARTICULIER');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore((s) => s.token);

  // Informe le parent de l'état « Particulier » (à l'initialisation et à chaque changement).
  useEffect(() => {
    onParticulierChange?.(kind === 'PARTICULIER');
  }, [kind, onParticulierChange]);

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

  // Recherche côté serveur pour les entités à fort volume (Client / Propriétaire).
  // Le `toOption` réplique exactement le format de libellé des préchargements ci-dessus.
  const searchClients = useMemo(
    () => makeEntitySearch(
      (filters, page, limit) => window.electron.clients.list(token!, filters, page, limit),
      (c: any) => ({ value: String(c.id), label: clientLabel(c) }),
    ),
    [token],
  );
  const searchOwners = useMemo(
    () => makeEntitySearch(
      (filters, page, limit) => window.electron.owners.list(token!, filters, page, limit),
      (o: any) => ({ value: String(o.id), label: ownerLabel(o) }),
    ),
    [token],
  );
  // Sélection dynamique selon l'onglet courant ; les conventions restent en
  // filtrage local (hors périmètre de la recherche serveur demandée).
  const onSearch =
    kind === 'CLIENT' ? searchClients
  : kind === 'OWNER'  ? searchOwners
                      : undefined;

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
        {tabs.map(({ kind: k, label, icon: Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => { setKind(k); if (k === 'PARTICULIER') onChange(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              kind === k ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      {kind === 'PARTICULIER' ? (
        <p className="text-xs text-slate-500">
          Saisissez directement le destinataire (email ou numéro) dans le champ ci-dessous.
        </p>
      ) : (
        <SearchSelect
          options={options}
          onSearch={onSearch}
          value=""
          onChange={handleSelect}
          disabled={resolving}
          placeholder={
            kind === 'CLIENT'     ? 'Rechercher un client…'
          : kind === 'OWNER'      ? 'Rechercher un propriétaire…'
                                  : 'Rechercher une convention…'
          }
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
