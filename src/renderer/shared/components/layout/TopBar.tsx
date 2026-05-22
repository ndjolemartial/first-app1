import { LogOut, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from '../ui/Toast';
import Button from '../ui/Button';

interface TopBarProps {
  title?: string;
  children?: React.ReactNode;
}

export default function TopBar({ title, children }: TopBarProps) {
  const { user, token, clearAuth } = useAuthStore();
  const navigate = useNavigate();

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
