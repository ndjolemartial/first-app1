import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import Button from '../../../shared/components/ui/Button';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatCurrency } from '../../../shared/utils/format';
import { Save } from 'lucide-react';
import {
  useEmployees, useAttendance, useAttendanceSummary, useBulkUpsertAttendance,
} from '../hooks/useHr';
import { MONTH_OPTIONS, type Employee } from '../types/hr.types';

const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH']);
const now = new Date();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => ({ value: String(now.getFullYear() - i), label: String(now.getFullYear() - i) }));

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Présent' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'CONGE', label: 'Congé' },
  { value: 'REPOS', label: 'Repos' },
  { value: 'FERIE', label: 'Férié' },
  { value: 'MALADIE', label: 'Maladie' },
];
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

interface Row { date: string; dow: number; status: string; hoursWorked: string; overtimeHours: string }

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function AttendancePage() {
  const token = useAuthStore((s) => s.token)!;
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = WRITE_ROLES.has(role);

  const { data: empRes } = useEmployees({ status: 'ACTIF' }, 1, 1000);
  const employees: Employee[] = empRes?.data ?? [];

  const [employeeId, setEmployeeId] = useState(0);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: attRes, isLoading } = useAttendance(employeeId, year, month);
  const { data: sumRes } = useAttendanceSummary(employeeId, year, month);
  const save = useBulkUpsertAttendance();
  const summary = sumRes?.data;

  const [rows, setRows] = useState<Row[]>([]);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  useEffect(() => {
    if (employeeId <= 0) { setRows([]); return; }
    const existing = new Map<string, any>((attRes?.data ?? []).map((r: any) => [String(r.date).slice(0, 10), r]));
    const next: Row[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = iso(year, month, d);
      const dow = new Date(year, month - 1, d).getDay();
      const ex = existing.get(date);
      next.push({
        date, dow,
        status: ex?.status ?? (dow === 0 || dow === 6 ? 'REPOS' : 'PRESENT'),
        hoursWorked: ex ? String(Number(ex.hoursWorked)) : (dow === 0 || dow === 6 ? '0' : '8'),
        overtimeHours: ex ? String(Number(ex.overtimeHours)) : '0',
      });
    }
    setRows(next);
  }, [attRes, employeeId, year, month, daysInMonth]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const onSave = () => {
    if (employeeId <= 0) return;
    const records = rows.map((r) => ({
      employeeId, date: r.date, status: r.status,
      hoursWorked: Number(r.hoursWorked) || 0, overtimeHours: Number(r.overtimeHours) || 0,
    }));
    save.mutate(records);
  };

  const empOptions = [{ value: '', label: '— Sélectionner un employé —' },
    ...employees.map((e) => ({ value: String(e.id), label: `${e.matricule} — ${e.lastName ?? ''} ${e.firstName ?? ''}`.trim() }))];

  return (
    <PageLayout
      title="Pointage / heures"
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Pointage' }]}
      actions={canWrite && employeeId > 0 && (
        <Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={onSave}>
          Enregistrer le mois
        </Button>
      )}
    >
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <Select label="Employé" options={empOptions} value={employeeId ? String(employeeId) : ''}
            onChange={(e) => setEmployeeId(Number(e.target.value) || 0)} />
        </div>
        <div className="w-44">
          <Select label="Mois" options={MONTH_OPTIONS} value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} />
        </div>
        <div className="w-32">
          <Select label="Année" options={YEAR_OPTIONS} value={String(year)} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </Card>

      {employeeId > 0 && summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card><div className="text-xs text-slate-500">Jours présents</div><div className="text-lg font-bold">{summary.daysPresent}</div></Card>
          <Card><div className="text-xs text-slate-500">Jours absents</div><div className="text-lg font-bold">{summary.daysAbsent}</div></Card>
          <Card><div className="text-xs text-slate-500">Total heures</div><div className="text-lg font-bold">{summary.totalHours}</div></Card>
          <Card><div className="text-xs text-slate-500">Heures sup.</div><div className="text-lg font-bold">{summary.overtimeHours}</div></Card>
          <Card><div className="text-xs text-slate-500">Valeur H. sup.</div><div className="text-lg font-bold">{formatCurrency(summary.overtimeAmount)}</div></Card>
        </div>
      )}

      <Card padding={false}>
        {employeeId <= 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Sélectionnez un employé pour saisir son pointage mensuel.</p>
        ) : isLoading ? (
          <div className="p-6"><SkeletonTable rows={10} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Jour</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Statut</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Heures travaillées</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Heures sup.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                const weekend = r.dow === 0 || r.dow === 6;
                const d = Number(r.date.slice(8, 10));
                return (
                  <tr key={r.date} className={weekend ? 'bg-slate-50/60' : ''}>
                    <td className="px-4 py-1.5 text-slate-700">{DOW[r.dow]} {d}</td>
                    <td className="px-4 py-1.5">
                      <select value={r.status} onChange={(e) => setRow(i, { status: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-1.5">
                      <input type="number" step="0.5" min="0" value={r.hoursWorked}
                        onChange={(e) => setRow(i, { hoursWorked: e.target.value })}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-4 py-1.5">
                      <input type="number" step="0.5" min="0" value={r.overtimeHours}
                        onChange={(e) => setRow(i, { overtimeHours: e.target.value })}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </PageLayout>
  );
}
