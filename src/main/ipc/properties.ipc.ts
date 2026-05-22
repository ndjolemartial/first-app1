import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

// Module Biens : MANAGER+ (ACCOUNTANT inclus via checkRole) ont un accès complet.
// AGENT et READONLY peuvent consulter uniquement les biens DISPONIBLE (lecture seule).
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES  = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
/** Rôles disposant d'une vue globale (sans filtrage par statut). */
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
function hasFullView(role: string): boolean {
  return FULL_VIEW_ROLES.includes(role);
}

/** Sérialise pour l'IPC : les Decimal Prisma ne sont pas clonables par Electron. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const propertyBaseSchema = z.object({
  // Origine du bien : propriétaire OU programme immobilier (jamais les deux).
  ownerId: z.number().int().positive().nullable().optional(),
  programmeId: z.number().int().positive().nullable().optional(),
  type: z.enum(['APARTEMENT', 'DUPLEX', 'VILLA', 'STUDIO', 'BUREAU', 'PARKING', 'AUTRE']),
  status: z.enum(['DISPONIBLE', 'INDISPONIBLE', 'EN_LOCATION', 'SOLDE', 'SOUS_OPTION', 'EN_RENOVATION']).default('DISPONIBLE'),
  address: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().optional(),
  country: z.string().default('CI'),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  surface: z.number().positive().nullable().optional(),
  surfaceCarrez: z.number().optional(),
  rooms: z.number().int().optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().int().optional(),
  floor: z.number().int().optional(),
  totalFloors: z.number().int().optional(),
  buildYear: z.number().int().optional(),
  condition: z.enum(['NOUVEAU', 'EXCELLENT', 'BON', 'MOYEN', 'MAUVAIS']).optional(),
  garage: z.string().optional(),
  cuisine: z.string().optional(),
  terrasseBalcon: z.string().optional(),
  rentPrice: z.number().optional(),
  salePrice: z.number().optional(),
  charges: z.number().optional(),
  taxeFonciere: z.number().optional(),
  description: z.string().optional(),
  amenities: z.array(z.string()).optional(),
});

/** Un bien ne peut provenir à la fois d'un propriétaire et d'un programme. */
const exclusiveSource = (d: { ownerId?: number | null; programmeId?: number | null }) =>
  !(d.ownerId && d.programmeId);
const SOURCE_ERROR = {
  message: 'Un bien ne peut pas être rattaché à la fois à un propriétaire et à un programme',
  path: ['programmeId'],
};

const propertyCreateSchema = propertyBaseSchema.refine(exclusiveSource, SOURCE_ERROR);
const propertyUpdateSchema = propertyBaseSchema.partial().refine(exclusiveSource, SOURCE_ERROR);

/**
 * Génère la prochaine référence de bien : BN-YYYY-NNNN
 */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.property.findFirst({
    where: { reference: { startsWith: `BN-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `BN-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Enregistre les handlers IPC pour la gestion des biens immobiliers.
 */
export function registerPropertiesIPC(): void {
  ipcMain.handle('properties:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      if (filters.ownerId) where.ownerId = filters.ownerId;
      if (filters.programmeId) where.programmeId = filters.programmeId;
      // AGENT / READONLY ne voient que les biens DISPONIBLE (statut imposé).
      if (!hasFullView(session.role)) where.status = 'DISPONIBLE';
      if (filters.city) where.city = { contains: filters.city };
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { address: { contains: filters.search } },
          { city: { contains: filters.search } },
          { description: { contains: filters.search } },
          { owner: { firstName: { contains: filters.search } } },
          { owner: { lastName: { contains: filters.search } } },
          { owner: { companyName: { contains: filters.search } } },
          { programme: { nom: { contains: filters.search } } },
          { programme: { reference: { contains: filters.search } } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.property.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
            programme: { select: { id: true, reference: true, nom: true } },
            _count: { select: { conventions: { where: { deletedAt: null } } } },
          },
        }),
        db.property.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('properties:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('properties:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const property = await db.property.findUnique({
        where: { id, deletedAt: null },
        include: {
          owner: true,
          programme: true,
          conventions: {
            where: { deletedAt: null },
            include: {
              client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          photos: { orderBy: { order: 'asc' } },
          documents: { orderBy: { uploadedAt: 'desc' } },
        },
      });
      if (!property) return { success: false, error: 'Bien introuvable' };
      // AGENT / READONLY ne peuvent consulter qu'un bien DISPONIBLE.
      if (!hasFullView(session.role) && property.status !== 'DISPONIBLE') {
        return { success: false, error: 'Bien inaccessible' };
      }
      return ser({ success: true, data: property });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('properties:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = propertyCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db);
      const d = parsed.data;
      const createData: any = {
        reference,
        ownerId: d.ownerId ?? null,
        programmeId: d.programmeId ?? null,
        type: d.type,
        status: d.status,
        address: d.address,
        city: d.city,
        country: d.country,
        surface: d.surface,
        addressLine2: d.addressLine2,
        postalCode: d.postalCode ?? null,
        latitude: d.latitude,
        longitude: d.longitude,
        surfaceCarrez: d.surfaceCarrez,
        rooms: d.rooms,
        bedrooms: d.bedrooms,
        bathrooms: d.bathrooms,
        floor: d.floor,
        totalFloors: d.totalFloors,
        buildYear: d.buildYear,
        condition: d.condition,
        garage: d.garage,
        cuisine: d.cuisine,
        terrasseBalcon: d.terrasseBalcon,
        rentPrice: d.rentPrice,
        salePrice: d.salePrice,
        charges: d.charges,
        taxeFonciere: d.taxeFonciere,
        description: d.description,
        amenities: d.amenities ? JSON.stringify(d.amenities) : undefined,
      };
      const property = await db.property.create({ data: createData });
      logger.info(`Property created: ${property.reference}`);
      return ser({ success: true, data: property });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('properties:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = propertyUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d2 = parsed.data;
      const updateData: any = { ...d2 };
      if (d2.amenities !== undefined) updateData.amenities = JSON.stringify(d2.amenities);
      const property = await db.property.update({ where: { id, deletedAt: null }, data: updateData });
      return ser({ success: true, data: property });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('properties:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
      const db = getDb();
      await db.property.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('properties:updateStatus', async (_event, { token, id, status }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const property = await db.property.update({
        where: { id, deletedAt: null },
        data: { status },
        select: { id: true, status: true },
      });
      return ser({ success: true, data: property });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
