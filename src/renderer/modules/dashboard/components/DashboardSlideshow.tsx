import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../../shared/stores/auth.store';

export interface SlideshowItem {
  type: 'image' | 'video';
  src: string;
  caption?: string;
  durationMs?: number;
}

interface Props {
  items: SlideshowItem[];
  className?: string;
}

const DEFAULT_DURATION = 6000;

/** Une URL directement chargeable par le renderer (pas un chemin de stockage local). */
function isDirectSrc(src: string): boolean {
  return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:');
}

export default function DashboardSlideshow({ items, className }: Props) {
  const token = useAuthStore((s) => s.token);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Vidéos mutées par défaut (lecture auto non intrusive) ; bouton pour activer
  // le son. Une fois l'utilisateur ayant activé le son, l'état persiste d'une
  // vidéo à l'autre du slideshow.
  const [muted, setMuted] = useState(true);
  // Références vers toutes les vidéos rendues (par index) : permet de lire la
  // vidéo courante (avec son) et de mettre les autres en pause.
  const videosRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const timerRef = useRef<number | null>(null);
  // Les médias téléversés sont stockés sous un chemin relatif `slideshow/…` que le
  // renderer ne peut pas charger directement. On les résout en `data:` URL via IPC
  // (même mécanisme que l'aperçu des réglages). Cache par chemin source.
  const [resolved, setResolved] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const toLoad = items.filter((it) => it.src && !isDirectSrc(it.src) && !resolved[it.src]);
    if (toLoad.length === 0) return;
    Promise.all(
      toLoad.map(async (it) => {
        try {
          const r = await window.electron.settings.getSlideshowMediaData(token, it.src);
          if (r.success && r.data) {
            return [it.src, `data:${r.data.mimeType};base64,${r.data.base64}`] as const;
          }
        } catch {
          /* média introuvable — ignoré, slide vide */
        }
        return null;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const p of pairs) if (p) next[p[0]] = p[1];
      if (Object.keys(next).length > 0) setResolved((prev) => ({ ...prev, ...next }));
    });
    return () => { cancelled = true; };
  }, [items, token, resolved]);

  /** URL effective d'un média : directe, ou résolue depuis le stockage local. */
  const srcOf = (item: SlideshowItem): string =>
    isDirectSrc(item.src) ? item.src : (resolved[item.src] ?? '');

  const safeItems = items.length > 0 ? items : [{ type: 'image' as const, src: '', caption: 'Aucun contenu' }];
  const current = safeItems[index];

  const goTo = (i: number) => setIndex(((i % safeItems.length) + safeItems.length) % safeItems.length);
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  useEffect(() => {
    if (paused || safeItems.length <= 1) return;
    if (current.type === 'video') return; // la vidéo enchaîne via onEnded
    const duration = current.durationMs ?? DEFAULT_DURATION;
    timerRef.current = window.setTimeout(next, duration);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [index, paused, current, safeItems.length]);

  useEffect(() => {
    // Lit la vidéo courante (avec son) et met les autres en pause pour éviter
    // qu'une vidéo quittée continue de jouer son audio en arrière-plan.
    // `resolved` : relance la lecture une fois la vidéo locale chargée (data URL).
    videosRef.current.forEach((video, i) => {
      if (i === index) {
        video.currentTime = 0;
        if (!paused) video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [index, paused, resolved]);

  if (safeItems.length === 0) return null;

  return (
    <div
      className={clsx(
        'relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm',
        className,
      )}
      style={{ aspectRatio: '21 / 9' }}
    >
      {safeItems.map((item, i) => (
        <div
          key={`${item.src}-${i}`}
          className={clsx(
            'absolute inset-0 transition-opacity duration-700 ease-in-out',
            i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {(() => {
            const effectiveSrc = srcOf(item);
            if (!effectiveSrc) {
              // Média local en cours de résolution (ou introuvable).
              return <div className="h-full w-full animate-pulse bg-slate-800" />;
            }
            return item.type === 'image' ? (
              <img
                src={effectiveSrc}
                alt={item.caption ?? ''}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <video
                ref={(el) => {
                  if (el) videosRef.current.set(i, el);
                  else videosRef.current.delete(i);
                }}
                src={effectiveSrc}
                className="h-full w-full object-cover"
                muted={muted}
                playsInline
                onEnded={next}
              />
            );
          })()}
          {item.caption && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6">
              <p className="text-white text-lg font-medium leading-snug drop-shadow">
                {item.caption}
              </p>
            </div>
          )}
        </div>
      ))}

      {/* Bouton son — visible dès qu'un média vidéo est présent (même slide unique). */}
      {safeItems.some((it) => it.type === 'video') && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
          title={muted ? 'Activer le son' : 'Couper le son'}
          className="absolute left-3 top-3 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {safeItems.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Précédent"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Suivant"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Lire' : 'Pause'}
            className="absolute right-3 top-3 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {safeItems.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Aller à la diapositive ${i + 1}`}
                onClick={() => goTo(i)}
                className={clsx(
                  'h-2 rounded-full transition-all',
                  i === index ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
