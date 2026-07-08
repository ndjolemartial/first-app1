import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../../shared/components/ui/Modal';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { toast } from '../../../shared/components/ui/Toast';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { useActivity, useUpdateActivity, useCompleteActivity } from '../hooks/useCrm';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate } from '../../../shared/utils/format';
import {
  Phone, Mail, MessageSquare, Calendar, Eye, Briefcase, Bell, File,
  FileText, Users, Paperclip, Pencil, Target, Save, CheckCircle2,
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

const personName = (p: any): string => `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();

/** Formate une taille de fichier de façon lisible. */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface Props {
  activityId: number | null;
  onClose: () => void;
}

/** Petite ligne « libellé : valeur » du panneau de détail. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-700">{children}</dd>
    </div>
  );
}

export default function ActivityDetailModal({ activityId, onClose }: Props) {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const { data: res, isLoading } = useActivity(activityId ?? 0);
  const act: any = res?.data;
  const update = useUpdateActivity();
  const complete = useCompleteActivity();

  // Quantité réalisée (édition locale synchronisée sur l'activité chargée).
  const [realized, setRealized] = useState('');
  useEffect(() => {
    if (act?.objective) setRealized(act.objectiveRealized != null ? String(Number(act.objectiveRealized)) : '');
  }, [act?.id, act?.objectiveRealized, act?.objective]);

  const objTarget = act?.objective?.targetValue != null ? Number(act.objective.targetValue) : 0;
  const realizedNum = Number(realized) || 0;
  // Pourcentage réel (peut dépasser 100 %) ; la barre reste plafonnée à 100 %.
  const objProgress = objTarget > 0 ? Math.round((realizedNum / objTarget) * 100) : 0;
  const objReached = objTarget > 0 && realizedNum >= objTarget;

  const saveRealized = async () => {
    if (!act) return;
    const r: any = await update.mutateAsync({ id: act.id, payload: { objectiveRealized: realizedNum } });
    if (r.success) toast.success('Quantité réalisée enregistrée');
    else toast.error(typeof r.error === 'string' ? r.error : 'Échec de l’enregistrement');
  };

  const markDone = async () => {
    if (!act) return;
    const r: any = await complete.mutateAsync(act.id);
    if (r.success) toast.success('Tâche marquée « Traité »');
    else toast.error(typeof r.error === 'string' ? r.error : 'Impossible de marquer la tâche « Traité »');
  };

  const go = (to: string) => { onClose(); navigate(to); };

  // Liste des entités rattachées (toutes optionnelles).
  const links: { label: string; to: string; icon: React.ReactNode }[] = [];
  if (act) {
    if (act.client) {
      const n = act.client.type === 'INDIVIDUEL' ? personName(act.client) : (act.client.entreprise ?? '');
      links.push({ label: n || `Client #${act.client.id}`, to: `/clients/${act.client.id}`, icon: <Users className="h-3.5 w-3.5" /> });
    }
    if (act.prospect) links.push({ label: personName(act.prospect) || `Prospect #${act.prospect.id}`, to: `/prospects/${act.prospect.id}`, icon: <Users className="h-3.5 w-3.5" /> });
    if (act.owner) links.push({ label: act.owner.companyName || personName(act.owner) || `Propriétaire #${act.owner.id}`, to: `/owners/${act.owner.id}`, icon: <Users className="h-3.5 w-3.5" /> });
    if (act.property) links.push({ label: `${act.property.reference}${act.property.address ? ` — ${act.property.address}` : ''}`, to: `/properties/${act.property.id}`, icon: <FileText className="h-3.5 w-3.5" /> });
    if (act.terrain) links.push({ label: act.terrain.reference, to: `/terrains/${act.terrain.id}`, icon: <FileText className="h-3.5 w-3.5" /> });
    if (act.lotissement) links.push({ label: `${act.lotissement.reference} — ${act.lotissement.nom}`, to: `/lotissements/${act.lotissement.id}`, icon: <FileText className="h-3.5 w-3.5" /> });
    if (act.programme) links.push({ label: `${act.programme.reference} — ${act.programme.nom}`, to: `/programmes/${act.programme.id}`, icon: <FileText className="h-3.5 w-3.5" /> });
    if (act.convention) links.push({ label: act.convention.reference, to: `/conventions/${act.convention.id}`, icon: <FileText className="h-3.5 w-3.5" /> });
    if (act.invoice) links.push({ label: act.invoice.reference, to: `/accounting/invoices/${act.invoice.id}`, icon: <FileText className="h-3.5 w-3.5" /> });
  }

  const attachments: any[] = act?.attachments ?? [];

  return (
    <Modal
      open={activityId != null}
      onClose={onClose}
      title="Détails de l'activité"
      size="lg"
      footer={
        act ? (
          <>
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => go(`/crm/activities/${act.id}/edit`)}>
              Modifier
            </Button>
          </>
        ) : undefined
      }
    >
      {isLoading || !act ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* En-tête : type, sujet, statut */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
              {TYPE_ICON[act.type] ?? <Bell className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{act.subject}</h3>
                <Badge variant={STATUS_VARIANT[act.status] ?? 'default'}>{STATUS_LABEL[act.status] ?? act.status}</Badge>
              </div>
              <p className="text-xs text-slate-400">{TYPE_LABEL[act.type] ?? act.type}</p>
            </div>
          </div>

          {act.description && (
            <div className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {act.description}
            </div>
          )}

          {/* Objectif lié (tâche) : quantité réalisée + avancement */}
          {act.objective && (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Target className="h-4 w-4 text-blue-600" /> Objectif lié — {act.objective.title}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={`Quantité réalisée${act.objective.unit ? ` (${act.objective.unit})` : ''}`}
                  type="number" min="0" step="any"
                  value={realized}
                  onChange={(e) => setRealized(e.target.value)}
                  disabled={act.status === 'TRAITE'}
                />
                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Objectif : {objTarget} {act.objective.unit ?? ''}</span>
                    <span className="tabular-nums font-semibold text-slate-700">{objProgress}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${objReached ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, objProgress)}%` }} />
                  </div>
                </div>
              </div>
              {act.status !== 'TRAITE' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={saveRealized}>
                    Enregistrer la quantité
                  </Button>
                  <Button size="sm" icon={<CheckCircle2 className="h-4 w-4" />} loading={complete.isPending} disabled={!objReached} onClick={markDone}>
                    Marquer « Traité »
                  </Button>
                  {!objReached && (
                    <span className="text-xs text-amber-600">Objectif non atteint : la tâche ne peut pas encore être « Traité ».</span>
                  )}
                </div>
              )}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-4">
            <Field label="Date / heure prévue">{act.dueDate ? formatDate(act.dueDate) : '—'}</Field>
            <Field label="Terminé le">{act.completedAt ? formatDate(act.completedAt) : '—'}</Field>
            <Field label="Assigné à">{act.user ? personName(act.user) : '—'}</Field>
            <Field label="Créé par">{act.createdBy ? personName(act.createdBy) : '—'}</Field>
            <Field label="Créé le">{formatDate(act.createdAt)}</Field>
          </dl>

          {/* Entités rattachées */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Entités rattachées</p>
            {links.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune entité rattachée.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {links.map((l, i) => (
                  <button
                    key={i}
                    onClick={() => go(l.to)}
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                  >
                    {l.icon} {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pièces jointes */}
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Paperclip className="h-3.5 w-3.5" /> Pièces jointes
            </p>
            {attachments.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune pièce jointe.</p>
            ) : (
              <ul className="space-y-1">
                {attachments.map((doc: any) => (
                  <li key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate text-slate-700">{doc.name}</span>
                      {doc.size ? <span className="shrink-0 text-xs text-slate-400">{formatFileSize(doc.size)}</span> : null}
                      {doc.numeroArchive && <span className="shrink-0 font-mono text-xs text-slate-400">{doc.numeroArchive}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => window.electron.documents.open(token, doc.id)}
                      className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                    >
                      Ouvrir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
