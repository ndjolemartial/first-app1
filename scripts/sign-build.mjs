// Build electron-builder avec signature de code automatique.
//
// Lit le mot de passe du certificat depuis `certs/certificat pwd.txt`
// (fichier gitignored — le secret ne quitte jamais le poste) et le passe à
// electron-builder via les variables d'environnement CSC_LINK / CSC_KEY_PASSWORD.
//
// Si le certificat ou son mot de passe sont absents (autre poste, CI sans
// secret), le build est lancé SANS signature plutôt que d'échouer.
//
// Usage : node scripts/sign-build.mjs [--win|--mac|--linux] [autres args...]

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const PFX_PATH = 'certs/afrikimmo-codesign.pfx';
const PWD_PATH = 'certs/certificat pwd.txt';

/**
 * Extrait le mot de passe du fichier : première ligne non vide qui n'est pas
 * un commentaire (`//`). Renvoie null si le fichier est absent ou vide.
 */
function readCertPassword() {
  if (!existsSync(PWD_PATH)) return null;
  const raw = readFileSync(PWD_PATH, 'utf8');
  const line = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('//'));
  return line || null;
}

const args = process.argv.slice(2);
const env = { ...process.env };

const password = readCertPassword();
if (existsSync(PFX_PATH) && password) {
  // electron-builder détecte automatiquement ces variables et signe les
  // binaires Windows via signtool.exe.
  env.CSC_LINK = PFX_PATH;
  env.CSC_KEY_PASSWORD = password;
  console.log(`[sign-build] Signature activée (certificat ${PFX_PATH}).`);
} else {
  console.warn(
    `[sign-build] Certificat ou mot de passe absent (${PFX_PATH} / ${PWD_PATH}). `
      + 'Build SANS signature.',
  );
}

const bin = path.join(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
);
const result = spawnSync(bin, args, { stdio: 'inherit', env, shell: true });
process.exit(result.status ?? 1);
