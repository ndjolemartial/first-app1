"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setStorageRootOverride = setStorageRootOverride;
exports.storageRoot = storageRoot;
exports.resolveStoragePath = resolveStoragePath;
exports.importGedFile = importGedFile;
exports.writeGedFile = writeGedFile;
exports.removeStorageFile = removeStorageFile;
exports.readStorageFile = readStorageFile;
exports.writeLogoFile = writeLogoFile;
exports.writeSlideshowFile = writeSlideshowFile;
exports.directorySize = directorySize;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
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
let STORAGE_ROOT_OVERRIDE = null;
/** Définit la racine de stockage à chaud (depuis settings.service). */
function setStorageRootOverride(rootPath) {
    STORAGE_ROOT_OVERRIDE = rootPath && rootPath.length > 0 ? rootPath : null;
}
/** Racine du stockage des fichiers — paramétrée en BDD, sinon STORAGE_PATH, sinon défaut. */
function storageRoot() {
    return path_1.default.resolve(STORAGE_ROOT_OVERRIDE ?? process.env.STORAGE_PATH ?? './data/storage');
}
/** Chemin absolu à partir d'un chemin relatif stocké en base. */
function resolveStoragePath(relativePath) {
    return path_1.default.join(storageRoot(), relativePath);
}
/** Extension de fichier (point inclus), en minuscules. */
function extOf(name) {
    return path_1.default.extname(name).toLowerCase();
}
/** Répertoire GED de l'année courante (créé si nécessaire). */
function gedYearDir() {
    const year = String(new Date().getFullYear());
    const dir = path_1.default.join(storageRoot(), 'ged', year);
    fs_1.default.mkdirSync(dir, { recursive: true });
    return { dir, year };
}
/**
 * Importe un fichier dans la GED en copiant le fichier source.
 * Renvoie le chemin relatif et la taille du fichier copié.
 */
function importGedFile(sourcePath, numeroArchive, originalName) {
    const { dir, year } = gedYearDir();
    const ext = extOf(originalName) || extOf(sourcePath);
    const fileName = `${numeroArchive}${ext}`;
    const absPath = path_1.default.join(dir, fileName);
    fs_1.default.copyFileSync(sourcePath, absPath);
    return {
        relativePath: ['ged', year, fileName].join('/'),
        size: fs_1.default.statSync(absPath).size,
    };
}
/** Écrit un fichier GED depuis un buffer (import base64 — petits fichiers). */
function writeGedFile(buffer, numeroArchive, originalName) {
    const { dir, year } = gedYearDir();
    const ext = extOf(originalName);
    const fileName = `${numeroArchive}${ext}`;
    fs_1.default.writeFileSync(path_1.default.join(dir, fileName), buffer);
    return { relativePath: ['ged', year, fileName].join('/'), size: buffer.length };
}
/** Supprime physiquement un fichier du stockage (silencieux si absent). */
function removeStorageFile(relativePath) {
    try {
        const abs = resolveStoragePath(relativePath);
        if (fs_1.default.existsSync(abs))
            fs_1.default.unlinkSync(abs);
    }
    catch {
        /* ignore — le fichier a déjà disparu */
    }
}
/** Lit un fichier du stockage sous forme de buffer (null si absent). */
function readStorageFile(relativePath) {
    const abs = resolveStoragePath(relativePath);
    return fs_1.default.existsSync(abs) ? fs_1.default.readFileSync(abs) : null;
}
// ── Logo entreprise ──────────────────────────────────────────────────────────
/**
 * Écrit le logo entreprise sur disque dans `<root>/logo/`. Le fichier porte le
 * nom `company-logo.<ext>` et écrase l'éventuel précédent. Retourne le chemin
 * relatif (`logo/company-logo.<ext>`).
 */
function writeLogoFile(buffer, originalName) {
    const dir = path_1.default.join(storageRoot(), 'logo');
    fs_1.default.mkdirSync(dir, { recursive: true });
    const ext = extOf(originalName) || '.png';
    // Supprime les anciens fichiers `company-logo.*` pour éviter les orphelins.
    for (const entry of fs_1.default.readdirSync(dir).filter((f) => f.startsWith('company-logo.'))) {
        try {
            fs_1.default.unlinkSync(path_1.default.join(dir, entry));
        }
        catch { /* ignore */ }
    }
    const fileName = `company-logo${ext}`;
    fs_1.default.writeFileSync(path_1.default.join(dir, fileName), buffer);
    return { relativePath: ['logo', fileName].join('/'), size: buffer.length };
}
// ── Slideshow dashboard ──────────────────────────────────────────────────────
/**
 * Écrit un média du slideshow (image/vidéo) avec un nom unique pour éviter
 * les collisions. Retourne le chemin relatif `slideshow/<uuid><ext>`.
 */
function writeSlideshowFile(buffer, originalName) {
    const dir = path_1.default.join(storageRoot(), 'slideshow');
    fs_1.default.mkdirSync(dir, { recursive: true });
    const ext = extOf(originalName);
    const fileName = `${crypto_1.default.randomUUID()}${ext}`;
    fs_1.default.writeFileSync(path_1.default.join(dir, fileName), buffer);
    return { relativePath: ['slideshow', fileName].join('/'), size: buffer.length };
}
/** Taille totale (octets) d'un répertoire, récursivement. */
function directorySize(dir) {
    if (!fs_1.default.existsSync(dir))
        return 0;
    let total = 0;
    for (const entry of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
        const full = path_1.default.join(dir, entry.name);
        if (entry.isDirectory())
            total += directorySize(full);
        else {
            try {
                total += fs_1.default.statSync(full).size;
            }
            catch {
                /* ignore */
            }
        }
    }
    return total;
}
