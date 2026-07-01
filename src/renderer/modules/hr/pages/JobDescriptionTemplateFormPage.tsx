import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Card from '../../../shared/components/ui/Card';
import Modal from '../../../shared/components/ui/Modal';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import FooterColorPicker from '../../conventions/components/FooterColorPicker';
import { footerTextColor, isTransparentFooter, resolveFooterBg } from '../../conventions/utils/footerColor';
import { CONTRACT_VARIABLE_GROUPS } from '../utils/contractTemplate';
import { useJobDescriptionTemplates, useSaveJobDescriptionTemplate } from '../hooks/useHr';
import { useConventionTemplates } from '../../conventions/hooks/useConventionTemplates';
import { Save, FileDown } from 'lucide-react';

const BACK = '/settings?tab=contractTemplates&sub=fiches';

/**
 * Éditeur d'un modèle de fiche de poste — mêmes zones que les modèles de
 * contrat (en-tête / corps / fin du document / pied de page) et mêmes variables
 * (données du contrat, de l'employé, de la fonction, de l'autorité…).
 */
export default function JobDescriptionTemplateFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: listRes } = useJobDescriptionTemplates();
  const save = useSaveJobDescriptionTemplate();

  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
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
  const [importOpen, setImportOpen] = useState(false);

  const current = useMemo(
    () => (isEdit ? (listRes?.data ?? []).find((t: any) => t.id === Number(id)) : null),
    [isEdit, id, listRes],
  );

  useEffect(() => {
    if (isEdit && current) {
      setName(current.name ?? '');
      setIsDefault(!!current.isDefault);
      setHeader(current.header ?? '');
      setHeaderWidth(current.headerWidth ?? 100);
      setHeaderHeight(current.headerHeight ?? 140);
      setBody(current.body ?? '');
      setFooter(current.footer ?? '');
      setFooterWidth(current.footerWidth ?? 100);
      setFooterHeight(current.footerHeight ?? 140);
      setFooterBgColor(current.footerBgColor ?? null);
      setEndOfDocument(current.endOfDocument ?? '');
      setEndOfDocumentWidth(current.endOfDocumentWidth ?? 100);
      setEndOfDocumentHeight(current.endOfDocumentHeight ?? 140);
      setEndOfDocumentBgColor(current.endOfDocumentBgColor ?? null);
    }
  }, [current, isEdit]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom du modèle est requis'); return; }
    setError('');
    setSaving(true);
    const payload = {
      name: name.trim(), isDefault, body, footer,
      header, headerWidth, headerHeight,
      footerWidth, footerHeight, footerBgColor,
      endOfDocument, endOfDocumentWidth, endOfDocumentHeight, endOfDocumentBgColor,
    };
    const r = await save.mutateAsync({ id: isEdit ? Number(id) : undefined, payload });
    setSaving(false);
    if (r.success) navigate(BACK);
    else setError(typeof r.error === 'string' ? r.error : "Échec de l'enregistrement");
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le modèle' : 'Nouveau modèle de fiche de poste'}
      breadcrumbs={[
        { label: 'Paramètres', to: '/settings' },
        { label: 'Fiches de poste', to: BACK },
        { label: isEdit ? 'Modifier' : 'Nouveau' },
      ]}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">Informations du modèle</h3>
            <Button variant="secondary" size="sm" icon={<FileDown className="h-4 w-4" />}
              onClick={() => setImportOpen(true)}>
              Importer depuis une convention
            </Button>
          </div>
          <Input label="Nom du modèle *" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Fiche de poste standard" />
          <label className="flex items-center gap-2 mt-4 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Modèle par défaut
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
            Apparaît en haut de chaque page du document généré. Toute image insérée
            occupe automatiquement 100 % de la largeur du bloc.
          </p>
          <div
            style={{ width: `${headerWidth}%` }}
            className="[&_.tiptap-content_img]:!w-full [&_.tiptap-content_img]:!h-auto [&_.tiptap-content_img]:!max-w-none"
          >
            <RichTextEditor value={header} onChange={setHeader} variables={CONTRACT_VARIABLE_GROUPS}
              placeholder="En-tête (logo, coordonnées de l'entreprise…)" minHeight={headerHeight} />
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-1">Corps de la fiche de poste</h3>
          <p className="text-xs text-slate-500 mb-3">
            Utilisez le bouton « Variables » pour insérer des valeurs dynamiques (employé,
            poste, fonction, autorité…). Insérez par exemple <code>{'{{contrat.fonction.contenu}}'}</code> pour les missions.
          </p>
          <RichTextEditor value={body} onChange={setBody} variables={CONTRACT_VARIABLE_GROUPS}
            placeholder="Corps de la fiche de poste…" minHeight={380} showPageBreaks />
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
            <p className="text-xs text-slate-500">Inséré à la suite du corps (signatures, mentions finales…), une seule fois.</p>
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
            <RichTextEditor value={endOfDocument} onChange={setEndOfDocument} variables={CONTRACT_VARIABLE_GROUPS}
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
            <p className="text-xs text-slate-500">Apparaît en bas de chaque page (le numéro de page est ajouté automatiquement).</p>
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
            <RichTextEditor value={footer} onChange={setFooter} variables={CONTRACT_VARIABLE_GROUPS}
              placeholder="Pied de page (mentions légales…)" minHeight={footerHeight} />
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate(BACK)}>Annuler</Button>
          <Button type="button" loading={saving} icon={<Save className="h-4 w-4" />} onClick={handleSave}>
            {isEdit ? 'Enregistrer' : 'Créer le modèle'}
          </Button>
        </div>
      </div>

      <ImportFromConventionModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(t) => {
          setHeader(t.header ?? '');
          setHeaderWidth(t.headerWidth ?? 100);
          setHeaderHeight(t.headerHeight ?? 140);
          setFooter(t.footer ?? '');
          setFooterWidth(t.footerWidth ?? 100);
          setFooterHeight(t.footerHeight ?? 140);
          setFooterBgColor(t.footerBgColor ?? null);
          setEndOfDocument(t.endOfDocument ?? '');
          setEndOfDocumentWidth(t.endOfDocumentWidth ?? 100);
          setEndOfDocumentHeight(t.endOfDocumentHeight ?? 140);
          setEndOfDocumentBgColor(t.endOfDocumentBgColor ?? null);
          setImportOpen(false);
        }}
      />
    </PageLayout>
  );
}

/** Import des zones (en-tête / pied / fin) depuis un modèle de convention. */
function ImportFromConventionModal({
  open, onClose, onImport,
}: { open: boolean; onClose: () => void; onImport: (t: any) => void }) {
  const { data } = useConventionTemplates();
  const [selId, setSelId] = useState('');
  const templates: any[] = data?.data ?? [];
  const selected = templates.find((t) => String(t.id) === selId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importer les zones depuis une convention"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button disabled={!selected} icon={<FileDown className="h-4 w-4" />}
            onClick={() => selected && onImport(selected)}>Importer les zones</Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 mb-3">
        Copie l'<strong>en-tête</strong>, le <strong>pied de page</strong> et la
        <strong> fin du document</strong> (largeurs, hauteurs, couleurs) du modèle sélectionné.
        Le corps n'est pas modifié.
      </p>
      <Select
        label="Modèle de convention"
        options={[{ value: '', label: '— Sélectionner un modèle —' }, ...templates.map((t) => ({ value: String(t.id), label: t.name }))]}
        value={selId}
        onChange={(e) => setSelId(e.target.value)}
      />
    </Modal>
  );
}
