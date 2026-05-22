import { useEffect, useRef, useState } from 'react';
import { Save, Upload, Trash2, ArrowUp, ArrowDown, Film, ImageIcon } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { useSlideshowSettings, useUpdateSlideshow, useUploadSlideshowMedia } from '../hooks/useSettings';
import { useAuthStore } from '../../../shared/stores/auth.store';

interface SlideItem {
  type:       'image' | 'video';
  src:        string;
  caption?:   string;
  durationMs?: number;
}

const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
];
const MAX_MB = 50;

/** Composant d'aperçu d'un média stocké localement (chargement base64 via IPC). */
function MediaPreview({ item }: { item: SlideItem }) {
  const token = useAuthStore((s) => s.token)!;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (item.src.startsWith('http://') || item.src.startsWith('https://') || item.src.startsWith('data:')) {
      setSrc(item.src);
      return;
    }
    if (item.src.startsWith('slideshow/')) {
      window.electron.settings.getSlideshowMediaData(token, item.src).then((r) => {
        if (cancelled) return;
        if (r.success && r.data) setSrc(`data:${r.data.mimeType};base64,${r.data.base64}`);
      });
    }
    return () => { cancelled = true; };
  }, [item.src, token]);

  if (!src) return <div className="h-16 w-24 bg-slate-100 rounded animate-pulse" />;
  return item.type === 'video'
    ? <video src={src} className="h-16 w-24 object-cover rounded" muted />
    : <img src={src} className="h-16 w-24 object-cover rounded" alt={item.caption ?? ''} />;
}

export default function SlideshowSettingsTab() {
  const { data: res, isLoading } = useSlideshowSettings();
  const update = useUpdateSlideshow();
  const upload = useUploadSlideshowMedia();
  const [items, setItems] = useState<SlideItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (res?.success && Array.isArray(res.data)) setItems(res.data as SlideItem[]);
  }, [res]);

  async function handleAddFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Format non accepté (PNG/JPEG/WEBP/GIF ou MP4/WEBM/MOV).');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${MAX_MB} Mo).`);
      return;
    }
    const fileData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const r = await upload.mutateAsync({
      fileName: file.name, fileType: file.type, fileSize: file.size, fileData,
    });
    if (r.success && r.data) {
      setItems((prev) => [
        ...prev,
        { type: r.data!.type, src: r.data!.relativePath, caption: '', durationMs: 6000 },
      ]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function patchItem(idx: number, patch: Partial<SlideItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  if (isLoading) return <Card>Chargement…</Card>;

  return (
    <div className="space-y-4">
      {/* Spécifications recommandées pour les médias du slideshow */}
      <Card>
        <h3 className="font-semibold text-slate-700 mb-3">Tailles recommandées</h3>
        <p className="text-sm text-slate-600 mb-4">
          Le slide du tableau de bord utilise un <strong>ratio 21:9</strong> (panoramique).
          Les médias hors ratio sont automatiquement recadrés pour remplir la zone.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Images</p>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>• Dimensions recommandées : <strong>1920 × 824 pixels</strong> (HD 21:9)</li>
              <li>• Idéal pour grand écran : <strong>2560 × 1080 pixels</strong></li>
              <li>• Formats : PNG, JPEG, WEBP, GIF</li>
              <li>• Poids maximum : 50 Mo</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Vidéos</p>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>• Dimensions recommandées : <strong>1920 × 824 pixels</strong> (HD 21:9)</li>
              <li>• Formats : MP4, WEBM, MOV (codec H.264 recommandé)</li>
              <li>• Durée conseillée : <strong>10 à 30 secondes</strong></li>
              <li>• Poids maximum : 50 Mo</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Pour une lecture nette, privilégiez les images d'au moins <strong>1500 pixels de large</strong>
          et exportez les vidéos en H.264 / AAC.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700">Slides du tableau de bord</h3>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov"
              className="hidden"
              onChange={handleAddFile}
            />
            <Button
              variant="secondary"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => fileInputRef.current?.click()}
              loading={upload.isPending}
            >
              Ajouter un média
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun slide. Cliquez sur « Ajouter un média » pour téléverser une image ou une vidéo.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it, idx) => (
              <li key={`${it.src}-${idx}`} className="flex items-start gap-4 border border-slate-200 rounded-lg p-3">
                <MediaPreview item={it} />
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Input
                      label="Légende"
                      value={it.caption ?? ''}
                      onChange={(e) => patchItem(idx, { caption: e.target.value })}
                    />
                  </div>
                  <Input
                    label="Durée (ms)"
                    type="number"
                    min="1000"
                    value={it.durationMs ?? 6000}
                    onChange={(e) => patchItem(idx, { durationMs: Number(e.target.value) || undefined })}
                  />
                  <p className="text-xs text-slate-500 col-span-3 -mt-2 flex items-center gap-1">
                    {it.type === 'video' ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                    <span className="font-mono truncate">{it.src}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" icon={<ArrowUp className="h-4 w-4" />}
                    onClick={() => moveItem(idx, -1)} disabled={idx === 0} />
                  <Button variant="ghost" size="sm" icon={<ArrowDown className="h-4 w-4" />}
                    onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} />
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />}
                    onClick={() => removeItem(idx)} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-4">
          <Button
            icon={<Save className="h-4 w-4" />}
            loading={update.isPending}
            onClick={() => update.mutate(items.map((it) => ({
              type: it.type,
              src:  it.src,
              caption: it.caption ?? '',
              durationMs: it.durationMs ?? 6000,
            })))}
          >
            Enregistrer le slideshow
          </Button>
        </div>
      </Card>

      <Card>
        <p className="text-xs text-slate-500">
          Les médias téléversés sont copiés dans le dossier de stockage (sous-dossier <code>slideshow/</code>).
          Les éléments retirés du slideshow et enregistrés sont supprimés physiquement.
        </p>
      </Card>
    </div>
  );
}
