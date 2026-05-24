import { useMemo, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Select from './Select';

export type ShapeType = 'line' | 'rectangle' | 'square' | 'circle' | 'ellipse' | 'arrow';

interface ShapeInsertDialogProps {
  open: boolean;
  onClose: () => void;
  /** Callback : reçoit le markup HTML/SVG prêt à être inséré dans l'éditeur. */
  onInsert: (html: string) => void;
}

const SHAPE_OPTIONS: { value: ShapeType; label: string }[] = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'square',    label: 'Carré' },
  { value: 'circle',    label: 'Cercle' },
  { value: 'ellipse',   label: 'Ellipse' },
  { value: 'line',      label: 'Trait' },
  { value: 'arrow',     label: 'Flèche' },
];

const TEXT_ALIGN_OPTIONS = [
  { value: 'center', label: 'Centré' },
  { value: 'left',   label: 'Gauche' },
  { value: 'right',  label: 'Droite' },
];

/**
 * Construit le markup SVG d'une forme paramétrée. Le SVG retourné est marqué
 * `contenteditable="false"` pour rester atomique dans le contenteditable parent
 * (évite l'édition partielle des nœuds internes).
 */
function buildShapeSvg(opts: {
  type: ShapeType;
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  noFill: boolean;
  text?: string;
  textColor?: string;
  textSize?: number;
  textBold?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  imageDataUrl?: string;
}): string {
  const { type, width, height, strokeColor, strokeWidth, fillColor, noFill } = opts;
  const fill = noFill ? 'none' : fillColor;
  const sw = Math.max(0, strokeWidth);
  const inset = sw / 2; // évite que le contour ne déborde du viewBox

  let shape = '';
  if (type === 'rectangle' || type === 'square') {
    shape = `<rect x="${inset}" y="${inset}" width="${width - sw}" height="${height - sw}" fill="${fill}" stroke="${strokeColor}" stroke-width="${sw}"/>`;
  } else if (type === 'circle' || type === 'ellipse') {
    const cx = width / 2;
    const cy = height / 2;
    const rx = (width - sw) / 2;
    const ry = (height - sw) / 2;
    shape = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${strokeColor}" stroke-width="${sw}"/>`;
  } else if (type === 'line') {
    const y = height / 2;
    shape = `<line x1="${inset}" y1="${y}" x2="${width - inset}" y2="${y}" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="round"/>`;
  } else if (type === 'arrow') {
    const y = height / 2;
    const arrowId = `arrow-${Math.random().toString(36).slice(2, 8)}`;
    shape =
      `<defs><marker id="${arrowId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${strokeColor}"/></marker></defs>`
      + `<line x1="${inset}" y1="${y}" x2="${width - 12}" y2="${y}" stroke="${strokeColor}" stroke-width="${sw}" marker-end="url(#${arrowId})"/>`;
  }

  // Image insérée à l'intérieur de la forme (couvre l'aire utile en respectant le contour).
  let image = '';
  if (opts.imageDataUrl) {
    const pad = sw + 2;
    image = `<image href="${opts.imageDataUrl}" x="${pad}" y="${pad}" width="${Math.max(0, width - pad * 2)}" height="${Math.max(0, height - pad * 2)}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // Texte interne via foreignObject (HTML stylé : centré vertical/horizontal).
  let text = '';
  if (opts.text) {
    const align = opts.textAlign ?? 'center';
    const fz = opts.textSize ?? 14;
    const color = opts.textColor ?? '#0f172a';
    const weight = opts.textBold ? 'bold' : 'normal';
    const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
    const escaped = opts.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
    text =
      `<foreignObject x="0" y="0" width="${width}" height="${height}">`
      + `<div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:${justify};width:100%;height:100%;padding:4px;box-sizing:border-box;text-align:${align};color:${color};font-family:'Segoe UI',Arial,sans-serif;font-size:${fz}px;font-weight:${weight};line-height:1.2;overflow:hidden">`
      + `<span>${escaped}</span>`
      + `</div></foreignObject>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" `
    + `contenteditable="false" style="display:inline-block;vertical-align:middle;max-width:100%">`
    + shape + image + text
    + `</svg>`
  );
}

