import { ipcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../services/db.service';
import { getSession } from '../services/auth.service';
import logger from '../utils/logger';
import {
  ser,
  computeEvaluationKpis,
  computeRanking,
  rankingRoster,
  RANKING_ROSTER_KEY,
  periodBounds,
  quarterOf,
  type RankingPeriodType,
  type RankingBasis,
} from '../services/performance.service';
import { setSetting } from '../services/settings.service';

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

// Objectifs liés à ces KPI ne sont jamais proposés dans le sélecteur « Objectif
// lié » de « Nouvelle activité » (quel que soit l'utilisateur connecté) : leur
// progression n'a pas de sens rattachée à une activité CRM ponctuelle. Exportée
// pour être réutilisée par crm.ipc.ts (garde de liaison d'objectif).
export const LINKABLE_EXCLUDED_METRICS = ['CRM_ACTIVITIES_DONE', 'ABSENCE_DAYS', 'ATTENDANCE_RATE', 'LATE_EARLY_DEPARTURE_HOURS'];

type Db = ReturnType<typeof getDb>;
type Session = { userId: number; role: string };

function requireSession(token: string): Session {
  const session = getSession(token);
  if (!session) throw new Error('Session expirée');
  return session;
}

function checkExact(session: Session, allowed: string[]): void {
  if (!allowed.includes(session.role)) throw new Error('Permission insuffisante');
}

const isPerfAdmin = (role: string): boolean => PERF_ADMIN_ROLES.includes(role);

/** Employé (fiche) rattaché au compte utilisateur de la session, s'il existe. */
async function sessionEmployee(db: Db, session: Session): Promise<{ id: number } | null> {
  return db.employee.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true } });
}

/**
 * Identifiants des employés accessibles à la session pour la gestion de la
 * performance. `null` = aucune restriction (admins / RH). Un MANAGER n'accède
 * qu'à son équipe (ses subordonnés `managerId`) et à lui-même.
 */
async function accessibleEmployeeIds(db: Db, session: Session): Promise<number[] | null> {
  if (isPerfAdmin(session.role)) return null;
  const me = await sessionEmployee(db, session);
  if (!me) return [];
  const subs = await db.employee.findMany({
    where: { deletedAt: null, managerId: me.id },
    select: { id: true },
  });
  return [me.id, ...subs.map((s) => s.id)];
}

/** Vérifie qu'un employé est accessible à la session (sinon lève). */
async function assertEmployeeAccessible(db: Db, session: Session, employeeId: number): Promise<void> {
  const ids = await accessibleEmployeeIds(db, session);
  if (ids !== null && !ids.includes(employeeId)) throw new Error('Accès restreint à ce collaborateur.');
}

/** Fragment `where` limitant `employeeId` au périmètre accessible. */
async function scopeEmployeeWhere(db: Db, session: Session): Promise<Record<string, unknown>> {
  const ids = await accessibleEmployeeIds(db, session);
  return ids === null ? {} : { employeeId: { in: ids.length ? ids : [-1] } };
}

/**
 * Identifiants des employés accessibles à la session pour la gestion des
 * ÉVALUATIONS spécifiquement. `null` = aucune restriction (admins / RH). Un
 * MANAGER accède ici à TOUS les employés (pas seulement son équipe), à
 * l'exception de ceux dont le compte utilisateur rattaché a le rôle
 * SUPER_ADMIN ou ADMIN. Périmètre plus large que `accessibleEmployeeIds`
 * (utilisé par les objectifs/plans, restés limités à l'équipe).
 */
async function accessibleEmployeeIdsForEvaluations(db: Db, session: Session): Promise<number[] | null> {
  if (isPerfAdmin(session.role)) return null;
  const employees = await db.employee.findMany({
    where: {
      deletedAt: null,
      OR: [
        { userId: null },
        { user: { role: { notIn: ['SUPER_ADMIN', 'ADMIN'] } } },
      ],
    },
    select: { id: true },
  });
  return employees.map((e) => e.id);
}

/** Vérifie qu'un employé est accessible à la session pour les évaluations (sinon lève). */
async function assertEmployeeAccessibleEval(db: Db, session: Session, employeeId: number): Promise<void> {
  const ids = await accessibleEmployeeIdsForEvaluations(db, session);
  if (ids !== null && !ids.includes(employeeId)) throw new Error('Accès restreint : ce collaborateur est rattaché à un compte SUPER_ADMIN/ADMIN.');
}

