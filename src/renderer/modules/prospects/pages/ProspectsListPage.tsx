import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Pagination from '../../../shared/components/ui/Pagination';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useProspects, useAssignableUsers, useAssignProspect } from '../hooks/useProspects';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { UserPlus, LayoutDashboard, Eye, Edit } from 'lucide-react';

// Rôles habilités à affecter / désaffecter un prospect.
// Exception à l'équivalence ACCOUNTANT = MANAGER : les comptables n'ont pas accès à l'affectation.
const ASSIGN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER']);

// ── Constantes d'affichage ─────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',                    label: 'Tous les statuts' },
  { value: 'NOUVEAU',             label: 'Nouveau' },
  { value: 'CONTACTE',            label: 'Contacté' },
  { value: 'QUALIFIE',            label: 'Qualifié' },
  { value: 'ENVOI_PROPOSITION',   label: 'Proposition envoyée' },
  { value: 'NEGOCIATION_EN_COURS',label: 'Négociation' },
  { value: 'CONVERTI',            label: 'Converti' },
  { value: 'PERDU',               label: 'Perdu' },
];

const SOURCE_OPTIONS = [
  { value: '',                    label: 'Toutes les sources' },
  { value: 'PROSPECTION',         label: 'Prospection' },
  { value: 'SITE_WEB_AFRIKIMMO',  label: 'Site web' },
  { value: 'RECOMMENDATION',      label: 'Recommandation' },
  { value: 'TELEPHONE',           label: 'Téléphone' },
  { value: 'RESEAUX_SOCIAUX',     label: 'Réseaux sociaux' },
  { value: 'EMAIL',               label: 'Email' },
  { value: 'CONTACT_PERSONNEL',   label: 'Contact personnel' },
  { value: 'AUTRE',               label: 'Autre' },
];

const STATUS_VARIANT: Record<string, any> = {
  NOUVEAU:              'default',
  CONTACTE:             'info',
  QUALIFIE:             'purple',
  ENVOI_PROPOSITION:    'warning',
  NEGOCIATION_EN_COURS: 'warning',
  CONVERTI:             'success',
  PERDU:                'danger',
};

const STATUS_LABEL: Record<string, string> = {
  NOUVEAU:              'Nouveau',
  CONTACTE:             'Contacté',
  QUALIFIE:             'Qualifié',
  ENVOI_PROPOSITION:    'Proposition',
  NEGOCIATION_EN_COURS: 'Négociation',
  CONVERTI:             'Converti',
  PERDU:                'Perdu',
};

const SOURCE_LABEL: Record<string, string> = {
  PROSPECTION:         'Prospection',
  SITE_WEB_AFRIKIMMO:  'Site web',
  RECOMMENDATION:      'Recommandation',
  TELEPHONE:           'Téléphone',
  RESEAUX_SOCIAUX:     'Réseaux sociaux',
  EMAIL:               'Email',
  CONTACT_PERSONNEL:   'Contact personnel',
  AUTRE:               'Autre',
};

// ── Colonnes d'export ───────────────────────────────────────────────────────────

