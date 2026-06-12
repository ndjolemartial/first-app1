import { ipcMain } from 'electron';
import { PrismaClient } from '@prisma/client';
import {
  readDbConfig,
  buildDatabaseUrl,
  writeDatabaseUrl,
  getEnvFilePath,
  type DbConfig,
} from '../utils/loadEnv';
import { reconnectDb } from '../services/db.service';
import logger from '../utils/logger';

/**
 * Configuration de la connexion base de données — accessible AVANT
 * authentification (la BDD peut être injoignable). Aucun jeton requis : ces
 * handlers ne lisent/écrivent que le fichier de config local et testent une
 * connexion. Réservé à un usage poste de travail (application de bureau).
 */

const isValidConfig = (c: any): c is DbConfig =>
  c && typeof c.host === 'string' && c.host.trim() !== ''
    && typeof c.database === 'string' && c.database.trim() !== ''
    && typeof c.user === 'string';

export function registerConfigIPC(): void {
  // Lecture de la configuration courante (pré-remplit l'écran de réglage).
  ipcMain.handle('config:getDb', async () => {
    try {
      return { success: true, data: { ...readDbConfig(), envFile: getEnvFilePath() } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Test de connexion avec les paramètres fournis (sans rien enregistrer).
  ipcMain.handle('config:testDb', async (_event, { config }: { config: DbConfig }) => {
    if (!isValidConfig(config)) {
      return { success: false, error: 'Hôte, base et utilisateur sont requis.' };
    }
    const url = buildDatabaseUrl(config);
    const client = new PrismaClient({ datasourceUrl: url });
    try {
      await client.$queryRawUnsafe('SELECT 1');
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      await client.$disconnect().catch(() => undefined);
    }
  });

  // Enregistre la configuration puis reconstruit le client Prisma à chaud.
  ipcMain.handle('config:saveDb', async (_event, { config }: { config: DbConfig }) => {
    if (!isValidConfig(config)) {
      return { success: false, error: 'Hôte, base et utilisateur sont requis.' };
    }
    try {
      const url = buildDatabaseUrl(config);
      writeDatabaseUrl(url);
      await reconnectDb();
      logger.info(`Configuration BDD mise à jour (${config.host}:${config.port}/${config.database})`);
      return { success: true };
    } catch (error: any) {
      logger.error(`config:saveDb error: ${error.message}`);
      return { success: false, error: error.message };
    }
  });
}
