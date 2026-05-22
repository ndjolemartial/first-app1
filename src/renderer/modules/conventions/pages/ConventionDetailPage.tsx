import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useConvention, useDeleteConvention, useGenerateInstallments } from '../hooks/useConventions';
import { usePrintInvoice } from '../../accounting/hooks/useAccounting';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, Trash2, FileText, User, Building2, MapPin, Link2, Printer, RefreshCw } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success', BROUILLON: 'info', ATTENTE_SIGNATURE: 'warning',
  EXPIRE: 'danger', TERMINER: 'default', ANNULE: 'danger',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active', BROUILLON: 'Brouillon', ATTENTE_SIGNATURE: 'Attente signature',
  EXPIRE: 'Expirée', TERMINER: 'Terminée', ANNULE: 'Annulée',
};
const TYPE_LABEL: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Location non meublée', RENTAL_FURNISHED: 'Location meublée',
  SALE: 'Vente', MANAGEMENT: 'Gestion', COMMERCIAL_LEASE: 'Bail commercial',
  SOUSCRIPTION: 'Souscription', AVENANT: 'Avenant', RESILIATION: 'Résiliation',
};
const AMENDMENT_NATURE_LABEL: Record<string, string> = {
  PROLONGATION_DELAI: 'Avenant de prolongation de délai',
  TRANSFERT_PROPRIETE: 'Avenant de transfert de propriété',
  TRANSFERT_SITE: 'Avenant de transfert de site / changement de lot',
};
const PAYMENT_LABEL: Record<string, string> = {
  ESPECE: 'Espèces', CHEQUE: 'Chèque', TRANSFERT: 'Transfert', VIREMENT: 'Virement', MOBILE_MONEY: 'Mobile Money',
  NON_DEFINI: 'Non défini',
};
const INSTALLMENT_STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  PAYE: 'success', EN_ATTENTE: 'info', A_REGLER: 'warning', EN_RETARD: 'danger', ANNULE: 'default',
};
const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  PAYE: 'Payé', EN_ATTENTE: 'En attente', A_REGLER: 'À régler', EN_RETARD: 'En retard', ANNULE: 'Annulé',
};

