"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerItInnovationsIPC = registerItInnovationsIPC;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const storage_service_1 = require("../services/storage.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
// Création / gestion des fiches : réservé aux rôles techniques (Module 16).
// Liste EXPLICITE contrôlée par rôle exact (pas d'équivalence `checkRole`).
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RH', 'AGENT_TECHNIQUE'];
// Validation des phases (valider/rejeter) : réservée à SUPER_ADMIN/ADMIN/MANAGER.
const VALIDATE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
// Vue complète (toutes les innovations, sélection libre du porteur) :
// SUPER_ADMIN/ADMIN/MANAGER/RH. AGENT_TECHNIQUE est restreint à ses propres
// innovations (porteur = employé lié à son compte).
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RH'];
/** Vérifie un rôle exact (pas d'équivalence ACCOUNTANT/ASSISTANTE_DIRECTION → MANAGER). */
function checkExactRole(session, allowed) {
    if (!allowed.includes(session.role))
        throw new Error('Permission insuffisante');
}
function hasFullView(role) {
    return FULL_VIEW_ROLES.includes(role);
}
/** Fragment `where` limitant les innovations à celles du porteur (AGENT_TECHNIQUE). */
function innovationScopeWhere(session) {
    return hasFullView(session.role) ? {} : { employee: { userId: session.userId } };
}
/** Vérifie que l'utilisateur restreint est bien le porteur de l'innovation (sinon lève). */
async function assertOwnership(db, session, innovation) {
    if (hasFullView(session.role))
        return;
    const emp = await db.employee.findFirst({
        where: { id: innovation.employeeId, userId: session.userId, deletedAt: null },
        select: { id: true },
    });
    if (!emp)
        throw new Error('Accès restreint : vous n’êtes pas le porteur de cette innovation.');
}
/** Résout l'employé lié au compte connecté (auto-soumission, rôles restreints). */
async function resolveOwnEmployeeId(db, session) {
    const emp = await db.employee.findFirst({
        where: { userId: session.userId, deletedAt: null },
        select: { id: true },
    });
    if (!emp)
        throw new Error('Aucun dossier du personnel rattaché à votre compte.');
    return emp.id;
}
async function nextInnovationReference(db) {
    const year = new Date().getFullYear();
    const last = await db.itInnovation.findFirst({
        where: { reference: { startsWith: `INNOV-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `INNOV-${year}-${String(seq).padStart(4, '0')}`;
}
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);
/** Sérialise pour l'IPC : les Date Prisma ne sont pas clonables par Electron. */
const ser = (v) => JSON.parse(JSON.stringify(v));
const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, matricule: true, poste: true };
const ATTACHMENT_SELECT = {
    id: true, name: true, type: true, size: true, numeroArchive: true,
    itInnovationPhase: true, uploadedAt: true,
};
const createSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Titre requis'),
    employeeId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    phase1Description: zod_1.z.string().min(1, 'Description requise'),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const updateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    phase1Description: zod_1.z.string().min(1).optional(),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const submitPhase2Schema = zod_1.z.object({
    phase2Description: zod_1.z.string().min(1, 'Description requise'),
});
const submitPhase3Schema = zod_1.z.object({
    phase3Description: zod_1.z.string().min(1, 'Description requise'),
});
const validatePhaseSchema = zod_1.z
    .object({
    phase: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3)]),
    decision: zod_1.z.enum(['VALIDATE', 'REJECT']),
    reason: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
})
    .refine((d) => d.decision !== 'REJECT' || !!d.reason, { message: 'Motif de rejet requis', path: ['reason'] });
/** Résout les noms des utilisateurs référencés par des colonnes `Int?` sans relation Prisma. */
async function resolveUserNames(db, ids) {
    const unique = Array.from(new Set(ids.filter((v) => typeof v === 'number')));
    if (!unique.length)
        return new Map();
    const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
}
async function withValidatorNames(db, innovation) {
    const names = await resolveUserNames(db, [
        innovation.createdById,
        innovation.phase1ValidatedById,
        innovation.phase2ValidatedById,
        innovation.phase3ValidatedById,
    ]);
    return {
        ...innovation,
        createdByName: innovation.createdById ? names.get(innovation.createdById) ?? null : null,
        phase1ValidatedByName: innovation.phase1ValidatedById ? names.get(innovation.phase1ValidatedById) ?? null : null,
        phase2ValidatedByName: innovation.phase2ValidatedById ? names.get(innovation.phase2ValidatedById) ?? null : null,
        phase3ValidatedByName: innovation.phase3ValidatedById ? names.get(innovation.phase3ValidatedById) ?? null : null,
    };
}
const PHASE_PENDING_STATUS = {
    1: 'PHASE1_EN_ATTENTE',
    2: 'PHASE2_EN_ATTENTE',
    3: 'PHASE3_EN_ATTENTE',
};
/** Enregistre les handlers IPC du module Innovations IT (Module 16). */
function registerItInnovationsIPC() {
    electron_1.ipcMain.handle('innovations:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...innovationScopeWhere(session) };
            if (filters.status)
                where.status = filters.status;
            if (filters.employeeId && hasFullView(session.role))
                where.employeeId = Number(filters.employeeId);
            if (filters.search) {
                where.OR = [
                    { title: { contains: filters.search } },
                    { reference: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.itInnovation.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        employee: { select: EMPLOYEE_SELECT },
                        _count: { select: { attachments: { where: { deletedAt: null } } } },
                    },
                }),
                db.itInnovation.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('innovations:list', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('innovations:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const innovation = await db.itInnovation.findFirst({
                where: { id: Number(id), deletedAt: null, ...innovationScopeWhere(session) },
                include: {
                    employee: { select: EMPLOYEE_SELECT },
                    attachments: { where: { deletedAt: null }, orderBy: { uploadedAt: 'asc' }, select: ATTACHMENT_SELECT },
                },
            });
            if (!innovation)
                return { success: false, error: 'Innovation introuvable' };
            const data = await withValidatorNames(db, innovation);
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('innovations:getById', error.message);
            return { success: false, error: error.message };
        }
    });
    // Sélecteur « Porteur » du formulaire de création — réservé aux rôles en
    // vue complète (AGENT_TECHNIQUE est auto-affecté, pas de sélection libre).
    electron_1.ipcMain.handle('innovations:employees', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, FULL_VIEW_ROLES);
            const db = (0, db_service_1.getDb)();
            const employees = await db.employee.findMany({
                where: { deletedAt: null, status: 'ACTIF' },
                orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
                select: EMPLOYEE_SELECT,
            });
            return ser({ success: true, data: employees });
        }
        catch (error) {
            logger_1.default.error('innovations:employees', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('innovations:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const parsed = createSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            let employeeId;
            if (hasFullView(session.role)) {
                if (!parsed.data.employeeId)
                    return { success: false, error: 'Porteur requis' };
                const emp = await db.employee.findFirst({ where: { id: parsed.data.employeeId, deletedAt: null }, select: { id: true } });
                if (!emp)
                    return { success: false, error: 'Employé introuvable' };
                employeeId = emp.id;
            }
            else {
                employeeId = await resolveOwnEmployeeId(db, session);
            }
            const reference = await nextInnovationReference(db);
            const innovation = await db.itInnovation.create({
                data: {
                    reference,
                    title: parsed.data.title,
                    employeeId,
                    createdById: session.userId,
                    phase1Description: parsed.data.phase1Description,
                    notes: parsed.data.notes ?? null,
                    status: 'PHASE1_EN_ATTENTE',
                    progress: 0,
                },
                include: { employee: { select: EMPLOYEE_SELECT } },
            });
            logger_1.default.info(`Innovation IT créée : ${innovation.reference} — ${innovation.title}`);
            return ser({ success: true, data: innovation });
        }
        catch (error) {
            logger_1.default.error('innovations:create', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('innovations:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Innovation introuvable' };
            await assertOwnership(db, session, existing);
            const parsed = updateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const data = {};
            if (parsed.data.title !== undefined)
                data.title = parsed.data.title;
            if (parsed.data.notes !== undefined)
                data.notes = parsed.data.notes;
            if (parsed.data.phase1Description !== undefined) {
                if (!['PHASE1_EN_ATTENTE', 'PHASE1_REJETEE'].includes(existing.status)) {
                    return { success: false, error: 'La phase 1 ne peut plus être modifiée (déjà validée).' };
                }
                data.phase1Description = parsed.data.phase1Description;
                if (existing.status === 'PHASE1_REJETEE') {
                    data.status = 'PHASE1_EN_ATTENTE';
                    data.phase1RejectedAt = null;
                    data.phase1RejectionReason = null;
                }
            }
            const innovation = await db.itInnovation.update({
                where: { id: existing.id },
                data,
                include: { employee: { select: EMPLOYEE_SELECT } },
            });
            return ser({ success: true, data: innovation });
        }
        catch (error) {
            logger_1.default.error('innovations:update', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('innovations:submitPhase2', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Innovation introuvable' };
            await assertOwnership(db, session, existing);
            if (!['PHASE2_EN_COURS', 'PHASE2_REJETEE'].includes(existing.status)) {
                return { success: false, error: 'La phase 2 n’est pas accessible pour le moment.' };
            }
            const parsed = submitPhase2Schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const innovation = await db.itInnovation.update({
                where: { id: existing.id },
                data: {
                    phase2Description: parsed.data.phase2Description,
                    phase2SubmittedAt: new Date(),
                    phase2RejectedAt: null,
                    phase2RejectionReason: null,
                    status: 'PHASE2_EN_ATTENTE',
                },
                include: { employee: { select: EMPLOYEE_SELECT } },
            });
            return ser({ success: true, data: innovation });
        }
        catch (error) {
            logger_1.default.error('innovations:submitPhase2', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('innovations:submitPhase3', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Innovation introuvable' };
            await assertOwnership(db, session, existing);
            if (!['PHASE3_EN_COURS', 'PHASE3_REJETEE'].includes(existing.status)) {
                return { success: false, error: 'La phase 3 n’est pas accessible pour le moment.' };
            }
            const parsed = submitPhase3Schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const innovation = await db.itInnovation.update({
                where: { id: existing.id },
                data: {
                    phase3Description: parsed.data.phase3Description,
                    phase3SubmittedAt: new Date(),
                    phase3RejectedAt: null,
                    phase3RejectionReason: null,
                    status: 'PHASE3_EN_ATTENTE',
                },
                include: { employee: { select: EMPLOYEE_SELECT } },
            });
            return ser({ success: true, data: innovation });
        }
        catch (error) {
            logger_1.default.error('innovations:submitPhase3', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('innovations:validatePhase', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, VALIDATE_ROLES);
            const parsed = validatePhaseSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const { phase, decision, reason } = parsed.data;
            const db = (0, db_service_1.getDb)();
            const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Innovation introuvable' };
            if (existing.status !== PHASE_PENDING_STATUS[phase]) {
                return { success: false, error: 'Cette phase n’est pas en attente de validation.' };
            }
            const now = new Date();
            let data;
            if (decision === 'VALIDATE') {
                if (phase === 1) {
                    data = { phase1ValidatedById: session.userId, phase1ValidatedAt: now, progress: 15, status: 'PHASE2_EN_COURS' };
                }
                else if (phase === 2) {
                    data = { phase2ValidatedById: session.userId, phase2ValidatedAt: now, progress: 50, status: 'PHASE3_EN_COURS' };
                }
                else {
                    data = { phase3ValidatedById: session.userId, phase3ValidatedAt: now, progress: 100, status: 'VALIDEE' };
                }
            }
            else {
                if (phase === 1) {
                    data = { phase1RejectedAt: now, phase1RejectionReason: reason, status: 'PHASE1_REJETEE' };
                }
                else if (phase === 2) {
                    data = { phase2RejectedAt: now, phase2RejectionReason: reason, status: 'PHASE2_REJETEE' };
                }
                else {
                    data = { phase3RejectedAt: now, phase3RejectionReason: reason, status: 'PHASE3_REJETEE' };
                }
            }
            const innovation = await db.itInnovation.update({
                where: { id: existing.id },
                data,
                include: { employee: { select: EMPLOYEE_SELECT } },
            });
            logger_1.default.info(`Innovation IT ${innovation.reference} — phase ${phase} : ${decision}`);
            return ser({ success: true, data: innovation });
        }
        catch (error) {
            logger_1.default.error('innovations:validatePhase', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('innovations:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, VALIDATE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.itInnovation.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('innovations:delete', error.message);
            return { success: false, error: error.message };
        }
    });
    // Retire une pièce jointe d'une phase (soft delete GED) — WRITE_ROLES +
    // périmètre du porteur (AGENT_TECHNIQUE ne peut retirer que ses propres
    // pièces jointes), même contrôle que les autres mutations du module.
    electron_1.ipcMain.handle('innovations:removeAttachment', async (_event, { token, id, documentId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Innovation introuvable' };
            await assertOwnership(db, session, existing);
            const doc = await db.document.findFirst({
                where: { id: Number(documentId), itInnovationId: existing.id, deletedAt: null },
                select: { id: true, path: true },
            });
            if (!doc)
                return { success: false, error: 'Pièce jointe introuvable' };
            await db.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
            // Chemins relatifs uniquement : les références externes (chemin UNC absolu)
            // ne sont pas supprimées du stockage d'origine.
            if (doc.path && !path_1.default.isAbsolute(doc.path))
                (0, storage_service_1.removeStorageFile)(doc.path);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('innovations:removeAttachment', error.message);
            return { success: false, error: error.message };
        }
    });
}
