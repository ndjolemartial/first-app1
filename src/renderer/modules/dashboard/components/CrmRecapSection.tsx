import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Clock,
  Calendar,
  CheckCircle2,
  Phone,
  Mail,
  MessageSquare,
  Eye,
  Briefcase,
  Bell,
  File,
  PenTool,
} from 'lucide-react';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatDate } from '../../../shared/utils/format';
import { useCrmStats, useActivities } from '../../crm/hooks/useCrm';

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
  CREATION_PUBLICATION: <PenTool className="h-4 w-4" />,
};
const TYPE_LABEL: Record<string, string> = {
  APPEL: 'Appel', EMAIL: 'Email', SMS: 'SMS', REUNION: 'Réunion',
  VISITE: 'Visite chantier / Sortie en clientèle / Courses', TASK: 'Tâche', RAPPEL: 'Rappel', DOCUMENT: 'Document', NOTIFICATION: 'Notification',
  CREATION_PUBLICATION: 'Créas / Publications / Articles',
};
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  EN_ATTENTE: 'warning', EN_TRAITEMENT: 'info', TRAITE: 'success', ANNULE: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente', EN_TRAITEMENT: 'En cours', TRAITE: 'Traité', ANNULE: 'Annulé',
};

/**
 * Récapitulatif des activités CRM propres à l'utilisateur connecté.
 * La visibilité (activités assignées, créées, ou dont il est référent) est
 * appliquée côté IPC pour les rôles non full-view (AGENT, AGENT_TECHNIQUE,
 * ASSISTANTE_DIRECTION). Réutilisable sur les tableaux de bord par rôle.
 */
export default function CrmRecapSection({ title = 'Mes activités CRM' }: { title?: string }) {
  const navigate = useNavigate();

  const { data: crmStatsRes, isLoading: crmStatsLoading } = useCrmStats();
  const crmStats = crmStatsRes?.data;

  // Activités actives (hors annulées), les plus proches en échéance d'abord.
  const { data: actRes, isLoading: actLoading } = useActivities({ statusNot: 'ANNULE' }, 1, 6);
  const activities = actRes?.data ?? [];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <button
          onClick={() => navigate('/crm')}
          className="text-sm text-blue-600 hover:underline"
        >
          Voir le CRM
        </button>
      </div>

      {crmStatsLoading ? (
        <div className="p-6"><SkeletonTable rows={2} /></div>
      ) : !crmStats ? (
        <Card className="text-sm text-slate-400">Récapitulatif CRM indisponible.</Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'En attente', value: crmStats.pending, icon: <AlertCircle className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50' },
            { label: 'En retard', value: crmStats.overdue, icon: <Clock className="h-5 w-5 text-red-600" />, bg: 'bg-red-50' },
            { label: "Aujourd'hui", value: crmStats.todayCount, icon: <Calendar className="h-5 w-5 text-orange-600" />, bg: 'bg-orange-50' },
            { label: 'Total actives', value: crmStats.total, icon: <CheckCircle2 className="h-5 w-5 text-slate-600" />, bg: 'bg-slate-50' },
          ].map((k) => (
            <Card key={k.label} className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${k.bg} flex items-center justify-center`}>{k.icon}</div>
              <div>
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className="text-xl font-bold text-slate-900">{k.value}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-4">
        <h4 className="mb-3 font-semibold text-slate-800">Activités à venir</h4>
        {actLoading ? (
          <SkeletonTable rows={4} />
        ) : activities.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune activité.</p>
        ) : (
          <div className="space-y-2">
            {activities.map((act: any) => {
              const isOverdue = act.dueDate && new Date(act.dueDate) < new Date()
                && act.status !== 'TRAITE' && act.status !== 'ANNULE';
              return (
                <div
                  key={act.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 hover:bg-slate-50 cursor-pointer ${isOverdue ? 'border-red-200' : 'border-slate-100'}`}
                  onClick={() => navigate(`/crm/activities/${act.id}/edit`)}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500'}`}>
                    {TYPE_ICON[act.type] ?? <Bell className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate text-sm">{act.subject}</p>
                      <Badge variant={STATUS_VARIANT[act.status] ?? 'default'}>{STATUS_LABEL[act.status] ?? act.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span>{TYPE_LABEL[act.type] ?? act.type}</span>
                      {act.dueDate && (
                        <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                          {isOverdue ? '⚠ ' : ''}{formatDate(act.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
