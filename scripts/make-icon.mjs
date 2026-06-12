// Génère build/icon.ico (multi-tailles) + build/icon.png (512) — icône Afrikimmo :
// carré arrondi dégradé BLEU (#2563EB → #1E3A5F) + lettre « A » blanche +
// contour fin ROUGE. Pur Node (zlib intégré), sans dépendance.
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'build');
mkdirSync(outDir, { recursive: true });

const C1 = [37, 99, 235];    // #2563EB (haut-gauche)
const C2 = [30, 58, 95];     // #1E3A5F (bas-droite)
const BORDER = [220, 38, 38]; // #DC2626 — contour rouge

// ── Glyphe « A » (3 traits) ──────────────────────────────────────────────────
const segDist = (px, py, a, b) => {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = px - a[0], wy = py - a[1];
  const c = vx * vx + vy * vy;
  let t = c ? (wx * vx + wy * vy) / c : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * vx), py - (a[1] + t * vy));
};
function isLetterA(x, y, N) {
  const apex = [N * 0.5, N * 0.28], lB = [N * 0.29, N * 0.75], rB = [N * 0.71, N * 0.75];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const stroke = N * 0.058;
  return Math.min(
    segDist(x, y, apex, lB), segDist(x, y, apex, rB),
    segDist(x, y, lerp(apex, lB, 0.60), lerp(apex, rB, 0.60)),
  ) <= stroke;
}

// ── Rendu (supersampling 4× pour l'anti-aliasing) ────────────────────────────
function render(size) {
  const SS = 4;
  const N = size * SS;
  const margin = N * 0.06, rad = N * 0.22, bw = N * 0.022; // bw = épaisseur contour
  // insideRR avec retrait optionnel (inset) — sert à détecter l'anneau de bordure.
  const insideRR = (x, y, inset) => {
    const mn = margin + inset, mx = N - margin - inset, r = Math.max(0, rad - inset);
    if (x < mn || x > mx || y < mn || y > mx) return false;
    const dxC = x < mn + r ? mn + r - x : (x > mx - r ? x - (mx - r) : 0);
    const dyC = y < mn + r ? mn + r - y : (y > mx - r ? y - (mx - r) : 0);
    return dxC * dxC + dyC * dyC <= r * r;
  };

  const hi = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (!insideRR(cx, cy, 0)) continue; // transparent hors du carré
      const i = (y * N + x) * 4;
      let r, g, b;
      if (!insideRR(cx, cy, bw)) {
        [r, g, b] = BORDER; // anneau de contour rouge
      } else {
        const t = (x + y) / (2 * N);
        r = C1[0] + (C2[0] - C1[0]) * t;
        g = C1[1] + (C2[1] - C1[1]) * t;
        b = C1[2] + (C2[2] - C1[2]) * t;
        if (isLetterA(cx, cy, N)) { r = 255; g = 255; b = 255; }
      }
      hi[i] = r; hi[i + 1] = g; hi[i + 2] = b; hi[i + 3] = 255;
    }
  }

  // Downsample SS×SS (alpha prémultiplié)
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * N + (x * SS + dx)) * 4;
          const aa = hi[i + 3] / 255;
          r += hi[i] * aa; g += hi[i + 1] * aa; b += hi[i + 2] * aa; a += hi[i + 3];
        }
      }
      const asum = a / 255, oi = (y * size + x) * 4;
      if (asum > 0) { out[oi] = Math.round(r / asum); out[oi + 1] = Math.round(g / asum); out[oi + 2] = Math.round(b / asum); }
      out[oi + 3] = Math.round(a / (SS * SS));
    }
  }
  return out;
}

// ── Encodage PNG (RGBA, sans filtre) ─────────────────────────────────────────
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const tb = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0); return Buffer.concat([len, tb, data, crc]); };
function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = size * 4, raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── Assemblage ICO multi-tailles + PNG 512 ───────────────────────────────────
const sizes = [256, 64, 48, 32, 16];
const pngs = sizes.map((s) => encodePng(render(s), s));
const header = Buffer.alloc(6); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = 6 + sizes.length * 16; const dir = [];
for (let i = 0; i < sizes.length; i++) {
  const s = sizes[i], e = Buffer.alloc(16);
  e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12); dir.push(e); offset += pngs[i].length;
}
writeFileSync(path.join(outDir, 'icon.ico'), Buffer.concat([header, ...dir, ...pngs]));
writeFileSync(path.join(outDir, 'icon.png'), encodePng(render(512), 512));
console.log(`✅ build/icon.ico (tailles ${sizes.join('/')}) + build/icon.png (512) — bleu + « A » blanc + contour rouge`);