const formatUserName = (u: any): string =>
  u ? `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() : '';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Nom',              cell: (p) => p.lastName },
  { header: 'Prénom',           cell: (p) => p.firstName },
  { header: 'Email',            cell: (p) => p.email },
  { header: 'Téléphone 1',      cell: (p) => p.phone },
  { header: 'Téléphone 2',      cell: (p) => p.mobile },
  { header: 'Statut',           cell: (p) => STATUS_LABEL[p.status] ?? p.status },
  { header: 'Budget',           cell: (p) => (p.budget != null ? formatCurrency(p.budget) : '') },
  { header: 'Source',           cell: (p) => SOURCE_LABEL[p.source] ?? p.source },
  { header: 'Affecté à',        cell: (p) => formatUserName(p.assignedTo) || 'Non alloué' },
  { header: 'Créé par',         cell: (p) => formatUserName(p.createdBy) },
  { header: 'Date de création', cell: (p) => formatDate(p.createdAt) },
];

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ProspectsListPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canAssign = ASSIGN_ROLES.has(role);

  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('');
  const [source,     setSource]     = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');

  // assignedToId : '' = tous ; '__none__' = non alloués ; sinon ID utilisateur.
  const assignedFilter =
    assignedTo === ''         ? undefined :
    assignedTo === '__none__' ? null      :
    Number(assignedTo);

  const filters = {
    search: search || undefined,
    status: status || undefined,
    source: source || undefined,
    assignedToId: assignedFilter,
  };

  const { data: usersData } = useAssignableUsers(canAssign);
  const assignableUsers = usersData ?? [];
  const userLabel = (id: number) => {
    const u = assignableUsers.find((x) => x.id === id);
    return u ? formatUserName(u) : `#${id}`;
  };

  const assignedSummary =
    assignedTo === ''         ? null :
    assignedTo === '__none__' ? 'Non alloués' :
                                `Affecté à : ${userLabel(Number(assignedTo))}`;

  const filterSummary = [
    search && `Recherche : "${search}"`,
    status && `Statut : ${STATUS_LABEL[status] ?? status}`,
    source && `Source : ${SOURCE_LABEL[source] ?? source}`,
    assignedSummary,
  ].filter(Boolean).join('   —   ') || undefined;

  const { data, isLoading, error } = useProspects(filters, page, 20);
  const prospects: any[] = data?.data  ?? [];
  const total: number    = data?.total ?? 0;

  const assignMutation = useAssignProspect();
  const onAssignChange = (prospectId: number, value: string) => {
    const newAssignedId = value === '' ? null : Number(value);
    assignMutation.mutate({ id: prospectId, assignedToId: newAssignedId });
  };

  return (
    <PageLayout
      title="Gestion des prospects"
      breadcrumbs={[{ label: 'Prospects' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName="prospects"
            title="Liste des prospects"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.prospects.list(token, filters, 1, 100000);
              return r.success ? r.data ?? [] : [];
            }}
          />
          <Button
            variant="secondary"
            icon={<LayoutDashboard className="h-4 w-4" />}
            onClick={() => navigate('/prospects/kanban')}
          >
            Vue Kanban
          </Button>
          <Button
            icon={<UserPlus className="h-4 w-4" />}
            onClick={() => navigate('/prospects/new')}
          >
            Nouveau prospect
          </Button>
        </div>
      }
    >
      {/* Filtres */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <Input
              label="Rechercher"
              placeholder="Nom, email, téléphone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-48">
            <Select
              label="Statut"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-48">
            <Select
              label="Source"
              options={SOURCE_OPTIONS}
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(1); }}
            />
          </div>
          {canAssign && (
            <div className="w-56">
              <Select
                label="Affectation"
                value={assignedTo}
                onChange={(e) => { setAssignedTo(e.target.value); setPage(1); }}
                options={[
                  { value: '',          label: 'Toutes les affectations' },
                  { value: '__none__',  label: 'Non alloués' },
                  ...assignableUsers.map((u) => ({
                    value: String(u.id),
                    label: formatUserName(u),
                  })),
                ]}
              />
            </div>
          )}
          {(search || status || source || assignedTo) && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => { setSearch(''); setStatus(''); setSource(''); setAssignedTo(''); setPage(1); }}
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </Card>

      {/* Tableau */}
      <Card padding={false}>
        {error ? (
          <div className="p-6 text-center text-red-600 text-sm">
            Erreur : {(error as Error).message}
          </div>
        ) : isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : prospects.length === 0 ? (
          <EmptyState
            title="Aucun prospect trouvé"
            description={search || status || source ? 'Essayez de modifier vos filtres.' : undefined}
            action={{ label: 'Nouveau prospect', onClick: () => navigate('/prospects/new') }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Prospect</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Budget</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Affectation</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prospects.map((p: any) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/prospects/${p.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                          {p.firstName?.[0]}{p.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{p.lastName} {p.firstName}</p>
                          {p.email && <p className="text-xs text-slate-400">{p.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.phone  && <p>{p.phone}</p>}
                      {p.mobile && <p className="text-xs">{p.mobile}</p>}
                      {!p.phone && !p.mobile && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[p.status]}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.budget ? formatCurrency(p.budget) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {SOURCE_LABEL[p.source] ?? p.source ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                      {canAssign ? (
                        <select
                          value={p.assignedToId ?? ''}
                          disabled={assignMutation.isPending}
                          onChange={(e) => onAssignChange(p.id, e.target.value)}
                          className="w-40 text-xs border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="">Non alloué</option>
                          {assignableUsers.map((u) => (
                            <option key={u.id} value={u.id}>{formatUserName(u)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600">
                          {p.assignedTo
                            ? formatUserName(p.assignedTo)
                            : <span className="italic text-slate-400">Non alloué</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye className="h-4 w-4" />}
                          onClick={() => navigate(`/prospects/${p.id}`)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit className="h-4 w-4" />}
                          onClick={() => navigate(`/prospects/${p.id}/edit`)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </Card>
    </PageLayout>
  );
}
