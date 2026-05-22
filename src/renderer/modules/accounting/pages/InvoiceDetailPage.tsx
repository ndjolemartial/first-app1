import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useInvoice, useUpdateInvoiceStatus, useAddPayment, usePrintInvoice } from '../hooks/useAccounting';
import TreasuryAccountFields from '../../../shared/components/TreasuryAccountFields';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { FileText, User, CreditCard, Plus, Printer } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  BROUILLON: 'default', ENVOYEE: 'info', PAYEE: 'success',
  PARTIEL: 'warning', EN_RETARD: 'danger', ANNULEE: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon', ENVOYEE: 'Envoyée', PAYEE: 'Payée',
  PARTIEL: 'Partiel', EN_RETARD: 'En retard', ANNULEE: 'Annulée',
};
const TYPE_LABEL: Record<string, string> = {
  VENTE: 'Vente', ECHEANCE_VENTE: 'Échéance vente', FRAIS_AGENCE: 'Frais agence',
  FRAIS_DE_GESTION: 'Frais gestion', AVANCE: 'Avance', CAUTION: 'Caution', OTHER: 'Autre',
};
const PAYMENT_METHOD_OPTIONS = [
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];
const STATUS_TRANSITION: Record<string, string[]> = {
  BROUILLON: ['ENVOYEE', 'ANNULEE'],
  ENVOYEE: ['PAYEE', 'EN_RETARD', 'ANNULEE'],
  EN_RETARD: ['PAYEE', 'ANNULEE'],
  PARTIEL: ['PAYEE', 'ANNULEE'],
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading, refetch } = useInvoice(Number(id));
  const updateStatus = useUpdateInvoiceStatus();
  const addPayment = useAddPayment();
  const printInvoice = usePrintInvoice();
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: { amount: '', method: 'ESPECE', reference: '', notes: '' },
  });

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;
  const inv = res?.data;
  if (!inv) return <div className="p-8 text-slate-500">Facture introuvable.</div>;

  const clientName = inv.client?.type === 'INDIVIDUEL'
    ? `${inv.client?.firstName ?? ''} ${inv.client?.lastName ?? ''}`.trim()
    : (inv.client?.entreprise ?? '—');

  const totalPaid = inv.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) ?? 0;
  const remaining = Number(inv.total) - totalPaid;
  const transitions = STATUS_TRANSITION[inv.status] ?? [];

  const handleStatusChange = async (status: string) => {
    await updateStatus.mutateAsync({ id: Number(id), status });
    refetch();
  };

  const onPaymentSubmit = async (data: any) => {
    const r = await addPayment.mutateAsync({
      invoiceId: Number(id),
      payload: {
        amount: Number(data.amount),
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        bankAccountId: data.bankAccountId ? Number(data.bankAccountId) : undefined,
        categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      },
    });
    if (r.success) {
      reset();
      setShowPaymentForm(false);
      refetch();
    }
  };

  return (
    <PageLayout
      title={inv.reference}
      breadcrumbs={[
        { label: 'Comptabilité', to: '/accounting' },
        { label: 'Factures', to: '/accounting/invoices' },
        { label: inv.reference },
      ]}
      actions={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer className="h-4 w-4" />}
            onClick={() => printInvoice(Number(id))}
          >
            Imprimer
          </Button>
          {transitions.map((s) => (
            <Button
              key={s}
              variant={s === 'ANNULEE' ? 'danger' : 'secondary'}
              size="sm"
              loading={updateStatus.isPending}
              onClick={() => handleStatusChange(s)}
            >
              → {STATUS_LABEL[s] ?? s}
            </Button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="col-span-2 space-y-6">
          {/* En-tête */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{inv.reference}</h2>
                  <p className="text-slate-500 text-sm">{TYPE_LABEL[inv.type] ?? inv.type}</p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[inv.status] ?? 'default'}>{STATUS_LABEL[inv.status] ?? inv.status}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500 mb-1">Émise le</p>
                <p className="font-medium">{formatDate(inv.issueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Échéance</p>
                <p className="font-medium">{formatDate(inv.dueDate)}</p>
              </div>
              {inv.paidAt && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Payée le</p>
                  <p className="font-medium">{formatDate(inv.paidAt)}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Lignes */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-4">Détail de la facture</h3>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Qté</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">P.U.</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inv.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right">{Number(item.quantity)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(item.total))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 text-sm">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-slate-500">Sous-total HT</td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(inv.subtotal))}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-slate-500">TVA ({Number(inv.taxRate)}%)</td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(inv.taxAmount))}</td>
                </tr>
                <tr className="font-bold text-base">
                  <td colSpan={3} className="px-3 py-2 text-right">Total TTC</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(Number(inv.total))}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {/* Paiements */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">Paiements reçus</h3>
                {inv.payments?.length > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Encaissé : {formatCurrency(totalPaid)} — Restant : {formatCurrency(remaining)}
                  </p>
                )}
              </div>
              {inv.status !== 'PAYEE' && inv.status !== 'ANNULEE' && (
                <Button
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setShowPaymentForm((v) => !v)}
                >
                  Encaissement partiel
                </Button>
              )}
            </div>

            {showPaymentForm && (
              <form onSubmit={handleSubmit(onPaymentSubmit)} className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Montant *</label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      required
                      {...register('amount')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Mode de paiement</label>
                    <select
                      {...register('method')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {PAYMENT_METHOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Référence (optionnel)</label>
                  <input
                    type="text"
                    {...register('reference')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <TreasuryAccountFields register={register} watch={watch} setValue={setValue} direction="ENTREE" />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowPaymentForm(false)}>Annuler</Button>
                  <Button type="submit" size="sm" loading={isSubmitting}>Enregistrer</Button>
                </div>
              </form>
            )}

            {inv.payments?.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun paiement enregistré.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Mode</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Référence</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inv.payments?.map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-slate-500">{formatDate(p.paidAt)}</td>
                      <td className="px-3 py-2">{p.method}</td>
                      <td className="px-3 py-2 text-slate-400">{p.reference ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCurrency(Number(p.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {inv.client && (
            <Card>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" /> Client
              </h3>
              <p className="font-medium text-slate-900">{clientName}</p>
              {inv.client?.phone && <p className="text-sm text-slate-500">{inv.client.phone}</p>}
              {inv.client?.email && <p className="text-sm text-slate-500">{inv.client.email}</p>}
              <Button variant="ghost" size="sm" className="mt-2 -ml-2"
                onClick={() => navigate(`/clients/${inv.client?.id}`)}>
                Voir le client →
              </Button>
            </Card>
          )}

          {inv.convention && (
            <Card>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-500" /> Convention
              </h3>
              <p className="font-medium text-slate-900">{inv.convention?.reference}</p>
              <p className="text-sm text-slate-500">{inv.convention?.property?.address}</p>
              <Button variant="ghost" size="sm" className="mt-2 -ml-2"
                onClick={() => navigate(`/conventions/${inv.convention?.id}`)}>
                Voir la convention →
              </Button>
            </Card>
          )}

          <Card>
            <h3 className="font-semibold text-slate-800 mb-3">Récapitulatif</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Référence</span>
                <span className="font-medium">{inv.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total TTC</span>
                <span className="font-bold">{formatCurrency(Number(inv.total))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Encaissé</span>
                <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500">Restant dû</span>
                <span className={`font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(remaining)}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-800 mb-3">Informations</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Créée le</span>
                <span>{formatDate(inv.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mise à jour</span>
                <span>{formatDate(inv.updatedAt)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
