import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import RegistersTabs from '../components/RegistersTabs';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import {
  useAmlCentifExchanges, useCreateAmlCentifExchange, useUpdateAmlCentifExchange, useDeleteAmlCentifExchange,
} from '../hooks/useAml';
import { Plus, Edit, Trash2, Save, X, MessageSquare } from 'lucide-react';

const DIRECTION_LABEL: Record<string, string> = { ENTRANT: 'Entrant', SORTANT: 'Sortant' };
const STATUS_LABEL: Record<string, string> = { EN_COURS: 'En cours', CLOTURE: 'Clôturé', SANS_SUITE: 'Sans suite' };
const STATUS_VARIANT: Record<string, any> = { EN_COURS: 'warning', CLOTURE: 'success', SANS_SUITE: 'default' };

interface EditState {
  id?: number;
  exchangeDate: string;
  direction: string;
  nature: string;
  channel: string;
  status: string;
  closedAt: string;
  notes: string;
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const emptyState: EditState = {
  exchangeDate: '', direction: 'SORTANT', nature: '', channel: '', status: 'EN_COURS', closedAt: '', notes: '',
};

export default function AmlCentifExchangesPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAmlCentifExchanges({ search: search || undefined });
  const create = useCreateAmlCentifExchange();
  const update = useUpdateAmlCentifExchange();
  const del = useDeleteAmlCentifExchange();
  const rows: any[] = data?.data ?? [];

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ ...emptyState });
  const startEdit = (r: any) => setEditing({
    id: r.id,
    exchangeDate: r.exchangeDate ? String(r.exchangeDate).slice(0, 10) : '',
    direction: r.direction, nature: r.nature ?? '', channel: r.channel ?? '',
    status: r.status ?? 'EN_COURS',
    closedAt: r.closedAt ? String(r.closedAt).slice(0, 10) : '',
    notes: r.notes ?? '',
  });

  const onSave = async () => {
    if (!editing || !editing.exchangeDate || !editing.nature.trim()) return;
    const payload = {
      exchangeDate: editing.exchangeDate,
      direction: editing.direction,
      nature: editing.nature.trim(),
      channel: editing.channel || null,
      status: editing.status,
      closedAt: editing.closedAt || null,
      notes: editing.notes || null,
    };
    const r: any = editing.id ? await update.mutateAsync({ id: editing.id, payload }) : await create.mutateAsync(payload);
    if (r.success) setEditing(null);
  };

  const columns: ExportColumn<any>[] = [
    { header: 'Référence', cell: (r) => r.reference },
    { header: 'Date', cell: (r) => fmtDate(r.exchangeDate) },
    { header: 'Sens', cell: (r) => DIRECTION_LABEL[r.direction] ?? r.direction },
    { header: "Nature de l'échange", cell: (r) => r.nature },
    { header: 'Canal', cell: (r) => r.channel ?? '' },
    { header: 'Statut', cell: (r) => STATUS_LABEL[r.status] ?? r.status },
    { header: 'Date de clôture', cell: (r) => fmtDate(r.closedAt) },
  ];

  return (
    <PageLayout
      title="Registres LBC/FT"
      breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Registres LBC/FT' }, { label: 'Échanges CENTIF-CI' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu fileName="registre-echanges-centif" title="Registre de suivi des échanges avec la CENTIF-CI" columns={columns}
            fetchRows={async () => rows} />
          {!editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvel échange</Button>}
        </div>
      }
    >
      <RegistersTabs />
      <p className="mb-4 text-sm text-slate-500">
        Enregistrement de l'ensemble des échanges ou communications avec la CENTIF-CI.
      </p>

      {editing && (
        <Card className="mb-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <MessageSquare className="h-4 w-4" /> {editing.id ? "Modifier l'échange" : 'Nouvel échange'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date *" type="date" value={editing.exchangeDate}
              onChange={(e) => setEditing({ ...editing, exchangeDate: e.target.value })} />
            <Select label="Sens *" value={editing.direction}
              options={Object.entries(DIRECTION_LABEL).map(([v, l]) => ({ value: v, label: l }))}
              onChange={(e) => setEditing({ ...editing, direction: e.target.value })} />
            <Input label="Nature de l'échange *" className="col-span-2" value={editing.nature}
              onChange={(e) => setEditing({ ...editing, nature: e.target.value })}
              placeholder="Ex. Demande d'information, notification, réponse à une DOS…" />
            <Input label="Canal" value={editing.channel}
              onChange={(e) => setEditing({ ...editing, channel: e.target.value })}
              placeholder="Ex. Email, courrier, plateforme, téléphone…" />
            <Select label="Statut" value={editing.status}
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
              onChange={(e) => setEditing({ ...editing, status: e.target.value })} />
            <Input label="Date de clôture" type="date" value={editing.closedAt}
              onChange={(e) => setEditing({ ...editing, closedAt: e.target.value })} />
          </div>
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
          <EmptyState title="Aucun échange" description="Aucun échange avec la CENTIF-CI enregistré pour le moment."
            action={{ label: 'Nouvel échange', onClick: startNew }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Sens</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Nature</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Canal</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Clôture</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.reference}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.exchangeDate)}</td>
                  <td className="px-4 py-3"><Badge variant="default">{DIRECTION_LABEL[r.direction] ?? r.direction}</Badge></td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-700" title={r.nature}>{r.nature}</td>
                  <td className="px-4 py-3 text-slate-500">{r.channel ?? '—'}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.closedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
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

      <ConfirmDialog open={!!toDelete} title="Supprimer l'échange"
        message={`Supprimer l'enregistrement « ${toDelete?.reference ?? ''} » ?`}
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)} />
    </PageLayout>
  );
}
