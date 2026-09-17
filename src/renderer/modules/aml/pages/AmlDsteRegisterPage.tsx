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
import {
  useAmlDsteRecords, useCreateAmlDsteRecord, useUpdateAmlDsteRecord, useDeleteAmlDsteRecord,
} from '../hooks/useAml';
import { Plus, Edit, Trash2, Save, X, Banknote } from 'lucide-react';

interface EditState {
  id?: number;
  transactionDate: string;
  subjectLabel: string;
  amount: string;
  description: string;
  notes: string;
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const fmtAmount = (n: any) => Number(n ?? 0).toLocaleString('fr-FR');
const emptyState: EditState = { transactionDate: '', subjectLabel: '', amount: '', description: '', notes: '' };

export default function AmlDsteRegisterPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAmlDsteRecords({ search: search || undefined });
  const create = useCreateAmlDsteRecord();
  const update = useUpdateAmlDsteRecord();
  const del = useDeleteAmlDsteRecord();
  const rows: any[] = data?.data ?? [];
  const dsteThreshold: number | undefined = (data as any)?.dsteThreshold;

  const [editing, setEditing] = useState<EditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ ...emptyState });
  const startEdit = (r: any) => setEditing({
    id: r.id,
    transactionDate: r.transactionDate ? String(r.transactionDate).slice(0, 10) : '',
    subjectLabel: r.subjectLabel ?? '', amount: String(r.amount ?? ''),
    description: r.description ?? '', notes: r.notes ?? '',
  });

  const onSave = async () => {
    if (!editing || !editing.transactionDate || !editing.subjectLabel.trim() || !editing.amount) return;
    const payload = {
      transactionDate: editing.transactionDate,
      subjectLabel: editing.subjectLabel.trim(),
      amount: Number(editing.amount),
      description: editing.description || null,
      notes: editing.notes || null,
    };
    const r: any = editing.id ? await update.mutateAsync({ id: editing.id, payload }) : await create.mutateAsync(payload);
    if (r.success) setEditing(null);
  };

  const columns: ExportColumn<any>[] = [
    { header: 'Référence', cell: (r) => r.reference },
    { header: 'Date de la transaction', cell: (r) => fmtDate(r.transactionDate) },
    { header: 'Client / dossier concerné', cell: (r) => r.subjectLabel },
    { header: 'Montant (FCFA)', cell: (r) => fmtAmount(r.amount) },
    { header: 'Description', cell: (r) => r.description ?? '' },
    { header: 'Origine', cell: (r) => (r.sourceType ? 'Automatique' : 'Manuelle') },
    { header: 'Enregistré le', cell: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <PageLayout
      title="Registres LBC/FT"
      breadcrumbs={[{ label: 'Conformité LBC/FT' }, { label: 'Registres LBC/FT' }, { label: 'Grille DSTE' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu fileName="grille-dste" title="Grille de recensement des transactions en espèces éligibles à la DSTE" columns={columns}
            fetchRows={async () => rows} />
          {!editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle transaction</Button>}
        </div>
      }
    >
      <RegistersTabs />
      <p className="mb-1 text-sm text-slate-500">
        Recensement des opérations en espèces éligibles à la DSTE (Déclaration Systématique de Transactions en
        Espèces). Les paiements en espèces enregistrés dans la Comptabilité (factures, échéances) sont{' '}
        <strong>ajoutés automatiquement</strong> dès qu'ils dépassent le seuil ci-dessous — la saisie manuelle
        reste possible en complément (espèces reçues hors circuit facture/échéance).
      </p>
      {dsteThreshold != null && (
        <p className="mb-4 text-sm font-medium text-amber-700">
          Seuil DSTE actuel : {fmtAmount(dsteThreshold)} FCFA (modifiable dans Paramètres → Conformité LBC/FT →
          Seuils de scoring). La saisie manuelle reste possible en dessous du seuil (ex. transaction
          fractionnée à des fins de contournement).
        </p>
      )}

      {editing && (
        <Card className="mb-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Banknote className="h-4 w-4" /> {editing.id ? 'Modifier la transaction' : 'Nouvelle transaction'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date de la transaction *" type="date" value={editing.transactionDate}
              onChange={(e) => setEditing({ ...editing, transactionDate: e.target.value })} />
            <Input label="Montant (FCFA) *" type="number" min="0" value={editing.amount}
              onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
            <Input label="Client / dossier concerné *" className="col-span-2" value={editing.subjectLabel}
              onChange={(e) => setEditing({ ...editing, subjectLabel: e.target.value })} />
          </div>
          <Textarea label="Description (optionnel)" rows={2} value={editing.description}
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
          <EmptyState title="Aucune transaction" description="Aucune transaction en espèces recensée pour le moment."
            action={{ label: 'Nouvelle transaction', onClick: startNew }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Client / dossier</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Montant (FCFA)</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Description</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Origine</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Enregistré le</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.reference}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.transactionDate)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.subjectLabel}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtAmount(r.amount)}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-500" title={r.description ?? ''}>{r.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.sourceType ? 'info' : 'default'}>{r.sourceType ? 'Auto' : 'Manuel'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.createdAt)}</td>
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

      <ConfirmDialog open={!!toDelete} title="Supprimer la transaction"
        message={`Supprimer l'enregistrement « ${toDelete?.reference ?? ''} » ?`}
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)} />
    </PageLayout>
  );
}
