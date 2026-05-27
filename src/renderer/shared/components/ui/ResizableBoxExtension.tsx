import { useEffect, useRef } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';

/**
 * NodeView React de la zone de texte redimensionnable.
 *
 * - Utilise la propriété CSS native `resize: both` pour offrir une poignée
 *   en bas-droite que l'utilisateur peut tirer pour redimensionner.
 * - Un `ResizeObserver` capture les nouvelles dimensions et les pousse dans
 *   les attributs du node TipTap (`width` / `height`), pour qu'elles soient
 *   persistées dans le HTML sauvegardé.
 */
function ResizableBoxNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width  = (node.attrs.width  as string) || '300px';
  const height = (node.attrs.height as string) || '120px';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const observer = new ResizeObserver(() => {
      // Diffère d'une frame pour éviter le warning « ResizeObserver loop
      // completed with undelivered notifications » : la mise à jour des
      // attrs TipTap re-rendre la div, ce qui re-déclencherait l'observer
      // dans la même tâche synchrone.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!ref.current) return;
        const w = ref.current.style.width  || `${ref.current.offsetWidth}px`;
        const h = ref.current.style.height || `${ref.current.offsetHeight}px`;
        if (w && w !== node.attrs.width)  updateAttributes({ width: w });
        if (h && h !== node.attrs.height) updateAttributes({ height: h });
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [node.attrs.width, node.attrs.height, updateAttributes]);

  return (
    <NodeViewWrapper as="div" className="resizable-box-wrapper">
      <div
        ref={ref}
        style={{
          background: '#ffffff',
          border: 'none',
          // Outline pointillé visible uniquement dans l'éditeur — n'apparaît
          // pas dans le HTML exporté (PDF / Word) ; n'affecte pas la mise en
          // page car `outline` n'occupe pas d'espace contrairement à `border`.
          outline: editor.isEditable ? '1px dashed #cbd5e1' : 'none',
          outlineOffset: -1,
          padding: 6,
          width,
          height,
          minWidth: 100,
          minHeight: 40,
          resize: editor.isEditable ? 'both' : 'none',
          overflow: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}

/**
 * Extension TipTap : block container redimensionnable.
 *
 * Le HTML sérialisé est un simple `<div data-type="resizable-box" style="…">`
 * avec `width` / `height` en inline-style → le rendu PDF et Word respecte
 * automatiquement la taille fixée par l'utilisateur dans l'éditeur.
 */
export const ResizableBox = Node.create({
  name: 'resizableBox',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      width:  { default: '300px' },
      height: { default: '120px' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="resizable-box"]',
        getAttrs: (el) => {
          const e = el as HTMLElement;
          return {
            width:  e.style.width  || '300px',
            height: e.style.height || '120px',
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const w = (node.attrs.width  as string) || '300px';
    const h = (node.attrs.height as string) || '120px';
    // Dimensions verrouillées dans l'export (PDF / Word) : `flex:0 0 <w>` +
    // `min/max-width/height` empêchent toute adaptation au contenu ou au
    // conteneur. `overflow:hidden` clippe le surplus (le défilement n'a pas
    // de sens à l'impression).
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'resizable-box',
        style:
          `background:#ffffff;border:none;padding:6px;`
          + `width:${w};min-width:${w};max-width:${w};`
          + `height:${h};min-height:${h};max-height:${h};`
          + `flex:0 0 ${w};overflow:hidden;box-sizing:border-box;`,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableBoxNodeView);
  },
});

/**
 * Conteneur horizontal de zones de texte redimensionnables. Sa raison d'être :
 * ProseMirror raisonne en blocs verticalement empilés. Pour autoriser le
 * curseur à se positionner *entre* deux zones côte-à-côte, on les enferme
 * dans un parent `flex` reconnu comme une ligne par ProseMirror.
 */
export const ResizableRow = Node.create({
  name: 'resizableRow',
  group: 'block',
  content: 'resizableBox+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="resizable-row"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'resizable-row',
        style:
          'display:flex;align-items:flex-start;flex-wrap:wrap;gap:6px;'
          + 'margin:6px 0;',
      }),
      0,
    ];
  },
});
