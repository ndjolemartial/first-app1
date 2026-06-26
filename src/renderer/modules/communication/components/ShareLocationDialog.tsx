import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useClients } from '../../clients/hooks/useClients';
import { useProspects } from '../../prospects/hooks/useProspects';
import { useReferrers } from '../../commissions/hooks/useCommissions';
import { toast } from '../../../shared/components/ui/Toast';
import { formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { Send, Mail, MessageSquare, User, UserCheck, Handshake, MapPin, Lock, Settings as SettingsIcon } from 'lucide-react';

type EntityType = 'LOTISSEMENT' | 'TERRAIN' | 'PROPERTY';
type RecipientType = 'CLIENT' | 'PROSPECT' | 'REFERRER';
type Channel = 'EMAIL' | 'WHATSAPP';

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: EntityType;
  entityId: number;
  /** Étiquette affichée dans le sous-titre du modal — ex. « Lot des Palmiers ». */
  entityLabel: string;
}

const ENTITY_LABEL: Record<EntityType, string> = {
  LOTISSEMENT: 'lotissement',
  TERRAIN:     'terrain',
  PROPERTY:    'bien',
};

export default function ShareLocationDialog({ open, onClose, entityType, entityId, entityLabel }: Props) {
  const token = useAuthStore((s) => s.token)!;

  const [channel, setChannel] = useState<Channel>('WHATSAPP');
  const [recipientType, setRecipientType] = useState<RecipientType>('CLIENT');
  const [recipientId, setRecipientId] = useState<string>('');

  // Charge un large pool — la recherche est locale dans SearchSelect.
  const { data: clientsRes }   = useClients({},   1, 1000);
  const { data: prospectsRes } = useProspects({}, 1, 1000);
  const { data: referrersRes } = useReferrers({ isActive: true }, 1, 1000);

  // Réinitialise la sélection à l'ouverture pour éviter la persistence entre 2 fiches.
  useEffect(() => {
    if (!open) return;
    setRecipientId('');
  }, [open, entityId]);

  const options = useMemo(() => {
    if (recipientType === 'CLIENT') {
      return (clientsRes?.data ?? []).map((c: any) => ({
        value: String(c.id),
        label: c.type === 'ENTREPRISE'
          ? (c.entreprise || `Client #${c.id}`)
          : formatPersonName(c) || `Client #${c.id}`,
      }));
    }
    if (recipientType === 'PROSPECT') {
      return (prospectsRes?.data ?? []).map((p: any) => ({
        value: String(p.id),
        label: formatPersonName(p) || `Prospect #${p.id}`,
      }));
    }
    return (referrersRes?.data ?? []).map((r: any) => ({
      value: String(r.id),
      label: r.companyName || `${r.firstName} ${r.lastName}`.trim() || `Apporteur #${r.id}`,
    }));
  }, [recipientType, clientsRes, prospectsRes, referrersRes]);

  // Recherche côté serveur pour Client / Prospect (entités à fort volume).
  // Le `toOption` réplique exactement le format de libellé des préchargements ci-dessus.
  const searchClients = useMemo(
    () => makeEntitySearch(
      (filters, page, limit) => window.electron.clients.list(token, filters, page, limit),
      (c: any) => ({
        value: String(c.id),
        label: c.type === 'ENTREPRISE'
          ? (c.entreprise || `Client #${c.id}`)
          : formatPersonName(c) || `Client #${c.id}`,
      }),
    ),
    [token],
  );
  const searchProspects = useMemo(
    () => makeEntitySearch(
      (filters, page, limit) => window.electron.prospects.list(token, filters, page, limit),
      (p: any) => ({ value: String(p.id), label: formatPersonName(p) || `Prospect #${p.id}` }),
    ),
    [token],
  );
  // Sélection dynamique selon l'onglet ; les apporteurs (REFERRER) restent en
  // filtrage local — hors périmètre (entité Commission/Referrer, pas owner).
  const onSearch =
    recipientType === 'CLIENT'   ? searchClients
  : recipientType === 'PROSPECT' ? searchProspects
                                 : undefined;

  // Aperçu en lecture seule : dès que (entité + destinataire + canal) sont
  // sélectionnés, le serveur applique le modèle et renvoie le message rendu.
  // Le modèle lui-même n'est éditable que depuis Paramètres → Partage de localisation.
  const previewQuery = useQuery({
    queryKey: ['shareLocation', 'preview', entityType, entityId, recipientType, recipientId, channel],
    queryFn: () => window.electron.communication.previewShareLocation(token, {
      entityType, entityId,
      recipientType, recipientId: Number(recipientId),
      channel,
    }),
    enabled: open && !!recipientId,
    staleTime: 0,
  });

  const previewData = previewQuery.data?.success ? previewQuery.data.data : null;
  const previewError = previewQuery.data && !previewQuery.data.success ? String(previewQuery.data.error) : null;

  const send = useMutation({
    mutationFn: () =>
      window.electron.communication.shareLocation(token, {
        entityType,
        entityId,
        recipientType,
        recipientId: Number(recipientId),
        channel,
      }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Localisation partagée');
        onClose();
      } else {
        toast.error(String(res.error ?? 'Erreur lors du partage'));
      }
    },
    onError: (err: any) => toast.error(String(err.message ?? err)),
  });

  const canSubmit = !!recipientId && !!previewData && !previewError;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Partager la localisation"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button
            icon={<Send className="h-4 w-4" />}
            disabled={!canSubmit}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            Envoyer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin className="h-4 w-4 text-indigo-600" />
          <span>
            Partage de la localisation du {ENTITY_LABEL[entityType]} :{' '}
            <span className="font-medium text-slate-900">{entityLabel}</span>
          </span>
        </div>

        {/* Canal */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Canal d'envoi</p>
          <div className="flex gap-2">
            <ChannelButton
              active={channel === 'WHATSAPP'}
              onClick={() => setChannel('WHATSAPP')}
              icon={<MessageSquare className="h-4 w-4" />}
              label="WhatsApp"
              color="emerald"
            />
            <ChannelButton
              active={channel === 'EMAIL'}
              onClick={() => setChannel('EMAIL')}
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              color="blue"
            />
          </div>
        </div>

        {/* Type de destinataire */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Destinataire</p>
          <div className="flex gap-2 mb-2">
            <RecipientTab
              active={recipientType === 'CLIENT'}
              onClick={() => { setRecipientType('CLIENT'); setRecipientId(''); }}
              icon={<User className="h-3.5 w-3.5" />}
              label="Client"
            />
            <RecipientTab
              active={recipientType === 'PROSPECT'}
              onClick={() => { setRecipientType('PROSPECT'); setRecipientId(''); }}
              icon={<UserCheck className="h-3.5 w-3.5" />}
              label="Prospect"
            />
            <RecipientTab
              active={recipientType === 'REFERRER'}
              onClick={() => { setRecipientType('REFERRER'); setRecipientId(''); }}
              icon={<Handshake className="h-3.5 w-3.5" />}
              label="Apporteur d'affaires"
            />
          </div>
          <SearchSelect
            options={options}
            onSearch={onSearch}
            value={recipientId}
            onChange={setRecipientId}
            placeholder={
              recipientType === 'CLIENT'   ? 'Rechercher un client…'
            : recipientType === 'PROSPECT' ? 'Rechercher un prospect…'
                                           : 'Rechercher un apporteur…'
            }
          />
        </div>

        {/* Aperçu (lecture seule) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              Aperçu du message
            </p>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <SettingsIcon className="h-3 w-3" />
              Modifiable dans Paramètres → Partage de localisation
            </p>
          </div>

          {!recipientId && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-400">
              Sélectionnez un destinataire pour afficher l'aperçu du message.
            </div>
          )}

          {recipientId && previewQuery.isLoading && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Génération de l'aperçu…
            </div>
          )}

          {recipientId && previewError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {previewError}
            </div>
          )}

          {recipientId && previewData && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-200 bg-white">
                <p className="text-xs text-slate-500">Destinataire</p>
                <p className="text-sm font-medium text-slate-800">{previewData.to}</p>
              </div>
              {channel === 'EMAIL' && (
                <div className="px-4 py-2 border-b border-slate-200 bg-white">
                  <p className="text-xs text-slate-500">Sujet</p>
                  <p className="text-sm font-medium text-slate-800">{previewData.subject}</p>
                </div>
              )}
              <div className="px-4 py-3 bg-white">
                <p className="text-xs text-slate-500 mb-1">Corps du message</p>
                <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                  {previewData.body}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ChannelButton({
  active, onClick, icon, label, color,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color: 'blue' | 'emerald';
}) {
  const activeClass = color === 'blue'
    ? 'bg-blue-600 text-white border-blue-600'
    : 'bg-emerald-600 text-white border-emerald-600';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
        active ? activeClass : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function RecipientTab({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors border ${
        active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
