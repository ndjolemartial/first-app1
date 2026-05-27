import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const ownerBaseSchema = z.object({
  type: z.enum(['INDIVIDUEL', 'ENTREPRISE']).default('INDIVIDUEL'),
  // Particulier
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  nationality: z.string().optional(),
  idNumber: z.string().optional(),
  idTypeId: z.number().int().positive().nullable().optional(),
  // Entreprise
  companyName: z.string().optional(),
  registreCommerce: z.string().optional(),
  legalRepFirstName: z.string().optional(),
  legalRepLastName: z.string().optional(),
  legalRepPhone: z.string().optional(),
  legalRepIdNumber: z.string().optional(),
  legalRepIdTypeId: z.number().int().positive().nullable().optional(),
  // Commun
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('CI'),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  compte_contribuable: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Validation conditionnelle : la pièce d'identité du propriétaire particulier
 * et celle du représentant légal d'une entreprise sont obligatoires (KYC).
 */
const requireIdForOwner = (data: any, ctx: z.RefinementCtx): void => {
  if (data.type === 'INDIVIDUEL') {
    if (data.idTypeId == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idTypeId'], message: 'Type de pièce d’identité requis' });
    }
    if (!data.idNumber || String(data.idNumber).trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idNumber'], message: 'Numéro de pièce d’identité requis' });
    }
  }
  if (data.type === 'ENTREPRISE') {
    if (data.legalRepIdTypeId == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['legalRepIdTypeId'], message: 'Type de pièce d’identité du représentant requis' });
    }
    if (!data.legalRepIdNumber || String(data.legalRepIdNumber).trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['legalRepIdNumber'], message: 'Numéro de pièce d’identité du représentant requis' });
    }
  }
};

const ownerSchema = ownerBaseSchema.superRefine(requireIdForOwner);
const ownerUpdateSchema = ownerBaseSchema.partial().superRefine(requireIdForOwner);

// Module Propriétaires : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES  = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Sérialise les objets Prisma (notamment Decimal) pour le canal IPC. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Enregistre les handlers IPC pour la gestion des propriétaires.
 */
export function registerOwnersIPC(): void {
  ipcMain.handle('owners:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.type) where.type = filters.type;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { companyName: { contains: filters.search } },
          { email: { contains: filters.search } },
          { phone: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.owner.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { properties: true } } },
        }),
        db.owner.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('owners:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('owners:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const owner = await db.owner.findUnique({
        where: { id, deletedAt: null },
        include: {
          properties: {
            where: { deletedAt: null },
            select: {
              id: true, reference: true, type: true, status: true,
              address: true, city: true, rentPrice: true, salePrice: true,
            },
          },
          documents: { orderBy: { uploadedAt: 'desc' } },
          activities: { orderBy: { createdAt: 'desc' }, take: 20 },
          idType:         { select: { id: true, code: true, label: true } },
          legalRepIdType: { select: { id: true, code: true, label: true } },
        },
      });
      if (!owner) return { success: false, error: 'Propriétaire introuvable' };
      return { success: true, data: ser(owner) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('owners:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = ownerSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data: any = { ...parsed.data };
      if (data.email === '') data.email = undefined;
      const owner = await db.owner.create({ data });
      logger.info(`Owner created: id=${owner.id}`);
      return { success: true, data: owner };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('owners:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = ownerUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data: any = { ...parsed.data };
      if (data.email === '') data.email = undefined;
      const owner = await db.owner.update({ where: { id, deletedAt: null }, data });
      return { success: true, data: owner };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('owners:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const db = getDb();
      await db.owner.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('owners:portfolio', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const properties = await db.property.findMany({
        where: { ownerId: id, deletedAt: null },
        include: {
          conventionLinks: {
            where: { convention: { deletedAt: null, status: 'ACTIVE' } },
            select: { convention: { select: { rentAmount: true, type: true } } },
          },
        },
      });
      const totalRentIncome = properties.reduce((sum, p) => {
        const rent = p.conventionLinks.reduce(
          (s: number, l: { convention: { rentAmount: unknown } }) =>
            s + Number(l.convention.rentAmount ?? 0),
          0,
        );
        return sum + rent;
      }, 0);
      return { success: true, data: ser({ properties, totalRentIncome }) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
