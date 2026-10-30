import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import RegistersTabs from '../components/RegistersTabs';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import RegisterDetailModal from '../components/RegisterDetailModal';
import {
  useAmlNotifications, useCreateAmlNotification, useUpdateAmlNotification, useDeleteAmlNotification,
} from '../hooks/useAml';
import {
  Plus, Edit, Trash2, Save, X, BellRing, Eye, Calendar, Send, Share2, CheckCircle2, XCircle, StickyNote, Clock,
} from 'lucide-react';

interface EditState {
  id?: number;
  updateDate: string;
  updateDescription: string;
  notificationDate: string;
  transmissionMode: string;
  ackReceived: boolean;
  notes: string;
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const emptyState: EditState = {
  updateDate: '', updateDescription: '', notificationDate: '', transmissionMode: '', ackReceived: false, notes: '',
};

export default function AmlNotificationsRegisterPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAmlNotifications({ search: search || undefined });
  const create = useCreateAmlNotification();
  const update = useUpdateAmlNotification();
  const del = useDeleteAmlNotification();
  const rows: any[] = data?.data ?? [];

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);

  const startNew = () => setEditing({ ...emptyState });
  const startEdit = (r: any) => setEditing({
    id: r.id,
    updateDate: r.updateDate ? String(r.updateDate).slice(0, 10) : '',
    updateDescription: r.updateDescription ?? '',
    notificationDate: r.notificationDate ? String(r.notificationDate).slice(0, 10) : '',
    transmissionMode: r.transmissionMode ?? '',
    ackReceived: !!r.ackReceived,
    notes: r.notes ?? '',
  });

  const onSave = async () => {
    if (!editing || !editing.updateDate || !editing.updateDescription.trim()) return;
    const payload = {
      updateDate: editing.updateDate,
      updateDescription: editing.updateDescription.trim(),
      notificationDate: editing.notificationDate || null,
      transmissionMode: editing.transmissionMode || null,
      ackReceived: editing.ackReceived,
      notes: editing.notes || null,
    };
    const r: any = editing.id ? await update.mutateAsync({ id: editing.id, payload }) : await create.mutateAsync(payload);
    if (r.success) setEditing(null);
  };

  const columns: ExportColumn<any>[] = [
    { header: 'Référence', cell: (r) => r.reference },
    { header: 'Date de la mise à jour', cell: (r) => fmtDate(r.updateDate) },
    { header: 'Description de la mise à jour', cell: (r) => r.updateDescription },
    { header: 'Date de notification', cell: (r) => fmtDate(r.notificationDate) },
    { header: 'Mode de transmission', cell: (r) => r.transmissionMode ?? '' },
    { header: 'AR obtenu', cell: (r) => (r.ackReceived ? 'Oui' : 'Non') },
    { header: 'Enregistré le', cell: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <PageLayout
      title="Registres LBC/FT"
      breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Registres LBC/FT' }, { label: 'Notifications' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu fileName="registre-notifications" title="Registre de suivi des notifications" columns={columns}
            fetchRows={async () => rows} />
          {!editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle notification</Button>}
        </div>
      }
    >
      <RegistersTabs />
      <p className="mb-4 text-sm text-slate-500">
        Enregistrement des notifications à la CENTIF-CI et à l'autorité de supervision après chaque mise à jour
        significative des procédures ou du dispositif LBC/FT.
      </p>

      {editing && (
        <Card className="mb-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BellRing className="h-4 w-4" /> {editing.id ? 'Modifier la notification' : 'Nouvelle notification'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date de la mise à jour *" type="date" value={editing.updateDate}
              onChange={(e) => setEditing({ ...editing, updateDate: e.target.value })} />
            <Input label="Date de notification" type="date" value={editing.notificationDate}
              onChange={(e) => setEditing({ ...editing, notificationDate: e.target.value })} />
            <Input label="Mode de transmission" value={editing.transmissionMode}
              onChange={(e) => setEditing({ ...editing, transmissionMode: e.target.value })}
              placeholder="Ex. Email, courrier, dépôt physique…" />
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={editing.ackReceived}
                onChange={(e) => setEditing({ ...editing, ackReceived: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Accusé de Réception (AR) obtenu
            </label>
          </div>
          <Textarea label="Description de la mise à jour *" rows={2} value={editing.updateDescription}
            onChange={(e) => setEditing({ ...editing, updateDescription: e.target.value })} />
          <Textarea label="Notes" rows={2} value={editing.notes}
            onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={create.isPending || update.isPending} onClick={onSave}>Enregistrer</Button>
          </div>
        </Card>
      )}

      {!editing && (
        <div className="mb-4 max-w-sm">
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="Aucune notification" description="Aucune notification enregistrée pour le moment."
            action={{ label: 'Nouvelle notification', onClick: startNew }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Date de la mise à jour</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Description</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Date de notification</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Mode de transmission</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">AR obtenu</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Enregistré le</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.reference}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.updateDate)}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-700" title={r.updateDescription}>{r.updateDescription}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.notificationDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{r.transmissionMode ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.ackReceived ? 'success' : 'default'}>{r.ackReceived ? 'Oui' : 'Non'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => setViewing(r)} />
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => startEdit(r)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setToDelete(r)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog open={!!toDelete} title="Supprimer la notification"
        message={`Supprimer l'enregistrement « ${toDelete?.reference ?? ''} » ?`}
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)} />

      <RegisterDetailModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        accent="amber"
        icon={<BellRing className="h-5 w-5" />}
        eyebrow="Notification"
        reference={viewing?.reference}
        badge={viewing && (
          <Badge variant={viewing.ackReceived ? 'success' : 'default'}>
            <span className="flex items-center gap-1">
              {viewing.ackReceived ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {viewing.ackReceived ? 'AR obtenu' : 'AR non obtenu'}
            </span>
          </Badge>
        )}
        fields={viewing ? [
          { key: 'updateDate', label: 'Date de la mise à jour', value: fmtDate(viewing.updateDate), icon: <Calendar className="h-4 w-4" /> },
          { key: 'notificationDate', label: 'Date de notification', value: fmtDate(viewing.notificationDate), icon: <Send className="h-4 w-4" /> },
          { key: 'transmissionMode', label: 'Mode de transmission', value: viewing.transmissionMode, icon: <Share2 className="h-4 w-4" /> },
          { key: 'createdAt', label: 'Enregistré le', value: fmtDate(viewing.createdAt), icon: <Clock className="h-4 w-4" /> },
          { key: 'updateDescription', label: 'Description de la mise à jour', value: viewing.updateDescription, icon: <BellRing className="h-3.5 w-3.5" />, full: true },
          { key: 'notes', label: 'Notes', value: viewing.notes, icon: <StickyNote className="h-3.5 w-3.5" />, full: true },
        ] : []}
      />
    </PageLayout>
  );
}
