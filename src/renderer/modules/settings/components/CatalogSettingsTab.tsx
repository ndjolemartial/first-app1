import { useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Badge from '../../../shared/components/ui/Badge';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import {
  useCatalog, useCreateCatalogItem, useUpdateCatalogItem, useDeleteCatalogItem,
} from '../../../shared/hooks/useCatalog';
import { formatCurrency } from '../../../shared/utils/format';
import { PlusCircle, Edit, Trash2, Save, ShoppingBag, Search } from 'lucide-react';

interface Row {
  id: number; type: string; designation: string; description?: string | null;
  category?: string | null; unit?: string | null; unitPrice: number | string; isActive: boolean;
}

const TYPE_OPTIONS = [
  { value: 'PRESTATION', label: 'Prestation' },
  { value: 'PRODUIT', label: 'Produit' },
];
const TYPE_LABEL: Record<string, string> = { PRESTATION: 'Prestation', PRODUIT: 'Produit' };

const blank: Row = { id: 0, type: 'PRESTATION', designation: '', description: '', category: '', unit: '', unitPrice: 0, isActive: true };

export default function CatalogSettingsTab() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { data: res, isLoading } = useCatalog({ includeInactive: true, ...(typeFilter ? { type: typeFilter } : {}), ...(search ? { search } : {}) });
  const create = useCreateCatalogItem();
  const update = useUpdateCatalogItem();
  const remove = useDeleteCatalogItem();

  const items: Row[] = res?.success ? (res.data as Row[]) ?? [] : [];
  const [edit, setEdit] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null });
  const [confirm, setConfirm] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null });

  const openNew = () => setEdit({ open: true, row: { ...blank } });
  const openEdit = (row: Row) => setEdit({ open: true, row: { ...row, unitPrice: Number(row.unitPrice) } });
  const closeEdit = () => setEdit({ open: false, row: null });

  const onSave = async () => {
    if (!edit.row) return;
    const r = edit.row;
    const payload = {
      type: r.type,
      designation: r.designation.trim(),
      description: r.description || null,
      category: r.category || null,
      unit: r.unit || null,
      unitPrice: Number(r.unitPrice) || 0,
      isActive: r.isActive,
    };
    if (!payload.designation) return;
    const out: any = r.id > 0 ? await update.mutateAsync({ id: r.id, payload }) : await create.mutateAsync(payload);
    if (out.success) closeEdit();
  };

  const onDelete = async () => {
    if (!confirm.row) return;
    const out: any = await remove.mutateAsync(confirm.row.id);
    if (out.success) setConfirm({ open: false, row: null });
  };

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" /> Catalogue prestations / produits
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Articles prédéfinis (désignation + prix) réutilisables pour pré-remplir les lignes de devis et de factures.
            Désactivez un article pour le retirer des propositions sans toucher aux documents existants.
          </p>
        </div>
        <Button icon={<PlusCircle className="h-4 w-4" />} onClick={openNew}>Nouvel article</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="">Tous les types</option>
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : items.length === 0 ? (
        <EmptyState title="Aucun article" description="Créez vos prestations et produits récurrents." action={{ label: 'Nouvel article', onClick: openNew }} />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Désignation</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Catégorie</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Unité</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Prix unitaire</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">Statut</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">{it.designation}</td>
                <td className="px-3 py-2 text-slate-600">{TYPE_LABEL[it.type] ?? it.type}</td>
                <td className="px-3 py-2 text-slate-500">{it.category ?? '—'}</td>
                <td className="px-3 py-2 text-slate-500">{it.unit ?? '—'}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(Number(it.unitPrice))}</td>
                <td className="px-3 py-2 text-center"><Badge variant={it.isActive ? 'success' : 'default'}>{it.isActive ? 'Actif' : 'Inactif'}</Badge></td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} onClick={() => openEdit(it)} />
                    <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm({ open: true, row: it })} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={edit.open} onClose={closeEdit} title={edit.row?.id ? 'Modifier l\'article' : 'Nouvel article'}>
        {edit.row && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Type" options={TYPE_OPTIONS} value={edit.row.type}
                onChange={(e) => setEdit((s) => ({ ...s, row: { ...s.row!, type: e.target.value } }))} />
              <Input label="Prix unitaire (XOF)" type="number" value={String(edit.row.unitPrice)}
                onChange={(e) => setEdit((s) => ({ ...s, row: { ...s.row!, unitPrice: Number(e.target.value) } }))} />
            </div>
            <Input label="Désignation" required value={edit.row.designation}
              onChange={(e) => setEdit((s) => ({ ...s, row: { ...s.row!, designation: e.target.value } }))}
              placeholder="ex: Bornage de terrain" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Catégorie (optionnel)" value={edit.row.category ?? ''}
                onChange={(e) => setEdit((s) => ({ ...s, row: { ...s.row!, category: e.target.value.toUpperCase() } }))}
                placeholder="ex: GÉOMÈTRE" />
              <Input label="Unité (optionnel)" value={edit.row.unit ?? ''}
                onChange={(e) => setEdit((s) => ({ ...s, row: { ...s.row!, unit: e.target.value } }))}
                placeholder="ex: forfait, m², heure" />
            </div>
            <Textarea label="Description (optionnel)" rows={2} value={edit.row.description ?? ''}
              onChange={(e) => setEdit((s) => ({ ...s, row: { ...s.row!, description: e.target.value } }))} />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={edit.row.isActive}
                onChange={(e) => setEdit((s) => ({ ...s, row: { ...s.row!, isActive: e.target.checked } }))} />
              Actif (proposé dans les devis et factures)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeEdit}>Annuler</Button>
              <Button onClick={onSave} loading={create.isPending || update.isPending} icon={<Save className="h-4 w-4" />}>
                {edit.row.id ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open: false, row: null })} onConfirm={onDelete}
        loading={remove.isPending} title="Supprimer l'article"
        message={`Supprimer « ${confirm.row?.designation} » du catalogue ?`} confirmLabel="Supprimer" />
    </Card>
  );
}
