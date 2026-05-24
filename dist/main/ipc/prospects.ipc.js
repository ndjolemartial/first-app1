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
/** Rôles disposant d'une vue globale sur les prospects (sans filtrage). */
// Exception à l'équivalence ACCOUNTANT/MANAGER : ASSISTANTE_DIRECTION dispose
// uniquement des droits d'un AGENT sur le module Prospects (lecture filtrée,
// pas de conversion en client).
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
/** Vrai si l'utilisateur de la session voit l'ensemble des prospects. */
function hasFullView(role) {
    return FULL_VIEW_ROLES.includes(role);
}
/**
 * Construit le filtre `where` de visibilité appliqué aux requêtes prospects :
 * — un manager / admin / super admin / comptable voit tout ;
 * — les autres rôles ne voient que les prospects qui leur sont affectés,
 *   ceux qu'ils ont créés ou ceux non alloués (`assignedToId IS NULL`).
 */
function buildVisibilityWhere(session) {
    if (hasFullView(session.role))
        return {};
    return {
        OR: [
            { assignedToId: session.userId },
            { createdById: session.userId },
            { assignedToId: null },
        ],
    };
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
    assignedToId: zod_1.z.number().int().nullable().optional(),
});
// ── Rôles ────────────────────────────────────────────────────────────────────
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'READONLY'];
const ASSIGN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Rôles habilités à convertir un prospect en client (équivalents à la création de client). */
const CONVERT_TO_CLIENT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/**
 * Vrai si le rôle est habilité à affecter / désaffecter un prospect.
 *
 * Exception à l'équivalence ACCOUNTANT/MANAGER : l'affectation des prospects est
 * exclusivement réservée aux MANAGER, ADMIN et SUPER_ADMIN — les comptables n'y
 * ont pas accès (décision produit).
 */
