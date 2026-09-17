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
  useAmlSuspiciousOperations, useCreateAmlSuspiciousOperation, useUpdateAmlSuspiciousOperation,
  useDeleteAmlSuspiciousOperation, useAmlCentifExchangesSelectable,
} from '../hooks/useAml';
import { Plus, Edit, Trash2, Save, X, AlertTriangle } from 'lucide-react';

const DECISION_LABEL: Record<string, string> = { DOS_TRANSMISE: 'DOS transmise', DOS_NON_RETENUE: 'DOS non retenue' };
const DECISION_VARIANT: Record<string, any> = { DOS_TRANSMISE: 'danger', DOS_NON_RETENUE: 'default' };

interface EditState {
  id?: number;
  detectionDate: string;
  subjectLabel: string;
  description: string;
  decision: string;
  dosExchangeId: string;
  notes: string;
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const emptyState: EditState = {
  detectionDate: '', subjectLabel: '', description: '', decision: '', dosExchangeId: '', notes: '',
};

export default function AmlSuspiciousOperationsPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAmlSuspiciousOperations({ search: search || undefined });
  const { data: exchangesRes } = useAmlCentifExchangesSelectable();
  const exchanges: any[] = (exchangesRes?.success ? exchangesRes.data : []) ?? [];
  const create = useCreateAmlSuspiciousOperation();
  const update = useUpdateAmlSuspiciousOperation();
  const del = useDeleteAmlSuspiciousOperation();
  const rows: any[] = data?.data ?? [];

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ ...emptyState });
  const startEdit = (r: any) => setEditing({
    id: r.id,
    detectionDate: r.detectionDate ? String(r.detectionDate).slice(0, 10) : '',
    subjectLabel: r.subjectLabel ?? '', description: r.description ?? '',
    decision: r.decision ?? '', dosExchangeId: r.dosExchangeId ? String(r.dosExchangeId) : '',
    notes: r.notes ?? '',
  });

  const onSave = async () => {
    if (!editing || !editing.detectionDate || !editing.subjectLabel.trim() || !editing.description.trim()) return;
    const payload = {
      detectionDate: editing.detectionDate,
      subjectLabel: editing.subjectLabel.trim(),
      description: editing.description.trim(),
      decision: editing.decision || null,
      dosExchangeId: editing.dosExchangeId || null,
      notes: editing.notes || null,
    };
    const r: any = editing.id ? await update.mutateAsync({ id: editing.id, payload }) : await create.mutateAsync(payload);
    if (r.success) setEditing(null);
  };

  const columns: ExportColumn<any>[] = [
    { header: 'Référence', cell: (r) => r.reference },
    { header: 'Date de détection', cell: (r) => fmtDate(r.detectionDate) },
    { header: 'Client / dossier concerné', cell: (r) => r.subjectLabel },
    { header: 'Description des faits', cell: (r) => r.description },
    { header: 'Décision', cell: (r) => (r.decision ? DECISION_LABEL[r.decision] : '') },
    { header: 'Référence DOS', cell: (r) => r.dosExchange?.reference ?? '' },
  ];

  return (
    <PageLayout
      title="Registres LBC/FT"
      breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Registres LBC/FT' }, { label: 'Opérations suspectes' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu fileName="registre-operations-suspectes" title="Registre des opérations suspectes" columns={columns}
            fetchRows={async () => rows} />
          {!editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle opération</Button>}
        </div>
      }
    >
      <RegistersTabs />
      <p className="mb-4 text-sm text-slate-500">
        Enregistrement de l'ensemble des opérations suspectes détectées. La « Référence DOS » se sélectionne
        parmi les échanges du <strong>Registre de suivi des échanges avec la CENTIF-CI</strong>.
      </p>

      {editing && (
        <Card className="mb-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <AlertTriangle className="h-4 w-4" /> {editing.id ? "Modifier l'opération" : 'Nouvelle opération suspecte'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date de détection *" type="date" value={editing.detectionDate}
              onChange={(e) => setEditing({ ...editing, detectionDate: e.target.value })} />
            <Input label="Client / dossier concerné *" value={editing.subjectLabel}
              onChange={(e) => setEditing({ ...editing, subjectLabel: e.target.value })} />
            <Select label="Décision" value={editing.decision}
              options={[{ value: '', label: '—' }, ...Object.entries(DECISION_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
              onChange={(e) => setEditing({ ...editing, decision: e.target.value })} />
            <div>
              <Select label="Référence DOS" value={editing.dosExchangeId}
                options={[
                  { value: '', label: '—' },
                  ...exchanges.map((x) => ({ value: String(x.id), label: `${x.reference} — ${x.nature} (${fmtDate(x.exchangeDate)})` })),
                ]}
                onChange={(e) => setEditing({ ...editing, dosExchangeId: e.target.value })} />
              <p className="mt-1 text-xs text-slate-400">Issue du Registre de suivi des échanges avec la CENTIF-CI.</p>
            </div>
          </div>
          <Textarea label="Description des faits / indices de suspicion *" rows={3} value={editing.description}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
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
          <EmptyState title="Aucune opération suspecte" description="Aucune opération suspecte recensée pour le moment."
            action={{ label: 'Nouvelle opération', onClick: startNew }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Détection</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Client / dossier</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Description</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Décision</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Réf. DOS</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.reference}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.detectionDate)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.subjectLabel}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-500" title={r.description}>{r.description}</td>
                  <td className="px-4 py-3">
                    {r.decision ? <Badge variant={DECISION_VARIANT[r.decision]}>{DECISION_LABEL[r.decision]}</Badge> : <span className="text-xs text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.dosExchange?.reference ?? '—'}</td>
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

      <ConfirmDialog open={!!toDelete} title="Supprimer l'opération"
        message={`Supprimer l'enregistrement « ${toDelete?.reference ?? ''} » ?`}
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)} />
    </PageLayout>
  );
}
