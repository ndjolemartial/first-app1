import { useEffect, useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { Save } from 'lucide-react';
import { usePayslipTemplates, useUpdatePayslipTemplate } from '../hooks/useHr';

const LAYOUT_OPTIONS = [
  { value: 'MODELE_1', label: 'Modèle 1 — Classique' },
  { value: 'MODELE_2', label: 'Modèle 2 — Moderne' },
  { value: 'MODELE_3', label: 'Modèle 3 — Compact' },
];

/* ─── Modèles de bulletins de paie ────────────────────────────── */
// Les modèles de contrats de travail sont désormais édités depuis
// Paramètres → Modèles d'imprimés → « Modèles de contrats de travail »
// (zones En-tête / Corps / Fin du document / Pied de page, variables, import).
function PayslipsTab() {
  const { data: res, isLoading } = usePayslipTemplates();
  const update = useUpdatePayslipTemplate();
  const templates: any[] = res?.data ?? [];

  const [selId, setSelId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', layout: 'MODELE_1', accentColor: '#1E3A5F', headerHtml: '', footerHtml: '', isDefault: false });

  useEffect(() => { if (selId == null && templates.length > 0) setSelId(templates[0].id); }, [templates, selId]);
  useEffect(() => {
    const t = templates.find((x) => x.id === selId);
    if (t) setForm({
      name: t.name, layout: t.layout, accentColor: t.accentColor || '#1E3A5F',
      headerHtml: t.headerHtml || '', footerHtml: t.footerHtml || '', isDefault: t.isDefault,
    });
  }, [selId, templates]);

  if (isLoading) return <Card><SkeletonTable rows={5} /></Card>;

  const onSave = async () => {
    if (selId == null) return;
    await update.mutateAsync({ id: selId, payload: form });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <Card className="lg:col-span-1">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Modèles de bulletin</h3>
        <ul className="space-y-1">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selId === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                onClick={() => setSelId(t.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{t.name}</span>
                  {t.isDefault && <Badge variant="success">défaut</Badge>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:col-span-3">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Mise en page" options={LAYOUT_OPTIONS} value={form.layout}
            onChange={(e) => setForm({ ...form, layout: e.target.value })} />
          <Input label="Couleur d'accent" type="color" value={form.accentColor}
            onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
          Modèle par défaut
        </label>
        <label className="mb-1 block text-sm font-medium text-slate-700">En-tête (HTML, optionnel)</label>
        <RichTextEditor value={form.headerHtml} onChange={(html) => setForm({ ...form, headerHtml: html })}
          placeholder="En-tête personnalisé (sinon coordonnées de l'entreprise)" minHeight={120} />
        <label className="mb-1 mt-3 block text-sm font-medium text-slate-700">Pied de page (HTML, optionnel)</label>
        <RichTextEditor value={form.footerHtml} onChange={(html) => setForm({ ...form, footerHtml: html })}
          placeholder="Mentions légales en pied de bulletin" minHeight={120} />
        <div className="mt-3 flex justify-end">
          <Button icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={onSave}>Enregistrer</Button>
        </div>
      </Card>
    </div>
  );
}

export default function HrTemplatesPage() {
  return (
    <PageLayout
      title="Modèles de bulletins de paie"
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Modèles de bulletins' }]}
    >
      <PayslipsTab />
    </PageLayout>
  );
}
