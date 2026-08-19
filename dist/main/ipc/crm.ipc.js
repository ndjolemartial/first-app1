"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCrmIPC = registerCrmIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const performance_ipc_1 = require("./performance.ipc");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
// CrmActivity.objectiveRealized est un Decimal Prisma — non clonable tel quel
// par l'IPC Electron (structured clone). Sérialiser avant tout retour.
const ser = (v) => JSON.parse(JSON.stringify(v));
/**
 * Rôles qui voient l'ensemble des activités CRM, sans filtre de propriété.
 * Les rôles restreints (AGENT, ACCOUNTANT, READONLY) ne voient que les
 * activités qui leur sont assignées (`userId`), qu'ils ont créées
 * (`createdById`), ou qui sont rattachées à un client / prospect / convention
 * dont ils sont l'utilisateur référent (`assignedToId` / `agentId`).
 */
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
function hasFullView(role) {
    return FULL_VIEW_ROLES.includes(role);
}
/** Clause WHERE des activités rattachées à un utilisateur (assigné, créateur, ou référent). */
function activitiesForUserWhere(uid) {
    return {
        OR: [
            { userId: uid },
            { createdById: uid },
            { client: { assignedToId: uid } },
            { prospect: { assignedToId: uid } },
            { convention: { agentId: uid } },
            { invoice: { convention: { agentId: uid } } },
            { installment: { convention: { agentId: uid } } },
        ],
    };
}
/** Clause WHERE de visibilité pour les rôles restreints (vide pour full-view). */
function buildVisibilityWhere(session) {
    if (hasFullView(session.role)) {
        // Rappels de charges prévisionnelles : un MANAGER ne voit que ceux qu'il a
        // lui-même planifiés (les autres rappels restent visibles). Les rôles ADMIN
        // et ACCOUNTANT (full-view) voient tout ; ASSISTANTE_DIRECTION est déjà
        // restreint à ses propres activités via activitiesForUserWhere ci-dessous.
        if (session.role === 'MANAGER') {
            return { OR: [{ forecastExpenseId: null }, { createdById: session.userId }] };
        }
        return {};
    }
    const own = activitiesForUserWhere(session.userId);
    // AGENT_TECHNIQUE voit en plus, quel que soit l'assigné/créateur/référent,
    // toutes les activités « Créas / Publications / Articles » (module Réseaux
    // Sociaux & Plateformes Web) — seule exception à sa vue restreinte.
    if (session.role === 'AGENT_TECHNIQUE') {
        return { OR: [...own.OR, { type: 'CREATION_PUBLICATION' }] };
    }
    return own;
}
const activitySchema = zod_1.z.object({
    type: zod_1.z.enum(['NOTIFICATION', 'APPEL', 'EMAIL', 'SMS', 'REUNION', 'VISITE', 'TASK', 'RAPPEL', 'DOCUMENT', 'CREATION_PUBLICATION']),
    subject: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    status: zod_1.z.enum(['EN_ATTENTE', 'EN_TRAITEMENT', 'TRAITE', 'ANNULE']).default('EN_ATTENTE'),
    dueDate: zod_1.z.string().optional(),
    completedAt: zod_1.z.string().optional(),
    userId: zod_1.z.number().int().positive().optional(),
    prospectId: zod_1.z.number().int().positive().optional(),
    clientId: zod_1.z.number().int().positive().optional(),
    ownerId: zod_1.z.number().int().positive().optional(),
    propertyId: zod_1.z.number().int().positive().optional(),
    conventionId: zod_1.z.number().int().positive().optional(),
    lotissementId: zod_1.z.number().int().positive().optional(),
    terrainId: zod_1.z.number().int().positive().optional(),
    programmeId: zod_1.z.number().int().positive().optional(),
    invoiceId: zod_1.z.number().int().positive().optional(),
    installmentId: zod_1.z.number().int().positive().optional(),
    documentId: zod_1.z.number().int().positive().optional(),
    // Objectif de performance lié (tâche) + quantité réalisée.
    objectiveId: zod_1.z.number().int().positive().nullable().optional(),
    objectiveRealized: zod_1.z.number().nonnegative().nullable().optional(),
});
/** Fiche employé (id + poste) rattachée au compte utilisateur de la session, s'il existe. */
async function sessionEmployeeForObjectives(db, session) {
    return db.employee.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true, poste: true } });
}
/**
 * Vérifie qu'un objectif est « liable » à une activité du collaborateur
 * connecté : personnellement assigné (employeeId = son employé) **ou**
 * défini pour son poste (poste = son poste), et doté d'une cible chiffrée
 * (> 0), quel que soit son type de mesure (Manuel ou Auto). Retourne la
 * cible et le type de mesure.
 */
