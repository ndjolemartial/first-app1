import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useQuotes, useQuotesStats } from '../hooks/useQuotes';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANT, QUOTE_TYPE_LABELS } from '../utils/quoteTemplate';
import { formatCurrency, formatDate, formatPersonName } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Plus, Search, FileSpreadsheet } from 'lucide-react';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'AGENT_TECHNIQUE'];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  ...Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];
const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  ...Object.entries(QUOTE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

function destinataire(q: any): string {
  if (q.client) return formatPersonName(q.client, '');
  if (q.prospect) return `${q.prospect.firstName ?? ''} ${q.prospect.lastName ?? ''}`.trim() + ' (prospect)';
  return '—';
}

export default function QuotesListPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = !!role && WRITE_ROLES.includes(role);
  // AGENT et AGENT_TECHNIQUE ne peuvent pas créer de devis (bouton masqué).
  const canCreate = canWrite && role !== 'AGENT' && role !== 'AGENT_TECHNIQUE';
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');

  const filters = { ...(status ? { status } : {}), ...(type ? { type } : {}), ...(search ? { search } : {}) };
  const { data: res, isLoading } = useQuotes(filters, 1, 100);
  const { data: statsRes } = useQuotesStats();
  const quotes = res?.data ?? [];
  const stats = statsRes?.data;

  return (
    <PageLayout
      title="Devis"
      breadcrumbs={[{ label: 'Devis' }]}
      actions={canCreate && (
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/quotes/new')}>
          Nouveau devis
        </Button>
      )}
    >
      {/* Indicateurs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><div className="text-sm text-slate-500">Total devis</div><div className="text-2xl font-bold text-slate-900">{stats.count}</div></Card>
          <Card><div className="text-sm text-slate-500">En attente (envoyés)</div><div className="text-2xl font-bold text-blue-600">{stats.byStatus?.ENVOYE?.count ?? 0}</div></Card>
          <Card><div className="text-sm text-slate-500">Acceptés</div><div className="text-2xl font-bold text-green-600">{stats.byStatus?.ACCEPTE?.count ?? 0}</div></Card>
          <Card><div className="text-sm text-slate-500">Taux de transformation</div><div className="text-2xl font-bold text-slate-900">{stats.conversionRate}%</div></Card>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text" placeholder="Rechercher (référence, client, notes)…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4"><SkeletonTable rows={6} /></div>
        ) : quotes.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Aucun devis.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Destinataire</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Émis le</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Validité</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((q: any) => (
                <tr key={q.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/quotes/${q.id}`)}>
                  <td className="px-4 py-3 font-medium text-indigo-600">{q.reference}</td>
                  <td className="px-4 py-3 text-slate-700">{destinataire(q)}</td>
                  <td className="px-4 py-3 text-slate-500">{QUOTE_TYPE_LABELS[q.type] ?? q.type}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(q.issueDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{q.validUntil ? formatDate(q.validUntil) : '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(q.total))}</td>
                  <td className="px-4 py-3"><Badge variant={QUOTE_STATUS_VARIANT[q.status] ?? 'default'}>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </PageLayout>
  );
}
