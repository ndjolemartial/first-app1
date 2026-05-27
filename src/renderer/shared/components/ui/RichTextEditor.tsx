import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Pilcrow,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify, Braces,
  Baseline, Highlighter, Image as ImageIcon, SquarePlus, Shapes, Link as LinkIcon,
  GitBranch, MoveDiagonal2, CornerDownLeft,
} from 'lucide-react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import FontFamily from '@tiptap/extension-font-family';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import ShapeInsertDialog from './ShapeInsertDialog';
import ConditionInsertDialog from './ConditionInsertDialog';
import { ResizableBox, ResizableRow } from './ResizableBoxExtension';

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

/** Tailles de police disponibles dans le sélecteur. */
const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '32pt', '36pt', '48pt'];

/** Familles de police disponibles. */
const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: 'Segoe UI',         value: "'Segoe UI', Arial, sans-serif" },
  { label: 'Arial',            value: 'Arial, sans-serif' },
  { label: 'Calibri',          value: 'Calibri, sans-serif' },
  { label: 'Verdana',          value: 'Verdana, sans-serif' },
  { label: 'Tahoma',           value: 'Tahoma, sans-serif' },
  { label: 'Times New Roman',  value: "'Times New Roman', Times, serif" },
  { label: 'Georgia',          value: 'Georgia, serif' },
  { label: 'Garamond',         value: 'Garamond, serif' },
  { label: 'Courier New',      value: "'Courier New', Courier, monospace" },
  { label: 'Consolas',         value: 'Consolas, monospace' },
];

/**
 * Extension TipTap qui ajoute un attribut `fontSize` au mark TextStyle.
 * Sérialise / parse via `style="font-size: Xpt"` pour rester compatible avec
 * le HTML produit par les éditeurs WYSIWYG classiques.
 */
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types as string[],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: { fontSize?: string | null }) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

/**
 * Éditeur de texte enrichi basé sur TipTap (ProseMirror). Produit un HTML
 * propre et sémantique adapté à l'impression PDF, avec sélecteurs de police,
 * couleurs, alignement, listes, images et insertion de variables dynamiques.
 */
