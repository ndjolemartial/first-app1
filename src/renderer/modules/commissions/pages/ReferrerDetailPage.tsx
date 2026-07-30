import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useReferrer, useDeleteReferrer } from '../hooks/useCommissions';
import { referrerName, COMMISSION_WRITE_ROLES, COMMISSION_REFERRERS_DELETE_ROLES, COMMISSION_REFERRERS_FULL_VIEW_ROLES } from '../utils/commissions.utils';
import { formatDate, formatPersonName } from '../../../shared/utils/format';
import { Edit, Trash2, Receipt, History } from 'lucide-react';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';

export default function ReferrerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canManage = COMMISSION_WRITE_ROLES.includes(role);
  const canDelete = COMMISSION_REFERRERS_DELETE_ROLES.includes(role);
  const canViewCommissions = COMMISSION_REFERRERS_FULL_VIEW_ROLES.includes(role);

  const { data: res, isLoading } = useReferrer(Number(id));
  const deleteReferrer = useDeleteReferrer();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const r = res?.data;

  if (isLoading) {
    return (
      <PageLayout title="Chargement…" breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Apporteurs d\'affaire', to: '/commissions/referrers' }, { label: '…' }]}>
        <Card><p className="text-sm text-slate-500">Chargement de la fiche…</p></Card>
      </PageLayout>
    );
  }
  if (!r) {
    const errMsg = res && !res.success
      ? (typeof res.error === 'string' ? res.error : 'Fiche inaccessible')
      : 'Apporteur d\'affaire introuvable';
    return (
      <PageLayout title="Fiche apporteur" breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Apporteurs d\'affaire', to: '/commissions/referrers' }, { label: 'Erreur' }]}>
        <Card>
          <p className="text-sm text-red-600">{errMsg}</p>
          <button className="mt-3 text-sm text-blue-600 hover:underline" onClick={() => navigate('/commissions/referrers')}>
            ← Retour à la liste
          </button>
        </Card>
      </PageLayout>
    );
  }

  const displayName = referrerName(r);
  const personName = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();

  const handleDelete = async () => {
    const delRes = await deleteReferrer.mutateAsync(Number(id));
    if (delRes.success) navigate('/commissions/referrers');
  };
  const deleteError = deleteReferrer.data && !deleteReferrer.data.success ? deleteReferrer.data.error : null;

  return (
    <PageLayout
      title={displayName}
      breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Apporteurs d\'affaire', to: '/commissions/referrers' }, { label: displayName }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<History className="h-4 w-4" />}
            onClick={() => navigate(`/commissions/referrers/${id}/timeline`)}>Fiche de suivi</Button>
          {canViewCommissions && (
            <Button variant="secondary" icon={<Receipt className="h-4 w-4" />}
              onClick={() => navigate(`/commissions/beneficiary/REFERRER/${id}`)}>Commissions</Button>
          )}
          {canManage && (
            <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
              onClick={() => navigate(`/commissions/referrers/${id}/edit`)}>Modifier</Button>
          )}
          {canDelete && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}
              onClick={() => { deleteReferrer.reset(); setConfirmDelete(true); }}>Supprimer</Button>
          )}
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">

        {/* En-tête */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-700">
              {displayName[0] ?? '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
                <Badge variant={r.isActive ? 'success' : 'danger'}>{r.isActive ? 'Actif' : 'Inactif'}</Badge>
              </div>
              {r.companyName && personName && (
                <p className="text-slate-500 text-sm mt-0.5">Contact : {personName}</p>
              )}
              {r.email && <p className="text-slate-500 text-sm mt-0.5">{r.email}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{r._count?.commissions ?? 0}</p>
              <p className="text-xs text-slate-500">Commission(s)</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {/* Coordonnées */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Coordonnées</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Téléphone 1', r.phone ?? '—'],
                ['Téléphone 2', r.mobile ?? '—'],
                ['Adresse', r.address ?? '—'],
                ['Ville', r.city ?? '—'],
                ['Pays', r.country],
                ['Créé le', formatDate(r.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Infos bancaires */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Informations bancaires</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['IBAN', r.bankIban ?? '—'],
                ['BIC', r.bankBic ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900 font-mono text-xs">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        {/* Affectation */}
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Affectation</h3>
          <dl className="text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Utilisateur référent</dt>
              <dd className="font-medium text-slate-900">
                {r.assignedTo ? formatPersonName(r.assignedTo) : '—'}
              </dd>
            </div>
          </dl>
        </Card>

        {r.notes && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-2">Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{r.notes}</p>
          </Card>
        )}

        <EntityDocumentsCard
          documents={r.documents ?? []}
          defaultLinks={{ referrerId: Number(id) }}
          invalidateKey={['commissions', 'referrer', Number(id)]}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleteReferrer.isPending}
        title="Supprimer l'apporteur d'affaire"
        message={
          deleteError && typeof deleteError === 'string'
            ? deleteError
            : `Supprimer ${displayName} ? Cette action est irréversible.`
        }
        confirmLabel="Supprimer"
      />
    </PageLayout>
  );
}
