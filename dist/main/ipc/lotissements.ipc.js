"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLotissementsIPC = registerLotissementsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const lotissementSchema = zod_1.z.object({
    nom: zod_1.z.string().min(1),
    commune: zod_1.z.string().optional(),
    quartier: zod_1.z.string().optional(),
    ville: zod_1.z.string().min(1),
    pays: zod_1.z.string().default('CI'),
    surface: zod_1.z.coerce.number().positive().optional(),
    nombreParcelles: zod_1.z.coerce.number().int().positive().optional(),
    promoteur: zod_1.z.string().optional(),
    statut: zod_1.z.enum(['EN_COURS_LOTISSEMENT', 'EN_COURS', 'OUVERT', 'PARTIELLEMENT_VENDU', 'COMPLET', 'FERME']).default('EN_COURS_LOTISSEMENT'),
    description: zod_1.z.string().optional(),
    latitude: zod_1.z.coerce.number().optional(),
    longitude: zod_1.z.coerce.number().optional(),
    // Montant standard des frais de démarches ACD applicable sur ce lotissement.
    fraisDemarchesAcdStandard: zod_1.z.coerce.number().nonnegative().optional().nullable(),
    // Nature du titre administratif sollicité (référentiel) et numéro du titre obtenu.
    titleTypeId: zod_1.z.coerce.number().int().positive().nullable().optional(),
    titleNumber: zod_1.z.string().optional(),
});
// Module Lotissements : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const ser = (v) => JSON.parse(JSON.stringify(v));
/**
 * Génère la prochaine référence LOT-YYYY-NNNN.
 */
async function nextReference(db) {
    const year = new Date().getFullYear();
    const last = await db.lotissement.findFirst({
        where: { reference: { startsWith: `LOT-${year}-` } },
        orderBy: { reference: 'desc' },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `LOT-${year}-${String(seq).padStart(4, '0')}`;
}
/**
 * Enregistre les handlers IPC pour la gestion des lotissements.
 */
function registerLotissementsIPC() {
    electron_1.ipcMain.handle('lotissements:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.statut)
                where.statut = filters.statut;
            if (filters.ville)
                where.ville = { contains: filters.ville };
            if (filters.search) {
                where.OR = [
                    { nom: { contains: filters.search } },
                    { reference: { contains: filters.search } },
                    { commune: { contains: filters.search } },
                    { quartier: { contains: filters.search } },
                    { promoteur: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.lotissement.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { _count: { select: { terrains: true } } },
                }),
                db.lotissement.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('lotissements:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('lotissements:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const lot = await db.lotissement.findUnique({
                where: { id, deletedAt: null },
                include: {
                    terrains: {
                        where: { deletedAt: null },
                        select: {
                            id: true, reference: true, numeroParcelle: true, numeroIlot: true,
                            statut: true, surface: true, prixVente: true, viabilise: true,
                        },
                        orderBy: { reference: 'asc' },
                    },
                    documents: { orderBy: { uploadedAt: 'desc' } },
                    titleType: { select: { id: true, code: true, label: true } },
                },
            });
            if (!lot)
                return { success: false, error: 'Lotissement introuvable' };
            return ser({ success: true, data: lot });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('lotissements:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = lotissementSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const lot = await db.lotissement.create({ data: { ...parsed.data, reference } });
            logger_1.default.info(`Lotissement créé: ${lot.reference}`);
            return ser({ success: true, data: lot });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('lotissements:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = lotissementSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const lot = await db.lotissement.update({ where: { id, deletedAt: null }, data: parsed.data });
            return ser({ success: true, data: lot });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('lotissements:statusStats', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.ville)
                where.ville = { contains: filters.ville };
            if (filters.search) {
                where.OR = [
                    { nom: { contains: filters.search } },
                    { reference: { contains: filters.search } },
                    { commune: { contains: filters.search } },
                    { quartier: { contains: filters.search } },
                    { promoteur: { contains: filters.search } },
                ];
            }
            const rows = await db.lotissement.groupBy({
                by: ['statut'],
                where,
                _count: { _all: true },
            });
            const stats = {
                EN_COURS_LOTISSEMENT: 0, EN_COURS: 0, OUVERT: 0,
                PARTIELLEMENT_VENDU: 0, COMPLET: 0, FERME: 0,
            };
            let total = 0;
            for (const r of rows) {
                const n = r._count?._all ?? 0;
                stats[r.statut] = n;
                total += n;
            }
            return { success: true, data: { ...stats, total } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('lotissements:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.lotissement.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
