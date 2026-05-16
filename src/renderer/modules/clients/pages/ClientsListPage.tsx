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
import { useClients } from '../hooks/useClients';
import { formatDate } from '../../../shared/utils/format';
import { UserPlus, Eye, Edit } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'INDIVIDUEL', label: 'Particulier' },
  { value: 'ENTREPRISE', label: 'Entreprise' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'ACTIF', label: 'Actif' },
  { value: 'INACTIF', label: 'Inactif' },
  { value: 'VIP', label: 'VIP' },
  { value: 'SUSPENDU', label: 'Suspendu' },
];

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'purple' | 'warning'> = {
  ACTIF: 'success',
  INACTIF: 'danger',
  VIP: 'purple',
  SUSPENDU: 'warning',
};

export default function ClientsListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const filters = { search: search || undefined, type: type || undefined, status: status || undefined };
  const { data, isLoading } = useClients(filters, page, 20);

  const clients: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des clients"
      breadcrumbs={[{ label: 'Clients' }]}
      actions={
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => navigate('/clients/new')}>
          Nouveau client
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
        <div className="w-44">
          <Select label="Statut" options={STATUS_OPTIONS} value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : clients.length === 0 ? (
          <EmptyState
            title="Aucun client trouvé"
            action={{ label: 'Nouveau client', onClick: () => navigate('/clients/new') }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Ville</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Contrats</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Depuis</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">
                          {(c.firstName ?? c.entreprise ?? '?')[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {c.type === 'INDIVIDUEL' ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : c.entreprise}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.type === 'INDIVIDUEL' ? 'info' : 'purple'}>
                        {c.type === 'INDIVIDUEL' ? 'Particulier' : 'Entreprise'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <p>{c.phone ?? c.mobile ?? '—'}</p>
                      <p className="text-xs">{c.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.city ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c._count?.contracts ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>
                        {STATUS_OPTIONS.find((o) => o.value === c.status)?.label ?? c.status ?? '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                          onClick={() => navigate(`/clients/${c.id}`)} />
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                          onClick={() => navigate(`/clients/${c.id}/edit`)} />
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
