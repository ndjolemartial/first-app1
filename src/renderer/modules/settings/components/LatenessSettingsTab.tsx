import { useEffect, useState } from 'react';
import { Save, AlarmClockOff, Plus, Trash2 } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { formatDate } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  useLatenessSettings, useUpdateLatenessSettings,
  useAttendanceSpecialDays, useCreateAttendanceSpecialDay, useDeleteAttendanceSpecialDay,
} from '../hooks/useSettings';

// L'onglet lui-même est accessible à SUPER_ADMIN/ADMIN/MANAGER (cf.
// SettingsPage.tsx), mais seul SUPER_ADMIN/ADMIN peut modifier l'inclusion
// des employés liés à un compte SUPER_ADMIN/ADMIN/MANAGER — MANAGER ne voit
// ni ne gère que la limite de tolérance et les journées à horaire réduit.
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Journées à horaire de départ réduit (ex. journée continue se terminant à
 * 12h/14h) — remplacent, pour toute l'entreprise et pour cette seule date,
 * les seuils par défaut du calcul des Retards & Départs précipités.
 */
function AttendanceSpecialDaysCard() {
  const { data: res, isLoading } = useAttendanceSpecialDays();
  const create = useCreateAttendanceSpecialDay();
  const del = useDeleteAttendanceSpecialDay();
  const days = res?.success ? (res.data ?? []) : [];

  const [date, setDate] = useState('');
  const [expectedDeparture, setExpectedDeparture] = useState('14:00');
  const [expectedArrival, setExpectedArrival] = useState('');
  const [label, setLabel] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const add = async () => {
    if (!date || !expectedDeparture) return;
    const r = await create.mutateAsync({
      date, expectedDeparture, expectedArrival: expectedArrival || null, label: label || null,
    });
    if (r.success) { setDate(''); setExpectedArrival(''); setLabel(''); }
  };

  return (
    <Card>
      <h3 className="mb-1 font-semibold text-slate-700">Journées à horaire de départ réduit</h3>
      <p className="mb-4 text-sm text-slate-600">
        Pour une journée de travail continue se terminant plus tôt que d'habitude (ex. 12h ou 14h au lieu de 17h),
        déclarez la date ici : ce jour-là, pour <strong>tout le personnel</strong>, l'heure de départ attendue
        (et, si besoin, l'heure d'arrivée attendue) remplace les seuils par défaut dans le calcul des Retards &
        Départs précipités — évitant ainsi de comptabiliser à tort un départ légitimement anticipé.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end mb-4">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Heure de départ" type="time" value={expectedDeparture} onChange={(e) => setExpectedDeparture(e.target.value)} />
        <Input label="Heure d'arrivée (optionnel)" type="time" value={expectedArrival} onChange={(e) => setExpectedArrival(e.target.value)} />
        <Input label="Libellé (optionnel)" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Veille de fête" />
      </div>
      <div className="flex justify-end mb-4">
        <Button size="sm" icon={<Plus className="h-4 w-4" />} loading={create.isPending} disabled={!date || !expectedDeparture} onClick={add}>
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : days.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune journée à horaire réduit déclarée.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Arrivée attendue</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Départ attendu</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Libellé</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {days.map((d: any) => (
              <tr key={d.id}>
                <td className="px-3 py-2 font-medium">{formatDate(d.date)}</td>
                <td className="px-3 py-2 text-slate-500">{d.expectedArrival || '—'}</td>
                <td className="px-3 py-2 text-slate-500">{d.expectedDeparture}</td>
                <td className="px-3 py-2 text-slate-500">{d.label || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => setDeleteId(d.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={deleteId != null}
        title="Supprimer cette journée"
        message="Retirer cette journée à horaire réduit ? Les seuils par défaut redeviendront applicables pour cette date."
        confirmLabel="Supprimer"
        loading={del.isPending}
        onConfirm={async () => { if (deleteId != null) await del.mutateAsync(deleteId); setDeleteId(null); }}
        onClose={() => setDeleteId(null)}
      />
    </Card>
  );
}

export default function LatenessSettingsTab() {
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const isAdmin = ADMIN_ROLES.includes(role);
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
      {isAdmin && (
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
      )}

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

      <AttendanceSpecialDaysCard />
    </div>
  );
}
