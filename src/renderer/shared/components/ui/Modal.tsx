import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /**
   * Taille de la modale.
   * - sm / md / lg / xl : centrée sur l'écran, largeur bornée.
   * - content : occupe toute la zone de contenu (hors sidebar de 240px),
   *   superposée à la partie blanche du tableau de bord.
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'content';
  footer?: React.ReactNode;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const isContent = size === 'content';

  return (
    <div
      ref={overlayRef}
      className={clsx(
        'fixed z-50 bg-black/50',
        // Mode 'content' : commence après la sidebar (w-60 = 240px) pour
        // ne couvrir que la zone blanche du dashboard.
        isContent
          ? 'top-0 right-0 bottom-0 left-60 flex items-stretch justify-stretch p-0'
          : 'inset-0 flex items-center justify-center p-4',
      )}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={clsx(
          'bg-white shadow-xl w-full flex flex-col',
          isContent
            ? 'h-full max-h-full rounded-none'
            : clsx('rounded-xl max-h-[90vh]', sizes[size]),
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}
