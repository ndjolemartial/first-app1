import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useClient, useDeleteClient, useUpdateClientStatus } from '../hooks/useClients';
import { formatDate } from '../../../shared/utils/format';
import { Edit, Trash2, FileText, IdCard } from 'lucide-react';

const STATUS_OPTIONS = [
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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading } = useClient(Number(id));
  const deleteClient = useDeleteClient();
  const updateStatus = useUpdateClientStatus();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const c = res?.data;
  if (isLoading || !c) return null;

  const displayName = c.type === 'INDIVIDUEL'
    ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
    : c.entreprise ?? '—';

  return (
    <PageLayout
      title={displayName}
      breadcrumbs={[{ label: 'Clients', to: '/clients' }, { label: displayName }]}
      actions={
        <div className="flex gap-2 items-end">
          <div className="w-36">
            <Select
              label=""
              options={STATUS_OPTIONS}
              value={c.status ?? 'ACTIF'}
              disabled={updateStatus.isPending}
              onChange={(e) => updateStatus.mutate({ id: c.id, status: e.target.value })}
            />
          </div>
          <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
            onClick={() => navigate(`/clients/${id}/edit`)}>Modifier</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setConfirmDelete(true)}>Supprimer</Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-green-100 flex items-center justify-center text-xl font-bold text-green-700">
              {displayName[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
                <Badge variant={c.type === 'INDIVIDUEL' ? 'info' : 'purple'}>
                  {c.type === 'INDIVIDUEL' ? 'Particulier' : 'Entreprise'}
                </Badge>
                <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>
                  {STATUS_OPTIONS.find((o) => o.value === c.status)?.label ?? c.status ?? '—'}
                </Badge>
              </div>
              {c.email && <p className="text-slate-500 text-sm mt-0.5">{c.email}</p>}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Coordonnées</h3>
            <dl className="space-y-3 text-sm">
              {[
                ...(c.type === 'INDIVIDUEL' && c.statutConjugal
                  ? [['Statut conjugal', { CELIBATAIRE: 'Célibataire', MARIEE: 'Marié(e)', CONCUBINAGE: 'Concubinage' }[c.statutConjugal as string] ?? c.statutConjugal]]
                  : []),
                ['Téléphone', c.phone ?? '—'],
                ['Mobile', c.mobile ?? '—'],
                ['Adresse', c.address ?? '—'],
                ['Ville', c.city ?? '—'],
                ['Pays', c.country],
                ['Créé le', formatDate(c.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {c.type === 'INDIVIDUEL' && (c.fatherFirstName || c.fatherLastName || c.motherFirstName || c.motherLastName) && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Filiation</h3>
              <dl className="space-y-3 text-sm">
                {[
                  ['Père', [c.fatherFirstName, c.fatherLastName].filter(Boolean).join(' ') || '—'],
                  ['Mère', [c.motherFirstName, c.motherLastName].filter(Boolean).join(' ') || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {c.prospect && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Origine</h3>
              <p className="text-sm text-slate-600">
                Converti depuis un prospect —{' '}
                <button className="text-blue-600 hover:underline text-sm"
                  onClick={() => navigate(`/prospects/${c.prospect.id}`)}>
                  voir la fiche prospect
                </button>
              </p>
            </Card>
          )}
        </div>

        {c.contracts?.length > 0 && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Contrats ({c.contracts.length})
            </h3>
            <div className="space-y-2">
              {c.contracts.map((contract: any) => (
                <div key={contract.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-4 py-3">
                  <span className="font-medium">{contract.reference}</span>
                  <Badge variant={contract.status === 'ACTIVE' ? 'success' : 'default'}>{contract.status}</Badge>
                  <span className="text-slate-500">{contract.property?.address}, {contract.property?.city}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {c.type === 'INDIVIDUEL' && (() => {
          const idDoc = c.documents?.find((d: any) => d.category === 'identité');
          return idDoc ? (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <IdCard className="h-4 w-4" /> Pièce d'identité
              </h3>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <FileText className="h-5 w-5 flex-shrink-0 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{idDoc.name}</p>
                  <p className="text-xs text-slate-400">
                    {idDoc.size < 1024 * 1024
                      ? `${(idDoc.size / 1024).toFixed(1)} Ko`
                      : `${(idDoc.size / (1024 * 1024)).toFixed(1)} Mo`}
                    {' — '}déposée le {formatDate(idDoc.uploadedAt)}
                  </p>
                </div>
              </div>
            </Card>
          ) : null;
        })()}

        {c.notes && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-2">Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.notes}</p>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteClient.mutateAsync(Number(id)); navigate('/clients'); }}
        loading={deleteClient.isPending}
        title="Supprimer le client"
        message={`Supprimer ${displayName} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
      />
    </PageLayout>
  );
}
