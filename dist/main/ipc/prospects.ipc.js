"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProspectsIPC = registerProspectsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
// ── Helpers ──────────────────────────────────────────────────────────────────
/** Convertit les chaînes vides en undefined pour éviter les échecs Zod sur les enums. */
function stripEmpty(obj) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? undefined : v]));
}
/** Rend un prospect sérialisable par Electron (convertit Prisma.Decimal → number). */
function serialize(p) {
    if (!p)
        return p;
    return { ...p, budget: p.budget != null ? Number(p.budget) : null };
}
// ── Schémas Zod ──────────────────────────────────────────────────────────────
const SOURCES = [
    'SITE_WEB_AFRIKIMMO', 'RECOMMENDATION', 'TELEPHONE', 'RESEAUX_SOCIAUX',
    'EMAIL', 'CONTACT_PERSONNEL', 'AUTRE', 'PROSPECTION',
];
const STATUSES = [
    'NOUVEAU', 'CONTACTE', 'QUALIFIE', 'ENVOI_PROPOSITION',
    'NEGOCIATION_EN_COURS', 'CONVERTI', 'PERDU',
];
const prospectSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'Prénom requis'),
    lastName: zod_1.z.string().min(1, 'Nom requis'),
    email: zod_1.z.string().email('Email invalide').optional(),
    phone: zod_1.z.string().optional(),
    mobile: zod_1.z.string().optional(),
    source: zod_1.z.enum(SOURCES).optional().default('PROSPECTION'),
    status: zod_1.z.enum(STATUSES).optional().default('NOUVEAU'),
    budget: zod_1.z.number().positive().optional(),
    notes: zod_1.z.string().optional(),
    assignedToId: zod_1.z.number().int().optional(),
});
// ── Rôles ────────────────────────────────────────────────────────────────────
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'READONLY'];
// ── Enregistrement des handlers ───────────────────────────────────────────────
/**
 * Enregistre les handlers IPC pour la gestion des prospects.
 */
function registerProspectsIPC() {
    // ── Liste ──────────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('prospects:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.status)
                where.status = filters.status;
            if (filters.source)
                where.source = filters.source;
            if (filters.search) {
                where.OR = [
                    { firstName: { contains: filters.search } },
                    { lastName: { contains: filters.search } },
                    { email: { contains: filters.search } },
                    { phone: { contains: filters.search } },
                    { mobile: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.prospect.findMany({
                    where,
                    include: { tags: { include: { tag: true } } },
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                db.prospect.count({ where }),
            ]);
            return { success: true, data: data.map(serialize), total };
        }
        catch (error) {
            logger_1.default.error('prospects:list', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Détail ─────────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('prospects:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const prospect = await db.prospect.findUnique({
                where: { id, deletedAt: null },
                include: {
                    tags: { include: { tag: true } },
                    activities: { orderBy: { createdAt: 'desc' }, take: 20 },
                    client: true,
                },
            });
            if (!prospect)
                return { success: false, error: 'Prospect introuvable' };
            return { success: true, data: serialize(prospect) };
        }
        catch (error) {
            logger_1.default.error('prospects:getById', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Création ───────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('prospects:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const cleaned = stripEmpty(payload ?? {});
            const parsed = prospectSchema.safeParse(cleaned);
            if (!parsed.success) {
                logger_1.default.warn('prospects:create validation', JSON.stringify(parsed.error.issues));
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            }
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            if (data.budget !== undefined)
                data.budget = String(data.budget);
            const prospect = await db.prospect.create({ data });
            logger_1.default.info(`Prospect créé : #${prospect.id} ${prospect.firstName} ${prospect.lastName}`);
            return { success: true, data: serialize(prospect) };
        }
        catch (error) {
            logger_1.default.error('prospects:create', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Mise à jour ────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('prospects:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const cleaned = stripEmpty(payload ?? {});
            const parsed = prospectSchema.partial().safeParse(cleaned);
            if (!parsed.success) {
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            }
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            if (data.budget !== undefined)
                data.budget = String(data.budget);
            const prospect = await db.prospect.update({ where: { id, deletedAt: null }, data });
            logger_1.default.info(`Prospect mis à jour : #${id}`);
            return { success: true, data: serialize(prospect) };
        }
        catch (error) {
            logger_1.default.error('prospects:update', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Suppression (soft delete) ──────────────────────────────────────────────
    electron_1.ipcMain.handle('prospects:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.prospect.update({ where: { id }, data: { deletedAt: new Date() } });
            logger_1.default.info(`Prospect supprimé (soft) : #${id}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('prospects:delete', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Changement de statut ───────────────────────────────────────────────────
    electron_1.ipcMain.handle('prospects:updateStatus', async (_event, { token, id, status }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = zod_1.z.enum(STATUSES).safeParse(status);
            if (!parsed.success)
                return { success: false, error: 'Statut invalide' };
            const db = (0, db_service_1.getDb)();
            const prospect = await db.prospect.update({
                where: { id, deletedAt: null },
                data: { status: parsed.data },
            });
            return { success: true, data: prospect };
        }
        catch (error) {
            logger_1.default.error('prospects:updateStatus', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Conversion en client ───────────────────────────────────────────────────
    electron_1.ipcMain.handle('prospects:convertToClient', async (_event, { token, id, clientData }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const prospect = await db.prospect.findUnique({ where: { id, deletedAt: null } });
            if (!prospect)
                return { success: false, error: 'Prospect introuvable' };
            if (prospect.status === 'CONVERTI')
                return { success: false, error: 'Prospect déjà converti' };
            const result = await db.$transaction(async (tx) => {
                const client = await tx.client.create({
                    data: {
                        firstName: clientData?.firstName ?? prospect.firstName,
                        lastName: clientData?.lastName ?? prospect.lastName,
                        email: clientData?.email ?? prospect.email ?? undefined,
                        phone: clientData?.phone ?? prospect.phone ?? undefined,
                        mobile: clientData?.mobile ?? prospect.mobile ?? undefined,
                        type: clientData?.type ?? 'INDIVIDUEL',
                    },
                });
                const updated = await tx.prospect.update({
                    where: { id },
                    data: { status: 'CONVERTI', convertedAt: new Date(), clientId: client.id },
                });
                return { client, prospect: updated };
            });
            logger_1.default.info(`Prospect #${id} converti en client #${result.client.id}`);
            return { success: true, data: result };
        }
        catch (error) {
            logger_1.default.error('prospects:convertToClient', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Vue Kanban ─────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('prospects:kanban', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const prospects = await db.prospect.findMany({
                where: { deletedAt: null, status: { not: 'CONVERTI' } },
                include: { tags: { include: { tag: true } } },
                orderBy: { updatedAt: 'desc' },
            });
            const columns = {
                NOUVEAU: [], CONTACTE: [], QUALIFIE: [],
                ENVOI_PROPOSITION: [], NEGOCIATION_EN_COURS: [], PERDU: [],
            };
            for (const p of prospects) {
                if (columns[p.status])
                    columns[p.status].push(serialize(p));
            }
            return { success: true, data: columns };
        }
        catch (error) {
            logger_1.default.error('prospects:kanban', error.message);
            return { success: false, error: error.message };
        }
    });
}
