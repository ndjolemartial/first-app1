import { LogOut, User as UserIcon, ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useNavHistory } from '../../hooks/useNavHistory';
import { toast } from '../ui/Toast';
import Button from '../ui/Button';

interface TopBarProps {
  title?: string;
  children?: React.ReactNode;
}

export default function TopBar({ title, children }: TopBarProps) {
  const { user, token, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const { canGoBack, canGoForward, goBack, goForward } = useNavHistory();

  const handleLogout = async () => {
    if (token) {
      await window.electron.auth.logout(token);
    }
    clearAuth();
    toast.success('Déconnexion réussie');
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        {/* Navigation historique (visibles seulement quand utilisables). */}
        {(canGoBack || canGoForward) && (
          <div className="flex items-center gap-1">
            {canGoBack && (
              <button
                type="button"
                onClick={goBack}
                title="Retour à la page précédente"
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            {canGoForward && (
              <button
                type="button"
                onClick={goForward}
                title="Aller à la page suivante"
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        {title && <h1 className="text-lg font-semibold text-slate-900">{title}</h1>}
        {children}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 transition-colors"
          title="Mon profil"
        >
          <UserIcon className="h-4 w-4 text-slate-500" />
          <span className="text-sm text-slate-700 hidden md:block">
            {user?.firstName} {user?.lastName}
          </span>
        </button>
        <Button variant="ghost" size="sm" onClick={handleLogout} icon={<LogOut className="h-4 w-4" />}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
