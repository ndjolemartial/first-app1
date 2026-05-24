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
