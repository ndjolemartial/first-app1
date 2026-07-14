import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';
import {
  PROSPECT_FIELD_LABELS,
  PROSPECT_STATUS_LABELS,
  buildEntityTimeline,
  diffChangedFields,
  recordModification,
  recordStatusChange,
} from '../services/timeline.service';

/** Sérialise pour l'IPC : les Date/Decimal Prisma ne sont pas clonables par Electron. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convertit les chaînes vides en undefined pour éviter les échecs Zod sur les enums. */
function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === '' ? undefined : v])
  );
}

/** Rend un prospect sérialisable par Electron (convertit Prisma.Decimal → number). */
function serialize(p: any): any {
  if (!p) return p;
  return { ...p, budget: p.budget != null ? Number(p.budget) : null };
}

/** Génère la prochaine référence de prospect : PSP-YYYY-NNNN. */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.prospect.findFirst({
    where: { reference: { startsWith: `PSP-${year}-` } },
    orderBy: { reference: 'desc' },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `PSP-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Génère la prochaine référence de client : CLI-YYYY-NNNN.
 * Utilisée lors de la conversion d'un prospect en client (le client est créé
 * ici, hors du handler clients:create qui possède sa propre génération).
 * Accepte le client Prisma ou un client transactionnel.
 */
async function nextClientReference(db: { client: { findFirst: Function } }): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.client.findFirst({
    where: { reference: { startsWith: `CLI-${year}-` } },
    orderBy: { reference: 'desc' },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `CLI-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Rôles disposant d'une vue globale sur les prospects (sans filtrage) : ils
 * voient l'ensemble des prospects, y compris ceux sans affectation.
 *
 * Décision produit : SEULS SUPER_ADMIN, ADMIN et MANAGER ont cette vue globale.
 * Tous les autres rôles (y compris ACCOUNTANT et ASSISTANTE_DIRECTION) ne voient
 * QUE les prospects qui leur sont affectés. Test de rôle EXACT (pas d'équivalence
 * ACCOUNTANT→MANAGER) — sinon les comptables hériteraient de la vue globale.
 */
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Vrai si l'utilisateur de la session voit l'ensemble des prospects. */
function hasFullView(role: string): boolean {
  return FULL_VIEW_ROLES.includes(role);
}

/**
 * Construit le filtre `where` de visibilité appliqué aux requêtes prospects :
 * — SUPER_ADMIN / ADMIN / MANAGER voient tout (y compris les prospects sans
 *   affectation) ;
 * — tous les autres rôles (AGENT, ACCOUNTANT, ASSISTANTE_DIRECTION, READONLY…)
 *   ne voient QUE les prospects qui leur sont ACTUELLEMENT affectés
 *   (`assignedToId = userId`). L'accès suit l'affectation courante : comme leurs
 *   propres créations leur sont auto-affectées, ils retrouvent les prospects
 *   qu'ils enregistrent ; mais dès qu'un prospect est RÉ-AFFECTÉ à un autre
 *   utilisateur, l'ancien affectataire (même s'il en est le créateur) en perd
 *   l'accès — seuls le nouvel affectataire et les rôles à vue globale le voient.
 */
function buildVisibilityWhere(session: { userId: number; role: string }): any {
  if (hasFullView(session.role)) return {};
  return { assignedToId: session.userId };
}

// ── Schémas Zod ──────────────────────────────────────────────────────────────

const SOURCES = [
  'SITE_WEB_AFRIKIMMO', 'RECOMMENDATION', 'TELEPHONE', 'RESEAUX_SOCIAUX',
  'EMAIL', 'CONTACT_PERSONNEL', 'AUTRE', 'PROSPECTION',
] as const;

const STATUSES = [
  'NOUVEAU', 'CONTACTE', 'QUALIFIE', 'ENVOI_PROPOSITION',
  'NEGOCIATION_EN_COURS', 'CONVERTI', 'PERDU',
] as const;

const prospectSchema = z.object({
  firstName:    z.string().min(1, 'Prénom requis'),
  lastName:     z.string().min(1, 'Nom requis'),
  email:        z.string().email('Email invalide').optional(),
  phone:        z.string().optional(),
  mobile:       z.string().optional(),
  source:       z.enum(SOURCES).optional().default('PROSPECTION'),
  status:       z.enum(STATUSES).optional().default('NOUVEAU'),
  budget:       z.number().positive().optional(),
  notes:        z.string().optional(),
  assignedToId: z.number().int().nullable().optional(),
});

// ── Rôles ────────────────────────────────────────────────────────────────────

const WRITE_ROLES  = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES   = [...WRITE_ROLES, 'READONLY'];
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
function canAssign(role: string): boolean {
  return ASSIGN_ROLES.includes(role);
}

// Sélection légère pour les relations User incluses (assignedTo, createdBy).
const USER_BRIEF_SELECT = {
  id: true, firstName: true, lastName: true, email: true, role: true,
} as const;

// ── Enregistrement des handlers ───────────────────────────────────────────────

/**
 * Enregistre les handlers IPC pour la gestion des prospects.
 */
export function registerProspectsIPC(): void {

  // ── Liste ──────────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);

      const db = getDb();
      const where: any = { deletedAt: null, ...buildVisibilityWhere(session) };
      if (filters.status) where.status = filters.status;
      if (filters.source) where.source = filters.source;
      // Le filtre par affectation (dont « Non alloués » = null) n'est appliqué
      // que pour les rôles à vue globale ; les rôles restreints restent
      // strictement limités à leurs propres prospects affectés.
      if (hasFullView(session.role) && filters.assignedToId !== undefined) {
        where.assignedToId = filters.assignedToId === null ? null : Number(filters.assignedToId);
      }
      if (filters.search) {
        where.AND = [
          ...(where.AND ?? []),
          {
            OR: [
              { reference: { contains: filters.search } },
              { firstName: { contains: filters.search } },
              { lastName:  { contains: filters.search } },
              { email:     { contains: filters.search } },
              { phone:     { contains: filters.search } },
              { mobile:    { contains: filters.search } },
            ],
          },
        ];
      }

      const [data, total] = await db.$transaction([
        db.prospect.findMany({
          where,
          include: {
            tags:       { include: { tag: true } },
            assignedTo: { select: USER_BRIEF_SELECT },
            createdBy:  { select: USER_BRIEF_SELECT },
          },
          skip:    (page - 1) * limit,
          take:    limit,
          orderBy: { createdAt: 'desc' },
        }),
        db.prospect.count({ where }),
      ]);

      return { success: true, data: data.map(serialize), total };
    } catch (error: any) {
      logger.error('prospects:list', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Détail ─────────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);

      const db = getDb();
      const prospect = await db.prospect.findUnique({
        where: { id, deletedAt: null },
        include: {
          tags:       { include: { tag: true } },
          activities: { orderBy: { createdAt: 'desc' }, take: 20 },
          client:     true,
          assignedTo: { select: USER_BRIEF_SELECT },
          createdBy:  { select: USER_BRIEF_SELECT },
          documents:  { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } },
        },
      });

      if (!prospect) return { success: false, error: 'Prospect introuvable' };

      // Contrôle de visibilité fine pour les rôles restreints : ils ne peuvent
      // consulter que les prospects qui leur sont ACTUELLEMENT affectés (l'accès
      // suit l'affectation courante — perdu dès qu'il est ré-affecté à autrui).
      if (!hasFullView(session.role) && prospect.assignedToId !== session.userId) {
        return { success: false, error: 'Prospect inaccessible' };
      }

      return { success: true, data: serialize(prospect) };
    } catch (error: any) {
      logger.error('prospects:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Fiche de suivi chronologique ───────────────────────────────────────────
  ipcMain.handle('prospects:getTimeline', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const prospect = await db.prospect.findUnique({
        where: { id, deletedAt: null },
        select: { id: true, createdAt: true, assignedToId: true },
      });
      if (!prospect) return { success: false, error: 'Prospect introuvable' };
      if (!hasFullView(session.role) && prospect.assignedToId !== session.userId) {
        return { success: false, error: 'Prospect inaccessible' };
      }
      const timeline = await buildEntityTimeline(db, 'PROSPECT', id, prospect.createdAt);
      return { success: true, data: ser(timeline) };
    } catch (error: any) {
      logger.error('prospects:getTimeline', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Création ───────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const cleaned = stripEmpty(payload ?? {});
      const parsed  = prospectSchema.safeParse(cleaned);
      if (!parsed.success) {
        logger.warn('prospects:create validation', JSON.stringify(parsed.error.issues));
        return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      }

      const db = getDb();
      const data: any = { ...parsed.data, createdById: session.userId };
      data.reference = await nextReference(db);
      if (data.budget !== undefined) data.budget = String(data.budget);
      // Affectation à la création :
      // — SUPER_ADMIN / ADMIN / MANAGER : conservent le choix saisi (peut rester
      //   vide → prospect sans affectation, visible uniquement par ces rôles) ;
      // — tous les autres rôles : le prospect leur est AUTOMATIQUEMENT affecté
      //   (ils ne peuvent ni créer de prospect non alloué, ni l'affecter à autrui).
      if (canAssign(session.role)) {
        if (data.assignedToId === undefined) data.assignedToId = null;
      } else {
        data.assignedToId = session.userId;
      }

      const prospect = await db.prospect.create({
        data,
        include: {
          assignedTo: { select: USER_BRIEF_SELECT },
          createdBy:  { select: USER_BRIEF_SELECT },
        },
      });
      logger.info(`Prospect créé : #${prospect.id} ${prospect.firstName} ${prospect.lastName}`);
      return { success: true, data: serialize(prospect) };
    } catch (error: any) {
      logger.error('prospects:create', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Mise à jour ────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const cleaned = stripEmpty(payload ?? {});
      const parsed  = prospectSchema.partial().safeParse(cleaned);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      }

      const db = getDb();
      const before = await db.prospect.findUnique({ where: { id, deletedAt: null } });
      if (!before) return { success: false, error: 'Prospect introuvable' };
      const data: any = { ...parsed.data };
      if (data.budget !== undefined) data.budget = String(data.budget);
      // Seuls les rôles d'assignation peuvent modifier l'affectation via update.
      if (!canAssign(session.role)) delete data.assignedToId;

      const prospect = await db.prospect.update({
        where: { id, deletedAt: null },
        data,
        include: {
          assignedTo: { select: USER_BRIEF_SELECT },
          createdBy:  { select: USER_BRIEF_SELECT },
        },
      });

      // Fiche de suivi chronologique : le statut fait l'objet d'un événement
      // dédié, le reste des champs modifiés d'un événement de synthèse.
      const { status: newStatus, ...rest } = data;
      if (newStatus !== undefined) {
        await recordStatusChange(db, {
          entityType: 'PROSPECT', entityId: id,
          oldValue: before.status, newValue: newStatus,
          labels: PROSPECT_STATUS_LABELS, userId: session.userId,
        });
      }
      const changedFields = diffChangedFields(before, rest);
      if (changedFields.length) {
        await recordModification(db, {
          entityType: 'PROSPECT', entityId: id,
          changedFields, labels: PROSPECT_FIELD_LABELS, userId: session.userId,
        });
      }

      logger.info(`Prospect mis à jour : #${id}`);
      return { success: true, data: serialize(prospect) };
    } catch (error: any) {
      logger.error('prospects:update', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Suppression (soft delete) ──────────────────────────────────────────────
  ipcMain.handle('prospects:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);

      const db = getDb();
      await db.prospect.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Prospect supprimé (soft) : #${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('prospects:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Changement de statut ───────────────────────────────────────────────────
  ipcMain.handle('prospects:updateStatus', async (_event, { token, id, status }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const parsed = z.enum(STATUSES).safeParse(status);
      if (!parsed.success) return { success: false, error: 'Statut invalide' };

      const db = getDb();
      const before = await db.prospect.findUnique({ where: { id, deletedAt: null }, select: { status: true } });
      const prospect = await db.prospect.update({
        where: { id, deletedAt: null },
        data:  { status: parsed.data },
      });
      await recordStatusChange(db, {
        entityType: 'PROSPECT', entityId: id,
        oldValue: before?.status, newValue: parsed.data,
        labels: PROSPECT_STATUS_LABELS, userId: session.userId,
      });
      return { success: true, data: serialize(prospect) };
    } catch (error: any) {
      logger.error('prospects:updateStatus', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Affectation / désaffectation ───────────────────────────────────────────
  /**
   * Affecte ou désaffecte un prospect à un utilisateur.
   * Réservé aux rôles MANAGER, ADMIN et SUPER_ADMIN.
   * Passer `assignedToId: null` pour désaffecter.
   */
  ipcMain.handle('prospects:assign', async (_event, { token, id, assignedToId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // Exclut explicitement ACCOUNTANT (qui hériterait sinon de MANAGER via checkRole).
      if (!canAssign(session.role)) {
        return { success: false, error: 'Permission insuffisante' };
      }

      const parsedId = z.number().int().positive().nullable().safeParse(
        assignedToId === null || assignedToId === undefined ? null : Number(assignedToId)
      );
      if (!parsedId.success) return { success: false, error: 'Utilisateur invalide' };

      const db = getDb();

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
        data:  { assignedToId: parsedId.data },
        include: {
          assignedTo: { select: USER_BRIEF_SELECT },
          createdBy:  { select: USER_BRIEF_SELECT },
        },
      });
      await recordModification(db, {
        entityType: 'PROSPECT', entityId: id,
        changedFields: ['assignedToId'], labels: PROSPECT_FIELD_LABELS, userId: session.userId,
      });
      logger.info(
        parsedId.data === null
          ? `Prospect #${id} désaffecté`
          : `Prospect #${id} affecté à l'utilisateur #${parsedId.data}`
      );
      return { success: true, data: serialize(prospect) };
    } catch (error: any) {
      logger.error('prospects:assign', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Liste des utilisateurs assignables ─────────────────────────────────────
  /**
   * Liste les utilisateurs actifs candidats à l'affectation d'un prospect.
   * Réservé aux rôles d'assignation.
   */
  ipcMain.handle('prospects:listAssignableUsers', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // Exclut explicitement ACCOUNTANT — l'affectation est réservée aux MANAGER+.
      if (!canAssign(session.role)) {
        return { success: false, error: 'Permission insuffisante' };
      }

      const db = getDb();
      const users = await db.user.findMany({
        where:   { deletedAt: null, isActive: true },
        select:  USER_BRIEF_SELECT,
        orderBy: { id: 'asc' },
      });
      return { success: true, data: users };
    } catch (error: any) {
      logger.error('prospects:listAssignableUsers', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Conversion en client ───────────────────────────────────────────────────
  /**
   * Convertit un prospect en client. Réservé aux rôles habilités à créer un client
   * (MANAGER, ADMIN, SUPER_ADMIN — ACCOUNTANT via héritage). L'utilisateur affecté
   * au prospect est reporté sur le nouveau client (`assignedToId`).
   */
  ipcMain.handle('prospects:convertToClient', async (_event, { token, id, clientData }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // ASSISTANTE_DIRECTION exclu explicitement (réduit au niveau AGENT sur ce module).
      if (session.role === 'ASSISTANTE_DIRECTION') {
        return { success: false, error: 'Permission insuffisante' };
      }
      checkRole(session, CONVERT_TO_CLIENT_ROLES);

      const db = getDb();
      const prospect = await db.prospect.findUnique({ where: { id, deletedAt: null } });
      if (!prospect) return { success: false, error: 'Prospect introuvable' };
      if (prospect.status === 'CONVERTI') return { success: false, error: 'Prospect déjà converti' };

      const result = await db.$transaction(async (tx) => {
        const reference = await nextClientReference(tx);
        const client = await tx.client.create({
          data: {
            reference,
            firstName: clientData?.firstName ?? prospect.firstName,
            lastName:  clientData?.lastName  ?? prospect.lastName,
            email:     clientData?.email  ?? prospect.email  ?? undefined,
            phone:     clientData?.phone  ?? prospect.phone  ?? undefined,
            mobile:    clientData?.mobile ?? prospect.mobile ?? undefined,
            type:      clientData?.type   ?? 'INDIVIDUEL',
            // Report de l'affectation du prospect vers le client créé.
            assignedToId: prospect.assignedToId ?? undefined,
          },
        });
        const updated = await tx.prospect.update({
          where: { id },
          data:  { status: 'CONVERTI', convertedAt: new Date(), clientId: client.id },
        });
        return { client, prospect: updated };
      });

      await recordStatusChange(db, {
        entityType: 'PROSPECT', entityId: id,
        oldValue: prospect.status, newValue: 'CONVERTI',
        labels: PROSPECT_STATUS_LABELS, userId: session.userId,
      });

      logger.info(`Prospect #${id} converti en client #${result.client.id}`);
      return { success: true, data: { client: result.client, prospect: serialize(result.prospect) } };
    } catch (error: any) {
      logger.error('prospects:convertToClient', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Vue Kanban ─────────────────────────────────────────────────────────────
  ipcMain.handle('prospects:kanban', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);

      const db = getDb();
      const prospects = await db.prospect.findMany({
        where:   {
          deletedAt: null,
          status:    { not: 'CONVERTI' },
          ...buildVisibilityWhere(session),
        },
        include: {
          tags:       { include: { tag: true } },
          assignedTo: { select: USER_BRIEF_SELECT },
          createdBy:  { select: USER_BRIEF_SELECT },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const columns: Record<string, any[]> = {
        NOUVEAU: [], CONTACTE: [], QUALIFIE: [],
        ENVOI_PROPOSITION: [], NEGOCIATION_EN_COURS: [], PERDU: [],
      };
      for (const p of prospects) {
        if (columns[p.status]) columns[p.status].push(serialize(p));
      }

      return { success: true, data: columns };
    } catch (error: any) {
      logger.error('prospects:kanban', error.message);
      return { success: false, error: error.message };
    }
  });
}