/** Fragment `where` limitant `employeeId` au périmètre accessible pour les évaluations. */
async function scopeEmployeeWhereEval(db: Db, session: Session): Promise<Record<string, unknown>> {
  const ids = await accessibleEmployeeIdsForEvaluations(db, session);
  return ids === null ? {} : { employeeId: { in: ids.length ? ids : [-1] } };
}

const emptyToNull = (v: unknown): unknown => (v === '' || v === undefined ? null : v);

async function nextEvaluationReference(db: Db): Promise<string> {
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

const kpiSchema = z.object({
  code: z.string().min(1, 'Code requis'),
  label: z.string().min(1, 'Libellé requis'),
  category: z.preprocess(emptyToNull, z.string().nullable().optional()),
  source: z.enum(['SALES', 'COMMISSIONS', 'ACCOUNTING', 'CRM', 'PROSPECTS', 'ATTENDANCE', 'LEAVE', 'PROJECT', 'SOCIAL', 'MANUAL']),
  metric: z.enum([
    'SALES_COUNT', 'SALES_AMOUNT', 'RESILIATION_COUNT', 'COMMISSION_AMOUNT', 'ENCAISSEMENT_AMOUNT',
    'CRM_ACTIVITIES_DONE', 'CRM_VISITS', 'CRM_CALLS', 'PROSPECT_CONVERSION_RATE', 'NEW_POTENTIAL_PROSPECTS',
    'SOCIAL_PUBLICATIONS_COUNT', 'SOCIAL_VIEWS', 'SOCIAL_INTERACTIONS', 'SOCIAL_FOLLOWERS_GROWTH',
    'ATTENDANCE_RATE', 'OVERTIME_HOURS', 'ABSENCE_DAYS', 'LATE_EARLY_DEPARTURE_HOURS', 'MANUAL_VALUE',
  ]),
  unit: z.preprocess(emptyToNull, z.string().nullable().optional()),
  direction: z.enum(['HIGHER_BETTER', 'LOWER_BETTER']).optional(),
  defaultTarget: z.preprocess(emptyToNull, z.coerce.number().nullable().optional()),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  isActive: z.boolean().optional(),
});

const weightProfileSchema = z.object({
  poste: z.string().min(1, 'Poste requis'),
  name: z.string().min(1, 'Nom requis'),
  isActive: z.boolean().optional(),
  lines: z.array(z.object({
    kpiDefinitionId: z.coerce.number().int().positive(),
    weight: z.coerce.number().min(0),
  })).default([]),
});

const objectiveSchema = z.object({
  // Cible : un employé précis OU un poste (exactement l'un des deux).
  employeeId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  poste: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  cycleType: z.enum(['ANNUEL', 'TRIMESTRIEL']),
  year: z.coerce.number().int(),
  quarter: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(4).nullable().optional()),
  title: z.string().min(1, 'Intitulé requis'),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  weight: z.coerce.number().min(0).optional(),
  targetValue: z.preprocess(emptyToNull, z.coerce.number().nullable().optional()),
  unit: z.preprocess(emptyToNull, z.string().nullable().optional()),
  kpiDefinitionId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  measureType: z.enum(['AUTO', 'MANUAL']).optional(),
  progress: z.coerce.number().int().min(0).optional(),
  status: z.enum(['EN_COURS', 'ATTEINT', 'PARTIEL', 'NON_ATTEINT', 'ANNULE']).optional(),
});

// À la création, la cible (employé XOR poste) est obligatoire.
const objectiveCreateSchema = objectiveSchema.refine((d) => (d.employeeId != null) !== (d.poste != null), {
  message: 'Un objectif cible soit un collaborateur, soit un poste (pas les deux).',
  path: ['employeeId'],
});

const evalLineSchema = z.object({
  objectiveId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  kpiDefinitionId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  label: z.string().min(1),
  weight: z.coerce.number().min(0).optional(),
  targetValue: z.preprocess(emptyToNull, z.coerce.number().nullable().optional()),
  actualValue: z.preprocess(emptyToNull, z.coerce.number().nullable().optional()),
  score: z.preprocess(emptyToNull, z.coerce.number().nullable().optional()),
  comment: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const evalSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  cycleType: z.enum(['ANNUEL', 'TRIMESTRIEL']),
  year: z.coerce.number().int(),
  quarter: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(4).nullable().optional()),
  evaluatorId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  strengths: z.preprocess(emptyToNull, z.string().nullable().optional()),
  areasToImprove: z.preprocess(emptyToNull, z.string().nullable().optional()),
  comments: z.preprocess(emptyToNull, z.string().nullable().optional()),
  globalScore: z.preprocess(emptyToNull, z.coerce.number().nullable().optional()),
  lines: z.array(evalLineSchema).default([]),
});

