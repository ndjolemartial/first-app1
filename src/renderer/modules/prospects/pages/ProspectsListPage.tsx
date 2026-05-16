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
import { useProspects } from '../hooks/useProspects';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { UserPlus, LayoutDashboard, Eye, Edit } from 'lucide-react';

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

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ProspectsListPage() {
  const navigate = useNavigate();
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');

  const filters = {
    search: search || undefined,
    status: status || undefined,
    source: source || undefined,
  };

  const { data, isLoading, error } = useProspects(filters, page, 20);
  const prospects: any[] = data?.data  ?? [];
  const total: number    = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des prospects"
      breadcrumbs={[{ label: 'Prospects' }]}
      actions={
        <div className="flex gap-2">
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
          {(search || status || source) && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => { setSearch(''); setStatus(''); setSource(''); setPage(1); }}
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
                          <p className="font-medium text-slate-900">{p.firstName} {p.lastName}</p>
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
