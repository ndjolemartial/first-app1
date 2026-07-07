"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVisitorsIPC = registerVisitorsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
/**
 * Module Gestion des visiteurs.
 *
 * Accès réservé aux rôles SUPER_ADMIN, ADMIN et ASSISTANTE_DIRECTION (accueil /
 * secrétariat). Les visiteurs eux-mêmes s'enregistrent via l'application web
 * autonome (dossier `web-visiteurs/`) ; l'accueil peut aussi les saisir ici.
 */
// Accès au module Gestion des visiteurs (liste, saisie, lecture des objets pour
// le sélecteur du formulaire). MANAGER inclus.
const VISITOR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ASSISTANTE_DIRECTION', 'MANAGER'];
// Gestion (écriture) des « Objets de visite » — MANAGER exclu : il accède au
// module visiteurs mais pas à la configuration des objets.
const VISITOR_OBJECT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ASSISTANTE_DIRECTION'];
/**
 * Contrôle de rôle EXACT pour le module visiteurs (n'applique pas les
 * équivalences de `checkRole`) : autoriser `MANAGER` explicitement sans faire
 * entrer ACCOUNTANT (équivalent MANAGER). Aligné sur le RoleGuard (match exact).
 */
function checkVisitorRole(session, allowed) {
    if (!allowed.includes(session.role))
        throw new Error('Permission insuffisante');
}
const ser = (v) => JSON.parse(JSON.stringify(v));
const emptyToUndef = (v) => (v === '' || v === null ? undefined : v);
const visitorSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'Prénoms requis'),
    lastName: zod_1.z.string().min(1, 'Nom requis').transform((s) => s.trim().toUpperCase()),
    company: zod_1.z.preprocess(emptyToUndef, zod_1.z.string().optional()),
    phone: zod_1.z.string().min(1, 'Contacts requis'),
    email: zod_1.z.preprocess(emptyToUndef, zod_1.z.string().email('Email invalide').optional()),
    objet: zod_1.z.string().min(1, 'Objet de visite requis'),
    details: zod_1.z.preprocess(emptyToUndef, zod_1.z.string().optional()),
});
function registerVisitorsIPC() {
    electron_1.ipcMain.handle('visitors:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
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
            if (filters.source)
                where.source = filters.source;
            if (filters.dateFrom || filters.dateTo) {
                where.visitedAt = {};
                if (filters.dateFrom)
                    where.visitedAt.gte = new Date(filters.dateFrom);
                if (filters.dateTo)
                    where.visitedAt.lte = new Date(filters.dateTo);
            }
            const [data, total] = await db.$transaction([
                db.visitor.findMany({
                    where,
                    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { visitedAt: 'desc' },
                }),
                db.visitor.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('visitors:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('visitors:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_ROLES);
            const db = (0, db_service_1.getDb)();
            const visitor = await db.visitor.findFirst({
                where: { id, deletedAt: null },
                include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
            });
            if (!visitor)
                return { success: false, error: 'Visiteur introuvable' };
            return ser({ success: true, data: visitor });
        }
        catch (error) {
            logger_1.default.error('visitors:getById error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('visitors:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_ROLES);
            const parsed = visitorSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            // Saisie depuis l'application = source INTERNE ; visitedAt auto (now).
            const visitor = await db.visitor.create({
                data: { ...parsed.data, source: 'INTERNE', createdById: session.userId },
            });
            logger_1.default.info(`Visiteur créé : ${visitor.id}`);
            return ser({ success: true, data: visitor });
        }
        catch (error) {
            logger_1.default.error('visitors:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('visitors:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_ROLES);
            const parsed = visitorSchema.partial().safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const visitor = await db.visitor.update({ where: { id }, data: parsed.data });
            return ser({ success: true, data: visitor });
        }
        catch (error) {
            logger_1.default.error('visitors:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('visitors:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.visitor.update({ where: { id }, data: { deletedAt: new Date() } });
            logger_1.default.info(`Visiteur archivé (soft delete) : id=${id}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('visitors:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Objets de visite (liste paramétrable) ──────────────────────────────────
    electron_1.ipcMain.handle('visitors:listObjects', async (_event, { token, includeInactive = false }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.visitObject.findMany({
                where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
                orderBy: { label: 'asc' },
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('visitors:listObjects error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('visitors:createObject', async (_event, { token, label }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_OBJECT_ROLES);
            const value = String(label ?? '').trim();
            if (!value)
                return { success: false, error: 'Libellé requis' };
            const db = (0, db_service_1.getDb)();
            const exists = await db.visitObject.findFirst({ where: { label: value, deletedAt: null }, select: { id: true } });
            if (exists)
                return { success: false, error: 'Cet objet de visite existe déjà.' };
            const obj = await db.visitObject.create({ data: { label: value } });
            return ser({ success: true, data: obj });
        }
        catch (error) {
            logger_1.default.error('visitors:createObject error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('visitors:updateObject', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_OBJECT_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = {};
            if (payload?.label !== undefined) {
                const value = String(payload.label).trim();
                if (!value)
                    return { success: false, error: 'Libellé requis' };
                const exists = await db.visitObject.findFirst({ where: { label: value, deletedAt: null, id: { not: id } }, select: { id: true } });
                if (exists)
                    return { success: false, error: 'Cet objet de visite existe déjà.' };
                data.label = value;
            }
            if (payload?.isActive !== undefined)
                data.isActive = !!payload.isActive;
            const obj = await db.visitObject.update({ where: { id }, data });
            return ser({ success: true, data: obj });
        }
        catch (error) {
            logger_1.default.error('visitors:updateObject error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('visitors:deleteObject', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_OBJECT_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.visitObject.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('visitors:deleteObject error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('visitors:stats', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkVisitorRole(session, VISITOR_ROLES);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const [total, today, month] = await db.$transaction([
                db.visitor.count({ where: { deletedAt: null } }),
                db.visitor.count({ where: { deletedAt: null, visitedAt: { gte: startOfDay } } }),
                db.visitor.count({ where: { deletedAt: null, visitedAt: { gte: startOfMonth } } }),
            ]);
            return { success: true, data: { total, today, month } };
        }
        catch (error) {
            logger_1.default.error('visitors:stats error', error.message);
            return { success: false, error: error.message };
        }
    });
}
