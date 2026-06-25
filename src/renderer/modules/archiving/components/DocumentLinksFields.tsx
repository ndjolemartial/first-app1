import { useEffect, useState } from 'react';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatPersonName } from '../../../shared/utils/format';

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

  const opts = (list: SelectOption[], placeholder = '— Aucun —') =>
    [{ value: '', label: placeholder }, ...list];

  const fields: Array<[keyof DocumentLinks, string, SelectOption[]]> = [
    ['clientId',      'Client',              clients],
    ['ownerId',       'Propriétaire',        owners],
    ['prospectId',    'Prospect',            prospects],
    ['referrerId',    "Apporteur d'affaires", referrers],
    ['linkedUserId',  'Utilisateur',         users],
    ['propertyId',    'Bien',                properties],
    ['terrainId',     'Terrain',             terrains],
    ['lotissementId', 'Lotissement',         lotissements],
    ['programmeId',   'Programme',           programmes],
    ['projectId',     'Projet',              projects],
    ['conventionId',  'Convention',          conventions],
    ['invoiceId',     'Facture',             invoices],
    ['attestationId', 'Attestation',         attestations],
    ['commissionId',  'Commission',          commissions],
    ['treasuryOperationId', 'Opération de trésorerie', treasuryOperations],
  ];

  // Liste blanche éventuelle (ex. AGENT/AGENT_TECHNIQUE : Prospect uniquement).
  const shownFields = visibleFields
    ? fields.filter(([key]) => visibleFields.includes(key))
    : fields;

  return (
    <div className={compact ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
      {shownFields.map(([key, label, list]) => (
        <SearchSelect
          key={key}
          label={label}
          options={opts(list)}
          value={values[key]}
          onChange={(v) => onChange(key, v)}
        />
      ))}
    </div>
  );
}
