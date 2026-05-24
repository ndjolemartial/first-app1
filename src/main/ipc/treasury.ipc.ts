import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { recordTreasuryOperation, computeBalances } from '../services/treasury.service';
import { canOperateOnLine } from '../services/budget.service';
import logger from '../utils/logger';
import { z } from 'zod';

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Vérifie le rôle pour l'accès au module Trésorerie.
 *
 * Exception à l'équivalence ACCOUNTANT/MANAGER : ASSISTANTE_DIRECTION, qui
 * hérite normalement des permissions MANAGER, n'a pas accès au module
 * Trésorerie (décision produit).
 */
function checkTreasuryRole(session: { role: string }, allowedRoles: string[]): void {
  if (session.role === 'ASSISTANTE_DIRECTION') {
    throw new Error('Permission insuffisante');
  }
  checkRole(session as any, allowedRoles);
}

/** Rôles voyant tous les comptes, y compris les comptes privés rattachés à un utilisateur. */
const ACCOUNT_FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/** Session minimale nécessaire au contrôle d'accès aux comptes. */
type AccessSession = { userId: number; role: string };

/**
 * Indique si la session peut accéder à un compte (consultation et opérations).
 * Un compte rattaché à un utilisateur est privé : seuls cet utilisateur et les
 * rôles à accès complet (SUPER_ADMIN, ADMIN) peuvent le voir et y opérer.
 */
function canAccessAccount(session: AccessSession, account: { linkedUserId: number | null }): boolean {
  if (ACCOUNT_FULL_ACCESS_ROLES.includes(session.role)) return true;
  return account.linkedUserId == null || account.linkedUserId === session.userId;
}

/** Ajoute, si nécessaire, la restriction d'accès aux comptes à une clause `where` (combinée en AND). */
function applyAccountAccess(where: any, session: AccessSession): void {
  if (ACCOUNT_FULL_ACCESS_ROLES.includes(session.role)) return;
  where.AND = [
    ...(where.AND ?? []),
    { OR: [{ linkedUserId: null }, { linkedUserId: session.userId }] },
  ];
}

/**
 * Identifiants des comptes accessibles par la session.
 * Retourne `null` lorsque la session a accès à tous les comptes (aucune restriction).
 */
async function accessibleAccountIds(
  db: ReturnType<typeof getDb>,
  session: AccessSession,
): Promise<number[] | null> {
  if (ACCOUNT_FULL_ACCESS_ROLES.includes(session.role)) return null;
  const accounts = await db.bankAccount.findMany({
    where: { deletedAt: null, OR: [{ linkedUserId: null }, { linkedUserId: session.userId }] },
    select: { id: true },
  });
  return accounts.map((a) => a.id);
}

/** Sérialise pour l'IPC : les Decimal Prisma ne sont pas clonables par Electron. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Inclusion Prisma : titulaire d'un compte privé (sans données sensibles). */
const linkedUserInclude = { select: { id: true, firstName: true, lastName: true, role: true } } as const;

const PAYMENT_METHODS = ['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY'] as const;

/* ─── Schémas de validation Zod ────────────────────────────────────── */

const accountSchema = z.object({
  name: z.string().min(1, 'Libellé requis'),
  type: z.enum(['BANQUE', 'CAISSE', 'MOBILE_MONEY']),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  currency: z.string().optional(),
  initialBalance: z.number().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
  // Utilisateur titulaire du compte : `null` = compte commun, accessible à tous.
  linkedUserId: z.number().int().positive().nullable().optional(),
});

const categorySchema = z.object({
  label: z.string().min(1, 'Libellé requis'),
  direction: z.enum(['ENTREE', 'SORTIE']),
  accountingCode: z.string().optional(),
  isActive: z.boolean().optional(),
});

