"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPropertiesIPC = registerPropertiesIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];
const propertySchema = zod_1.z.object({
    ownerId: zod_1.z.number().int().positive(),
    type: zod_1.z.enum(['APARTEMENT', 'DUPLEX', 'VILLA', 'STUDIO', 'BUREAU', 'PARKING', 'AUTRE']),
    status: zod_1.z.enum(['DISPONIBLE', 'INDISPONIBLE', 'EN_LOCATION', 'SOLDE', 'SOUS_OPTION', 'EN_RENOVATION']).default('DISPONIBLE'),
    address: zod_1.z.string().min(1),
    addressLine2: zod_1.z.string().optional(),
    city: zod_1.z.string().min(1),
    postalCode: zod_1.z.string().optional(),
    country: zod_1.z.string().default('CI'),
    latitude: zod_1.z.number().min(-90).max(90).nullable().optional(),
    longitude: zod_1.z.number().min(-180).max(180).nullable().optional(),
    surface: zod_1.z.number().positive(),
    surfaceCarrez: zod_1.z.number().optional(),
    rooms: zod_1.z.number().int().optional(),
    bedrooms: zod_1.z.number().int().optional(),
    bathrooms: zod_1.z.number().int().optional(),
    floor: zod_1.z.number().int().optional(),
    totalFloors: zod_1.z.number().int().optional(),
    buildYear: zod_1.z.number().int().optional(),
    condition: zod_1.z.enum(['NOUVEAU', 'EXCELLENT', 'BON', 'MOYEN', 'MAUVAIS']).optional(),
    rentPrice: zod_1.z.number().optional(),
    salePrice: zod_1.z.number().optional(),
    charges: zod_1.z.number().optional(),
    taxeFonciere: zod_1.z.number().optional(),
    description: zod_1.z.string().optional(),
    amenities: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * Génère la prochaine référence de bien : BN-YYYY-NNNN
 */
async function nextReference(db) {
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
function registerPropertiesIPC() {
    electron_1.ipcMain.handle('properties:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.type)
                where.type = filters.type;
            if (filters.status)
                where.status = filters.status;
            if (filters.ownerId)
                where.ownerId = filters.ownerId;
            if (filters.city)
                where.city = { contains: filters.city };
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { address: { contains: filters.search } },
                    { city: { contains: filters.search } },
                    { description: { contains: filters.search } },
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
                        _count: { select: { contracts: { where: { deletedAt: null } } } },
                    },
                }),
                db.property.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('properties:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('properties:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const property = await db.property.findUnique({
                where: { id, deletedAt: null },
                include: {
                    owner: true,
                    contracts: {
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
            if (!property)
                return { success: false, error: 'Bien introuvable' };
            return { success: true, data: property };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('properties:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = propertySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const d = parsed.data;
            const createData = {
                reference,
                ownerId: d.ownerId,
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
                rentPrice: d.rentPrice,
                salePrice: d.salePrice,
                charges: d.charges,
                taxeFonciere: d.taxeFonciere,
                description: d.description,
                amenities: d.amenities ? JSON.stringify(d.amenities) : undefined,
            };
            const property = await db.property.create({ data: createData });
            logger_1.default.info(`Property created: ${property.reference}`);
            return { success: true, data: property };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('properties:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = propertySchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d2 = parsed.data;
            const updateData = { ...d2 };
            if (d2.amenities !== undefined)
                updateData.amenities = JSON.stringify(d2.amenities);
            const property = await db.property.update({ where: { id, deletedAt: null }, data: updateData });
            return { success: true, data: property };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('properties:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.property.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('properties:updateStatus', async (_event, { token, id, status }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const property = await db.property.update({
                where: { id, deletedAt: null },
                data: { status },
                select: { id: true, status: true },
            });
            return { success: true, data: property };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
