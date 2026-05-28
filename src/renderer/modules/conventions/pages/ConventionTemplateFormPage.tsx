import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Card from '../../../shared/components/ui/Card';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import FooterColorPicker from '../components/FooterColorPicker';
import { CONVENTION_VARIABLE_GROUPS } from '../utils/conventionTemplate';
import { footerTextColor, isTransparentFooter, resolveFooterBg } from '../utils/footerColor';
import {
  useConventionTemplate, useCreateConventionTemplate, useUpdateConventionTemplate,
} from '../hooks/useConventionTemplates';
import { Save } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'RENTAL_UNFURNISHED', label: 'Location non meublée' },
  { value: 'RENTAL_FURNISHED', label: 'Location meublée' },
  { value: 'SALE', label: 'Vente' },
  { value: 'MANAGEMENT', label: 'Gestion' },
  { value: 'COMMERCIAL_LEASE', label: 'Bail commercial' },
  { value: 'SOUSCRIPTION', label: 'Souscription' },
  { value: 'AVENANT', label: 'Avenant' },
  { value: 'RESILIATION', label: 'Résiliation' },
];

const AMENDMENT_NATURE_OPTIONS = [
  { value: '', label: '— Toutes natures (générique) —' },
  { value: 'PROLONGATION_DELAI', label: 'Avenant de prolongation de délai' },
  { value: 'TRANSFERT_PROPRIETE', label: 'Avenant de transfert de propriété' },
  { value: 'TRANSFERT_SITE', label: 'Avenant de transfert de site / changement de lot' },
];

const SOUSCRIPTION_NATURE_OPTIONS = [
  { value: '', label: '— Toutes natures (générique) —' },
  { value: 'STANDARD', label: 'Convention de souscription' },
  { value: 'AVEC_ACD', label: 'Convention de souscription avec ACD' },
  { value: 'FINANCEMENT_PROJET', label: 'Convention de financement sur projet' },
];

