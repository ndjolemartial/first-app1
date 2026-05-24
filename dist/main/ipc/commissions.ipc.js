"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommissionsIPC = registerCommissionsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const commission_service_1 = require("../services/commission.service");
const treasury_service_1 = require("../services/treasury.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
// Lecture : tous les rôles peuvent consulter le module — la visibilité est
// ensuite restreinte aux commissions personnelles pour les rôles « simples ».
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'READONLY'];
// Écriture : ADMIN, SUPER_ADMIN, MANAGER, ACCOUNTANT uniquement.
// ASSISTANTE_DIRECTION est explicitement exclue via checkCommissionWriteRole.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
/** Rôles disposant d'une vue globale des commissions (toutes, sans filtre). */
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
/**
 * Rôles autorisés à consulter l'interface Apporteurs d'affaire.
 * ASSISTANTE_DIRECTION peut consulter (lecture seule) mais pas créer/modifier
 * — les handlers d'écriture restent passés par `checkCommissionWriteRole`.
 */
const REFERRERS_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
function hasFullView(role) {
    return FULL_VIEW_ROLES.includes(role);
}
/**
 * Vérifie le rôle pour les écritures (création, paiement, annulation,
 * apporteurs). ASSISTANTE_DIRECTION, qui hérite normalement de MANAGER via
 * `checkRole`, est exclue explicitement pour ce module.
 */
function checkCommissionWriteRole(session, allowedRoles) {
    if (session.role === 'ASSISTANTE_DIRECTION') {
        throw new Error('Permission insuffisante');
    }
    (0, auth_service_1.checkRole)(session, allowedRoles);
}
/** Sérialise pour l'IPC : les Decimal Prisma ne sont pas clonables par Electron. */
const ser = (v) => JSON.parse(JSON.stringify(v));
const PAYMENT_METHODS = ['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY'];
/* ─── Schémas de validation Zod ────────────────────────────────────── */
const createCommissionSchema = zod_1.z.object({
    conventionId: zod_1.z.number().int().positive(),
    beneficiaryType: zod_1.z.enum(['USER', 'REFERRER']),
    userId: zod_1.z.number().int().positive().optional(),
    referrerId: zod_1.z.number().int().positive().optional(),
    transactionType: zod_1.z.enum(['VENTE', 'LOCATION', 'SOUSCRIPTION', 'FRAIS_DOSSIER']),
    baseAmount: zod_1.z.number().positive(),
    rate: zod_1.z.number().min(0).max(100),
    notes: zod_1.z.string().optional(),
}).refine((d) => (d.beneficiaryType === 'USER' ? !!d.userId : !!d.referrerId), { message: 'Bénéficiaire requis' });
const payCommissionSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    method: zod_1.z.enum(PAYMENT_METHODS),
    paymentRef: zod_1.z.string().optional(),
    paidAt: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
    // Trésorerie : compte débité et objet d'opération (facultatifs).
    bankAccountId: zod_1.z.number().int().positive().optional(),
    categoryId: zod_1.z.number().int().positive().optional(),
});
const cancelCommissionSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    reason: zod_1.z.string().min(1, 'Motif requis'),
});
const referrerSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'Prénom requis'),
    lastName: zod_1.z.string().min(1, 'Nom requis'),
    companyName: zod_1.z.string().optional(),
    email: zod_1.z.string().email('Email invalide').optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    mobile: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    bankIban: zod_1.z.string().optional(),
    bankBic: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const settingsSchema = zod_1.z.object({
    saleRate: zod_1.z.number().min(0).max(100),
    rentalRate: zod_1.z.number().min(0).max(100),
    dossierRate: zod_1.z.number().min(0).max(100),
});
/* ─── Inclusions Prisma réutilisables ──────────────────────────────── */
const commissionInclude = {
    convention: {
        select: {
            id: true,
            reference: true,
            type: true,
            assetType: true,
            properties: {
                orderBy: { order: 'asc' },
                select: { property: { select: { id: true, reference: true, address: true, city: true } } },
            },
            terrains: {
                orderBy: { order: 'asc' },
                select: { terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } } },
            },
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
        },
    },
    user: { select: { id: true, firstName: true, lastName: true, role: true, fonction: true } },
    referrer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
};
/**
 * Enregistre les handlers IPC du module de gestion des commissions.
 */
