import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook de zoom pour pages — accessibilité / lisibilité sur grands écrans.
 *
 * Sources d'entrée prises en charge :
 *   - Ctrl+molette (souris classique)
 *   - Pinch trackpad (Chromium remonte ces gestes comme `wheel` avec `ctrlKey=true`)
 *   - Pinch tactile à deux doigts (touchstart/touchmove/touchend)
 *
 * État partagé entre toutes les pages via `localStorage` (clé `app.zoom`). Bornes
 * configurables, restauration à la prochaine montée du composant.
 */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 0.1;
const ZOOM_STORAGE_KEY = 'app.zoom';

export const clampZoom = (z: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

export interface ZoomHandlers {
  onWheel:      (e: React.WheelEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove:  (e: React.TouchEvent) => void;
  onTouchEnd:   () => void;
}

export interface ZoomState {
  zoom:    number;
  setZoom: (z: number) => void;
  zoomIn:  () => void;
  zoomOut: () => void;
  reset:   () => void;
  handlers: ZoomHandlers;
}

export function useZoom(): ZoomState {
  const [zoom, setZoomRaw] = useState<number>(() => {
    const stored = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? clampZoom(stored) : 1;
  });

  useEffect(() => {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
  }, [zoom]);

  const setZoom = useCallback((z: number) => setZoomRaw(clampZoom(z)), []);
  const zoomIn  = useCallback(() => setZoomRaw((z) => clampZoom(z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoomRaw((z) => clampZoom(z - ZOOM_STEP)), []);
  const reset   = useCallback(() => setZoomRaw(1), []);

  /**
   * Distance initiale entre les deux doigts d'un geste de pinch tactile +
   * facteur de zoom à cet instant. Permet de recalculer un facteur absolu à
   * chaque `touchmove` plutôt que des deltas qui dériveraient.
   */
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey) return;  // molette simple = scroll normal
    e.preventDefault();
    setZoomRaw((z) => clampZoom(z - e.deltaY * 0.005));
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: zoom };
    }
  }, [zoom]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.startDist;
      setZoomRaw(clampZoom(pinchRef.current.startZoom * ratio));
    }
  }, []);

  const onTouchEnd = useCallback(() => { pinchRef.current = null; }, []);

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    reset,
    handlers: { onWheel, onTouchStart, onTouchMove, onTouchEnd },
  };
}
