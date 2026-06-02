import { useEffect, useMemo, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { toast } from '../../../shared/components/ui/Toast';
import {
  useReminderPolicy,
  useUpdateReminderPolicy,
  useReminderRules,
  useUpdateReminderRule,
  useRunRemindersNow,
} from '../../communication/hooks/useReminders';
import { useTemplates } from '../../communication/hooks/useCommunication';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  Bell, Play, Save, Mail, MessageSquare, AlertCircle, Clock, Moon, Calendar,
} from 'lucide-react';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

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
  const runNow = useRunRemindersNow();

  const [enabled, setEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState('08:00');
  const [quietEnd, setQuietEnd] = useState('20:00');
  const [quietDays, setQuietDays] = useState<number[]>([0]);

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
          <Button
            variant="secondary"
            icon={<Play className="h-4 w-4" />}
            onClick={handleRunNow}
            disabled={runNow.isPending}
          >
            {runNow.isPending ? 'Exécution…' : 'Lancer maintenant'}
          </Button>
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
                        {rule.channel === 'EMAIL' ? (
                          <Badge variant="info"><Mail className="h-3 w-3 inline mr-1" />Email</Badge>
                        ) : (
                          <Badge variant="success"><MessageSquare className="h-3 w-3 inline mr-1" />SMS</Badge>
                        )}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ))
      )}

      {!canEdit && (
        <Card>
          <p className="text-xs text-slate-500">
            Consultation seule — la modification de la politique de relance est réservée aux rôles
            SUPER_ADMIN, ADMIN et MANAGER.
          </p>
        </Card>
      )}
    </div>
  );
}
