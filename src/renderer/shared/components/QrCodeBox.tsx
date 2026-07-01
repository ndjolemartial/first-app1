import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer } from 'lucide-react';
import Button from './ui/Button';
import { useAuthStore } from '../stores/auth.store';

interface QrModel { label: string; dark: string; light: string; logo: boolean; logoCircle?: boolean; eyeColor?: string; eyeShape?: 'square' | 'circle'; pupilColor?: string }

/** Modèles de QR Code proposés dans les paramètres. */
export const QR_MODELS: Record<string, QrModel> = {
  '1': { label: 'Logo rond + yeux rouges',  dark: '#000000', light: '#ffffff', logo: true,  logoCircle: true, eyeColor: '#dc2626', eyeShape: 'square' },
  '2': { label: 'Logo + yeux ronds rouges', dark: '#0f172a', light: '#ffffff', logo: true,  eyeColor: '#dc2626', eyeShape: 'circle' },
  '3': { label: 'Logo + pupilles rouges',   dark: '#1E3A5F', light: '#ffffff', logo: true,  pupilColor: '#dc2626' },
};

const QR_MARGIN = 1;

/**
 * Normalise la valeur encodée en URL absolue : ajoute `http://` si le schéma est
 * absent et supprime les espaces superflus. Sans schéma, de nombreux lecteurs de
 * QR (appareils photo de certains téléphones) traitent le contenu comme du
 * texte brut (« copier ») au lieu d'un lien cliquable.
 */
function toQrUrl(raw: string): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `http://${v}`;
}

/**
 * Met en forme le contour des trois motifs de repérage (« yeux ») d'un QR Code
 * (haut-gauche, haut-droite, bas-gauche) : contour carré ou circulaire, coloré.
 */
function styleEyes(ctx: CanvasRenderingContext2D, count: number, ms: number, m: QrModel): void {
  if (!m.eyeColor && !m.pupilColor) return;
  const positions: Array<[number, number]> = [[0, 0], [0, count - 7], [count - 7, 0]];
  for (const [r, c] of positions) {
    const left = (c + QR_MARGIN) * ms;
    const top = (r + QR_MARGIN) * ms;
    if (m.eyeColor && m.eyeShape === 'circle') {
      const cx = left + 3.5 * ms;
      const cy = top + 3.5 * ms;
      // Efface l'œil carré (zone 7×7, entourée du séparateur blanc réglementaire).
      ctx.fillStyle = m.light;
      ctx.fillRect(left, top, 7 * ms, 7 * ms);
      // Anneau rouge (contour) — épaisseur 1 module, rayon extérieur 3,5 modules.
      ctx.strokeStyle = m.eyeColor;
      ctx.lineWidth = ms;
      ctx.beginPath();
      ctx.arc(cx, cy, 3 * ms, 0, Math.PI * 2);
      ctx.stroke();
      // Pupille (cercle plein, rayon 1,5 module).
      ctx.fillStyle = m.pupilColor ?? m.dark;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5 * ms, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.eyeColor) {
      // Contour carré : trait centré sur l'anneau (épaisseur 1 module).
      ctx.strokeStyle = m.eyeColor;
      ctx.lineWidth = ms;
      ctx.strokeRect(left + ms / 2, top + ms / 2, 6 * ms, 6 * ms);
    }
    // Pupille carrée colorée (carré central 3×3 de l'œil).
    if (m.pupilColor && m.eyeShape !== 'circle') {
      ctx.fillStyle = m.pupilColor;
      ctx.fillRect(left + 2 * ms, top + 2 * ms, 3 * ms, 3 * ms);
    }
  }
}

interface Props {
  /** Valeur encodée dans le QR Code (URL du serveur de pointage). */
  value: string;
  /** Taille en pixels du QR rendu (défaut 220). */
  size?: number;
  /** Modèle visuel ('1' | '2' | '3'). */
  model?: string;
  /** Nom du fichier téléchargé (sans extension). */
  downloadName?: string;
  /** Titre affiché sur l'impression. */
  printTitle?: string;
  /** Masque les boutons télécharger / imprimer. */
  hideActions?: boolean;
  /** Légende imprimée sous le QR (défaut « POINTAGE »). Vide pour aucune. */
  caption?: string;
}

/** Charge une image et résout quand elle est prête (ou rejette). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Affiche un QR Code généré à partir d'une valeur, selon un modèle visuel
 * (couleur + logo central optionnel), avec téléchargement (PNG) et impression.
 * Réutilisé par les paramètres et le tableau de bord du pointage.
 */
