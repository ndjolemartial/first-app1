import path from 'path';
import os from 'os';
import fs from 'fs';
import dotenv from 'dotenv';

/**
 * Point d'entrée autonome (hors Electron) pour exécuter une passe de
 * réception des réponses par email (`pollAllMailAccounts`) puis quitter.
 * Destiné à être planifié via le Planificateur de tâches Windows (ou
 * équivalent), pour que les réponses continuent d'être récupérées même
 * quand aucun poste n'a l'application Afrikimmo-App ouverte — le moteur de
 * réception tourne normalement en tant que `setInterval` (10 min) dans le
 * process principal Electron, donc rien n'est récupéré si l'app est fermée
 * partout (voir `mailbox-poller.service.ts`). Calqué à l'identique sur
 * `run-reminders-once.ts` (même résolution de `DATABASE_URL`, mêmes gardes).
 *
 * Utilisation :
 *   node dist/main/scripts/run-mailbox-poll-once.js
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
  // import de db.service.ts.
  const { pollAllMailAccounts } = await import('../services/mailbox-poller.service');
  const { getDb } = await import('../services/db.service');
  const logger = (await import('../utils/logger')).default;

  try {
    const result = await pollAllMailAccounts();
    logger.info(
      `[run-mailbox-poll-once] accounts=${result.accounts} fetched=${result.fetched} ` +
      `matched=${result.matched} errors=${result.errors}`,
    );
  } catch (err: any) {
    logger.error(`[run-mailbox-poll-once] fatal: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await getDb().$disconnect();
  }
}

main();
