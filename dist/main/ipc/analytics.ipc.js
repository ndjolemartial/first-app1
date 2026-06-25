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
/** Entrées de trésorerie sur [start, end[. */
async function computeEntrees(db, start, end) {
    const agg = await db.treasuryOperation.aggregate({
        where: { direction: 'ENTREE', deletedAt: null, operationDate: { gte: start, lt: end } },
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
            guard(token);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const [prospectsByStatus, prospectsBySource, prospectsTotal, converted, clientsByType, locataires, souscripteurs, actPending, actOverdue] = await Promise.all([
                db.prospect.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
                db.prospect.groupBy({ by: ['source'], where: { deletedAt: null }, _count: { _all: true } }),
                db.prospect.count({ where: { deletedAt: null } }),
                db.prospect.count({ where: { deletedAt: null, status: 'CONVERTI' } }),
                db.client.groupBy({ by: ['type'], where: { deletedAt: null }, _count: { _all: true } }),
                db.convention.count({ where: { deletedAt: null, status: 'ACTIVE', type: { in: ['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'COMMERCIAL_LEASE'] } } }),
                db.convention.count({ where: { deletedAt: null, status: 'ACTIVE', type: { in: ['SALE', 'SOUSCRIPTION'] } } }),
                db.crmActivity.count({ where: { status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] } } }),
                db.crmActivity.count({ where: { status: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] }, dueDate: { lt: now } } }),
            ]);
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
}
