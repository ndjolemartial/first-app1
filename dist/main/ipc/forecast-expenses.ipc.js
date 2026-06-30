"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerForecastExpensesIPC = registerForecastExpensesIPC;
const electron_1 = require("electron");
const zod_1 = require("zod");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const treasury_service_1 = require("../services/treasury.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Module Charges / dépenses prévisionnelles.
 *
 * Permet de planifier des charges (objet = objet de sortie de la trésorerie),
 * de les régler (génération d'une opération de trésorerie SORTIE prise en compte
 * en comptabilité) et de suivre les rappels associés dans le CRM.
 *
 * Accès : SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT, ASSISTANTE_DIRECTION.
 * Visibilité : MANAGER et ASSISTANTE_DIRECTION ne voient que les charges (et
 * leurs rappels) qu'ils ont eux-mêmes planifiées ; les autres rôles voient tout.
 */
const ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
/** Rôles voyant toutes les charges (les autres ne voient que les leurs). */
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const PAYMENT_METHODS = ['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY'];
/** Sérialise pour l'IPC : les Decimal Prisma ne sont pas clonables par Electron. */
const ser = (v) => JSON.parse(JSON.stringify(v));
const hasFullView = (role) => FULL_VIEW_ROLES.includes(role);
/** Restriction de visibilité : MANAGER / ASSISTANTE_DIRECTION → leurs charges. */
function visibilityWhere(session) {
    return hasFullView(session.role) ? {} : { createdById: session.userId };
}
/** Date 'AAAA-MM-JJ' → Date à midi local (sinon ISO complet). */
const parseDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(`${v}T12:00:00`) : new Date(v);
/** Référence CHP-YYYY-NNNN. */
async function nextRef(db) {
    const year = new Date().getFullYear();
    const last = await db.forecastExpense.findFirst({
        where: { reference: { startsWith: `CHP-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `CHP-${year}-${String(seq).padStart(4, '0')}`;
}
const createSchema = zod_1.z.object({
    label: zod_1.z.string().min(1, 'Libellé requis'),
    categoryId: zod_1.z.number().int().positive('Objet requis'),
    amount: zod_1.z.number().positive('Montant requis'),
    dueDate: zod_1.z.string().min(1, 'Date prévue requise'),
    notes: zod_1.z.string().optional().nullable(),
});
const settleSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    amount: zod_1.z.number().positive('Montant requis'),
    settledAt: zod_1.z.string().min(1, 'Date requise'),
    bankAccountId: zod_1.z.number().int().positive('Compte requis'),
    paymentMethod: zod_1.z.enum(PAYMENT_METHODS).optional(),
    paymentRef: zod_1.z.string().optional().nullable(),
});
const fundSchema = zod_1.z.object({
    bankAccountId: zod_1.z.number().int().positive('Compte requis'),
    amount: zod_1.z.number().positive('Montant requis'),
    operationDate: zod_1.z.string().min(1, 'Date requise'),
    label: zod_1.z.string().optional().nullable(),
    paymentMethod: zod_1.z.enum(PAYMENT_METHODS).optional(),
    paymentRef: zod_1.z.string().optional().nullable(),
});
/** Crée le rappel CRM (type RAPPEL) associé à une charge prévisionnelle. */
async function createReminder(db, expense) {
    await db.crmActivity.create({
        data: {
            type: 'RAPPEL',
            subject: `Charge prévisionnelle ${expense.reference} — ${expense.label}`,
            description: `Montant prévu : ${Number(expense.amount)} FCFA — à régler avant le ${new Date(expense.dueDate).toLocaleDateString('fr-FR')}.`,
            status: 'EN_ATTENTE',
            dueDate: expense.dueDate,
            userId: expense.createdById ?? null,
            createdById: expense.createdById ?? null,
            forecastExpenseId: expense.id,
        },
    });
}
/**
 * Synchronise les rappels CRM d'une charge selon son nouveau statut :
 * REGLEE → TRAITE, ANNULEE → ANNULE, PREVUE → réactivation.
 */
async function syncReminders(db, forecastExpenseId, status) {
    if (status === 'REGLEE') {
        await db.crmActivity.updateMany({
            where: { forecastExpenseId, status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] } },
            data: { status: 'TRAITE', completedAt: new Date() },
        });
    }
    else if (status === 'ANNULEE') {
        await db.crmActivity.updateMany({
            where: { forecastExpenseId, status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] } },
            data: { status: 'ANNULE' },
        });
    }
    else {
        await db.crmActivity.updateMany({
            where: { forecastExpenseId, status: { in: ['ANNULE', 'TRAITE'] } },
            data: { status: 'EN_ATTENTE', completedAt: null },
        });
    }
}
/** Libellé et code comptable de l'objet d'approvisionnement de caisse. */
const APPRO_CAISSE_LABEL = 'APPRO CAISSE';
const APPRO_CAISSE_CODE = '585';
/**
 * Retrouve (ou crée) l'objet d'opération « APPRO CAISSE » (585, sens ENTREE),
 * utilisé pour les approvisionnements de caisse depuis le règlement des charges.
 */
async function getOrCreateApproCaisseCategory(db) {
    const existing = await db.treasuryCategory.findFirst({
        where: { deletedAt: null, direction: 'ENTREE', label: APPRO_CAISSE_LABEL, accountingCode: APPRO_CAISSE_CODE },
        select: { id: true },
    });
    if (existing)
        return existing;
    return db.treasuryCategory.create({
        data: { label: APPRO_CAISSE_LABEL, direction: 'ENTREE', accountingCode: APPRO_CAISSE_CODE, isActive: true },
        select: { id: true },
    });
}
function registerForecastExpensesIPC() {
    /* ─── Objets de sortie (catégories de trésorerie SORTIE) ─────────── */
    electron_1.ipcMain.handle('expenses:listCategories', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.treasuryCategory.findMany({
                where: { deletedAt: null, direction: 'SORTIE', isActive: true },
                orderBy: { label: 'asc' },
                select: { id: true, label: true, accountingCode: true },
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('expenses:listCategories error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Comptes débitables (communs + compte privé de l'utilisateur) ── */
    electron_1.ipcMain.handle('expenses:listAccounts', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const db = (0, db_service_1.getDb)();
            const accounts = await db.bankAccount.findMany({
                where: {
                    deletedAt: null, isActive: true,
                    OR: [{ linkedUserId: null }, { linkedUserId: session.userId }],
                },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, type: true, initialBalance: true },
            });
            // Solde courant de chaque compte (pour bloquer un règlement sur un compte
            // au solde ≤ 0 côté UI et proposer un approvisionnement).
            const balances = await (0, treasury_service_1.computeBalances)(db, accounts.map((a) => a.id));
            const data = accounts.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                balance: balances.get(a.id)?.balance ?? Number(a.initialBalance),
            }));
            // Compte de sortie par défaut paramétré pour l'utilisateur (s'il est listé).
            const me = await db.user.findUnique({ where: { id: session.userId }, select: { defaultAccountSortieId: true } });
            const defId = me?.defaultAccountSortieId ?? null;
            const defaultAccountId = defId != null && accounts.some((a) => a.id === defId) ? defId : null;
            return ser({ success: true, data, defaultAccountId });
        }
        catch (error) {
            logger_1.default.error('expenses:listAccounts error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Liste ───────────────────────────────────────────────────────── */
    electron_1.ipcMain.handle('expenses:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...visibilityWhere(session) };
            if (filters.status)
                where.status = filters.status;
            if (filters.categoryId)
                where.categoryId = Number(filters.categoryId);
            if (filters.dueBefore)
                where.dueDate = { ...(where.dueDate ?? {}), lte: parseDay(filters.dueBefore) };
            if (filters.dueAfter)
                where.dueDate = { ...(where.dueDate ?? {}), gte: parseDay(filters.dueAfter) };
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { label: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.forecastExpense.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
                    include: {
                        category: { select: { id: true, label: true } },
                        createdBy: { select: { id: true, firstName: true, lastName: true } },
                    },
                }),
                db.forecastExpense.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('expenses:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Statistiques ─────────────────────────────────────────────────── */
    electron_1.ipcMain.handle('expenses:stats', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const db = (0, db_service_1.getDb)();
            const base = { deletedAt: null, ...visibilityWhere(session) };
            const now = new Date();
            const [prevue, overdue, dueAgg, settledMonthAgg] = await db.$transaction([
                db.forecastExpense.count({ where: { ...base, status: 'PREVUE' } }),
                db.forecastExpense.count({ where: { ...base, status: 'PREVUE', dueDate: { lt: now } } }),
                db.forecastExpense.aggregate({ where: { ...base, status: 'PREVUE' }, _sum: { amount: true } }),
                db.forecastExpense.aggregate({
                    where: { ...base, status: 'REGLEE', settledAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
                    _sum: { settledAmount: true },
                }),
            ]);
            return ser({
                success: true,
                data: {
                    prevue, overdue,
                    totalDue: Number(dueAgg._sum.amount ?? 0),
                    settledThisMonth: Number(settledMonthAgg._sum.settledAmount ?? 0),
                },
            });
        }
        catch (error) {
            logger_1.default.error('expenses:stats error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Détail ───────────────────────────────────────────────────────── */
    electron_1.ipcMain.handle('expenses:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const db = (0, db_service_1.getDb)();
            const expense = await db.forecastExpense.findFirst({
                where: { id, deletedAt: null, ...visibilityWhere(session) },
                include: {
                    category: { select: { id: true, label: true, accountingCode: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    settledBy: { select: { id: true, firstName: true, lastName: true } },
                    operations: {
                        where: { deletedAt: null },
                        select: { id: true, reference: true, amount: true, operationDate: true, bankAccount: { select: { name: true } } },
                    },
                },
            });
            if (!expense)
                return { success: false, error: 'Charge introuvable ou inaccessible' };
            return ser({ success: true, data: expense });
        }
        catch (error) {
            logger_1.default.error('expenses:getById error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Création ─────────────────────────────────────────────────────── */
    electron_1.ipcMain.handle('expenses:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const parsed = createSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const category = await db.treasuryCategory.findFirst({ where: { id: d.categoryId, deletedAt: null, direction: 'SORTIE' } });
            if (!category)
                return { success: false, error: 'Objet de sortie invalide' };
            const expense = await db.forecastExpense.create({
                data: {
                    reference: await nextRef(db),
                    label: d.label,
                    categoryId: d.categoryId,
                    amount: d.amount,
                    dueDate: parseDay(d.dueDate),
                    notes: d.notes ?? null,
                    status: 'PREVUE',
                    createdById: session.userId,
                },
            });
            await createReminder(db, expense);
            logger_1.default.info(`Charge prévisionnelle créée : ${expense.reference}`);
            return ser({ success: true, data: expense });
        }
        catch (error) {
            logger_1.default.error('expenses:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Modification (charge non réglée) ─────────────────────────────── */
    electron_1.ipcMain.handle('expenses:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const parsed = createSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const existing = await db.forecastExpense.findFirst({ where: { id, deletedAt: null, ...visibilityWhere(session) } });
            if (!existing)
                return { success: false, error: 'Charge introuvable ou inaccessible' };
            if (existing.status !== 'PREVUE')
                return { success: false, error: 'Seule une charge non réglée peut être modifiée.' };
            if (d.categoryId != null) {
                const cat = await db.treasuryCategory.findFirst({ where: { id: d.categoryId, deletedAt: null, direction: 'SORTIE' } });
                if (!cat)
                    return { success: false, error: 'Objet de sortie invalide' };
            }
            const data = {};
            if (d.label != null)
                data.label = d.label;
            if (d.categoryId != null)
                data.categoryId = d.categoryId;
            if (d.amount != null)
                data.amount = d.amount;
            if (d.dueDate != null)
                data.dueDate = parseDay(d.dueDate);
            if (d.notes !== undefined)
                data.notes = d.notes ?? null;
            const expense = await db.forecastExpense.update({ where: { id }, data });
            // Met à jour le rappel CRM (libellé / échéance).
            await db.crmActivity.updateMany({
                where: { forecastExpenseId: id, status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] } },
                data: {
                    subject: `Charge prévisionnelle ${expense.reference} — ${expense.label}`,
                    dueDate: expense.dueDate,
                    description: `Montant prévu : ${Number(expense.amount)} FCFA — à régler avant le ${new Date(expense.dueDate).toLocaleDateString('fr-FR')}.`,
                },
            });
            logger_1.default.info(`Charge prévisionnelle modifiée : ${expense.reference}`);
            return ser({ success: true, data: expense });
        }
        catch (error) {
            logger_1.default.error('expenses:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Règlement (génère l'opération de trésorerie) ─────────────────── */
    electron_1.ipcMain.handle('expenses:settle', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const parsed = settleSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const expense = await db.forecastExpense.findFirst({ where: { id: d.id, deletedAt: null, ...visibilityWhere(session) } });
            if (!expense)
                return { success: false, error: 'Charge introuvable ou inaccessible' };
            if (expense.status === 'REGLEE')
                return { success: false, error: 'Cette charge est déjà réglée.' };
            if (expense.status === 'ANNULEE')
                return { success: false, error: 'Cette charge est annulée.' };
            const account = await db.bankAccount.findFirst({ where: { id: d.bankAccountId, deletedAt: null } });
            if (!account)
                return { success: false, error: 'Compte à débiter introuvable' };
            if (!account.isActive)
                return { success: false, error: 'Ce compte de trésorerie est inactif.' };
            // Compte privé : réservé à son titulaire (ou aux administrateurs).
            if (account.linkedUserId != null && account.linkedUserId !== session.userId
                && !['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
                return { success: false, error: 'Vous n\'avez pas accès à ce compte de trésorerie.' };
            }
            const settledAt = parseDay(d.settledAt);
            const updated = await db.$transaction(async (tx) => {
                await (0, treasury_service_1.recordTreasuryOperation)(tx, {
                    bankAccountId: d.bankAccountId,
                    direction: 'SORTIE',
                    amount: d.amount,
                    label: `Règlement charge ${expense.reference} — ${expense.label}`,
                    operationDate: settledAt,
                    categoryId: expense.categoryId, // objet de sortie de la charge
                    paymentMethod: d.paymentMethod,
                    paymentRef: d.paymentRef ?? null,
                    source: 'CHARGE',
                    forecastExpenseId: expense.id,
                    createdById: session.userId,
                });
                const exp = await tx.forecastExpense.update({
                    where: { id: d.id },
                    data: {
                        status: 'REGLEE',
                        settledAt,
                        settledAmount: d.amount,
                        paymentMethod: d.paymentMethod ?? null,
                        settledById: session.userId,
                    },
                });
                // Charge réglée → rappels CRM marqués comme traités.
                await syncReminders(tx, d.id, 'REGLEE');
                return exp;
            });
            logger_1.default.info(`Charge prévisionnelle réglée : ${expense.reference} (${d.amount})`);
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('expenses:settle error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Approvisionnement d'un compte (opération ENTREE) ─────────────── */
    electron_1.ipcMain.handle('expenses:fundAccount', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const parsed = fundSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const account = await db.bankAccount.findFirst({ where: { id: d.bankAccountId, deletedAt: null } });
            if (!account)
                return { success: false, error: 'Compte à approvisionner introuvable' };
            if (!account.isActive)
                return { success: false, error: 'Ce compte de trésorerie est inactif.' };
            // Compte privé : réservé à son titulaire (ou aux administrateurs).
            if (account.linkedUserId != null && account.linkedUserId !== session.userId
                && !['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
                return { success: false, error: 'Vous n\'avez pas accès à ce compte de trésorerie.' };
            }
            // Approvisionnement d'une CAISSE : objet d'opération « APPRO CAISSE » (585),
            // retrouvé ou créé à la volée (sens ENTREE).
            let categoryId;
            if (account.type === 'CAISSE') {
                categoryId = (await getOrCreateApproCaisseCategory(db)).id;
            }
            await (0, treasury_service_1.recordTreasuryOperation)(db, {
                bankAccountId: d.bankAccountId,
                direction: 'ENTREE',
                amount: d.amount,
                label: d.label?.trim() || `Approvisionnement compte ${account.name}`,
                operationDate: parseDay(d.operationDate),
                categoryId,
                paymentMethod: d.paymentMethod,
                paymentRef: d.paymentRef ?? null,
                source: 'MANUEL',
                createdById: session.userId,
            });
            const balances = await (0, treasury_service_1.computeBalances)(db, [d.bankAccountId]);
            const balance = balances.get(d.bankAccountId)?.balance ?? 0;
            logger_1.default.info(`Compte ${account.name} approvisionné de ${d.amount} (solde: ${balance})`);
            return ser({ success: true, data: { balance } });
        }
        catch (error) {
            logger_1.default.error('expenses:fundAccount error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Annulation ───────────────────────────────────────────────────── */
    electron_1.ipcMain.handle('expenses:cancel', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const db = (0, db_service_1.getDb)();
            const expense = await db.forecastExpense.findFirst({ where: { id, deletedAt: null, ...visibilityWhere(session) } });
            if (!expense)
                return { success: false, error: 'Charge introuvable ou inaccessible' };
            if (expense.status === 'REGLEE')
                return { success: false, error: 'Une charge réglée ne peut pas être annulée.' };
            const updated = await db.forecastExpense.update({ where: { id }, data: { status: 'ANNULEE' } });
            await syncReminders(db, id, 'ANNULEE');
            logger_1.default.info(`Charge prévisionnelle annulée : ${expense.reference}`);
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('expenses:cancel error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Suppression (soft delete) ────────────────────────────────────── */
    electron_1.ipcMain.handle('expenses:remove', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ACCESS_ROLES);
            const db = (0, db_service_1.getDb)();
            const expense = await db.forecastExpense.findFirst({ where: { id, deletedAt: null, ...visibilityWhere(session) } });
            if (!expense)
                return { success: false, error: 'Charge introuvable ou inaccessible' };
            if (expense.status === 'REGLEE')
                return { success: false, error: 'Une charge réglée ne peut pas être supprimée.' };
            await db.forecastExpense.update({ where: { id }, data: { deletedAt: new Date() } });
            await syncReminders(db, id, 'ANNULEE');
            logger_1.default.info(`Charge prévisionnelle supprimée : ${expense.reference}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('expenses:remove error', error.message);
            return { success: false, error: error.message };
        }
    });
}
