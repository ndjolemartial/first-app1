import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Navigation de type « navigateur » basée sur l'historique de React Router.
 *
 * React Router persiste un index dans `window.history.state.idx` à chaque
 * entrée de pile. On compare cet index courant au plus grand jamais vu pour
 * savoir si un « Suivant » est encore possible. `canGoBack` est simplement
 * `idx > 0`.
 *
 * - `goBack()` / `goForward()` : raccourci vers `navigate(-1)` / `navigate(1)`.
 * - `canGoBack` / `canGoForward` : selon la position dans la pile.
 *
 * Le hook se met à jour à chaque changement de location et aux événements
 * `popstate` (boutons matériels / raccourcis Alt+Flèche, etc.).
 */
export function useNavHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const [idx, setIdx] = useState<number>(() => readIdx());
  const [maxIdx, setMaxIdx] = useState<number>(() => readIdx());

  // Met à jour l'index à chaque navigation React Router.
  useEffect(() => {
    const current = readIdx();
    setIdx(current);
    setMaxIdx((m) => Math.max(m, current));
  }, [location.key]);

  // Synchronise aussi sur les `popstate` natifs (avant/après bouton souris).
  useEffect(() => {
    const onPop = () => {
      const current = readIdx();
      setIdx(current);
      setMaxIdx((m) => Math.max(m, current));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return {
    canGoBack: idx > 0,
    canGoForward: idx < maxIdx,
    goBack: () => navigate(-1),
    goForward: () => navigate(1),
  };
}

/** Lit l'index courant dans l'état d'historique HTML5 (alimenté par React Router). */
function readIdx(): number {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' ? state.idx : 0;
}
