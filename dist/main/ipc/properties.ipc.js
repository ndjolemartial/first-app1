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
// Module Biens : MANAGER+ (ACCOUNTANT inclus via checkRole) ont un accès complet.
// AGENT et READONLY peuvent consulter uniquement les biens DISPONIBLE (lecture seule).
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
/** Rôles disposant d'une vue globale (sans filtrage par statut). */
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
function hasFullView(role) {
    return FULL_VIEW_ROLES.includes(role);
}
/** Sérialise pour l'IPC : les Decimal Prisma ne sont pas clonables par Electron. */
const ser = (v) => JSON.parse(JSON.stringify(v));
const propertyBaseSchema = zod_1.z.object({
    // Origine du bien : propriétaire OU programme immobilier (jamais les deux).
    ownerId: zod_1.z.number().int().positive().nullable().optional(),
    programmeId: zod_1.z.number().int().positive().nullable().optional(),
    // Client rattaché (visible quand le statut n'est pas DISPONIBLE).
    clientId: zod_1.z.number().int().positive().nullable().optional(),
    type: zod_1.z.enum(['APARTEMENT', 'DUPLEX', 'VILLA', 'STUDIO', 'BUREAU', 'PARKING', 'AUTRE']),
    status: zod_1.z.enum(['DISPONIBLE', 'RESERVE', 'SOUS_OPTION', 'VENDU', 'EN_LOCATION', 'EN_RENOVATION', 'INDISPONIBLE']).default('DISPONIBLE'),
    address: zod_1.z.string().min(1),
    addressLine2: zod_1.z.string().optional(),
    city: zod_1.z.string().min(1),
    postalCode: zod_1.z.string().optional(),
    country: zod_1.z.string().default('CI'),
    latitude: zod_1.z.number().min(-90).max(90).nullable().optional(),
    longitude: zod_1.z.number().min(-180).max(180).nullable().optional(),
    surface: zod_1.z.number().positive().nullable().optional(),
    surfaceCarrez: zod_1.z.number().optional(),
    rooms: zod_1.z.number().int().optional(),
    bedrooms: zod_1.z.number().int().optional(),
    bathrooms: zod_1.z.number().int().optional(),
    floor: zod_1.z.number().int().optional(),
    totalFloors: zod_1.z.number().int().optional(),
    buildYear: zod_1.z.number().int().optional(),
    condition: zod_1.z.enum(['NOUVEAU', 'EXCELLENT', 'BON', 'MOYEN', 'MAUVAIS']).optional(),
    garage: zod_1.z.string().optional(),
    cuisine: zod_1.z.string().optional(),
    terrasseBalcon: zod_1.z.string().optional(),
    rentPrice: zod_1.z.number().optional(),
    salePrice: zod_1.z.number().optional(),
    charges: zod_1.z.number().optional(),
    taxeFonciere: zod_1.z.number().optional(),
    description: zod_1.z.string().optional(),
    amenities: zod_1.z.array(zod_1.z.string()).optional(),
});
/** Un bien ne peut provenir à la fois d'un propriétaire et d'un programme. */
const exclusiveSource = (d) => !(d.ownerId && d.programmeId);
const SOURCE_ERROR = {
    message: 'Un bien ne peut pas être rattaché à la fois à un propriétaire et à un programme',
    path: ['programmeId'],
};
/** Statuts pour lesquels un client rattaché est obligatoire. */
const STATUS_REQUIRING_CLIENT = ['RESERVE', 'SOUS_OPTION', 'VENDU', 'EN_LOCATION'];
function statusNeedsClient(s) {
    return !!s && STATUS_REQUIRING_CLIENT.includes(s);
}
const propertyCreateSchema = propertyBaseSchema
    .refine(exclusiveSource, SOURCE_ERROR)
    .refine((d) => !statusNeedsClient(d.status) || !!d.clientId, {
    message: 'Un client doit être rattaché pour ce statut',
    path: ['clientId'],
});
const propertyUpdateSchema = propertyBaseSchema.partial().refine(exclusiveSource, SOURCE_ERROR);
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
            if (filters.programmeId)
                where.programmeId = filters.programmeId;
            // AGENT / READONLY ne voient que les biens DISPONIBLE (statut imposé).
            if (!hasFullView(session.role))
                where.status = 'DISPONIBLE';
            if (filters.city)
                where.city = { contains: filters.city };
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
                        client: { select: { id: true, type: true, firstName: true, lastName: true, entreprise: true } },
                        _count: { select: { conventionLinks: { where: { convention: { deletedAt: null } } } } },
                    },
                }),
                db.property.count({ where }),
            ]);
            return ser({ success: true, data, total });
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
                    programme: true,
                    client: { select: { id: true, type: true, firstName: true, lastName: true, entreprise: true, email: true, phone: true } },
                    conventionLinks: {
                        where: { convention: { deletedAt: null } },
                        include: {
                            convention: {
                                include: {
                                    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                                },
                            },
                        },
                        orderBy: { convention: { createdAt: 'desc' } },
                    },
                    photos: { orderBy: { order: 'asc' } },
                    documents: { orderBy: { uploadedAt: 'desc' } },
                },
            });
            if (!property)
                return { success: false, error: 'Bien introuvable' };
            // AGENT / READONLY ne peuvent consulter qu'un bien DISPONIBLE.
            if (!hasFullView(session.role) && property.status !== 'DISPONIBLE') {
                return { success: false, error: 'Bien inaccessible' };
            }
            return ser({ success: true, data: property });
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
            const parsed = propertyCreateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const d = parsed.data;
            // Un bien DISPONIBLE ne peut pas avoir de client rattaché.
            const effectiveClientId = d.status === 'DISPONIBLE' ? null : (d.clientId ?? null);
            const createData = {
                reference,
                ownerId: d.ownerId ?? null,
                programmeId: d.programmeId ?? null,
                clientId: effectiveClientId,
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
            logger_1.default.info(`Property created: ${property.reference}`);
            return ser({ success: true, data: property });
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
            const parsed = propertyUpdateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d2 = parsed.data;
            const updateData = { ...d2 };
            if (d2.amenities !== undefined)
                updateData.amenities = JSON.stringify(d2.amenities);
            // Vide automatiquement le client si le statut repasse à DISPONIBLE.
            if (d2.status === 'DISPONIBLE')
                updateData.clientId = null;
            // Vérifie qu'un client reste rattaché pour les statuts qui l'exigent
            // (en fusionnant l'état actuel avec la mise à jour partielle).
            if (d2.status && statusNeedsClient(d2.status)) {
                const nextClientId = d2.clientId !== undefined
                    ? d2.clientId
                    : (await db.property.findUnique({ where: { id }, select: { clientId: true } }))?.clientId ?? null;
                if (!nextClientId) {
                    return { success: false, error: 'Un client doit être rattaché pour ce statut' };
                }
            }
            const property = await db.property.update({ where: { id, deletedAt: null }, data: updateData });
            return ser({ success: true, data: property });
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
    electron_1.ipcMain.handle('properties:statusStats', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.type)
                where.type = filters.type;
            if (filters.ownerId)
                where.ownerId = filters.ownerId;
            if (filters.programmeId)
                where.programmeId = filters.programmeId;
            if (!hasFullView(session.role))
                where.status = 'DISPONIBLE';
            if (filters.city)
                where.city = { contains: filters.city };
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
            const rows = await db.property.groupBy({
                by: ['status'],
                where,
                _count: { _all: true },
            });
            const stats = {
                DISPONIBLE: 0, RESERVE: 0, SOUS_OPTION: 0, VENDU: 0,
                EN_LOCATION: 0, EN_RENOVATION: 0, INDISPONIBLE: 0,
            };
            let total = 0;
            for (const r of rows) {
                const n = r._count?._all ?? 0;
                stats[r.status] = n;
                total += n;
            }
            return { success: true, data: { ...stats, total } };
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
            // Refuse les statuts qui exigent un client si aucun n'est rattaché.
            if (statusNeedsClient(status)) {
                const existing = await db.property.findUnique({ where: { id }, select: { clientId: true } });
                if (!existing?.clientId) {
                    return { success: false, error: 'Un client doit être rattaché pour ce statut' };
                }
            }
            // Le passage en DISPONIBLE supprime automatiquement le client rattaché.
            const data = { status };
            if (status === 'DISPONIBLE')
                data.clientId = null;
            const property = await db.property.update({
                where: { id, deletedAt: null },
                data,
                select: { id: true, status: true, clientId: true },
            });
            return ser({ success: true, data: property });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
