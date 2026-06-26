import { useEffect, useMemo, useState } from 'react';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';

/** Champ de rattachement d'un document : couvre les 14 entités cibles. */
export type DocumentLinks = {
  clientId: string;
  ownerId: string;
  propertyId: string;
  conventionId: string;
  terrainId: string;
  lotissementId: string;
  programmeId: string;
  projectId: string;
  prospectId: string;
  referrerId: string;
  linkedUserId: string;
  invoiceId: string;
  commissionId: string;
  attestationId: string;
  treasuryOperationId: string;
};

export const EMPTY_LINKS: DocumentLinks = {
  clientId: '', ownerId: '', propertyId: '', conventionId: '',
  terrainId: '', lotissementId: '', programmeId: '', projectId: '',
  prospectId: '', referrerId: '', linkedUserId: '', invoiceId: '',
  commissionId: '', attestationId: '', treasuryOperationId: '',
};

type SelectOption = { value: string; label: string };

function useEntityOptions(
  loader: () => Promise<{ success?: boolean; data?: any[] }>,
  labelOf: (item: any) => string,
): SelectOption[] {
  const [options, setOptions] = useState<SelectOption[]>([]);
  useEffect(() => {
    loader().then((r) => {
      const list: any[] = r?.success ? (r.data as any[]) ?? [] : [];
      setOptions(list.map((i) => ({ value: String(i.id), label: labelOf(i) })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return options;
}

const personLabel = (p: any, fallback = '') => formatPersonName(p, fallback);

interface Props {
  values: DocumentLinks;
  onChange: (field: keyof DocumentLinks, value: string) => void;
  /** Compact = grille à 3 colonnes (utile dans les modales). */
  compact?: boolean;
  /** Restreint l'affichage à ces seuls champs (liste blanche). */
  visibleFields?: Array<keyof DocumentLinks>;
}

/**
 * Grille de sélecteurs pour rattacher un document GED à une ou plusieurs
 * entités métier. Toutes les valeurs sont des `string` (vide = pas de lien).
 */
export default function DocumentLinksFields({ values, onChange, compact = false, visibleFields }: Props) {
  const token = useAuthStore((s) => s.token)!;

  const clients = useEntityOptions(
    () => window.electron.clients.list(token, {}, 1, 500),
    (c) => personLabel(c, `Client #${c.id}`),
  );
  const owners = useEntityOptions(
    () => window.electron.owners.list(token, {}, 1, 500),
    (o) => personLabel(o, `Propriétaire #${o.id}`),
  );
  const prospects = useEntityOptions(
    () => window.electron.prospects.list(token, {}, 1, 500),
    (p) => personLabel(p, `Prospect #${p.id}`),
  );
  const referrers = useEntityOptions(
    () => window.electron.commissions.listReferrers(token, {}, 1, 500),
    (r) => r.companyName || personLabel(r, `Apporteur #${r.id}`),
  );
  const users = useEntityOptions(
    // Utilisateurs actifs, filtrés par rôle côté serveur selon le rôle connecté.
    // `assistanteFullAccess` : dans ce contexte d'archivage, l'Assistante de
    // Direction accède à l'ensemble des utilisateurs actifs.
    () => window.electron.users.listSelectable(token, { assistanteFullAccess: true }),
    (u) => `${personLabel(u, `Utilisateur #${u.id}`)}${u.matricule ? ` (${u.matricule})` : ''}`,
  );
  const properties = useEntityOptions(
    () => window.electron.properties.list(token, {}, 1, 500),
    (p) => p.reference,
  );
  const terrains = useEntityOptions(
    () => window.electron.terrains.list(token, {}, 1, 500),
    // Format identique à l'interface « Nouvelle activité » :
    // référence — Îlot X, Lot Y — Nom du lotissement.
    (t) => {
      const loc = [
        t.numeroIlot ? `Îlot ${t.numeroIlot}` : '',
        t.numeroParcelle ? `Lot ${t.numeroParcelle}` : '',
      ].filter(Boolean).join(', ');
      return `${t.reference}${loc ? ` — ${loc}` : ''}${t.lotissement?.nom ? ` — ${t.lotissement.nom}` : ''}`;
    },
  );
  const lotissements = useEntityOptions(
    () => window.electron.lotissements.list(token, {}, 1, 500),
    (l) => `${l.reference} · ${l.nom}`,
  );
  const programmes = useEntityOptions(
    () => window.electron.programmes.list(token, {}, 1, 500),
    (p) => `${p.reference} · ${p.nom}`,
  );
  const projects = useEntityOptions(
    () => window.electron.projects.list(token, {}, 1, 500),
    (p) => `${p.reference} · ${p.nom}`,
  );
  const conventions = useEntityOptions(
    () => window.electron.conventions.list(token, {}, 1, 500),
    // Format identique à « Nouvelle activité » : référence — nom du client.
    (c) => {
      const cn = personLabel(c.client, '');
      return cn ? `${c.reference} — ${cn}` : c.reference;
    },
  );
  const invoices = useEntityOptions(
    () => window.electron.accounting.getInvoices(token, {}, 1, 500),
    // Format identique à « Nouvelle activité » : référence — nom du client.
    (i) => {
      const cn = personLabel(i.client, '');
      return cn ? `${i.reference} — ${cn}` : i.reference;
    },
  );
  const attestations = useEntityOptions(
    () => window.electron.attestations.list(token, {}, 1, 500),
    (a) => a.reference,
  );
  const commissions = useEntityOptions(
    () => window.electron.commissions.list(token, {}, 1, 500),
    (c) => c.reference,
  );
  const treasuryOperations = useEntityOptions(
    () => window.electron.treasury.listOperations(token, {}, 1, 500),
    (o) => `${o.reference} · ${o.label}`,
  );

  // ── Recherche serveur pour les entités en fort volume (client, propriétaire,
  // prospect, bien, terrain). Le `toOption` réplique exactement le libellé
  // utilisé par le préchargement `useEntityOptions` correspondant ci-dessus.
  const searchClients = useMemo(
    () => makeEntitySearch(
      (filters, page, limit) => window.electron.clients.list(token, filters, page, limit),
      (c) => ({ value: String(c.id), label: personLabel(c, `Client #${c.id}`) }),
    ),
    [token],
  );
  const searchOwners = useMemo(
    () => makeEntitySearch(
      (filters, page, limit) => window.electron.owners.list(token, filters, page, limit),
      (o) => ({ value: String(o.id), label: personLabel(o, `Propriétaire #${o.id}`) }),
    ),
    [token],
  );
  const searchProspects = useMemo(
    () => makeEntitySearch(
      (filters, page, limit) => window.electron.prospects.list(token, filters, page, limit),
      (p) => ({ value: String(p.id), label: personLabel(p, `Prospect #${p.id}`) }),
    ),
    [token],
  );
  const searchProperties = useMemo(
    () => makeEntitySearch(
      (filters, page, limit) => window.electron.properties.list(token, filters, page, limit),
      (p) => ({ value: String(p.id), label: p.reference }),
    ),
    [token],
  );
  const searchTerrains = useMemo(
    () => makeEntitySearch(
      (filters, page, limit) => window.electron.terrains.list(token, filters, page, limit),
      (t) => {
        const loc = [
          t.numeroIlot ? `Îlot ${t.numeroIlot}` : '',
          t.numeroParcelle ? `Lot ${t.numeroParcelle}` : '',
        ].filter(Boolean).join(', ');
        return {
          value: String(t.id),
          label: `${t.reference}${loc ? ` — ${loc}` : ''}${t.lotissement?.nom ? ` — ${t.lotissement.nom}` : ''}`,
        };
      },
    ),
    [token],
  );

  // ── Recherche serveur pour les autres entités rattachables (référence/nom).
  // Endpoints confirmés supportant `{ search }` + pagination. `users` est exclu
  // (liste restreinte par rôle, sans pagination → filtrage local conservé).
  const searchReferrers = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.commissions.listReferrers(token, f, p, l),
    (r) => ({ value: String(r.id), label: r.companyName || personLabel(r, `Apporteur #${r.id}`) }),
  ), [token]);
  const searchConventions = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.conventions.list(token, f, p, l),
    (c) => { const cn = personLabel(c.client, ''); return { value: String(c.id), label: cn ? `${c.reference} — ${cn}` : c.reference }; },
  ), [token]);
  const searchInvoices = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.accounting.getInvoices(token, f, p, l),
    (i) => { const cn = personLabel(i.client, ''); return { value: String(i.id), label: cn ? `${i.reference} — ${cn}` : i.reference }; },
  ), [token]);
  const searchAttestations = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.attestations.list(token, f, p, l),
    (a) => ({ value: String(a.id), label: a.reference }),
  ), [token]);
  const searchCommissions = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.commissions.list(token, f, p, l),
    (c) => ({ value: String(c.id), label: c.reference }),
  ), [token]);
  const searchTreasuryOperations = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.treasury.listOperations(token, f, p, l),
    (o) => ({ value: String(o.id), label: `${o.reference} · ${o.label}` }),
  ), [token]);
  const searchLotissements = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.lotissements.list(token, f, p, l),
    (l) => ({ value: String(l.id), label: `${l.reference} · ${l.nom}` }),
  ), [token]);
  const searchProgrammes = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.programmes.list(token, f, p, l),
    (p) => ({ value: String(p.id), label: `${p.reference} · ${p.nom}` }),
  ), [token]);
  const searchProjects = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.projects.list(token, f, p, l),
    (p) => ({ value: String(p.id), label: `${p.reference} · ${p.nom}` }),
  ), [token]);

  const opts = (list: SelectOption[], placeholder = '— Aucun —') =>
    [{ value: '', label: placeholder }, ...list];

  type EntitySearch = (query: string) => Promise<SelectOption[]>;
  const fields: Array<[keyof DocumentLinks, string, SelectOption[], EntitySearch?]> = [
    ['clientId',      'Client',              clients,    searchClients],
    ['ownerId',       'Propriétaire',        owners,     searchOwners],
    ['prospectId',    'Prospect',            prospects,  searchProspects],
    ['referrerId',    "Apporteur d'affaires", referrers, searchReferrers],
    ['linkedUserId',  'Utilisateur',         users],
    ['propertyId',    'Bien',                properties, searchProperties],
    ['terrainId',     'Terrain',             terrains,   searchTerrains],
    ['lotissementId', 'Lotissement',         lotissements, searchLotissements],
    ['programmeId',   'Programme',           programmes, searchProgrammes],
    ['projectId',     'Projet',              projects,   searchProjects],
    ['conventionId',  'Convention',          conventions, searchConventions],
    ['invoiceId',     'Facture',             invoices,   searchInvoices],
    ['attestationId', 'Attestation',         attestations, searchAttestations],
    ['commissionId',  'Commission',          commissions, searchCommissions],
    ['treasuryOperationId', 'Opération de trésorerie', treasuryOperations, searchTreasuryOperations],
  ];

  // Liste blanche éventuelle (ex. AGENT/AGENT_TECHNIQUE : Prospect uniquement).
  const shownFields = visibleFields
    ? fields.filter(([key]) => visibleFields.includes(key))
    : fields;

  return (
    <div className={compact ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
      {shownFields.map(([key, label, list, onSearch]) => (
        <SearchSelect
          key={key}
          label={label}
          options={opts(list)}
          value={values[key]}
          onChange={(v) => onChange(key, v)}
          onSearch={onSearch}
        />
      ))}
    </div>
  );
}
