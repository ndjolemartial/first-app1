import TopBar from './TopBar';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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
      <div className="flex items-center justify-between px-6 py-4">
        <div />
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
      <main className="flex-1 overflow-y-auto px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
