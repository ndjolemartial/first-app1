import { ipcMain } from 'electron';
import path from 'path';
import { getDb } from '../services/db.service';
import { getSession } from '../services/auth.service';
import { removeStorageFile } from '../services/storage.service';
import logger from '../utils/logger';
import { z } from 'zod';

type Db = ReturnType<typeof getDb>;

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
function checkExactRole(session: { role: string }, allowed: string[]): void {
  if (!allowed.includes(session.role)) throw new Error('Permission insuffisante');
}

function hasFullView(role: string): boolean {
  return FULL_VIEW_ROLES.includes(role);
}

/** Fragment `where` limitant les innovations à celles du porteur (AGENT_TECHNIQUE). */
function innovationScopeWhere(session: { userId: number; role: string }): Record<string, unknown> {
  return hasFullView(session.role) ? {} : { employee: { userId: session.userId } };
}

/** Vérifie que l'utilisateur restreint est bien le porteur de l'innovation (sinon lève). */
async function assertOwnership(db: Db, session: { userId: number; role: string }, innovation: { employeeId: number }): Promise<void> {
  if (hasFullView(session.role)) return;
  const emp = await db.employee.findFirst({
    where: { id: innovation.employeeId, userId: session.userId, deletedAt: null },
    select: { id: true },
  });
  if (!emp) throw new Error('Accès restreint : vous n’êtes pas le porteur de cette innovation.');
}

/** Résout l'employé lié au compte connecté (auto-soumission, rôles restreints). */
async function resolveOwnEmployeeId(db: Db, session: { userId: number }): Promise<number> {
  const emp = await db.employee.findFirst({
    where: { userId: session.userId, deletedAt: null },
    select: { id: true },
  });
  if (!emp) throw new Error('Aucun dossier du personnel rattaché à votre compte.');
  return emp.id;
}

