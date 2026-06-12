import { Fragment, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useQuote, useSendQuote, useAcceptQuote, useRefuseQuote, useCancelQuote, useConvertQuote, useDeleteQuote,
} from '../hooks/useQuotes';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANT, QUOTE_TYPE_LABELS, groupItemsByCategory, hasItemCategories } from '../utils/quoteTemplate';
import { formatCurrency, formatDate, formatPersonName } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Send, Check, X, Ban, Repeat, Pencil, Trash2, FileText } from 'lucide-react';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'AGENT_TECHNIQUE'];
const CONVERT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

function ConvertModal({ quote, onClose }: { quote: any; onClose: () => void }) {
  const navigate = useNavigate();
  const convert = useConvertQuote();
  const isSale = quote.type === 'VENTE_TERRAIN' || quote.type === 'VENTE_BIEN';
  const hasAsset = !!quote.terrainId || !!quote.propertyId;
  const [createConvention, setCreateConvention] = useState(isSale && !!quote.clientId);
  const [createInvoice, setCreateInvoice] = useState(false);
  const [reserveTerrain, setReserveTerrain] = useState(false);

  const run = async () => {
    const r = await convert.mutateAsync({ id: quote.id, arg: { createConvention, createInvoice, reserveTerrain } });
    if (r.success) {
      onClose();
      if (r.data?.conventionId) navigate(`/conventions/${r.data.conventionId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Convertir le devis {quote.reference}</h2>
        <p className="text-sm text-slate-500 mb-4">Sélectionnez les éléments à générer.</p>
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={createConvention} disabled={!isSale || !quote.clientId} onChange={(e) => setCreateConvention(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium">Convention de vente</span> (brouillon pré-rempli)
              {!quote.clientId && <span className="block text-xs text-amber-600">Indisponible : le devis vise un prospect — convertissez-le d'abord en client.</span>}
              {!isSale && <span className="block text-xs text-amber-600">Disponible uniquement pour les devis de vente.</span>}
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={createInvoice} onChange={(e) => setCreateInvoice(e.target.checked)} className="mt-0.5" />
            <span><span className="font-medium">Facture</span> (brouillon, montant total du devis)</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={reserveTerrain} disabled={!hasAsset} onChange={(e) => setReserveTerrain(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium">Réserver le bien</span> (passage en « sous option »)
              {!hasAsset && <span className="block text-xs text-amber-600">Aucun terrain/bien rattaché au devis.</span>}
            </span>
          </label>
        </div>
        <div className="flex gap-3 pt-5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" loading={convert.isPending} icon={<Repeat className="h-4 w-4" />} onClick={run}>Convertir</Button>
        </div>
      </div>
    </div>
  );
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = !!role && WRITE_ROLES.includes(role);
  const canConvert = !!role && CONVERT_ROLES.includes(role);

  const { data: res, isLoading } = useQuote(Number(id));
  const send = useSendQuote();
  const accept = useAcceptQuote();
  const refuse = useRefuseQuote();
  const cancel = useCancelQuote();
  const del = useDeleteQuote();
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseReason, setRefuseReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;
  const q = res?.data;
  if (!q) return <div className="p-8 text-slate-500">Devis introuvable.</div>;

  const recipient = q.client ? formatPersonName(q.client, '') : (q.prospect ? `${q.prospect.firstName ?? ''} ${q.prospect.lastName ?? ''}`.trim() + ' (prospect)' : '—');
  const isConverted = !!q.convertedConventionId || !!q.convertedInvoiceId;

  return (
    <PageLayout
      title={q.reference}
      breadcrumbs={[{ label: 'Devis', to: '/quotes' }, { label: q.reference }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => navigate(`/quotes/${id}/document`)}>Document</Button>
          {canWrite && q.status === 'BROUILLON' && (
            <>
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/quotes/${id}/edit`)}>Modifier</Button>
              <Button icon={<Send className="h-4 w-4" />} onClick={() => send.mutate({ id: q.id })}>Envoyer</Button>
            </>
          )}
          {canWrite && q.status === 'ENVOYE' && (
            <>
              <Button icon={<Check className="h-4 w-4" />} onClick={() => accept.mutate({ id: q.id })}>Accepter</Button>
              <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setRefuseOpen(true)}>Refuser</Button>
            </>
          )}
          {canConvert && q.status === 'ACCEPTE' && !isConverted && (
            <Button icon={<Repeat className="h-4 w-4" />} onClick={() => setConvertOpen(true)}>Convertir</Button>
          )}
          {canWrite && !isConverted && !['ANNULE', 'REFUSE'].includes(q.status) && (
            <Button variant="secondary" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelOpen(true)}>Annuler</Button>
          )}
          {canWrite && q.status === 'BROUILLON' && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>Supprimer</Button>
          )}
        </div>
      }
    >
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Badge variant={QUOTE_STATUS_VARIANT[q.status] ?? 'default'}>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</Badge>
          <span className="text-sm text-slate-500">{QUOTE_TYPE_LABELS[q.type] ?? q.type}</span>
          {isConverted && (
            <span className="text-sm text-green-700">
              Converti{q.convertedConventionId ? ' → convention' : ''}{q.convertedInvoiceId ? ' → facture' : ''}
            </span>
          )}
        </div>

        <Card>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><div className="text-slate-500">Destinataire</div><div className="font-medium">{recipient}</div></div>
            <div><div className="text-slate-500">Émis le</div><div className="font-medium">{formatDate(q.issueDate)}</div></div>
            <div><div className="text-slate-500">Validité</div><div className="font-medium">{q.validUntil ? formatDate(q.validUntil) : '—'}</div></div>
            {q.terrain && <div><div className="text-slate-500">Terrain</div><div className="font-medium">{q.terrain.reference}</div></div>}
            {q.property && <div><div className="text-slate-500">Bien</div><div className="font-medium">{q.property.reference}</div></div>}
            {q.agent && <div><div className="text-slate-500">Agent</div><div className="font-medium">{q.agent.firstName} {q.agent.lastName}</div></div>}
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Désignation</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Qté</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Prix unitaire</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hasItemCategories(q.items ?? [])
                ? groupItemsByCategory(q.items ?? []).map((g) => (
                    <Fragment key={g.category || '—'}>
                      <tr className="bg-slate-100/70">
                        <td colSpan={4} className="px-4 py-2 font-semibold text-slate-700">{g.category || 'AUTRES'}</td>
                      </tr>
                      {g.items.map((it: any) => (
                        <tr key={it.id}>
                          <td className="px-4 py-2.5 pl-8">{it.designation}</td>
                          <td className="px-4 py-2.5 text-right">{Number(it.quantity)}</td>
                          <td className="px-4 py-2.5 text-right">{formatCurrency(Number(it.unitPrice))}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(Number(it.total))}</td>
                        </tr>
                      ))}
                      <tr className="text-slate-500 italic">
                        <td colSpan={3} className="px-4 py-1.5 text-right">Sous-total {g.category || 'AUTRES'}</td>
                        <td className="px-4 py-1.5 text-right">{formatCurrency(g.subtotal)}</td>
                      </tr>
                    </Fragment>
                  ))
                : (q.items ?? []).map((it: any) => (
                    <tr key={it.id}>
                      <td className="px-4 py-2.5">{it.designation}</td>
                      <td className="px-4 py-2.5 text-right">{Number(it.quantity)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(Number(it.unitPrice))}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(Number(it.total))}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          <div className="flex flex-col items-end gap-1 p-4 border-t border-slate-200 text-sm">
            <div className="flex gap-8"><span className="text-slate-500">Sous-total</span><span className="w-40 text-right font-medium">{formatCurrency(Number(q.subtotal))}</span></div>
            {Number(q.discountAmount) > 0 && <div className="flex gap-8"><span className="text-slate-500">Remise{q.discountIsPercent ? ` (${Number(q.discountPercent) || 0} %)` : ''}</span><span className="w-40 text-right font-medium">- {formatCurrency(Number(q.discountAmount))}</span></div>}
            {Number(q.taxAmount) > 0 && <div className="flex gap-8"><span className="text-slate-500">TVA ({Number(q.taxRate)} %)</span><span className="w-40 text-right font-medium">{formatCurrency(Number(q.taxAmount))}</span></div>}
            <div className="flex gap-8 text-base"><span className="font-semibold">TOTAL</span><span className="w-40 text-right font-bold">{formatCurrency(Number(q.total))}</span></div>
            {q.depositExpected != null && Number(q.depositExpected) > 0 && <div className="flex gap-8"><span className="text-slate-500">Acompte attendu{q.depositIsPercent ? ` (${Number(q.depositPercent) || 0} %)` : ''}</span><span className="w-40 text-right font-medium">{formatCurrency(Number(q.depositExpected))}</span></div>}
          </div>
        </Card>

        {(q.conditions || q.notes) && (
          <Card>
            {q.conditions && <div className="mb-3"><div className="text-sm text-slate-500">Conditions</div><div className="text-sm whitespace-pre-wrap">{q.conditions}</div></div>}
            {q.notes && <div><div className="text-sm text-slate-500">Notes</div><div className="text-sm whitespace-pre-wrap">{q.notes}</div></div>}
          </Card>
        )}
      </div>

      {convertOpen && <ConvertModal quote={q} onClose={() => setConvertOpen(false)} />}

      {refuseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Refuser le devis</h2>
            <textarea rows={3} value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)}
              placeholder="Motif du refus (facultatif)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <div className="flex gap-3 pt-4">
              <Button variant="secondary" className="flex-1" onClick={() => setRefuseOpen(false)}>Annuler</Button>
              <Button variant="danger" className="flex-1" loading={refuse.isPending}
                onClick={async () => { const r = await refuse.mutateAsync({ id: q.id, arg: refuseReason }); if (r.success) setRefuseOpen(false); }}>
                Refuser
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={cancelOpen} title="Annuler le devis"
        message={`Annuler le devis ${q.reference} ? Il ne pourra plus être envoyé ni converti.`}
        confirmLabel="Annuler le devis" loading={cancel.isPending}
        onConfirm={async () => { await cancel.mutateAsync({ id: q.id }); setCancelOpen(false); }}
        onClose={() => setCancelOpen(false)} />

      <ConfirmDialog open={deleteOpen} title="Supprimer le devis"
        message={`Supprimer définitivement le brouillon ${q.reference} ?`}
        confirmLabel="Supprimer" loading={del.isPending}
        onConfirm={async () => { const r = await del.mutateAsync(q.id); if (r.success) navigate('/quotes'); }}
        onClose={() => setDeleteOpen(false)} />
    </PageLayout>
  );
}