const planSchema = z.object({
  evaluationId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  employeeId: z.coerce.number().int().positive(),
  title: z.string().min(1, 'Intitulé requis'),
  actions: z.preprocess(emptyToNull, z.string().nullable().optional()),
  trainingNeeds: z.preprocess(emptyToNull, z.string().nullable().optional()),
  dueDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  status: z.enum(['EN_COURS', 'REALISE', 'ABANDONNE']).optional(),
  followUpNotes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

// ── Enregistrement des handlers ──────────────────────────────────────────────

export function registerPerformanceIPC(): void {
  /* ─── Catalogue KPI (configuration) ─────────────────────────────── */

  ipcMain.handle('performance:kpis:list', async (_e, { token, includeInactive = false }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await db.kpiDefinition.findMany({ where, orderBy: { label: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:kpis:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:kpis:create', async (_e, { token, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_ADMIN_ROLES);
      const parsed = kpiSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const data = await db.kpiDefinition.create({ data: parsed.data as any });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:kpis:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:kpis:update', async (_e, { token, id, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_ADMIN_ROLES);
      const parsed = kpiSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const data = await db.kpiDefinition.update({ where: { id: Number(id) }, data: parsed.data as any });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:kpis:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:kpis:delete', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_ADMIN_ROLES);
      const db = getDb();
      await db.kpiDefinition.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('performance:kpis:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Profils de pondération par poste ──────────────────────────── */

  ipcMain.handle('performance:weights:list', async (_e, { token }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const data = await db.performanceWeightProfile.findMany({
        where: { deletedAt: null },
        orderBy: { poste: 'asc' },
        include: { lines: { include: { kpiDefinition: { select: { id: true, label: true, code: true } } } } },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:weights:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:weights:upsert', async (_e, { token, id, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_ADMIN_ROLES);
      const parsed = weightProfileSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const { lines, ...header } = parsed.data;
      const db = getDb();
      const data = await db.$transaction(async (tx) => {
        let profileId: number;
        if (id) {
          await tx.performanceWeightProfile.update({ where: { id: Number(id) }, data: header });
          await tx.performanceWeightLine.deleteMany({ where: { profileId: Number(id) } });
          profileId = Number(id);
        } else {
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
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:weights:upsert error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:weights:delete', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_ADMIN_ROLES);
      const db = getDb();
      await db.performanceWeightProfile.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('performance:weights:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Unités des KPI (référentiel du champ « Unité ») ───────────── */

  const unitSchema = z.object({ label: z.string().min(1, 'Libellé requis'), isActive: z.boolean().optional() });

  ipcMain.handle('performance:units:list', async (_e, { token, includeInactive }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await db.kpiUnit.findMany({ where, orderBy: { label: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:units:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:units:create', async (_e, { token, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_ADMIN_ROLES);
      const parsed = unitSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const label = parsed.data.label.trim();
      const existing = await db.kpiUnit.findUnique({ where: { label } });
      if (existing) {
        const data = await db.kpiUnit.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
        return ser({ success: true, data });
      }
      const data = await db.kpiUnit.create({ data: { label, isActive: parsed.data.isActive ?? true } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:units:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:units:update', async (_e, { token, id, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_ADMIN_ROLES);
      const parsed = unitSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const data: any = { ...parsed.data };
      if (typeof data.label === 'string') data.label = data.label.trim();
      const updated = await db.kpiUnit.update({ where: { id: Number(id) }, data });
      return ser({ success: true, data: updated });
    } catch (error: any) {
      logger.error('performance:units:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:units:delete', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_ADMIN_ROLES);
      const db = getDb();
      await db.kpiUnit.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('performance:units:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Sélecteur d'employés (périmètre accessible) ───────────────── */

  // `scope: 'evaluations'` élargit le périmètre MANAGER à tous les employés
  // (hors comptes SUPER_ADMIN/ADMIN) pour le sélecteur de « Nouvelle évaluation ».
  // Sans ce paramètre (objectifs, plans…), le périmètre reste limité à l'équipe.
  ipcMain.handle('performance:employees:list', async (_e, { token, scope }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const ids = scope === 'evaluations'
        ? await accessibleEmployeeIdsForEvaluations(db, session)
        : await accessibleEmployeeIds(db, session);
      const where: any = { deletedAt: null };
      if (ids !== null) where.id = { in: ids.length ? ids : [-1] };
      const data = await db.employee.findMany({
        where,
        orderBy: { matricule: 'desc' },
        select: { id: true, matricule: true, firstName: true, lastName: true, poste: true, departement: true, userId: true, status: true },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:employees:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Objectifs ─────────────────────────────────────────────────── */

  ipcMain.handle('performance:objectives:list', async (_e, { token, filters = {} }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.employeeId) where.employeeId = Number(filters.employeeId);
      if (filters.poste) where.poste = String(filters.poste);
      if (filters.year) where.year = Number(filters.year);
      if (filters.cycleType) where.cycleType = filters.cycleType;
      if (filters.quarter) where.quarter = Number(filters.quarter);
      if (filters.status) where.status = filters.status;
      if (filters.scope === 'employee') where.employeeId = { not: null };
      // « Par poste » ne doit pas écraser un filtre sur un poste précis.
      if (filters.scope === 'poste' && !filters.poste) where.poste = { not: null };
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
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:objectives:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:objectives:getById', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const data = await db.performanceObjective.findFirst({
        where: { id: Number(id), deletedAt: null },
        include: { employee: true, kpiDefinition: true },
      });
      if (!data) return { success: false, error: 'Objectif introuvable' };
      if (data.employeeId != null) await assertEmployeeAccessible(db, session, data.employeeId);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:objectives:getById error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:objectives:create', async (_e, { token, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const parsed = objectiveCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      if (parsed.data.employeeId != null) {
        await assertEmployeeAccessible(db, session, parsed.data.employeeId);
      } else {
        // Objectif par poste : réservé à la configuration (admins / RH).
        checkExact(session, PERF_ADMIN_ROLES);
      }
      const data = await db.performanceObjective.create({ data: { ...parsed.data, createdById: session.userId } as any });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:objectives:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:objectives:update', async (_e, { token, id, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const existing = await db.performanceObjective.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Objectif introuvable' };
      if (existing.employeeId != null) await assertEmployeeAccessible(db, session, existing.employeeId);
      else checkExact(session, PERF_ADMIN_ROLES);
      const parsed = objectiveSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      // La cible (employé / poste) est fixée à la création : non modifiable ici.
      const { employeeId, poste, ...data } = parsed.data;
      const updated = await db.performanceObjective.update({ where: { id: Number(id) }, data: data as any });
      return ser({ success: true, data: updated });
    } catch (error: any) {
      logger.error('performance:objectives:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:objectives:delete', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const existing = await db.performanceObjective.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Objectif introuvable' };
      if (existing.employeeId != null) await assertEmployeeAccessible(db, session, existing.employeeId);
      else checkExact(session, PERF_ADMIN_ROLES);
      await db.performanceObjective.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('performance:objectives:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Duplique les objectifs d'une période source vers une période cible. Copie la
  // définition (intitulé, cible, pondération, KPI…) en réinitialisant l'avancement
  // et le statut. Ignore les objectifs déjà présents à l'identique dans la cible.
  ipcMain.handle('performance:objectives:duplicate', async (_e, { token, source, target }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const parsed = z.object({
        source: z.object({
          cycleType: z.enum(['ANNUEL', 'TRIMESTRIEL']),
          year: z.coerce.number().int(),
          quarter: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(4).nullable().optional()),
        }),
        target: z.object({
          cycleType: z.enum(['ANNUEL', 'TRIMESTRIEL']),
          year: z.coerce.number().int(),
          quarter: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(4).nullable().optional()),
        }),
      }).safeParse({ source, target });
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const src = parsed.data.source;
      const tgt = parsed.data.target;
      const srcQuarter = src.cycleType === 'TRIMESTRIEL' ? (src.quarter ?? null) : null;
      const tgtQuarter = tgt.cycleType === 'TRIMESTRIEL' ? (tgt.quarter ?? null) : null;
      if (tgt.cycleType === 'TRIMESTRIEL' && !tgtQuarter) return { success: false, error: 'Trimestre cible requis.' };
      if (src.cycleType === tgt.cycleType && src.year === tgt.year && srcQuarter === tgtQuarter) {
        return { success: false, error: 'La période cible doit différer de la période source.' };
      }

      const db = getDb();
      // Objectifs source dans le périmètre accessible (employés + objectifs de poste).
      const where: any = { deletedAt: null, cycleType: src.cycleType, year: src.year };
      if (src.cycleType === 'TRIMESTRIEL') where.quarter = srcQuarter;
      const ids = await accessibleEmployeeIds(db, session);
      if (ids !== null) where.OR = [{ employeeId: { in: ids.length ? ids : [-1] } }, { employeeId: null }];
      const sources = await db.performanceObjective.findMany({ where });

      let created = 0;
      let skipped = 0;
      for (const o of sources) {
        // Droits : objectif par poste = admins/RH ; objectif d'employé = périmètre.
        if (o.employeeId != null) {
          if (!isPerfAdmin(session.role)) {
            const acc = ids === null ? null : ids;
            if (acc !== null && !acc.includes(o.employeeId)) { skipped++; continue; }
          }
        } else if (!isPerfAdmin(session.role)) {
          skipped++; continue; // objectifs par poste : réservés aux admins/RH
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
        if (dup) { skipped++; continue; }
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
          } as any,
        });
        created++;
      }
      return { success: true, data: { created, skipped, total: sources.length } };
    } catch (error: any) {
      logger.error('performance:objectives:duplicate error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Évaluations ───────────────────────────────────────────────── */

  ipcMain.handle('performance:evaluations:list', async (_e, { token, filters = {} }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null, ...(await scopeEmployeeWhereEval(db, session)) };
      if (filters.employeeId) where.employeeId = Number(filters.employeeId);
      if (filters.year) where.year = Number(filters.year);
      if (filters.cycleType) where.cycleType = filters.cycleType;
      if (filters.status) where.status = filters.status;
      const data = await db.performanceEvaluation.findMany({
        where,
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, matricule: true, poste: true, departement: true } },
          evaluator: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:evaluations:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:evaluations:getById', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const data = await evaluationDetail(db, Number(id));
      if (!data) return { success: false, error: 'Évaluation introuvable' };
      await assertEmployeeAccessibleEval(db, session, data.employeeId);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:evaluations:getById error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:evaluations:create', async (_e, { token, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const parsed = evalSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      await assertEmployeeAccessibleEval(db, session, parsed.data.employeeId);
      const { lines, ...header } = parsed.data;
      const reference = await nextEvaluationReference(db);
      const data = await db.$transaction(async (tx) => {
        const created = await tx.performanceEvaluation.create({
          data: { ...header, reference, createdById: session.userId } as any,
        });
        if (lines.length) {
          await tx.performanceEvaluationLine.createMany({
            data: lines.map((l) => ({ ...l, evaluationId: created.id })) as any,
          });
        }
        return created;
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:evaluations:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:evaluations:update', async (_e, { token, id, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const existing = await db.performanceEvaluation.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Évaluation introuvable' };
      await assertEmployeeAccessibleEval(db, session, existing.employeeId);
      if (['VALIDEE_DIRECTION', 'CLOTUREE'].includes(existing.status)) {
        return { success: false, error: 'Évaluation validée : modification impossible.' };
      }
      const parsed = evalSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const { lines, ...header } = parsed.data;
      const data = await db.$transaction(async (tx) => {
        await tx.performanceEvaluation.update({ where: { id: Number(id) }, data: header as any });
        if (lines) {
          await tx.performanceEvaluationLine.deleteMany({ where: { evaluationId: Number(id) } });
          if (lines.length) {
            await tx.performanceEvaluationLine.createMany({
              data: lines.map((l) => ({ ...l, evaluationId: Number(id) })) as any,
            });
          }
        }
        return evaluationDetail(tx as unknown as Db, Number(id));
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:evaluations:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Calcule les KPI automatiques du collaborateur sur la période du cycle et
  // remplace les lignes « KPI » de l'évaluation (les lignes manuelles liées à un
  // objectif sans KPI sont conservées).
  ipcMain.handle('performance:evaluations:computeKpis', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const evaluation = await db.performanceEvaluation.findFirst({
        where: { id: Number(id), deletedAt: null },
        include: { employee: { select: { id: true, userId: true, poste: true } }, lines: true },
      });
      if (!evaluation) return { success: false, error: 'Évaluation introuvable' };
      await assertEmployeeAccessibleEval(db, session, evaluation.employeeId);
      if (['VALIDEE_DIRECTION', 'CLOTUREE'].includes(evaluation.status)) {
        return { success: false, error: 'Évaluation validée : recalcul impossible.' };
      }
      const { start, end } = cyclePeriod(evaluation.cycleType, evaluation.year, evaluation.quarter);
      // Cibles saisies par KPI (conservées lors du recalcul).
      const targets = new Map<number, number>();
      for (const l of evaluation.lines) {
        if (l.kpiDefinitionId != null && l.targetValue != null) targets.set(l.kpiDefinitionId, Number(l.targetValue));
      }
      const { lines, globalScore } = await computeEvaluationKpis(
        db,
        { id: evaluation.employee.id, userId: evaluation.employee.userId },
        evaluation.employee.poste,
        start,
        end,
        targets,
      );
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
            })) as any,
          });
        }
        await tx.performanceEvaluation.update({ where: { id: evaluation.id }, data: { globalScore } });
        return evaluationDetail(tx as unknown as Db, evaluation.id);
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:evaluations:computeKpis error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:evaluations:submit', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const existing = await db.performanceEvaluation.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Évaluation introuvable' };
      await assertEmployeeAccessibleEval(db, session, existing.employeeId);
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
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:evaluations:submit error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Signature électronique d'un niveau. level: MANAGER | EMPLOYEE | DIRECTION.
  ipcMain.handle('performance:evaluations:sign', async (_e, { token, id, level }: any) => {
    try {
      const session = requireSession(token);
      const db = getDb();
      const data = await signEvaluation(db, session, Number(id), level);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:evaluations:sign error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:evaluations:refuse', async (_e, { token, id, reason }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const existing = await db.performanceEvaluation.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Évaluation introuvable' };
      await assertEmployeeAccessibleEval(db, session, existing.employeeId);
      const data = await db.performanceEvaluation.update({
        where: { id: Number(id) },
        data: { status: 'REFUSEE', refusedById: session.userId, refusedAt: new Date(), refusalReason: reason ?? null },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:evaluations:refuse error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Suppression d'une évaluation : réservée aux administrateurs (SUPER_ADMIN /
  // ADMIN), quel que soit le statut de l'évaluation.
  ipcMain.handle('performance:evaluations:delete', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_DIRECTION_ROLES);
      const db = getDb();
      const existing = await db.performanceEvaluation.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Évaluation introuvable' };
      await db.performanceEvaluation.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('performance:evaluations:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Plans de progrès ──────────────────────────────────────────── */

  ipcMain.handle('performance:plans:list', async (_e, { token, filters = {} }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null, ...(await scopeEmployeeWhere(db, session)) };
      if (filters.employeeId) where.employeeId = Number(filters.employeeId);
      if (filters.evaluationId) where.evaluationId = Number(filters.evaluationId);
      if (filters.status) where.status = filters.status;
      const data = await db.progressPlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, matricule: true } } },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:plans:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:plans:create', async (_e, { token, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const parsed = planSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      await assertEmployeeAccessible(db, session, parsed.data.employeeId);
      const data = await db.progressPlan.create({ data: { ...parsed.data, createdById: session.userId } as any });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:plans:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:plans:update', async (_e, { token, id, payload }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const existing = await db.progressPlan.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Plan introuvable' };
      await assertEmployeeAccessible(db, session, existing.employeeId);
      const parsed = planSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const data = await db.progressPlan.update({ where: { id: Number(id) }, data: parsed.data as any });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:plans:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:plans:delete', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const existing = await db.progressPlan.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Plan introuvable' };
      await assertEmployeeAccessible(db, session, existing.employeeId);
      await db.progressPlan.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('performance:plans:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Classements ───────────────────────────────────────────────── */

  ipcMain.handle('performance:rankings:get', async (_e, { token, periodType = 'MOIS', refDate, basis }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const ref = refDate ? new Date(refDate) : new Date();
      const result = await computeRanking(db, periodType as RankingPeriodType, ref, basis as RankingBasis | undefined);
      return ser({ success: true, data: result });
    } catch (error: any) {
      logger.error('performance:rankings:get error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:rankings:snapshot', async (_e, { token, periodType = 'MOIS', refDate, basis }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const ref = refDate ? new Date(refDate) : new Date();
      const result = await computeRanking(db, periodType as RankingPeriodType, ref, basis as RankingBasis | undefined);
      const snapshot = await db.$transaction(async (tx) => {
        const snap = await tx.performanceRankingSnapshot.create({
          data: {
            periodType: periodType as any,
            periodStart: result.period.start,
            periodEnd: result.period.end,
            basis: result.basis as any,
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
      return ser({ success: true, data: snapshot });
    } catch (error: any) {
      logger.error('performance:rankings:snapshot error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:rankings:history', async (_e, { token, periodType }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const where: any = {};
      if (periodType) where.periodType = periodType;
      const data = await db.performanceRankingSnapshot.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { generatedBy: { select: { firstName: true, lastName: true } }, _count: { select: { entries: true } } },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:rankings:history error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:rankings:getSnapshot', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
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
      if (!data) return { success: false, error: 'Classement introuvable' };
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:rankings:getSnapshot error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Suppression définitive d'un classement archivé (entrées puis snapshot —
  // pas de cascade FK). Accessible aux rôles de gestion des performances.
  ipcMain.handle('performance:rankings:deleteSnapshot', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const sid = Number(id);
      const snap = await db.performanceRankingSnapshot.findUnique({ where: { id: sid } });
      if (!snap) return { success: false, error: 'Classement introuvable' };
      await db.$transaction([
        db.performanceRankingEntry.deleteMany({ where: { snapshotId: sid } }),
        db.performanceRankingSnapshot.delete({ where: { id: sid } }),
      ]);
      return { success: true };
    } catch (error: any) {
      logger.error('performance:rankings:deleteSnapshot error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Personnel à classer (roster) ──────────────────────────────── */

  // Liste des employés actifs + ids retenus pour les classements. Si aucun
  // roster n'est configuré, tous les employés actifs sont classés (`ids: []`).
  ipcMain.handle('performance:ranking:getRoster', async (_e, { token }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_MANAGE_ROLES);
      const db = getDb();
      const [ids, employees] = await Promise.all([
        rankingRoster(db),
        db.employee.findMany({
          where: { deletedAt: null, status: 'ACTIF' },
          orderBy: { matricule: 'desc' },
          select: { id: true, matricule: true, firstName: true, lastName: true, poste: true, departement: true, userId: true },
        }),
      ]);
      return ser({ success: true, data: { ids: ids ?? [], employees } });
    } catch (error: any) {
      logger.error('performance:ranking:getRoster error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:ranking:setRoster', async (_e, { token, ids }: any) => {
    try {
      const session = requireSession(token);
      checkExact(session, PERF_ADMIN_ROLES);
      const parsed = z.array(z.coerce.number().int().positive()).safeParse(ids);
      if (!parsed.success) return { success: false, error: 'Liste d’employés invalide' };
      // Liste vide → on efface le roster (retour au comportement « tous les actifs »).
      await setSetting(RANKING_ROSTER_KEY, JSON.stringify([...new Set(parsed.data)]));
      return { success: true };
    } catch (error: any) {
      logger.error('performance:ranking:setRoster error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Tableau de bord de performance ────────────────────────────── */

  ipcMain.handle('performance:dashboard', async (_e, { token }: any) => {
    try {
      const session = requireSession(token);
      // Tableau de bord de performance : réservé aux admins & RH (MANAGER exclu).
      checkExact(session, PERF_ADMIN_ROLES);
      const db = getDb();
      const data = await buildDashboard(db);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:dashboard error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Self-service (« Mes performances ») ───────────────────────── */

  ipcMain.handle('performance:me:overview', async (_e, { token, year }: any) => {
    try {
      const session = requireSession(token);
      const db = getDb();
      const me = await db.employee.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true, poste: true } });
      if (!me) return { success: false, error: 'Aucun dossier du personnel rattaché à votre compte.' };
      const y = year ? Number(year) : new Date().getFullYear();
      // Objectifs : les miens + ceux définis pour mon poste.
      const objectiveTargets: any[] = [{ employeeId: me.id }];
      if (me.poste) objectiveTargets.push({ poste: me.poste });
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
      return ser({ success: true, data: { employeeId: me.id, year: y, objectives, evaluations, plans } });
    } catch (error: any) {
      logger.error('performance:me:overview error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:me:evaluation', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      const db = getDb();
      const me = await sessionEmployee(db, session);
      if (!me) return { success: false, error: 'Aucun dossier du personnel rattaché à votre compte.' };
      const data = await evaluationDetail(db, Number(id));
      if (!data || data.employeeId !== me.id) return { success: false, error: 'Évaluation introuvable' };
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:me:evaluation error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Signature « collaborateur » depuis l'espace self-service.
  ipcMain.handle('performance:me:sign', async (_e, { token, id }: any) => {
    try {
      const session = requireSession(token);
      const db = getDb();
      const data = await signEvaluation(db, session, Number(id), 'EMPLOYEE');
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:me:sign error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('performance:me:ranking', async (_e, { token, periodType = 'MOIS', refDate }: any) => {
    try {
      const session = requireSession(token);
      const db = getDb();
      const me = await sessionEmployee(db, session);
      if (!me) return { success: false, error: 'Aucun dossier du personnel rattaché à votre compte.' };
      const ref = refDate ? new Date(refDate) : new Date();
      const result = await computeRanking(db, periodType as RankingPeriodType, ref);
      const mine = result.entries.find((en) => en.employeeId === me.id) ?? null;
      return ser({ success: true, data: { period: result.period, basis: result.basis, total: result.entries.length, entry: mine } });
    } catch (error: any) {
      logger.error('performance:me:ranking error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Tous les objectifs (Manuel ou Auto) assignés au collaborateur connecté —
  // les siens (employeeId) et ceux définis pour son poste — dotés d'une cible
  // chiffrée (> 0), pour lier une activité CRM, quel que soit son type. Seuls
  // les objectifs à Mesure « Manuelle » conditionnent le passage « Traité » à
  // 100 % (cf. crm.ipc.ts). Exclut les objectifs liés aux KPI d'assiduité/CRM
  // ci-dessous, non pertinents à lier à une activité (cf. LINKABLE_EXCLUDED_METRICS).
  ipcMain.handle('performance:me:objectives', async (_e, { token }: any) => {
    try {
      const session = requireSession(token);
      const db = getDb();
      const me = await db.employee.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true, poste: true } });
      if (!me) return ser({ success: true, data: [] });
      const objectiveTargets: any[] = [{ employeeId: me.id }];
      if (me.poste) objectiveTargets.push({ poste: me.poste });
      const data = await db.performanceObjective.findMany({
        where: {
          deletedAt: null,
          AND: [
            { OR: objectiveTargets },
            { OR: [{ kpiDefinitionId: null }, { kpiDefinition: { metric: { notIn: LINKABLE_EXCLUDED_METRICS } } }] },
          ],
          targetValue: { not: null, gt: 0 },
          status: { notIn: ['ATTEINT', 'ANNULE'] },
        },
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, title: true, targetValue: true, unit: true, year: true, cycleType: true, quarter: true, measureType: true },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('performance:me:objectives error', error.message);
      return { success: false, error: error.message };
    }
  });
}

// ── Fonctions internes ───────────────────────────────────────────────────────

/** Période [start, end[ correspondant au cycle d'une évaluation. */
function cyclePeriod(cycleType: string, year: number, quarter: number | null): { start: Date; end: Date } {
  if (cycleType === 'TRIMESTRIEL' && quarter) {
    const q = quarter - 1;
    return { start: new Date(year, q * 3, 1), end: new Date(year, q * 3 + 3, 1) };
  }
  return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}

/** Détail complet d'une évaluation (lignes, plans, employé, évaluateur). */
async function evaluationDetail(db: Db, id: number) {
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
async function signEvaluation(db: Db, session: Session, id: number, level: 'MANAGER' | 'EMPLOYEE' | 'DIRECTION') {
  const evaluation = await db.performanceEvaluation.findFirst({
    where: { id, deletedAt: null },
    include: { employee: { select: { id: true, userId: true } } },
  });
  if (!evaluation) throw new Error('Évaluation introuvable');
  const now = new Date();

  if (level === 'MANAGER') {
    checkExact(session, PERF_MANAGE_ROLES);
    if (evaluation.status !== 'SOUMISE') throw new Error('L’évaluation doit être soumise pour la validation du responsable.');
    return db.performanceEvaluation.update({
      where: { id },
      data: { status: 'VALIDEE_RESPONSABLE', managerSignedById: session.userId, managerSignedAt: now },
    });
  }
  if (level === 'EMPLOYEE') {
    if (evaluation.employee.userId !== session.userId) throw new Error('Seul le collaborateur concerné peut signer.');
    if (evaluation.status !== 'VALIDEE_RESPONSABLE') throw new Error('En attente de la validation du responsable.');
    return db.performanceEvaluation.update({
      where: { id },
      data: { status: 'VALIDEE_COLLABORATEUR', employeeSignedById: session.userId, employeeSignedAt: now },
    });
  }
  // DIRECTION
  checkExact(session, PERF_DIRECTION_ROLES);
  if (evaluation.status !== 'VALIDEE_COLLABORATEUR') throw new Error('En attente de la validation du collaborateur.');
  return db.performanceEvaluation.update({
    where: { id },
    data: { status: 'VALIDEE_DIRECTION', directionSignedById: session.userId, directionSignedAt: now },
  });
}

/** Agrégations du tableau de bord de performance. */
async function buildDashboard(db: Db) {
  const now = new Date();
  const year = now.getFullYear();

  // Classement du mois (KPI) — top performers.
  const monthRanking = await computeRanking(db, 'MOIS', now, 'KPI');
  const topPerformers = monthRanking.entries.slice(0, 5);

  // Performance moyenne par service (département) sur les évaluations validées de l'année.
  const evals = await db.performanceEvaluation.findMany({
    where: { deletedAt: null, year, status: { in: ['VALIDEE_DIRECTION', 'CLOTUREE', 'VALIDEE_COLLABORATEUR'] } },
    include: { employee: { select: { departement: true } } },
  });
  const byService = new Map<string, { total: number; count: number }>();
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
  const trend: Array<{ label: string; avgScore: number; count: number }> = [];
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
      employee: `${p.employee.lastName} ${p.employee.firstName}`.trim(),
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
