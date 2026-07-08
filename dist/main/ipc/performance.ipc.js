"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPerformanceIPC = registerPerformanceIPC;
const electron_1 = require("electron");
const zod_1 = require("zod");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const performance_service_1 = require("../services/performance.service");
const settings_service_1 = require("../services/settings.service");
/**
 * Module 14 — Évaluation & gestion des performances du personnel.
 *
 * Objectifs (annuels / trimestriels), KPI configurables calculés depuis les
 * données de l'application, pondération par poste, évaluations avec validation
 * électronique à 3 niveaux (responsable → collaborateur → Direction), plans de
 * progrès, classements multi-périodes et tableau de bord RH de performance.
 *
 * Contrôle de rôle EXACT (pas d'équivalence `checkRole`) afin de ne pas élargir
 * l'accès par héritage — même principe que le module RH (`hr.ipc.ts`).
 */
// Configuration (catalogue KPI, profils de pondération).
const PERF_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RH'];
// Gestion opérationnelle (objectifs, évaluations, plans) + lecture dashboard.
const PERF_MANAGE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RH', 'MANAGER'];
// Signature « Direction » (3ᵉ niveau).
const PERF_DIRECTION_ROLES = ['SUPER_ADMIN', 'ADMIN'];
function requireSession(token) {
    const session = (0, auth_service_1.getSession)(token);
    if (!session)
        throw new Error('Session expirée');
    return session;
}
function checkExact(session, allowed) {
    if (!allowed.includes(session.role))
        throw new Error('Permission insuffisante');
}
const isPerfAdmin = (role) => PERF_ADMIN_ROLES.includes(role);
/** Employé (fiche) rattaché au compte utilisateur de la session, s'il existe. */
async function sessionEmployee(db, session) {
    return db.employee.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true } });
}
/**
 * Identifiants des employés accessibles à la session pour la gestion de la
 * performance. `null` = aucune restriction (admins / RH). Un MANAGER n'accède
 * qu'à son équipe (ses subordonnés `managerId`) et à lui-même.
 */
