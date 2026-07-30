import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Textarea from '../../../shared/components/ui/Textarea';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { formatDateTime } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  useInnovation,
  useUpdateInnovation,
  useSubmitPhase2,
  useSubmitPhase3,
} from '../hooks/useItInnovations';
import ValidatePhaseModal from '../components/ValidatePhaseModal';
import PhaseAttachments from '../components/PhaseAttachments';
import { STATUS_LABEL, STATUS_BADGE_VARIANT, type ItInnovation } from '../types/it-innovation.types';
import { ArrowLeft, CheckCircle2, XCircle, Pencil } from 'lucide-react';

const VALIDATE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Carte d'une phase : contenu (en lecture ou édition), badge de statut et
 * actions de validation/soumission selon l'état courant. */
function PhaseCard({
  phaseNumber,
  weightLabel,
  title,
  innovation,
  canValidate,
  canEdit,
  pendingStatus,
  editableStatuses,
  onValidateClick,
}: {
  phaseNumber: 1 | 2 | 3;
  weightLabel: string;
  title: string;
  innovation: ItInnovation;
  canValidate: boolean;
  canEdit: boolean;
  pendingStatus: string;
  editableStatuses: string[];
  onValidateClick: () => void;
}) {
  const description = phaseNumber === 1 ? innovation.phase1Description
    : phaseNumber === 2 ? innovation.phase2Description
    : innovation.phase3Description;
  const rejectionReason = phaseNumber === 1 ? innovation.phase1RejectionReason
    : phaseNumber === 2 ? innovation.phase2RejectionReason
    : innovation.phase3RejectionReason;
  const validatedByName = phaseNumber === 1 ? innovation.phase1ValidatedByName
    : phaseNumber === 2 ? innovation.phase2ValidatedByName
    : innovation.phase3ValidatedByName;
  const validatedAt = phaseNumber === 1 ? innovation.phase1ValidatedAt
    : phaseNumber === 2 ? innovation.phase2ValidatedAt
    : innovation.phase3ValidatedAt;

  const isPendingValidation = innovation.status === pendingStatus;
  const isEditable = editableStatuses.includes(innovation.status);
  const isLocked = !isPendingValidation && !isEditable && !validatedAt;

  const submitPhase2 = useSubmitPhase2();
  const submitPhase3 = useSubmitPhase3();
  const updatePhase1 = useUpdateInnovation();
  const [draft, setDraft] = useState(description ?? '');
  const [editing, setEditing] = useState(false);

  const submitting = submitPhase2.isPending || submitPhase3.isPending || updatePhase1.isPending;

  const handleSubmitContent = async () => {
    if (!draft.trim()) return;
    if (phaseNumber === 1) await updatePhase1.mutateAsync({ id: innovation.id, payload: { phase1Description: draft.trim() } });
    else if (phaseNumber === 2) await submitPhase2.mutateAsync({ id: innovation.id, payload: { phase2Description: draft.trim() } });
    else await submitPhase3.mutateAsync({ id: innovation.id, payload: { phase3Description: draft.trim() } });
    setEditing(false);
  };

  return (
    <Card className={isLocked ? 'opacity-60' : undefined}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-400">{weightLabel}</p>
        </div>
        {validatedAt ? (
          <Badge variant="success">Validée{validatedByName ? ` — ${validatedByName}` : ''}</Badge>
        ) : rejectionReason ? (
          <Badge variant="danger">Rejetée</Badge>
        ) : isPendingValidation ? (
          <Badge variant="info">En attente de validation</Badge>
        ) : isEditable ? (
          <Badge variant="warning">À compléter</Badge>
        ) : (
          <Badge variant="default">Non accessible</Badge>
        )}
      </div>

      {rejectionReason && !validatedAt && (
        <div className="mb-2 rounded-md bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
          <span className="font-medium">Motif du rejet : </span>{rejectionReason}
        </div>
      )}

      {(description || isEditable) ? (
        editing ? (
          <div className="space-y-2">
            <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setDraft(description ?? ''); }}>Annuler</Button>
              <Button size="sm" loading={submitting} onClick={handleSubmitContent}>
                {phaseNumber === 1 ? 'Enregistrer' : 'Soumettre pour validation'}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{description || <span className="italic text-slate-400">Non renseigné</span>}</p>
            {canEdit && isEditable && (
              <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} className="mt-2"
                onClick={() => { setDraft(description ?? ''); setEditing(true); }}>
                {description ? 'Modifier et resoumettre' : 'Compléter cette phase'}
              </Button>
            )}
          </div>
        )
      ) : (
        <p className="text-sm italic text-slate-400">Non accessible pour le moment.</p>
      )}

      {!isLocked && (
        <PhaseAttachments
          innovationId={innovation.id}
          phase={phaseNumber}
          attachments={innovation.attachments}
        />
      )}

      {canValidate && isPendingValidation && (
        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
          <Button size="sm" icon={<CheckCircle2 className="h-4 w-4" />} onClick={onValidateClick}>
            Examiner la phase
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function ItInnovationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canValidate = VALIDATE_ROLES.includes(role);

  const { data, isLoading } = useInnovation(Number(id));
  const innovation: ItInnovation | undefined = data?.success ? data.data : undefined;

  const [validating, setValidating] = useState<1 | 2 | 3 | null>(null);

  if (isLoading) {
    return (
      <PageLayout title="Innovation IT" breadcrumbs={[{ label: 'Innovations IT', to: '/innovations' }, { label: 'Détail' }]}>
        <Skeleton className="h-64 w-full" />
      </PageLayout>
    );
  }

  if (!innovation) {
    return (
      <PageLayout title="Innovation IT" breadcrumbs={[{ label: 'Innovations IT', to: '/innovations' }, { label: 'Détail' }]}>
        <p className="text-sm text-slate-500">Innovation introuvable.</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={innovation.title}
      breadcrumbs={[{ label: 'Innovations IT', to: '/innovations' }, { label: innovation.reference }]}
      actions={
        <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/innovations')}>
          Retour
        </Button>
      }
    >
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-slate-400">{innovation.reference}</p>
            <p className="text-sm text-slate-600 mt-1">
              Porteur : <span className="font-medium text-slate-900">
                {innovation.employee ? `${innovation.employee.lastName} ${innovation.employee.firstName}` : '—'}
              </span>
              {innovation.createdByName && <span className="text-slate-400"> — créée par {innovation.createdByName}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={STATUS_BADGE_VARIANT[innovation.status]}>{STATUS_LABEL[innovation.status]}</Badge>
            <div className="flex items-center gap-2 w-40">
              <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${innovation.progress}%` }} />
              </div>
              <span className="text-sm font-medium text-slate-700 tabular-nums">{innovation.progress}%</span>
            </div>
          </div>
        </div>
        {innovation.notes && <p className="mt-3 text-sm text-slate-500 whitespace-pre-wrap">{innovation.notes}</p>}
        <p className="mt-3 text-xs text-slate-400">Créée le {formatDateTime(innovation.createdAt)}</p>
      </Card>

      <div className="space-y-4">
        <PhaseCard
          phaseNumber={1}
          weightLabel="15% de la progression"
          title="Phase 1 — Énoncé et description"
          innovation={innovation}
          canValidate={canValidate}
          canEdit
          pendingStatus="PHASE1_EN_ATTENTE"
          editableStatuses={['PHASE1_EN_ATTENTE', 'PHASE1_REJETEE']}
          onValidateClick={() => setValidating(1)}
        />
        <PhaseCard
          phaseNumber={2}
          weightLabel="+35% de la progression (cumulé 50%)"
          title="Phase 2 — Démonstration et validation de test"
          innovation={innovation}
          canValidate={canValidate}
          canEdit
          pendingStatus="PHASE2_EN_ATTENTE"
          editableStatuses={['PHASE2_EN_COURS', 'PHASE2_REJETEE']}
          onValidateClick={() => setValidating(2)}
        />
        <PhaseCard
          phaseNumber={3}
          weightLabel="+50% de la progression (cumulé 100%)"
          title="Phase 3 — Validation finale et intégration"
          innovation={innovation}
          canValidate={canValidate}
          canEdit
          pendingStatus="PHASE3_EN_ATTENTE"
          editableStatuses={['PHASE3_EN_COURS', 'PHASE3_REJETEE']}
          onValidateClick={() => setValidating(3)}
        />
      </div>

      {innovation.status === 'VALIDEE' && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          <p className="text-sm font-medium">Innovation mise en œuvre à 100% — comptabilisée dans le KPI de performance.</p>
        </div>
      )}

      {validating && (
        <ValidatePhaseModal
          open={!!validating}
          onClose={() => setValidating(null)}
          innovationId={innovation.id}
          phase={validating}
        />
      )}
    </PageLayout>
  );
}
