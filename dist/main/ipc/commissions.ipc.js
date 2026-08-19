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
const timeline_service_1 = require("../services/timeline.service");
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
function hasFullView(role) {
    return FULL_VIEW_ROLES.includes(role);
}
/**
 * Apporteurs d'affaire — permissions dédiées, distinctes de celles des
 * commissions elles-mêmes. Vue complète (liste/fiche non filtrée) et
 * modification : SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT. Suppression :
 * SUPER_ADMIN, ADMIN, MANAGER uniquement (ACCOUNTANT en est exclu). Tous les
 * autres rôles (dont ASSISTANTE_DIRECTION) n'ont accès qu'aux apporteurs dont
 * ils sont l'utilisateur référent (`assignedToId`), en lecture seule — cf.
 * `referrerScopeWhere`. Contrôlé par rôle exact (`checkExactRole`), sans
 * l'équivalence ACCOUNTANT/ASSISTANTE_DIRECTION → MANAGER de `checkRole`
 * (qui accorderait sinon la suppression à ACCOUNTANT et la vue complète à
 * ASSISTANTE_DIRECTION).
 */
const REFERRERS_FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const REFERRERS_WRITE_ROLES = REFERRERS_FULL_VIEW_ROLES;
const REFERRERS_DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Vérifie un rôle exact, sans l'équivalence ACCOUNTANT/ASSISTANTE_DIRECTION → MANAGER de `checkRole`. */
function checkExactRole(session, allowed) {
    if (!allowed.includes(session.role))
        throw new Error('Permission insuffisante');
}
/** Restreint la liste/fiche des apporteurs aux rôles sans vue complète : uniquement ceux dont ils sont l'utilisateur référent. */
function referrerScopeWhere(session) {
    if (REFERRERS_FULL_VIEW_ROLES.includes(session.role))
        return {};
    return { assignedToId: session.userId };
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
    transactionType: zod_1.z.enum(['VENTE', 'LOCATION', 'SOUSCRIPTION', 'FRAIS_DOSSIER', 'FRAIS_DEMARCHES_ACD']),
    baseAmount: zod_1.z.number().positive(),
    rate: zod_1.z.number().min(0).max(100),
    notes: zod_1.z.string().optional(),
}).refine((d) => (d.beneficiaryType === 'USER' ? !!d.userId : !!d.referrerId), { message: 'Bénéficiaire requis' });
// Commission sur une échéance héritée (sans convention). Le bénéficiaire est
// l'utilisateur référent du client par défaut (override possible via userId).
const createInstallmentCommissionSchema = zod_1.z.object({
    installmentId: zod_1.z.number().int().positive(),
    transactionType: zod_1.z.enum(['VENTE', 'LOCATION', 'SOUSCRIPTION', 'FRAIS_DOSSIER', 'FRAIS_DEMARCHES_ACD']),
    rate: zod_1.z.number().min(0).max(100),
    baseAmount: zod_1.z.number().positive().optional(),
    userId: zod_1.z.number().int().positive().optional(),
    notes: zod_1.z.string().optional(),
});
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
/**
 * Modification d'une commission existante : seuls les champs financiers
 * (assiette, taux) et la note peuvent évoluer. La convention et le
 * bénéficiaire sont figés à la création — toute autre correction passe par
 * une annulation suivie d'une nouvelle création.
 */
const updateCommissionSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive(),
    baseAmount: zod_1.z.number().positive(),
    rate: zod_1.z.number().min(0).max(100),
    notes: zod_1.z.string().optional(),
});
const referrerSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'Prénom requis'),
    lastName: zod_1.z.string().min(1, 'Nom requis'),
    civilite: zod_1.z.preprocess((v) => (v === '' ? null : v), zod_1.z.enum(['Monsieur', 'Madame', 'Mademoiselle']).nullable().optional()),
    companyName: zod_1.z.string().optional(),
    email: zod_1.z.string().email('Email invalide').optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    mobile: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    bankIban: zod_1.z.string().optional(),
    bankBic: zod_1.z.string().optional(),
    // Informations complémentaires — alimentent la « Fiche KYC » imprimable
    // depuis la fiche apporteur d'affaire, même principe que Client.*.
    employerName: zod_1.z.string().optional(),
    monthlyIncome: zod_1.z.coerce.number().min(0).nullable().optional(),
    sourceOfFunds: zod_1.z.array(zod_1.z.string()).optional(),
    sourceOfFundsOther: zod_1.z.string().optional(),
    sourceOfWealth: zod_1.z.string().optional(),
    relationshipPurpose: zod_1.z.array(zod_1.z.string()).optional(),
    relationshipPurposeOther: zod_1.z.string().optional(),
    expectedTransactionVolume: zod_1.z.coerce.number().min(0).nullable().optional(),
    acquisitionChannel: zod_1.z.string().optional(),
    isPep: zod_1.z.boolean().optional(),
    pepCategory: zod_1.z.enum(['PEP_NATIONAL', 'PEP_ETRANGER', 'PEP_ORGANISATION_INTERNATIONALE', 'PERSONNE_LIEE_PEP']).nullable().optional(),
    pepFunction: zod_1.z.string().optional(),
    hasRiskyCountryLink: zod_1.z.boolean().optional(),
    kycSignedAt: zod_1.z.string().datetime().nullable().optional(),
    kycSignedPlace: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    // Utilisateur interne référent de cet apporteur (facultatif).
    assignedToId: zod_1.z.number().int().positive().nullable().optional(),
});
// Bénéficiaires effectifs — pertinents pour un apporteur d'affaire société,
// repris sur la Fiche KYC imprimable. Même schéma que ClientBeneficialOwner.
const referrerBeneficialOwnerSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'Prénom requis'),
    lastName: zod_1.z.string().min(1, 'Nom requis'),
    nationality: zod_1.z.string().optional(),
    idNumber: zod_1.z.string().optional(),
    ownershipPct: zod_1.z.coerce.number().min(0).max(100).nullable().optional(),
    role: zod_1.z.string().optional(),
    isPep: zod_1.z.boolean().optional(),
    notes: zod_1.z.string().optional(),
});
// Sélection légère pour la relation utilisateur référent incluse.
const USER_BRIEF_SELECT = {
    id: true, firstName: true, lastName: true, email: true, role: true,
};
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
    // Échéance héritée rattachée (commission sans convention) — contexte d'affichage.
    installment: {
        select: {
            id: true,
            installmentNumber: true,
            dueDate: true,
            amount: true,
            detailsSouscription: true,
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
            terrain: { select: { id: true, reference: true } },
        },
    },
    user: { select: { id: true, firstName: true, lastName: true, role: true, fonction: true } },
    referrer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
    // Facture d'origine : permet de distinguer une commission d'apport initial.
    invoice: { select: { type: true } },
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
            const userMap = new Map(users.map((u) => [u.id, `${u.lastName} ${u.firstName}`.trim()]));
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
            if (filters.installmentId)
                where.installmentId = filters.installmentId;
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
                    documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } },
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
            // Les commissions de vente / location / souscription sont désormais
            // générées AUTOMATIQUEMENT à l'encaissement (assiette = montant encaissé
            // sur l'échéance ou la facture). Seuls les frais périphériques restent à
            // saisie manuelle.
            if (['VENTE', 'LOCATION', 'SOUSCRIPTION'].includes(d.transactionType)) {
                return {
                    success: false,
                    error: "Les commissions de vente, location et souscription sont générées automatiquement à chaque encaissement (l'assiette est le montant encaissé). La création manuelle n'est possible que pour les frais d'ouverture de dossier et les frais de démarches ACD.",
                };
            }
            // Une commission VENTE/LOCATION/SOUSCRIPTION doit correspondre au type de
            // la convention ; les types « périphériques » FRAIS_DOSSIER et
            // FRAIS_DEMARCHES_ACD sont admis quelle que soit la convention éligible.
            const naturalType = convention.type === 'SALE' ? 'VENTE'
                : convention.type === 'SOUSCRIPTION' ? 'SOUSCRIPTION'
                    : 'LOCATION';
            const isPeripheralType = d.transactionType === 'FRAIS_DOSSIER'
                || d.transactionType === 'FRAIS_DEMARCHES_ACD';
            if (!isPeripheralType && d.transactionType !== naturalType) {
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
            // Garde-fou métier : un même type de commission ne peut pas être appliqué
            // plus d'une fois sur une même convention pour le même bénéficiaire (les
            // commissions annulées ne comptent pas — on peut en recréer une).
            const duplicate = await db.commission.findFirst({
                where: {
                    conventionId: d.conventionId,
                    transactionType: d.transactionType,
                    deletedAt: null,
                    status: { not: 'ANNULEE' },
                    ...(d.beneficiaryType === 'USER'
                        ? { beneficiaryType: 'USER', userId: d.userId }
                        : { beneficiaryType: 'REFERRER', referrerId: d.referrerId }),
                },
                select: { reference: true },
            });
            if (duplicate) {
                return {
                    success: false,
                    error: `Une commission ${d.transactionType} existe déjà sur cette convention pour ce bénéficiaire (${duplicate.reference}).`,
                };
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
    /* ─── Commissions sur échéances héritées (sans convention) ───────── */
    // Contexte de pré-remplissage : échéance, client, utilisateur référent du
    // client, taux par défaut, et types de commission déjà passés sur l'échéance
    // (pour bloquer les doublons côté UI).
    electron_1.ipcMain.handle('commissions:prepareInstallmentCommission', async (_event, { token, installmentId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const installment = await db.saleInstallment.findUnique({
                where: { id: installmentId },
                select: {
                    id: true, installmentNumber: true, dueDate: true, amount: true,
                    paidAmount: true, status: true,
                    conventionId: true, detailsSouscription: true,
                    client: {
                        select: {
                            id: true, firstName: true, lastName: true, entreprise: true, type: true,
                            assignedTo: { select: { id: true, firstName: true, lastName: true, fonction: true, role: true } },
                        },
                    },
                    terrain: { select: { id: true, reference: true } },
                    terrainLinks: {
                        orderBy: { order: 'asc' },
                        select: {
                            terrain: { select: { id: true, reference: true, acdDemarchesEnabled: true, acdDemarchesAmount: true } },
                        },
                    },
                },
            });
            if (!installment)
                return { success: false, error: 'Échéance introuvable' };
            if (installment.conventionId) {
                return { success: false, error: 'Cette échéance est rattachée à une convention : gérez sa commission via la convention.' };
            }
            // Types de commission déjà actifs (non annulés) sur cette échéance.
            const existing = await db.commission.findMany({
                where: { installmentId, deletedAt: null, status: { not: 'ANNULEE' } },
                select: { transactionType: true },
            });
            const rates = await (0, commission_service_1.getDefaultRates)(db);
            // Assiette des frais de démarches ACD = somme des frais ACD des terrains rattachés.
            const acdBase = installment.terrainLinks.reduce((s, l) => s + Number(l.terrain?.acdDemarchesAmount ?? 0), 0);
            return ser({
                success: true,
                data: {
                    installment,
                    referentUser: installment.client?.assignedTo ?? null,
                    rates,
                    acdBase,
                    terrains: installment.terrainLinks.map((l) => l.terrain),
                    existingTypes: existing.map((e) => e.transactionType),
                },
            });
        }
        catch (error) {
            logger_1.default.error('commissions:prepareInstallmentCommission error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:createForInstallment', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCommissionWriteRole(session, WRITE_ROLES);
            const parsed = createInstallmentCommissionSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const installment = await db.saleInstallment.findUnique({
                where: { id: d.installmentId },
                select: {
                    id: true, amount: true, paidAmount: true, status: true, conventionId: true,
                    client: { select: { id: true, assignedToId: true } },
                    terrainLinks: { select: { terrain: { select: { acdDemarchesAmount: true } } } },
                },
            });
            if (!installment)
                return { success: false, error: 'Échéance introuvable' };
            if (installment.conventionId) {
                return { success: false, error: 'Cette échéance est rattachée à une convention.' };
            }
            // Bénéficiaire : utilisateur référent du client (override possible).
            const userId = d.userId ?? installment.client?.assignedToId ?? null;
            if (!userId) {
                return { success: false, error: "Le client de cette échéance n'a pas d'utilisateur référent. Affectez un référent au client ou choisissez un bénéficiaire." };
            }
            const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
            if (!user)
                return { success: false, error: 'Utilisateur référent introuvable' };
            // Un même type de commission ne peut être passé qu'une seule fois sur
            // l'échéance (les commissions annulées ne comptent pas).
            const duplicate = await db.commission.findFirst({
                where: {
                    installmentId: d.installmentId,
                    transactionType: d.transactionType,
                    deletedAt: null,
                    status: { not: 'ANNULEE' },
                },
                select: { reference: true },
            });
            if (duplicate) {
                return {
                    success: false,
                    error: `Une commission ${d.transactionType} existe déjà sur cette échéance (${duplicate.reference}).`,
                };
            }
            // Assiette selon le type :
            //  - FRAIS_DEMARCHES_ACD → somme des frais ACD des terrains rattachés ;
            //  - SOUSCRIPTION        → montant encaissé (payé ou partiellement payé) :
            //    l'échéance doit donc être PAYE ou PARTIEL ;
            //  - autres types        → assiette fournie ou montant de l'échéance.
            let baseAmount;
            if (d.transactionType === 'FRAIS_DEMARCHES_ACD') {
                baseAmount = installment.terrainLinks.reduce((s, l) => s + Number(l.terrain?.acdDemarchesAmount ?? 0), 0);
                if (!(baseAmount > 0)) {
                    return { success: false, error: 'Aucun frais de démarches ACD sur les terrains rattachés. Rattachez un terrain disposant de frais ACD à cette échéance.' };
                }
            }
            else if (d.transactionType === 'SOUSCRIPTION') {
                if (installment.status !== 'PAYE' && installment.status !== 'PARTIEL') {
                    return { success: false, error: "Une commission de souscription requiert une échéance payée ou partiellement payée (l'assiette est le montant encaissé)." };
                }
                baseAmount = Number(installment.paidAmount);
                if (!(baseAmount > 0)) {
                    return { success: false, error: "Aucun montant encaissé sur cette échéance : impossible de baser la commission de souscription." };
                }
            }
            else {
                baseAmount = d.baseAmount ?? Number(installment.amount);
            }
            if (!(baseAmount > 0))
                return { success: false, error: 'Assiette de commission invalide' };
            const amount = (0, commission_service_1.computeCommissionAmount)(baseAmount, d.rate);
            const reference = await (0, commission_service_1.nextCommissionRef)(db);
            const commission = await db.commission.create({
                data: {
                    reference,
                    conventionId: null,
                    installmentId: d.installmentId,
                    beneficiaryType: 'USER',
                    userId,
                    referrerId: null,
                    transactionType: d.transactionType,
                    baseAmount: baseAmount,
                    rate: d.rate,
                    amount: amount,
                    status: 'A_PAYER',
                    source: 'MANUEL',
                    notes: d.notes,
                },
                include: commissionInclude,
            });
            logger_1.default.info(`Commission héritée créée: ${commission.reference} (échéance #${d.installmentId})`);
            return ser({ success: true, data: commission });
        }
        catch (error) {
            logger_1.default.error('commissions:createForInstallment error', error.message);
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
    /* ─── Modification d'une commission ──────────────────────────────── */
    electron_1.ipcMain.handle('commissions:update', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkCommissionWriteRole(session, WRITE_ROLES);
            const parsed = updateCommissionSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const commission = await db.commission.findUnique({
                where: { id: d.id },
                select: { id: true, status: true, deletedAt: true },
            });
            if (!commission || commission.deletedAt)
                return { success: false, error: 'Commission introuvable' };
            // Seules les commissions encore à payer sont modifiables — une commission
            // déjà réglée ou annulée est figée (passer par une annulation pour reprise).
            if (commission.status !== 'A_PAYER') {
                return {
                    success: false,
                    error: 'Seule une commission encore à payer peut être modifiée (statut requis : « À payer »).',
                };
            }
            const amount = (0, commission_service_1.computeCommissionAmount)(d.baseAmount, d.rate);
            const updated = await db.commission.update({
                where: { id: d.id },
                data: {
                    baseAmount: d.baseAmount,
                    rate: d.rate,
                    amount: amount,
                    notes: d.notes,
                },
                include: commissionInclude,
            });
            logger_1.default.info(`Commission modifiée: id=${d.id} par user=${session.userId}`);
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('commissions:update error', error.message);
            return { success: false, error: error.message };
        }
    });
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
            // Commissions d'un apporteur d'affaire : réservées à la vue complète des
            // apporteurs (SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT) — les autres rôles,
            // même s'ils sont l'utilisateur référent de l'apporteur, n'y ont pas accès.
            if (beneficiaryType === 'REFERRER') {
                checkExactRole(session, REFERRERS_FULL_VIEW_ROLES);
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
            // Consultation ouverte à tous les rôles authentifiés : vue complète pour
            // REFERRERS_FULL_VIEW_ROLES, restreinte aux apporteurs dont l'utilisateur
            // est le référent pour les autres (cf. referrerScopeWhere).
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...referrerScopeWhere(session) };
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
                    include: {
                        _count: { select: { commissions: true } },
                        assignedTo: { select: USER_BRIEF_SELECT },
                    },
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
            const db = (0, db_service_1.getDb)();
            const referrer = await db.businessReferrer.findUnique({
                where: { id },
                include: {
                    documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } },
                    assignedTo: { select: USER_BRIEF_SELECT },
                    _count: { select: { commissions: true } },
                    beneficialOwners: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
                },
            });
            if (!referrer || referrer.deletedAt)
                return { success: false, error: 'Apporteur d\'affaire introuvable' };
            if (!REFERRERS_FULL_VIEW_ROLES.includes(session.role) && referrer.assignedToId !== session.userId) {
                return { success: false, error: 'Apporteur d\'affaire inaccessible' };
            }
            return ser({ success: true, data: referrer });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Fiche de suivi chronologique ────────────────────────────────────
    electron_1.ipcMain.handle('commissions:getReferrerTimeline', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const referrer = await db.businessReferrer.findUnique({
                where: { id, deletedAt: null },
                select: { id: true, createdAt: true, assignedToId: true },
            });
            if (!referrer)
                return { success: false, error: 'Apporteur d\'affaire introuvable' };
            if (!REFERRERS_FULL_VIEW_ROLES.includes(session.role) && referrer.assignedToId !== session.userId) {
                return { success: false, error: 'Apporteur d\'affaire inaccessible' };
            }
            const timeline = await (0, timeline_service_1.buildEntityTimeline)(db, 'REFERRER', id, referrer.createdAt);
            return { success: true, data: ser(timeline) };
        }
        catch (error) {
            logger_1.default.error('commissions:getReferrerTimeline error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:createReferrer', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, REFERRERS_WRITE_ROLES);
            const parsed = referrerSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            if (d.kycSignedAt)
                d.kycSignedAt = new Date(d.kycSignedAt);
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
            checkExactRole(session, REFERRERS_WRITE_ROLES);
            const parsed = referrerSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const before = await db.businessReferrer.findUnique({ where: { id } });
            if (!before)
                return { success: false, error: 'Apporteur d\'affaire introuvable' };
            const d = parsed.data;
            const data = { ...d };
            if (d.email !== undefined)
                data.email = d.email || null;
            if (data.kycSignedAt)
                data.kycSignedAt = new Date(data.kycSignedAt);
            const referrer = await db.businessReferrer.update({ where: { id }, data });
            const changedFields = (0, timeline_service_1.diffChangedFields)(before, data);
            if (changedFields.length) {
                await (0, timeline_service_1.recordModification)(db, {
                    entityType: 'REFERRER', entityId: id,
                    changedFields, labels: timeline_service_1.REFERRER_FIELD_LABELS, userId: session.userId,
                });
            }
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
            checkExactRole(session, REFERRERS_DELETE_ROLES);
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
    // ── Bénéficiaires effectifs (apporteur d'affaire société) ──────────────────
    electron_1.ipcMain.handle('commissions:referrerBeneficialOwners:create', async (_event, { token, referrerId, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, REFERRERS_WRITE_ROLES);
            const parsed = referrerBeneficialOwnerSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const referrer = await db.businessReferrer.findFirst({ where: { id: Number(referrerId), deletedAt: null } });
            if (!referrer)
                return { success: false, error: 'Apporteur d\'affaire introuvable' };
            const bo = await db.referrerBeneficialOwner.create({ data: { ...parsed.data, referrerId: referrer.id } });
            return ser({ success: true, data: bo });
        }
        catch (error) {
            logger_1.default.error('commissions:referrerBeneficialOwners:create', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:referrerBeneficialOwners:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, REFERRERS_WRITE_ROLES);
            const parsed = referrerBeneficialOwnerSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const bo = await db.referrerBeneficialOwner.update({ where: { id: Number(id) }, data: parsed.data });
            return ser({ success: true, data: bo });
        }
        catch (error) {
            logger_1.default.error('commissions:referrerBeneficialOwners:update', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:referrerBeneficialOwners:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, REFERRERS_WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.referrerBeneficialOwner.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('commissions:referrerBeneficialOwners:delete', error.message);
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
                orderBy: { id: 'asc' },
            });
            return ser({ success: true, data: users });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('commissions:listEligibleConventions', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            // Une convention peut désormais porter plusieurs biens OU plusieurs
            // terrains (relations 1-N via ConventionProperty / ConventionTerrain).
            // On expose la première référence rattachée — suffisant pour identifier
            // la convention dans le sélecteur du formulaire de commission.
            // Filtrage métier (formulaire de commission) :
            //   - statut ACTIVE ou EXPIRE uniquement (une convention en brouillon,
            //     en attente, annulée ou terminée n'est plus éligible à génération
            //     de commission) ;
            //   - rattachée au bénéficiaire sélectionné (utilisateur référent ou
            //     apporteur d'affaire). Sans bénéficiaire, on renvoie une liste
            //     vide : l'utilisateur choisit d'abord le bénéficiaire.
            const userId = filters.userId ? Number(filters.userId) : null;
            const referrerId = filters.referrerId ? Number(filters.referrerId) : null;
            if (!userId && !referrerId) {
                return { success: true, data: [] };
            }
            const conventions = await db.convention.findMany({
                where: {
                    deletedAt: null,
                    status: { in: ['ACTIVE', 'EXPIRE'] },
                    type: { in: ['SALE', 'SOUSCRIPTION', 'RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'COMMERCIAL_LEASE'] },
                    ...(userId ? { agentId: userId } : {}),
                    ...(referrerId ? { referrerId } : {}),
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    reference: true,
                    type: true,
                    assetType: true,
                    saleAmount: true,
                    rentAmount: true,
                    fraisOuvertureDossier: true,
                    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                    properties: {
                        orderBy: { order: 'asc' },
                        select: { property: { select: { id: true, reference: true } } },
                    },
                    terrains: {
                        orderBy: { order: 'asc' },
                        select: {
                            terrain: {
                                select: {
                                    id: true,
                                    reference: true,
                                    // `acdDemarchesEnabled` indique si le client a confié les
                                    // démarches ACD à l'entreprise sur ce terrain. Une commission
                                    // FRAIS_DEMARCHES_ACD n'est éligible que si au moins un terrain
                                    // rattaché à la convention porte cette option.
                                    acdDemarchesEnabled: true,
                                    // Le lotissement porte le montant standard des frais de
                                    // démarches ACD — assiette par défaut d'une commission de
                                    // type FRAIS_DEMARCHES_ACD.
                                    lotissement: { select: { id: true, fraisDemarchesAcdStandard: true } },
                                },
                            },
                        },
                    },
                },
            });
            // Aplatit la première référence rattachée pour conserver la forme
            // attendue par l'UI (`convention.property?.reference`), remonte au
            // niveau racine le montant ACD du premier lotissement rattaché, et
            // expose la flag `hasAcdDemarches` (vrai dès qu'au moins un terrain
            // rattaché a l'option ACD activée).
            const enriched = conventions.map((c) => {
                const firstProperty = c.properties[0]?.property ?? null;
                const firstTerrain = c.terrains[0]?.terrain ?? null;
                const lotissementAcd = firstTerrain?.lotissement?.fraisDemarchesAcdStandard ?? null;
                const hasAcdDemarches = c.terrains.some((l) => l.terrain?.acdDemarchesEnabled === true);
                return {
                    ...c,
                    property: firstProperty ?? firstTerrain,
                    lotissementFraisDemarchesAcdStandard: lotissementAcd,
                    hasAcdDemarches,
                };
            });
            // Filtrage des conventions de SOUSCRIPTION déjà entièrement « traitées »
            // pour le bénéficiaire courant : si toutes les commissions attendues
            // (SOUSCRIPTION, FRAIS_DOSSIER, et FRAIS_DEMARCHES_ACD si l'option ACD
            // est activée) ont déjà été générées pour ce bénéficiaire (et ne sont
            // pas annulées), on retire la convention de la liste — il n'y a plus
            // rien à traiter dessus pour lui.
            const souscriptionIds = enriched.filter((c) => c.type === 'SOUSCRIPTION').map((c) => c.id);
            let data = enriched;
            if (souscriptionIds.length > 0) {
                const existing = await db.commission.findMany({
                    where: {
                        conventionId: { in: souscriptionIds },
                        deletedAt: null,
                        status: { not: 'ANNULEE' },
                        ...(userId ? { beneficiaryType: 'USER', userId } : {}),
                        ...(referrerId ? { beneficiaryType: 'REFERRER', referrerId } : {}),
                    },
                    select: { conventionId: true, transactionType: true },
                });
                const treated = new Map();
                for (const e of existing) {
                    if (e.conventionId == null)
                        continue; // filtré sur conventionId in [...], jamais null ici
                    if (!treated.has(e.conventionId))
                        treated.set(e.conventionId, new Set());
                    treated.get(e.conventionId).add(e.transactionType);
                }
                data = enriched.filter((c) => {
                    if (c.type !== 'SOUSCRIPTION')
                        return true;
                    const required = ['SOUSCRIPTION', 'FRAIS_DOSSIER'];
                    if (c.hasAcdDemarches)
                        required.push('FRAIS_DEMARCHES_ACD');
                    const done = treated.get(c.id) ?? new Set();
                    // Garde la convention tant qu'au moins un type requis n'a pas été traité.
                    return !required.every((t) => done.has(t));
                });
            }
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('commissions:listEligibleConventions error', error.message);
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
