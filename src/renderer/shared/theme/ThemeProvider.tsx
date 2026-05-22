import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { applyTheme, normalizeTheme } from './themes';

/**
 * Applique sur <html> l'attribut `data-theme` correspondant à la préférence de
 * l'utilisateur connecté (ou DEFAULT à défaut). Met à jour le DOM dès que la
 * valeur change dans le store d'authentification.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAuthStore((s) => s.user?.theme);

  useEffect(() => {
    applyTheme(normalizeTheme(theme));
  }, [theme]);

  return <>{children}</>;
}