export default function QrCodeBox({
  value, size = 220, model = '1', downloadName = 'qr-pointage',
  printTitle = 'Pointage du personnel', hideActions = false, caption = 'POINTAGE',
}: Props) {
  const token = useAuthStore((s) => s.token);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  // Valeur réellement encodée : URL absolue (schéma garanti) pour un lien cliquable.
  const qrValue = toQrUrl(value);

  // Logo de l'entreprise (pour les modèles avec logo central).
  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    window.electron.settings.getLogoData(token).then((r) => {
      if (cancelled) return;
      if (r.success && r.data) setLogoSrc(`data:${r.data.mimeType};base64,${r.data.base64}`);
      else setLogoSrc(null);
    }).catch(() => { if (!cancelled) setLogoSrc(null); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!qrValue) { setDataUrl(''); return; }
      const m = QR_MODELS[model] ?? QR_MODELS['1'];
      try {
        const canvas = document.createElement('canvas');
        const ecLevel = m.logo ? 'H' : 'M';
        // Correction d'erreur élevée (H) quand un logo masque le centre.
        await QRCode.toCanvas(canvas, qrValue, {
          width: size, margin: QR_MARGIN,
          errorCorrectionLevel: ecLevel,
          color: { dark: m.dark, light: m.light },
        });
        // Mise en forme des « yeux » (contour carré/rond, pupille colorée) selon le modèle.
        if (m.eyeColor || m.pupilColor) {
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            const count = QRCode.create(qrValue, { errorCorrectionLevel: ecLevel }).modules.size;
            const moduleSize = canvas.width / (count + QR_MARGIN * 2);
            styleEyes(ctx2, count, moduleSize, m);
          }
        }
        if (m.logo && logoSrc) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            try {
              const img = await loadImage(logoSrc);
              const centerX = canvas.width / 2;
              const centerY = canvas.height / 2;
              if (m.logoCircle) {
                // Disque blanc puis logo « contain » dans le carré inscrit au cercle.
                const radius = canvas.width * 0.17;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();
                const inner = radius * 1.4;             // côté du carré inscrit
                const ratio = Math.min(inner / img.width, inner / img.height);
                const w = img.width * ratio;
                const h = img.height * ratio;
                ctx.drawImage(img, centerX - w / 2, centerY - h / 2, w, h);
              } else {
                // Fond blanc carré sous le logo.
                const box = canvas.width * 0.24;
                const pad = box * 0.12;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(centerX - box / 2 - pad, centerY - box / 2 - pad, box + pad * 2, box + pad * 2);
                const ratio = Math.min(box / img.width, box / img.height);
                const w = img.width * ratio;
                const h = img.height * ratio;
                ctx.drawImage(img, centerX - w / 2, centerY - h / 2, w, h);
              }
            } catch { /* logo illisible : QR sans logo */ }
          }
        }
        // Légende « POINTAGE » composée sous le QR (incluse au téléchargement / impression).
        let outCanvas: HTMLCanvasElement = canvas;
        const label = caption.trim();
        if (label) {
          const capH = Math.round(size * 0.2);
          const out = document.createElement('canvas');
          out.width = canvas.width;
          out.height = canvas.height + capH;
          const octx = out.getContext('2d');
          if (octx) {
            octx.fillStyle = '#ffffff';
            octx.fillRect(0, 0, out.width, out.height);
            octx.drawImage(canvas, 0, 0);
            octx.fillStyle = m.dark;
            octx.font = `bold ${Math.round(size * 0.11)}px system-ui, "Segoe UI", sans-serif`;
            octx.textAlign = 'center';
            octx.textBaseline = 'middle';
            try { (octx as unknown as { letterSpacing: string }).letterSpacing = `${Math.round(size * 0.03)}px`; } catch { /* non supporté */ }
            octx.fillText(label, out.width / 2, canvas.height + capH / 2);
            outCanvas = out;
          }
        }
        if (!cancelled) setDataUrl(outCanvas.toDataURL('image/png'));
      } catch {
        if (!cancelled) setDataUrl('');
      }
    }
    render();
    return () => { cancelled = true; };
  }, [qrValue, size, model, logoSrc, caption]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${downloadName}.png`;
    a.click();
  };

  const handlePrint = () => {
    if (!dataUrl) return;
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${printTitle}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:32px;color:#0f172a}
      h1{font-size:20px;margin-bottom:4px}p{color:#475569;font-size:13px;margin-top:0}
      img{margin:24px auto;display:block}</style></head>
      <body><h1>${printTitle}</h1><p>${qrValue}</p><img src="${dataUrl}" width="320" />
      <script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  if (!qrValue) {
    return <p className="text-sm text-slate-400">Renseignez l'adresse du serveur pour générer le QR Code.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {dataUrl
        ? <img src={dataUrl} style={{ width: size, height: 'auto' }} alt="QR Code de pointage" className="rounded-lg border border-slate-200 bg-white p-2" />
        : <div className="rounded-lg border border-slate-200 bg-slate-100 animate-pulse" style={{ width: size, height: size }} />}
      {!hideActions && (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleDownload} disabled={!dataUrl}>
            Télécharger
          </Button>
          <Button variant="secondary" size="sm" icon={<Printer className="h-4 w-4" />} onClick={handlePrint} disabled={!dataUrl}>
            Imprimer
          </Button>
        </div>
      )}
    </div>
  );
}
