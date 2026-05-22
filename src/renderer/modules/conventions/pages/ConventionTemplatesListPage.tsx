import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useConventionTemplates, useDeleteConventionTemplate } from '../hooks/useConventionTemplates';
import { formatDate } from '../../../shared/utils/format';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Location non meublée', RENTAL_FURNISHED: 'Location meublée',
  SALE: 'Vente', MANAGEMENT: 'Gestion', COMMERCIAL_LEASE: 'Bail commercial',
  SOUSCRIPTION: 'Souscription', AVENANT: 'Avenant', RESILIATION: 'Résiliation',
};

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })),
];

export default function ConventionTemplatesListPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const { data, isLoading } = useConventionTemplates({ type: type || undefined });
  const deleteTemplate = useDeleteConventionTemplate();
  const [toDelete, setToDelete] = useState<any>(null);

  const templates: any[] = data?.data ?? [];

  const handleDelete = async () => {
    if (toDelete) await deleteTemplate.mutateAsync(toDelete.id);
    setToDelete(null);
  };

  return (
    <PageLayout
      title="Modèles de conventions"
      breadcrumbs={[{ label: 'Conventions', to: '/conventions' }, { label: 'Modèles' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/conventions/templates/new')}>
          Nouveau modèle
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="w-56">
          <Select label="Type de convention" options={TYPE_OPTIONS} value={type}
            onChange={(e) => setType(e.target.value)} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="Aucun modèle"
            description="Créez un modèle de convention enrichi avec en-tête, corps, pied de page et variables dynamiques."
            action={{ label: 'Nouveau modèle', onClick: () => navigate('/conventions/templates/new') }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type de convention</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Par défaut</th>
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
                  <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className="px-4 py-3">
                    {t.isDefault
                      ? <Badge variant="success">Par défaut</Badge>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(t.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                        onClick={() => navigate(`/conventions/templates/${t.id}/edit`)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />}
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
    </PageLayout>
  );
}
