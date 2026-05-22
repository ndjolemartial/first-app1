import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import {
  useInvoiceTemplates,
  useUpdateInvoiceTemplate,
  useSetInvoiceTemplateDefaults,
} from '../hooks/useInvoiceTemplates';
import { Save, FileText } from 'lucide-react';

const INVOICE_TYPES = [
  { value: 'VENTE', label: 'Vente' },
  { value: 'ECHEANCE_VENTE', label: 'Échéance de vente' },
  { value: 'FRAIS_AGENCE', label: "Frais d'agence" },
  { value: 'FRAIS_DE_GESTION', label: 'Frais de gestion' },
  { value: 'AVANCE', label: 'Avance' },
  { value: 'CAUTION', label: 'Caution' },
  { value: 'OTHER', label: 'Autre' },
];

const LAYOUT_OPTIONS = [
  { value: 'CLASSIQUE', label: 'Classique' },
  { value: 'MODERNE', label: 'Moderne' },
  { value: 'COMPACT', label: 'Compact' },
];

/** Carte d'assignation d'un modèle par défaut à chaque type de facture. */
function DefaultsCard({ templates, defaults }: { templates: any[]; defaults: Record<string, number> }) {
  const setDefaults = useSetInvoiceTemplateDefaults();
  const firstId = templates[0]?.id ?? 0;
  const [map, setMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const t of INVOICE_TYPES) m[t.value] = String(defaults[t.value] ?? firstId);
    return m;
  });
  const tplOptions = templates.map((t) => ({ value: String(t.id), label: t.name }));

  const save = () => {
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) payload[k] = Number(v);
    setDefaults.mutate(payload);
  };

  return (
    <Card>
      <h3 className="font-semibold text-slate-800 mb-1">Modèle par défaut par type de facture</h3>
      <p className="text-xs text-slate-500 mb-4">
        Chaque facture est imprimée avec le modèle choisi ici selon son type.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {INVOICE_TYPES.map((t) => (
          <Select
            key={t.value}
            label={t.label}
            options={tplOptions}
            value={map[t.value]}
            onChange={(e) => setMap({ ...map, [t.value]: e.target.value })}
          />
        ))}
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={save} loading={setDefaults.isPending} icon={<Save className="h-4 w-4" />}>
          Enregistrer les modèles par défaut
        </Button>
      </div>
    </Card>
  );
}

/** Carte d'édition d'un modèle de facture. */
function TemplateCard({ template }: { template: any }) {
  const update = useUpdateInvoiceTemplate();
  const [name, setName] = useState<string>(template.name);
  const [layout, setLayout] = useState<string>(template.layout);
  const [accentColor, setAccentColor] = useState<string>(template.accentColor);
  const [headerHtml, setHeaderHtml] = useState<string>(template.headerHtml ?? '');
  const [footerHtml, setFooterHtml] = useState<string>(template.footerHtml ?? '');

  const save = () =>
    update.mutate({ id: template.id, payload: { name, layout, accentColor, headerHtml, footerHtml } });

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input label="Nom du modèle" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-48">
          <Select
            label="Mise en page"
            options={LAYOUT_OPTIONS}
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
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

      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700 block mb-1">En-tête</label>
        <RichTextEditor value={headerHtml} onChange={setHeaderHtml} minHeight={120} />
      </div>
      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700 block mb-1">Pied de page</label>
        <RichTextEditor value={footerHtml} onChange={setFooterHtml} minHeight={120} />
      </div>

      <div className="flex justify-end mt-4">
        <Button onClick={save} loading={update.isPending} icon={<Save className="h-4 w-4" />}>
          Enregistrer le modèle
        </Button>
      </div>
    </Card>
  );
}

export default function InvoiceTemplatesPage() {
  const { data: res, isLoading } = useInvoiceTemplates();

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;
  const d = res?.data;
  if (!d) return <div className="p-8 text-slate-500">Modèles indisponibles.</div>;

  return (
    <PageLayout
      title="Modèles de facture"
      breadcrumbs={[{ label: 'Comptabilité', to: '/accounting' }, { label: 'Modèles de facture' }]}
    >
      <div className="space-y-6">
        <DefaultsCard templates={d.templates} defaults={d.defaults} />
        <div>
          <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" /> Les 3 modèles
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Le corps de la facture (lignes, totaux) est généré automatiquement ; vous personnalisez
            la mise en page, la couleur, l'en-tête et le pied de page.
          </p>
          <div className="space-y-6">
            {d.templates.map((t: any) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
