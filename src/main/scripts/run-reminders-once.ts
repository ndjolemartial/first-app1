import path from 'path';
import os from 'os';
import fs from 'fs';
import dotenv from 'dotenv';

/**
 * Point d'entrée autonome (hors Electron) pour exécuter une passe de
 * relances (`applyReminderRules`) puis quitter. Destiné à être planifié via
 * le Planificateur de tâches Windows (ou équivalent), pour que les relances
 * continuent d'être envoyées même quand aucun poste n'a l'application
 * Afrikimmo-App ouverte — le moteur de relances tourne normalement en tant
 * que `setInterval` (1h) dans le process principal Electron, donc rien n'est
 * envoyé si l'app est fermée partout (voir `reminders.service.ts`).
 *
 * Aucune dépendance Electron : réutilise tel quel `applyReminderRules()` et
 * les services email/SMS/WhatsApp/paramètres, qui n'en ont pas besoin
 * (seul `settings.service.ts` touchait `safeStorage`, en repli inoffensif
 * hors runtime Electron depuis ce commit).
 *
 * Résolution de `DATABASE_URL` (contrairement à l'app desktop, qui passe par
 * `loadEnv.ts` — lequel a besoin d'`app.getPath('userData')`) :
 *   1. Déjà présente dans l'environnement du process (ex. définie par le
 *      Planificateur de tâches) → utilisée telle quelle.
 *   2. `config.env` du dossier de données de l'app desktop (même fichier
 *      qu'utilise l'app packagée — %APPDATA%/Afrikimmo-App/config.env sous
 *      Windows), pour rester en phase avec la config déjà en place.
 *   3. `.env` à côté de ce script, puis `.env` du répertoire courant (utile
 *      en développement, exécuté depuis la racine du dépôt).
 *
 * Utilisation :
 *   node dist/main/scripts/run-reminders-once.js
 *
 * Compilé par `npm run build:main` (le fichier vit sous `src/main`, inclus
 * par `tsconfig.main.json`) — aucun build dédié nécessaire.
 */

function loadDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;

  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Afrikimmo-App', 'config.env'),
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      if (process.env.DATABASE_URL) return;
    }
  }
}

async function main(): Promise<void> {
  loadDatabaseUrl();
  if (!process.env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.error(
      "DATABASE_URL introuvable. Définissez-la dans l'environnement, ou placez un fichier " +
      '.env (DATABASE_URL="mysql://...") à côté de ce script ou à la racine du projet.',
    );
    process.exitCode = 1;
    return;
  }

  // Imports différés : la résolution de DATABASE_URL doit précéder tout
  // import de db.service.ts (le client Prisma est instancié à la demande,
  // mais autant fixer l'environnement avant de charger le module).
  const { applyReminderRules } = await import('../services/reminders.service');
  const { getDb } = await import('../services/db.service');
  const logger = (await import('../utils/logger')).default;

  try {
    const result = await applyReminderRules({ force: false });
    logger.info(
      `[run-reminders-once] scanned=${result.scanned} sent=${result.sent} ` +
      `skipped=${result.skipped} failed=${result.failed}`,
    );
  } catch (err: any) {
    logger.error(`[run-reminders-once] fatal: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await getDb().$disconnect();
  }
}

main();
