import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Card from '../../../shared/components/ui/Card';
import {
  useQuoteTemplate, useCreateQuoteTemplate, useUpdateQuoteTemplate,
} from '../hooks/useQuoteTemplates';
import { mergeQuoteTemplate } from '../utils/quoteTemplate';
import { Save } from 'lucide-react';

/** Catalogue de variables proposées à l'insertion dans le corps / pied de page. */
const VARIABLE_GROUPS: { group: string; items: { token: string; label: string }[] }[] = [
  { group: 'Devis', items: [
    { token: 'devis.reference', label: 'Référence' },
    { token: 'devis.dateEmission', label: "Date d'émission" },
    { token: 'devis.validite', label: 'Date de validité' },
    { token: 'devis.lignes', label: 'Tableau des lignes (par catégorie)' },
    { token: 'devis.sousTotal', label: 'Sous-total' },
    { token: 'devis.remise', label: 'Remise' },
    { token: 'devis.remisePourcentage', label: 'Remise (%)' },
    { token: 'devis.tva', label: 'Taux de TVA' },
    { token: 'devis.montantTva', label: 'Montant TVA' },
    { token: 'devis.total', label: 'Total' },
    { token: 'devis.total.enLettres', label: 'Total en lettres' },
    { token: 'devis.modalites', label: 'Modalités de paiement' },
    { token: 'devis.acompte', label: 'Acompte attendu' },
    { token: 'devis.acomptePourcentage', label: 'Acompte attendu (%)' },
    { token: 'devis.conditions', label: 'Conditions' },
  ] },
  { group: 'Client', items: [
    { token: 'client.nomComplet', label: 'Nom complet' },
    { token: 'client.civilite', label: 'Civilité' },
    { token: 'client.telephone', label: 'Téléphone' },
    { token: 'client.email', label: 'E-mail' },
    { token: 'client.adresse', label: 'Adresse' },
    { token: 'client.ville', label: 'Ville' },
  ] },
  { group: 'Objet / Divers', items: [
    { token: 'objet.designation', label: 'Objet (bien/terrain)' },
    { token: 'terrain.reference', label: 'Référence terrain' },
    { token: 'lotissement.nom', label: 'Lotissement' },
    { token: 'agent.nomComplet', label: 'Agent émetteur' },
    { token: 'date.aujourdhui', label: 'Date du jour' },
  ] },
];

/** Devis fictif pour l'aperçu du modèle. */
const SAMPLE_QUOTE: any = {
  reference: 'DEV-2026-0001', issueDate: '2026-06-11T00:00:00Z', validUntil: '2026-07-11T00:00:00Z',
  type: 'PRESTATION', subtotal: 650000, discountAmount: 50000, taxRate: 18, taxAmount: 108000, total: 708000,
  paymentModalites: 'SUR_6_MOIS', depositExpected: 200000, conditions: 'Devis valable 30 jours.',
  client: { type: 'INDIVIDUEL', firstName: 'Awa', lastName: 'KONE', civilite: 'Madame', phone: '+225 07 00 00 00', email: 'awa@example.ci', city: 'Abidjan' },
  agent: { firstName: 'Jean', lastName: 'BAMBA' },
  items: [
    { id: 1, category: 'Bornage', designation: 'Bornage de parcelle', quantity: 1, unitPrice: 300000, total: 300000 },
    { id: 2, category: 'Bornage', designation: 'Plan de bornage', quantity: 1, unitPrice: 150000, total: 150000 },
    { id: 3, category: 'Frais de dossier', designation: 'Ouverture de dossier', quantity: 1, unitPrice: 200000, total: 200000 },
  ],
};

export default function QuoteTemplateFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useQuoteTemplate(isEdit ? Number(id) : 0);
  const create = useCreateQuoteTemplate();
  const update = useUpdateQuoteTemplate();

  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Champ actif (corps / pied) pour l'insertion de variables au curseur.
  const [activeField, setActiveField] = useState<'body' | 'footer'>('body');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEdit && res?.data) {
      const t = res.data;
      setName(t.name ?? '');
      setBody(t.body ?? '');
      setFooter(t.footer ?? '');
      setIsDefault(!!t.isDefault);
      setIsActive(t.isActive !== false);
    }
  }, [res, isEdit]);

  const insertToken = (token: string) => {
    const text = `{{${token}}}`;
    const ref = activeField === 'body' ? bodyRef.current : footerRef.current;
    const value = activeField === 'body' ? body : footer;
    const setter = activeField === 'body' ? setBody : setFooter;
    if (!ref) { setter(value + text); return; }
    const start = ref.selectionStart ?? value.length;
    const end = ref.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    setter(next);
    // Repositionne le curseur après l'insertion.
    requestAnimationFrame(() => {
      ref.focus();
      const pos = start + text.length;
      ref.setSelectionRange(pos, pos);
    });
  };

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError('Le nom du modèle est requis'); return; }
    setSaving(true);
    const payload = { name: name.trim(), body, footer, isDefault, isActive };
    const r = isEdit
      ? await update.mutateAsync({ id: Number(id), payload })
      : await create.mutateAsync(payload);
    setSaving(false);
    if (r.success) navigate('/settings?tab=quoteTemplates');
    else setError(typeof r.error === 'string' ? r.error : 'Échec de l\'enregistrement');
  };

  const previewHtml = mergeQuoteTemplate(body, SAMPLE_QUOTE);
  const previewFooter = mergeQuoteTemplate(footer, SAMPLE_QUOTE);

  return (
    <PageLayout
      title={isEdit ? 'Modifier le modèle de devis' : 'Nouveau modèle de devis'}
      breadcrumbs={[{ label: 'Paramètres', to: '/settings?tab=quoteTemplates' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
      actions={
        <Button loading={saving} icon={<Save className="h-4 w-4" />} onClick={handleSave}>
          {isEdit ? 'Enregistrer' : 'Créer'}
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nom du modèle *" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Devis — Moderne" />
              <div className="flex items-end gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Par défaut
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Actif
                </label>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Corps du document (HTML + variables)</h3>
            <textarea
              ref={bodyRef}
              value={body}
              onFocus={() => setActiveField('body')}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="<h1>DEVIS {{devis.reference}}</h1> …"
            />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Pied de page (HTML)</h3>
            <textarea
              ref={footerRef}
              value={footer}
              onFocus={() => setActiveField('footer')}
              onChange={(e) => setFooter(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder='<div style="background:#7f1d1d;color:#fff;text-align:center;padding:6px;">Merci pour votre confiance</div>'
            />
            <p className="mt-2 text-xs text-slate-400">
              L'en-tête (coordonnées entreprise + logo) et les marges (2,5 cm) sont gérés automatiquement à la génération.
            </p>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Variables ({activeField === 'body' ? 'corps' : 'pied'})</h3>
            <p className="text-xs text-slate-400 mb-3">Cliquez pour insérer au curseur. Conditionnel : <code>{'{{#si x}}…{{sinon}}…{{/si}}'}</code></p>
            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {VARIABLE_GROUPS.map((g) => (
                <div key={g.group}>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{g.group}</div>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((it) => (
                      <button key={it.token} type="button" title={it.label}
                        onClick={() => insertToken(it.token)}
                        className="px-2 py-1 text-xs bg-slate-100 hover:bg-indigo-100 text-slate-700 rounded font-mono">
                        {it.token}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Aperçu (données fictives)</h3>
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-800
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2 [&_table]:my-2 [&_p]:my-1">
              <div dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-slate-400">Corps vide.</p>' }} />
              {previewFooter && <div className="mt-6" dangerouslySetInnerHTML={{ __html: previewFooter }} />}
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
