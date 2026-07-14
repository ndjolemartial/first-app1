import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { formatDate, formatDateTime } from '../../../shared/utils/format';
import {
  useLatenessLinkableLeaveRequests, useLatenessLinkableActivities, useJustifyLateness,
} from '../hooks/useHr';

export interface LatenessLineForModal {
  employeeId: number;
  employeeName: string;
  date: string; // 'YYYY-MM-DD'
}

interface Props {
  line: LatenessLineForModal | null;
  onClose: () => void;
}

type Mode = 'LEAVE' | 'ACTIVITY';

/** Fenêtre de justification d'une journée de retard / départ précipité. */
export default function LatenessJustifyModal({ line, onClose }: Props) {
  const open = !!line;
  const [mode, setMode] = useState<Mode>('LEAVE');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: leaveRes } = useLatenessLinkableLeaveRequests(line?.employeeId ?? 0, line?.date ?? '', open);
  const { data: actRes } = useLatenessLinkableActivities(line?.employeeId ?? 0, line?.date ?? '', open);
  const leaveRequests: any[] = leaveRes?.success ? leaveRes.data ?? [] : [];
  const activities: any[] = actRes?.success ? actRes.data ?? [] : [];
  const justify = useJustifyLateness();

  useEffect(() => {
    if (!open) return;
    setMode('LEAVE');
    setSelectedId('');
    setNotes('');
    setError('');
  }, [open, line?.employeeId, line?.date]);

  const handleSubmit = async () => {
    if (!line) return;
    if (!selectedId) { setError('Sélectionnez une demande de congé ou une activité.'); return; }
    const payload: any = { employeeId: line.employeeId, date: line.date, notes: notes.trim() || undefined };
    if (mode === 'LEAVE') payload.leaveRequestId = Number(selectedId);
    else payload.crmActivityId = Number(selectedId);
    const r: any = await justify.mutateAsync(payload);
    if (r.success) onClose();
    else setError(typeof r.error === 'string' ? r.error : 'Erreur lors de la justification');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Justifier la journée"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={justify.isPending} onClick={handleSubmit}>Marquer justifiée</Button>
        </div>
      }
    >
      {line && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{line.employeeName}</span> — {formatDate(line.date)}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMode('LEAVE'); setSelectedId(''); }}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === 'LEAVE' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Demande de congé approuvée
            </button>
            <button
              type="button"
              onClick={() => { setMode('ACTIVITY'); setSelectedId(''); }}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === 'ACTIVITY' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Visite chantier / Sortie clientèle / Courses
            </button>
          </div>

          {mode === 'LEAVE' ? (
            leaveRequests.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune demande de congé approuvée ne couvre cette journée pour ce collaborateur.</p>
            ) : (
              <Select
                label="Demande de congé"
                placeholder="Sélectionner…"
                options={leaveRequests.map((l) => ({
                  value: String(l.id),
                  label: `${l.reference} — ${l.type?.name ?? ''} (${formatDate(l.startDate)} → ${formatDate(l.endDate)})`,
                }))}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              />
            )
          ) : (
            activities.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune activité « Visite chantier / Sortie en clientèle / Courses » traitée ce jour-là (ou déjà toutes utilisées).</p>
            ) : (
              <Select
                label="Activité"
                placeholder="Sélectionner…"
                options={activities.map((a) => ({ value: String(a.id), label: `${a.subject} — traité le ${formatDateTime(a.completedAt)}` }))}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              />
            )
          )}

          <Textarea label="Notes (optionnel)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
