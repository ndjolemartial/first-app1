import { useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import {
  useListExportTemplates,
  useUpdateListExportTemplate,
} from '../hooks/useListExportTemplates';
import { Save, FileSpreadsheet } from 'lucide-react';

const ORIENTATION_OPTIONS = [
  { value: 'PAYSAGE', label: 'Paysage' },
  { value: 'PORTRAIT', label: 'Portrait' },
];

function TemplateCard({ template }: { template: any }) {
  const update = useUpdateListExportTemplate();
  const [name, setName] = useState<string>(template.name);
  const [orientation, setOrientation] = useState<string>(template.orientation);
  const [accentColor, setAccentColor] = useState<string>(template.accentColor);
  const [headerHtml, setHeaderHtml] = useState<string>(template.headerHtml ?? '');
  const [footerHtml, setFooterHtml] = useState<string>(template.footerHtml ?? '');
  const [endOfDocument, setEndOfDocument] = useState<string>(template.endOfDocument ?? '');
  const [showLogo, setShowLogo] = useState<boolean>(template.showLogo);
  const [showGeneratedAt, setShowGeneratedAt] = useState<boolean>(template.showGeneratedAt);
  const [showRowCount, setShowRowCount] = useState<boolean>(template.showRowCount);

  const save = () =>
    update.mutate({
      id: template.id,
      payload: { name, orientation, accentColor, headerHtml, footerHtml, endOfDocument, showLogo, showGeneratedAt, showRowCount },
    });

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input label="Nom du modèle" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-48">
          <Select
            label="Orientation"
            options={ORIENTATION_OPTIONS}
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Couleur d'accent</label>
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="h-9 w-16 rounded border border-slate-300 cursor-pointer bg-white p-0.5"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showLogo}
            onChange={(e) => setShowLogo(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Afficher le logo
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showGeneratedAt}
            onChange={(e) => setShowGeneratedAt(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Afficher la date de génération
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showRowCount}
            onChange={(e) => setShowRowCount(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Afficher le nombre de lignes
        </label>
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700 block mb-1">En-tête</label>
        <RichTextEditor value={headerHtml} onChange={setHeaderHtml} minHeight={120} />
      </div>
      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700 block mb-1">Pied de page</label>
        <RichTextEditor value={footerHtml} onChange={setFooterHtml} minHeight={120} />
      </div>
      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700 block mb-1">Fin du document</label>
        <p className="text-xs text-slate-500 mb-1">
          Inséré à la suite du tableau (mentions finales, signatures…), avant le pied de page.
        </p>
        <RichTextEditor value={endOfDocument} onChange={setEndOfDocument} minHeight={120} />
      </div>

      <div className="flex justify-end mt-4">
        <Button onClick={save} loading={update.isPending} icon={<Save className="h-4 w-4" />}>
          Enregistrer le modèle
        </Button>
      </div>
    </Card>
  );
}

export default function ListExportTemplatesSettingsTab() {
  const { data: res, isLoading } = useListExportTemplates();

  if (isLoading) return <SkeletonTable rows={6} />;
  const templates = res?.data?.templates;
  if (!templates || templates.length === 0) {
    return <div className="text-slate-500">Modèle d'export indisponible.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-slate-500" /> Modèle des exports de listes
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Ce modèle est appliqué à tous les exports PDF et Excel des listes (clients, prospects,
          biens, factures, etc.). Le tableau de données est généré automatiquement ; vous
          personnalisez l'orientation, la couleur, l'en-tête et le pied de page.
        </p>
        <div className="space-y-6">
          {templates.map((t: any) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