async function nextInnovationReference(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.itInnovation.findFirst({
    where: { reference: { startsWith: `INNOV-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `INNOV-${year}-${String(seq).padStart(4, '0')}`;
}

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

/** Sérialise pour l'IPC : les Date Prisma ne sont pas clonables par Electron. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, matricule: true, poste: true } as const;

const ATTACHMENT_SELECT = {
  id: true, name: true, type: true, size: true, numeroArchive: true,
  itInnovationPhase: true, uploadedAt: true,
} as const;

const createSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  employeeId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  phase1Description: z.string().min(1, 'Description requise'),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  phase1Description: z.string().min(1).optional(),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const submitPhase2Schema = z.object({
  phase2Description: z.string().min(1, 'Description requise'),
});

const submitPhase3Schema = z.object({
  phase3Description: z.string().min(1, 'Description requise'),
});

const validatePhaseSchema = z
  .object({
    phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    decision: z.enum(['VALIDATE', 'REJECT']),
    reason: z.preprocess(emptyToNull, z.string().nullable().optional()),
  })
  .refine((d) => d.decision !== 'REJECT' || !!d.reason, { message: 'Motif de rejet requis', path: ['reason'] });

/** Résout les noms des utilisateurs référencés par des colonnes `Int?` sans relation Prisma. */
async function resolveUserNames(db: Db, ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const unique = Array.from(new Set(ids.filter((v): v is number => typeof v === 'number')));
  if (!unique.length) return new Map();
  const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
  return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
}

async function withValidatorNames(db: Db, innovation: any) {
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

const PHASE_PENDING_STATUS: Record<1 | 2 | 3, string> = {
  1: 'PHASE1_EN_ATTENTE',
  2: 'PHASE2_EN_ATTENTE',
  3: 'PHASE3_EN_ATTENTE',
};

/** Enregistre les handlers IPC du module Innovations IT (Module 16). */
export function registerItInnovationsIPC(): void {
  ipcMain.handle('innovations:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, WRITE_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null, ...innovationScopeWhere(session) };
      if (filters.status) where.status = filters.status;
      if (filters.employeeId && hasFullView(session.role)) where.employeeId = Number(filters.employeeId);
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
    } catch (error: any) {
      logger.error('innovations:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('innovations:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, WRITE_ROLES);
      const db = getDb();
      const innovation = await db.itInnovation.findFirst({
        where: { id: Number(id), deletedAt: null, ...innovationScopeWhere(session) },
        include: {
          employee: { select: EMPLOYEE_SELECT },
          attachments: { where: { deletedAt: null }, orderBy: { uploadedAt: 'asc' }, select: ATTACHMENT_SELECT },
        },
      });
      if (!innovation) return { success: false, error: 'Innovation introuvable' };
      const data = await withValidatorNames(db, innovation);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('innovations:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  // Sélecteur « Porteur » du formulaire de création — réservé aux rôles en
  // vue complète (AGENT_TECHNIQUE est auto-affecté, pas de sélection libre).
  ipcMain.handle('innovations:employees', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, FULL_VIEW_ROLES);
      const db = getDb();
      const employees = await db.employee.findMany({
        where: { deletedAt: null, status: 'ACTIF' },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: EMPLOYEE_SELECT,
      });
      return ser({ success: true, data: employees });
    } catch (error: any) {
      logger.error('innovations:employees', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('innovations:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, WRITE_ROLES);
      const parsed = createSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();

      let employeeId: number;
      if (hasFullView(session.role)) {
        if (!parsed.data.employeeId) return { success: false, error: 'Porteur requis' };
        const emp = await db.employee.findFirst({ where: { id: parsed.data.employeeId, deletedAt: null }, select: { id: true } });
        if (!emp) return { success: false, error: 'Employé introuvable' };
        employeeId = emp.id;
      } else {
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
      logger.info(`Innovation IT créée : ${innovation.reference} — ${innovation.title}`);
      return ser({ success: true, data: innovation });
    } catch (error: any) {
      logger.error('innovations:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('innovations:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, WRITE_ROLES);
      const db = getDb();
      const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Innovation introuvable' };
      await assertOwnership(db, session, existing);

      const parsed = updateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };

      const data: any = {};
      if (parsed.data.title !== undefined) data.title = parsed.data.title;
      if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
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
    } catch (error: any) {
      logger.error('innovations:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('innovations:submitPhase2', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, WRITE_ROLES);
      const db = getDb();
      const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Innovation introuvable' };
      await assertOwnership(db, session, existing);
      if (!['PHASE2_EN_COURS', 'PHASE2_REJETEE'].includes(existing.status)) {
        return { success: false, error: 'La phase 2 n’est pas accessible pour le moment.' };
      }
      const parsed = submitPhase2Schema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };

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
    } catch (error: any) {
      logger.error('innovations:submitPhase2', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('innovations:submitPhase3', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, WRITE_ROLES);
      const db = getDb();
      const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Innovation introuvable' };
      await assertOwnership(db, session, existing);
      if (!['PHASE3_EN_COURS', 'PHASE3_REJETEE'].includes(existing.status)) {
        return { success: false, error: 'La phase 3 n’est pas accessible pour le moment.' };
      }
      const parsed = submitPhase3Schema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };

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
    } catch (error: any) {
      logger.error('innovations:submitPhase3', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('innovations:validatePhase', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, VALIDATE_ROLES);
      const parsed = validatePhaseSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const { phase, decision, reason } = parsed.data;

      const db = getDb();
      const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Innovation introuvable' };
      if (existing.status !== PHASE_PENDING_STATUS[phase]) {
        return { success: false, error: 'Cette phase n’est pas en attente de validation.' };
      }

      const now = new Date();
      let data: any;
      if (decision === 'VALIDATE') {
        if (phase === 1) {
          data = { phase1ValidatedById: session.userId, phase1ValidatedAt: now, progress: 15, status: 'PHASE2_EN_COURS' };
        } else if (phase === 2) {
          data = { phase2ValidatedById: session.userId, phase2ValidatedAt: now, progress: 50, status: 'PHASE3_EN_COURS' };
        } else {
          data = { phase3ValidatedById: session.userId, phase3ValidatedAt: now, progress: 100, status: 'VALIDEE' };
        }
      } else {
        if (phase === 1) {
          data = { phase1RejectedAt: now, phase1RejectionReason: reason, status: 'PHASE1_REJETEE' };
        } else if (phase === 2) {
          data = { phase2RejectedAt: now, phase2RejectionReason: reason, status: 'PHASE2_REJETEE' };
        } else {
          data = { phase3RejectedAt: now, phase3RejectionReason: reason, status: 'PHASE3_REJETEE' };
        }
      }

      const innovation = await db.itInnovation.update({
        where: { id: existing.id },
        data,
        include: { employee: { select: EMPLOYEE_SELECT } },
      });
      logger.info(`Innovation IT ${innovation.reference} — phase ${phase} : ${decision}`);
      return ser({ success: true, data: innovation });
    } catch (error: any) {
      logger.error('innovations:validatePhase', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('innovations:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, VALIDATE_ROLES);
      const db = getDb();
      await db.itInnovation.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('innovations:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  // Retire une pièce jointe d'une phase (soft delete GED) — WRITE_ROLES +
  // périmètre du porteur (AGENT_TECHNIQUE ne peut retirer que ses propres
  // pièces jointes), même contrôle que les autres mutations du module.
  ipcMain.handle('innovations:removeAttachment', async (_event, { token, id, documentId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, WRITE_ROLES);
      const db = getDb();
      const existing = await db.itInnovation.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Innovation introuvable' };
      await assertOwnership(db, session, existing);

      const doc = await db.document.findFirst({
        where: { id: Number(documentId), itInnovationId: existing.id, deletedAt: null },
        select: { id: true, path: true },
      });
      if (!doc) return { success: false, error: 'Pièce jointe introuvable' };

      await db.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
      // Chemins relatifs uniquement : les références externes (chemin UNC absolu)
      // ne sont pas supprimées du stockage d'origine.
      if (doc.path && !path.isAbsolute(doc.path)) removeStorageFile(doc.path);

      return { success: true };
    } catch (error: any) {
      logger.error('innovations:removeAttachment', error.message);
      return { success: false, error: error.message };
    }
  });
}