export default function RichTextEditor({
  value, onChange, variables, placeholder, minHeight = 220,
}: RichTextEditorProps) {
  const varsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showVars, setShowVars] = useState(false);
  const [showShape, setShowShape] = useState(false);
  const [showCondition, setShowCondition] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'max-w-full h-auto' } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      ResizableBox,
      ResizableRow,
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: 'tiptap-content p-3 text-sm text-slate-800 leading-relaxed focus:outline-none overflow-y-auto',
        style: `min-height: ${minHeight}px`,
      },
    },
  });

  // Synchronise la valeur externe (chargement d'un modèle existant).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value ?? '') !== current) editor.commands.setContent(value ?? '', { emitUpdate: false });
  }, [value, editor]);

  // Ferme le panneau des variables au clic à l'extérieur.
  useEffect(() => {
    if (!showVars) return;
    const onDown = (e: MouseEvent) => {
      if (varsRef.current && !varsRef.current.contains(e.target as Node)) setShowVars(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showVars]);

  if (!editor) return <div className="border border-slate-300 rounded-lg h-[260px]" />;

  const insertVariable = (token: string) => {
    editor.chain().focus().insertContent(`{{${token}}}`).run();
    setShowVars(false);
  };

  const insertBox = () => {
    editor.chain().focus().insertContent(
      '<div style="border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:10px;margin:10px 0">Saisissez le texte de l&apos;encadré…</div><p></p>',
    ).run();
  };

  /**
   * Insère une zone de texte redimensionnable.
   *
   * Comportement intelligent :
   *   - Si le curseur se trouve déjà dans une `resizableRow`, ajoute une
   *     nouvelle box à la suite (côte-à-côte avec les zones existantes).
   *   - Sinon, crée une nouvelle ligne `resizableRow` contenant une box.
   */
  const insertResizableBox = () => {
    const newBox = {
      type: 'resizableBox',
      attrs: { width: '300px', height: '120px' },
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Zone de texte — tirez la poignée en bas à droite pour redimensionner.' }],
      }],
    };
    const { $from } = editor.state.selection;
    let rowDepth = -1;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'resizableRow') { rowDepth = d; break; }
    }
    if (rowDepth >= 0) {
      // Ajout à la fin de la ligne courante.
      editor.chain().focus().insertContentAt($from.end(rowDepth), newBox).run();
    } else {
      editor.chain().focus().insertContent({ type: 'resizableRow', content: [newBox] }).run();
    }
  };

  const insertShape = (html: string) => {
    editor.chain().focus().insertContent(html).run();
  };

  /** Insère un bloc de condition `{{#si …}}…{{/si}}` produit par la modale. */
  const insertCondition = (snippet: string) => {
    editor.chain().focus().insertContent(snippet).run();
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
      if (typeof reader.result === 'string') {
        editor.chain().focus().setImage({ src: reader.result }).run();
      }
    };
    reader.readAsDataURL(file);
  };

  const promptLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL du lien (laisser vide pour supprimer)', previous ?? '');
    if (url === null) return; // annulé
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="border border-slate-300 rounded-lg bg-white">
      <Toolbar
        editor={editor}
        onPickImage={() => fileRef.current?.click()}
        onInsertBox={insertBox}
        onInsertResizableBox={insertResizableBox}
        onInsertShape={() => setShowShape(true)}
        onInsertCondition={() => setShowCondition(true)}
        onPromptLink={promptLink}
        onToggleVars={() => setShowVars((v) => !v)}
        showVars={showVars}
        varsRef={varsRef}
        variables={variables}
        onInsertVar={insertVariable}
      />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
      <div className="tiptap-wrapper" data-placeholder={placeholder ?? ''}>
        <EditorContent editor={editor} />
      </div>
      <ShapeInsertDialog
        open={showShape}
        onClose={() => setShowShape(false)}
        onInsert={insertShape}
      />
      <ConditionInsertDialog
        open={showCondition}
        onClose={() => setShowCondition(false)}
        onInsert={insertCondition}
        variables={variables ?? []}
      />
      {/* Styles spécifiques au rendu TipTap dans l'éditeur (placeholder, listes, headings). */}
      <style>{`
        .tiptap-content h1 { font-size: 1.25rem; font-weight: bold; margin: 0.5rem 0; }
        .tiptap-content h2 { font-size: 1.125rem; font-weight: 600; margin: 0.5rem 0; }
        .tiptap-content h3 { font-size: 1rem; font-weight: 600; margin: 0.4rem 0; }
        .tiptap-content p { margin: 0.25rem 0; }
        .tiptap-content ul { list-style: disc; padding-left: 1.5rem; }
        .tiptap-content ol { list-style: decimal; padding-left: 1.5rem; }
        .tiptap-content img { max-width: 100%; height: auto; border-radius: 0.25rem; }
        .tiptap-content a { color: #2563eb; text-decoration: underline; }
        .tiptap-wrapper[data-placeholder] .tiptap-content.is-editor-empty:first-child::before,
        .tiptap-wrapper[data-placeholder] .tiptap-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

interface ToolbarProps {
  editor: Editor;
  onPickImage: () => void;
  onInsertBox: () => void;
  onInsertResizableBox: () => void;
  onInsertShape: () => void;
  onInsertCondition: () => void;
  onPromptLink: () => void;
  onToggleVars: () => void;
  showVars: boolean;
  varsRef: React.RefObject<HTMLDivElement | null>;
  variables?: VariableGroup[];
  onInsertVar: (token: string) => void;
}

function Toolbar({
  editor, onPickImage, onInsertBox, onInsertResizableBox, onInsertShape, onInsertCondition, onPromptLink,
  onToggleVars, showVars, varsRef, variables, onInsertVar,
}: ToolbarProps) {
  /** Retourne `true` si la commande est actuellement active dans la sélection. */
  const isActive = (name: string, attrs?: Record<string, unknown>): boolean =>
    editor.isActive(name, attrs);

  /** Renvoie `true` si l'alignement courant correspond (paragraphe ou titre). */
  const isAlign = (align: 'left' | 'center' | 'right' | 'justify'): boolean =>
    editor.getAttributes('paragraph').textAlign === align
      || editor.getAttributes('heading').textAlign === align;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5 rounded-t-lg">
      {/* Police */}
      <select
        title="Police de caractères"
        value={(editor.getAttributes('textStyle').fontFamily as string) ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        className="h-8 text-xs text-slate-600 bg-white border border-slate-200 rounded px-1 max-w-[110px]"
      >
        <option value="">Police</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
        ))}
      </select>

      {/* Taille */}
      <select
        title="Taille du texte"
        value={(editor.getAttributes('textStyle').fontSize as string) ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setMark('textStyle', { fontSize: v }).run();
          else editor.chain().focus().setMark('textStyle', { fontSize: null }).run();
        }}
        className="h-8 text-xs text-slate-600 bg-white border border-slate-200 rounded px-1"
      >
        <option value="">Taille</option>
        {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <Sep />

      <Btn title="Gras" active={isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Btn>
      <Btn title="Italique" active={isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Btn>
      <Btn title="Souligné" active={isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </Btn>
      <Btn title="Barré" active={isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </Btn>

      <Sep />

      <Btn title="Titre 1" active={isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </Btn>
      <Btn title="Titre 2" active={isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </Btn>
      <Btn title="Paragraphe" active={isActive('paragraph')}
        onClick={() => editor.chain().focus().setParagraph().run()}>
        <Pilcrow className="h-4 w-4" />
      </Btn>
      <Btn title="Saut de ligne (Maj+Entrée)"
        onClick={() => editor.chain().focus().setHardBreak().run()}>
        <CornerDownLeft className="h-4 w-4" />
      </Btn>

      <Sep />

      <Btn title="Liste à puces" active={isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </Btn>
      <Btn title="Liste numérotée" active={isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </Btn>

      <Sep />

      <Btn title="Aligner à gauche" active={isAlign('left')}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft className="h-4 w-4" />
      </Btn>
      <Btn title="Centrer" active={isAlign('center')}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter className="h-4 w-4" />
      </Btn>
      <Btn title="Aligner à droite" active={isAlign('right')}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight className="h-4 w-4" />
      </Btn>
      <Btn title="Justifier" active={isAlign('justify')}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <AlignJustify className="h-4 w-4" />
      </Btn>

      <Sep />

      <label
        title="Couleur du texte"
        className="h-8 px-1 flex items-center gap-0.5 rounded text-slate-600 hover:bg-slate-200 cursor-pointer"
      >
        <Baseline className="h-4 w-4" />
        <input
          type="color"
          defaultValue="#1e293b"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>

      <label
        title="Couleur de fond (surlignage)"
        className="h-8 px-1 flex items-center gap-0.5 rounded text-slate-600 hover:bg-slate-200 cursor-pointer"
      >
        <Highlighter className="h-4 w-4" />
        <input
          type="color"
          defaultValue="#fde68a"
          onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
          className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>

      <Sep />

      <Btn title="Insérer une image" onClick={onPickImage}>
        <ImageIcon className="h-4 w-4" />
      </Btn>
      <Btn title="Insérer un encadré" onClick={onInsertBox}>
        <SquarePlus className="h-4 w-4" />
      </Btn>
      <Btn title="Insérer une zone de texte redimensionnable" onClick={onInsertResizableBox}>
        <MoveDiagonal2 className="h-4 w-4" />
      </Btn>
      <Btn title="Dessiner une forme" onClick={onInsertShape}>
        <Shapes className="h-4 w-4" />
      </Btn>
      <Btn title="Insérer un lien" active={isActive('link')} onClick={onPromptLink}>
        <LinkIcon className="h-4 w-4" />
      </Btn>

      {variables && variables.length > 0 && (
        <Btn title="Insérer une condition" onClick={onInsertCondition}>
          <GitBranch className="h-4 w-4" />
        </Btn>
      )}

      {variables && variables.length > 0 && (
        <>
          <Sep />
          <div className="relative" ref={varsRef}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleVars}
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
                        onClick={() => onInsertVar(it.token)}
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
  );
}

const Sep = () => <div className="h-5 w-px bg-slate-300 mx-1" />;

interface BtnProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}

function Btn({ onClick, title, active, children }: BtnProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 w-8 flex items-center justify-center rounded transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}
