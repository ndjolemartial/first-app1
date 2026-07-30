import { useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import {
  useWireTransferTemplate, useUpdateWireTransferTemplate,
} from '../../hr/hooks/useWireTransfer';
import { Save, Landmark } from 'lucide-react';

const DEFAULT_COLUMN_WIDTHS = [5, 24, 11, 11, 17, 8, 14, 10];
const COLUMN_LABELS = ['N°', 'Nom complet', 'Code Bancaire', 'Code Guichet', 'Numéro de compte', 'Clé RIB', 'Banque', 'Montant (FCFA)'];

function TemplateCard({ template }: { template: any }) {
  const update = useUpdateWireTransferTemplate();
  const [name, setName] = useState<string>(template.name);
  const [tableTitle, setTableTitle] = useState<string>(template.tableTitle);
  const [signatureLabel, setSignatureLabel] = useState<string>(template.signatureLabel);
  const [signatureName, setSignatureName] = useState<string>(template.signatureName ?? '');
  const [accentColor, setAccentColor] = useState<string>(template.accentColor);
  const [introHtml, setIntroHtml] = useState<string>(template.introHtml ?? '');
  const [showLogo, setShowLogo] = useState<boolean>(template.showLogo);
  const [columnWidths, setColumnWidths] = useState<number[]>(
    Array.isArray(template.columnWidths) && template.columnWidths.length === 8
      ? template.columnWidths
      : DEFAULT_COLUMN_WIDTHS,
  );

  const setWidth = (idx: number, value: number) => {
    setColumnWidths((prev) => prev.map((w, i) => (i === idx ? value : w)));
  };
  const widthSum = columnWidths.reduce((s, w) => s + w, 0);

  const save = () =>
    update.mutate({
      id: template.id,
      payload: { name, tableTitle, signatureLabel, signatureName, accentColor, introHtml, showLogo, columnWidths },
    });

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input label="Nom du modèle" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <Input label="Titre du tableau" value={tableTitle} onChange={(e) => setTableTitle(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <Input label="Fonction du signataire" value={signatureLabel} onChange={(e) => setSignatureLabel(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <Input label="Nom du signataire" placeholder="Ex : M. Jean KOUASSI" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
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

      <div className="mt-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showLogo}
            onChange={(e) => setShowLogo(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Afficher le logo de l'entreprise (en face du titre « ORDRE DE VIREMENT »)
        </label>
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700 block mb-1">Bloc d'introduction</label>
        <p className="text-xs text-slate-500 mb-1">
          4 lignes par défaut, modifiables (texte et mise en forme par ligne) — vous pouvez en ajouter d'autres.
          Variables disponibles : <code>{'{{periode}}'}</code>, <code>{'{{nombreBeneficiaires}}'}</code>,{' '}
          <code>{'{{montantTotal}}'}</code>, <code>{'{{dateEdition}}'}</code>.
        </p>
        <RichTextEditor value={introHtml} onChange={setIntroHtml} minHeight={140} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-slate-700">Largeurs des colonnes du tableau</label>
          <span className={`text-xs font-medium ${widthSum === 100 ? 'text-slate-500' : 'text-amber-600'}`}>
            Somme : {widthSum}%
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COLUMN_LABELS.map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-xs text-slate-600">{label}</span>
              <input
                type="range" min={3} max={40} step={1} value={columnWidths[idx]}
                onChange={(e) => setWidth(idx, Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <span className="w-10 shrink-0 text-right text-xs font-medium text-slate-600">{columnWidths[idx]}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button onClick={save} loading={update.isPending} icon={<Save className="h-4 w-4" />}>
          Enregistrer le modèle
        </Button>
      </div>
    </Card>
  );
}

export default function WireTransferTemplateSettingsTab() {
  const { data: res, isLoading } = useWireTransferTemplate();

  if (isLoading) return <SkeletonTable rows={6} />;
  const template = res?.data;
  if (!template) {
    return <div className="text-slate-500">Modèle d'ordre de virement indisponible.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Landmark className="h-4 w-4 text-slate-500" /> Modèle d'ordre de virement
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Fiche paysage transmise à la banque pour les virements de salaire du mois, accessible depuis
          « Bulletins de paie » (bouton « Ordre de virement », réservé aux Super Admin / Admin). Le tableau
          des bénéficiaires et la ligne de total sont générés automatiquement ; vous personnalisez ici le
          bloc d'introduction, le titre du tableau, les largeurs de colonnes et le signataire.
        </p>
        <TemplateCard template={template} />
      </div>
    </div>
  );
}
