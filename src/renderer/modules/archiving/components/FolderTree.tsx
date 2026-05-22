import { useState } from 'react';
import { clsx } from 'clsx';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Files } from 'lucide-react';

export interface RawFolder {
  id: number;
  name: string;
  parentId: number | null;
  _count?: { documents: number };
}

interface FolderNode extends RawFolder {
  children: FolderNode[];
}

function buildTree(flat: RawFolder[]): FolderNode[] {
  const map = new Map<number, FolderNode>();
  flat.forEach((f) => map.set(f.id, { ...f, children: [] }));
  const roots: FolderNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node);
    else roots.push(node);
  });
  return roots;
}

interface FolderTreeProps {
  folders: RawFolder[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

/** Arborescence de dossiers documentaires avec sélection pour le filtrage. */
export default function FolderTree({ folders, selectedId, onSelect }: FolderTreeProps) {
  const tree = buildTree(folders);
  const [expanded, setExpanded] = useState<Set<number>>(new Set(folders.map((f) => f.id)));

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const renderNode = (node: FolderNode, depth: number) => {
    const isOpen = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedId === node.id;
    return (
      <div key={node.id}>
        <div
          className={clsx(
            'flex items-center gap-1 rounded-md px-1.5 py-1 text-sm cursor-pointer',
            isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50',
          )}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => onSelect(node.id)}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
              className="text-slate-400 hover:text-slate-600"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}
          {isSelected || isOpen ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
          <span className="truncate flex-1">{node.name}</span>
          {node._count && <span className="text-xs text-slate-400">{node._count.documents}</span>}
        </div>
        {hasChildren && isOpen && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      <div
        className={clsx(
          'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm cursor-pointer',
          selectedId === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50',
        )}
        onClick={() => onSelect(null)}
      >
        <Files className="h-4 w-4" />
        <span>Tous les documents</span>
      </div>
      {tree.map((n) => renderNode(n, 0))}
      {folders.length === 0 && (
        <p className="px-2 py-3 text-xs text-slate-400">Aucun dossier. Créez-en dans « Organisation ».</p>
      )}
    </div>
  );
}
