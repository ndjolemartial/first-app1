import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

/**
 * Chargement des variables d'environnement et gestion de la chaîne de connexion
 * à la base de données, paramétrable APRÈS installation.
 *
 *  - Dev      : `.env` à la racine du projet (`process.cwd()`).
 *  - Packagée : `<userData>/config.env`, éditable par l'admin sans recompiler
 *               (via l'écran « Connexion BDD »).
 *
 * En production, si le fichier est absent au premier lancement, il est créé avec
 * une valeur par défaut (modifiable ensuite). On ne fige donc jamais l'URL (et
 * le mot de passe) dans l'asar.
 */

const DEFAULT_DATABASE_URL =
  'mysql://afrikimmo_admin:password@localhost:3306/afrikimmo_app';

/** Chemin du fichier d'environnement selon le contexte (dev vs packagé). */
export function getEnvFilePath(): string {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'config.env')
    : path.join(process.cwd(), '.env');
}

let loaded = false;

/**
 * Charge le fichier d'environnement et renseigne `process.env.DATABASE_URL`.
 * Idempotent. À appeler une fois au démarrage, avant toute utilisation de la BDD.
 */
export function loadAppEnv(): void {
  if (loaded) return;
  const envPath = getEnvFilePath();
  if (app.isPackaged && !fs.existsSync(envPath)) {
    try {
      fs.writeFileSync(envPath, `DATABASE_URL="${DEFAULT_DATABASE_URL}"\n`, 'utf-8');
    } catch {
      /* écriture impossible — l'écran de réglage permettra de configurer */
    }
  }
  if (fs.existsSync(envPath)) {
    const parsed = dotenv.config({ path: envPath });
    // dotenv ne surcharge pas une variable déjà présente dans l'environnement :
    // on force la valeur du fichier comme source de vérité pour DATABASE_URL.
    if (parsed.parsed?.DATABASE_URL) {
      process.env.DATABASE_URL = parsed.parsed.DATABASE_URL;
    }
  }
  loaded = true;
}

export interface DbConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

/**
 * Parse une URL `mysql://user:pass@host:port/db`. Le mot de passe peut contenir
 * un « @ » non encodé (cas réel) : on coupe sur le DERNIER « @ » avant l'hôte.
 */
export function parseDatabaseUrl(url: string | undefined): DbConfig {
  const empty: DbConfig = { host: '', port: '3306', database: '', user: '', password: '' };
  if (!url) return empty;
  const m = url.match(/^mysql:\/\/(.*)@([^/@]+)\/([^?]*)/i);
  if (!m) return empty;
  const creds = m[1]; // user:pass (greedy → s'arrête au dernier @)
  const hostPort = m[2];
  const database = safeDecode(m[3] ?? '');
  const ci = creds.indexOf(':');
  const user = safeDecode(ci >= 0 ? creds.slice(0, ci) : creds);
  const password = ci >= 0 ? safeDecode(creds.slice(ci + 1)) : '';
  const [host, port = '3306'] = hostPort.split(':');
  return { host, port, database, user, password };
}

/** decodeURIComponent tolérant (laisse la valeur brute si non décodable). */
function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Construit une URL mysql en encodant l'identifiant et le mot de passe. */
export function buildDatabaseUrl(c: DbConfig): string {
  const u = encodeURIComponent(c.user);
  const p = encodeURIComponent(c.password);
  const port = c.port || '3306';
  return `mysql://${u}:${p}@${c.host}:${port}/${c.database}`;
}

/** Config BDD actuellement utilisée (déduite de `process.env.DATABASE_URL`). */
export function readDbConfig(): DbConfig {
  return parseDatabaseUrl(process.env.DATABASE_URL);
}

/**
 * Écrit `DATABASE_URL` dans le fichier d'environnement (remplace la ligne
 * existante ou l'ajoute) et met à jour le `process.env` courant.
 */
export function writeDatabaseUrl(url: string): void {
  const envPath = getEnvFilePath();
  let content = '';
  try {
    content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  } catch {
    content = '';
  }
  const line = `DATABASE_URL="${url}"`;
  if (/^DATABASE_URL=.*$/m.test(content)) {
    content = content.replace(/^DATABASE_URL=.*$/m, line);
  } else {
    content = content ? `${content.replace(/\s*$/, '')}\n${line}\n` : `${line}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf-8');
  process.env.DATABASE_URL = url;
}
