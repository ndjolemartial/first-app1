import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import Input from '../../../shared/components/ui/Input';
import Modal from '../../../shared/components/ui/Modal';
import { useCommunicationHistory, useResendCommunication, useDeleteCommunication, useLinkInboundCommunication, useMarkCommunicationRead } from '../hooks/useCommunication';
import { formatDateTime, formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';
import { Mail, MessageSquare, Send, RefreshCw, Trash2, Eye, ArrowDownLeft, ArrowUpRight, Link2 } from 'lucide-react';
import MessagePreviewModal from '../components/MessagePreviewModal';

const CHANNEL_VARIANT: Record<string, 'info' | 'success' | 'default'> = {
  EMAIL: 'info',
  SMS: 'success',
  WHATSAPP: 'success',
};
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
  { value: 'WHATSAPP', label: 'WhatsApp' },
];
const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'ENVOYE', label: 'Envoyé' },
  { value: 'ECHEC', label: 'Échec' },
];
const DIRECTION_OPTIONS = [
  { value: '', label: 'Tous les sens' },
  { value: 'SORTANT', label: 'Envoyés' },
  { value: 'ENTRANT', label: 'Reçus' },
];
const DIRECTION_LABEL: Record<string, string> = { SORTANT: 'Envoyé', ENTRANT: 'Reçu' };

// Rôles à vue complète pouvant se restreindre à leurs propres messages via le
// filtre « Mes messages uniquement » — les autres rôles n'ont déjà accès qu'à
// leurs propres messages (cf. FULL_HISTORY_ROLES dans communication.ipc.ts).
const ONLY_MINE_FILTER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Canal',        cell: (c) => c.channel },
  { header: 'Destinataire', cell: (c) => c.to },
  { header: 'Sujet',        cell: (c) => c.subject },
  { header: 'Message',      cell: (c) => c.body },
  { header: 'Template',     cell: (c) => c.template?.name },
  { header: 'Date',         cell: (c) => formatDateTime(c.sentAt ?? c.createdAt) },
  { header: 'Statut',       cell: (c) => STATUS_LABEL[c.status] ?? c.status },
];

