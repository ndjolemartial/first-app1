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
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate } from '../../../shared/utils/format';
import { PlusCircle, Eye, Edit, UserRound, FileText } from 'lucide-react';
import { useEmployees, useEmployeesStats } from '../hooks/useHr';
import {
  EMPLOYEE_STATUS_LABEL, EMPLOYEE_STATUS_VARIANT, EMPLOYEE_STATUS_OPTIONS,
  type Employee,
} from '../types/hr.types';

// Écriture opérationnelle (personnel) : admins/RH + MANAGER & ASSISTANTE_DIRECTION.
const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER']);
// Configuration (modèles de contrats) : admins et RH uniquement.
const CONFIG_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT']);

const STATUS_FILTER_OPTIONS = [{ value: '', label: 'Tous les statuts' }, ...EMPLOYEE_STATUS_OPTIONS];

export default function EmployeesListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = WRITE_ROLES.has(role);
  const canConfig = CONFIG_ROLES.has(role);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const filters = { search: search || undefined, status: status || undefined };
  const { data, isLoading } = useEmployees(filters, page, 20);
  const { data: statsRes } = useEmployeesStats();

  const employees: Employee[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const stats: Record<string, number> = statsRes?.data ?? {};

  const employeeName = (e: Employee) => `${e.lastName ?? ''} ${e.firstName ?? ''}`.trim() || '—';

  return (
    <PageLayout
      title="Gestion du personnel"
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Personnel' }]}
      actions={
        canWrite && (
          <div className="flex gap-2">
            {canConfig && (
              <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => navigate('/settings?tab=contractTemplates')}>
                Modèles de contrats
              </Button>
            )}
            <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => navigate('/hr/employees/new')}>
              Nouvel employé
            </Button>
          </div>
        )
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EMPLOYEE_STATUS_OPTIONS.map((s) => (
          <Card key={s.value} className="flex items-center justify-between">
            <span className="text-sm text-slate-500">{s.label}</span>
            <span className="text-xl font-bold text-slate-900">{stats[s.value] ?? 0}</span>
          </Card>
        ))}
      </div>

      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            label="Rechercher"
            placeholder="Nom, matricule, poste, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-52">
          <Select
            label="Statut"
            options={STATUS_FILTER_OPTIONS}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : employees.length === 0 ? (
          <EmptyState
            title="Aucun employé trouvé"
            action={canWrite ? { label: 'Nouvel employé', onClick: () => navigate('/hr/employees/new') } : undefined}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Matricule</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Nom & prénoms</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Poste</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Département</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Téléphone</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Embauche</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Statut</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-medium text-slate-900">{e.matricule}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="text-slate-700">{employeeName(e)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.poste ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{e.departement ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{e.mobile || e.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{e.hireDate ? formatDate(e.hireDate) : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={(EMPLOYEE_STATUS_VARIANT[e.status] ?? 'default') as any}>
                        {EMPLOYEE_STATUS_LABEL[e.status] ?? e.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                          onClick={() => navigate(`/hr/employees/${e.id}`)} />
                        {canWrite && (
                          <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                            onClick={() => navigate(`/hr/employees/${e.id}/edit`)} />
                        )}
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
