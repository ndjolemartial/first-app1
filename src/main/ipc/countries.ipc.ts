import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession } from '../services/auth.service';
import logger from '../utils/logger';

/**
 * Enregistre les handlers IPC de la table de référence des pays.
 */
export function registerCountriesIPC(): void {
  /**
   * Retourne la liste complète des pays (code ISO 3166-1 alpha-2, nom,
   * indicatif téléphonique), triée par nom. Données de référence en lecture seule.
   */
  ipcMain.handle('countries:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const data = await db.country.findMany({ orderBy: { name: 'asc' } });
      return { success: true, data };
    } catch (error: any) {
      logger.error('countries:list error', error.message);
      return { success: false, error: error.message };
    }
  });
}