async function accessibleEmployeeIds(db, session) {
    if (isPerfAdmin(session.role))
        return null;
    const me = await sessionEmployee(db, session);
    if (!me)
        return [];
    const subs = await db.employee.findMany({
        where: { deletedAt: null, managerId: me.id },
        select: { id: true },
    });
    return [me.id, ...subs.map((s) => s.id)];
}
/** Vérifie qu'un employé est accessible à la session (sinon lève). */
async function assertEmployeeAccessible(db, session, employeeId) {
    const ids = await accessibleEmployeeIds(db, session);
    if (ids !== null && !ids.includes(employeeId))
        throw new Error('Accès restreint à ce collaborateur.');
}
/** Fragment `where` limitant `employeeId` au périmètre accessible. */
async function scopeEmployeeWhere(db, session) {
    const ids = await accessibleEmployeeIds(db, session);
    return ids === null ? {} : { employeeId: { in: ids.length ? ids : [-1] } };
}
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);
async function nextEvaluationReference(db) {
    const year = new Date().getFullYear();
    const last = await db.performanceEvaluation.findFirst({
        where: { reference: { startsWith: `EVA-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `EVA-${year}-${String(seq).padStart(4, '0')}`;
}
// ── Schémas Zod ──────────────────────────────────────────────────────────────
const kpiSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Code requis'),
    label: zod_1.z.string().min(1, 'Libellé requis'),
    category: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    source: zod_1.z.enum(['SALES', 'COMMISSIONS', 'ACCOUNTING', 'CRM', 'PROSPECTS', 'ATTENDANCE', 'LEAVE', 'PROJECT', 'MANUAL']),
    metric: zod_1.z.enum([
        'SALES_COUNT', 'SALES_AMOUNT', 'RESILIATION_COUNT', 'COMMISSION_AMOUNT', 'ENCAISSEMENT_AMOUNT',
        'CRM_ACTIVITIES_DONE', 'CRM_VISITS', 'CRM_CALLS', 'PROSPECT_CONVERSION_RATE',
        'ATTENDANCE_RATE', 'OVERTIME_HOURS', 'ABSENCE_DAYS', 'MANUAL_VALUE',
    ]),
    unit: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    direction: zod_1.z.enum(['HIGHER_BETTER', 'LOWER_BETTER']).optional(),
    defaultTarget: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nullable().optional()),
    description: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    isActive: zod_1.z.boolean().optional(),
});
const weightProfileSchema = zod_1.z.object({
    poste: zod_1.z.string().min(1, 'Poste requis'),
    name: zod_1.z.string().min(1, 'Nom requis'),
    isActive: zod_1.z.boolean().optional(),
    lines: zod_1.z.array(zod_1.z.object({
        kpiDefinitionId: zod_1.z.coerce.number().int().positive(),
        weight: zod_1.z.coerce.number().min(0),
    })).default([]),
});
const objectiveSchema = zod_1.z.object({
    // Cible : un employé précis OU un poste (exactement l'un des deux).
    employeeId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    poste: zod_1.z.preprocess(emptyToNull, zod_1.z.string().min(1).nullable().optional()),
    cycleType: zod_1.z.enum(['ANNUEL', 'TRIMESTRIEL']),
    year: zod_1.z.coerce.number().int(),
    quarter: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().min(1).max(4).nullable().optional()),
    title: zod_1.z.string().min(1, 'Intitulé requis'),
    description: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    weight: zod_1.z.coerce.number().min(0).optional(),
    targetValue: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nullable().optional()),
    unit: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    kpiDefinitionId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    measureType: zod_1.z.enum(['AUTO', 'MANUAL']).optional(),
    progress: zod_1.z.coerce.number().int().min(0).optional(),
    status: zod_1.z.enum(['EN_COURS', 'ATTEINT', 'PARTIEL', 'NON_ATTEINT', 'ANNULE']).optional(),
});
// À la création, la cible (employé XOR poste) est obligatoire.
const objectiveCreateSchema = objectiveSchema.refine((d) => (d.employeeId != null) !== (d.poste != null), {
    message: 'Un objectif cible soit un collaborateur, soit un poste (pas les deux).',
    path: ['employeeId'],
});
const evalLineSchema = zod_1.z.object({
    objectiveId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    kpiDefinitionId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    label: zod_1.z.string().min(1),
    weight: zod_1.z.coerce.number().min(0).optional(),
    targetValue: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nullable().optional()),
    actualValue: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nullable().optional()),
    score: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nullable().optional()),
    comment: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const evalSchema = zod_1.z.object({
    employeeId: zod_1.z.coerce.number().int().positive(),
    cycleType: zod_1.z.enum(['ANNUEL', 'TRIMESTRIEL']),
    year: zod_1.z.coerce.number().int(),
    quarter: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().min(1).max(4).nullable().optional()),
    evaluatorId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    strengths: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    areasToImprove: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    comments: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    globalScore: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nullable().optional()),
    lines: zod_1.z.array(evalLineSchema).default([]),
});
const planSchema = zod_1.z.object({
    evaluationId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    employeeId: zod_1.z.coerce.number().int().positive(),
    title: zod_1.z.string().min(1, 'Intitulé requis'),
    actions: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    trainingNeeds: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    dueDate: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.date().nullable().optional()),
    status: zod_1.z.enum(['EN_COURS', 'REALISE', 'ABANDONNE']).optional(),
    followUpNotes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
// ── Enregistrement des handlers ──────────────────────────────────────────────
function registerPerformanceIPC() {
    /* ─── Catalogue KPI (configuration) ─────────────────────────────── */
    electron_1.ipcMain.handle('performance:kpis:list', async (_e, { token, includeInactive = false }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await db.kpiDefinition.findMany({ where, orderBy: { label: 'asc' } });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:kpis:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:kpis:create', async (_e, { token, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_ADMIN_ROLES);
            const parsed = kpiSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const data = await db.kpiDefinition.create({ data: parsed.data });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:kpis:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:kpis:update', async (_e, { token, id, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_ADMIN_ROLES);
            const parsed = kpiSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const data = await db.kpiDefinition.update({ where: { id: Number(id) }, data: parsed.data });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:kpis:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:kpis:delete', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.kpiDefinition.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('performance:kpis:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Profils de pondération par poste ──────────────────────────── */
    electron_1.ipcMain.handle('performance:weights:list', async (_e, { token }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.performanceWeightProfile.findMany({
                where: { deletedAt: null },
                orderBy: { poste: 'asc' },
                include: { lines: { include: { kpiDefinition: { select: { id: true, label: true, code: true } } } } },
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:weights:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:weights:upsert', async (_e, { token, id, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_ADMIN_ROLES);
            const parsed = weightProfileSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const { lines, ...header } = parsed.data;
            const db = (0, db_service_1.getDb)();
            const data = await db.$transaction(async (tx) => {
                let profileId;
                if (id) {
                    await tx.performanceWeightProfile.update({ where: { id: Number(id) }, data: header });
                    await tx.performanceWeightLine.deleteMany({ where: { profileId: Number(id) } });
                    profileId = Number(id);
                }
                else {
                    const created = await tx.performanceWeightProfile.create({ data: header });
                    profileId = created.id;
                }
                if (lines.length) {
                    await tx.performanceWeightLine.createMany({
                        data: lines.map((l) => ({ profileId, kpiDefinitionId: l.kpiDefinitionId, weight: l.weight })),
                    });
                }
                return tx.performanceWeightProfile.findUnique({ where: { id: profileId }, include: { lines: true } });
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:weights:upsert error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:weights:delete', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.performanceWeightProfile.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('performance:weights:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Unités des KPI (référentiel du champ « Unité ») ───────────── */
    const unitSchema = zod_1.z.object({ label: zod_1.z.string().min(1, 'Libellé requis'), isActive: zod_1.z.boolean().optional() });
    electron_1.ipcMain.handle('performance:units:list', async (_e, { token, includeInactive }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await db.kpiUnit.findMany({ where, orderBy: { label: 'asc' } });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:units:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:units:create', async (_e, { token, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_ADMIN_ROLES);
            const parsed = unitSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const label = parsed.data.label.trim();
            const existing = await db.kpiUnit.findUnique({ where: { label } });
            if (existing) {
                const data = await db.kpiUnit.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
                return (0, performance_service_1.ser)({ success: true, data });
            }
            const data = await db.kpiUnit.create({ data: { label, isActive: parsed.data.isActive ?? true } });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:units:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:units:update', async (_e, { token, id, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_ADMIN_ROLES);
            const parsed = unitSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            if (typeof data.label === 'string')
                data.label = data.label.trim();
            const updated = await db.kpiUnit.update({ where: { id: Number(id) }, data });
            return (0, performance_service_1.ser)({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('performance:units:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:units:delete', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.kpiUnit.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('performance:units:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Sélecteur d'employés (périmètre accessible) ───────────────── */
    electron_1.ipcMain.handle('performance:employees:list', async (_e, { token }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const ids = await accessibleEmployeeIds(db, session);
            const where = { deletedAt: null };
            if (ids !== null)
                where.id = { in: ids.length ? ids : [-1] };
            const data = await db.employee.findMany({
                where,
                orderBy: { matricule: 'desc' },
                select: { id: true, matricule: true, firstName: true, lastName: true, poste: true, departement: true, userId: true, status: true },
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:employees:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Objectifs ─────────────────────────────────────────────────── */
    electron_1.ipcMain.handle('performance:objectives:list', async (_e, { token, filters = {} }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.employeeId)
                where.employeeId = Number(filters.employeeId);
            if (filters.poste)
                where.poste = String(filters.poste);
            if (filters.year)
                where.year = Number(filters.year);
            if (filters.cycleType)
                where.cycleType = filters.cycleType;
            if (filters.quarter)
                where.quarter = Number(filters.quarter);
            if (filters.status)
                where.status = filters.status;
            if (filters.scope === 'employee')
                where.employeeId = { not: null };
            // « Par poste » ne doit pas écraser un filtre sur un poste précis.
            if (filters.scope === 'poste' && !filters.poste)
                where.poste = { not: null };
            // Périmètre restreint : les objectifs d'employés du périmètre + TOUS les
            // objectifs par poste (modèles génériques, visibles par tous).
            const ids = await accessibleEmployeeIds(db, session);
            if (ids !== null) {
                where.OR = [{ employeeId: { in: ids.length ? ids : [-1] } }, { employeeId: null }];
            }
            const data = await db.performanceObjective.findMany({
                where,
                orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
                include: {
                    employee: { select: { id: true, firstName: true, lastName: true, matricule: true, poste: true } },
                    kpiDefinition: { select: { id: true, label: true, unit: true } },
                },
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:objectives:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:objectives:getById', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.performanceObjective.findFirst({
                where: { id: Number(id), deletedAt: null },
                include: { employee: true, kpiDefinition: true },
            });
            if (!data)
                return { success: false, error: 'Objectif introuvable' };
            if (data.employeeId != null)
                await assertEmployeeAccessible(db, session, data.employeeId);
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:objectives:getById error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:objectives:create', async (_e, { token, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const parsed = objectiveCreateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            if (parsed.data.employeeId != null) {
                await assertEmployeeAccessible(db, session, parsed.data.employeeId);
            }
            else {
                // Objectif par poste : réservé à la configuration (admins / RH).
                checkExact(session, PERF_ADMIN_ROLES);
            }
            const data = await db.performanceObjective.create({ data: { ...parsed.data, createdById: session.userId } });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:objectives:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:objectives:update', async (_e, { token, id, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.performanceObjective.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Objectif introuvable' };
            if (existing.employeeId != null)
                await assertEmployeeAccessible(db, session, existing.employeeId);
            else
                checkExact(session, PERF_ADMIN_ROLES);
            const parsed = objectiveSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            // La cible (employé / poste) est fixée à la création : non modifiable ici.
            const { employeeId, poste, ...data } = parsed.data;
            const updated = await db.performanceObjective.update({ where: { id: Number(id) }, data: data });
            return (0, performance_service_1.ser)({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('performance:objectives:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:objectives:delete', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.performanceObjective.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Objectif introuvable' };
            if (existing.employeeId != null)
                await assertEmployeeAccessible(db, session, existing.employeeId);
            else
                checkExact(session, PERF_ADMIN_ROLES);
            await db.performanceObjective.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('performance:objectives:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Duplique les objectifs d'une période source vers une période cible. Copie la
    // définition (intitulé, cible, pondération, KPI…) en réinitialisant l'avancement
    // et le statut. Ignore les objectifs déjà présents à l'identique dans la cible.
    electron_1.ipcMain.handle('performance:objectives:duplicate', async (_e, { token, source, target }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const parsed = zod_1.z.object({
                source: zod_1.z.object({
                    cycleType: zod_1.z.enum(['ANNUEL', 'TRIMESTRIEL']),
                    year: zod_1.z.coerce.number().int(),
                    quarter: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().min(1).max(4).nullable().optional()),
                }),
                target: zod_1.z.object({
                    cycleType: zod_1.z.enum(['ANNUEL', 'TRIMESTRIEL']),
                    year: zod_1.z.coerce.number().int(),
                    quarter: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().min(1).max(4).nullable().optional()),
                }),
            }).safeParse({ source, target });
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const src = parsed.data.source;
            const tgt = parsed.data.target;
            const srcQuarter = src.cycleType === 'TRIMESTRIEL' ? (src.quarter ?? null) : null;
            const tgtQuarter = tgt.cycleType === 'TRIMESTRIEL' ? (tgt.quarter ?? null) : null;
            if (tgt.cycleType === 'TRIMESTRIEL' && !tgtQuarter)
                return { success: false, error: 'Trimestre cible requis.' };
            if (src.cycleType === tgt.cycleType && src.year === tgt.year && srcQuarter === tgtQuarter) {
                return { success: false, error: 'La période cible doit différer de la période source.' };
            }
            const db = (0, db_service_1.getDb)();
            // Objectifs source dans le périmètre accessible (employés + objectifs de poste).
            const where = { deletedAt: null, cycleType: src.cycleType, year: src.year };
            if (src.cycleType === 'TRIMESTRIEL')
                where.quarter = srcQuarter;
            const ids = await accessibleEmployeeIds(db, session);
            if (ids !== null)
                where.OR = [{ employeeId: { in: ids.length ? ids : [-1] } }, { employeeId: null }];
            const sources = await db.performanceObjective.findMany({ where });
            let created = 0;
            let skipped = 0;
            for (const o of sources) {
                // Droits : objectif par poste = admins/RH ; objectif d'employé = périmètre.
                if (o.employeeId != null) {
                    if (!isPerfAdmin(session.role)) {
                        const acc = ids === null ? null : ids;
                        if (acc !== null && !acc.includes(o.employeeId)) {
                            skipped++;
                            continue;
                        }
                    }
                }
                else if (!isPerfAdmin(session.role)) {
                    skipped++;
                    continue; // objectifs par poste : réservés aux admins/RH
                }
                // Anti-doublon : même cible + intitulé déjà présent dans la période cible.
                const dup = await db.performanceObjective.findFirst({
                    where: {
                        deletedAt: null, cycleType: tgt.cycleType, year: tgt.year, quarter: tgtQuarter,
                        title: o.title,
                        ...(o.employeeId != null ? { employeeId: o.employeeId } : { poste: o.poste }),
                    },
                    select: { id: true },
                });
                if (dup) {
                    skipped++;
                    continue;
                }
                await db.performanceObjective.create({
                    data: {
                        employeeId: o.employeeId,
                        poste: o.poste,
                        cycleType: tgt.cycleType,
                        year: tgt.year,
                        quarter: tgtQuarter,
                        title: o.title,
                        description: o.description,
                        weight: o.weight,
                        targetValue: o.targetValue,
                        unit: o.unit,
                        kpiDefinitionId: o.kpiDefinitionId,
                        measureType: o.measureType,
                        progress: 0,
                        status: 'EN_COURS',
                        createdById: session.userId,
                    },
                });
                created++;
            }
            return { success: true, data: { created, skipped, total: sources.length } };
        }
        catch (error) {
            logger_1.default.error('performance:objectives:duplicate error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Évaluations ───────────────────────────────────────────────── */
    electron_1.ipcMain.handle('performance:evaluations:list', async (_e, { token, filters = {} }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...(await scopeEmployeeWhere(db, session)) };
            if (filters.employeeId)
                where.employeeId = Number(filters.employeeId);
            if (filters.year)
                where.year = Number(filters.year);
            if (filters.cycleType)
                where.cycleType = filters.cycleType;
            if (filters.status)
                where.status = filters.status;
            const data = await db.performanceEvaluation.findMany({
                where,
                orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
                include: {
                    employee: { select: { id: true, firstName: true, lastName: true, matricule: true, poste: true, departement: true } },
                    evaluator: { select: { id: true, firstName: true, lastName: true } },
                },
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:evaluations:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:evaluations:getById', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await evaluationDetail(db, Number(id));
            if (!data)
                return { success: false, error: 'Évaluation introuvable' };
            await assertEmployeeAccessible(db, session, data.employeeId);
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:evaluations:getById error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:evaluations:create', async (_e, { token, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const parsed = evalSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            await assertEmployeeAccessible(db, session, parsed.data.employeeId);
            const { lines, ...header } = parsed.data;
            const reference = await nextEvaluationReference(db);
            const data = await db.$transaction(async (tx) => {
                const created = await tx.performanceEvaluation.create({
                    data: { ...header, reference, createdById: session.userId },
                });
                if (lines.length) {
                    await tx.performanceEvaluationLine.createMany({
                        data: lines.map((l) => ({ ...l, evaluationId: created.id })),
                    });
                }
                return created;
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:evaluations:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:evaluations:update', async (_e, { token, id, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.performanceEvaluation.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Évaluation introuvable' };
            await assertEmployeeAccessible(db, session, existing.employeeId);
            if (['VALIDEE_DIRECTION', 'CLOTUREE'].includes(existing.status)) {
                return { success: false, error: 'Évaluation validée : modification impossible.' };
            }
            const parsed = evalSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const { lines, ...header } = parsed.data;
            const data = await db.$transaction(async (tx) => {
                await tx.performanceEvaluation.update({ where: { id: Number(id) }, data: header });
                if (lines) {
                    await tx.performanceEvaluationLine.deleteMany({ where: { evaluationId: Number(id) } });
                    if (lines.length) {
                        await tx.performanceEvaluationLine.createMany({
                            data: lines.map((l) => ({ ...l, evaluationId: Number(id) })),
                        });
                    }
                }
                return evaluationDetail(tx, Number(id));
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:evaluations:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Calcule les KPI automatiques du collaborateur sur la période du cycle et
    // remplace les lignes « KPI » de l'évaluation (les lignes manuelles liées à un
    // objectif sans KPI sont conservées).
    electron_1.ipcMain.handle('performance:evaluations:computeKpis', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const evaluation = await db.performanceEvaluation.findFirst({
                where: { id: Number(id), deletedAt: null },
                include: { employee: { select: { id: true, userId: true, poste: true } }, lines: true },
            });
            if (!evaluation)
                return { success: false, error: 'Évaluation introuvable' };
            await assertEmployeeAccessible(db, session, evaluation.employeeId);
            if (['VALIDEE_DIRECTION', 'CLOTUREE'].includes(evaluation.status)) {
                return { success: false, error: 'Évaluation validée : recalcul impossible.' };
            }
            const { start, end } = cyclePeriod(evaluation.cycleType, evaluation.year, evaluation.quarter);
            // Cibles saisies par KPI (conservées lors du recalcul).
            const targets = new Map();
            for (const l of evaluation.lines) {
                if (l.kpiDefinitionId != null && l.targetValue != null)
                    targets.set(l.kpiDefinitionId, Number(l.targetValue));
            }
            const { lines, globalScore } = await (0, performance_service_1.computeEvaluationKpis)(db, { id: evaluation.employee.id, userId: evaluation.employee.userId }, evaluation.employee.poste, start, end, targets);
            const data = await db.$transaction(async (tx) => {
                // Conserver les lignes manuelles (sans kpiDefinitionId).
                await tx.performanceEvaluationLine.deleteMany({ where: { evaluationId: evaluation.id, kpiDefinitionId: { not: null } } });
                if (lines.length) {
                    await tx.performanceEvaluationLine.createMany({
                        data: lines.map((l) => ({
                            evaluationId: evaluation.id,
                            kpiDefinitionId: l.kpiDefinitionId,
                            label: l.label,
                            weight: l.weight,
                            targetValue: l.targetValue,
                            actualValue: l.actualValue,
                            score: l.score,
                        })),
                    });
                }
                await tx.performanceEvaluation.update({ where: { id: evaluation.id }, data: { globalScore } });
                return evaluationDetail(tx, evaluation.id);
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:evaluations:computeKpis error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:evaluations:submit', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.performanceEvaluation.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Évaluation introuvable' };
            await assertEmployeeAccessible(db, session, existing.employeeId);
            if (!['BROUILLON', 'REFUSEE'].includes(existing.status)) {
                return { success: false, error: 'Évaluation déjà soumise.' };
            }
            const data = await db.performanceEvaluation.update({
                where: { id: Number(id) },
                data: {
                    status: 'SOUMISE',
                    evaluatorId: existing.evaluatorId ?? session.userId,
                    refusedById: null, refusedAt: null, refusalReason: null,
                },
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:evaluations:submit error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Signature électronique d'un niveau. level: MANAGER | EMPLOYEE | DIRECTION.
    electron_1.ipcMain.handle('performance:evaluations:sign', async (_e, { token, id, level }) => {
        try {
            const session = requireSession(token);
            const db = (0, db_service_1.getDb)();
            const data = await signEvaluation(db, session, Number(id), level);
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:evaluations:sign error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:evaluations:refuse', async (_e, { token, id, reason }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.performanceEvaluation.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Évaluation introuvable' };
            await assertEmployeeAccessible(db, session, existing.employeeId);
            const data = await db.performanceEvaluation.update({
                where: { id: Number(id) },
                data: { status: 'REFUSEE', refusedById: session.userId, refusedAt: new Date(), refusalReason: reason ?? null },
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:evaluations:refuse error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Suppression d'une évaluation : réservée aux administrateurs (SUPER_ADMIN /
    // ADMIN), quel que soit le statut de l'évaluation.
    electron_1.ipcMain.handle('performance:evaluations:delete', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_DIRECTION_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.performanceEvaluation.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Évaluation introuvable' };
            await db.performanceEvaluation.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('performance:evaluations:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Plans de progrès ──────────────────────────────────────────── */
    electron_1.ipcMain.handle('performance:plans:list', async (_e, { token, filters = {} }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...(await scopeEmployeeWhere(db, session)) };
            if (filters.employeeId)
                where.employeeId = Number(filters.employeeId);
            if (filters.evaluationId)
                where.evaluationId = Number(filters.evaluationId);
            if (filters.status)
                where.status = filters.status;
            const data = await db.progressPlan.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: { employee: { select: { id: true, firstName: true, lastName: true, matricule: true } } },
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:plans:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:plans:create', async (_e, { token, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const parsed = planSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            await assertEmployeeAccessible(db, session, parsed.data.employeeId);
            const data = await db.progressPlan.create({ data: { ...parsed.data, createdById: session.userId } });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:plans:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:plans:update', async (_e, { token, id, payload }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.progressPlan.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Plan introuvable' };
            await assertEmployeeAccessible(db, session, existing.employeeId);
            const parsed = planSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const data = await db.progressPlan.update({ where: { id: Number(id) }, data: parsed.data });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:plans:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:plans:delete', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.progressPlan.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Plan introuvable' };
            await assertEmployeeAccessible(db, session, existing.employeeId);
            await db.progressPlan.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('performance:plans:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Classements ───────────────────────────────────────────────── */
    electron_1.ipcMain.handle('performance:rankings:get', async (_e, { token, periodType = 'MOIS', refDate, basis }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const ref = refDate ? new Date(refDate) : new Date();
            const result = await (0, performance_service_1.computeRanking)(db, periodType, ref, basis);
            return (0, performance_service_1.ser)({ success: true, data: result });
        }
        catch (error) {
            logger_1.default.error('performance:rankings:get error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:rankings:snapshot', async (_e, { token, periodType = 'MOIS', refDate, basis }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const ref = refDate ? new Date(refDate) : new Date();
            const result = await (0, performance_service_1.computeRanking)(db, periodType, ref, basis);
            const snapshot = await db.$transaction(async (tx) => {
                const snap = await tx.performanceRankingSnapshot.create({
                    data: {
                        periodType: periodType,
                        periodStart: result.period.start,
                        periodEnd: result.period.end,
                        basis: result.basis,
                        generatedById: session.userId,
                    },
                });
                if (result.entries.length) {
                    await tx.performanceRankingEntry.createMany({
                        data: result.entries.map((en) => ({ snapshotId: snap.id, employeeId: en.employeeId, score: en.score, rank: en.rank })),
                    });
                }
                return snap;
            });
            return (0, performance_service_1.ser)({ success: true, data: snapshot });
        }
        catch (error) {
            logger_1.default.error('performance:rankings:snapshot error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:rankings:history', async (_e, { token, periodType }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = {};
            if (periodType)
                where.periodType = periodType;
            const data = await db.performanceRankingSnapshot.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: 100,
                include: { generatedBy: { select: { firstName: true, lastName: true } }, _count: { select: { entries: true } } },
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:rankings:history error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:rankings:getSnapshot', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.performanceRankingSnapshot.findUnique({
                where: { id: Number(id) },
                include: {
                    generatedBy: { select: { firstName: true, lastName: true } },
                    entries: {
                        orderBy: { rank: 'asc' },
                        include: { employee: { select: { id: true, firstName: true, lastName: true, matricule: true, poste: true, departement: true } } },
                    },
                },
            });
            if (!data)
                return { success: false, error: 'Classement introuvable' };
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:rankings:getSnapshot error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Suppression définitive d'un classement archivé (entrées puis snapshot —
    // pas de cascade FK). Accessible aux rôles de gestion des performances.
    electron_1.ipcMain.handle('performance:rankings:deleteSnapshot', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const sid = Number(id);
            const snap = await db.performanceRankingSnapshot.findUnique({ where: { id: sid } });
            if (!snap)
                return { success: false, error: 'Classement introuvable' };
            await db.$transaction([
                db.performanceRankingEntry.deleteMany({ where: { snapshotId: sid } }),
                db.performanceRankingSnapshot.delete({ where: { id: sid } }),
            ]);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('performance:rankings:deleteSnapshot error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Personnel à classer (roster) ──────────────────────────────── */
    // Liste des employés actifs + ids retenus pour les classements. Si aucun
    // roster n'est configuré, tous les employés actifs sont classés (`ids: []`).
    electron_1.ipcMain.handle('performance:ranking:getRoster', async (_e, { token }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const [ids, employees] = await Promise.all([
                (0, performance_service_1.rankingRoster)(db),
                db.employee.findMany({
                    where: { deletedAt: null, status: 'ACTIF' },
                    orderBy: { matricule: 'desc' },
                    select: { id: true, matricule: true, firstName: true, lastName: true, poste: true, departement: true, userId: true },
                }),
            ]);
            return (0, performance_service_1.ser)({ success: true, data: { ids: ids ?? [], employees } });
        }
        catch (error) {
            logger_1.default.error('performance:ranking:getRoster error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:ranking:setRoster', async (_e, { token, ids }) => {
        try {
            const session = requireSession(token);
            checkExact(session, PERF_ADMIN_ROLES);
            const parsed = zod_1.z.array(zod_1.z.coerce.number().int().positive()).safeParse(ids);
            if (!parsed.success)
                return { success: false, error: 'Liste d’employés invalide' };
            // Liste vide → on efface le roster (retour au comportement « tous les actifs »).
            await (0, settings_service_1.setSetting)(performance_service_1.RANKING_ROSTER_KEY, JSON.stringify([...new Set(parsed.data)]));
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('performance:ranking:setRoster error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Tableau de bord de performance ────────────────────────────── */
    electron_1.ipcMain.handle('performance:dashboard', async (_e, { token }) => {
        try {
            const session = requireSession(token);
            // Tableau de bord de performance : réservé aux admins & RH (MANAGER exclu).
            checkExact(session, PERF_ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await buildDashboard(db);
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:dashboard error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Self-service (« Mes performances ») ───────────────────────── */
    electron_1.ipcMain.handle('performance:me:overview', async (_e, { token, year }) => {
        try {
            const session = requireSession(token);
            const db = (0, db_service_1.getDb)();
            const me = await db.employee.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true, poste: true } });
            if (!me)
                return { success: false, error: 'Aucun dossier du personnel rattaché à votre compte.' };
            const y = year ? Number(year) : new Date().getFullYear();
            // Objectifs : les miens + ceux définis pour mon poste.
            const objectiveTargets = [{ employeeId: me.id }];
            if (me.poste)
                objectiveTargets.push({ poste: me.poste });
            const [objectives, evaluations, plans] = await Promise.all([
                db.performanceObjective.findMany({
                    where: { deletedAt: null, year: y, OR: objectiveTargets },
                    orderBy: { createdAt: 'desc' },
                    include: { kpiDefinition: { select: { label: true, unit: true } } },
                }),
                db.performanceEvaluation.findMany({
                    where: { deletedAt: null, employeeId: me.id },
                    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
                    include: { evaluator: { select: { firstName: true, lastName: true } } },
                }),
                db.progressPlan.findMany({ where: { deletedAt: null, employeeId: me.id }, orderBy: { createdAt: 'desc' } }),
            ]);
            return (0, performance_service_1.ser)({ success: true, data: { employeeId: me.id, year: y, objectives, evaluations, plans } });
        }
        catch (error) {
            logger_1.default.error('performance:me:overview error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:me:evaluation', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            const db = (0, db_service_1.getDb)();
            const me = await sessionEmployee(db, session);
            if (!me)
                return { success: false, error: 'Aucun dossier du personnel rattaché à votre compte.' };
            const data = await evaluationDetail(db, Number(id));
            if (!data || data.employeeId !== me.id)
                return { success: false, error: 'Évaluation introuvable' };
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:me:evaluation error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Signature « collaborateur » depuis l'espace self-service.
    electron_1.ipcMain.handle('performance:me:sign', async (_e, { token, id }) => {
        try {
            const session = requireSession(token);
            const db = (0, db_service_1.getDb)();
            const data = await signEvaluation(db, session, Number(id), 'EMPLOYEE');
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:me:sign error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('performance:me:ranking', async (_e, { token, periodType = 'MOIS', refDate }) => {
        try {
            const session = requireSession(token);
            const db = (0, db_service_1.getDb)();
            const me = await sessionEmployee(db, session);
            if (!me)
                return { success: false, error: 'Aucun dossier du personnel rattaché à votre compte.' };
            const ref = refDate ? new Date(refDate) : new Date();
            const result = await (0, performance_service_1.computeRanking)(db, periodType, ref);
            const mine = result.entries.find((en) => en.employeeId === me.id) ?? null;
            return (0, performance_service_1.ser)({ success: true, data: { period: result.period, basis: result.basis, total: result.entries.length, entry: mine } });
        }
        catch (error) {
            logger_1.default.error('performance:me:ranking error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Objectifs à Mesure « Manuelle » personnellement assignés au collaborateur
    // connecté et dotés d'une cible chiffrée (> 0) — pour lier une tâche CRM.
    electron_1.ipcMain.handle('performance:me:manualObjectives', async (_e, { token }) => {
        try {
            const session = requireSession(token);
            const db = (0, db_service_1.getDb)();
            const me = await sessionEmployee(db, session);
            if (!me)
                return (0, performance_service_1.ser)({ success: true, data: [] });
            const data = await db.performanceObjective.findMany({
                where: {
                    deletedAt: null,
                    employeeId: me.id,
                    measureType: 'MANUAL',
                    targetValue: { not: null, gt: 0 },
                    status: { notIn: ['ATTEINT', 'ANNULE'] },
                },
                orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
                select: { id: true, title: true, targetValue: true, unit: true, year: true, cycleType: true, quarter: true },
            });
            return (0, performance_service_1.ser)({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('performance:me:manualObjectives error', error.message);
            return { success: false, error: error.message };
        }
    });
}
// ── Fonctions internes ───────────────────────────────────────────────────────
/** Période [start, end[ correspondant au cycle d'une évaluation. */
function cyclePeriod(cycleType, year, quarter) {
    if (cycleType === 'TRIMESTRIEL' && quarter) {
        const q = quarter - 1;
        return { start: new Date(year, q * 3, 1), end: new Date(year, q * 3 + 3, 1) };
    }
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}
/** Détail complet d'une évaluation (lignes, plans, employé, évaluateur). */
async function evaluationDetail(db, id) {
    return db.performanceEvaluation.findFirst({
        where: { id, deletedAt: null },
        include: {
            employee: { select: { id: true, firstName: true, lastName: true, matricule: true, poste: true, departement: true, userId: true } },
            evaluator: { select: { id: true, firstName: true, lastName: true } },
            lines: { include: { kpiDefinition: { select: { id: true, label: true, unit: true } } } },
            plans: { where: { deletedAt: null } },
        },
    });
}
/**
 * Applique une signature électronique et fait avancer le statut. Niveaux :
 *  - MANAGER    : SOUMISE → VALIDEE_RESPONSABLE (rôles gestionnaires) ;
 *  - EMPLOYEE   : VALIDEE_RESPONSABLE → VALIDEE_COLLABORATEUR (le collaborateur) ;
 *  - DIRECTION  : VALIDEE_COLLABORATEUR → VALIDEE_DIRECTION (SUPER_ADMIN/ADMIN).
 */
async function signEvaluation(db, session, id, level) {
    const evaluation = await db.performanceEvaluation.findFirst({
        where: { id, deletedAt: null },
        include: { employee: { select: { id: true, userId: true } } },
    });
    if (!evaluation)
        throw new Error('Évaluation introuvable');
    const now = new Date();
    if (level === 'MANAGER') {
        checkExact(session, PERF_MANAGE_ROLES);
        if (evaluation.status !== 'SOUMISE')
            throw new Error('L’évaluation doit être soumise pour la validation du responsable.');
        return db.performanceEvaluation.update({
            where: { id },
            data: { status: 'VALIDEE_RESPONSABLE', managerSignedById: session.userId, managerSignedAt: now },
        });
    }
    if (level === 'EMPLOYEE') {
        if (evaluation.employee.userId !== session.userId)
            throw new Error('Seul le collaborateur concerné peut signer.');
        if (evaluation.status !== 'VALIDEE_RESPONSABLE')
            throw new Error('En attente de la validation du responsable.');
        return db.performanceEvaluation.update({
            where: { id },
            data: { status: 'VALIDEE_COLLABORATEUR', employeeSignedById: session.userId, employeeSignedAt: now },
        });
    }
    // DIRECTION
    checkExact(session, PERF_DIRECTION_ROLES);
    if (evaluation.status !== 'VALIDEE_COLLABORATEUR')
        throw new Error('En attente de la validation du collaborateur.');
    return db.performanceEvaluation.update({
        where: { id },
        data: { status: 'VALIDEE_DIRECTION', directionSignedById: session.userId, directionSignedAt: now },
    });
}
/** Agrégations du tableau de bord de performance. */
async function buildDashboard(db) {
    const now = new Date();
    const year = now.getFullYear();
    // Classement du mois (KPI) — top performers.
    const monthRanking = await (0, performance_service_1.computeRanking)(db, 'MOIS', now, 'KPI');
    const topPerformers = monthRanking.entries.slice(0, 5);
    // Performance moyenne par service (département) sur les évaluations validées de l'année.
    const evals = await db.performanceEvaluation.findMany({
        where: { deletedAt: null, year, status: { in: ['VALIDEE_DIRECTION', 'CLOTUREE', 'VALIDEE_COLLABORATEUR'] } },
        include: { employee: { select: { departement: true } } },
    });
    const byService = new Map();
    for (const e of evals) {
        const key = e.employee.departement || 'Non affecté';
        const cur = byService.get(key) ?? { total: 0, count: 0 };
        cur.total += Number(e.globalScore ?? 0);
        cur.count += 1;
        byService.set(key, cur);
    }
    const services = [...byService.entries()].map(([departement, v]) => ({
        departement,
        avgScore: v.count ? Math.round((v.total / v.count) * 10) / 10 : 0,
        evaluations: v.count,
    })).sort((a, b) => b.avgScore - a.avgScore);
    // Tendance : score moyen des évaluations validées par mois (12 mois glissants).
    const trendStart = new Date(year - 1, now.getMonth() + 1, 1);
    const trendEvals = await db.performanceEvaluation.findMany({
        where: { deletedAt: null, updatedAt: { gte: trendStart }, status: { in: ['VALIDEE_DIRECTION', 'CLOTUREE'] } },
        select: { globalScore: true, updatedAt: true },
    });
    const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const trend = [];
    for (let i = 11; i >= 0; i--) {
        const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const items = trendEvals.filter((t) => t.updatedAt >= s && t.updatedAt < e);
        const avg = items.length ? items.reduce((a, t) => a + Number(t.globalScore ?? 0), 0) / items.length : 0;
        trend.push({ label: `${MOIS[s.getMonth()]} ${String(s.getFullYear()).slice(2)}`, avgScore: Math.round(avg * 10) / 10, count: items.length });
    }
    // Besoins de formation : plans de progrès en cours mentionnant une formation.
    const plans = await db.progressPlan.findMany({
        where: { deletedAt: null, status: 'EN_COURS' },
        orderBy: { createdAt: 'desc' },
        include: { employee: { select: { firstName: true, lastName: true, departement: true } } },
    });
    const trainingNeeds = plans
        .filter((p) => (p.trainingNeeds ?? '').trim().length > 0)
        .slice(0, 20)
        .map((p) => ({
        id: p.id,
        employee: `${p.employee.firstName} ${p.employee.lastName}`.trim(),
        departement: p.employee.departement,
        trainingNeeds: p.trainingNeeds,
        dueDate: p.dueDate,
    }));
    // Compteurs.
    const [evaluationsTotal, pending, objectivesActive] = await Promise.all([
        db.performanceEvaluation.count({ where: { deletedAt: null, year } }),
        db.performanceEvaluation.count({ where: { deletedAt: null, status: { in: ['SOUMISE', 'VALIDEE_RESPONSABLE', 'VALIDEE_COLLABORATEUR'] } } }),
        db.performanceObjective.count({ where: { deletedAt: null, year, status: 'EN_COURS' } }),
    ]);
    return {
        counters: { evaluationsTotal, pending, objectivesActive, trainingNeeds: trainingNeeds.length },
        topPerformers,
        services,
        trend,
        trainingNeeds,
        period: monthRanking.period,
    };
}
