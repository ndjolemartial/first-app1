import TopBar from './TopBar';
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useZoom, ZOOM_MIN, ZOOM_MAX } from '../../hooks/useZoom';

interface Breadcrumb {
  label: string;
  to?: string;
}

interface PageLayoutProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function PageLayout({ title, breadcrumbs, actions, children }: PageLayoutProps) {
  const { zoom, zoomIn, zoomOut, reset, handlers } = useZoom();

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <TopBar>
        <div className="flex flex-col">
          {breadcrumbs && (
            <nav className="flex items-center gap-1 text-xs text-slate-400">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  {crumb.to ? (
                    <Link to={crumb.to} className="hover:text-blue-600 transition-colors">{crumb.label}</Link>
                  ) : (
                    <span className="text-slate-600">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-base font-semibold text-slate-900 leading-tight">{title}</h1>
        </div>
      </TopBar>
      {/* Le zoom englobe la barre d'actions ET le contenu — tout ce qui suit
          la TopBar pour éviter qu'une action « Nouveau / Importer » reste à
          100% pendant que la liste passe à 130%. */}
      <div
        className="flex-1 flex flex-col overflow-auto origin-top-left"
        style={{ zoom, touchAction: 'pan-x pan-y' }}
        {...handlers}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div />
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
        <main className="flex-1 px-6 pb-6">
          {children}
        </main>
      </div>

      {/* ── Contrôles de zoom (flottants, bas-droite) ───────────────────── */}
      <div className="fixed bottom-6 right-6 z-30 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-lg">
        <button
          type="button"
          aria-label="Zoom arrière"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-[44px] text-center text-xs font-medium tabular-nums text-slate-600">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom avant"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        {zoom !== 1 && (
          <button
            type="button"
            aria-label="Réinitialiser le zoom"
            onClick={reset}
            className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 transition"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
