"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnalyticsIPC = registerAnalyticsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const treasury_service_1 = require("../services/treasury.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Module Analyses décisionnelles (Business Intelligence) — lecture seule,
 * réservé aux administrateurs (SUPER_ADMIN, ADMIN). Agrège les données de
 * l'ensemble de l'application : exécutif, finance, portefeuille, CRM, charges,
 * contractuel, risques et recommandations.
 */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
// CRM & Clients, Suivi Prospects & Clients et Statistiques visiteurs sont
// également ouverts en plein accès au rôle MANAGER (décision produit). Rôle
// exact (pas `checkRole`) pour éviter que l'équivalence ACCOUNTANT/
// ASSISTANTE_DIRECTION → MANAGER n'étende cet accès à ces deux rôles.
const MANAGER_FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const ser = (v) => JSON.parse(JSON.stringify(v));
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
/** Buckets mensuels [start, end[ sur `count` mois jusqu'au mois courant inclus. */
function monthBuckets(now, count) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        out.push({ label: `${MOIS[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`, start, end });
    }
    return out;
}
/** Montant réellement encaissé sur [start, end[ (paiements + factures PAYEE directes). */
async function computeEncaisse(db, start, end) {
    const [pay, direct] = await Promise.all([
        db.payment.aggregate({ where: { paidAt: { gte: start, lt: end }, invoice: { deletedAt: null } }, _sum: { amount: true } }),
        db.invoice.aggregate({ where: { deletedAt: null, status: 'PAYEE', paidAt: { gte: start, lt: end }, payments: { none: {} } }, _sum: { total: true } }),
    ]);
    return Number(pay._sum.amount ?? 0) + Number(direct._sum.total ?? 0);
}
/** Décaissements (sorties de trésorerie) sur [start, end[. */
async function computeDecaisse(db, start, end) {
    const agg = await db.treasuryOperation.aggregate({
        where: { direction: 'SORTIE', deletedAt: null, operationDate: { gte: start, lt: end } },
        _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
}
/**
 * Entrées de trésorerie sur [start, end[ comptabilisées en recettes.
 *
 * Les entrées sur les comptes « Caisse interne » (type `CAISSE_CENTRALE`) sont
 * exclues : ce sont de simples déplacements de fonds internes à l'entreprise et
 * non du chiffre d'affaires. (Leurs sorties gardent leur rôle normal de dépenses.)
 */
async function computeEntrees(db, start, end) {
    const agg = await db.treasuryOperation.aggregate({
        where: {
            direction: 'ENTREE',
            deletedAt: null,
            operationDate: { gte: start, lt: end },
            bankAccount: { type: { not: 'CAISSE_CENTRALE' } },
        },
        _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
}
/** Montant des factures impayées (validées/partielles/en retard) : total − encaissé. */
async function computeUnpaidInvoices(db) {
    const invoices = await db.invoice.findMany({
        where: { deletedAt: null, status: { in: ['VALIDEE', 'PARTIEL', 'EN_RETARD'] } },
        select: { total: true, payments: { select: { amount: true } } },
    });
    let amount = 0;
    for (const inv of invoices) {
        const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
        amount += Math.max(0, Number(inv.total) - paid);
    }
    return { amount, count: invoices.length };
}
/** Échéances de vente non soldées : reste dû = amount − paidAmount. */
async function outstandingInstallments(db) {
    const list = await db.saleInstallment.findMany({
        where: { conventionId: { not: null }, status: { in: ['EN_ATTENTE', 'A_REGLER', 'PARTIEL', 'EN_RETARD'] } },
        select: { amount: true, paidAmount: true, status: true },
    });
    let amount = 0, overdueAmount = 0, overdueCount = 0;
    for (const i of list) {
        const due = Math.max(0, Number(i.amount) - Number(i.paidAmount));
        amount += due;
        if (i.status === 'EN_RETARD') {
            overdueAmount += due;
            overdueCount += 1;
        }
    }
    return { amount, count: list.length, overdueAmount, overdueCount };
}
function guard(token) {
    const session = (0, auth_service_1.getSession)(token);
    if (!session)
        throw new Error('Session expirée');
    (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
    return session;
}
/** Vérifie l'accès en plein accès MANAGER (rôle exact, sans équivalence). */
function guardManagerFullAccess(token) {
    const session = (0, auth_service_1.getSession)(token);
    if (!session)
        throw new Error('Session expirée');
    if (!MANAGER_FULL_ACCESS_ROLES.includes(session.role))
        throw new Error('Permission insuffisante');
    return session;
}
// Suivi Prospects & Clients : en plus du plein accès MANAGER, ouvert en accès
// restreint (périmètre affecté, sans export/impression) à AGENT, AGENT_TECHNIQUE,
// ACCOUNTANT, ASSISTANTE_DIRECTION et READONLY (décision produit).
const FOLLOWUP_ROLES = [
    ...MANAGER_FULL_ACCESS_ROLES,
    'AGENT', 'AGENT_TECHNIQUE', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'READONLY',
];
/** Vérifie l'accès à Suivi Prospects & Clients (rôle exact, sans équivalence). */
function guardFollowUpAccess(token) {
    const session = (0, auth_service_1.getSession)(token);
    if (!session)
        throw new Error('Session expirée');
    if (!FOLLOWUP_ROLES.includes(session.role))
        throw new Error('Permission insuffisante');
    return session;
}
const DAY_MS = 86400000;
/**
 * Classe une durée d'inaction (en jours) selon 3 seuils croissants
 * [t1, t2, t3] : < t1 → Normal, [t1, t2[ → Négligé, [t2, t3[ → Danger de perte,
 * ≥ t3 → Situation critique.
 */
function classifyFollowUp(daysSince, [t1, t2, t3]) {
    if (daysSince < t1)
        return 'NORMAL';
    if (daysSince < t2)
        return 'NEGLIGE';
    if (daysSince < t3)
        return 'DANGER';
    return 'CRITIQUE';
}
// Prospects : Normal < 2 semaines, Négligé jusqu'à 2 mois, Danger de perte
// jusqu'à 3 mois, Situation critique au-delà (mois comptés sur 30 jours).
const PROSPECT_THRESHOLDS = [14, 60, 90];
// Clients : Normal < 3 mois, Négligé jusqu'à 6 mois, Danger de perte jusqu'à
// 9 mois, Situation critique au-delà de 9 mois (décision produit : le palier
// à 12 mois initialement évoqué est abandonné pour ne pas laisser la tranche
// 9-12 mois sans catégorie).
const CLIENT_THRESHOLDS = [90, 180, 270];
function registerAnalyticsIPC() {
    /* ─── 1. Tableau de bord exécutif ──────────────────────────────────── */
    electron_1.ipcMain.handle('analytics:executive', async (_event, { token }) => {
        try {
            guard(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const buckets = monthBuckets(now, 12);
            const caEvolution = [];
            for (const b of buckets)
                caEvolution.push({ label: b.label, encaisse: await computeEncaisse(db, b.start, b.end) });
            const [caYear, caMonth, unpaid, outstanding, activeConv, clientsCount, terrainsDispo, propsDispo, commAgg, accounts, forecastDue] = await Promise.all([
                computeEncaisse(db, yearStart, now),
                computeEncaisse(db, monthStart, monthEnd),
                computeUnpaidInvoices(db),
                outstandingInstallments(db),
                db.convention.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
                db.client.count({ where: { deletedAt: null } }),
                db.terrain.count({ where: { deletedAt: null, statut: 'DISPONIBLE' } }),
                db.property.count({ where: { deletedAt: null, status: 'DISPONIBLE' } }),
                db.commission.aggregate({ where: { deletedAt: null, status: 'A_PAYER' }, _sum: { amount: true }, _count: true }),
                db.bankAccount.findMany({ where: { deletedAt: null }, select: { id: true } }),
                db.forecastExpense.aggregate({ where: { deletedAt: null, status: 'PREVUE' }, _sum: { amount: true }, _count: true }),
            ]);
            const balances = await (0, treasury_service_1.computeBalances)(db, accounts.map((a) => a.id));
            const totalBalance = [...balances.values()].reduce((s, b) => s + b.balance, 0);
            return ser({
                success: true,
                data: {
                    caYear, caMonth,
                    unpaidAmount: unpaid.amount, unpaidCount: unpaid.count,
                    outstandingAmount: outstanding.amount,
                    overdueAmount: outstanding.overdueAmount, overdueCount: outstanding.overdueCount,
                    activeConventions: activeConv,
                    clientsCount,
                    stockDisponible: terrainsDispo + propsDispo,
                    commissionsToPay: Number(commAgg._sum.amount ?? 0), commissionsToPayCount: commAgg._count,
                    treasuryBalance: totalBalance,
                    forecastDue: Number(forecastDue._sum.amount ?? 0), forecastDueCount: forecastDue._count,
                    caEvolution,
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:executive error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 2. Analyse financière & rentabilité ──────────────────────────── */
    electron_1.ipcMain.handle('analytics:financial', async (_event, { token }) => {
        try {
            guard(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const buckets = monthBuckets(now, 12);
            const cashflow = [];
            let totalRecettes = 0, totalDepenses = 0;
            for (const b of buckets) {
                const recettes = await computeEntrees(db, b.start, b.end);
                const depenses = await computeDecaisse(db, b.start, b.end);
                totalRecettes += recettes;
                totalDepenses += depenses;
                cashflow.push({ label: b.label, recettes, depenses, resultat: recettes - depenses });
            }
            const resultat = totalRecettes - totalDepenses;
            const marge = totalRecettes > 0 ? Math.round((resultat / totalRecettes) * 1000) / 10 : 0;
            // Facturé vs encaissé (année) + taux de recouvrement
            const [invoicedAgg, collectedYear] = await Promise.all([
                db.invoice.aggregate({ where: { deletedAt: null, status: { not: 'ANNULEE' }, issueDate: { gte: yearStart } }, _sum: { total: true } }),
                computeEncaisse(db, yearStart, now),
            ]);
            const totalInvoiced = Number(invoicedAgg._sum.total ?? 0);
            const collectionRate = totalInvoiced > 0 ? Math.round((collectedYear / totalInvoiced) * 1000) / 10 : 0;
            // Recettes par type de facture (année)
            const payments = await db.payment.findMany({
                where: { paidAt: { gte: yearStart }, invoice: { deletedAt: null } },
                select: { amount: true, invoice: { select: { type: true } } },
            });
            const byType = {};
            for (const p of payments) {
                const t = p.invoice?.type ?? 'OTHER';
                byType[t] = (byType[t] ?? 0) + Number(p.amount);
            }
            const revenueByType = Object.entries(byType).map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount);
            return ser({
                success: true,
                data: {
                    totalRecettes, totalDepenses, resultat, marge,
                    totalInvoiced, collectedYear, collectionRate,
                    cashflow, revenueByType,
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:financial error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 3. Analyse du portefeuille immobilier ────────────────────────── */
    electron_1.ipcMain.handle('analytics:portfolio', async (_event, { token }) => {
        try {
            guard(token);
            const db = (0, db_service_1.getDb)();
            const [propsByStatus, propsByType, terrainsByStatus, terrainsDispoVal, propsDispoVal, terrainsVenduVal, propsVenduVal, lotissements, programmes] = await Promise.all([
                db.property.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
                db.property.groupBy({ by: ['type'], where: { deletedAt: null }, _count: { _all: true } }),
                db.terrain.groupBy({ by: ['statut'], where: { deletedAt: null }, _count: { _all: true } }),
                db.terrain.aggregate({ where: { deletedAt: null, statut: 'DISPONIBLE' }, _sum: { prixVente: true } }),
                db.property.aggregate({ where: { deletedAt: null, status: 'DISPONIBLE' }, _sum: { salePrice: true } }),
                db.terrain.aggregate({ where: { deletedAt: null, statut: 'VENDU' }, _sum: { prixVente: true } }),
                db.property.aggregate({ where: { deletedAt: null, status: 'VENDU' }, _sum: { salePrice: true } }),
                db.lotissement.count({ where: { deletedAt: null } }),
                db.programmeImmobilier.count({ where: { deletedAt: null } }),
            ]);
            const stockValue = Number(terrainsDispoVal._sum.prixVente ?? 0) + Number(propsDispoVal._sum.salePrice ?? 0);
            const soldValue = Number(terrainsVenduVal._sum.prixVente ?? 0) + Number(propsVenduVal._sum.salePrice ?? 0);
            return ser({
                success: true,
                data: {
                    propsByStatus: propsByStatus.map((g) => ({ key: g.status, count: g._count._all })),
                    propsByType: propsByType.map((g) => ({ key: g.type, count: g._count._all })),
                    terrainsByStatus: terrainsByStatus.map((g) => ({ key: g.statut, count: g._count._all })),
                    stockValue, soldValue, lotissements, programmes,
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:portfolio error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 4. Analyse CRM, souscripteurs & locataires ───────────────────── */
    electron_1.ipcMain.handle('analytics:crm', async (_event, { token }) => {
        try {
            guardManagerFullAccess(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            // Souscripteurs : compte le nombre de terrains/biens souscrits (et non le
            // nombre de conventions) — un client ayant souscrit 2 terrains dans une
            // même convention compte pour 2. Le détail (clic) reste au niveau
            // convention (cf. `analytics:crmDetail`, cas 'souscripteurs').
            const souscripteursWhere = { deletedAt: null, status: 'ACTIVE', type: { in: ['SALE', 'SOUSCRIPTION'] } };
            const [prospectsByStatus, prospectsBySource, prospectsTotal, converted, clientsByType, locataires, souscripteursTerrains, souscripteursProperties, actPending, actOverdue] = await Promise.all([
                db.prospect.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
                db.prospect.groupBy({ by: ['source'], where: { deletedAt: null }, _count: { _all: true } }),
                db.prospect.count({ where: { deletedAt: null } }),
                db.prospect.count({ where: { deletedAt: null, status: 'CONVERTI' } }),
                db.client.groupBy({ by: ['type'], where: { deletedAt: null }, _count: { _all: true } }),
                db.convention.count({ where: { deletedAt: null, status: 'ACTIVE', type: { in: ['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'COMMERCIAL_LEASE'] } } }),
                db.conventionTerrain.count({ where: { convention: souscripteursWhere } }),
                db.conventionProperty.count({ where: { convention: souscripteursWhere } }),
                db.crmActivity.count({ where: { status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] } } }),
                db.crmActivity.count({ where: { status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] }, dueDate: { lt: now } } }),
            ]);
            const souscripteurs = souscripteursTerrains + souscripteursProperties;
            const conversionRate = prospectsTotal > 0 ? Math.round((converted / prospectsTotal) * 1000) / 10 : 0;
            return ser({
                success: true,
                data: {
                    prospectsByStatus: prospectsByStatus.map((g) => ({ key: g.status, count: g._count._all })),
                    prospectsBySource: prospectsBySource.map((g) => ({ key: g.source, count: g._count._all })),
                    prospectsTotal, converted, conversionRate,
                    clientsByType: clientsByType.map((g) => ({ key: g.type, count: g._count._all })),
                    locataires, souscripteurs,
                    activitiesPending: actPending, activitiesOverdue: actOverdue,
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:crm error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 4bis. Détail (liste) d'un indicateur CRM cliqué ──────────────── */
    electron_1.ipcMain.handle('analytics:crmDetail', async (_event, { token, metric, source, page = 1, limit = 10 }) => {
        try {
            guardManagerFullAccess(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const skip = (page - 1) * limit;
            const PROSPECT_SELECT = {
                id: true, reference: true, firstName: true, lastName: true, status: true, source: true,
                createdAt: true, convertedAt: true,
                assignedTo: { select: { firstName: true, lastName: true } },
            };
            const CONVENTION_SELECT = {
                id: true, reference: true, type: true, status: true, saleAmount: true, rentAmount: true,
                signedAt: true, startDate: true,
                client: { select: { firstName: true, lastName: true, entreprise: true, type: true } },
            };
            const ACTIVITY_SELECT = {
                id: true, subject: true, type: true, status: true, dueDate: true,
                user: { select: { firstName: true, lastName: true } },
            };
            switch (metric) {
                case 'prospectsTotal': {
                    const where = { deletedAt: null };
                    const [data, total] = await db.$transaction([
                        db.prospect.findMany({ where, select: PROSPECT_SELECT, skip, take: limit, orderBy: { createdAt: 'desc' } }),
                        db.prospect.count({ where }),
                    ]);
                    return ser({ success: true, entity: 'prospect', data, total });
                }
                case 'converted': {
                    const where = { deletedAt: null, status: 'CONVERTI' };
                    const [data, total] = await db.$transaction([
                        db.prospect.findMany({ where, select: PROSPECT_SELECT, skip, take: limit, orderBy: { convertedAt: 'desc' } }),
                        db.prospect.count({ where }),
                    ]);
                    return ser({ success: true, entity: 'prospect', data, total });
                }
                case 'prospectsBySource': {
                    const where = { deletedAt: null, source };
                    const [data, total] = await db.$transaction([
                        db.prospect.findMany({ where, select: PROSPECT_SELECT, skip, take: limit, orderBy: { createdAt: 'desc' } }),
                        db.prospect.count({ where }),
                    ]);
                    return ser({ success: true, entity: 'prospect', data, total });
                }
                case 'locataires': {
                    const where = { deletedAt: null, status: 'ACTIVE', type: { in: ['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'COMMERCIAL_LEASE'] } };
                    const [data, total] = await db.$transaction([
                        db.convention.findMany({ where, select: CONVENTION_SELECT, skip, take: limit, orderBy: { startDate: 'desc' } }),
                        db.convention.count({ where }),
                    ]);
                    return ser({ success: true, entity: 'convention', data, total });
                }
                case 'souscripteurs': {
                    const where = { deletedAt: null, status: 'ACTIVE', type: { in: ['SALE', 'SOUSCRIPTION'] } };
                    const [data, total] = await db.$transaction([
                        db.convention.findMany({ where, select: CONVENTION_SELECT, skip, take: limit, orderBy: { startDate: 'desc' } }),
                        db.convention.count({ where }),
                    ]);
                    return ser({ success: true, entity: 'convention', data, total });
                }
                case 'activitiesPending': {
                    const where = { status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] } };
                    const [data, total] = await db.$transaction([
                        db.crmActivity.findMany({ where, select: ACTIVITY_SELECT, skip, take: limit, orderBy: { dueDate: 'asc' } }),
                        db.crmActivity.count({ where }),
                    ]);
                    return ser({ success: true, entity: 'activity', data, total });
                }
                case 'activitiesOverdue': {
                    const where = { status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] }, dueDate: { lt: now } };
                    const [data, total] = await db.$transaction([
                        db.crmActivity.findMany({ where, select: ACTIVITY_SELECT, skip, take: limit, orderBy: { dueDate: 'asc' } }),
                        db.crmActivity.count({ where }),
                    ]);
                    return ser({ success: true, entity: 'activity', data, total });
                }
                default:
                    return { success: false, error: 'Métrique inconnue' };
            }
        }
        catch (error) {
            logger_1.default.error('analytics:crmDetail error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 5. Analyse des charges ───────────────────────────────────────── */
    electron_1.ipcMain.handle('analytics:charges', async (_event, { token }) => {
        try {
            guard(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const buckets = monthBuckets(now, 12);
            const depensesEvolution = [];
            for (const b of buckets)
                depensesEvolution.push({ label: b.label, depenses: await computeDecaisse(db, b.start, b.end) });
            // Sorties par objet (catégorie) sur l'année
            const sorties = await db.treasuryOperation.findMany({
                where: { direction: 'SORTIE', deletedAt: null, operationDate: { gte: yearStart } },
                select: { amount: true, category: { select: { label: true } }, label: true },
            });
            const byCat = {};
            for (const op of sorties) {
                const c = op.category?.label ?? op.label ?? 'Divers';
                byCat[c] = (byCat[c] ?? 0) + Number(op.amount);
            }
            const expensesByCategory = Object.entries(byCat).map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount).slice(0, 10);
            const [prevuAgg, regleAgg, overdueForecast] = await Promise.all([
                db.forecastExpense.aggregate({ where: { deletedAt: null, status: 'PREVUE' }, _sum: { amount: true }, _count: true }),
                db.forecastExpense.aggregate({ where: { deletedAt: null, status: 'REGLEE', settledAt: { gte: yearStart } }, _sum: { settledAmount: true }, _count: true }),
                db.forecastExpense.aggregate({ where: { deletedAt: null, status: 'PREVUE', dueDate: { lt: now } }, _sum: { amount: true }, _count: true }),
            ]);
            return ser({
                success: true,
                data: {
                    depensesEvolution, expensesByCategory,
                    forecastPrevu: Number(prevuAgg._sum.amount ?? 0), forecastPrevuCount: prevuAgg._count,
                    forecastRegle: Number(regleAgg._sum.settledAmount ?? 0), forecastRegleCount: regleAgg._count,
                    forecastOverdue: Number(overdueForecast._sum.amount ?? 0), forecastOverdueCount: overdueForecast._count,
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:charges error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 6. Analyse contractuelle ─────────────────────────────────────── */
    electron_1.ipcMain.handle('analytics:contracts', async (_event, { token }) => {
        try {
            guard(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const in90 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90);
            const [byType, byStatus, saleValueAgg, expiring] = await Promise.all([
                db.convention.groupBy({ by: ['type'], where: { deletedAt: null }, _count: { _all: true } }),
                db.convention.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
                db.convention.aggregate({ where: { deletedAt: null, status: 'ACTIVE', type: { in: ['SALE', 'SOUSCRIPTION'] } }, _sum: { saleAmount: true } }),
                db.convention.findMany({
                    where: { deletedAt: null, status: 'ACTIVE', endDate: { gte: now, lte: in90 } },
                    orderBy: { endDate: 'asc' }, take: 12,
                    select: { id: true, reference: true, type: true, endDate: true, client: { select: { firstName: true, lastName: true, entreprise: true } } },
                }),
            ]);
            const outstanding = await outstandingInstallments(db);
            return ser({
                success: true,
                data: {
                    byType: byType.map((g) => ({ key: g.type, count: g._count._all })),
                    byStatus: byStatus.map((g) => ({ key: g.status, count: g._count._all })),
                    totalSaleValue: Number(saleValueAgg._sum.saleAmount ?? 0),
                    installmentsOutstanding: outstanding.amount, installmentsOutstandingCount: outstanding.count,
                    expiring,
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:contracts error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 7. Gestion des risques ───────────────────────────────────────── */
    electron_1.ipcMain.handle('analytics:risk', async (_event, { token }) => {
        try {
            guard(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const in30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
            // Vieillissement des échéances en retard
            const overdue = await db.saleInstallment.findMany({
                where: { conventionId: { not: null }, status: 'EN_RETARD' },
                select: { amount: true, paidAmount: true, dueDate: true },
            });
            const aging = { b0_30: 0, b31_60: 0, b61_90: 0, b90p: 0 };
            let overdueTotal = 0;
            for (const i of overdue) {
                const due = Math.max(0, Number(i.amount) - Number(i.paidAmount));
                overdueTotal += due;
                const days = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
                if (days <= 30)
                    aging.b0_30 += due;
                else if (days <= 60)
                    aging.b31_60 += due;
                else if (days <= 90)
                    aging.b61_90 += due;
                else
                    aging.b90p += due;
            }
            const [unpaid, expiringSoon, forecastOverdue, accounts] = await Promise.all([
                computeUnpaidInvoices(db),
                db.convention.count({ where: { deletedAt: null, status: 'ACTIVE', endDate: { gte: now, lte: in30 } } }),
                db.forecastExpense.aggregate({ where: { deletedAt: null, status: 'PREVUE', dueDate: { lt: now } }, _sum: { amount: true }, _count: true }),
                db.bankAccount.findMany({ where: { deletedAt: null, isActive: true }, select: { id: true, name: true } }),
            ]);
            const balances = await (0, treasury_service_1.computeBalances)(db, accounts.map((a) => a.id));
            const negativeAccounts = accounts
                .map((a) => ({ name: a.name, balance: balances.get(a.id)?.balance ?? 0 }))
                .filter((a) => a.balance < 0);
            return ser({
                success: true,
                data: {
                    overdueTotal, overdueCount: overdue.length, aging,
                    unpaidAmount: unpaid.amount, unpaidCount: unpaid.count,
                    expiringSoon,
                    forecastOverdue: Number(forecastOverdue._sum.amount ?? 0), forecastOverdueCount: forecastOverdue._count,
                    negativeAccounts,
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:risk error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 8. Aide à la décision & recommandations ──────────────────────── */
    electron_1.ipcMain.handle('analytics:recommendations', async (_event, { token }) => {
        try {
            guard(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const yearStart = new Date(now.getFullYear(), 0, 1);
            const in90 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90);
            const [outstanding, unpaid, collectedYear, invoicedAgg, expiring, forecastOverdue, stockTerrains, stockProps, commToPay, accounts] = await Promise.all([
                outstandingInstallments(db),
                computeUnpaidInvoices(db),
                computeEncaisse(db, yearStart, now),
                db.invoice.aggregate({ where: { deletedAt: null, status: { not: 'ANNULEE' }, issueDate: { gte: yearStart } }, _sum: { total: true } }),
                db.convention.count({ where: { deletedAt: null, status: 'ACTIVE', endDate: { gte: now, lte: in90 } } }),
                db.forecastExpense.aggregate({ where: { deletedAt: null, status: 'PREVUE', dueDate: { lt: now } }, _sum: { amount: true }, _count: true }),
                db.terrain.count({ where: { deletedAt: null, statut: 'DISPONIBLE' } }),
                db.property.count({ where: { deletedAt: null, status: 'DISPONIBLE' } }),
                db.commission.aggregate({ where: { deletedAt: null, status: 'A_PAYER' }, _sum: { amount: true }, _count: true }),
                db.bankAccount.findMany({ where: { deletedAt: null }, select: { id: true } }),
            ]);
            const balances = await (0, treasury_service_1.computeBalances)(db, accounts.map((a) => a.id));
            const totalBalance = [...balances.values()].reduce((s, b) => s + b.balance, 0);
            const totalInvoiced = Number(invoicedAgg._sum.total ?? 0);
            const collectionRate = totalInvoiced > 0 ? (collectedYear / totalInvoiced) * 100 : 100;
            const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
            const recos = [];
            if (outstanding.overdueAmount > 0) {
                recos.push({
                    severity: outstanding.overdueAmount > totalBalance ? 'high' : 'medium',
                    domain: 'Recouvrement',
                    title: `${outstanding.overdueCount} échéance(s) en retard — ${fmt(outstanding.overdueAmount)} FCFA`,
                    detail: 'Lancer une campagne de relance et prioriser les retards les plus anciens (voir Gestion des risques).',
                });
            }
            if (collectionRate < 80 && totalInvoiced > 0) {
                recos.push({
                    severity: collectionRate < 60 ? 'high' : 'medium',
                    domain: 'Finance',
                    title: `Taux de recouvrement faible : ${collectionRate.toFixed(0)} %`,
                    detail: 'Le recouvrement est en retard par rapport à la facturation. Renforcer le suivi des paiements.',
                });
            }
            if (unpaid.amount > 0) {
                recos.push({
                    severity: 'medium', domain: 'Finance',
                    title: `${unpaid.count} facture(s) impayée(s) — ${fmt(unpaid.amount)} FCFA`,
                    detail: 'Relancer les clients concernés ; vérifier les factures en retard.',
                });
            }
            if (totalBalance < 0) {
                recos.push({
                    severity: 'high', domain: 'Trésorerie',
                    title: `Trésorerie négative : ${fmt(totalBalance)} FCFA`,
                    detail: 'Solde global des comptes négatif — agir sur les encaissements et reporter les sorties non urgentes.',
                });
            }
            if (forecastOverdue._count > 0) {
                recos.push({
                    severity: 'medium', domain: 'Charges',
                    title: `${forecastOverdue._count} charge(s) prévisionnelle(s) en retard — ${fmt(Number(forecastOverdue._sum.amount ?? 0))} FCFA`,
                    detail: 'Régler ou replanifier les charges dont la date prévue est dépassée.',
                });
            }
            if (expiring > 0) {
                recos.push({
                    severity: 'low', domain: 'Contractuel',
                    title: `${expiring} convention(s) expirent dans les 90 jours`,
                    detail: 'Anticiper les renouvellements ou les sorties pour limiter la vacance.',
                });
            }
            if (commToPay._count > 0) {
                recos.push({
                    severity: 'low', domain: 'Commissions',
                    title: `${commToPay._count} commission(s) à payer — ${fmt(Number(commToPay._sum.amount ?? 0))} FCFA`,
                    detail: 'Planifier le règlement des commissions dues.',
                });
            }
            if (stockTerrains + stockProps > 0) {
                recos.push({
                    severity: 'low', domain: 'Commercial',
                    title: `${stockTerrains + stockProps} bien(s)/terrain(s) disponible(s)`,
                    detail: 'Activer les actions commerciales (prospection, relances) pour écouler le stock disponible.',
                });
            }
            if (recos.length === 0) {
                recos.push({ severity: 'low', domain: 'Global', title: 'Aucune alerte majeure', detail: 'Les indicateurs sont dans les seuils attendus.' });
            }
            return ser({
                success: true,
                data: {
                    summary: {
                        collectionRate: Math.round(collectionRate * 10) / 10,
                        treasuryBalance: totalBalance,
                        overdueAmount: outstanding.overdueAmount,
                        unpaidAmount: unpaid.amount,
                    },
                    recommendations: recos,
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:recommendations error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 9. Suivi prospects & clients (fréquence & plan de relance) ───── */
    electron_1.ipcMain.handle('analytics:followUp', async (_event, { token }) => {
        try {
            const session = guardFollowUpAccess(token);
            const isFullAccess = MANAGER_FULL_ACCESS_ROLES.includes(session.role);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            // Prospects actifs (hors « Perdu »). Rôles restreints : limité aux
            // prospects qui leur sont affectés.
            const prospectWhere = { deletedAt: null, status: { not: 'PERDU' } };
            if (!isFullAccess)
                prospectWhere.assignedToId = session.userId;
            const prospects = await db.prospect.findMany({
                where: prospectWhere,
                select: {
                    id: true, reference: true, firstName: true, lastName: true, status: true, createdAt: true,
                    assignedToId: true,
                    assignedTo: { select: { firstName: true, lastName: true } },
                },
            });
            // Clients actifs (hors « Suspendu »). Rôles restreints : limité aux
            // clients qui leur sont affectés.
            const clientWhere = { deletedAt: null, status: { not: 'SUSPENDU' } };
            if (!isFullAccess)
                clientWhere.assignedToId = session.userId;
            const clients = await db.client.findMany({
                where: clientWhere,
                select: {
                    id: true, reference: true, firstName: true, lastName: true, entreprise: true, type: true, status: true, createdAt: true,
                    assignedToId: true,
                    assignedTo: { select: { firstName: true, lastName: true } },
                },
            });
            // Apporteurs d'affaire actifs. Mêmes règles de fonctionnement et
            // d'accès que le suivi clients : rôles restreints limités aux
            // apporteurs dont ils sont l'utilisateur référent (assignedToId).
            const referrerWhere = { deletedAt: null, isActive: true };
            if (!isFullAccess)
                referrerWhere.assignedToId = session.userId;
            const referrers = await db.businessReferrer.findMany({
                where: referrerWhere,
                select: {
                    id: true, firstName: true, lastName: true, companyName: true, createdAt: true,
                    assignedToId: true,
                    assignedTo: { select: { firstName: true, lastName: true } },
                },
            });
            const prospectIds = prospects.map((p) => p.id);
            const clientIds = clients.map((c) => c.id);
            const referrerIds = referrers.map((r) => r.id);
            // Fréquence des actions de suivi par mois glissant (12 mois), ventilée
            // prospects / clients / apporteurs. Rôles restreints : limitée aux
            // entités de leur périmètre. Les apporteurs n'ayant pas d'activité CRM
            // propre, leurs « actions » agrègent commissions, documents et
            // événements de la fiche de suivi (cf. commissions:getReferrerTimeline).
            const buckets = monthBuckets(now, 12);
            const frequency = [];
            for (const b of buckets) {
                const prospectActWhere = { prospectId: { not: null }, createdAt: { gte: b.start, lt: b.end } };
                const clientActWhere = { clientId: { not: null }, createdAt: { gte: b.start, lt: b.end } };
                const referrerCommissionWhere = { referrerId: { not: null }, deletedAt: null, createdAt: { gte: b.start, lt: b.end } };
                const referrerDocumentWhere = { referrerId: { not: null }, deletedAt: null, uploadedAt: { gte: b.start, lt: b.end } };
                const referrerTimelineWhere = { entityType: 'REFERRER', createdAt: { gte: b.start, lt: b.end } };
                if (!isFullAccess) {
                    prospectActWhere.prospectId = { in: prospectIds.length ? prospectIds : [-1] };
                    clientActWhere.clientId = { in: clientIds.length ? clientIds : [-1] };
                    const scopedReferrerIds = referrerIds.length ? referrerIds : [-1];
                    referrerCommissionWhere.referrerId = { in: scopedReferrerIds };
                    referrerDocumentWhere.referrerId = { in: scopedReferrerIds };
                    referrerTimelineWhere.entityId = { in: scopedReferrerIds };
                }
                const [prospectActions, clientActions, referrerCommissionActions, referrerDocumentActions, referrerTimelineActions] = await Promise.all([
                    db.crmActivity.count({ where: prospectActWhere }),
                    db.crmActivity.count({ where: clientActWhere }),
                    db.commission.count({ where: referrerCommissionWhere }),
                    db.document.count({ where: referrerDocumentWhere }),
                    db.entityTimelineEvent.count({ where: referrerTimelineWhere }),
                ]);
                frequency.push({
                    label: b.label, prospectActions, clientActions,
                    referrerActions: referrerCommissionActions + referrerDocumentActions + referrerTimelineActions,
                });
            }
            // Dernière action CRM connue par prospect / par client.
            const [prospectLastActions, clientLastActions] = await Promise.all([
                db.crmActivity.groupBy({ by: ['prospectId'], where: { prospectId: { not: null } }, _max: { createdAt: true } }),
                db.crmActivity.groupBy({ by: ['clientId'], where: { clientId: { not: null } }, _max: { createdAt: true } }),
            ]);
            const prospectLastActionMap = new Map();
            for (const g of prospectLastActions)
                if (g.prospectId != null && g._max.createdAt)
                    prospectLastActionMap.set(g.prospectId, g._max.createdAt);
            const clientLastActionMap = new Map();
            for (const g of clientLastActions)
                if (g.clientId != null && g._max.createdAt)
                    clientLastActionMap.set(g.clientId, g._max.createdAt);
            // Dernière action connue par apporteur d'affaire : la plus récente
            // parmi ses commissions, ses documents et les événements de sa fiche
            // de suivi.
            const [referrerCommissionLast, referrerDocumentLast, referrerTimelineLast] = await Promise.all([
                db.commission.groupBy({ by: ['referrerId'], where: { referrerId: { not: null }, deletedAt: null }, _max: { createdAt: true } }),
                db.document.groupBy({ by: ['referrerId'], where: { referrerId: { not: null }, deletedAt: null }, _max: { uploadedAt: true } }),
                db.entityTimelineEvent.groupBy({ by: ['entityId'], where: { entityType: 'REFERRER' }, _max: { createdAt: true } }),
            ]);
            const referrerLastActionMap = new Map();
            const bumpLastAction = (id, date) => {
                if (id == null || !date)
                    return;
                const current = referrerLastActionMap.get(id);
                if (!current || date > current)
                    referrerLastActionMap.set(id, date);
            };
            for (const g of referrerCommissionLast)
                bumpLastAction(g.referrerId, g._max.createdAt);
            for (const g of referrerDocumentLast)
                bumpLastAction(g.referrerId, g._max.uploadedAt);
            for (const g of referrerTimelineLast)
                bumpLastAction(g.entityId, g._max.createdAt);
            const prospectItems = prospects.map((p) => {
                const lastActionAt = prospectLastActionMap.get(p.id) ?? p.createdAt;
                const daysSince = Math.floor((now.getTime() - lastActionAt.getTime()) / DAY_MS);
                return {
                    id: p.id, reference: p.reference,
                    name: `${p.lastName ?? ''} ${p.firstName ?? ''}`.trim(),
                    status: p.status,
                    assignedToId: p.assignedToId,
                    assignedTo: p.assignedTo ? `${p.assignedTo.lastName ?? ''} ${p.assignedTo.firstName ?? ''}`.trim() : null,
                    lastActionAt, daysSince,
                    state: classifyFollowUp(daysSince, PROSPECT_THRESHOLDS),
                };
            }).sort((a, b) => b.daysSince - a.daysSince);
            const clientItems = clients.map((c) => {
                const lastActionAt = clientLastActionMap.get(c.id) ?? c.createdAt;
                const daysSince = Math.floor((now.getTime() - lastActionAt.getTime()) / DAY_MS);
                return {
                    id: c.id, reference: c.reference,
                    name: c.type === 'ENTREPRISE' ? (c.entreprise ?? '') : `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim(),
                    status: c.status,
                    assignedToId: c.assignedToId,
                    assignedTo: c.assignedTo ? `${c.assignedTo.lastName ?? ''} ${c.assignedTo.firstName ?? ''}`.trim() : null,
                    lastActionAt, daysSince,
                    state: classifyFollowUp(daysSince, CLIENT_THRESHOLDS),
                };
            }).sort((a, b) => b.daysSince - a.daysSince);
            // Apporteurs d'affaire : mêmes seuils d'inaction (délais) que les
            // clients — décision produit explicite, aucun palier dédié.
            const referrerItems = referrers.map((r) => {
                const lastActionAt = referrerLastActionMap.get(r.id) ?? r.createdAt;
                const daysSince = Math.floor((now.getTime() - lastActionAt.getTime()) / DAY_MS);
                return {
                    id: r.id, reference: `APP-${r.id}`,
                    name: r.companyName || `${r.lastName ?? ''} ${r.firstName ?? ''}`.trim(),
                    status: 'ACTIF',
                    assignedToId: r.assignedToId,
                    assignedTo: r.assignedTo ? `${r.assignedTo.lastName ?? ''} ${r.assignedTo.firstName ?? ''}`.trim() : null,
                    lastActionAt, daysSince,
                    state: classifyFollowUp(daysSince, CLIENT_THRESHOLDS),
                };
            }).sort((a, b) => b.daysSince - a.daysSince);
            const STATES = ['NORMAL', 'NEGLIGE', 'DANGER', 'CRITIQUE'];
            const countBy = (items) => STATES.map((state) => ({ key: state, count: items.filter((i) => i.state === state).length }));
            return ser({
                success: true,
                data: {
                    frequency,
                    prospects: { counts: countBy(prospectItems), items: prospectItems },
                    clients: { counts: countBy(clientItems), items: clientItems },
                    referrers: { counts: countBy(referrerItems), items: referrerItems },
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:followUp error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 10. Statistiques visiteurs ────────────────────────────────────── */
    electron_1.ipcMain.handle('analytics:visitors', async (_event, { token }) => {
        try {
            guardManagerFullAccess(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            // Courbe d'évolution mensuelle (12 mois glissants), ventilée par source
            // (QR / Interne) en plus du total.
            const buckets = monthBuckets(now, 12);
            const evolution = [];
            for (const b of buckets) {
                const [total, qr, interne] = await Promise.all([
                    db.visitor.count({ where: { deletedAt: null, visitedAt: { gte: b.start, lt: b.end } } }),
                    db.visitor.count({ where: { deletedAt: null, source: 'QR', visitedAt: { gte: b.start, lt: b.end } } }),
                    db.visitor.count({ where: { deletedAt: null, source: 'INTERNE', visitedAt: { gte: b.start, lt: b.end } } }),
                ]);
                evolution.push({ label: b.label, total, qr, interne });
            }
            const [today, month, total, byObjet] = await Promise.all([
                db.visitor.count({ where: { deletedAt: null, visitedAt: { gte: todayStart, lt: todayEnd } } }),
                db.visitor.count({ where: { deletedAt: null, visitedAt: { gte: monthStart, lt: monthEnd } } }),
                db.visitor.count({ where: { deletedAt: null } }),
                db.visitor.groupBy({ by: ['objet'], where: { deletedAt: null }, _count: { _all: true } }),
            ]);
            return ser({
                success: true,
                data: {
                    today, month, total,
                    evolution,
                    byObjet: byObjet
                        .map((g) => ({ key: g.objet, count: g._count._all }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10),
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:visitors error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── 11. Statistiques appels ───────────────────────────────────────── */
    electron_1.ipcMain.handle('analytics:calls', async (_event, { token }) => {
        try {
            guardManagerFullAccess(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            // Courbe d'évolution mensuelle (12 mois glissants), ventilée par sens
            // (entrant / sortant) en plus du total.
            const buckets = monthBuckets(now, 12);
            const evolution = [];
            for (const b of buckets) {
                const [total, entrant, sortant] = await Promise.all([
                    db.phoneCall.count({ where: { deletedAt: null, calledAt: { gte: b.start, lt: b.end } } }),
                    db.phoneCall.count({ where: { deletedAt: null, direction: 'ENTRANT', calledAt: { gte: b.start, lt: b.end } } }),
                    db.phoneCall.count({ where: { deletedAt: null, direction: 'SORTANT', calledAt: { gte: b.start, lt: b.end } } }),
                ]);
                evolution.push({ label: b.label, total, entrant, sortant });
            }
            const [today, month, total, byStatus] = await Promise.all([
                db.phoneCall.count({ where: { deletedAt: null, calledAt: { gte: todayStart, lt: todayEnd } } }),
                db.phoneCall.count({ where: { deletedAt: null, calledAt: { gte: monthStart, lt: monthEnd } } }),
                db.phoneCall.count({ where: { deletedAt: null } }),
                db.phoneCall.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
            ]);
            return ser({
                success: true,
                data: {
                    today, month, total,
                    evolution,
                    byStatus: byStatus.map((g) => ({ key: g.status, count: g._count._all })),
                },
            });
        }
        catch (error) {
            logger_1.default.error('analytics:calls error', error.message);
            return { success: false, error: error.message };
        }
    });
}
