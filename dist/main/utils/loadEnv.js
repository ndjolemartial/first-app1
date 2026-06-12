"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvFilePath = getEnvFilePath;
exports.loadAppEnv = loadAppEnv;
exports.parseDatabaseUrl = parseDatabaseUrl;
exports.buildDatabaseUrl = buildDatabaseUrl;
exports.readDbConfig = readDbConfig;
exports.writeDatabaseUrl = writeDatabaseUrl;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
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
const DEFAULT_DATABASE_URL = 'mysql://afrikimmo_admin:password@localhost:3306/afrikimmo_app';
/** Chemin du fichier d'environnement selon le contexte (dev vs packagé). */
function getEnvFilePath() {
    return electron_1.app.isPackaged
        ? path_1.default.join(electron_1.app.getPath('userData'), 'config.env')
        : path_1.default.join(process.cwd(), '.env');
}
let loaded = false;
/**
 * Charge le fichier d'environnement et renseigne `process.env.DATABASE_URL`.
 * Idempotent. À appeler une fois au démarrage, avant toute utilisation de la BDD.
 */
function loadAppEnv() {
    if (loaded)
        return;
    const envPath = getEnvFilePath();
    if (electron_1.app.isPackaged && !fs_1.default.existsSync(envPath)) {
        try {
            fs_1.default.writeFileSync(envPath, `DATABASE_URL="${DEFAULT_DATABASE_URL}"\n`, 'utf-8');
        }
        catch {
            /* écriture impossible — l'écran de réglage permettra de configurer */
        }
    }
    if (fs_1.default.existsSync(envPath)) {
        const parsed = dotenv_1.default.config({ path: envPath });
        // dotenv ne surcharge pas une variable déjà présente dans l'environnement :
        // on force la valeur du fichier comme source de vérité pour DATABASE_URL.
        if (parsed.parsed?.DATABASE_URL) {
            process.env.DATABASE_URL = parsed.parsed.DATABASE_URL;
        }
    }
    loaded = true;
}
/**
 * Parse une URL `mysql://user:pass@host:port/db`. Le mot de passe peut contenir
 * un « @ » non encodé (cas réel) : on coupe sur le DERNIER « @ » avant l'hôte.
 */
function parseDatabaseUrl(url) {
    const empty = { host: '', port: '3306', database: '', user: '', password: '' };
    if (!url)
        return empty;
    const m = url.match(/^mysql:\/\/(.*)@([^/@]+)\/([^?]*)/i);
    if (!m)
        return empty;
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
function safeDecode(v) {
    try {
        return decodeURIComponent(v);
    }
    catch {
        return v;
    }
}
/** Construit une URL mysql en encodant l'identifiant et le mot de passe. */
function buildDatabaseUrl(c) {
    const u = encodeURIComponent(c.user);
    const p = encodeURIComponent(c.password);
    const port = c.port || '3306';
    return `mysql://${u}:${p}@${c.host}:${port}/${c.database}`;
}
/** Config BDD actuellement utilisée (déduite de `process.env.DATABASE_URL`). */
function readDbConfig() {
    return parseDatabaseUrl(process.env.DATABASE_URL);
}
/**
 * Écrit `DATABASE_URL` dans le fichier d'environnement (remplace la ligne
 * existante ou l'ajoute) et met à jour le `process.env` courant.
 */
function writeDatabaseUrl(url) {
    const envPath = getEnvFilePath();
    let content = '';
    try {
        content = fs_1.default.existsSync(envPath) ? fs_1.default.readFileSync(envPath, 'utf-8') : '';
    }
    catch {
        content = '';
    }
    const line = `DATABASE_URL="${url}"`;
    if (/^DATABASE_URL=.*$/m.test(content)) {
        content = content.replace(/^DATABASE_URL=.*$/m, line);
    }
    else {
        content = content ? `${content.replace(/\s*$/, '')}\n${line}\n` : `${line}\n`;
    }
    fs_1.default.writeFileSync(envPath, content, 'utf-8');
    process.env.DATABASE_URL = url;
}
