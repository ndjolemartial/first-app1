import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useProformaInvoices } from '../hooks/useProforma';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { Search, FileSpreadsheet } from 'lucide-react';

const SOURCE_LABEL: Record<string, string> = { QUOTE: 'Devis', CONVENTION: 'Convention' };

export default function ProformaListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sourceType, setSourceType] = useState('');

  const filters = { ...(search ? { search } : {}), ...(sourceType ? { sourceType } : {}) };
  const { data: res, isLoading } = useProformaInvoices(filters, 1, 100);
  const proformas = res?.data ?? [];

  return (
    <PageLayout title="Factures Proforma" breadcrumbs={[{ label: 'Factures Proforma' }]}>
      <p className="text-xs text-slate-500 mb-4">
        Document optionnel et sans valeur comptable, émis à la demande d'un client ou d'un prospect avant un achat
        de terrain ou de bien immobilier — depuis un devis (Vente terrain/bien) ou une convention encore en Brouillon.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text" placeholder="Rechercher (référence, destinataire)…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Toutes origines</option>
          <option value="QUOTE">Depuis un devis</option>
          <option value="CONVENTION">Depuis une convention</option>
        </select>
      </div>

      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4"><SkeletonTable rows={6} /></div>
        ) : proformas.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Aucune facture Proforma.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Destinataire</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Origine</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Émise le</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Validité</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {proformas.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/proforma/${p.id}`)}>
                  <td className="px-4 py-3 font-medium text-indigo-600">{p.reference}</td>
                  <td className="px-4 py-3 text-slate-700">{p.recipientLabel || '—'}</td>
                  <td className="px-4 py-3"><Badge variant="default">{SOURCE_LABEL[p.sourceType] ?? p.sourceType}</Badge> <span className="text-slate-500 text-xs">{p.quoteReference || p.conventionReference}</span></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.issueDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{p.validUntil ? formatDate(p.validUntil) : '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(p.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </PageLayout>
  );
}