function canAssign(role) {
    return ASSIGN_ROLES.includes(role);
}
// Sélection légère pour les relations User incluses (assignedTo, createdBy).
const USER_BRIEF_SELECT = {
    id: true, firstName: true, lastName: true, email: true, role: true,
};
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
            const where = { deletedAt: null, ...buildVisibilityWhere(session) };
            if (filters.status)
                where.status = filters.status;
            if (filters.source)
                where.source = filters.source;
            if (filters.assignedToId !== undefined) {
                where.assignedToId = filters.assignedToId === null ? null : Number(filters.assignedToId);
            }
            if (filters.search) {
                where.AND = [
                    ...(where.AND ?? []),
                    {
                        OR: [
                            { firstName: { contains: filters.search } },
                            { lastName: { contains: filters.search } },
                            { email: { contains: filters.search } },
                            { phone: { contains: filters.search } },
                            { mobile: { contains: filters.search } },
                        ],
                    },
                ];
            }
            const [data, total] = await db.$transaction([
                db.prospect.findMany({
                    where,
                    include: {
                        tags: { include: { tag: true } },
                        assignedTo: { select: USER_BRIEF_SELECT },
                        createdBy: { select: USER_BRIEF_SELECT },
                    },
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
                    assignedTo: { select: USER_BRIEF_SELECT },
                    createdBy: { select: USER_BRIEF_SELECT },
                },
            });
            if (!prospect)
                return { success: false, error: 'Prospect introuvable' };
            // Contrôle de visibilité fine pour les rôles restreints.
            if (!hasFullView(session.role)) {
                const visible = prospect.assignedToId === session.userId ||
                    prospect.createdById === session.userId ||
                    prospect.assignedToId === null;
                if (!visible)
                    return { success: false, error: 'Prospect inaccessible' };
            }
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
            const data = { ...parsed.data, createdById: session.userId };
            if (data.budget !== undefined)
                data.budget = String(data.budget);
            // Seuls les rôles d'assignation peuvent affecter un prospect dès la création.
            if (!canAssign(session.role))
                delete data.assignedToId;
            const prospect = await db.prospect.create({
                data,
                include: {
                    assignedTo: { select: USER_BRIEF_SELECT },
                    createdBy: { select: USER_BRIEF_SELECT },
                },
            });
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
            // Seuls les rôles d'assignation peuvent modifier l'affectation via update.
            if (!canAssign(session.role))
                delete data.assignedToId;
            const prospect = await db.prospect.update({
                where: { id, deletedAt: null },
                data,
                include: {
                    assignedTo: { select: USER_BRIEF_SELECT },
                    createdBy: { select: USER_BRIEF_SELECT },
                },
            });
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
            return { success: true, data: serialize(prospect) };
        }
        catch (error) {
            logger_1.default.error('prospects:updateStatus', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Affectation / désaffectation ───────────────────────────────────────────
    /**
     * Affecte ou désaffecte un prospect à un utilisateur.
     * Réservé aux rôles MANAGER, ADMIN et SUPER_ADMIN.
     * Passer `assignedToId: null` pour désaffecter.
     */
    electron_1.ipcMain.handle('prospects:assign', async (_event, { token, id, assignedToId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Exclut explicitement ACCOUNTANT (qui hériterait sinon de MANAGER via checkRole).
            if (!canAssign(session.role)) {
                return { success: false, error: 'Permission insuffisante' };
            }
            const parsedId = zod_1.z.number().int().positive().nullable().safeParse(assignedToId === null || assignedToId === undefined ? null : Number(assignedToId));
            if (!parsedId.success)
                return { success: false, error: 'Utilisateur invalide' };
            const db = (0, db_service_1.getDb)();
            // Vérifie que l'utilisateur cible existe et est actif (lorsqu'on affecte).
            if (parsedId.data !== null) {
                const user = await db.user.findUnique({
                    where: { id: parsedId.data, deletedAt: null },
                    select: { id: true, isActive: true },
                });
                if (!user || !user.isActive) {
                    return { success: false, error: 'Utilisateur introuvable ou inactif' };
                }
            }
            const prospect = await db.prospect.update({
                where: { id, deletedAt: null },
                data: { assignedToId: parsedId.data },
                include: {
                    assignedTo: { select: USER_BRIEF_SELECT },
                    createdBy: { select: USER_BRIEF_SELECT },
                },
            });
            logger_1.default.info(parsedId.data === null
                ? `Prospect #${id} désaffecté`
                : `Prospect #${id} affecté à l'utilisateur #${parsedId.data}`);
            return { success: true, data: serialize(prospect) };
        }
        catch (error) {
            logger_1.default.error('prospects:assign', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Liste des utilisateurs assignables ─────────────────────────────────────
    /**
     * Liste les utilisateurs actifs candidats à l'affectation d'un prospect.
     * Réservé aux rôles d'assignation.
     */
    electron_1.ipcMain.handle('prospects:listAssignableUsers', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Exclut explicitement ACCOUNTANT — l'affectation est réservée aux MANAGER+.
            if (!canAssign(session.role)) {
                return { success: false, error: 'Permission insuffisante' };
            }
            const db = (0, db_service_1.getDb)();
            const users = await db.user.findMany({
                where: { deletedAt: null, isActive: true },
                select: USER_BRIEF_SELECT,
                orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            });
            return { success: true, data: users };
        }
        catch (error) {
            logger_1.default.error('prospects:listAssignableUsers', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Conversion en client ───────────────────────────────────────────────────
    /**
     * Convertit un prospect en client. Réservé aux rôles habilités à créer un client
     * (MANAGER, ADMIN, SUPER_ADMIN — ACCOUNTANT via héritage). L'utilisateur affecté
     * au prospect est reporté sur le nouveau client (`assignedToId`).
     */
    electron_1.ipcMain.handle('prospects:convertToClient', async (_event, { token, id, clientData }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // ASSISTANTE_DIRECTION exclu explicitement (réduit au niveau AGENT sur ce module).
            if (session.role === 'ASSISTANTE_DIRECTION') {
                return { success: false, error: 'Permission insuffisante' };
            }
            (0, auth_service_1.checkRole)(session, CONVERT_TO_CLIENT_ROLES);
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
                        // Report de l'affectation du prospect vers le client créé.
                        assignedToId: prospect.assignedToId ?? undefined,
                    },
                });
                const updated = await tx.prospect.update({
                    where: { id },
                    data: { status: 'CONVERTI', convertedAt: new Date(), clientId: client.id },
                });
                return { client, prospect: updated };
            });
            logger_1.default.info(`Prospect #${id} converti en client #${result.client.id}`);
            return { success: true, data: { client: result.client, prospect: serialize(result.prospect) } };
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
                where: {
                    deletedAt: null,
                    status: { not: 'CONVERTI' },
                    ...buildVisibilityWhere(session),
                },
                include: {
                    tags: { include: { tag: true } },
                    assignedTo: { select: USER_BRIEF_SELECT },
                    createdBy: { select: USER_BRIEF_SELECT },
                },
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
