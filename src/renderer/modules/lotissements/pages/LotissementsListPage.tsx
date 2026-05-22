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
import { useLotissements } from '../hooks/useLotissements';
import { formatDate } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { PlusCircle, Eye, Edit, Map } from 'lucide-react';

const STATUT_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_COURS_LOTISSEMENT', label: 'En cours de lotissement' },
  { value: 'EN_COURS', label: 'En cours d\'aménagement' },
  { value: 'OUVERT', label: 'Ouvert' },
  { value: 'PARTIELLEMENT_VENDU', label: 'Partiellement vendu' },
  { value: 'COMPLET', label: 'Complet' },
  { value: 'FERME', label: 'Fermé' },
];

const STATUT_VARIANT: Record<string, any> = {
  EN_COURS_LOTISSEMENT: 'purple',
  EN_COURS: 'warning',
  OUVERT: 'success',
  PARTIELLEMENT_VENDU: 'info',
  COMPLET: 'default',
  FERME: 'danger',
};

const STATUT_LABEL: Record<string, string> = {
  EN_COURS_LOTISSEMENT: 'En cours lot.',
  EN_COURS: 'En cours amén.',
  OUVERT: 'Ouvert',
  PARTIELLEMENT_VENDU: 'Part. vendu',
  COMPLET: 'Complet',
  FERME: 'Fermé',
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Référence', cell: (l) => l.reference },
  { header: 'Nom',       cell: (l) => l.nom },
  { header: 'Commune',   cell: (l) => l.commune },
  { header: 'Quartier',  cell: (l) => l.quartier },
  { header: 'Ville',     cell: (l) => l.ville },
  { header: 'Promoteur', cell: (l) => l.promoteur },
  { header: 'Parcelles', cell: (l) => `${l._count?.terrains ?? 0}${l.nombreParcelles ? ` / ${l.nombreParcelles}` : ''}` },
  { header: 'Statut',    cell: (l) => STATUT_LABEL[l.statut] ?? l.statut },
  { header: 'Créé le',   cell: (l) => formatDate(l.createdAt) },
];

export default function LotissementsListPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');
  const filters = { search: search || undefined, statut: statut || undefined };
  const { data, isLoading } = useLotissements(filters, page, 20);

  const filterSummary = [
    search && `Recherche : "${search}"`,
    statut && `Statut : ${STATUT_LABEL[statut] ?? statut}`,
  ].filter(Boolean).join('   —   ') || undefined;

  const lots: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des lotissements"
      breadcrumbs={[{ label: 'Lotissements' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName="lotissements"
            title="Liste des lotissements"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.lotissements.list(token, filters, 1, 100000);
              return r.success ? r.data ?? [] : [];
            }}
          />
          <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => navigate('/lotissements/new')}>
            Nouveau lotissement
          </Button>
        </div>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Rechercher" placeholder="Nom, référence, commune, promoteur…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-52">
          <Select label="Statut" options={STATUT_OPTIONS} value={statut}
            onChange={(e) => { setStatut(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : lots.length === 0 ? (
          <EmptyState
            title="Aucun lotissement trouvé"
            action={{ label: 'Nouveau lotissement', onClick: () => navigate('/lotissements/new') }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Localisation</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Promoteur</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Parcelles</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Créé le</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lots.map((lot: any) => (
                  <tr key={lot.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {lot.reference}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Map className="h-4 w-4 text-slate-400 shrink-0" />
                        <p className="font-medium text-slate-900">{lot.nom}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <p>{lot.commune ?? lot.quartier ?? '—'}</p>
                      <p className="text-xs">{lot.ville}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{lot.promoteur ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {lot._count?.terrains ?? 0}
                      {lot.nombreParcelles ? ` / ${lot.nombreParcelles}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUT_VARIANT[lot.statut] ?? 'default'}>
                        {STATUT_LABEL[lot.statut] ?? lot.statut}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(lot.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                          onClick={() => navigate(`/lotissements/${lot.id}`)} />
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                          onClick={() => navigate(`/lotissements/${lot.id}/edit`)} />
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
