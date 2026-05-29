import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useAttestation, useDeleteAttestation } from '../hooks/useAttestations';
import { ATTESTATION_TYPE_LABELS } from '../utils/attestationTemplate';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, Trash2, FileText, User, MapPin, Link2 } from 'lucide-react';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';

const TYPE_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  ATTRIBUTION: 'info',
  CESSION: 'warning',
  SOLDE: 'success',
  TRANSFERT_PROPRIETE: 'default',
};

function clientName(c: any): string {
  if (!c) return '—';
  return c.type === 'INDIVIDUEL'
    ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
    : (c.entreprise ?? '—');
}

export default function AttestationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading } = useAttestation(Number(id));
  const deleteAttestation = useDeleteAttestation();
  const [showDelete, setShowDelete] = useState(false);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;

  const a = res?.data;
  if (!a) return <div className="p-8 text-slate-500">Attestation introuvable.</div>;

  const handleDelete = async () => {
    const r = await deleteAttestation.mutateAsync(Number(id));
    if (r.success) navigate('/conventions/attestations');
    setShowDelete(false);
  };

  return (
    <PageLayout
      title={a.reference}
      breadcrumbs={[
        { label: 'Conventions', to: '/conventions' },
        { label: 'Attestations', to: '/conventions/attestations' },
        { label: a.reference },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<FileText className="h-4 w-4" />}
            onClick={() => navigate(`/conventions/attestations/${id}/document`)}>
            Générer le document
          </Button>
          <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
            onClick={() => navigate(`/conventions/attestations/${id}/edit`)}>
            Modifier
          </Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setShowDelete(true)}>
            Supprimer
          </Button>
        </div>
      }
    >
      <div className="space-y-4 max-w-4xl">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant={TYPE_BADGE[a.type] ?? 'default'}>
                  {ATTESTATION_TYPE_LABELS[a.type] ?? a.type}
                </Badge>
                <span className="text-sm text-slate-500">Émise le {formatDate(a.emittedAt)}</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-800">{a.reference}</h2>
            </div>
            {a.amount != null && (
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase">Montant</div>
                <div className="text-xl font-semibold text-slate-800">{formatCurrency(Number(a.amount))}</div>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              {a.type === 'CESSION' ? 'Cessionnaire (bénéficiaire)' : 'Client bénéficiaire'}
            </h3>
            <div className="text-sm text-slate-700 space-y-1">
              <div className="font-medium">{clientName(a.client)}</div>
              {a.client?.phone && <div>{a.client.phone}</div>}
              {a.client?.email && <div className="text-slate-500">{a.client.email}</div>}
              {a.client?.idNumber && <div className="text-xs text-slate-500">Pièce : {a.client.idNumber}</div>}
            </div>
          </Card>

          {a.secondaryClient && (
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-amber-600" />
                {a.type === 'CESSION' ? 'Cédant' : 'Partie secondaire'}
              </h3>
              <div className="text-sm text-slate-700 space-y-1">
                <div className="font-medium">{clientName(a.secondaryClient)}</div>
                {a.secondaryClient?.phone && <div>{a.secondaryClient.phone}</div>}
                {a.secondaryClient?.idNumber && (
                  <div className="text-xs text-slate-500">Pièce : {a.secondaryClient.idNumber}</div>
                )}
              </div>
            </Card>
          )}

          {(a.terrain || a.property) && (
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Bien concerné
              </h3>
              {a.terrain && (
                <div className="text-sm text-slate-700 space-y-1">
                  <div className="font-medium">{a.terrain.reference}</div>
                  {a.terrain.numeroParcelle && <div>Parcelle {a.terrain.numeroParcelle}</div>}
                  {a.terrain.lotissement?.nom && (
                    <div className="text-xs text-slate-500">Lotissement : {a.terrain.lotissement.nom}</div>
                  )}
                </div>
              )}
              {a.property && (
                <div className="text-sm text-slate-700 space-y-1">
                  <div className="font-medium">{a.property.reference}</div>
                  <div>{a.property.address}, {a.property.city}</div>
                </div>
              )}
            </Card>
          )}

          {a.convention && (() => {
            const lot = a.convention.terrains?.[0]?.terrain?.lotissement;
            return (
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-indigo-600" />
                  Convention liée
                </h3>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/conventions/${a.convention.id}`)}>
                  {a.convention.reference}
                </Button>
                {(lot?.nom || lot?.ville) && (
                  <dl className="mt-3 space-y-1 text-sm text-slate-600">
                    {lot?.nom && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Lotissement</dt>
                        <dd className="font-medium text-slate-800">{lot.nom}</dd>
                      </div>
                    )}
                    {lot?.ville && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Ville du lotissement</dt>
                        <dd className="font-medium text-slate-800">{lot.ville}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </Card>
            );
          })()}
        </div>

        {a.notes && (
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.notes}</p>
          </Card>
        )}

        {a.emittedBy && (
          <p className="text-xs text-slate-500">
            Émise par {a.emittedBy.firstName} {a.emittedBy.lastName} ({a.emittedBy.matricule})
          </p>
        )}

        <EntityDocumentsCard
          documents={a.documents ?? []}
          defaultLinks={{ attestationId: Number(id) }}
          invalidateKey={['attestation', Number(id)]}
        />
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Supprimer l'attestation"
        message={`Supprimer l'attestation « ${a.reference} » ? Cette action est réversible (soft delete).`}
        onConfirm={handleDelete}
        onClose={() => setShowDelete(false)}
      />
    </PageLayout>
  );
}