export default function ShapeInsertDialog({ open, onClose, onInsert }: ShapeInsertDialogProps) {
  const [type, setType] = useState<ShapeType>('rectangle');
  const [width, setWidth] = useState(220);
  const [height, setHeight] = useState(120);
  const [strokeColor, setStrokeColor] = useState('#1e3a5f');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState('#dbeafe');
  const [noFill, setNoFill] = useState(false);
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#0f172a');
  const [textSize, setTextSize] = useState(14);
  const [textBold, setTextBold] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);
  const [imageName, setImageName] = useState<string>('');

  // Pour cercle et carré : largeur = hauteur (lié automatiquement).
  const effectiveHeight = (type === 'circle' || type === 'square') ? width : height;

  const svgPreview = useMemo(
    () => buildShapeSvg({
      type, width, height: effectiveHeight,
      strokeColor, strokeWidth,
      fillColor, noFill: noFill || type === 'line' || type === 'arrow',
      text: text || undefined, textColor, textSize, textBold, textAlign,
      imageDataUrl,
    }),
    [type, width, effectiveHeight, strokeColor, strokeWidth, fillColor, noFill, text, textColor, textSize, textBold, textAlign, imageDataUrl],
  );

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      window.alert('Image trop volumineuse (maximum 5 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
        setImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInsert = () => {
    // Le SVG est inséré entouré d'un paragraphe vide pour que le curseur puisse passer après la forme.
    onInsert(svgPreview + '<p><br/></p>');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Insérer une forme"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleInsert}>Insérer la forme</Button>
        </>
      }
    >
      <div className="grid grid-cols-[280px,1fr] gap-6">
        {/* Aperçu */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase">Aperçu</p>
          <div
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-center justify-center min-h-[180px] overflow-auto"
            dangerouslySetInnerHTML={{ __html: svgPreview }}
          />
          <p className="text-xs text-slate-400">
            Dimensions : {width} × {effectiveHeight} px
          </p>
        </div>

        {/* Paramètres */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Select label="Forme" options={SHAPE_OPTIONS} value={type}
                onChange={(e) => setType(e.target.value as ShapeType)} />
            </div>
            <Input label="Largeur (px)" type="number" min={20} max={1000} value={width}
              onChange={(e) => setWidth(Math.max(20, Number(e.target.value) || 0))} />
            <Input label="Hauteur (px)"
              type="number" min={20} max={1000} value={effectiveHeight}
              disabled={type === 'circle' || type === 'square'}
              onChange={(e) => setHeight(Math.max(20, Number(e.target.value) || 0))} />
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Couleur du contour</label>
              <input type="color" value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="h-9 w-full rounded border border-slate-300 cursor-pointer" />
            </div>
            <Input label="Épaisseur (px)" type="number" min={0} max={20} value={strokeWidth}
              onChange={(e) => setStrokeWidth(Math.max(0, Number(e.target.value) || 0))} />
            {(type !== 'line' && type !== 'arrow') && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Couleur de remplissage</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={fillColor} disabled={noFill}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="h-9 w-full rounded border border-slate-300 cursor-pointer disabled:opacity-50" />
                </div>
                <label className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={noFill} onChange={(e) => setNoFill(e.target.checked)} />
                  Sans remplissage
                </label>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Texte interne (facultatif)</p>
            <Input label="Texte" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Texte à afficher dans la forme" />
            <div className="grid grid-cols-4 gap-3 mt-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Couleur</label>
                <input type="color" value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="h-9 w-full rounded border border-slate-300 cursor-pointer" />
              </div>
              <Input label="Taille (px)" type="number" min={6} max={96} value={textSize}
                onChange={(e) => setTextSize(Math.max(6, Number(e.target.value) || 0))} />
              <Select label="Alignement" options={TEXT_ALIGN_OPTIONS} value={textAlign}
                onChange={(e) => setTextAlign(e.target.value as 'left' | 'center' | 'right')} />
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer h-9">
                <input type="checkbox" checked={textBold} onChange={(e) => setTextBold(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                Gras
              </label>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Image interne (facultatif)</p>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center px-3 py-1.5 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer">
                Choisir un fichier
                <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
              </label>
              {imageDataUrl && (
                <>
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">{imageName}</span>
                  <button type="button"
                    onClick={() => { setImageDataUrl(undefined); setImageName(''); }}
                    className="text-xs text-red-600 hover:underline">
                    Retirer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
