import { useEffect, useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAmlScreeningSchedule, useUpdateAmlScreeningSchedule, useRunAmlScreening } from '../../aml/hooks/useAml';
import { SCREENING_FREQUENCY_LABEL, WEEKDAY_LABEL } from '../../aml/utils/aml.utils';
import { Save, Play } from 'lucide-react';

const ADMIN_ONLY = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

export default function AmlScreeningSettingsTab() {
  const { data } = useAmlScreeningSchedule();
  const update = useUpdateAmlScreeningSchedule();
  const runNow = useRunAmlScreening();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = ADMIN_ONLY.includes(role);

  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState('WEEKLY');
  const [weekday, setWeekday] = useState('1');
  const [monthday, setMonthday] = useState('1');
  const [hour, setHour] = useState('2');

  useEffect(() => {
    const s = data?.data;
    if (!s) return;
    setEnabled(!!s.enabled);
    setFrequency(s.frequency ?? 'WEEKLY');
    setWeekday(String(s.weekday ?? 1));
    setMonthday(String(s.monthday ?? 1));
    setHour(String(s.hour ?? 2));
  }, [data]);

  const save = () => {
    update.mutate({
      enabled,
      frequency,
      weekday: Number(weekday),
      monthday: Number(monthday),
      hour: Number(hour),
    });
  };

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-slate-500">
        Fréquence d'exécution automatique du criblage de masse (Clients, Prospects, Propriétaires,
        Apporteurs d'affaires contre le Référentiel de vigilance). Le criblage se déclenche par
        ailleurs à l'ajout de chaque entité et à chaque mise à jour du référentiel, indépendamment
        de ce réglage.
      </p>

      <Card className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={enabled} disabled={!canWrite}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" />
          Activer le criblage planifié
        </label>

        <Select label="Fréquence" value={frequency} disabled={!canWrite}
          onChange={(e) => setFrequency(e.target.value)}
          options={Object.entries(SCREENING_FREQUENCY_LABEL).map(([v, l]) => ({ value: v, label: l }))} />

        {frequency === 'WEEKLY' && (
          <Select label="Jour de la semaine" value={weekday} disabled={!canWrite}
            onChange={(e) => setWeekday(e.target.value)}
            options={Object.entries(WEEKDAY_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
        )}
        {frequency === 'MONTHLY' && (
          <Input label="Jour du mois (1 à 28)" type="number" min="1" max="28" value={monthday}
            disabled={!canWrite} onChange={(e) => setMonthday(e.target.value)} />
        )}

        <Input label="Heure d'exécution (0 à 23)" type="number" min="0" max="23" value={hour}
          disabled={!canWrite} onChange={(e) => setHour(e.target.value)}
          helper="La passe du jour ne s'exécute qu'à partir de cette heure." />

        {canWrite && (
          <div className="flex justify-end">
            <Button icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={save}>Enregistrer</Button>
          </div>
        )}
      </Card>

      <Card className="space-y-2">
        <p className="text-sm text-slate-600">
          Lancer immédiatement un criblage complet, sans attendre la prochaine échéance planifiée.
        </p>
        <div className="flex justify-end">
          <Button variant="secondary" icon={<Play className="h-4 w-4" />} loading={runNow.isPending}
            onClick={() => runNow.mutate()}>Lancer un criblage maintenant</Button>
        </div>
      </Card>
    </div>
  );
}