const operationSchema = z
  .object({
    bankAccountId: z.number().int().positive(),
    direction: z.enum(['ENTREE', 'SORTIE']),
    amount: z.number().positive(),
    operationDate: z.string().datetime().optional(),
    categoryId: z.number().int().positive().optional(),
    // Libellé facultatif côté saisie : si absent, on retombe sur le libellé de
    // l'objet d'opération choisi (cf. handler `treasury:createOperation`).
    label: z.string().optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    paymentRef: z.string().optional(),
    budgetLineId: z.number().int().positive().nullable().optional(),
    // Imputation analytique exclusive : au plus un seul des trois.
    projectId: z.number().int().positive().nullable().optional(),
    lotissementId: z.number().int().positive().nullable().optional(),
    programmeId: z.number().int().positive().nullable().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (d) => {
      const set = [d.projectId, d.lotissementId, d.programmeId].filter((v) => v != null).length;
      return set <= 1;
    },
    {
      message:
        'Une opération ne peut être rattachée qu\'à une seule entité parmi projet, lotissement ou programme immobilier',
      path: ['projectId'],
    },
  );

/* ─── Inclusions Prisma réutilisables ──────────────────────────────── */

const operationInclude = {
  bankAccount: { select: { id: true, name: true, type: true } },
  category: { select: { id: true, label: true, accountingCode: true, direction: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  budgetLine: {
    select: {
      id: true,
      label: true,
      code: true,
      budget: { select: { id: true, reference: true, name: true } },
    },
  },
  project:     { select: { id: true, reference: true, nom: true } },
  lotissement: { select: { id: true, reference: true, nom: true } },
  programme:   { select: { id: true, reference: true, nom: true } },
} as const;

/** Construit la clause `where` d'une recherche d'opérations à partir des filtres. */
function buildOperationWhere(filters: any): any {
  const where: any = { deletedAt: null };
  if (filters.bankAccountId) where.bankAccountId = filters.bankAccountId;
  if (filters.direction) where.direction = filters.direction;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.source) where.source = filters.source;
  if (filters.budgetLineId) where.budgetLineId = filters.budgetLineId;
  // Imputation analytique
  if (filters.projectId) where.projectId = Number(filters.projectId);
  if (filters.lotissementId) where.lotissementId = Number(filters.lotissementId);
  if (filters.programmeId) where.programmeId = Number(filters.programmeId);
  if (filters.dateFrom || filters.dateTo) {
    where.operationDate = {};
    if (filters.dateFrom) where.operationDate.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.operationDate.lte = new Date(filters.dateTo);
  }
  if (filters.search) {
    where.OR = [
      { reference: { contains: filters.search } },
      { label: { contains: filters.search } },
      { paymentRef: { contains: filters.search } },
    ];
  }
  return where;
}

/**
 * Enregistre les handlers IPC du module de gestion de trésorerie.
 */
export function registerTreasuryIPC(): void {

  /* ─── Tableau de bord de trésorerie ──────────────────────────────── */

  ipcMain.handle('treasury:getDashboard', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, READ_ROLES);
      const db = getDb();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Comptes visibles par la session : les comptes privés d'autres utilisateurs sont exclus.
      const accountsWhere: any = { deletedAt: null };
      applyAccountAccess(accountsWhere, session);
      const accounts = await db.bankAccount.findMany({
        where: accountsWhere,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        include: { linkedUser: linkedUserInclude },
      });
      const accountIds = accounts.map((a) => a.id);
      // Les opérations du tableau de bord se limitent aux comptes visibles.
      const opWhere = { deletedAt: null, bankAccountId: { in: accountIds } };
      // Hors SUPER_ADMIN/ADMIN, l'utilisateur ne voit que les opérations qu'il a saisies.
      const isAdmin = ACCOUNT_FULL_ACCESS_ROLES.includes(session.role);
      const recentWhere = isAdmin ? opWhere : { ...opWhere, createdById: session.userId };

      const [balances, monthAgg, recent, operationsCount] = await Promise.all([
        computeBalances(db, accountIds),
        db.treasuryOperation.groupBy({
          by: ['direction'],
          where: { ...opWhere, operationDate: { gte: monthStart } },
          _sum: { amount: true },
        }),
        db.treasuryOperation.findMany({
          where: recentWhere,
          orderBy: { operationDate: 'desc' },
          take: 8,
          include: operationInclude,
        }),
        db.treasuryOperation.count({ where: opWhere }),
      ]);

      const accountsWithBalance = accounts.map((a) => ({
        ...a,
        ...(balances.get(a.id) ?? { balance: Number(a.initialBalance), totalIn: 0, totalOut: 0 }),
      }));
      const totalBalance = accountsWithBalance.reduce((s, a) => s + a.balance, 0);
      const monthIn = Number(monthAgg.find((g) => g.direction === 'ENTREE')?._sum.amount ?? 0);
      const monthOut = Number(monthAgg.find((g) => g.direction === 'SORTIE')?._sum.amount ?? 0);

      return ser({
        success: true,
        data: {
          accounts: accountsWithBalance,
          accountsCount: accounts.length,
          monthIn,
          // Solde total, sorties du mois et nombre d'opérations sont réservés aux
          // administrateurs ; masqués (null) pour les autres rôles.
          totalBalance: isAdmin ? totalBalance : null,
          monthOut: isAdmin ? monthOut : null,
          operationsCount: isAdmin ? operationsCount : null,
          recent,
        },
      });
    } catch (error: any) {
      logger.error('treasury:getDashboard error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Comptes de trésorerie ──────────────────────────────────────── */

  ipcMain.handle('treasury:listAccounts', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.type) where.type = filters.type;
      if (filters.isActive !== undefined && filters.isActive !== '') {
        where.isActive = filters.isActive === true || filters.isActive === 'true';
      }
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search } },
          { bankName: { contains: filters.search } },
          { accountNumber: { contains: filters.search } },
        ];
      }
      // Restreint la liste aux comptes visibles par la session (comptes privés exclus).
      applyAccountAccess(where, session);
      const accounts = await db.bankAccount.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        include: { linkedUser: linkedUserInclude },
      });
      const balances = await computeBalances(db, accounts.map((a) => a.id));
      const data = accounts.map((a) => ({
        ...a,
        ...(balances.get(a.id) ?? { balance: Number(a.initialBalance), totalIn: 0, totalOut: 0 }),
      }));
      return ser({ success: true, data, total: data.length });
    } catch (error: any) {
      logger.error('treasury:listAccounts error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:getAccountById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, READ_ROLES);
      const db = getDb();
      const account = await db.bankAccount.findUnique({
        where: { id },
        include: { linkedUser: linkedUserInclude },
      });
      if (!account || account.deletedAt) return { success: false, error: 'Compte introuvable' };
      // Compte privé : inaccessible aux utilisateurs autres que le titulaire.
      if (!canAccessAccount(session, account)) return { success: false, error: 'Compte introuvable' };

      const balances = await computeBalances(db, [id]);
      const operations = await db.treasuryOperation.findMany({
        where: { deletedAt: null, bankAccountId: id },
        orderBy: { operationDate: 'desc' },
        take: 20,
        include: operationInclude,
      });
      return ser({
        success: true,
        data: {
          ...account,
          ...(balances.get(id) ?? { balance: Number(account.initialBalance), totalIn: 0, totalOut: 0 }),
          operations,
        },
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:createAccount', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, WRITE_ROLES);
      const parsed = accountSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();
      // Vérifie l'existence du titulaire éventuel du compte privé.
      if (d.linkedUserId != null) {
        const linked = await db.user.findFirst({ where: { id: d.linkedUserId, deletedAt: null } });
        if (!linked) return { success: false, error: 'Utilisateur rattaché introuvable' };
      }
      const account = await db.bankAccount.create({
        data: {
          name: d.name,
          type: d.type,
          bankName: d.bankName,
          accountNumber: d.accountNumber,
          iban: d.iban,
          bic: d.bic,
          currency: d.currency || 'XOF',
          initialBalance: (d.initialBalance ?? 0) as never,
          isActive: d.isActive ?? true,
          notes: d.notes,
          linkedUserId: d.linkedUserId ?? null,
        },
      });
      logger.info(`Compte de trésorerie créé: id=${account.id} (${account.name})`);
      return ser({ success: true, data: account });
    } catch (error: any) {
      logger.error('treasury:createAccount error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:updateAccount', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, WRITE_ROLES);
      const parsed = accountSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();
      const existing = await db.bankAccount.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Compte introuvable' };
      // Un compte privé n'est modifiable que par son titulaire (ou SUPER_ADMIN/ADMIN).
      if (!canAccessAccount(session, existing)) return { success: false, error: 'Compte introuvable' };
      // Vérifie l'existence du nouveau titulaire éventuel.
      if (d.linkedUserId != null) {
        const linked = await db.user.findFirst({ where: { id: d.linkedUserId, deletedAt: null } });
        if (!linked) return { success: false, error: 'Utilisateur rattaché introuvable' };
      }
      const data: any = { ...d };
      if (d.initialBalance !== undefined) data.initialBalance = d.initialBalance as never;
      const account = await db.bankAccount.update({ where: { id }, data });
      return ser({ success: true, data: account });
    } catch (error: any) {
      logger.error('treasury:updateAccount error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:deleteAccount', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, ADMIN_ROLES);
      const db = getDb();
      const opCount = await db.treasuryOperation.count({
        where: { bankAccountId: id, deletedAt: null },
      });
      if (opCount > 0) {
        return { success: false, error: 'Impossible de supprimer : ce compte comporte des opérations enregistrées' };
      }
      await db.bankAccount.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      logger.info(`Compte de trésorerie supprimé: id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('treasury:deleteAccount error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Opérations de trésorerie ───────────────────────────────────── */

  ipcMain.handle('treasury:listOperations', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, READ_ROLES);
      const db = getDb();
      const where = buildOperationWhere(filters);
      // Limite les opérations aux comptes visibles par la session (comptes privés exclus).
      const allowedIds = await accessibleAccountIds(db, session);
      if (allowedIds !== null) {
        if (typeof where.bankAccountId === 'number') {
          if (!allowedIds.includes(where.bankAccountId)) where.bankAccountId = { in: [] };
        } else {
          where.bankAccountId = { in: allowedIds };
        }
      }

      const [data, total, totals] = await Promise.all([
        db.treasuryOperation.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { operationDate: 'desc' },
          include: operationInclude,
        }),
        db.treasuryOperation.count({ where }),
        db.treasuryOperation.groupBy({
          by: ['direction'],
          where,
          _sum: { amount: true },
        }),
      ]);

      const totalEntree = Number(totals.find((g) => g.direction === 'ENTREE')?._sum.amount ?? 0);
      const totalSortie = Number(totals.find((g) => g.direction === 'SORTIE')?._sum.amount ?? 0);
      return ser({ success: true, data, total, totalEntree, totalSortie });
    } catch (error: any) {
      logger.error('treasury:listOperations error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:createOperation', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, WRITE_ROLES);
      const parsed = operationSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();

      const account = await db.bankAccount.findUnique({ where: { id: d.bankAccountId } });
      if (!account || account.deletedAt) return { success: false, error: 'Compte introuvable' };
      // Compte privé : seul le titulaire (ou SUPER_ADMIN/ADMIN) peut y enregistrer une opération.
      if (!canAccessAccount(session, account)) {
        return { success: false, error: 'Vous n\'avez pas accès à ce compte de trésorerie' };
      }

      // L'objet d'opération choisi doit correspondre au sens de l'opération.
      // On garde aussi son libellé pour s'en servir comme libellé d'opération par défaut.
      let categoryLabelFallback: string | null = null;
      if (d.categoryId) {
        const category = await db.treasuryCategory.findUnique({ where: { id: d.categoryId } });
        if (!category || category.deletedAt) return { success: false, error: 'Objet d\'opération introuvable' };
        if (category.direction !== d.direction) {
          return { success: false, error: 'L\'objet choisi ne correspond pas au sens de l\'opération' };
        }
        categoryLabelFallback = category.label;
      }

      // Libellé d'opération : saisie facultative, retombe sur le libellé de l'objet.
      const effectiveLabel = (d.label && d.label.trim()) || categoryLabelFallback;
      if (!effectiveLabel) {
        return { success: false, error: 'Un libellé ou un objet d\'opération est requis' };
      }

      // Imputation analytique : valider l'existence de l'entité rattachée (un seul des trois).
      if (d.projectId != null) {
        const exists = await db.project.findFirst({ where: { id: d.projectId, deletedAt: null } });
        if (!exists) return { success: false, error: 'Projet introuvable' };
      }
      if (d.lotissementId != null) {
        const exists = await db.lotissement.findFirst({ where: { id: d.lotissementId, deletedAt: null } });
        if (!exists) return { success: false, error: 'Lotissement introuvable' };
      }
      if (d.programmeId != null) {
        const exists = await db.programmeImmobilier.findFirst({ where: { id: d.programmeId, deletedAt: null } });
        if (!exists) return { success: false, error: 'Programme immobilier introuvable' };
      }

      // Imputation budgétaire : autorisée uniquement sur les sorties, sur une ligne
      // active d'un budget ouvert, par le gestionnaire de la ligne ou un admin.
      if (d.budgetLineId != null) {
        if (d.direction !== 'SORTIE') {
          return { success: false, error: 'Une ligne budgétaire ne peut être imputée qu\'à une sortie' };
        }
        const line = await db.budgetLine.findUnique({
          where: { id: d.budgetLineId },
          include: { budget: { select: { status: true, deletedAt: true } } },
        });
        if (!line || line.deletedAt) return { success: false, error: 'Ligne budgétaire introuvable' };
        if (!line.isActive) return { success: false, error: 'Cette ligne budgétaire est inactive' };
        if (line.budget.deletedAt || line.budget.status === 'CLOTURE') {
          return { success: false, error: 'Le budget de cette ligne est clôturé' };
        }
        if (!canOperateOnLine(session, line)) {
          return { success: false, error: 'Vous n\'êtes pas autorisé à imputer cette ligne budgétaire' };
        }
      }

      const operation = await recordTreasuryOperation(db, {
        bankAccountId: d.bankAccountId,
        direction: d.direction,
        amount: d.amount,
        label: effectiveLabel,
        operationDate: d.operationDate ? new Date(d.operationDate) : new Date(),
        categoryId: d.categoryId ?? null,
        paymentMethod: d.paymentMethod,
        paymentRef: d.paymentRef,
        source: 'MANUEL',
        budgetLineId: d.budgetLineId ?? null,
        projectId: d.projectId ?? null,
        lotissementId: d.lotissementId ?? null,
        programmeId: d.programmeId ?? null,
        createdById: session.userId,
        notes: d.notes,
      });
      logger.info(`Opération de trésorerie créée: ${operation.reference} (${d.direction} ${d.amount})`);
      return ser({ success: true, data: operation });
    } catch (error: any) {
      logger.error('treasury:createOperation error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:updateOperation', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, WRITE_ROLES);
      // Sur l'update partiel, on ne peut pas réutiliser le refine du schéma complet.
      // On le wrappe en mode "passthrough" puis on revalide l'exclusivité après merge
      // avec l'existant (cf. plus bas).
      const updateSchema = (operationSchema as any).innerType
        ? (operationSchema as any).innerType().partial()
        : (operationSchema as unknown as z.ZodObject<any>).partial();
      const parsed = updateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();

      const existing = await db.treasuryOperation.findUnique({
        where: { id },
        include: { bankAccount: { select: { linkedUserId: true } } },
      });
      if (!existing || existing.deletedAt) return { success: false, error: 'Opération introuvable' };
      // Compte privé : opération réservée au titulaire (ou SUPER_ADMIN/ADMIN).
      if (!canAccessAccount(session, existing.bankAccount)) {
        return { success: false, error: 'Vous n\'avez pas accès à ce compte de trésorerie' };
      }
      // Les opérations générées par un règlement ne sont pas modifiables ici :
      // elles reflètent un encaissement/paiement et restent liées à leur source.
      if (existing.source !== 'MANUEL') {
        return { success: false, error: 'Seule une opération saisie manuellement peut être modifiée' };
      }
      // Si l'opération est déplacée vers un autre compte, celui-ci doit aussi être accessible.
      if (d.bankAccountId !== undefined && d.bankAccountId !== existing.bankAccountId) {
        const target = await db.bankAccount.findUnique({ where: { id: d.bankAccountId } });
        if (!target || target.deletedAt) return { success: false, error: 'Compte introuvable' };
        if (!canAccessAccount(session, target)) {
          return { success: false, error: 'Vous n\'avez pas accès au compte de destination' };
        }
      }

      // Changement de ligne budgétaire : revalider comme à la création.
      if (d.budgetLineId !== undefined && d.budgetLineId !== existing.budgetLineId) {
        if (d.budgetLineId != null) {
          const direction = d.direction ?? existing.direction;
          if (direction !== 'SORTIE') {
            return { success: false, error: 'Une ligne budgétaire ne peut être imputée qu\'à une sortie' };
          }
          const line = await db.budgetLine.findUnique({
            where: { id: d.budgetLineId },
            include: { budget: { select: { status: true, deletedAt: true } } },
          });
          if (!line || line.deletedAt) return { success: false, error: 'Ligne budgétaire introuvable' };
          if (!line.isActive) return { success: false, error: 'Cette ligne budgétaire est inactive' };
          if (line.budget.deletedAt || line.budget.status === 'CLOTURE') {
            return { success: false, error: 'Le budget de cette ligne est clôturé' };
          }
          if (!canOperateOnLine(session, line)) {
            return { success: false, error: 'Vous n\'êtes pas autorisé à imputer cette ligne budgétaire' };
          }
        }
      }

      // Imputation analytique : valider l'existence et l'exclusivité (au plus 1).
      // On calcule la valeur effective après merge entre payload et existant.
      const effProject     = d.projectId     !== undefined ? d.projectId     : existing.projectId;
      const effLotissement = d.lotissementId !== undefined ? d.lotissementId : existing.lotissementId;
      const effProgramme   = d.programmeId   !== undefined ? d.programmeId   : existing.programmeId;
      const setCount = [effProject, effLotissement, effProgramme].filter((v) => v != null).length;
      if (setCount > 1) {
        return {
          success: false,
          error: 'Une opération ne peut être rattachée qu\'à une seule entité parmi projet, lotissement ou programme immobilier',
        };
      }
      if (d.projectId != null && d.projectId !== existing.projectId) {
        const exists = await db.project.findFirst({ where: { id: d.projectId, deletedAt: null } });
        if (!exists) return { success: false, error: 'Projet introuvable' };
      }
      if (d.lotissementId != null && d.lotissementId !== existing.lotissementId) {
        const exists = await db.lotissement.findFirst({ where: { id: d.lotissementId, deletedAt: null } });
        if (!exists) return { success: false, error: 'Lotissement introuvable' };
      }
      if (d.programmeId != null && d.programmeId !== existing.programmeId) {
        const exists = await db.programmeImmobilier.findFirst({ where: { id: d.programmeId, deletedAt: null } });
        if (!exists) return { success: false, error: 'Programme immobilier introuvable' };
      }

      const data: any = { ...d };
      if (d.amount !== undefined) data.amount = d.amount as never;
      if (d.operationDate !== undefined) data.operationDate = new Date(d.operationDate);
      const operation = await db.treasuryOperation.update({ where: { id }, data });
      return ser({ success: true, data: operation });
    } catch (error: any) {
      logger.error('treasury:updateOperation error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:deleteOperation', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, WRITE_ROLES);
      const db = getDb();
      const existing = await db.treasuryOperation.findUnique({
        where: { id },
        include: { bankAccount: { select: { linkedUserId: true } } },
      });
      if (!existing || existing.deletedAt) return { success: false, error: 'Opération introuvable' };
      // Compte privé : opération réservée au titulaire (ou SUPER_ADMIN/ADMIN).
      if (!canAccessAccount(session, existing.bankAccount)) {
        return { success: false, error: 'Vous n\'avez pas accès à ce compte de trésorerie' };
      }
      if (existing.source !== 'MANUEL') {
        return { success: false, error: 'Une opération issue d\'un règlement ne peut pas être supprimée' };
      }
      await db.treasuryOperation.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Opération de trésorerie supprimée: id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('treasury:deleteOperation error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Flux de trésorerie d'une entité analytique ─────────────────── */

  /**
   * Retourne la trace des mouvements de trésorerie rattachés à un projet,
   * un lotissement ou un programme immobilier : opérations détaillées +
   * totaux entrées/sorties/solde net.
   */
  ipcMain.handle('treasury:getEntityCashflow', async (
    _event,
    { token, entityType, entityId, limit = 100 }: { token: string; entityType: 'PROJECT' | 'LOTISSEMENT' | 'PROGRAMME'; entityId: number; limit?: number },
  ) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, READ_ROLES);
      const db = getDb();

      const where: any = { deletedAt: null };
      if (entityType === 'PROJECT')     where.projectId     = entityId;
      else if (entityType === 'LOTISSEMENT') where.lotissementId = entityId;
      else if (entityType === 'PROGRAMME')   where.programmeId   = entityId;
      else return { success: false, error: 'Type d\'entité non géré' };

      // Restriction aux comptes visibles par la session.
      const allowedIds = await accessibleAccountIds(db, session);
      if (allowedIds !== null) where.bankAccountId = { in: allowedIds };

      const [operations, totals] = await Promise.all([
        db.treasuryOperation.findMany({
          where,
          orderBy: { operationDate: 'desc' },
          take: limit,
          include: operationInclude,
        }),
        db.treasuryOperation.groupBy({
          by: ['direction'],
          where,
          _sum: { amount: true },
        }),
      ]);

      const totalEntree = Number(totals.find((g) => g.direction === 'ENTREE')?._sum.amount ?? 0);
      const totalSortie = Number(totals.find((g) => g.direction === 'SORTIE')?._sum.amount ?? 0);
      return ser({
        success: true,
        data: {
          operations,
          totalEntree,
          totalSortie,
          net: totalEntree - totalSortie,
          count: operations.length,
        },
      });
    } catch (error: any) {
      logger.error('treasury:getEntityCashflow error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Objets d'opération (comptes comptables) ────────────────────── */

  ipcMain.handle('treasury:listCategories', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.direction) where.direction = filters.direction;
      if (filters.isActive !== undefined && filters.isActive !== '') {
        where.isActive = filters.isActive === true || filters.isActive === 'true';
      }
      const data = await db.treasuryCategory.findMany({
        where,
        orderBy: [{ direction: 'asc' }, { label: 'asc' }],
      });
      return ser({ success: true, data, total: data.length });
    } catch (error: any) {
      logger.error('treasury:listCategories error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:createCategory', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, WRITE_ROLES);
      const parsed = categorySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();
      const category = await db.treasuryCategory.create({
        data: {
          label: d.label,
          direction: d.direction,
          accountingCode: d.accountingCode,
          isActive: d.isActive ?? true,
        },
      });
      logger.info(`Objet d'opération créé: id=${category.id} (${category.label})`);
      return ser({ success: true, data: category });
    } catch (error: any) {
      logger.error('treasury:createCategory error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:updateCategory', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, WRITE_ROLES);
      const parsed = categorySchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const category = await db.treasuryCategory.update({ where: { id }, data: parsed.data });
      return ser({ success: true, data: category });
    } catch (error: any) {
      logger.error('treasury:updateCategory error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('treasury:deleteCategory', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, ADMIN_ROLES);
      const db = getDb();
      await db.treasuryCategory.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      logger.info(`Objet d'opération supprimé: id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('treasury:deleteCategory error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Utilisateurs (pour le rattachement d'un compte privé) ──────── */

  ipcMain.handle('treasury:listUsers', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkTreasuryRole(session, WRITE_ROLES);
      const db = getDb();
      const users = await db.user.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true, matricule: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      });
      return { success: true, data: users };
    } catch (error: any) {
      logger.error('treasury:listUsers error', error.message);
      return { success: false, error: error.message };
    }
  });
}
