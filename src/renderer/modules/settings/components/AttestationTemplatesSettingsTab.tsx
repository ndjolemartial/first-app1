import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useAttestationTemplates,
  useDeleteAttestationTemplate,
  useCreateAttestationTemplate,
} from '../../conventions/hooks/useAttestationTemplates';
import { ATTESTATION_TYPE_LABELS } from '../../conventions/utils/attestationTemplate';
import { formatDate } from '../../../shared/utils/format';
import { Plus, Edit, Trash2, FileText, Copy } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  ...Object.entries(ATTESTATION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

export default function AttestationTemplatesSettingsTab() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const { data, isLoading } = useAttestationTemplates({ type: type || undefined });
  const deleteTemplate = useDeleteAttestationTemplate();
  const createTemplate = useCreateAttestationTemplate();
  const [toDelete, setToDelete] = useState<any>(null);

  const templates: any[] = data?.data ?? [];

  const handleDelete = async () => {
    if (toDelete) await deleteTemplate.mutateAsync(toDelete.id);
    setToDelete(null);
  };

  /** Crée une copie indépendante d'un modèle existant (sans son flag « par défaut »). */
  const handleDuplicate = async (t: any) => {
    await createTemplate.mutateAsync({
      name: `Copie de ${t.name}`,
      type: t.type,
      header: t.header ?? '',
      body: t.body ?? '',
      footer: t.footer ?? '',
      headerWidth: t.headerWidth ?? 100,
      footerWidth: t.footerWidth ?? 100,
      headerHeight: t.headerHeight ?? 140,
      footerHeight: t.footerHeight ?? 140,
      footerBgColor: t.footerBgColor ?? null,
      endOfDocument: t.endOfDocument ?? '',
      endOfDocumentWidth: t.endOfDocumentWidth ?? 100,
      endOfDocumentHeight: t.endOfDocumentHeight ?? 140,
      endOfDocumentBgColor: t.endOfDocumentBgColor ?? null,
      isActive: t.isActive ?? true,
      isDefault: false,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/conventions/attestation-templates/new')}>
          Nouveau modèle
        </Button>
      </div>

      <Card className="flex flex-wrap gap-3 items-end">
        <div className="w-64">
          <Select label="Type d'attestation" options={TYPE_OPTIONS} value={type}
            onChange={(e) => setType(e.target.value)} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="Aucun modèle d'attestation"
            description="Créez un modèle (attribution, cession, solde, transfert de propriété) avec en-tête, corps et pied de page."
            action={{ label: 'Nouveau modèle', onClick: () => navigate('/conventions/attestation-templates/new') }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type d'attestation</th>
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
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="font-medium text-slate-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ATTESTATION_TYPE_LABELS[t.type] ?? t.type}</td>
                  <td className="px-4 py-3">
                    {t.isDefault
                      ? <Badge variant="success">Par défaut</Badge>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(t.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                        title="Modifier"
                        onClick={() => navigate(`/conventions/attestation-templates/${t.id}/edit`)} />
                      <Button variant="ghost" size="sm" icon={<Copy className="h-4 w-4" />}
                        title="Dupliquer"
                        loading={createTemplate.isPending}
                        onClick={() => handleDuplicate(t)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />}
                        title="Supprimer"
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
