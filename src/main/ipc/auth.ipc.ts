import { ipcMain } from 'electron';
import { z } from 'zod';
import { login, logout, getSession } from '../services/auth.service';
import { hashPassword } from '../utils/crypto';
import { getDb } from '../services/db.service';
import logger from '../utils/logger';

// Champs autorisés à la modification par l'utilisateur lui-même.
// Sont exclus volontairement : matricule, cnpsNumber, hireDate, fonction, role
// (réservés aux ADMIN / SUPER_ADMIN via le module Utilisateurs).
const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  login: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  avatar: z.string().optional(),
  idNumber: z.string().optional(),
  civilite: z.enum(['MONSIEUR', 'MADAME', 'MADEMOISELLE']).optional(),
  statutConjugal: z.enum(['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE']).optional(),
  residence: z.string().optional(),
});

const PROFILE_SELECT = {
  id: true, uuid: true, matricule: true, firstName: true, lastName: true,
  email: true, login: true, role: true, isActive: true, avatar: true,
  phone: true, mobile: true, fonction: true, idNumber: true, civilite: true,
  statutConjugal: true, hireDate: true, cnpsNumber: true, residence: true,
  theme: true,
  lastLoginAt: true, createdAt: true, updatedAt: true,
} as const;

/** Identifiants des thèmes graphiques disponibles. */
const ALLOWED_THEMES = ['DEFAULT', 'AFRIKIMMO', 'DARK_GOLD'] as const;

/**
 * Enregistre les handlers IPC pour l'authentification.
 */
export function registerAuthIPC(): void {
  ipcMain.handle('auth:login', async (_event, { identifier, password }: { identifier: string; password: string }) => {
    try {
      const result = await login(identifier, password);
      return { success: true, data: result };
    } catch (error: any) {
      logger.warn(`Login failed for ${identifier}: ${error.message}`);
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
        select: PROFILE_SELECT,
      });
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:updateProfile', async (_event, { token, payload }: { token: string; payload: unknown }) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const parsed = updateProfileSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const user = await db.user.update({
        where: { id: session.userId, deletedAt: null },
        data: parsed.data,
        select: PROFILE_SELECT,
      });
      logger.info(`User ${user.email} updated own profile`);
      return { success: true, data: user };
    } catch (error: any) {
      // Code Prisma P2002 : violation d'unicité (email / login déjà pris).
      if (error?.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : 'champ unique';
        return { success: false, error: `Cette valeur est déjà utilisée (${target})` };
      }
      return { success: false, error: error.message };
    }
  });

  /**
   * Met à jour la préférence de thème graphique de l'utilisateur connecté.
   */
  ipcMain.handle('auth:updateTheme', async (_event, { token, theme }: { token: string; theme: string }) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const parsed = z.enum(ALLOWED_THEMES).safeParse(theme);
      if (!parsed.success) return { success: false, error: 'Thème invalide' };
      const db = getDb();
      const user = await db.user.update({
        where: { id: session.userId, deletedAt: null },
        data:  { theme: parsed.data },
        select: PROFILE_SELECT,
      });
      logger.info(`User ${user.email} switched to theme ${parsed.data}`);
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
