import path from 'path';
import os from 'os';
import fs from 'fs';
import dotenv from 'dotenv';

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

  const { runScheduledScreening } = await import('../services/aml-screening.service');
  const { getDb } = await import('../services/db.service');
  const logger = (await import('../utils/logger')).default;

  const force = process.argv.includes('--force');

  try {
    const outcome = await runScheduledScreening({ force, operatorName: 'Système (tâche planifiée)' });
    if (outcome.ran) {
      logger.info(
        `[run-aml-screening-once] ${outcome.reference} — entités=${outcome.entitiesScreened} ` +
        `nouvelles=${outcome.hitsNew} total=${outcome.hitsTotal}`,
      );
    } else {
      logger.info(`[run-aml-screening-once] passe ignorée — ${outcome.skippedReason}`);
    }
  } catch (err: any) {
    logger.error(`[run-aml-screening-once] fatal: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await getDb().$disconnect();
  }
}

main();
