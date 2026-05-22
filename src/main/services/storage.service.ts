import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Service de stockage des fichiers de la GED, du logo et des médias du slideshow.
 *
 * Les fichiers sont rangés sous :
 *   - `<STORAGE_PATH>/ged/<année>/<numéro><ext>`      (GED)
 *   - `<STORAGE_PATH>/logo/<nom><ext>`                (logo entreprise)
 *   - `<STORAGE_PATH>/slideshow/<uuid><ext>`          (médias du slideshow)
 *
 * La base de données ne conserve qu'un chemin relatif (séparateur `/`).
 */

/**
 * Racine du stockage. Pendant le démarrage, on lit la valeur depuis la BDD
 * (clé `storage.path`) via `setStorageRootOverride`; à défaut on retombe sur
 * la variable d'environnement STORAGE_PATH, puis sur `./data/storage`.
 */
let STORAGE_ROOT_OVERRIDE: string | null = null;

/** Définit la racine de stockage à chaud (depuis settings.service). */
export function setStorageRootOverride(rootPath: string | null): void {
  STORAGE_ROOT_OVERRIDE = rootPath && rootPath.length > 0 ? rootPath : null;
}

/** Racine du stockage des fichiers — paramétrée en BDD, sinon STORAGE_PATH, sinon défaut. */
export function storageRoot(): string {
  return path.resolve(STORAGE_ROOT_OVERRIDE ?? process.env.STORAGE_PATH ?? './data/storage');
}

/** Chemin absolu à partir d'un chemin relatif stocké en base. */
export function resolveStoragePath(relativePath: string): string {
  return path.join(storageRoot(), relativePath);
}

/** Extension de fichier (point inclus), en minuscules. */
function extOf(name: string): string {
  return path.extname(name).toLowerCase();
}

/** Répertoire GED de l'année courante (créé si nécessaire). */
function gedYearDir(): { dir: string; year: string } {
  const year = String(new Date().getFullYear());
  const dir = path.join(storageRoot(), 'ged', year);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, year };
}

/**
 * Importe un fichier dans la GED en copiant le fichier source.
 * Renvoie le chemin relatif et la taille du fichier copié.
 */
export function importGedFile(
  sourcePath: string,
  numeroArchive: string,
  originalName: string,
): { relativePath: string; size: number } {
  const { dir, year } = gedYearDir();
  const ext = extOf(originalName) || extOf(sourcePath);
  const fileName = `${numeroArchive}${ext}`;
  const absPath = path.join(dir, fileName);
  fs.copyFileSync(sourcePath, absPath);
  return {
    relativePath: ['ged', year, fileName].join('/'),
    size: fs.statSync(absPath).size,
  };
}

/** Écrit un fichier GED depuis un buffer (import base64 — petits fichiers). */
export function writeGedFile(
  buffer: Buffer,
  numeroArchive: string,
  originalName: string,
): { relativePath: string; size: number } {
  const { dir, year } = gedYearDir();
  const ext = extOf(originalName);
  const fileName = `${numeroArchive}${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return { relativePath: ['ged', year, fileName].join('/'), size: buffer.length };
}

/** Supprime physiquement un fichier du stockage (silencieux si absent). */
export function removeStorageFile(relativePath: string): void {
  try {
    const abs = resolveStoragePath(relativePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore — le fichier a déjà disparu */
  }
}

/** Lit un fichier du stockage sous forme de buffer (null si absent). */
export function readStorageFile(relativePath: string): Buffer | null {
  const abs = resolveStoragePath(relativePath);
  return fs.existsSync(abs) ? fs.readFileSync(abs) : null;
}

// ── Logo entreprise ──────────────────────────────────────────────────────────

/**
 * Écrit le logo entreprise sur disque dans `<root>/logo/`. Le fichier porte le
 * nom `company-logo.<ext>` et écrase l'éventuel précédent. Retourne le chemin
 * relatif (`logo/company-logo.<ext>`).
 */
export function writeLogoFile(buffer: Buffer, originalName: string): { relativePath: string; size: number } {
  const dir = path.join(storageRoot(), 'logo');
  fs.mkdirSync(dir, { recursive: true });
  const ext = extOf(originalName) || '.png';
  // Supprime les anciens fichiers `company-logo.*` pour éviter les orphelins.
  for (const entry of fs.readdirSync(dir).filter((f) => f.startsWith('company-logo.'))) {
    try { fs.unlinkSync(path.join(dir, entry)); } catch { /* ignore */ }
  }
  const fileName = `company-logo${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return { relativePath: ['logo', fileName].join('/'), size: buffer.length };
}

// ── Slideshow dashboard ──────────────────────────────────────────────────────

/**
 * Écrit un média du slideshow (image/vidéo) avec un nom unique pour éviter
 * les collisions. Retourne le chemin relatif `slideshow/<uuid><ext>`.
 */
export function writeSlideshowFile(buffer: Buffer, originalName: string): { relativePath: string; size: number } {
  const dir = path.join(storageRoot(), 'slideshow');
  fs.mkdirSync(dir, { recursive: true });
  const ext = extOf(originalName);
  const fileName = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return { relativePath: ['slideshow', fileName].join('/'), size: buffer.length };
}

/** Taille totale (octets) d'un répertoire, récursivement. */
export function directorySize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += directorySize(full);
    else {
      try {
        total += fs.statSync(full).size;
      } catch {
        /* ignore */
      }
    }
  }
  return total;
}