export default function ConventionTemplateFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useConventionTemplate(isEdit ? Number(id) : 0);
  const create = useCreateConventionTemplate();
  const update = useUpdateConventionTemplate();

  const [name, setName] = useState('');
  const [type, setType] = useState('SALE');
  const [amendmentType, setAmendmentType] = useState('');
  const [souscriptionType, setSouscriptionType] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  // En-tête monobloc — texte et/ou image ; toute image insérée occupe 100 %
  // de la largeur du bloc (cf. CSS Tailwind `[&_img]` ci-dessous et CSS PDF
  // dans `ConventionDocumentPage.buildHeaderTemplate`).
  const [header, setHeader] = useState('');
  const [headerWidth, setHeaderWidth] = useState(100);
  const [headerHeight, setHeaderHeight] = useState(140);
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [footerWidth, setFooterWidth] = useState(100);
  const [footerHeight, setFooterHeight] = useState(140);
  const [footerBgColor, setFooterBgColor] = useState<string | null>(null);
  const [endOfDocument, setEndOfDocument] = useState('');
  const [endOfDocumentWidth, setEndOfDocumentWidth] = useState(100);
  const [endOfDocumentHeight, setEndOfDocumentHeight] = useState(140);
  const [endOfDocumentBgColor, setEndOfDocumentBgColor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && res?.data) {
      const t = res.data;
      setName(t.name ?? '');
      setType(t.type ?? 'SALE');
      setAmendmentType(t.amendmentType ?? '');
      setSouscriptionType(t.souscriptionType ?? '');
      setIsDefault(!!t.isDefault);
      setHeader(t.header ?? '');
      setHeaderWidth(t.headerWidth ?? 100);
      setHeaderHeight(t.headerHeight ?? 140);
      setBody(t.body ?? '');
      setFooter(t.footer ?? '');
      setFooterWidth(t.footerWidth ?? 100);
      setFooterHeight(t.footerHeight ?? 140);
      setFooterBgColor(t.footerBgColor ?? null);
      setEndOfDocument(t.endOfDocument ?? '');
      setEndOfDocumentWidth(t.endOfDocumentWidth ?? 100);
      setEndOfDocumentHeight(t.endOfDocumentHeight ?? 140);
      setEndOfDocumentBgColor(t.endOfDocumentBgColor ?? null);
    }
  }, [res, isEdit]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom du modèle est requis'); return; }
    setError('');
    setSaving(true);
    const payload = {
      name: name.trim(), type, isDefault, body, footer,
      header, headerWidth, headerHeight,
      footerWidth, footerHeight, footerBgColor,
      endOfDocument, endOfDocumentWidth, endOfDocumentHeight, endOfDocumentBgColor,
      amendmentType: type === 'AVENANT' ? (amendmentType || undefined) : undefined,
      souscriptionType: type === 'SOUSCRIPTION' ? (souscriptionType || undefined) : undefined,
    };
    const r = isEdit
      ? await update.mutateAsync({ id: Number(id), payload })
      : await create.mutateAsync(payload);
    setSaving(false);
    if (r.success) navigate('/settings?tab=conventionTemplates');
    else setError(typeof r.error === 'string' ? r.error : 'Échec de l\'enregistrement');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le modèle' : 'Nouveau modèle de convention'}
      breadcrumbs={[
        { label: 'Paramètres', to: '/settings' },
        { label: 'Modèles de conventions', to: '/settings?tab=conventionTemplates' },
        { label: isEdit ? 'Modifier' : 'Nouveau' },
      ]}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Informations du modèle</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom du modèle *" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Compromis de vente terrain" />
            <Select label="Type de convention *" options={TYPE_OPTIONS} value={type}
              onChange={(e) => setType(e.target.value)} />
          </div>
          {type === 'AVENANT' && (
            <div className="mt-4">
              <Select label="Nature de l'avenant" options={AMENDMENT_NATURE_OPTIONS}
                value={amendmentType} onChange={(e) => setAmendmentType(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">
                Laissez vide pour un modèle générique applicable à toutes les natures d'avenant.
              </p>
            </div>
          )}
          {type === 'SOUSCRIPTION' && (
            <div className="mt-4">
              <Select label="Nature de la souscription" options={SOUSCRIPTION_NATURE_OPTIONS}
                value={souscriptionType} onChange={(e) => setSouscriptionType(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">
                Laissez vide pour un modèle générique applicable à toutes les natures de souscription.
              </p>
            </div>
          )}
          <label className="flex items-center gap-2 mt-4 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Modèle par défaut pour ce type de convention
          </label>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-slate-800">En-tête</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Largeur</span>
                <input type="range" min={20} max={100} step={5} value={headerWidth}
                  onChange={(e) => setHeaderWidth(Number(e.target.value))} className="w-28 accent-blue-600" />
                <span className="text-xs font-medium text-slate-600 w-9 text-right">{headerWidth}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Hauteur</span>
                <input type="range" min={40} max={500} step={10} value={headerHeight}
                  onChange={(e) => setHeaderHeight(Number(e.target.value))} className="w-28 accent-blue-600" />
                <span className="text-xs font-medium text-slate-600 w-12 text-right">{headerHeight}px</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Apparaît en haut de chaque page du document généré. Toute image
            insérée occupe automatiquement 100 % de la largeur du bloc.
          </p>
          {/* `[&_.tiptap-content_img]:!w-full` force les images du bloc à
              prendre 100 % de la largeur du conteneur, aussi bien dans
              l'éditeur que dans l'aperçu — mêmes règles côté PDF. */}
          <div
            style={{ width: `${headerWidth}%` }}
            className="[&_.tiptap-content_img]:!w-full [&_.tiptap-content_img]:!h-auto [&_.tiptap-content_img]:!max-w-none"
          >
            <RichTextEditor value={header} onChange={setHeader} variables={CONVENTION_VARIABLE_GROUPS}
              placeholder="En-tête (logo, coordonnées de l'agence…)" minHeight={headerHeight} />
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-1">Corps de la convention</h3>
          <p className="text-xs text-slate-500 mb-3">
            Utilisez le bouton « Variables » pour insérer des valeurs dynamiques (client,
            terrain, montants…). Les marqueurs « — Page N — » indiquent approximativement
            où le contenu débordera sur une nouvelle page A4.
          </p>
          <RichTextEditor value={body} onChange={setBody} variables={CONVENTION_VARIABLE_GROUPS}
            placeholder="Corps de la convention…" minHeight={380} showPageBreaks />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-slate-800">Fin du document</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Largeur</span>
                <input type="range" min={20} max={100} step={5} value={endOfDocumentWidth}
                  onChange={(e) => setEndOfDocumentWidth(Number(e.target.value))} className="w-28 accent-blue-600" />
                <span className="text-xs font-medium text-slate-600 w-9 text-right">{endOfDocumentWidth}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Hauteur</span>
                <input type="range" min={40} max={500} step={10} value={endOfDocumentHeight}
                  onChange={(e) => setEndOfDocumentHeight(Number(e.target.value))} className="w-28 accent-blue-600" />
                <span className="text-xs font-medium text-slate-600 w-12 text-right">{endOfDocumentHeight}px</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <p className="text-xs text-slate-500">
              Inséré à la suite du corps (signatures, mentions légales finales…), une seule fois.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Couleur de fond</span>
              <FooterColorPicker value={endOfDocumentBgColor} onChange={setEndOfDocumentBgColor} />
            </div>
          </div>
          <div
            className={`rounded p-2 ${isTransparentFooter(endOfDocumentBgColor) ? 'border border-dashed border-slate-300' : ''}`}
            style={{
              width: `${endOfDocumentWidth}%`,
              backgroundColor: isTransparentFooter(endOfDocumentBgColor) ? 'transparent' : resolveFooterBg(endOfDocumentBgColor),
              color: footerTextColor(endOfDocumentBgColor),
            }}
          >
            <RichTextEditor value={endOfDocument} onChange={setEndOfDocument} variables={CONVENTION_VARIABLE_GROUPS}
              placeholder="Fin du document (signatures, mentions finales…)" minHeight={endOfDocumentHeight} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-slate-800">Pied de page</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Largeur</span>
                <input type="range" min={20} max={100} step={5} value={footerWidth}
                  onChange={(e) => setFooterWidth(Number(e.target.value))} className="w-28 accent-blue-600" />
                <span className="text-xs font-medium text-slate-600 w-9 text-right">{footerWidth}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Hauteur</span>
                <input type="range" min={40} max={500} step={10} value={footerHeight}
                  onChange={(e) => setFooterHeight(Number(e.target.value))} className="w-28 accent-blue-600" />
                <span className="text-xs font-medium text-slate-600 w-12 text-right">{footerHeight}px</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <p className="text-xs text-slate-500">
              Apparaît en bas de chaque page du document généré.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Couleur de fond</span>
              <FooterColorPicker value={footerBgColor} onChange={setFooterBgColor} />
            </div>
          </div>
          <div
            className={`rounded p-2 ${isTransparentFooter(footerBgColor) ? 'border border-dashed border-slate-300' : ''}`}
            style={{
              width: `${footerWidth}%`,
              backgroundColor: isTransparentFooter(footerBgColor) ? 'transparent' : resolveFooterBg(footerBgColor),
              color: footerTextColor(footerBgColor),
            }}
          >
            <RichTextEditor value={footer} onChange={setFooter} variables={CONVENTION_VARIABLE_GROUPS}
              placeholder="Pied de page (mentions légales, signatures…)" minHeight={footerHeight} />
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/settings?tab=conventionTemplates')}>
            Annuler
          </Button>
          <Button type="button" loading={saving} icon={<Save className="h-4 w-4" />} onClick={handleSave}>
            {isEdit ? 'Enregistrer' : 'Créer le modèle'}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
