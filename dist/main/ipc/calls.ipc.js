"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCallsIPC = registerCallsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
/**
 * Module Gestion des appels (entrants / sortants).
 *
 * Accès réservé à SUPER_ADMIN, ADMIN, MANAGER, ASSISTANTE_DIRECTION et
 * ACCOUNTANT (Comptable). Vue complète (tous les appels) réservée à
 * SUPER_ADMIN, ADMIN et MANAGER ; ASSISTANTE_DIRECTION et ACCOUNTANT ne
 * voient que les appels qu'ils ont eux-mêmes enregistrés.
 */
const CALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Contrôle de rôle EXACT pour le module appels (sans les équivalences de `checkRole`). */
function checkCallRole(session, allowed) {
    if (!allowed.includes(session.role))
        throw new Error('Permission insuffisante');
}
function hasFullView(role) {
    return FULL_VIEW_ROLES.includes(role);
}
/** Fragment `where` limitant les appels à ceux enregistrés par l'utilisateur (rôles restreints). */
function buildVisibilityWhere(session) {
    return hasFullView(session.role) ? {} : { createdById: session.userId };
}
const ser = (v) => JSON.parse(JSON.stringify(v));
const emptyToUndef = (v) => (v === '' || v === null ? undefined : v);
const callBaseSchema = zod_1.z.object({
    direction: zod_1.z.enum(['ENTRANT', 'SORTANT']),
    ligne: zod_1.z.preprocess(emptyToUndef, zod_1.z.string().optional()),
    firstName: zod_1.z.preprocess(emptyToUndef, zod_1.z.string().optional()),
    lastName: zod_1.z.preprocess(emptyToUndef, zod_1.z.string().optional()),
    company: zod_1.z.preprocess(emptyToUndef, zod_1.z.string().optional()),
    phone: zod_1.z.string().min(1, 'Numéro de téléphone requis'),
    email: zod_1.z.preprocess(emptyToUndef, zod_1.z.string().email('Email invalide').optional()),
    objet: zod_1.z.string().min(1, "Objet de l'appel requis"),
    details: zod_1.z.preprocess(emptyToUndef, zod_1.z.string().optional()),
    duration: zod_1.z.preprocess(emptyToUndef, zod_1.z.coerce.number().int().min(0).optional()),
    status: zod_1.z.enum(['ABOUTI', 'MANQUE', 'OCCUPE', 'MESSAGE_LAISSE']).default('ABOUTI'),
    calledAt: zod_1.z.preprocess(emptyToUndef, zod_1.z.coerce.date().optional()),
    clientId: zod_1.z.preprocess(emptyToUndef, zod_1.z.coerce.number().int().positive().optional()),
    prospectId: zod_1.z.preprocess(emptyToUndef, zod_1.z.coerce.number().int().positive().optional()),
});
/** Un appel ne peut être rattaché à la fois à un client ET à un prospect. */
const mutuallyExclusive = (data, ctx) => {
    if (data.clientId != null && data.prospectId != null) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['prospectId'],
            message: 'Un appel ne peut pas être rattaché à la fois à un client et à un prospect.',
        });
    }
};
const callSchema = callBaseSchema.superRefine(mutuallyExclusive);
const callUpdateSchema = callBaseSchema.partial().superRefine(mutuallyExclusive);
const USER_BRIEF_SELECT = { id: true, firstName: true, lastName: true };
function registerCallsIPC() {
    electron_1.ipcMain.handle('calls:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...buildVisibilityWhere(session) };
            if (filters.search) {
                where.OR = [
                    { firstName: { contains: filters.search } },
                    { lastName: { contains: filters.search } },
                    { company: { contains: filters.search } },
                    { objet: { contains: filters.search } },
                    { phone: { contains: filters.search } },
                    { email: { contains: filters.search } },
                ];
            }
            if (filters.direction)
                where.direction = filters.direction;
            if (filters.status)
                where.status = filters.status;
            if (filters.dateFrom || filters.dateTo) {
                where.calledAt = {};
                if (filters.dateFrom)
                    where.calledAt.gte = new Date(filters.dateFrom);
                if (filters.dateTo)
                    where.calledAt.lte = new Date(filters.dateTo);
            }
            const [data, total] = await db.$transaction([
                db.phoneCall.findMany({
                    where,
                    include: {
                        createdBy: { select: USER_BRIEF_SELECT },
                        client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                        prospect: { select: { id: true, firstName: true, lastName: true } },
                    },
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { calledAt: 'desc' },
                }),
                db.phoneCall.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('calls:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('calls:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const call = await db.phoneCall.findFirst({
                where: { id, deletedAt: null, ...buildVisibilityWhere(session) },
                include: {
                    createdBy: { select: USER_BRIEF_SELECT },
                    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                    prospect: { select: { id: true, firstName: true, lastName: true } },
                },
            });
            if (!call)
                return { success: false, error: 'Appel introuvable' };
            return ser({ success: true, data: call });
        }
        catch (error) {
            logger_1.default.error('calls:getById error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('calls:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const parsed = callSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const call = await db.phoneCall.create({
                data: { ...parsed.data, createdById: session.userId },
            });
            logger_1.default.info(`Appel enregistré : id=${call.id}`);
            return ser({ success: true, data: call });
        }
        catch (error) {
            logger_1.default.error('calls:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('calls:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.phoneCall.findFirst({ where: { id, deletedAt: null, ...buildVisibilityWhere(session) }, select: { id: true } });
            if (!existing)
                return { success: false, error: 'Appel introuvable' };
            const parsed = callUpdateSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const call = await db.phoneCall.update({ where: { id }, data: parsed.data });
            return ser({ success: true, data: call });
        }
        catch (error) {
            logger_1.default.error('calls:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('calls:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Suppression réservée à SUPER_ADMIN/ADMIN/MANAGER — les autres rôles
            // autorisés sur le module (ACCOUNTANT, ASSISTANTE_DIRECTION) ne peuvent
            // que consulter/créer/modifier.
            checkCallRole(session, FULL_VIEW_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.phoneCall.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
            if (!existing)
                return { success: false, error: 'Appel introuvable' };
            await db.phoneCall.update({ where: { id }, data: { deletedAt: new Date() } });
            logger_1.default.info(`Appel archivé (soft delete) : id=${id}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('calls:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('calls:stats', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const scope = buildVisibilityWhere(session);
            const [total, today, month, entrant, sortant] = await db.$transaction([
                db.phoneCall.count({ where: { deletedAt: null, ...scope } }),
                db.phoneCall.count({ where: { deletedAt: null, calledAt: { gte: startOfDay }, ...scope } }),
                db.phoneCall.count({ where: { deletedAt: null, calledAt: { gte: startOfMonth }, ...scope } }),
                db.phoneCall.count({ where: { deletedAt: null, direction: 'ENTRANT', ...scope } }),
                db.phoneCall.count({ where: { deletedAt: null, direction: 'SORTANT', ...scope } }),
            ]);
            return { success: true, data: { total, today, month, entrant, sortant } };
        }
        catch (error) {
            logger_1.default.error('calls:stats error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Recherche client / prospect pour le rattachement (« Client concerné » /
    // « Prospect concerné ») ────────────────────────────────────────────────────
    // Volontairement NON filtrée par affectation (assignedToId) : quel que soit
    // le rôle connecté, la recherche porte sur l'ensemble des clients/prospects
    // — l'appel est un simple rattachement de contexte, pas une action de suivi
    // commercial nécessitant le périmètre habituel de visibilité.
    electron_1.ipcMain.handle('calls:searchClients', async (_event, { token, search = '' }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (search) {
                where.OR = [
                    { reference: { contains: search } },
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                    { entreprise: { contains: search } },
                    { email: { contains: search } },
                    { phone: { contains: search } },
                ];
            }
            const data = await db.client.findMany({
                where,
                select: { id: true, reference: true, firstName: true, lastName: true, entreprise: true, type: true },
                orderBy: { createdAt: 'desc' },
                take: 15,
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('calls:searchClients error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('calls:searchProspects', async (_event, { token, search = '' }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (search) {
                where.OR = [
                    { reference: { contains: search } },
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                    { email: { contains: search } },
                    { phone: { contains: search } },
                ];
            }
            const data = await db.prospect.findMany({
                where,
                select: { id: true, reference: true, firstName: true, lastName: true },
                orderBy: { createdAt: 'desc' },
                take: 15,
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('calls:searchProspects error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Lignes téléphoniques (référentiel du champ « Ligne téléphonique ») ────
    const phoneLineSchema = zod_1.z.object({
        label: zod_1.z.string().min(1, 'Libellé requis'),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('calls:phoneLines:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await db.phoneLine.findMany({ where, orderBy: { label: 'asc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('calls:phoneLines:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('calls:phoneLines:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const parsed = phoneLineSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const db = (0, db_service_1.getDb)();
            const label = parsed.data.label.trim();
            // Réactive une ligne homonyme précédemment supprimée plutôt que d'échouer sur l'unicité.
            const existing = await db.phoneLine.findUnique({ where: { label } });
            if (existing) {
                const data = await db.phoneLine.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
                return ser({ success: true, data });
            }
            const data = await db.phoneLine.create({ data: { label, isActive: parsed.data.isActive ?? true } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('calls:phoneLines:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('calls:phoneLines:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const parsed = phoneLineSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            if (typeof data.label === 'string')
                data.label = data.label.trim();
            const updated = await db.phoneLine.update({ where: { id }, data });
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('calls:phoneLines:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('calls:phoneLines:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCallRole(session, CALL_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.phoneLine.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('calls:phoneLines:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
}
