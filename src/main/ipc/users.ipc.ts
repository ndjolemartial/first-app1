import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { hashPassword } from '../utils/crypto';
import logger from '../utils/logger';
import { z } from 'zod';

const createUserSchema = z.object({
  matricule: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  login: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'READONLY']),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  fonction: z.string().optional(),
  idNumber: z.string().optional(),
  civilite: z.enum(['MONSIEUR', 'MADAME', 'MADEMOISELLE']).optional(),
  statutConjugal: z.enum(['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE']).optional(),
  hireDate: z.string().optional(),
  cnpsNumber: z.string().optional(),
  residence: z.string().optional(),
});

const updateUserSchema = createUserSchema
  .omit({ password: true })
  .extend({ isActive: z.boolean().optional() })
  .partial();

/**
 * Enregistre les handlers IPC pour la gestion des utilisateurs.
 */
export function registerUsersIPC(): void {
  ipcMain.handle('users:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.role) where.role = filters.role;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { email: { contains: filters.search } },
          { matricule: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.user.findMany({
          where,
          select: {
            id: true, uuid: true, matricule: true, firstName: true, lastName: true,
            email: true, role: true, isActive: true, avatar: true, phone: true,
            mobile: true, lastLoginAt: true, createdAt: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        db.user.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('users:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const db = getDb();
      const user = await db.user.findUnique({
        where: { id, deletedAt: null },
        select: {
          id: true, uuid: true, matricule: true, firstName: true, lastName: true,
          email: true, login: true, role: true, isActive: true, avatar: true, phone: true,
          mobile: true, fonction: true, idNumber: true, civilite: true,
          statutConjugal: true, hireDate: true, cnpsNumber: true, residence: true,
          lastLoginAt: true, createdAt: true, updatedAt: true,
        },
      });
      if (!user) return { success: false, error: 'Utilisateur introuvable' };
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const parsed = createUserSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const { password, hireDate, ...rest } = parsed.data;
      const hashed = await hashPassword(password);
      const user = await db.user.create({
        data: { ...rest, password: hashed, hireDate: hireDate ? new Date(hireDate) : null },
        select: {
          id: true, uuid: true, matricule: true, firstName: true, lastName: true,
          email: true, role: true, isActive: true,
        },
      });
      logger.info(`User created: ${user.email}`);
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const parsed = updateUserSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const { hireDate, ...rest } = parsed.data;
      const data: any = { ...rest };
      if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null;
      const user = await db.user.update({
        where: { id, deletedAt: null },
        data,
        select: {
          id: true, uuid: true, firstName: true, lastName: true, email: true,
          role: true, isActive: true,
        },
      });
      return { success: true, data: user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:resetPassword', async (_event, { token, id, newPassword }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      if (!newPassword || newPassword.length < 6)
        return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' };
      const db = getDb();
      const hashed = await hashPassword(newPassword);
      await db.user.update({ where: { id }, data: { password: hashed } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('users:toggleActive', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const db = getDb();
      const user = await db.user.findUnique({ where: { id }, select: { isActive: true } });
      if (!user) return { success: false, error: 'Utilisateur introuvable' };
      const updated = await db.user.update({
        where: { id },
        data: { isActive: !user.isActive },
        select: { id: true, isActive: true },
      });
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
