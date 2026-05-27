import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Card from '../../../shared/components/ui/Card';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import { ATTESTATION_VARIABLE_GROUPS, ATTESTATION_TYPE_LABELS } from '../utils/attestationTemplate';
import {
  useAttestationTemplate, useCreateAttestationTemplate, useUpdateAttestationTemplate,
} from '../hooks/useAttestationTemplates';
import { Save } from 'lucide-react';

const TYPE_OPTIONS = Object.entries(ATTESTATION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function AttestationTemplateFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useAttestationTemplate(isEdit ? Number(id) : 0);
  const create = useCreateAttestationTemplate();
  const update = useUpdateAttestationTemplate();

  const [name, setName] = useState('');
  const [type, setType] = useState('ATTRIBUTION');
  const [isDefault, setIsDefault] = useState(false);
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [headerWidth, setHeaderWidth] = useState(100);
  const [footerWidth, setFooterWidth] = useState(100);
  const [headerHeight, setHeaderHeight] = useState(140);
  const [footerHeight, setFooterHeight] = useState(140);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && res?.data) {
      const t = res.data;
      setName(t.name ?? '');
      setType(t.type ?? 'ATTRIBUTION');
      setIsDefault(!!t.isDefault);
      setHeader(t.header ?? '');
      setBody(t.body ?? '');
      setFooter(t.footer ?? '');
      setHeaderWidth(t.headerWidth ?? 100);
      setFooterWidth(t.footerWidth ?? 100);
      setHeaderHeight(t.headerHeight ?? 140);
      setFooterHeight(t.footerHeight ?? 140);
    }
  }, [res, isEdit]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom du modèle est requis'); return; }
    setError('');
    setSaving(true);
    const payload = {
      name: name.trim(), type, isDefault, header, body, footer,
      headerWidth, footerWidth, headerHeight, footerHeight,
    };
    const r = isEdit
      ? await update.mutateAsync({ id: Number(id), payload })
      : await create.mutateAsync(payload);
    setSaving(false);
    if (r.success) navigate('/settings?tab=attestationTemplates');
    else setError(typeof r.error === 'string' ? r.error : 'Échec de l\'enregistrement');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le modèle' : "Nouveau modèle d'attestation"}
      breadcrumbs={[
        { label: 'Paramètres', to: '/settings' },
        { label: "Modèles d'attestations", to: '/settings?tab=attestationTemplates' },
        { label: isEdit ? 'Modifier' : 'Nouveau' },
      ]}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Informations du modèle</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom du modèle *" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Attestation d'attribution standard" />
            <Select label="Type d'attestation *" options={TYPE_OPTIONS} value={type}
              onChange={(e) => setType(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 mt-4 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Modèle par défaut pour ce type d'attestation
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
          <p className="text-xs text-slate-500 mb-3">Apparaît en haut de chaque page du document généré.</p>
          <div style={{ width: `${headerWidth}%` }}>
            <RichTextEditor value={header} onChange={setHeader} variables={ATTESTATION_VARIABLE_GROUPS}
              placeholder="En-tête (logo, coordonnées de l'agence…)" minHeight={headerHeight} />
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-1">Corps de l'attestation</h3>
          <p className="text-xs text-slate-500 mb-3">
            Utilisez le bouton « Variables » pour insérer des valeurs dynamiques (client, terrain, cédant, montants…).
          </p>
          <RichTextEditor value={body} onChange={setBody} variables={ATTESTATION_VARIABLE_GROUPS}
            placeholder="Corps de l'attestation…" minHeight={380} />
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
          <p className="text-xs text-slate-500 mb-3">Apparaît en bas de chaque page du document généré (fond rouge).</p>
          <div className="rounded bg-red-600 p-2" style={{ width: `${footerWidth}%` }}>
            <RichTextEditor value={footer} onChange={setFooter} variables={ATTESTATION_VARIABLE_GROUPS}
              placeholder="Pied de page (signatures, mentions légales…)" minHeight={footerHeight} />
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/settings?tab=attestationTemplates')}>
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
