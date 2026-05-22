import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from './shared/stores/auth.store';
import ThemeProvider from './shared/theme/ThemeProvider';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [checking, setChecking] = useState(true);

  // Les sessions sont conservées en mémoire dans le processus principal : elles
  // sont perdues à chaque redémarrage de l'application. Le jeton persisté côté
  // navigateur est donc revalidé au démarrage — s'il n'est plus reconnu,
  // l'utilisateur est déconnecté pour se reconnecter et obtenir un jeton valide.
  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) {
      setChecking(false);
      return;
    }
    window.electron.auth
      .me(token)
      .then((r) => {
        if (r.success && r.data) setAuth(r.data, token);
        else clearAuth();
      })
      .catch(() => clearAuth())
      .finally(() => setChecking(false));
  }, [setAuth, clearAuth]);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Chargement…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}
