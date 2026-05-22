import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { clsx } from 'clsx';

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

export default function DashboardSlideshow({ items, className }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);

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
    if (current.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      if (!paused) videoRef.current.play().catch(() => undefined);
    }
  }, [current, paused]);

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
          {item.type === 'image' ? (
            <img
              src={item.src}
              alt={item.caption ?? ''}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <video
              ref={i === index ? videoRef : undefined}
              src={item.src}
              className="h-full w-full object-cover"
              muted
              playsInline
              onEnded={next}
            />
          )}
          {item.caption && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6">
              <p className="text-white text-lg font-medium leading-snug drop-shadow">
                {item.caption}
              </p>
            </div>
          )}
        </div>
      ))}

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