function registerCommissionsIPC() {
    /* ─── Tableau de bord des commissions ────────────────────────────── */
    electron_1.ipcMain.handle('commissions:getDashboard', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            // Filtre de visibilité : rôles non privilégiés → uniquement leurs propres commissions.
            const visibilityWhere = hasFullView(session.role)
                ? {}
                : { beneficiaryType: 'USER', userId: session.userId };
            const [aPayer, payee, annuleeCount, grouped, recent, rates] = await Promise.all([
                db.commission.aggregate({
                    where: { deletedAt: null, status: 'A_PAYER', ...visibilityWhere },
                    _sum: { amount: true },
                    _count: true,
                }),
                db.commission.aggregate({
                    where: { deletedAt: null, status: 'PAYEE', ...visibilityWhere },
                    _sum: { amount: true },
                    _count: true,
                }),
                db.commission.count({ where: { deletedAt: null, status: 'ANNULEE', ...visibilityWhere } }),
                db.commission.groupBy({
                    by: ['beneficiaryType', 'userId', 'referrerId', 'status'],
                    where: { deletedAt: null, status: { in: ['A_PAYER', 'PAYEE'] }, ...visibilityWhere },
                    _sum: { amount: true },
                    _count: { _all: true },
                }),
                db.commission.findMany({
                    where: { deletedAt: null, ...visibilityWhere },
                    orderBy: { createdAt: 'desc' },
                    take: 8,
                    include: commissionInclude,
                }),
                (0, commission_service_1.getDefaultRates)(db),
            ]);
            // Récapitulatif par bénéficiaire (utilisateur ou apporteur d'affaire)
            const recap = new Map();
            for (const g of grouped) {
                const isUser = g.beneficiaryType === 'USER';
                const benId = isUser ? g.userId : g.referrerId;
                if (benId == null)
                    continue;
                const key = `${g.beneficiaryType}:${benId}`;
                if (!recap.has(key)) {
                    recap.set(key, {
                        beneficiaryType: g.beneficiaryType,
                        beneficiaryId: benId,
                        name: '',
                        aPayerAmount: 0,
                        aPayerCount: 0,
                        payeAmount: 0,
                        payeCount: 0,
                    });
                }
                const entry = recap.get(key);
                const sum = Number(g._sum.amount ?? 0);
                const count = g._count._all;
                if (g.status === 'A_PAYER') {
                    entry.aPayerAmount += sum;
                    entry.aPayerCount += count;
                }
                else if (g.status === 'PAYEE') {
                    entry.payeAmount += sum;
                    entry.payeCount += count;
                }
            }
            // Résolution des noms des bénéficiaires
            const userIds = [...recap.values()].filter((e) => e.beneficiaryType === 'USER').map((e) => e.beneficiaryId);
            const referrerIds = [...recap.values()].filter((e) => e.beneficiaryType === 'REFERRER').map((e) => e.beneficiaryId);
            const [users, referrers] = await Promise.all([
                userIds.length
                    ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
                    : Promise.resolve([]),
                referrerIds.length
                    ? db.businessReferrer.findMany({ where: { id: { in: referrerIds } }, select: { id: true, firstName: true, lastName: true, companyName: true } })
                    : Promise.resolve([]),
            ]);
            const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
            const referrerMap = new Map(referrers.map((r) => [r.id, r.companyName || `${r.firstName} ${r.lastName}`.trim()]));
            for (const entry of recap.values()) {
                entry.name = entry.beneficiaryType === 'USER'
                    ? (userMap.get(entry.beneficiaryId) ?? `Utilisateur #${entry.beneficiaryId}`)
                    : (referrerMap.get(entry.beneficiaryId) ?? `Apporteur #${entry.beneficiaryId}`);
                entry.totalAmount = entry.aPayerAmount + entry.payeAmount;
            }
            const byBeneficiary = [...recap.values()].sort((a, b) => b.totalAmount - a.totalAmount);
            return ser({
                success: true,
                data: {
                    aPayerCount: aPayer._count,
                    aPayerAmount: Number(aPayer._sum.amount ?? 0),
                    payeeCount: payee._count,
                    payeeAmount: Number(payee._sum.amount ?? 0),
                    annuleeCount,
                    byBeneficiary,
                    recent,
                    settings: rates,
                },
            });
        }
        catch (error) {
            logger_1.default.error('commissions:getDashboard error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Liste des commissions ──────────────────────────────────────── */
    electron_1.ipcMain.handle('commissions:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.status)
                where.status = filters.status;
            if (filters.beneficiaryType)
                where.beneficiaryType = filters.beneficiaryType;
            if (filters.transactionType)
                where.transactionType = filters.transactionType;
            if (filters.userId)
                where.userId = filters.userId;
            if (filters.referrerId)
                where.referrerId = filters.referrerId;
            if (filters.conventionId)
                where.conventionId = filters.conventionId;
            // Rôles non privilégiés : ne voient que les commissions dont ils sont
            // bénéficiaires (USER) — pas les commissions d'apporteur.
            if (!hasFullView(session.role)) {
                where.beneficiaryType = 'USER';
                where.userId = session.userId;
            }
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { convention: { reference: { contains: filters.search } } },
                    { user: { firstName: { contains: filters.search } } },
                    { user: { lastName: { contains: filters.search } } },
                    { referrer: { firstName: { contains: filters.search } } },
                    { referrer: { lastName: { contains: filters.search } } },
                    { referrer: { companyName: { contains: filters.search } } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.commission.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: commissionInclude,
                }),
                db.commission.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('commissions:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const commission = await db.commission.findUnique({
                where: { id },
                include: {
                    ...commissionInclude,
                    paidBy: { select: { id: true, firstName: true, lastName: true } },
                    cancelledBy: { select: { id: true, firstName: true, lastName: true } },
                },
            });
            if (!commission || commission.deletedAt)
                return { success: false, error: 'Commission introuvable' };
            // Contrôle de visibilité pour les rôles non privilégiés : seul le
            // bénéficiaire utilisateur peut consulter sa propre commission.
            if (!hasFullView(session.role)) {
                const isOwner = commission.beneficiaryType === 'USER' && commission.userId === session.userId;
                if (!isOwner)
                    return { success: false, error: 'Commission inaccessible' };
            }
            return ser({ success: true, data: commission });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /* ─── Création manuelle d'une commission ─────────────────────────── */
    electron_1.ipcMain.handle('commissions:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCommissionWriteRole(session, WRITE_ROLES);
            const parsed = createCommissionSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const convention = await db.convention.findUnique({
                where: { id: d.conventionId, deletedAt: null },
                select: { id: true, type: true },
            });
            if (!convention)
                return { success: false, error: 'Convention introuvable' };
            if (!(0, commission_service_1.isCommissionEligibleConvention)(convention.type)) {
                return { success: false, error: 'Cette convention n\'est pas éligible à une commission (vente, location ou souscription uniquement)' };
            }
            // Une commission VENTE/LOCATION/SOUSCRIPTION doit correspondre au type de
            // la convention ; une commission FRAIS_DOSSIER est admise quelle que soit la convention éligible.
            const naturalType = convention.type === 'SALE' ? 'VENTE'
                : convention.type === 'SOUSCRIPTION' ? 'SOUSCRIPTION'
                    : 'LOCATION';
            if (d.transactionType !== 'FRAIS_DOSSIER' && d.transactionType !== naturalType) {
                return { success: false, error: 'Le type de commission ne correspond pas au type de la convention' };
            }
            // Vérifie l'existence du bénéficiaire
            if (d.beneficiaryType === 'USER') {
                const user = await db.user.findUnique({ where: { id: d.userId }, select: { id: true } });
                if (!user)
                    return { success: false, error: 'Utilisateur introuvable' };
            }
            else {
                const referrer = await db.businessReferrer.findUnique({ where: { id: d.referrerId }, select: { id: true } });
                if (!referrer)
                    return { success: false, error: 'Apporteur d\'affaire introuvable' };
            }
            const amount = (0, commission_service_1.computeCommissionAmount)(d.baseAmount, d.rate);
            const reference = await (0, commission_service_1.nextCommissionRef)(db);
            const commission = await db.commission.create({
                data: {
                    reference,
                    conventionId: d.conventionId,
                    beneficiaryType: d.beneficiaryType,
                    userId: d.beneficiaryType === 'USER' ? d.userId : null,
                    referrerId: d.beneficiaryType === 'REFERRER' ? d.referrerId : null,
                    transactionType: d.transactionType,
                    baseAmount: d.baseAmount,
                    rate: d.rate,
                    amount: amount,
                    status: 'A_PAYER',
                    source: 'MANUEL',
                    notes: d.notes,
                },
                include: commissionInclude,
            });
            logger_1.default.info(`Commission créée: ${commission.reference}`);
            return ser({ success: true, data: commission });
        }
        catch (error) {
            logger_1.default.error('commissions:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Paiement d'une commission ──────────────────────────────────── */
    electron_1.ipcMain.handle('commissions:pay', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCommissionWriteRole(session, WRITE_ROLES);
            const parsed = payCommissionSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const commission = await db.commission.findUnique({
                where: { id: d.id },
                select: { id: true, status: true, deletedAt: true, amount: true, reference: true },
            });
            if (!commission || commission.deletedAt)
                return { success: false, error: 'Commission introuvable' };
            if (commission.status === 'PAYEE')
                return { success: false, error: 'Commission déjà payée' };
            if (commission.status === 'ANNULEE')
                return { success: false, error: 'Impossible de payer une commission annulée' };
            // Vérifie le compte de trésorerie si le paiement y est rattaché.
            if (d.bankAccountId) {
                const account = await db.bankAccount.findUnique({ where: { id: d.bankAccountId } });
                if (!account || account.deletedAt)
                    return { success: false, error: 'Compte de trésorerie introuvable' };
            }
            const paidAt = d.paidAt ? new Date(d.paidAt) : new Date();
            const updated = await db.$transaction(async (tx) => {
                const paid = await tx.commission.update({
                    where: { id: d.id },
                    data: {
                        status: 'PAYEE',
                        paidAt,
                        paymentMethod: d.method,
                        paymentRef: d.paymentRef,
                        paidById: session.userId,
                        notes: d.notes,
                    },
                    include: commissionInclude,
                });
                // Paiement rattaché à un compte → mouvement de trésorerie (sortie).
                if (d.bankAccountId) {
                    await (0, treasury_service_1.recordTreasuryOperation)(tx, {
                        bankAccountId: d.bankAccountId,
                        direction: 'SORTIE',
                        amount: Number(commission.amount),
                        label: `Paiement commission ${commission.reference}`,
                        operationDate: paidAt,
                        categoryId: d.categoryId ?? null,
                        paymentMethod: d.method,
                        paymentRef: d.paymentRef,
                        source: 'COMMISSION',
                        commissionId: d.id,
                        createdById: session.userId,
                    });
                }
                return paid;
            });
            logger_1.default.info(`Commission payée: id=${d.id} par user=${session.userId}`);
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('commissions:pay error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Annulation d'une commission ────────────────────────────────── */
    electron_1.ipcMain.handle('commissions:cancel', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCommissionWriteRole(session, WRITE_ROLES);
            const parsed = cancelCommissionSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const commission = await db.commission.findUnique({ where: { id: d.id }, select: { id: true, status: true, deletedAt: true } });
            if (!commission || commission.deletedAt)
                return { success: false, error: 'Commission introuvable' };
            if (commission.status === 'ANNULEE')
                return { success: false, error: 'Commission déjà annulée' };
            const updated = await db.commission.update({
                where: { id: d.id },
                data: {
                    status: 'ANNULEE',
                    cancelledAt: new Date(),
                    cancelReason: d.reason,
                    cancelledById: session.userId,
                },
                include: commissionInclude,
            });
            logger_1.default.info(`Commission annulée: id=${d.id} par user=${session.userId}`);
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('commissions:cancel error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Tableau de commissions d'un bénéficiaire ───────────────────── */
    electron_1.ipcMain.handle('commissions:getBeneficiarySummary', async (_event, { token, beneficiaryType, beneficiaryId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            if (beneficiaryType !== 'USER' && beneficiaryType !== 'REFERRER') {
                return { success: false, error: 'Type de bénéficiaire invalide' };
            }
            const db = (0, db_service_1.getDb)();
            let beneficiary = null;
            if (beneficiaryType === 'USER') {
                beneficiary = await db.user.findUnique({
                    where: { id: beneficiaryId },
                    select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, role: true, matricule: true },
                });
            }
            else {
                beneficiary = await db.businessReferrer.findUnique({ where: { id: beneficiaryId } });
            }
            if (!beneficiary)
                return { success: false, error: 'Bénéficiaire introuvable' };
            const where = { deletedAt: null, beneficiaryType };
            if (beneficiaryType === 'USER')
                where.userId = beneficiaryId;
            else
                where.referrerId = beneficiaryId;
            const commissions = await db.commission.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: commissionInclude,
            });
            const totals = { aPayerAmount: 0, aPayerCount: 0, payeAmount: 0, payeCount: 0, annuleeCount: 0 };
            for (const c of commissions) {
                const amt = Number(c.amount);
                if (c.status === 'A_PAYER') {
                    totals.aPayerAmount += amt;
                    totals.aPayerCount += 1;
                }
                else if (c.status === 'PAYEE') {
                    totals.payeAmount += amt;
                    totals.payeCount += 1;
                }
                else if (c.status === 'ANNULEE') {
                    totals.annuleeCount += 1;
                }
            }
            return ser({ success: true, data: { beneficiaryType, beneficiary, commissions, totals } });
        }
        catch (error) {
            logger_1.default.error('commissions:getBeneficiarySummary error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Apporteurs d'affaire ───────────────────────────────────────── */
    electron_1.ipcMain.handle('commissions:listReferrers', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Consultation des apporteurs : ADMIN, SUPER_ADMIN, MANAGER, ACCOUNTANT,
            // ASSISTANTE_DIRECTION. AGENT et READONLY restent exclus.
            (0, auth_service_1.checkRole)(session, REFERRERS_VIEW_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.isActive !== undefined && filters.isActive !== '')
                where.isActive = filters.isActive === true || filters.isActive === 'true';
            if (filters.search) {
                where.OR = [
                    { firstName: { contains: filters.search } },
                    { lastName: { contains: filters.search } },
                    { companyName: { contains: filters.search } },
                    { email: { contains: filters.search } },
                    { phone: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.businessReferrer.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { _count: { select: { commissions: true } } },
                }),
                db.businessReferrer.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('commissions:listReferrers error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:getReferrerById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, REFERRERS_VIEW_ROLES);
            const db = (0, db_service_1.getDb)();
            const referrer = await db.businessReferrer.findUnique({ where: { id } });
            if (!referrer || referrer.deletedAt)
                return { success: false, error: 'Apporteur d\'affaire introuvable' };
            return ser({ success: true, data: referrer });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:createReferrer', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCommissionWriteRole(session, WRITE_ROLES);
            const parsed = referrerSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const referrer = await db.businessReferrer.create({
                data: { ...d, email: d.email || null },
            });
            logger_1.default.info(`Apporteur d'affaire créé: id=${referrer.id}`);
            return ser({ success: true, data: referrer });
        }
        catch (error) {
            logger_1.default.error('commissions:createReferrer error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:updateReferrer', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCommissionWriteRole(session, WRITE_ROLES);
            const parsed = referrerSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const data = { ...d };
            if (d.email !== undefined)
                data.email = d.email || null;
            const referrer = await db.businessReferrer.update({ where: { id }, data });
            return ser({ success: true, data: referrer });
        }
        catch (error) {
            logger_1.default.error('commissions:updateReferrer error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:deleteReferrer', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCommissionWriteRole(session, ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            const activeCommissions = await db.commission.count({
                where: { referrerId: id, deletedAt: null, status: { not: 'ANNULEE' } },
            });
            if (activeCommissions > 0) {
                return { success: false, error: 'Impossible de supprimer : cet apporteur a des commissions actives' };
            }
            await db.businessReferrer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('commissions:deleteReferrer error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Données pour les formulaires ───────────────────────────────── */
    electron_1.ipcMain.handle('commissions:listUsers', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const users = await db.user.findMany({
                where: { deletedAt: null, isActive: true },
                select: { id: true, firstName: true, lastName: true, role: true, matricule: true },
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
            });
            return ser({ success: true, data: users });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:listEligibleConventions', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const conventions = await db.convention.findMany({
                where: {
                    deletedAt: null,
                    status: { not: 'ANNULE' },
                    type: { in: ['SALE', 'SOUSCRIPTION', 'RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'COMMERCIAL_LEASE'] },
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    reference: true,
                    type: true,
                    saleAmount: true,
                    rentAmount: true,
                    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                    property: { select: { id: true, reference: true } },
                },
            });
            return ser({ success: true, data: conventions });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /* ─── Paramètres : taux de commission par défaut ─────────────────── */
    electron_1.ipcMain.handle('commissions:getSettings', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const rates = await (0, commission_service_1.getDefaultRates)((0, db_service_1.getDb)());
            return { success: true, data: rates };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:updateSettings', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCommissionWriteRole(session, ADMIN_ROLES);
            const parsed = settingsSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            await (0, commission_service_1.setDefaultRates)(db, parsed.data);
            logger_1.default.info(`Taux de commission par défaut mis à jour par user=${session.userId}`);
            return { success: true, data: parsed.data };
        }
        catch (error) {
            logger_1.default.error('commissions:updateSettings error', error.message);
            return { success: false, error: error.message };
        }
    });
}
