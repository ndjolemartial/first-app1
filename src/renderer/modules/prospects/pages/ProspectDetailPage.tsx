import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useProspect, useDeleteProspect, useConvertProspect, useUpdateProspectStatus,
  useAssignableUsers, useAssignProspect,
} from '../hooks/useProspects';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, Trash2, UserCheck } from 'lucide-react';

/** Affectation des prospects : exclusivement réservée aux MANAGER+ (les comptables n'y ont pas accès). */
const ASSIGN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
/** Rôles habilités à convertir un prospect en client (équivalents à la création de client). */
/** Conversion prospect→client : AD est explicitement exclue (réduite au niveau AGENT sur ce module). */
const CONVERT_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']);
const formatUserName = (u: any): string =>
  u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'NOUVEAU',              label: 'Nouveau' },
  { value: 'CONTACTE',             label: 'Contacté' },
  { value: 'QUALIFIE',             label: 'Qualifié' },
  { value: 'ENVOI_PROPOSITION',    label: 'Proposition envoyée' },
  { value: 'NEGOCIATION_EN_COURS', label: 'Négociation en cours' },
  { value: 'PERDU',                label: 'Perdu' },
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
  ENVOI_PROPOSITION:    'Proposition envoyée',
  NEGOCIATION_EN_COURS: 'Négociation',
  CONVERTI:             'Converti',
  PERDU:                'Perdu',
};

const SOURCE_LABEL: Record<string, string> = {
  PROSPECTION:         'Prospection',
  SITE_WEB_AFRIKIMMO:  'Site web Afrikimmo',
  RECOMMENDATION:      'Recommandation',
  TELEPHONE:           'Téléphone',
  RESEAUX_SOCIAUX:     'Réseaux sociaux',
  EMAIL:               'Email',
  CONTACT_PERSONNEL:   'Contact personnel',
  AUTRE:               'Autre',
};

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: res, isLoading } = useProspect(Number(id));
  const deleteProspect  = useDeleteProspect();
  const convert         = useConvertProspect();
  const updateStatus    = useUpdateProspectStatus();
  const assign          = useAssignProspect();

  const role     = useAuthStore((s) => s.user?.role) ?? '';
  const canAssign  = ASSIGN_ROLES.has(role);
  const canConvert = CONVERT_ROLES.has(role);
  const { data: assignableUsers } = useAssignableUsers(canAssign);

  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [confirmConvert, setConfirmConvert] = useState(false);

  const p = res?.data;
  if (isLoading || !p) return null;

  const displayName = `${p.firstName} ${p.lastName}`.trim();
  const isConverted = p.status === 'CONVERTI';

  return (
    <PageLayout
      title={displayName}
      breadcrumbs={[{ label: 'Prospects', to: '/prospects' }, { label: displayName }]}
      actions={
        <div className="flex gap-2 items-end">
          {/* Sélecteur de statut (sauf si converti) */}
          {!isConverted && (
            <div className="w-44">
              <Select
                label=""
                options={STATUS_OPTIONS}
                value={p.status}
                disabled={updateStatus.isPending}
                onChange={(e) => updateStatus.mutate({ id: p.id, status: e.target.value })}
              />
            </div>
          )}
          {!isConverted && canConvert && (
            <Button
              variant="secondary"
              icon={<UserCheck className="h-4 w-4" />}
              onClick={() => setConfirmConvert(true)}
            >
              Convertir en client
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<Edit className="h-4 w-4" />}
            onClick={() => navigate(`/prospects/${id}/edit`)}
          >
            Modifier
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setConfirmDelete(true)}
          >
            Supprimer
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">

        {/* En-tête */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-purple-100 flex items-center justify-center text-lg font-bold text-purple-700 flex-shrink-0">
              {p.firstName?.[0]}{p.lastName?.[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
                <Badge variant={STATUS_VARIANT[p.status]}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </Badge>
                {isConverted && p.client && (
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => navigate(`/clients/${p.client.id}`)}
                  >
                    Voir la fiche client →
                  </button>
                )}
              </div>
              {p.email && <p className="text-slate-500 text-sm mt-1">{p.email}</p>}
            </div>
          </div>
        </Card>

        {/* Détails */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Informations</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Téléphone', p.phone  || '—'],
                ['Mobile',    p.mobile || '—'],
                ['Source',    SOURCE_LABEL[p.source] ?? p.source ?? '—'],
                ['Budget',    p.budget ? formatCurrency(p.budget) : '—'],
                ['Créé par',  p.createdBy ? formatUserName(p.createdBy) : '—'],
                ['Créé le',   formatDate(p.createdAt)],
                ['Modifié le',formatDate(p.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-slate-500 flex-shrink-0">{label}</dt>
                  <dd className="font-medium text-slate-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Affectation */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Affectation</h3>
            {canAssign ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Sélectionnez l'utilisateur en charge de ce prospect ou laissez non alloué.
                </p>
                <select
                  value={p.assignedToId ?? ''}
                  disabled={assign.isPending}
                  onChange={(e) =>
                    assign.mutate({
                      id: p.id,
                      assignedToId: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Non alloué</option>
                  {(assignableUsers ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatUserName(u)} {u.role ? `— ${u.role}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-slate-700">
                {p.assignedTo
                  ? formatUserName(p.assignedTo)
                  : <span className="italic text-slate-400">Non alloué</span>}
              </p>
            )}
          </Card>

        </div>

        {/* Notes */}
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Notes</h3>
          {p.notes
            ? <p className="text-sm text-slate-600 whitespace-pre-wrap">{p.notes}</p>
            : <p className="text-sm text-slate-400 italic">Aucune note enregistrée.</p>
          }
        </Card>

        {/* Activités CRM */}
        {p.activities?.length > 0 && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Historique des activités</h3>
            <div className="space-y-2">
              {p.activities.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 text-sm border-l-2 border-slate-200 pl-3 py-1">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{a.subject}</p>
                    {a.description && <p className="text-slate-500 text-xs mt-0.5">{a.description}</p>}
                  </div>
                  <span className="text-slate-400 text-xs flex-shrink-0">{formatDate(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Dialog suppression */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteProspect.mutateAsync(Number(id));
          navigate('/prospects');
        }}
        loading={deleteProspect.isPending}
        title="Supprimer le prospect"
        message={`Supprimer ${displayName} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
      />

      {/* Dialog conversion */}
      <ConfirmDialog
        open={confirmConvert}
        onClose={() => setConfirmConvert(false)}
        onConfirm={async () => {
          const r = await convert.mutateAsync({ id: Number(id) });
          setConfirmConvert(false);
          if (r?.success) navigate(`/clients/${r.data?.client?.id}`);
        }}
        loading={convert.isPending}
        title="Convertir en client"
        message={`Convertir ${displayName} en client ? Une fiche client sera créée automatiquement à partir de ses informations.`}
        confirmLabel="Convertir"
      />
    </PageLayout>
  );
}
