import { useEffect, useState } from 'react';
import { Save, AlarmClockOff } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { useLatenessSettings, useUpdateLatenessSettings } from '../hooks/useSettings';

export default function LatenessSettingsTab() {
  const { data: res, isLoading } = useLatenessSettings();
  const update = useUpdateLatenessSettings();

  const [includeManagementRoles, setIncludeManagementRoles] = useState(false);
  const [toleranceMinutes, setToleranceMinutes] = useState('15');

  useEffect(() => {
    if (res?.success && res.data) {
      setIncludeManagementRoles(res.data.includeManagementRoles);
      setToleranceMinutes(String(res.data.toleranceMinutes));
    }
  }, [res]);

  const save = () => update.mutate({ includeManagementRoles, toleranceMinutes: Math.max(0, Number(toleranceMinutes) || 0) });

  if (isLoading) return <Card>Chargement…</Card>;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <AlarmClockOff className="h-4 w-4 text-slate-500" />
          <h3 className="font-semibold text-slate-700">Retards & Départs précipités</h3>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Par défaut, les employés liés à un compte utilisateur <strong>Super administrateur, Administrateur ou
          Manager</strong> ne sont ni calculés ni affichés dans « Retards & Départs précipités » (module Gestion du
          personnel) — ni dans la liste, ni dans le KPI de performance associé. Activez ce paramètre pour les
          réintégrer.
        </p>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeManagementRoles}
            onChange={(e) => setIncludeManagementRoles(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-slate-700">
            Prendre en compte les employés liés à un compte Super administrateur / Administrateur / Manager
          </span>
        </label>

        <div className="flex justify-end pt-4">
          <Button icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 font-semibold text-slate-700">Limite de tolérance</h3>
        <p className="mb-4 text-sm text-slate-600">
          SUPER_ADMIN, ADMIN et MANAGER peuvent marquer une journée de retard ou de départ précipité comme
          <strong> Tolérée</strong> (sans demande de congé ni activité liée), à condition que le temps de la
          journée (retard + départ anticipé) n'excède pas la limite ci-dessous. Comme les journées justifiées, les
          journées tolérées sont exclues du « Cumul non justifié » et du KPI de performance associé.
        </p>
        <div className="w-48">
          <Input
            label="Limite de tolérance (minutes)"
            type="number"
            min={0}
            max={1440}
            value={toleranceMinutes}
            onChange={(e) => setToleranceMinutes(e.target.value)}
          />
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </Card>
    </div>
  );
}
