// Crée une archive ZIP portable du dossier `release/win-unpacked`.
//
// Le contenu de win-unpacked est placé À LA RACINE du zip : après extraction,
// `Afrikimmo-App.exe` est directement lançable (aucune installation requise).
//
// Usage : npm run zip:portable   (lance d'abord `npm run package:win` ou
//         `electron-builder --win --dir` pour générer release/win-unpacked).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { path7za } = require('7zip-bin');
const pkg = require('../package.json');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'release', 'win-unpacked');

if (!existsSync(src)) {
  console.error(
    "❌ 'release/win-unpacked' introuvable.\n" +
    '   Générez d\'abord l\'app : npm run package:win  (ou : npx electron-builder --win --dir)',
  );
  process.exit(1);
}

const out = path.join(root, 'release', `Afrikimmo-App-${pkg.version}-portable-win.zip`);
if (existsSync(out)) rmSync(out);

console.log(`📦 Compression de win-unpacked → ${path.basename(out)} …`);
// cwd=src + '*' : ajoute le CONTENU de win-unpacked à la racine du zip (récursif).
// -mx=5 : compression équilibrée (rapide, bon ratio).
execFileSync(path7za, ['a', '-tzip', '-mx=5', out, '*'], { cwd: src, stdio: 'inherit' });

console.log(`\n✅ Archive portable créée :\n   ${out}`);
