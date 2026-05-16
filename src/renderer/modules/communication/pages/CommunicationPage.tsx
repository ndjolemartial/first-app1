import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useCommunicationHistory } from '../hooks/useCommunication';
import { formatDateTime } from '../../../shared/utils/format';
import { Mail, MessageSquare, Send, BookOpen } from 'lucide-react';

const CHANNEL_VARIANT: Record<string, 'info' | 'success'> = { EMAIL: 'info', SMS: 'success' };
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  EN_ATTENTE: 'warning', ENVOYE: 'success', RECU: 'info', ECHEC: 'danger', REFUSE: 'danger',
};
const STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente', ENVOYE: 'Envoyé', RECU: 'Reçu', ECHEC: 'Échec', REFUSE: 'Refusé',
};

const CHANNEL_OPTIONS = [
  { value: '', label: 'Tous les canaux' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
];
const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'ENVOYE', label: 'Envoyé' },
  { value: 'ECHEC', label: 'Échec' },
];

export default function CommunicationPage() {
  const navigate = useNavigate();
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;

  const filters: any = {};
  if (channel) filters.channel = channel;
  if (status) filters.status = status;

  const { data: res, isLoading } = useCommunicationHistory(filters, page, limit);
  const history = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <PageLayout
      title="Communication"
      breadcrumbs={[{ label: 'Communication' }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<BookOpen className="h-4 w-4" />} onClick={() => navigate('/communication/templates')}>
            Templates
          </Button>
          <Button variant="secondary" icon={<MessageSquare className="h-4 w-4" />} onClick={() => navigate('/communication/send?channel=SMS')}>
            Envoyer SMS
          </Button>
          <Button icon={<Send className="h-4 w-4" />} onClick={() => navigate('/communication/send?channel=EMAIL')}>
            Envoyer Email
          </Button>
        </div>
      }
    >
      {/* Filtres */}
      <div className="flex gap-3 mb-6">
        <select
          value={channel}
          onChange={(e) => { setChannel(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Aucune communication trouvée.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Canal</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Destinataire</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Sujet / Message</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Template</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((comm: any) => (
                <tr key={comm.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {comm.channel === 'EMAIL'
                        ? <Mail className="h-4 w-4 text-blue-500" />
                        : <MessageSquare className="h-4 w-4 text-green-500" />}
                      <Badge variant={CHANNEL_VARIANT[comm.channel] ?? 'default'}>{comm.channel}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{comm.to}</td>
                  <td className="px-4 py-3 max-w-xs">
                    {comm.subject && <p className="font-medium text-slate-800 truncate">{comm.subject}</p>}
                    <p className="text-slate-400 truncate text-xs">{comm.body}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{comm.template?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(comm.sentAt ?? comm.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[comm.status] ?? 'default'}>
                      {STATUS_LABEL[comm.status] ?? comm.status}
                    </Badge>
                    {comm.errorMsg && <p className="text-xs text-red-400 mt-0.5 max-w-[160px] truncate">{comm.errorMsg}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>{total} communication(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Précédent</Button>
            <span className="py-1 px-2">{page} / {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Suivant</Button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
