import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useQuoteTemplates, useDeleteQuoteTemplate, useCreateQuoteTemplate,
} from '../../quotes/hooks/useQuoteTemplates';
import { formatDate } from '../../../shared/utils/format';
import { Plus, Edit, Trash2, FileText, Copy } from 'lucide-react';

export default function QuoteTemplatesSettingsTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuoteTemplates();
  const del = useDeleteQuoteTemplate();
  const create = useCreateQuoteTemplate();
  const [toDelete, setToDelete] = useState<any>(null);

  const templates: any[] = data?.data ?? [];

  const handleDelete = async () => {
    if (toDelete) await del.mutateAsync(toDelete.id);
    setToDelete(null);
  };

  const handleDuplicate = async (t: any) => {
    await create.mutateAsync({
      name: `Copie de ${t.name}`,
      header: t.header ?? '', body: t.body ?? '', footer: t.footer ?? '',
      footerBgColor: t.footerBgColor ?? null,
      endOfDocument: t.endOfDocument ?? '',
      isActive: t.isActive ?? true, isDefault: false,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Modèles utilisés pour générer les documents de devis (en-tête entreprise et logo sont ajoutés automatiquement).
        </p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/quotes/templates/new')}>
          Nouveau modèle
        </Button>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={4} /></div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="Aucun modèle de devis"
            description="Créez un modèle (corps + pied de page) avec les variables dynamiques du devis."
            action={{ label: 'Nouveau modèle', onClick: () => navigate('/quotes/templates/new') }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Par défaut</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Modifié le</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span className="font-medium text-slate-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {t.isDefault ? <Badge variant="success">Par défaut</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={t.isActive ? 'info' : 'default'}>{t.isActive ? 'Actif' : 'Inactif'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(t.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} title="Modifier"
                        onClick={() => navigate(`/quotes/templates/${t.id}/edit`)} />
                      <Button variant="ghost" size="sm" icon={<Copy className="h-4 w-4" />} title="Dupliquer"
                        loading={create.isPending} onClick={() => handleDuplicate(t)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} title="Supprimer"
                        onClick={() => setToDelete(t)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer le modèle"
        message={`Supprimer le modèle « ${toDelete?.name ?? ''} » ?`}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
