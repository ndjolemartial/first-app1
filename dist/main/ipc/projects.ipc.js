"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProjectsIPC = registerProjectsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const PROJECT_STATUS = ['EN_PROJET', 'EN_COURS', 'SUSPENDU', 'TERMINE', 'ANNULE'];
const projectSchema = zod_1.z.object({
    nom: zod_1.z.string().min(1, 'Nom requis'),
    typeId: zod_1.z.coerce.number().int().positive('Type de projet requis'),
    statut: zod_1.z.enum(PROJECT_STATUS).default('EN_PROJET'),
    clientId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    ownerId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    terrainId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    lotissementId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    programmeId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    adresse: zod_1.z.string().optional().nullable(),
    commune: zod_1.z.string().optional().nullable(),
    quartier: zod_1.z.string().optional().nullable(),
    ville: zod_1.z.string().optional().nullable(),
    pays: zod_1.z.string().optional(),
    latitude: zod_1.z.coerce.number().optional().nullable(),
    longitude: zod_1.z.coerce.number().optional().nullable(),
    dateDebutPrevu: zod_1.z.coerce.date().optional().nullable(),
    dateDebutReel: zod_1.z.coerce.date().optional().nullable(),
    dateFinPrevue: zod_1.z.coerce.date().optional().nullable(),
    dateFinReelle: zod_1.z.coerce.date().optional().nullable(),
    avancement: zod_1.z.coerce.number().int().min(0).max(100).default(0),
    budgetPrevu: zod_1.z.coerce.number().nonnegative().optional().nullable(),
    budgetRealise: zod_1.z.coerce.number().nonnegative().optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
});
const projectTypeSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Code requis').regex(/^[A-Z0-9_]+$/, 'Format CODE_EN_MAJUSCULES'),
    label: zod_1.z.string().min(1, 'Libellé requis'),
    description: zod_1.z.string().optional().nullable(),
    color: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
// Module Projets : mêmes règles que Programmes (MANAGER+, ACCOUNTANT inclus
// via checkRole). Les types de projets sont gérés par ADMIN/SUPER_ADMIN
// depuis l'écran Paramètres.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const TYPES_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN'];
/** Sérialise pour l'IPC : les Decimal/Date Prisma ne sont pas clonables par Electron. */
const ser = (v) => JSON.parse(JSON.stringify(v));
/** Génère la prochaine référence de projet : PROJ-YYYY-NNNN. */
async function nextReference(db) {
    const year = new Date().getFullYear();
    const last = await db.project.findFirst({
        where: { reference: { startsWith: `PROJ-${year}-` } },
        orderBy: { reference: 'desc' },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `PROJ-${year}-${String(seq).padStart(4, '0')}`;
}
/** Convertit les chaînes vides / undefined en null pour les colonnes nullable. */
function normalizePayload(input) {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
        out[k] = v === '' || v === undefined ? null : v;
    }
    return out;
}
function registerProjectsIPC() {
    // ── PROJETS ─────────────────────────────────────────────────────
    electron_1.ipcMain.handle('projects:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.statut)
                where.statut = filters.statut;
            if (filters.typeId)
                where.typeId = Number(filters.typeId);
            if (filters.clientId)
                where.clientId = Number(filters.clientId);
            if (filters.ownerId)
                where.ownerId = Number(filters.ownerId);
            if (filters.terrainId)
                where.terrainId = Number(filters.terrainId);
            if (filters.lotissementId)
                where.lotissementId = Number(filters.lotissementId);
            if (filters.programmeId)
                where.programmeId = Number(filters.programmeId);
            if (filters.ville)
                where.ville = { contains: filters.ville };
            if (filters.search) {
                where.OR = [
                    { nom: { contains: filters.search } },
                    { reference: { contains: filters.search } },
                    { commune: { contains: filters.search } },
                    { quartier: { contains: filters.search } },
                    { adresse: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.project.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        type: { select: { id: true, code: true, label: true, color: true } },
                        client: { select: { id: true, firstName: true, lastName: true, entreprise: true } },
                        owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                        terrain: { select: { id: true, reference: true } },
                        lotissement: { select: { id: true, reference: true, nom: true } },
                        programme: { select: { id: true, reference: true, nom: true } },
                    },
                }),
                db.project.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('projects:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('projects:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const project = await db.project.findUnique({
                where: { id, deletedAt: null },
                include: {
                    type: true,
                    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, phone: true, email: true } },
                    owner: { select: { id: true, firstName: true, lastName: true, companyName: true, phone: true, email: true } },
                    terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } },
                    lotissement: { select: { id: true, reference: true, nom: true } },
                    programme: { select: { id: true, reference: true, nom: true } },
                    photos: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
                    documents: { orderBy: { uploadedAt: 'desc' } },
                },
            });
            if (!project)
                return { success: false, error: 'Projet introuvable' };
            return ser({ success: true, data: project });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('projects:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = projectSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const project = await db.project.create({
                data: { ...normalizePayload(parsed.data), reference },
            });
            logger_1.default.info(`Projet créé: ${project.reference}`);
            return ser({ success: true, data: project });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('projects:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = projectSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const project = await db.project.update({
                where: { id, deletedAt: null },
                data: normalizePayload(parsed.data),
            });
            return ser({ success: true, data: project });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('projects:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.project.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('projects:statusStats', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.typeId)
                where.typeId = Number(filters.typeId);
            if (filters.ville)
                where.ville = { contains: filters.ville };
            if (filters.search) {
                where.OR = [
                    { nom: { contains: filters.search } },
                    { reference: { contains: filters.search } },
                    { commune: { contains: filters.search } },
                    { quartier: { contains: filters.search } },
                    { adresse: { contains: filters.search } },
                ];
            }
            const rows = await db.project.groupBy({
                by: ['statut'],
                where,
                _count: { _all: true },
            });
            const stats = {
                EN_PROJET: 0, EN_COURS: 0, SUSPENDU: 0, TERMINE: 0, ANNULE: 0,
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
    // ── TYPES DE PROJETS ────────────────────────────────────────────
    electron_1.ipcMain.handle('projects:listTypes', async (_event, { token, includeInactive = false }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Lecture ouverte aux mêmes rôles que les projets (utilisée pour les selects).
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const types = await db.projectType.findMany({
                where,
                orderBy: { label: 'asc' },
                include: { _count: { select: { projects: { where: { deletedAt: null } } } } },
            });
            return ser({ success: true, data: types });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('projects:createType', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, TYPES_WRITE_ROLES);
            const parsed = projectTypeSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const type = await db.projectType.create({ data: parsed.data });
            logger_1.default.info(`Type de projet créé: ${type.code}`);
            return ser({ success: true, data: type });
        }
        catch (error) {
            // Erreur d'unicité (code déjà utilisé)
            if (error.code === 'P2002')
                return { success: false, error: 'Ce code est déjà utilisé' };
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('projects:updateType', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, TYPES_WRITE_ROLES);
            const parsed = projectTypeSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const type = await db.projectType.update({ where: { id, deletedAt: null }, data: parsed.data });
            return ser({ success: true, data: type });
        }
        catch (error) {
            if (error.code === 'P2002')
                return { success: false, error: 'Ce code est déjà utilisé' };
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('projects:deleteType', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, TYPES_WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            // Bloque la suppression si des projets actifs utilisent ce type.
            const count = await db.project.count({ where: { typeId: id, deletedAt: null } });
            if (count > 0) {
                return {
                    success: false,
                    error: `Impossible de supprimer ce type : ${count} projet(s) y sont rattaché(s). Désactivez-le plutôt.`,
                };
            }
            await db.projectType.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
