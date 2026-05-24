"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProgrammesIPC = registerProgrammesIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const programmeSchema = zod_1.z.object({
    nom: zod_1.z.string().min(1),
    type: zod_1.z.enum(['RESIDENTIEL', 'COMMERCIAL', 'MIXTE']).default('RESIDENTIEL'),
    promoteur: zod_1.z.string().optional(),
    commune: zod_1.z.string().optional(),
    quartier: zod_1.z.string().optional(),
    ville: zod_1.z.string().min(1),
    pays: zod_1.z.string().default('CI'),
    surface: zod_1.z.coerce.number().positive().optional(),
    nombreLogements: zod_1.z.coerce.number().int().positive().optional(),
    dateDebut: zod_1.z.coerce.date().optional(),
    dateLivraisonPrevue: zod_1.z.coerce.date().optional(),
    statut: zod_1.z
        .enum(['EN_PROJET', 'EN_CONSTRUCTION', 'EN_COMMERCIALISATION', 'LIVRE', 'CLOTURE'])
        .default('EN_PROJET'),
    description: zod_1.z.string().optional(),
    latitude: zod_1.z.coerce.number().optional(),
    longitude: zod_1.z.coerce.number().optional(),
});
// Module Programmes immobiliers : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Sérialise pour l'IPC : les Decimal/Date Prisma ne sont pas clonables par Electron. */
const ser = (v) => JSON.parse(JSON.stringify(v));
/**
 * Génère la prochaine référence de programme : PROG-YYYY-NNNN.
 */
async function nextReference(db) {
    const year = new Date().getFullYear();
    const last = await db.programmeImmobilier.findFirst({
        where: { reference: { startsWith: `PROG-${year}-` } },
        orderBy: { reference: 'desc' },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `PROG-${year}-${String(seq).padStart(4, '0')}`;
}
/**
 * Enregistre les handlers IPC pour la gestion des programmes immobiliers.
 */
function registerProgrammesIPC() {
    electron_1.ipcMain.handle('programmes:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.statut)
                where.statut = filters.statut;
            if (filters.type)
                where.type = filters.type;
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
                db.programmeImmobilier.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        _count: {
                            select: {
                                properties: { where: { deletedAt: null } },
                                terrains: { where: { deletedAt: null } },
                            },
                        },
                    },
                }),
                db.programmeImmobilier.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('programmes:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('programmes:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const programme = await db.programmeImmobilier.findUnique({
                where: { id, deletedAt: null },
                include: {
                    properties: {
                        where: { deletedAt: null },
                        select: {
                            id: true, reference: true, type: true, status: true,
                            city: true, surface: true, rentPrice: true, salePrice: true,
                        },
                        orderBy: { reference: 'asc' },
                    },
                    terrains: {
                        where: { deletedAt: null },
                        select: {
                            id: true, reference: true, numeroParcelle: true, numeroIlot: true,
                            statut: true, surface: true, prixVente: true,
                        },
                        orderBy: { reference: 'asc' },
                    },
                    documents: { orderBy: { uploadedAt: 'desc' } },
                },
            });
            if (!programme)
                return { success: false, error: 'Programme immobilier introuvable' };
            return ser({ success: true, data: programme });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('programmes:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = programmeSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const programme = await db.programmeImmobilier.create({ data: { ...parsed.data, reference } });
            logger_1.default.info(`Programme immobilier créé: ${programme.reference}`);
            return ser({ success: true, data: programme });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('programmes:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = programmeSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const programme = await db.programmeImmobilier.update({
                where: { id, deletedAt: null },
                data: parsed.data,
            });
            return ser({ success: true, data: programme });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('programmes:statusStats', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.type)
                where.type = filters.type;
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
            const rows = await db.programmeImmobilier.groupBy({
                by: ['statut'],
                where,
                _count: { _all: true },
            });
            const stats = {
                EN_PROJET: 0, EN_CONSTRUCTION: 0, EN_COMMERCIALISATION: 0,
                LIVRE: 0, CLOTURE: 0,
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
    electron_1.ipcMain.handle('programmes:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.programmeImmobilier.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
