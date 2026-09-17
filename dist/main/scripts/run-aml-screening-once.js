"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
/**
 * Point d'entrée autonome (hors Electron) pour exécuter une passe de criblage
 * LBC/FT planifiée puis quitter. Destiné à être planifié via le Planificateur
 * de tâches Windows (ou équivalent NAS), afin que le criblage continue de
 * tourner même quand aucun poste n'a l'application ouverte — le criblage tourne
 * normalement en `setInterval` (30 min) dans le process principal Electron
 * (voir `aml-screening.service.ts`), donc rien ne s'exécute si l'app est fermée
 * partout.
 *
 * La **fréquence configurée dans l'application** (Paramètres → Conformité
 * LBC/FT → Criblage — planification : quotidienne / hebdomadaire / mensuelle)
 * est **respectée** : ce script délègue à `runScheduledScreening()`, la même
 * logique d'échéance que le planificateur in-process. On peut donc, sans
 * risque de sur-exécution, planifier ce script **quotidiennement** dans le
 * système et laisser l'application décider si la passe du jour est due.
 *   - `--force` : exécute le criblage inconditionnellement (ignore la fréquence).
 *
 * Calqué sur `run-reminders-once.ts` (résolution de `DATABASE_URL`, aucune
 * dépendance Electron).
 *
 * Utilisation : node dist/main/scripts/run-aml-screening-once.js [--force]
 */
function loadDatabaseUrl() {
    if (process.env.DATABASE_URL)
        return;
    const candidates = [
        path_1.default.join(os_1.default.homedir(), 'AppData', 'Roaming', 'Afrikimmo-App', 'config.env'),
        path_1.default.join(__dirname, '.env'),
        path_1.default.join(process.cwd(), '.env'),
    ];
    for (const p of candidates) {
        if (fs_1.default.existsSync(p)) {
            dotenv_1.default.config({ path: p });
            if (process.env.DATABASE_URL)
                return;
        }
    }
}
async function main() {
    loadDatabaseUrl();
    if (!process.env.DATABASE_URL) {
        // eslint-disable-next-line no-console
        console.error("DATABASE_URL introuvable. Définissez-la dans l'environnement, ou placez un fichier " +
            '.env (DATABASE_URL="mysql://...") à côté de ce script ou à la racine du projet.');
        process.exitCode = 1;
        return;
    }
    const { runScheduledScreening } = await Promise.resolve().then(() => __importStar(require('../services/aml-screening.service')));
    const { getDb } = await Promise.resolve().then(() => __importStar(require('../services/db.service')));
    const logger = (await Promise.resolve().then(() => __importStar(require('../utils/logger')))).default;
    const force = process.argv.includes('--force');
    try {
        const outcome = await runScheduledScreening({ force, operatorName: 'Système (tâche planifiée)' });
        if (outcome.ran) {
            logger.info(`[run-aml-screening-once] ${outcome.reference} — entités=${outcome.entitiesScreened} ` +
                `nouvelles=${outcome.hitsNew} total=${outcome.hitsTotal}`);
        }
        else {
            logger.info(`[run-aml-screening-once] passe ignorée — ${outcome.skippedReason}`);
        }
    }
    catch (err) {
        logger.error(`[run-aml-screening-once] fatal: ${err.message}`);
        process.exitCode = 1;
    }
    finally {
        await getDb().$disconnect();
    }
}
main();
