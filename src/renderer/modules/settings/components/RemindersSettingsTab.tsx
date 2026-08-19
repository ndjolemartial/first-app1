import { useEffect, useMemo, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { toast } from '../../../shared/components/ui/Toast';
import {
  useReminderPolicy,
  useUpdateReminderPolicy,
  useReminderRules,
  useUpdateReminderRule,
  useCreateReminderRule,
  useDeleteReminderRule,
  useRunRemindersNow,
  useOptedOutClients,
  useSetClientOptOut,
} from '../../communication/hooks/useReminders';
import { useTemplates } from '../../communication/hooks/useCommunication';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { formatPersonName } from '../../../shared/utils/format';
import {
  Bell, Play, Save, Mail, MessageSquare, AlertCircle, Clock, Moon, Calendar, Plus, PencilLine, Trash2,
  UserX, X,
} from 'lucide-react';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const TRIGGER_OPTIONS = [
  { value: 'INSTALLMENT_UPCOMING', label: 'Échéances de vente — à venir' },
  { value: 'INSTALLMENT_OVERDUE',  label: 'Échéances de vente — en retard' },
  { value: 'CONVENTION_EXPIRING',  label: 'Conventions — expiration' },
];
const CHANNEL_OPTIONS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const TRIGGER_LABEL: Record<string, string> = {
  INSTALLMENT_UPCOMING: 'Échéances de vente — à venir',
  INSTALLMENT_OVERDUE:  'Échéances de vente — en retard',
  CONVENTION_EXPIRING:  'Conventions — expiration',
};

const TRIGGER_DESC: Record<string, string> = {
  INSTALLMENT_UPCOMING: "Rappels préventifs envoyés avant la date d'échéance (offset négatif = jours avant).",
  INSTALLMENT_OVERDUE:  "Relances après dépassement de l'échéance, ton croissant (offset positif = jours après).",
  CONVENTION_EXPIRING:  'Avis de fin de contrat pour préparer le renouvellement ou la sortie.',
};

function formatOffset(n: number): string {
  return n >= 0 ? `J+${n}` : `J${n}`;
}

export default function RemindersSettingsTab() {
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canEdit = ADMIN_ROLES.includes(role);

  const policyQuery = useReminderPolicy();
  const rulesQuery = useReminderRules();
  const templatesQuery = useTemplates();
  const updatePolicy = useUpdateReminderPolicy();
  const updateRule = useUpdateReminderRule();
  const createRule = useCreateReminderRule();
  const deleteRule = useDeleteReminderRule();
  const runNow = useRunRemindersNow();

  const [enabled, setEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState('08:00');
  const [quietEnd, setQuietEnd] = useState('20:00');
  const [quietDays, setQuietDays] = useState<number[]>([0]);
  // Modale de règle : `null` = fermée, `'new'` = création, sinon la règle en édition.
  const [ruleModal, setRuleModal] = useState<any | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  useEffect(() => {
    const p = policyQuery.data?.data;
    if (!p) return;
    setEnabled(p.enabled);
    setQuietStart(p.quietHoursStart);
    setQuietEnd(p.quietHoursEnd);
    setQuietDays(p.quietDays);
  }, [policyQuery.data]);

  const rules = (rulesQuery.data?.data ?? []) as any[];
  const templates = (templatesQuery.data?.data ?? []) as any[];

  const rulesByTrigger = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of rules) {
      (map[r.triggerType] ?? (map[r.triggerType] = [])).push(r);
    }
    return map;
  }, [rules]);

  const handleSavePolicy = async (): Promise<void> => {
    const r = await updatePolicy.mutateAsync({
      enabled,
      quietHoursStart: quietStart,
      quietHoursEnd:   quietEnd,
      quietDays,
    });
    if (r.success) toast.success('Politique enregistrée');
    else toast.error(String(r.error));
  };

  const handleToggleRule = async (rule: any, isActive: boolean): Promise<void> => {
    const r = await updateRule.mutateAsync({ id: rule.id, payload: { isActive } });
    if (!r.success) toast.error(String(r.error));
  };

  const handleChangeTemplate = async (rule: any, templateId: number | null): Promise<void> => {
    const r = await updateRule.mutateAsync({ id: rule.id, payload: { templateId } });
    if (!r.success) toast.error(String(r.error));
  };

  const handleSaveRule = async (payload: Record<string, unknown>): Promise<void> => {
    const isNew = ruleModal === 'new';
    const r = isNew
      ? await createRule.mutateAsync(payload)
      : await updateRule.mutateAsync({ id: ruleModal.id, payload });
    if (r.success) {
      toast.success(isNew ? 'Règle créée' : 'Règle mise à jour');
      setRuleModal(null);
    } else {
      toast.error(String(r.error));
    }
  };

  const handleDeleteRule = async (): Promise<void> => {
    if (!deleteTarget) return;
    const r = await deleteRule.mutateAsync(deleteTarget.id);
    if (r.success) {
      toast.success('Règle supprimée');
      setDeleteTarget(null);
    } else {
      toast.error(String(r.error));
    }
  };

  const handleRunNow = async (): Promise<void> => {
    const r = await runNow.mutateAsync();
    if (!r.success) { toast.error(String(r.error)); return; }
    const d = r.data!;
    toast.success(`Relances : ${d.sent} envoyée(s), ${d.skipped} ignorée(s), ${d.failed} en échec`);
  };

  const toggleDay = (day: number): void => {
    setQuietDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  return (
    <div className="space-y-6">
      {/* En-tête du tab + action manuelle */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Politique de relance</h2>
          <p className="text-sm text-slate-500">
            Cadence des rappels email/SMS pour les échéances de vente et les conventions arrivant à terme.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setRuleModal('new')}
            >
              Nouvelle règle
            </Button>
            <Button
              variant="secondary"
              icon={<Play className="h-4 w-4" />}
              onClick={handleRunNow}
              disabled={runNow.isPending}
            >
              {runNow.isPending ? 'Exécution…' : 'Lancer maintenant'}
            </Button>
          </div>
        )}
      </div>

      {/* Bloc — Politique générale */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-900">Politique générale</h3>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <div>
                <p className="font-medium text-slate-900">Relances automatiques</p>
                <p className="text-xs text-slate-500">
                  {enabled ? 'Activées — passe horaire pendant les heures ouvrables.' : 'Désactivées — aucun envoi automatique.'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                disabled={!canEdit}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-2">
              <Clock className="h-3.5 w-3.5" /> Heures d'envoi
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={quietStart}
                disabled={!canEdit}
                onChange={(e) => setQuietStart(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm flex-1"
              />
              <span className="text-slate-400">→</span>
              <input
                type="time"
                value={quietEnd}
                disabled={!canEdit}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm flex-1"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Aucun envoi en dehors de cette fenêtre.
            </p>
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-2">
              <Moon className="h-3.5 w-3.5" /> Jours bloqués
            </label>
            <div className="flex gap-2 flex-wrap">
              {DAY_LABELS.map((label, idx) => {
                const blocked = quietDays.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleDay(idx)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
                      ${blocked
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}
                      ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Les jours sélectionnés sont exclus des envois automatiques (cliquez pour basculer).
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end mt-4">
            <Button icon={<Save className="h-4 w-4" />} onClick={handleSavePolicy} disabled={updatePolicy.isPending}>
              Enregistrer la politique
            </Button>
          </div>
        )}
      </Card>

      {/* Bloc — Règles par cas d'usage */}
      {rulesQuery.isLoading ? (
        <Card><SkeletonTable rows={6} /></Card>
      ) : Object.keys(rulesByTrigger).length === 0 ? (
        <Card>
          <div className="flex items-center gap-2 text-slate-500">
            <AlertCircle className="h-4 w-4" />
            <span>Aucune règle de relance — relancez l'application pour seeder la configuration par défaut.</span>
          </div>
        </Card>
      ) : (
        Object.entries(rulesByTrigger).map(([triggerType, list]) => (
          <Card key={triggerType}>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-5 w-5 text-indigo-500" />
              <h3 className="font-semibold text-slate-900">{TRIGGER_LABEL[triggerType] ?? triggerType}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">{TRIGGER_DESC[triggerType] ?? ''}</p>

            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 pr-3">Active</th>
                  <th className="py-2 pr-3">Règle</th>
                  <th className="py-2 pr-3">Canal</th>
                  <th className="py-2 pr-3">Fenêtre</th>
                  <th className="py-2 pr-3">Modèle</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((rule) => {
                  const channelTemplates = templates.filter((t: any) => t.channel === rule.channel);
                  return (
                    <tr key={rule.id} className="align-middle">
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={!!rule.isActive}
                          disabled={!canEdit || updateRule.isPending}
                          onChange={(e) => handleToggleRule(rule, e.target.checked)}
                          className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-900">{rule.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{rule.code}</p>
                      </td>
                      <td className="py-2 pr-3">
                        {rule.channel === 'EMAIL'    && <Badge variant="info"><Mail          className="h-3 w-3 inline mr-1" />Email</Badge>}
                        {rule.channel === 'SMS'      && <Badge variant="success"><MessageSquare className="h-3 w-3 inline mr-1" />SMS</Badge>}
                        {rule.channel === 'WHATSAPP' && <Badge variant="success"><MessageSquare className="h-3 w-3 inline mr-1" />WhatsApp</Badge>}
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-700">{formatOffset(rule.offsetDays)}</td>
                      <td className="py-2 pr-3">
                        <select
                          value={rule.templateId ?? ''}
                          disabled={!canEdit || updateRule.isPending}
                          onChange={(e) => handleChangeTemplate(rule, e.target.value ? Number(e.target.value) : null)}
                          className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-full max-w-xs"
                        >
                          <option value="">— Aucun —</option>
                          {channelTemplates.map((t: any) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {canEdit && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<PencilLine className="h-3.5 w-3.5" />}
                              onClick={() => setRuleModal(rule)}
                            >
                              Modifier
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                              onClick={() => setDeleteTarget(rule)}
                              title="Supprimer définitivement cette règle"
                            >
                              Supprimer
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ))
      )}

      {/* Bloc — Liste d'exclusion */}
      <OptOutListCard canEdit={canEdit} />

      {!canEdit && (
        <Card>
          <p className="text-xs text-slate-500">
            Consultation seule — la modification de la politique de relance est réservée aux rôles
            SUPER_ADMIN, ADMIN et MANAGER.
          </p>
        </Card>
      )}

      <RuleFormModal
        rule={ruleModal}
        templates={templates}
        onClose={() => setRuleModal(null)}
        onSave={handleSaveRule}
        loading={createRule.isPending || updateRule.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteRule}
        title="Supprimer la règle"
        message={`Supprimer définitivement la règle « ${deleteTarget?.name ?? ''} » ? Cette action est irréversible — l'historique des relances déjà envoyées avec cette règle est conservé.`}
        confirmLabel="Supprimer"
        loading={deleteRule.isPending}
      />
    </div>
  );
}

/**
 * Création ou édition d'une règle de relance. Le déclencheur (triggerType)
 * n'est modifiable qu'à la création — le moteur (applyReminderRules,
 * reminders.service.ts) dispatche déjà génériquement sur les 3 cas existants,
 * quel que soit le nombre de règles par cas : ajouter une règle « J-3 SMS » à
 * côté des règles seedées ne demande aucun changement du moteur.
 */
function RuleFormModal({
  rule, templates, onClose, onSave, loading,
}: {
  rule: any | 'new' | null;
  templates: any[];
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const isNew = rule === 'new';
  const open = rule !== null;

  const [triggerType, setTriggerType] = useState('INSTALLMENT_UPCOMING');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [offsetDays, setOffsetDays] = useState('0');
  const [channel, setChannel] = useState('EMAIL');
  const [templateId, setTemplateId] = useState('');

  useEffect(() => {
    if (!open) return;
    if (isNew) {
      setTriggerType('INSTALLMENT_UPCOMING');
      setName('');
      setDescription('');
      setOffsetDays('0');
      setChannel('EMAIL');
      setTemplateId('');
    } else {
      setTriggerType(rule.triggerType);
      setName(rule.name ?? '');
      setDescription(rule.description ?? '');
      setOffsetDays(String(rule.offsetDays ?? 0));
      setChannel(rule.channel);
      setTemplateId(rule.templateId ? String(rule.templateId) : '');
    }
  }, [open, isNew, rule]);

  if (!open) return null;

  const channelTemplates = templates.filter((t: any) => t.channel === channel);

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Le nom est requis'); return; }
    const offset = Number(offsetDays);
    if (!Number.isInteger(offset)) { toast.error('Le décalage doit être un nombre entier de jours'); return; }
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      offsetDays: offset,
      channel,
      templateId: templateId ? Number(templateId) : null,
    };
    if (isNew) payload.triggerType = triggerType;
    onSave(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Nouvelle règle de relance' : 'Modifier la règle'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} loading={loading} icon={<Save className="h-4 w-4" />}>
            {isNew ? 'Créer' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Type de déclenchement"
          options={TRIGGER_OPTIONS}
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value)}
          disabled={!isNew}
        />
        {!isNew && (
          <p className="text-xs text-slate-400 -mt-2">
            Le type de déclenchement ne peut plus être modifié après la création.
          </p>
        )}
        <Input label="Nom" required value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea
          label="Description (optionnel)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Décalage (jours)"
            type="number"
            value={offsetDays}
            onChange={(e) => setOffsetDays(e.target.value)}
          />
          <Select
            label="Canal"
            options={CHANNEL_OPTIONS}
            value={channel}
            onChange={(e) => { setChannel(e.target.value); setTemplateId(''); }}
          />
        </div>
        <p className="text-xs text-slate-400 -mt-2">
          Négatif = avant la date pivot (préventif), positif = après (relance). Ex. -7 = 7 jours avant, 3 = 3 jours après.
        </p>
        <Select
          label="Modèle"
          options={[{ value: '', label: '— Aucun —' }, ...channelTemplates.map((t: any) => ({ value: String(t.id), label: t.name }))]}
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/**
 * Liste d'exclusion des relances automatiques : réutilise les champs existants
 * `Client.smsOptOut`/`emailOptOut` (déjà lus par `processCandidate` dans
 * reminders.service.ts pour les 3 types de déclenchement — échéances à venir,
 * échéances en retard/héritées et expiration de convention), jamais exposés
 * jusqu'ici côté UI. Un client exclu a les deux drapeaux activés ensemble
 * (les relances WhatsApp partagent l'opt-out SMS, faute de champ dédié) :
 * l'exclusion porte donc sur l'ensemble des canaux automatiques.
 */
function OptOutListCard({ canEdit }: { canEdit: boolean }) {
  const token = useAuthStore((s) => s.token)!;
  const optedOutQuery = useOptedOutClients();
  const setOptOut = useSetClientOptOut();
  const [addingId, setAddingId] = useState('');

  const searchClients = useMemo(() => makeEntitySearch(
    (f, p, l) => window.electron.clients.list(token, f, p, l),
    (c: any) => ({ value: String(c.id), label: formatPersonName(c) }),
  ), [token]);

  const clients = (optedOutQuery.data?.data ?? []) as any[];

  const handleAdd = async (): Promise<void> => {
    if (!addingId) return;
    const r = await setOptOut.mutateAsync({
      clientId: Number(addingId),
      smsOptOut: true,
      emailOptOut: true,
    });
    if (r.success) {
      toast.success('Client exclu des relances automatiques');
      setAddingId('');
    } else {
      toast.error(String(r.error));
    }
  };

  const handleRemove = async (clientId: number): Promise<void> => {
    const r = await setOptOut.mutateAsync({ clientId, smsOptOut: false, emailOptOut: false });
    if (r.success) toast.success('Client retiré de la liste d\'exclusion');
    else toast.error(String(r.error));
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <UserX className="h-5 w-5 text-indigo-500" />
        <h3 className="font-semibold text-slate-900">Liste d'exclusion relances</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Les clients de cette liste ne reçoivent jamais de relance automatique (échéances à venir,
        échéances en retard/héritées, expiration de convention), quel que soit le canal — email, SMS
        ou WhatsApp. L'envoi manuel de messages depuis leur fiche reste possible.
      </p>

      {canEdit && (
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <SearchSelect
              label="Ajouter un client"
              options={[]}
              onSearch={searchClients}
              value={addingId}
              onChange={setAddingId}
              placeholder="Rechercher un client…"
            />
          </div>
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={handleAdd}
            disabled={!addingId || setOptOut.isPending}
          >
            Exclure
          </Button>
        </div>
      )}

      {optedOutQuery.isLoading ? (
        <SkeletonTable rows={3} />
      ) : clients.length === 0 ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Aucun client exclu — tous les clients reçoivent les relances automatiques.</span>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-2 pr-3">Client</th>
              <th className="py-2 pr-3">Contact</th>
              {canEdit && <th className="py-2 pr-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="py-2 pr-3 font-medium text-slate-900">{formatPersonName(c)}</td>
                <td className="py-2 pr-3 text-slate-500">{c.email || c.mobile || c.phone || '—'}</td>
                {canEdit && (
                  <td className="py-2 pr-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<X className="h-3.5 w-3.5 text-red-500" />}
                      onClick={() => handleRemove(c.id)}
                      disabled={setOptOut.isPending}
                    >
                      Retirer
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
