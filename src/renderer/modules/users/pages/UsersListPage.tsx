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
import { useUsers, useToggleUserActive } from '../hooks/useUsers';
import { formatDate } from '../../../shared/utils/format';
import { UserPlus, Search, Edit, Power } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: '', label: 'Tous les rôles' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'ACCOUNTANT', label: 'Comptable' },
  { value: 'READONLY', label: 'Lecture seule' },
];

const ROLE_VARIANT: Record<string, any> = {
  SUPER_ADMIN: 'danger',
  ADMIN: 'info',
  MANAGER: 'purple',
  AGENT: 'success',
  ACCOUNTANT: 'warning',
  READONLY: 'default',
};

export default function UsersListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const filters = { search: search || undefined, role: role || undefined };
  const { data, isLoading } = useUsers(filters, page, 20);
  const toggleActive = useToggleUserActive();

  const users: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des utilisateurs"
      breadcrumbs={[{ label: 'Utilisateurs' }]}
      actions={
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => navigate('/users/new')}>
          Nouvel utilisateur
        </Button>
      }
    >
      {/* Filtres */}
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            label="Rechercher"
            placeholder="Nom, email, matricule…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-48">
          <Select
            label="Rôle"
            options={ROLE_OPTIONS}
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : users.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur trouvé"
            description="Ajoutez un premier utilisateur avec le bouton ci-dessus."
            action={{ label: 'Nouvel utilisateur', onClick: () => navigate('/users/new') }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Utilisateur</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Matricule</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Rôle</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Dernière connexion</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user: any) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.matricule}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_VARIANT[user.role] ?? 'default'}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.isActive ? 'success' : 'danger'}>
                        {user.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                          onClick={() => navigate(`/users/${user.id}/edit`)} />
                        <Button variant="ghost" size="sm" icon={<Power className="h-4 w-4" />}
                          loading={toggleActive.isPending}
                          onClick={() => toggleActive.mutate(user.id)} />
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
