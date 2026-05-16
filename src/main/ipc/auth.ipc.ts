import { ipcMain } from 'electron';
import { login, logout, getSession } from '../services/auth.service';
import { hashPassword } from '../utils/crypto';
import { getDb } from '../services/db.service';
import logger from '../utils/logger';

/**
 * Enregistre les handlers IPC pour l'authentification.
 */
export function registerAuthIPC(): void {
  ipcMain.handle('auth:login', async (_event, { email, password }: { email: string; password: string }) => {
    try {
      const result = await login(email, password);
      return { success: true, data: result };
    } catch (error: any) {
      logger.warn(`Login failed for ${email}: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:logout', async (_event, { token }: { token: string }) => {
    try {
      logout(token);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:me', async (_event, { token }: { token: string }) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true, uuid: true, matricule: true, firstName: true, lastName: true,
          email: true, role: true, isActive: true, avatar: true, lastLoginAt: true,
        },
      });
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:changePassword', async (_event, { token, currentPassword, newPassword }: { token: string; currentPassword: string; newPassword: string }) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const user = await db.user.findUnique({ where: { id: session.userId } });
      if (!user) return { success: false, error: 'Utilisateur introuvable' };
      const { comparePassword } = await import('../utils/crypto');
      const valid = await comparePassword(currentPassword, user.password);
      if (!valid) return { success: false, error: 'Mot de passe actuel incorrect' };
      const hashed = await hashPassword(newPassword);
      await db.user.update({ where: { id: user.id }, data: { password: hashed } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
