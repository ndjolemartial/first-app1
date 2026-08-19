import Modal from '../../../shared/components/ui/Modal';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { formatDateTime } from '../../../shared/utils/format';
import { Mail, MessageSquare, CheckCircle2, Eye, Clock } from 'lucide-react';

const CHANNEL_VARIANT: Record<string, 'info' | 'success' | 'default'> = {
  EMAIL: 'info', SMS: 'success', WHATSAPP: 'success',
};
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  EN_ATTENTE: 'warning', ENVOYE: 'success', RECU: 'info', ECHEC: 'danger', REFUSE: 'danger',
};
const STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente', ENVOYE: 'Envoyé', RECU: 'Reçu', ECHEC: 'Échec', REFUSE: 'Refusé',
};

/** Détecte si un corps de message contient du balisage HTML (ex. emails à partir
 *  d'un modèle) plutôt que du texte brut (SMS/WhatsApp, corps texte historisé). */
function isHtml(body?: string): boolean {
  return !!body && /<\/?[a-z][\s\S]*>/i.test(body);
}

/**
 * Aperçu **en lecture seule** d'un message déjà envoyé (email / SMS / WhatsApp).
 * Aucune modification possible. Pour les emails, affiche l'accusé de remise
 * (destinataire accepté par le serveur SMTP) et l'accusé d'ouverture (pixel de
 * suivi), chacun avec l'heure exacte.
 */
export default function MessagePreviewModal({ comm, onClose }: { comm: any | null; onClose: () => void }) {
  if (!comm) return null;
  const isEmail = comm.channel === 'EMAIL';
  const channelLabel = comm.channel === 'WHATSAPP' ? 'WhatsApp' : comm.channel;

  // `to` porte toujours l'adresse de l'AUTRE partie de l'échange (cf.
  // mailbox-poller.service.ts / communication.ipc.ts) : le destinataire pour
  // un envoi (SORTANT), l'expéditeur pour une réponse reçue (ENTRANT).
  const isInbound = comm.direction === 'ENTRANT';
  const senderLabel = isInbound
    ? comm.to
    : (comm.sender
        ? (`${comm.sender.firstName ?? ''} ${comm.sender.lastName ?? ''}`.trim() || comm.sender.email)
        : 'Système (envoi automatique)');
  const recipientLabel = isInbound
    ? (comm.mailAccount?.label || comm.mailAccount?.imapUser || 'Vous')
    : comm.to;

  return (
    <Modal
      open={!!comm}
      onClose={onClose}
      title="Aperçu du message"
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <div className="space-y-4">
        {/* En-tête : canal + statut */}
        <div className="flex items-center gap-2 flex-wrap">
          {comm.channel === 'EMAIL'
            ? <Mail className="h-4 w-4 text-blue-500" />
            : <MessageSquare className="h-4 w-4 text-emerald-600" />}
          <Badge variant={CHANNEL_VARIANT[comm.channel] ?? 'default'}>{channelLabel}</Badge>
          <Badge variant={STATUS_VARIANT[comm.status] ?? 'default'}>
            {STATUS_LABEL[comm.status] ?? comm.status}
          </Badge>
        </div>

        {/* Métadonnées */}
        <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-slate-500">Expéditeur</dt>
          <dd className="font-medium text-slate-800 break-all">{senderLabel}</dd>
          <dt className="text-slate-500">Destinataire</dt>
          <dd className="font-medium text-slate-800 break-all">{recipientLabel}</dd>
          {comm.subject && (
            <>
              <dt className="text-slate-500">Sujet</dt>
              <dd className="font-medium text-slate-800">{comm.subject}</dd>
            </>
          )}
          <dt className="text-slate-500">Envoyé le</dt>
          <dd className="text-slate-700">{formatDateTime(comm.sentAt ?? comm.createdAt)}</dd>
          {comm.template?.name && (
            <>
              <dt className="text-slate-500">Modèle</dt>
              <dd className="text-slate-700">{comm.template.name}</dd>
            </>
          )}
        </dl>

        {/* Accusés de remise / ouverture (emails uniquement) */}
        {isEmail && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {comm.deliveredAt ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-700">
                    Remis au destinataire le <span className="font-medium">{formatDateTime(comm.deliveredAt)}</span>
                  </span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-slate-500">Remise non confirmée par le serveur de messagerie</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {comm.openedAt ? (
                <>
                  <Eye className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span className="text-slate-700">
                    Ouvert par le destinataire le <span className="font-medium">{formatDateTime(comm.openedAt)}</span>
                  </span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-slate-500">Aucune ouverture n'est encore détectée — le destinataire n'a peut-être pas chargé les images</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Corps du message — lecture seule. Les emails à partir d'un modèle
            sont stockés en HTML (mise en forme, signature, logo) : on les rend
            tels que le destinataire les a reçus. Les SMS/WhatsApp et les corps
            en texte brut conservent les retours à la ligne via <pre>. */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase mb-1">Contenu</p>
          <div className="rounded-lg border border-slate-200 bg-white p-3 max-h-[45vh] overflow-y-auto">
            {isHtml(comm.body) ? (
              <div
                className="preview-html text-sm text-slate-800 break-words [&_img]:max-w-full [&_img]:h-auto [&_a]:text-indigo-600 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: comm.body ?? '' }}
              />
            ) : (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-800">{comm.body}</pre>
            )}
          </div>
        </div>

        {comm.errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{comm.errorMsg}</p>
        )}
      </div>
    </Modal>
  );
}