export default function CommunicationPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [direction, setDirection] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canFilterOnlyMine = ONLY_MINE_FILTER_ROLES.includes(role);

  const filters: any = {};
  if (search) filters.search = search;
  if (channel) filters.channel = channel;
  if (status) filters.status = status;
  if (direction) filters.direction = direction;
  if (canFilterOnlyMine && onlyMine) filters.onlyMine = true;

  const filterSummary = [
    search && `Recherche : "${search}"`,
    channel && `Canal : ${CHANNEL_OPTIONS.find((o) => o.value === channel)?.label ?? channel}`,
    status && `Statut : ${STATUS_LABEL[status] ?? status}`,
    direction && `Sens : ${DIRECTION_OPTIONS.find((o) => o.value === direction)?.label ?? direction}`,
    canFilterOnlyMine && onlyMine && 'Mes messages uniquement',
  ].filter(Boolean).join('   —   ') || undefined;

  const { data: res, isLoading } = useCommunicationHistory(filters, page, limit);
  const resend = useResendCommunication();
  const del = useDeleteCommunication();
  const linkInbound = useLinkInboundCommunication();
  const markRead = useMarkCommunicationRead();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [previewComm, setPreviewComm] = useState<any | null>(null);
  const [linkComm, setLinkComm] = useState<any | null>(null);

  // Ouvre l'aperçu et marque le message comme lu au passage — un message
  // reçu non encore lu (readAt null) le devient dès sa première consultation.
  const handleView = (comm: any) => {
    setPreviewComm(comm);
    if (comm.direction === 'ENTRANT' && !comm.readAt) markRead.mutate(comm.id);
  };

  const handleResend = async (id: number) => {
    const r = await resend.mutateAsync(id);
    if (r?.success) {
      toast.success('Message renvoyé');
    } else {
      const msg = typeof r?.error === 'string' ? r.error : 'Échec du renvoi';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (confirmDeleteId == null) return;
    const r = await del.mutateAsync(confirmDeleteId);
    if (r?.success) {
      toast.success('Message supprimé');
    } else {
      toast.error(typeof r?.error === 'string' ? r.error : 'Échec de la suppression');
    }
    setConfirmDeleteId(null);
  };
  // Une réponse `{ success:false }` (ex. session expirée après redémarrage du
  // main process) doit être affichée, pas avalée comme « Aucune communication ».
  const ipcError = res && res.success === false ? String(res.error ?? 'Erreur inconnue') : null;
  const history = res?.data ?? [];
  const total = res?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <PageLayout
      title="Communication"
      breadcrumbs={[{ label: 'Communication' }]}
      actions={
        <div className="flex flex-wrap gap-2 justify-end">
          <ExportMenu
            fileName="communications"
            title="Historique des communications"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.communication.getHistory(token, filters, 1, 100000);
              return r.success ? r.data ?? [] : [];
            }}
          />
          <Button variant="secondary" icon={<MessageSquare className="h-4 w-4" />} onClick={() => navigate('/communication/send?channel=WHATSAPP')}>
            Envoyer WhatsApp
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
        <div className="flex-1 min-w-[240px]">
          <Input
            placeholder="Rechercher par email, nom ou prénom (destinataire ou expéditeur)…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
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
        <select
          value={direction}
          onChange={(e) => { setDirection(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {DIRECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {canFilterOnlyMine && (
          <label className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 select-none">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => { setOnlyMine(e.target.checked); setPage(1); }}
              className="h-4 w-4 rounded border-slate-300"
            />
            Mes messages uniquement
          </label>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : ipcError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 bg-red-50 inline-block px-4 py-2 rounded-lg">{ipcError}</p>
            <p className="text-xs text-slate-400 mt-3">Reconnecte-toi si la session a expiré.</p>
          </div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Aucune communication trouvée.</div>
        ) : (
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Canal</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Sujet / Message</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Template</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((comm: any) => {
                const isUnread = comm.direction === 'ENTRANT' && !comm.readAt;
                return (
                <tr
                  key={comm.id}
                  className={comm.direction === 'ENTRANT' ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-slate-50'}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {comm.channel === 'EMAIL'    && <Mail          className="h-4 w-4 text-blue-500" />}
                      {comm.channel === 'SMS'      && <MessageSquare className="h-4 w-4 text-green-500" />}
                      {comm.channel === 'WHATSAPP' && <MessageSquare className="h-4 w-4 text-emerald-600" />}
                      <Badge variant={CHANNEL_VARIANT[comm.channel] ?? 'default'}>{comm.channel === 'WHATSAPP' ? 'WhatsApp' : comm.channel}</Badge>
                    </div>
                  </td>
                  <td className={isUnread ? 'px-4 py-3 font-bold' : 'px-4 py-3 font-medium'}>
                    <div className="flex items-center gap-1.5">
                      {comm.direction === 'ENTRANT'
                        ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                        : <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                      <span title={DIRECTION_LABEL[comm.direction] ?? comm.direction}>{comm.to}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <button
                      type="button"
                      onClick={() => handleView(comm)}
                      className="text-left w-full group"
                      title="Voir le message"
                    >
                      {comm.subject && (
                        <p className={`truncate group-hover:text-indigo-600 ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
                          {comm.subject}
                        </p>
                      )}
                      <p className={`truncate text-xs ${isUnread ? 'font-bold text-slate-600' : 'text-slate-400'}`}>{comm.body}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{comm.template?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(comm.sentAt ?? comm.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[comm.status] ?? 'default'}>
                      {STATUS_LABEL[comm.status] ?? comm.status}
                    </Badge>
                    {comm.errorMsg && <p className="text-xs text-red-400 mt-0.5 max-w-[160px] truncate" title={comm.errorMsg}>{comm.errorMsg}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => handleView(comm)}
                        title="Aperçu du message (lecture seule)"
                      >
                        Voir
                      </Button>
                      {comm.direction === 'ENTRANT' && !comm.clientId && !comm.prospectId && !comm.ownerId && !comm.conventionId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Link2 className="h-3.5 w-3.5" />}
                          onClick={() => setLinkComm(comm)}
                          title="Rattacher ce message reçu à un client ou un prospect"
                        >
                          Rattacher
                        </Button>
                      )}
                      {comm.status === 'ECHEC' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<RefreshCw className={`h-3.5 w-3.5 ${resend.isPending && resend.variables === comm.id ? 'animate-spin' : ''}`} />}
                            onClick={() => handleResend(comm.id)}
                            disabled={resend.isPending}
                            title="Renvoyer ce message"
                          >
                            Renvoyer
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            onClick={() => setConfirmDeleteId(comm.id)}
                            disabled={del.isPending}
                            title="Supprimer ce message en échec"
                          >
                            Supprimer
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
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

      <ConfirmDialog
        open={confirmDeleteId != null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer le message"
        message="Supprimer définitivement ce message en échec ? Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={del.isPending}
      />

      <MessagePreviewModal comm={previewComm} onClose={() => setPreviewComm(null)} />
      <LinkInboundModal
        comm={linkComm}
        onClose={() => setLinkComm(null)}
        onLink={async (payload) => {
          if (!linkComm) return;
          const r = await linkInbound.mutateAsync({ id: linkComm.id, payload });
          if (r?.success) { toast.success('Message rattaché'); setLinkComm(null); }
          else toast.error(typeof r?.error === 'string' ? r.error : 'Échec du rattachement');
        }}
        loading={linkInbound.isPending}
      />
    </PageLayout>
  );
}

type LinkSubjectType = 'CLIENT' | 'PROSPECT';

/**
 * Rattachement manuel d'une réponse entrante non appariée automatiquement
 * (en-têtes de thread perdus, ou expéditeur inconnu — cf. mailbox-poller.service.ts).
 */
function LinkInboundModal({
  comm, onClose, onLink, loading,
}: {
  comm: any | null;
  onClose: () => void;
  onLink: (payload: { clientId?: number; prospectId?: number }) => void;
  loading: boolean;
}) {
  const token = useAuthStore((s) => s.token)!;
  const [subjectType, setSubjectType] = useState<LinkSubjectType>('CLIENT');
  const [entityId, setEntityId] = useState('');

  const searchClients = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.clients.list(token, f, p, l),
    (c: any) => ({ value: String(c.id), label: formatPersonName(c) }),
  ), [token]);
  const searchProspects = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.prospects.list(token, f, p, l),
    (p: any) => ({ value: String(p.id), label: formatPersonName(p) }),
  ), [token]);

  if (!comm) return null;

  const handleSubmit = () => {
    if (!entityId) return;
    onLink(subjectType === 'CLIENT' ? { clientId: Number(entityId) } : { prospectId: Number(entityId) });
  };

  return (
    <Modal
      open={!!comm}
      onClose={onClose}
      title="Rattacher ce message reçu"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!entityId} loading={loading}>Rattacher</Button>
        </>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        De <span className="font-medium text-slate-700">{comm.to}</span>
        {comm.subject && <> — <span className="italic">{comm.subject}</span></>}
      </p>
      <div className="flex gap-2 mb-4">
        <Button type="button" size="sm" variant={subjectType === 'CLIENT' ? 'primary' : 'secondary'}
          onClick={() => { setSubjectType('CLIENT'); setEntityId(''); }}>
          Client
        </Button>
        <Button type="button" size="sm" variant={subjectType === 'PROSPECT' ? 'primary' : 'secondary'}
          onClick={() => { setSubjectType('PROSPECT'); setEntityId(''); }}>
          Prospect
        </Button>
      </div>
      {subjectType === 'CLIENT' ? (
        <SearchSelect
          label="Client"
          options={[]}
          onSearch={searchClients}
          value={entityId}
          onChange={setEntityId}
          placeholder="Rechercher un client…"
        />
      ) : (
        <SearchSelect
          label="Prospect"
          options={[]}
          onSearch={searchProspects}
          value={entityId}
          onChange={setEntityId}
          placeholder="Rechercher un prospect…"
        />
      )}
    </Modal>
  );
}