export default function ConventionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading, refetch } = useConvention(Number(id));
  const deleteConvention = useDeleteConvention();
  const generateInstallments = useGenerateInstallments();
  const printInvoice = usePrintInvoice();
  const [showDelete, setShowDelete] = useState(false);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;

  const c = res?.data;
  if (!c) return <div className="p-8 text-slate-500">Convention introuvable.</div>;

  const isSale = c.type === 'SALE';
  const clientName = c.client?.type === 'INDIVIDUEL'
    ? `${c.client?.firstName ?? ''} ${c.client?.lastName ?? ''}`.trim()
    : (c.client?.entreprise ?? '—');
  const secondaryClientName = c.secondaryClient
    ? (c.secondaryClient.type === 'INDIVIDUEL'
        ? `${c.secondaryClient.firstName ?? ''} ${c.secondaryClient.lastName ?? ''}`.trim()
        : (c.secondaryClient.entreprise ?? '—'))
    : null;

  const handleDelete = async () => {
    const r = await deleteConvention.mutateAsync(Number(id));
    if (r.success) navigate('/conventions');
    setShowDelete(false);
  };

  const handleGenerateInstallments = async () => {
    await generateInstallments.mutateAsync(Number(id));
    refetch();
  };

  const totalPaid = c.installments
    ?.filter((i: any) => i.status === 'PAYE')
    .reduce((acc: number, i: any) => acc + Number(i.amount), 0) ?? 0;
  const totalDue = c.installments?.reduce((acc: number, i: any) => acc + Number(i.amount), 0) ?? 0;

  return (
    <PageLayout
      title={c.reference}
      breadcrumbs={[{ label: 'Conventions', to: '/conventions' }, { label: c.reference }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => navigate(`/conventions/${id}/document`)}>
            Générer le document
          </Button>
          <Button variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/conventions/${id}/edit`)}>
            Modifier
          </Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setShowDelete(true)}>
            Supprimer
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="col-span-2 space-y-6">
          {/* En-tête convention */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{c.reference}</h2>
                  <p className="text-slate-500 text-sm">
                    {c.type === 'AVENANT' && c.amendmentType
                      ? (AMENDMENT_NATURE_LABEL[c.amendmentType] ?? TYPE_LABEL[c.type])
                      : (TYPE_LABEL[c.type] ?? c.type)}
                  </p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500 mb-1">Date de début</p>
                <p className="font-medium">{formatDate(c.startDate)}</p>
              </div>
              {c.endDate && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Date de fin</p>
                  <p className="font-medium">{formatDate(c.endDate)}</p>
                </div>
              )}
              {c.signedAt && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Signée le</p>
                  <p className="font-medium">{formatDate(c.signedAt)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 mb-1">Mode de paiement</p>
                <p className="font-medium">{PAYMENT_LABEL[c.paymentMethod] ?? c.paymentMethod}</p>
              </div>
              {c.paymentDay && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Jour de paiement</p>
                  <p className="font-medium">Le {c.paymentDay} du mois</p>
                </div>
              )}
            </div>

            {/* Montants */}
            <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-slate-100">
              {c.rentAmount && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Loyer mensuel</p>
                  <p className="font-bold text-lg text-slate-900">{formatCurrency(Number(c.rentAmount))}</p>
                </div>
              )}
              {c.saleAmount && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Prix de vente</p>
                  <p className="font-bold text-lg text-slate-900">{formatCurrency(Number(c.saleAmount))}</p>
                </div>
              )}
              {c.apportInitial && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Apport initial</p>
                  <p className="font-medium">{formatCurrency(Number(c.apportInitial))}</p>
                </div>
              )}
              {c.deposit && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Caution</p>
                  <p className="font-medium">{formatCurrency(Number(c.deposit))}</p>
                </div>
              )}
              {c.agencyFees && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Honoraires</p>
                  <p className="font-medium">{formatCurrency(Number(c.agencyFees))}</p>
                </div>
              )}
              {c.charges && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Charges</p>
                  <p className="font-medium">{formatCurrency(Number(c.charges))}</p>
                </div>
              )}
            </div>

            {c.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm text-slate-700">{c.notes}</p>
              </div>
            )}
          </Card>

          {/* Tableau d'échéances (vente) */}
          {isSale && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800">Tableau d'échéances</h3>
                  {c.installments?.length > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Encaissé : {formatCurrency(totalPaid)} / {formatCurrency(totalDue)}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<RefreshCw className="h-4 w-4" />}
                  loading={generateInstallments.isPending}
                  onClick={handleGenerateInstallments}
                >
                  {c.installments?.length > 0 ? 'Regénérer' : 'Générer les échéances'}
                </Button>
              </div>

              {c.paymentModalites === 'CASH' ? (
                <p className="text-sm text-slate-500">Paiement comptant — pas d'échéances.</p>
              ) : c.installments?.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Cliquez sur "Générer les échéances" pour créer le tableau d'amortissement.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">N°</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Échéance</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600">Montant</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Statut</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Payé le</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.installments?.map((inst: any) => (
                      <tr key={inst.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500">{inst.installmentNumber}</td>
                        <td className="px-3 py-2 font-medium">{formatDate(inst.dueDate)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(inst.amount))}</td>
                        <td className="px-3 py-2">
                          <Badge variant={INSTALLMENT_STATUS_VARIANT[inst.status] ?? 'default'}>
                            {INSTALLMENT_STATUS_LABEL[inst.status] ?? inst.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {inst.paidAt ? formatDate(inst.paidAt) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {inst.status === 'PAYE' && inst.invoiceId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Printer className="h-4 w-4" />}
                              onClick={() => printInvoice(inst.invoiceId)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Client */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500" /> {secondaryClientName ? 'Client principal' : 'Client'}
            </h3>
            <p className="font-medium text-slate-900">{clientName}</p>
            {c.client?.phone && <p className="text-sm text-slate-500">{c.client.phone}</p>}
            {c.client?.email && <p className="text-sm text-slate-500">{c.client.email}</p>}
            <Button variant="ghost" size="sm" className="mt-2 -ml-2"
              onClick={() => navigate(`/clients/${c.client?.id}`)}>
              Voir le client →
            </Button>
            {secondaryClientName && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Souscripteur associé / successeur</p>
                <p className="font-medium text-slate-900">{secondaryClientName}</p>
                {c.secondaryClient?.phone && <p className="text-sm text-slate-500">{c.secondaryClient.phone}</p>}
                <Button variant="ghost" size="sm" className="mt-1 -ml-2"
                  onClick={() => navigate(`/clients/${c.secondaryClient?.id}`)}>
                  Voir le souscripteur →
                </Button>
              </div>
            )}
          </Card>

          {/* Bien ou terrain rattaché */}
          {c.assetType === 'TERRAIN' ? (
            <Card>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-500" /> Terrain
              </h3>
              <p className="font-medium text-slate-900">{c.terrain?.reference}</p>
              {c.terrain?.lotissement && (
                <p className="text-sm text-slate-500">Lotissement {c.terrain.lotissement.nom}</p>
              )}
              {(c.terrain?.numeroIlot || c.terrain?.numeroParcelle) && (
                <p className="text-sm text-slate-500">
                  Îlot {c.terrain?.numeroIlot ?? '—'} · Parcelle {c.terrain?.numeroParcelle ?? '—'}
                </p>
              )}
              <Button variant="ghost" size="sm" className="mt-2 -ml-2"
                onClick={() => navigate(`/terrains/${c.terrain?.id}`)}>
                Voir le terrain →
              </Button>
            </Card>
          ) : (
            <Card>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" /> Bien
              </h3>
              <p className="font-medium text-slate-900">{c.property?.reference}</p>
              <p className="text-sm text-slate-500">{c.property?.address}</p>
              <p className="text-sm text-slate-500">{c.property?.city}</p>
              <Button variant="ghost" size="sm" className="mt-2 -ml-2"
                onClick={() => navigate(`/properties/${c.property?.id}`)}>
                Voir le bien →
              </Button>
            </Card>
          )}

          {/* Conventions liées (avenant / résiliation) */}
          {(c.parentConvention || (c.amendments?.length ?? 0) > 0) && (
            <Card>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-slate-500" /> Conventions liées
              </h3>
              {c.parentConvention && (
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-1">
                    {c.type === 'RESILIATION' ? 'Convention résiliée' : 'Convention initiale / précédente'}
                  </p>
                  <button
                    className="text-sm font-medium text-blue-600 hover:underline"
                    onClick={() => navigate(`/conventions/${c.parentConvention.id}`)}
                  >
                    {c.parentConvention.reference} — {TYPE_LABEL[c.parentConvention.type] ?? c.parentConvention.type}
                  </button>
                </div>
              )}
              {(c.amendments?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Avenants &amp; résiliation</p>
                  <div className="space-y-1">
                    {c.amendments.map((a: any) => (
                      <button
                        key={a.id}
                        className="block text-sm font-medium text-blue-600 hover:underline"
                        onClick={() => navigate(`/conventions/${a.id}`)}
                      >
                        {a.reference} — {TYPE_LABEL[a.type] ?? a.type}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Métadonnées */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-3">Informations</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Référence</span>
                <span className="font-medium">{c.reference}</span>
              </div>
              {c.agent && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Agent</span>
                  <span>{c.agent.firstName} {c.agent.lastName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Créée le</span>
                <span>{formatDate(c.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mise à jour</span>
                <span>{formatDate(c.updatedAt)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Supprimer la convention"
        message={`Supprimer la convention ${c.reference} ? Cette action est irréversible.`}
        onConfirm={handleDelete}
        onClose={() => setShowDelete(false)}
      />
    </PageLayout>
  );
}
