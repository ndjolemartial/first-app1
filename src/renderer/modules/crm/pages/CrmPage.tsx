import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useActivities, useCrmStats, useDeleteActivity, useCompleteActivity } from '../hooks/useCrm';
import { formatDate, formatRelative } from '../../../shared/utils/format';
import {
  Plus, CheckCircle2, Trash2, Phone, Mail, MessageSquare,
  Calendar, Eye, Users, Briefcase, FileText, Bell, File,
  AlertCircle, Clock,
} from 'lucide-react';

const TYPE_ICON: Record<string, React.ReactNode> = {
  APPEL: <Phone className="h-4 w-4" />,
  EMAIL: <Mail className="h-4 w-4" />,
  SMS: <MessageSquare className="h-4 w-4" />,
  REUNION: <Calendar className="h-4 w-4" />,
  VISITE: <Eye className="h-4 w-4" />,
  TASK: <Briefcase className="h-4 w-4" />,
  RAPPEL: <Bell className="h-4 w-4" />,
  DOCUMENT: <File className="h-4 w-4" />,
  NOTIFICATION: <Bell className="h-4 w-4" />,
};
const TYPE_LABEL: Record<string, string> = {
  APPEL: 'Appel', EMAIL: 'Email', SMS: 'SMS', REUNION: 'Réunion',
  VISITE: 'Visite', TASK: 'Tâche', RAPPEL: 'Rappel', DOCUMENT: 'Document', NOTIFICATION: 'Notification',
};
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  EN_ATTENTE: 'warning', EN_TRAITEMENT: 'info', TRAITE: 'success', ANNULE: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente', EN_TRAITEMENT: 'En cours', TRAITE: 'Traité', ANNULE: 'Annulé',
};

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })),
];
const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'EN_TRAITEMENT', label: 'En cours' },
  { value: 'TRAITE', label: 'Traité' },
  { value: 'ANNULE', label: 'Annulé' },
];

export default function CrmPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('EN_ATTENTE');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const limit = 30;

  const filters: any = {};
  if (typeFilter) filters.type = typeFilter;
  if (statusFilter) filters.status = statusFilter;

  const { data: res, isLoading, refetch } = useActivities(filters, page, limit);
  const { data: statsRes } = useCrmStats();
  const deleteActivity = useDeleteActivity();
  const completeActivity = useCompleteActivity();

  const activities = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const stats = statsRes?.data;

  const handleComplete = async (id: number) => {
    await completeActivity.mutateAsync(id);
    refetch();
  };

  const handleDelete = async () => {
    await deleteActivity.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    refetch();
  };

  const entityLabel = (act: any) => {
    if (act.client) {
      const n = act.client.type === 'INDIVIDUEL'
        ? `${act.client.firstName ?? ''} ${act.client.lastName ?? ''}`.trim()
        : act.client.entreprise;
      return { label: n, to: `/clients/${act.client.id}`, icon: <Users className="h-3 w-3" /> };
    }
    if (act.prospect) return { label: `${act.prospect.firstName} ${act.prospect.lastName}`, to: `/prospects/${act.prospect.id}`, icon: <Users className="h-3 w-3" /> };
    if (act.property) return { label: act.property.reference, to: `/properties/${act.property.id}`, icon: <FileText className="h-3 w-3" /> };
    if (act.contract) return { label: act.contract.reference, to: `/contracts/${act.contract.id}`, icon: <FileText className="h-3 w-3" /> };
    return null;
  };

  return (
    <PageLayout
      title="CRM — Activités"
      breadcrumbs={[{ label: 'CRM' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/crm/activities/new')}>
          Nouvelle activité
        </Button>
      }
    >
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">En attente</p>
              <p className="text-xl font-bold text-slate-900">{stats.pending}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">En retard</p>
              <p className="text-xl font-bold text-slate-900">{stats.overdue}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Aujourd'hui</p>
              <p className="text-xl font-bold text-slate-900">{stats.todayCount}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total actives</p>
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3 mb-6">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="p-6"><SkeletonTable rows={8} /></div>
      ) : activities.length === 0 ? (
        <div className="py-16 text-center text-slate-400">Aucune activité trouvée.</div>
      ) : (
        <div className="space-y-2">
          {activities.map((act: any) => {
            const entity = entityLabel(act);
            const isOverdue = act.dueDate && new Date(act.dueDate) < new Date() && act.status !== 'TRAITE' && act.status !== 'ANNULE';
            return (
              <div
                key={act.id}
                className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-4 hover:shadow-sm transition-shadow ${isOverdue ? 'border-red-200' : 'border-slate-200'}`}
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500'}`}>
                  {TYPE_ICON[act.type] ?? <Bell className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 truncate">{act.subject}</p>
                    <Badge variant={STATUS_VARIANT[act.status] ?? 'default'}>{STATUS_LABEL[act.status] ?? act.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span>{TYPE_LABEL[act.type] ?? act.type}</span>
                    {act.dueDate && (
                      <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                        {isOverdue ? '⚠ ' : ''}{formatDate(act.dueDate)}
                      </span>
                    )}
                    {entity && (
                      <button
                        onClick={() => navigate(entity.to)}
                        className="flex items-center gap-1 text-indigo-500 hover:underline"
                      >
                        {entity.icon} {entity.label}
                      </button>
                    )}
                    {act.user && <span>{act.user.firstName} {act.user.lastName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {act.status !== 'TRAITE' && act.status !== 'ANNULE' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
                      onClick={() => handleComplete(act.id)}
                    >
                      Terminer
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/crm/activities/${act.id}/edit`)}
                  >
                    Modifier
                  </Button>
                  <button
                    onClick={() => setDeleteTarget(act)}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>{total} activité(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Précédent</Button>
            <span className="py-1 px-2">{page} / {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Suivant</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer l'activité"
        message={`Supprimer "${deleteTarget?.subject}" ?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
