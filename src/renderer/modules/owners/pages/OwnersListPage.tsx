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
import { useOwners } from '../hooks/useOwners';
import { formatDate } from '../../../shared/utils/format';
import { UserPlus, Eye, Edit, Home } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'INDIVIDUEL', label: 'Particulier' },
  { value: 'ENTREPRISE', label: 'Entreprise' },
];

export default function OwnersListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const filters = { search: search || undefined, type: type || undefined };
  const { data, isLoading } = useOwners(filters, page, 20);

  const owners: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des propriétaires"
      breadcrumbs={[{ label: 'Propriétaires' }]}
      actions={
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => navigate('/owners/new')}>
          Nouveau propriétaire
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Rechercher" placeholder="Nom, email, téléphone…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <Select label="Type" options={TYPE_OPTIONS} value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : owners.length === 0 ? (
          <EmptyState
            title="Aucun propriétaire trouvé"
            action={{ label: 'Nouveau propriétaire', onClick: () => navigate('/owners/new') }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Propriétaire</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Ville</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <Home className="h-4 w-4 inline" /> Biens
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Depuis</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {owners.map((o: any) => {
                  const displayName = o.type === 'INDIVIDUEL'
                    ? `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim()
                    : o.companyName ?? '—';
                  return (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-700">
                            {displayName[0] ?? '?'}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{displayName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={o.type === 'INDIVIDUEL' ? 'info' : 'purple'}>
                          {o.type === 'INDIVIDUEL' ? 'Particulier' : 'Entreprise'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <p>{o.phone ?? o.mobile ?? '—'}</p>
                        <p className="text-xs">{o.email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{o.city ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{o._count?.properties ?? 0}</td>
                      <td className="px-4 py-3">
                        <Badge variant={o.isActive ? 'success' : 'danger'}>{o.isActive ? 'Actif' : 'Inactif'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(o.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                            onClick={() => navigate(`/owners/${o.id}`)} />
                          <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                            onClick={() => navigate(`/owners/${o.id}/edit`)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </Card>
    </PageLayout>
  );
}
