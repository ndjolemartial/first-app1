import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { toast } from '../components/ui/Toast';

/** Délai d'inactivité avant déconnexion automatique (5 minutes). */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** Fréquence de vérification de l'inactivité. */
const CHECK_INTERVAL_MS = 30 * 1000;

/** Libellé lisible du délai d'inactivité, pour le message de déconnexion. */
const IDLE_TIMEOUT_LABEL =
  IDLE_TIMEOUT_MS >= 60_000
    ? `${Math.round(IDLE_TIMEOUT_MS / 60_000)} minutes`
    : `${Math.round(IDLE_TIMEOUT_MS / 1000)} secondes`;

/**
 * Événements considérés comme une activité de l'utilisateur. Toute occurrence
 * réarme le compteur d'inactivité.
 */
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
  'click',
];

/**
 * Déconnecte automatiquement l'utilisateur après {@link IDLE_TIMEOUT_MS} d'inactivité.
 *
 * À monter dans le shell authentifié (`App`) : dès que la session est fermée
 * (`clearAuth`), le shell redirige vers `/login`. La session côté processus
 * principal est également invalidée (`auth.logout`).
 *
 * L'inactivité est mesurée par l'horodatage de la dernière interaction ; un
 * intervalle vérifie périodiquement le délai écoulé (robuste et sans réarmement
 * d'un `setTimeout` à chaque mouvement de souris).
 */
export function useIdleLogout(): void {
  const lastActivityRef = useRef<number>(Date.now());
  // Empêche des déconnexions concurrentes si un cycle est déjà en cours.
  const loggingOutRef = useRef(false);

  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, markActivity, { capture: true, passive: true }),
    );

    const interval = window.setInterval(async () => {
      if (loggingOutRef.current) return;
      if (Date.now() - lastActivityRef.current < IDLE_TIMEOUT_MS) return;

      const { token, isAuthenticated, clearAuth } = useAuthStore.getState();
      if (!isAuthenticated) return;

      loggingOutRef.current = true;
      try {
        if (token) await window.electron.auth.logout(token);
      } catch {
        // La session locale est fermée quoi qu'il arrive côté serveur.
      }
      clearAuth();
      toast.warning(`Session fermée automatiquement après ${IDLE_TIMEOUT_LABEL} d'inactivité`);
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, markActivity, { capture: true }),
      );
      window.clearInterval(interval);
    };
  }, []);
}
