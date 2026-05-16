import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const clientSchema = z.object({
  type: z.enum(['INDIVIDUEL', 'ENTREPRISE']).default('INDIVIDUEL'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  civilite: z.enum(['MONSIEUR', 'MADAME', 'MADEMOISELLE']).optional(),
  statutConjugal: z.enum(['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE']).optional(),
  entreprise: z.string().optional(),
  registre_de_commerce: z.string().optional(),
  compte_contribuable: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('CI'),
  nationality: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  idNumber: z.string().optional(),
  fatherFirstName: z.string().optional(),
  fatherLastName: z.string().optional(),
  motherFirstName: z.string().optional(),
  motherLastName: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['ACTIF', 'INACTIF', 'VIP', 'SUSPENDU']).optional(),
});

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];

/** Convertit les chaînes vides en undefined pour éviter les échecs de validation Zod sur les enums */
function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === '' ? undefined : v])
  );
}

/**
 * Enregistre les handlers IPC pour la gestion des clients.
 */
export function registerClientsIPC(): void {
  ipcMain.handle('clients:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { entreprise: { contains: filters.search } },
          { email: { contains: filters.search } },
          { phone: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.client.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { contracts: true } } },
        }),
        db.client.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('clients:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const client = await db.client.findUnique({
        where: { id, deletedAt: null },
        include: {
          contracts: {
            where: { deletedAt: null },
            include: { property: { select: { reference: true, address: true, city: true } } },
            orderBy: { createdAt: 'desc' },
          },
          documents: { orderBy: { uploadedAt: 'desc' } },
          activities: { orderBy: { createdAt: 'desc' }, take: 20 },
          invoices: { where: { deletedAt: null }, orderBy: { issueDate: 'desc' }, take: 10 },
          prospect: { select: { id: true, status: true } },
        },
      });
      if (!client) return { success: false, error: 'Client introuvable' };
      return { success: true, data: client };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const cleaned = stripEmpty(payload);
      const parsed = clientSchema.safeParse(cleaned);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data: any = { ...parsed.data };
      if (data.birthDate) data.birthDate = new Date(data.birthDate);
      const client = await db.client.create({ data });
      logger.info(`Client created: id=${client.id}`);
      return { success: true, data: client };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const cleaned = stripEmpty(payload);
      const parsed = clientSchema.partial().safeParse(cleaned);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data: any = { ...parsed.data };
      if (data.birthDate) data.birthDate = new Date(data.birthDate);
      const client = await db.client.update({ where: { id, deletedAt: null }, data });
      return { success: true, data: client };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const db = getDb();
      await db.client.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:toggleActive', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const client = await db.client.findUnique({ where: { id }, select: { isActive: true } });
      if (!client) return { success: false, error: 'Client introuvable' };
      const updated = await db.client.update({
        where: { id },
        data: { isActive: !client.isActive },
        select: { id: true, isActive: true },
      });
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:updateStatus', async (_event, { token, id, status }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = z.enum(['ACTIF', 'INACTIF', 'VIP', 'SUSPENDU']).safeParse(status);
      if (!parsed.success) return { success: false, error: 'Statut invalide' };
      const db = getDb();
      const updated = await db.client.update({
        where: { id, deletedAt: null },
        data: { status: parsed.data },
        select: { id: true, status: true },
      });
      logger.info(`Client #${id} status updated to ${parsed.data}`);
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
