import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Heading1, Heading2, Pilcrow,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Braces,
  Baseline, Highlighter, Image as ImageIcon, SquarePlus,
} from 'lucide-react';

interface VariableItem {
  token: string;
  label: string;
}
interface VariableGroup {
  group: string;
  items: VariableItem[];
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Variables dynamiques insérables ; si absent, le bouton « Variables » est masqué. */
  variables?: VariableGroup[];
  placeholder?: string;
  minHeight?: number;
}

const FONT_SIZES = [
  { value: '', label: 'Taille' },
  { value: '2', label: 'Petit' },
  { value: '3', label: 'Normal' },
  { value: '4', label: 'Moyen' },
  { value: '5', label: 'Grand' },
  { value: '6', label: 'Très grand' },
  { value: '7', label: 'Énorme' },
];

/**
 * Éditeur de texte enrichi intégré (sans dépendance externe).
 * Mise en forme, titres, listes, alignement, couleurs, taille, images,
 * encadrés et insertion de variables dynamiques.
 */
export default function RichTextEditor({
  value, onChange, variables, placeholder, minHeight = 220,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const varsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [showVars, setShowVars] = useState(false);

  // Synchronise le contenu si la valeur change depuis l'extérieur (ex. chargement en édition).
  useEffect(() => {
    const el = editorRef.current;
    if (el && document.activeElement !== el && el.innerHTML !== (value ?? '')) {
      el.innerHTML = value ?? '';
    }
  }, [value]);

  // Ferme le panneau des variables au clic à l'extérieur.
  useEffect(() => {
    if (!showVars) return;
    const onDown = (e: MouseEvent) => {
      if (varsRef.current && !varsRef.current.contains(e.target as Node)) setShowVars(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showVars]);

  const emitChange = () => onChange(editorRef.current?.innerHTML ?? '');

  /** Mémorise la sélection courante de l'éditeur. */
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (editorRef.current?.contains(r.commonAncestorContainer)) {
        savedRange.current = r.cloneRange();
      }
    }
  };

  /** Restaure la sélection mémorisée (après usage d'un champ couleur / sélecteur de fichier). */
  const restoreSelection = () => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  /** Commande appliquée à la sélection vivante (boutons de la barre d'outils). */
  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, arg);
    emitChange();
  };

  /** Commande appliquée après restauration de la sélection (couleurs, taille, image). */
  const execRestored = (command: string, arg?: string) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, arg);
    emitChange();
  };

  const insertVariable = (token: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, `{{${token}}}`);
    emitChange();
    setShowVars(false);
  };

  const insertBox = () => {
    editorRef.current?.focus();
    document.execCommand(
      'insertHTML',
      false,
      '<div style="border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:10px;margin:10px 0">'
        + "Saisissez le texte de l'encadré…</div><p><br></p>",
    );
    emitChange();
  };

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
      if (typeof reader.result === 'string') execRestored('insertImage', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const Btn = ({ onClick, title, children }: {
    onClick: () => void; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="h-8 w-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 transition-colors"
    >
      {children}
    </button>
  );

  const Sep = () => <div className="h-5 w-px bg-slate-300 mx-1" />;

  return (
    <div className="border border-slate-300 rounded-lg">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <Btn title="Gras" onClick={() => exec('bold')}><Bold className="h-4 w-4" /></Btn>
        <Btn title="Italique" onClick={() => exec('italic')}><Italic className="h-4 w-4" /></Btn>
        <Btn title="Souligné" onClick={() => exec('underline')}><Underline className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Titre 1" onClick={() => exec('formatBlock', '<h1>')}><Heading1 className="h-4 w-4" /></Btn>
        <Btn title="Titre 2" onClick={() => exec('formatBlock', '<h2>')}><Heading2 className="h-4 w-4" /></Btn>
        <Btn title="Paragraphe" onClick={() => exec('formatBlock', '<p>')}><Pilcrow className="h-4 w-4" /></Btn>
        <select
          title="Taille du texte"
          value=""
          onMouseDown={saveSelection}
          onChange={(e) => { if (e.target.value) execRestored('fontSize', e.target.value); }}
          className="h-8 text-xs text-slate-600 bg-transparent border border-slate-200 rounded px-1"
        >
          {FONT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <Sep />
        <Btn title="Liste à puces" onClick={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></Btn>
        <Btn title="Liste numérotée" onClick={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Aligner à gauche" onClick={() => exec('justifyLeft')}><AlignLeft className="h-4 w-4" /></Btn>
        <Btn title="Centrer" onClick={() => exec('justifyCenter')}><AlignCenter className="h-4 w-4" /></Btn>
        <Btn title="Aligner à droite" onClick={() => exec('justifyRight')}><AlignRight className="h-4 w-4" /></Btn>
        <Sep />
        <label
          title="Couleur du texte"
          onMouseDown={saveSelection}
          className="h-8 px-1 flex items-center gap-0.5 rounded text-slate-600 hover:bg-slate-200 cursor-pointer"
        >
          <Baseline className="h-4 w-4" />
          <input
            type="color"
            defaultValue="#1e293b"
            onChange={(e) => execRestored('foreColor', e.target.value)}
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
        <label
          title="Couleur de fond (surlignage)"
          onMouseDown={saveSelection}
          className="h-8 px-1 flex items-center gap-0.5 rounded text-slate-600 hover:bg-slate-200 cursor-pointer"
        >
          <Highlighter className="h-4 w-4" />
          <input
            type="color"
            defaultValue="#fde68a"
            onChange={(e) => execRestored('hiliteColor', e.target.value)}
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
        <Sep />
        <Btn title="Insérer une image" onClick={() => { saveSelection(); fileRef.current?.click(); }}>
          <ImageIcon className="h-4 w-4" />
        </Btn>
        <Btn title="Insérer un encadré" onClick={insertBox}><SquarePlus className="h-4 w-4" /></Btn>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />

        {variables && variables.length > 0 && (
          <>
            <Sep />
            <div className="relative" ref={varsRef}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowVars((v) => !v)}
                className="h-8 flex items-center gap-1 px-2 rounded text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Braces className="h-4 w-4" /> Variables
              </button>
              {showVars && (
                <div className="absolute left-0 z-30 mt-1 w-80 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg p-2">
                  {variables.map((g) => (
                    <div key={g.group} className="mb-2 last:mb-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase px-1.5 mb-0.5">{g.group}</p>
                      {g.items.map((it) => (
                        <button
                          key={it.token}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertVariable(it.token)}
                          className="flex w-full items-center justify-between gap-2 text-left text-sm px-1.5 py-1 rounded hover:bg-blue-50"
                        >
                          <span className="text-slate-700">{it.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{`{{${it.token}}}`}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        data-placeholder={placeholder ?? ''}
        style={{ minHeight }}
        className="p-3 text-sm text-slate-800 leading-relaxed focus:outline-none overflow-y-auto
          [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2
          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2
          [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
          [&_p]:my-1 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
      />
    </div>
  );
}
