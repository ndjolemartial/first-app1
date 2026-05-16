"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTerrainsIPC = registerTerrainsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const terrainSchema = zod_1.z.object({
    lotissementId: zod_1.z.coerce.number().int().positive('Lotissement requis'),
    ownerId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    clientId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    numeroIlot: zod_1.z.string().optional(),
    numeroParcelle: zod_1.z.string().optional(),
    statut: zod_1.z.enum(['DISPONIBLE', 'RESERVE', 'VENDU', 'SOUS_OPTION']).default('DISPONIBLE'),
    surface: zod_1.z.coerce.number().positive().optional().nullable(),
    prixVente: zod_1.z.coerce.number().positive().optional().nullable(),
    viabilise: zod_1.z.boolean().default(false),
    numeroADU: zod_1.z.string().optional(),
    numeroAttestationAttribution: zod_1.z.string().optional(),
    numeroAttestationCession: zod_1.z.string().optional(),
    numeroDM: zod_1.z.string().optional(),
    titreFoncier: zod_1.z.string().optional(),
    numeroACD: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    latitude: zod_1.z.coerce.number().optional().nullable(),
    longitude: zod_1.z.coerce.number().optional().nullable(),
});
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];
const ser = (v) => JSON.parse(JSON.stringify(v));
/**
 * Génère la prochaine référence TER-YYYY-NNNN.
 */
async function nextReference(db) {
    const year = new Date().getFullYear();
    const last = await db.terrain.findFirst({
        where: { reference: { startsWith: `TER-${year}-` } },
        orderBy: { reference: 'desc' },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `TER-${year}-${String(seq).padStart(4, '0')}`;
}
/**
 * Enregistre les handlers IPC pour la gestion des terrains.
 */
function registerTerrainsIPC() {
    electron_1.ipcMain.handle('terrains:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.lotissementId)
                where.lotissementId = Number(filters.lotissementId);
            if (filters.statut)
                where.statut = filters.statut;
            if (filters.viabilise !== undefined)
                where.viabilise = filters.viabilise;
            if (filters.clientId)
                where.clientId = Number(filters.clientId);
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { numeroParcelle: { contains: filters.search } },
                    { numeroIlot: { contains: filters.search } },
                    { titreFoncier: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.terrain.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: [{ lotissementId: 'asc' }, { numeroIlot: 'asc' }, { numeroParcelle: 'asc' }],
                    include: {
                        lotissement: { select: { id: true, reference: true, nom: true, ville: true } },
                        client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                    },
                }),
                db.terrain.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('terrains:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const terrain = await db.terrain.findUnique({
                where: { id, deletedAt: null },
                include: {
                    lotissement: true,
                    owner: true,
                    client: true,
                    documents: { orderBy: { uploadedAt: 'desc' } },
                    photos: { orderBy: { order: 'asc' } },
                    activities: { orderBy: { createdAt: 'desc' }, take: 20 },
                },
            });
            if (!terrain)
                return { success: false, error: 'Terrain introuvable' };
            return ser({ success: true, data: terrain });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = terrainSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const data = { ...parsed.data, reference };
            if (data.ownerId === null || data.ownerId === undefined)
                delete data.ownerId;
            if (data.clientId === null || data.clientId === undefined)
                delete data.clientId;
            if (data.prixVente === null)
                delete data.prixVente;
            const terrain = await db.terrain.create({ data });
            logger_1.default.info(`Terrain créé: ${terrain.reference}`);
            return ser({ success: true, data: terrain });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = terrainSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            const terrain = await db.terrain.update({ where: { id, deletedAt: null }, data });
            return ser({ success: true, data: terrain });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:updateStatut', async (_event, { token, id, statut }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const terrain = await db.terrain.update({ where: { id }, data: { statut } });
            return ser({ success: true, data: terrain });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.terrain.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