async function assertLinkableObjective(db, session, objectiveId) {
    const me = await sessionEmployeeForObjectives(db, session);
    if (!me)
        throw new Error('Aucun dossier du personnel rattaché à votre compte.');
    const targets = [{ employeeId: me.id }];
    if (me.poste)
        targets.push({ poste: me.poste });
    const obj = await db.performanceObjective.findFirst({
        where: {
            id: objectiveId,
            deletedAt: null,
            OR: targets,
            AND: [{ OR: [{ kpiDefinitionId: null }, { kpiDefinition: { metric: { notIn: performance_ipc_1.LINKABLE_EXCLUDED_METRICS } } }] }],
        },
        select: { targetValue: true, measureType: true },
    });
    if (!obj)
        throw new Error('Objectif introuvable : un objectif qui vous est assigné (personnellement ou via votre poste) est requis.');
    const target = obj.targetValue != null ? Number(obj.targetValue) : 0;
    if (!(target > 0))
        throw new Error('L’objectif lié doit avoir une cible chiffrée.');
    return { target, measureType: obj.measureType };
}
/** Bloque le passage « Traité » d'une tâche liée tant que la cible n'est pas atteinte à 100 %. */
function assertTaskCompletable(target, realized) {
    if (target != null && target > 0 && !(Number(realized ?? 0) >= target)) {
        throw new Error('Cette tâche ne peut être marquée « Traité » : l’objectif lié n’est pas atteint à 100 %.');
    }
}
/** Recalcule l'avancement d'un objectif = quantité réalisée cumulée des tâches liées / cible. */
async function recomputeObjectiveProgress(db, objectiveId) {
    const obj = await db.performanceObjective.findFirst({ where: { id: objectiveId, deletedAt: null }, select: { targetValue: true } });
    if (!obj || obj.targetValue == null || Number(obj.targetValue) <= 0)
        return;
    const agg = await db.crmActivity.aggregate({ where: { objectiveId }, _sum: { objectiveRealized: true } });
    const realized = Number(agg._sum.objectiveRealized ?? 0);
    // On conserve l'excédent au-delà de 100 % (ex. 120 %) — pas de plafond haut.
    const progress = Math.max(0, Math.round((realized / Number(obj.targetValue)) * 100));
    await db.performanceObjective.update({ where: { id: objectiveId }, data: { progress } });
}
function registerCrmIPC() {
    electron_1.ipcMain.handle('crm:listActivities', async (_event, { token, filters = {}, page = 1, limit = 30 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = {};
            if (filters.type)
                where.type = filters.type;
            if (filters.status)
                where.status = filters.status;
            if (Array.isArray(filters.statusIn) && filters.statusIn.length) {
                where.status = { in: filters.statusIn };
            }
            if (filters.statusNot) {
                if (where.status && typeof where.status === 'object') {
                    where.status = { ...where.status, not: filters.statusNot };
                }
                else if (where.status !== undefined) {
                    where.status = { equals: where.status, not: filters.statusNot };
                }
                else {
                    where.status = { not: filters.statusNot };
                }
            }
            if (filters.clientId)
                where.clientId = filters.clientId;
            if (filters.prospectId)
                where.prospectId = filters.prospectId;
            if (filters.propertyId)
                where.propertyId = filters.propertyId;
            if (filters.conventionId)
                where.conventionId = filters.conventionId;
            if (filters.dueBefore)
                where.dueDate = { ...(where.dueDate ?? {}), lte: new Date(filters.dueBefore) };
            if (filters.dueAfter)
                where.dueDate = { ...(where.dueDate ?? {}), gte: new Date(filters.dueAfter) };
            if (filters.search) {
                where.OR = [
                    { subject: { contains: filters.search } },
                    { description: { contains: filters.search } },
                ];
            }
            // Restriction de visibilité par rôle (rôles non full-view) + filtre explicite
            // par utilisateur (réservé aux rôles full-view qui peuvent cibler n'importe qui).
            const visibilityWhere = buildVisibilityWhere(session);
            const andClauses = [];
            if (Object.keys(visibilityWhere).length)
                andClauses.push(visibilityWhere);
            if (filters.userId && hasFullView(session.role)) {
                andClauses.push(activitiesForUserWhere(Number(filters.userId)));
            }
            const finalWhere = andClauses.length ? { AND: [where, ...andClauses] } : where;
            const [data, total] = await db.$transaction([
                db.crmActivity.findMany({
                    where: finalWhere,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } },
                        client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                        prospect: { select: { id: true, firstName: true, lastName: true } },
                        owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                        property: { select: { id: true, reference: true, address: true } },
                        convention: { select: { id: true, reference: true } },
                        lotissement: { select: { id: true, reference: true, nom: true } },
                        terrain: { select: { id: true, reference: true } },
                        programme: { select: { id: true, reference: true, nom: true } },
                        invoice: { select: { id: true, reference: true } },
                        installment: { select: { id: true, installmentNumber: true, convention: { select: { reference: true } } } },
                        _count: { select: { attachments: { where: { deletedAt: null } } } },
                    },
                }),
                db.crmActivity.count({ where: finalWhere }),
            ]);
            return { success: true, data: ser(data), total };
        }
        catch (error) {
            logger_1.default.error('crm:listActivities error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:getActivity', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const visibilityWhere = buildVisibilityWhere(session);
            const where = Object.keys(visibilityWhere).length
                ? { AND: [{ id }, visibilityWhere] }
                : { id };
            const activity = await db.crmActivity.findFirst({
                where,
                include: {
                    user: { select: { id: true, firstName: true, lastName: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                    prospect: { select: { id: true, firstName: true, lastName: true } },
                    owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                    property: { select: { id: true, reference: true, address: true } },
                    convention: { select: { id: true, reference: true } },
                    lotissement: { select: { id: true, reference: true, nom: true } },
                    terrain: { select: { id: true, reference: true } },
                    programme: { select: { id: true, reference: true, nom: true } },
                    invoice: { select: { id: true, reference: true } },
                    installment: { select: { id: true, installmentNumber: true, convention: { select: { reference: true } } } },
                    objective: { select: { id: true, title: true, targetValue: true, unit: true, measureType: true, year: true } },
                    attachments: {
                        where: { deletedAt: null },
                        select: { id: true, name: true, type: true, size: true, numeroArchive: true, uploadedAt: true },
                        orderBy: { uploadedAt: 'desc' },
                    },
                },
            });
            if (!activity)
                return { success: false, error: 'Activité introuvable ou inaccessible' };
            return { success: true, data: ser(activity) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:createActivity', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = activitySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            // Lien objectif (optionnel, quel que soit le type d'activité) : validation
            // + garde de complétion réservée aux objectifs à Mesure « Manuelle ».
            let objTarget = null;
            let objMeasureType = null;
            if (d.objectiveId != null) {
                const linked = await assertLinkableObjective(db, session, d.objectiveId);
                objTarget = linked.target;
                objMeasureType = linked.measureType;
            }
            if (d.status === 'TRAITE' && d.objectiveId != null && objMeasureType === 'MANUAL') {
                assertTaskCompletable(objTarget, d.objectiveRealized ?? null);
            }
            const activity = await db.crmActivity.create({
                data: {
                    type: d.type,
                    subject: d.subject,
                    description: d.description,
                    status: d.status,
                    dueDate: d.dueDate ? new Date(d.dueDate) : null,
                    completedAt: d.completedAt ? new Date(d.completedAt) : null,
                    userId: d.userId ?? null,
                    prospectId: d.prospectId ?? null,
                    clientId: d.clientId ?? null,
                    ownerId: d.ownerId ?? null,
                    propertyId: d.propertyId ?? null,
                    conventionId: d.conventionId ?? null,
                    lotissementId: d.lotissementId ?? null,
                    terrainId: d.terrainId ?? null,
                    programmeId: d.programmeId ?? null,
                    invoiceId: d.invoiceId ?? null,
                    installmentId: d.installmentId ?? null,
                    documentId: d.documentId ?? null,
                    objectiveId: d.objectiveId ?? null,
                    objectiveRealized: d.objectiveId != null ? (d.objectiveRealized ?? null) : null,
                    createdById: session.userId,
                },
            });
            if (activity.objectiveId)
                await recomputeObjectiveProgress(db, activity.objectiveId);
            logger_1.default.info(`CRM activity created: ${activity.id}`);
            return { success: true, data: ser(activity) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:updateActivity', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = activitySchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const visibilityWhere = buildVisibilityWhere(session);
            const lookupWhere = Object.keys(visibilityWhere).length
                ? { AND: [{ id }, visibilityWhere] }
                : { id };
            const existing = await db.crmActivity.findFirst({
                where: lookupWhere,
                select: { id: true, type: true, status: true, objectiveId: true, objectiveRealized: true },
            });
            if (!existing)
                return { success: false, error: 'Activité introuvable ou inaccessible' };
            const d = parsed.data;
            if (d.dueDate)
                d.dueDate = new Date(d.dueDate);
            if (d.completedAt)
                d.completedAt = new Date(d.completedAt);
            // Valeurs finales après application du payload partiel.
            const finalObjectiveId = 'objectiveId' in d ? (d.objectiveId ?? null) : existing.objectiveId;
            const finalRealized = 'objectiveRealized' in d
                ? (d.objectiveRealized ?? null)
                : (existing.objectiveRealized != null ? Number(existing.objectiveRealized) : null);
            const finalStatus = d.status ?? existing.status;
            let objTarget = null;
            let objMeasureType = null;
            if (finalObjectiveId != null) {
                const linked = await assertLinkableObjective(db, session, finalObjectiveId);
                objTarget = linked.target;
                objMeasureType = linked.measureType;
            }
            if (finalStatus === 'TRAITE' && finalObjectiveId != null && objMeasureType === 'MANUAL') {
                assertTaskCompletable(objTarget, finalRealized);
            }
            // Une activité sans objectif ne conserve pas de quantité réalisée.
            if (finalObjectiveId == null) {
                d.objectiveId = null;
                d.objectiveRealized = null;
            }
            const activity = await db.crmActivity.update({ where: { id }, data: d });
            // Recalcule l'avancement des objectifs impactés (ancien et nouveau).
            const affected = new Set();
            if (existing.objectiveId)
                affected.add(existing.objectiveId);
            if (finalObjectiveId)
                affected.add(finalObjectiveId);
            for (const oid of affected)
                await recomputeObjectiveProgress(db, oid);
            return { success: true, data: ser(activity) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:deleteActivity', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.crmActivity.delete({ where: { id } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:completeActivity', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const visibilityWhere = buildVisibilityWhere(session);
            const lookupWhere = Object.keys(visibilityWhere).length
                ? { AND: [{ id }, visibilityWhere] }
                : { id };
            const existing = await db.crmActivity.findFirst({
                where: lookupWhere,
                select: { id: true, objectiveId: true, objectiveRealized: true, objective: { select: { targetValue: true, measureType: true } } },
            });
            if (!existing)
                return { success: false, error: 'Activité introuvable ou inaccessible' };
            // Objectif lié à Mesure « Manuelle » : n'autorise « Traité » qu'à 100 % de
            // la cible. Les objectifs Auto ne conditionnent pas la complétion.
            if (existing.objectiveId && existing.objective?.measureType === 'MANUAL') {
                const target = existing.objective?.targetValue != null ? Number(existing.objective.targetValue) : 0;
                assertTaskCompletable(target, existing.objectiveRealized != null ? Number(existing.objectiveRealized) : null);
            }
            const activity = await db.crmActivity.update({
                where: { id },
                data: { status: 'TRAITE', completedAt: new Date() },
            });
            if (existing.objectiveId)
                await recomputeObjectiveProgress(db, existing.objectiveId);
            return { success: true, data: ser(activity) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:listAssignees', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Réservé aux rôles full-view : eux seuls peuvent filtrer par utilisateur.
            (0, auth_service_1.checkRole)(session, FULL_VIEW_ROLES);
            const db = (0, db_service_1.getDb)();
            const users = await db.user.findMany({
                where: { deletedAt: null, isActive: true },
                select: { id: true, firstName: true, lastName: true, role: true },
                orderBy: { id: 'asc' },
            });
            return { success: true, data: users };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('crm:getStats', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ALL_ROLES);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);
            // Les compteurs respectent la visibilité par rôle + filtre utilisateur (full-view).
            const visibilityWhere = buildVisibilityWhere(session);
            const userScope = filters.userId && hasFullView(session.role)
                ? activitiesForUserWhere(Number(filters.userId))
                : null;
            const withVisibility = (w) => {
                const clauses = [];
                if (Object.keys(visibilityWhere).length)
                    clauses.push(visibilityWhere);
                if (userScope)
                    clauses.push(userScope);
                return clauses.length ? { AND: [w, ...clauses] } : w;
            };
            const [total, pending, overdue, todayCount] = await db.$transaction([
                db.crmActivity.count({ where: withVisibility({ status: { not: 'ANNULE' } }) }),
                db.crmActivity.count({ where: withVisibility({ status: 'EN_ATTENTE' }) }),
                db.crmActivity.count({
                    where: withVisibility({
                        status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] },
                        dueDate: { lt: now },
                    }),
                }),
                db.crmActivity.count({
                    where: withVisibility({
                        dueDate: { gte: startOfDay, lte: endOfDay },
                        status: { not: 'ANNULE' },
                    }),
                }),
            ]);
            return { success: true, data: { total, pending, overdue, todayCount } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
