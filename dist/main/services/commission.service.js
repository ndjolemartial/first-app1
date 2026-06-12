"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETTING_RATE_DOSSIER = exports.SETTING_RATE_RENTAL = exports.SETTING_RATE_SALE = void 0;
exports.isCommissionEligibleConvention = isCommissionEligibleConvention;
exports.nextCommissionRef = nextCommissionRef;
exports.getDefaultRates = getDefaultRates;
exports.setDefaultRates = setDefaultRates;
exports.getCommissionBase = getCommissionBase;
exports.computeCommissionAmount = computeCommissionAmount;
exports.commissionTypeAndRate = commissionTypeAndRate;
exports.accrueCollectionCommission = accrueCollectionCommission;
exports.autoGenerateConventionCommission = autoGenerateConventionCommission;
const logger_1 = __importDefault(require("../utils/logger"));
/** Clés AppSetting des taux de commission par défaut. */
exports.SETTING_RATE_SALE = 'commission.defaultRateSale';
exports.SETTING_RATE_RENTAL = 'commission.defaultRateRental';
exports.SETTING_RATE_DOSSIER = 'commission.defaultRateDossier';
/** Taux par défaut appliqués si aucun paramètre n'est défini en base. */
const FALLBACK_RATE_SALE = 5;
const FALLBACK_RATE_RENTAL = 50;
const FALLBACK_RATE_DOSSIER = 10;
/** Types de conventions de location éligibles à une commission. */
const RENTAL_CONVENTION_TYPES = ['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'COMMERCIAL_LEASE'];
/** Vrai si le type de convention est éligible à une commission (vente, location ou souscription). */
function isCommissionEligibleConvention(type) {
    return type === 'SALE' || type === 'SOUSCRIPTION' || RENTAL_CONVENTION_TYPES.includes(type);
}
/**
 * Génère la prochaine référence de commission : COM-YYYY-NNNN
 */
async function nextCommissionRef(db) {
    const year = new Date().getFullYear();
    const last = await db.commission.findFirst({
        where: { reference: { startsWith: `COM-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `COM-${year}-${String(seq).padStart(4, '0')}`;
}
/**
 * Récupère les taux de commission par défaut configurés (vente / location).
 */
async function getDefaultRates(db) {
    const settings = await db.appSetting.findMany({
        where: { key: { in: [exports.SETTING_RATE_SALE, exports.SETTING_RATE_RENTAL, exports.SETTING_RATE_DOSSIER] } },
    });
    const map = new Map(settings.map((s) => [s.key, s.value]));
    const saleRate = Number(map.get(exports.SETTING_RATE_SALE));
    const rentalRate = Number(map.get(exports.SETTING_RATE_RENTAL));
    const dossierRate = Number(map.get(exports.SETTING_RATE_DOSSIER));
    return {
        saleRate: Number.isFinite(saleRate) ? saleRate : FALLBACK_RATE_SALE,
        rentalRate: Number.isFinite(rentalRate) ? rentalRate : FALLBACK_RATE_RENTAL,
        dossierRate: Number.isFinite(dossierRate) ? dossierRate : FALLBACK_RATE_DOSSIER,
    };
}
/**
 * Enregistre les taux de commission par défaut.
 */
async function setDefaultRates(db, rates) {
    await db.$transaction([
        db.appSetting.upsert({
            where: { key: exports.SETTING_RATE_SALE },
            create: { key: exports.SETTING_RATE_SALE, value: String(rates.saleRate) },
            update: { value: String(rates.saleRate) },
        }),
        db.appSetting.upsert({
            where: { key: exports.SETTING_RATE_RENTAL },
            create: { key: exports.SETTING_RATE_RENTAL, value: String(rates.rentalRate) },
            update: { value: String(rates.rentalRate) },
        }),
        db.appSetting.upsert({
            where: { key: exports.SETTING_RATE_DOSSIER },
            create: { key: exports.SETTING_RATE_DOSSIER, value: String(rates.dossierRate) },
            update: { value: String(rates.dossierRate) },
        }),
    ]);
}
/**
 * Détermine l'assiette de commission d'une convention selon son type.
 * - Vente (SALE)             → assiette = prix de vente
 * - Souscription             → assiette = montant de la souscription (prix de vente)
 * - Location (RENTAL_*)      → assiette = un mois de loyer
 * - Gestion (MANAGEMENT)     → non éligible
 */
function getCommissionBase(convention) {
    if (convention.type === 'SALE') {
        const base = Number(convention.saleAmount ?? 0);
        if (base <= 0)
            return null;
        return { transactionType: 'VENTE', baseAmount: base };
    }
    if (convention.type === 'SOUSCRIPTION') {
        const base = Number(convention.saleAmount ?? 0);
        if (base <= 0)
            return null;
        return { transactionType: 'SOUSCRIPTION', baseAmount: base };
    }
    if (RENTAL_CONVENTION_TYPES.includes(convention.type)) {
        const base = Number(convention.rentAmount ?? 0);
        if (base <= 0)
            return null;
        return { transactionType: 'LOCATION', baseAmount: base };
    }
    return null;
}
/** Calcule un montant de commission arrondi à 2 décimales. */
function computeCommissionAmount(baseAmount, rate) {
    return Math.round(baseAmount * (rate / 100) * 100) / 100;
}
/**
 * Type de commission et taux par défaut applicables à un type de convention.
 * Renvoie null si le type n'est pas éligible à une commission.
 */
function commissionTypeAndRate(conventionType, rates) {
    if (conventionType === 'SALE')
        return { transactionType: 'VENTE', rate: rates.saleRate };
    if (conventionType === 'SOUSCRIPTION')
        return { transactionType: 'SOUSCRIPTION', rate: rates.saleRate };
    if (RENTAL_CONVENTION_TYPES.includes(conventionType))
        return { transactionType: 'LOCATION', rate: rates.rentalRate };
    return null;
}
/**
 * Accrual de commission sur encaissement.
 *
 * Modèle : l'assiette d'une commission est le montant RÉELLEMENT ENCAISSÉ sur
 * l'échéance ou la facture — et non le coût total du bien. À chaque encaissement
 * (paiement total ou partiel), on aligne (ou on crée) la commission « à payer »
 * de l'unité concernée sur le cumul encaissé.
 *
 * Règle : une seule commission « ouverte » (A_PAYER) par unité (échéance OU
 * facture) et par bénéficiaire. Son assiette = cumul encaissé − assiette déjà
 * verrouillée par d'éventuelles commissions DÉJÀ PAYÉES sur la même unité (ce
 * qui couvre le cas d'un encaissement complémentaire survenu après un premier
 * versement de commission : une nouvelle commission ouverte est alors créée
 * pour le delta).
 *
 * Idempotent (basé sur le cumul encaissé) et conçu pour être appelé HORS de la
 * transaction d'encaissement, en try/catch : un échec d'accrual ne doit jamais
 * annuler l'encaissement lui-même.
 */
async function accrueCollectionCommission(db, params) {
    const { conventionId, installmentId, invoiceId, beneficiaryUserId, transactionType, rate } = params;
    const collectedTotal = Math.round(params.collectedTotal * 100) / 100;
    if (!(collectedTotal > 0) || !beneficiaryUserId)
        return;
    // Clé d'unité : échéance prioritaire, sinon facture.
    const unitWhere = installmentId
        ? { installmentId }
        : invoiceId
            ? { invoiceId }
            : null;
    if (!unitWhere)
        return;
    // Anti-doublon avec une commission MANUELLE pré-existante de même nature sur la
    // convention (ex. données héritées, ou commission saisie avant ce modèle) :
    // dans ce cas la commission manuelle fait foi, on n'accumule pas en plus.
    if (conventionId) {
        const manual = await db.commission.findFirst({
            where: {
                conventionId,
                transactionType,
                beneficiaryType: 'USER',
                userId: beneficiaryUserId,
                source: 'MANUEL',
                deletedAt: null,
                status: { not: 'ANNULEE' },
            },
            select: { id: true },
        });
        if (manual)
            return;
    }
    const existing = await db.commission.findMany({
        where: {
            ...unitWhere,
            beneficiaryType: 'USER',
            userId: beneficiaryUserId,
            transactionType,
            source: 'AUTOMATIQUE',
            deletedAt: null,
            status: { not: 'ANNULEE' },
        },
        select: { id: true, status: true, baseAmount: true },
    });
    const lockedBase = existing
        .filter((c) => c.status === 'PAYEE')
        .reduce((s, c) => s + Number(c.baseAmount), 0);
    const open = existing.find((c) => c.status === 'A_PAYER') ?? null;
    const desiredOpenBase = Math.round((collectedTotal - lockedBase) * 100) / 100;
    // Tout l'encaissé est déjà couvert par des commissions payées : rien à faire.
    if (desiredOpenBase <= 0)
        return;
    const amount = computeCommissionAmount(desiredOpenBase, rate);
    if (open) {
        await db.commission.update({
            where: { id: open.id },
            data: { baseAmount: desiredOpenBase, rate: rate, amount: amount },
        });
        logger_1.default.info(`Commission accrual mis à jour: #${open.id} assiette=${desiredOpenBase} (${unitWhere ? Object.keys(unitWhere)[0] : ''})`);
    }
    else {
        const reference = await nextCommissionRef(db);
        const created = await db.commission.create({
            data: {
                reference,
                conventionId: conventionId ?? null,
                installmentId: installmentId ?? null,
                invoiceId: invoiceId ?? null,
                beneficiaryType: 'USER',
                userId: beneficiaryUserId,
                transactionType,
                baseAmount: desiredOpenBase,
                rate: rate,
                amount: amount,
                status: 'A_PAYER',
                source: 'AUTOMATIQUE',
            },
            select: { id: true, reference: true },
        });
        logger_1.default.info(`Commission accrual créée: ${created.reference} assiette=${desiredOpenBase}`);
    }
}
/**
 * Génère automatiquement la commission de l'agent à l'activation d'une convention.
 *
 * La commission n'est créée que si la convention possède un agent, qu'elle est
 * éligible (vente ou location) et qu'aucune commission active n'existe déjà
 * pour cet agent sur cette convention. Toute erreur est journalisée sans être
 * propagée, afin de ne jamais bloquer l'activation de la convention.
 *
 * @returns la commission créée, ou null si aucune génération n'a eu lieu.
 */
async function autoGenerateConventionCommission(db, conventionId) {
    try {
        const convention = await db.convention.findUnique({
            where: { id: conventionId },
            select: { id: true, type: true, agentId: true, saleAmount: true, rentAmount: true },
        });
        if (!convention || !convention.agentId)
            return null;
        const base = getCommissionBase(convention);
        if (!base)
            return null;
        // Évite les doublons : une seule commission auto par agent et par convention.
        const existing = await db.commission.findFirst({
            where: {
                conventionId,
                userId: convention.agentId,
                beneficiaryType: 'USER',
                status: { not: 'ANNULEE' },
                deletedAt: null,
            },
            select: { id: true },
        });
        if (existing)
            return null;
        const rates = await getDefaultRates(db);
        // Vente et souscription partagent le taux de vente ; la location a le sien.
        const rate = base.transactionType === 'LOCATION' ? rates.rentalRate : rates.saleRate;
        const amount = computeCommissionAmount(base.baseAmount, rate);
        const reference = await nextCommissionRef(db);
        const commission = await db.commission.create({
            data: {
                reference,
                conventionId,
                beneficiaryType: 'USER',
                userId: convention.agentId,
                transactionType: base.transactionType,
                baseAmount: base.baseAmount,
                rate: rate,
                amount: amount,
                status: 'A_PAYER',
                source: 'AUTOMATIQUE',
            },
            select: { id: true, reference: true },
        });
        logger_1.default.info(`Commission auto-générée: ${commission.reference} (convention #${conventionId})`);
        return commission;
    }
    catch (error) {
        logger_1.default.error('autoGenerateConventionCommission error', error?.message ?? error);
        return null;
    }
}
