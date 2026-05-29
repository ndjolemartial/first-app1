import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import Modal from '../../../shared/components/ui/Modal';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useAttestationTemplates,
  useDeleteAttestationTemplate,
  useCreateAttestationTemplate,
} from '../../conventions/hooks/useAttestationTemplates';
import { useConventionTemplates } from '../../conventions/hooks/useConventionTemplates';
import { ATTESTATION_TYPE_LABELS } from '../../conventions/utils/attestationTemplate';
import { formatDate } from '../../../shared/utils/format';
import { Plus, Edit, Trash2, FileText, Copy, FileInput } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  ...Object.entries(ATTESTATION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const TARGET_TYPE_OPTIONS = Object.entries(ATTESTATION_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export default function AttestationTemplatesSettingsTab() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const { data, isLoading } = useAttestationTemplates({ type: type || undefined });
  const { data: conventionTemplatesRes } = useConventionTemplates();
  const deleteTemplate = useDeleteAttestationTemplate();
  const createTemplate = useCreateAttestationTemplate();
  const [toDelete, setToDelete] = useState<any>(null);

  const templates: any[] = data?.data ?? [];
  const conventionTemplates: any[] = conventionTemplatesRes?.data ?? [];

  // État du modal « Importer depuis modèle de convention ».
  const [importOpen, setImportOpen] = useState(false);
  const [importSourceId, setImportSourceId] = useState('');
  const [importTargetType, setImportTargetType] = useState<keyof typeof ATTESTATION_TYPE_LABELS>('ATTRIBUTION');
  const [importName, setImportName] = useState('');
  const [importError, setImportError] = useState('');

  // Lorsque le modal s'ouvre, on présélectionne la convention nommée
  // « CONVENTION DE SOUSCRIPTION » (insensible à la casse) si elle existe.
  useEffect(() => {
    if (!importOpen) return;
    if (importSourceId) return;
    const preferred = conventionTemplates.find(
      (t) => (t.name ?? '').trim().toUpperCase() === 'CONVENTION DE SOUSCRIPTION',
    );
    const source = preferred ?? conventionTemplates[0];
    if (source) {
      setImportSourceId(String(source.id));
      setImportName(`Copie de ${source.name}`);
    }
  }, [importOpen, conventionTemplates, importSourceId]);

  const conventionTemplateOptions = [
    { value: '', label: '— Choisir un modèle —' },
    ...conventionTemplates.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  const resetImport = () => {
    setImportOpen(false);
    setImportSourceId('');
    setImportName('');
    setImportError('');
    setImportTargetType('ATTRIBUTION');
  };

  const handleImport = async () => {
    setImportError('');
    const source = conventionTemplates.find((t) => String(t.id) === importSourceId);
    if (!source) { setImportError('Sélectionnez un modèle de convention'); return; }
    const name = importName.trim();
    if (!name) { setImportError('Le nom du nouveau modèle est requis'); return; }
    const r = await createTemplate.mutateAsync({
      name,
      type: importTargetType,
      header: source.header ?? '',
      body: source.body ?? '',
      footer: source.footer ?? '',
      headerWidth: source.headerWidth ?? 100,
      headerHeight: source.headerHeight ?? 140,
      footerWidth: source.footerWidth ?? 100,
      footerHeight: source.footerHeight ?? 140,
      footerBgColor: source.footerBgColor ?? null,
      endOfDocument: source.endOfDocument ?? '',
      endOfDocumentWidth: source.endOfDocumentWidth ?? 100,
      endOfDocumentHeight: source.endOfDocumentHeight ?? 140,
      endOfDocumentBgColor: source.endOfDocumentBgColor ?? null,
      isActive: true,
      isDefault: false,
    });
    if (r.success) resetImport();
    else setImportError(typeof r.error === 'string' ? r.error : 'Échec de l\'import');
  };

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
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          icon={<FileInput className="h-4 w-4" />}
          onClick={() => setImportOpen(true)}
        >
          Importer depuis modèle de convention
        </Button>
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

      <Modal
        open={importOpen}
        onClose={resetImport}
        title="Importer depuis un modèle de convention"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetImport}>Annuler</Button>
            <Button onClick={handleImport} loading={createTemplate.isPending}>Importer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Le contenu (en-tête, corps, fin du document, pied de page) du modèle de convention
            sélectionné sera dupliqué dans un nouveau modèle d'attestation que vous pourrez ensuite éditer.
          </p>
          <Select
            label="Modèle de convention source"
            options={conventionTemplateOptions}
            value={importSourceId}
            onChange={(e) => {
              setImportSourceId(e.target.value);
              const src = conventionTemplates.find((t) => String(t.id) === e.target.value);
              if (src) setImportName(`Copie de ${src.name}`);
            }}
          />
          <Select
            label="Type d'attestation cible"
            options={TARGET_TYPE_OPTIONS}
            value={importTargetType}
            onChange={(e) => setImportTargetType(e.target.value as any)}
          />
          <Input
            label="Nom du nouveau modèle"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
          />
          {importError && <p className="text-sm text-red-600">{importError}</p>}
        </div>
      </Modal>
    </div>
  );
}
