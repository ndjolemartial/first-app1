"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBilanIPC = registerBilanIPC;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const exceljs_1 = __importDefault(require("exceljs"));
const zod_1 = require("zod");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const pdf_service_1 = require("../services/pdf.service");
const settings_service_1 = require("../services/settings.service");
const storage_service_1 = require("../services/storage.service");
const theme_service_1 = require("../services/theme.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Module Bilan comptable — agrège factures + paiements + opérations de
 * trésorerie en deux états :
 *   1. Compte de résultat (recettes / dépenses / résultat net) sur une période
 *   2. Bilan SYSCOA simplifié (Actif = Passif) arrêté à une date
 *
 * Périmètre : MANAGER+ (ACCOUNTANT inclus via checkRole), exclusion explicite
 * d'ASSISTANTE_DIRECTION conformément au module Comptabilité.
 *
 * Aucune nouvelle table BDD : tout est calculé à la volée. Les approximations
 * (immobilisations à la valeur de vente, capitaux propres par bouclage, dettes
 * propriétaires sur étiquetage de catégorie) sont documentées côté UI.
 */
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Le Bilan Actif/Passif est réservé à la direction (SUPER_ADMIN / ADMIN). */
const ACTIF_PASSIF_ROLES = ['SUPER_ADMIN', 'ADMIN'];
function checkBilanRole(session) {
    if (session.role === 'ASSISTANTE_DIRECTION')
        throw new Error('Permission insuffisante');
    (0, auth_service_1.checkRole)(session, READ_ROLES);
}
function checkActifPassifRole(session) {
    (0, auth_service_1.checkRole)(session, ACTIF_PASSIF_ROLES);
}
const MOIS = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
function computePeriod(periodType, periodStart, periodEnd) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (periodType === 'custom') {
        if (!periodStart || !periodEnd)
            throw new Error('Période personnalisée incomplète');
        const start = new Date(periodStart);
        const end = new Date(periodEnd);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new Error('Dates de période invalides');
        }
        if (end <= start)
            throw new Error('La date de fin doit être postérieure à la date de début');
        // L'intervalle est end-exclusif : on étend la date de fin d'un jour pour inclure
        // la journée complète sélectionnée par l'utilisateur.
        const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
        const fmt = (d) => d.toLocaleDateString('fr-FR');
        return { type: 'custom', start, end: endExclusive, label: `Du ${fmt(start)} au ${fmt(end)}` };
    }
    if (periodType === 'last-month') {
        // Mois précédent — robuste au changement d'année (janvier → décembre N-1).
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        return { type: 'last-month', start, end, label: `${MOIS[start.getMonth()]} ${start.getFullYear()}` };
    }
    if (periodType === 'quarter') {
        const q = Math.floor(m / 3);
        return {
            type: 'quarter',
            start: new Date(y, q * 3, 1),
            end: new Date(y, q * 3 + 3, 1),
            label: `${q === 0 ? '1er' : `${q + 1}e`} trimestre ${y}`,
        };
    }
    if (periodType === 'semester') {
        const s = m < 6 ? 0 : 1;
        return {
            type: 'semester',
            start: new Date(y, s * 6, 1),
            end: new Date(y, s * 6 + 6, 1),
            label: `${s === 0 ? '1er' : '2e'} semestre ${y}`,
        };
    }
    if (periodType === 'year') {
        return {
            type: 'year',
            start: new Date(y, 0, 1),
            end: new Date(y + 1, 0, 1),
            label: `Année ${y}`,
        };
    }
    // month (défaut)
    return {
        type: 'month',
        start: new Date(y, m, 1),
        end: new Date(y, m + 1, 1),
        label: `${MOIS[m]} ${y}`,
    };
}
/**
 * Découpe une période en sous-périodes de granularité adaptée pour la série
 * temporelle du graphique d'évolution.
 *
 *   - month     → 12 derniers mois (par mois)
 *   - quarter   → 8 derniers trimestres (par trimestre)
 *   - semester  → 6 derniers semestres (par semestre)
 *   - year      → 5 dernières années (par année)
 *   - custom    → 6 sous-périodes équidistantes sur la plage
 */
function buildEvolutionBuckets(period) {
    const buckets = [];
    if (period.type === 'month' || period.type === 'last-month') {
        const baseY = period.start.getFullYear();
        const baseM = period.start.getMonth();
        for (let i = 11; i >= 0; i--) {
            const start = new Date(baseY, baseM - i, 1);
            const end = new Date(baseY, baseM - i + 1, 1);
            buckets.push({ label: `${MOIS[start.getMonth()].slice(0, 3)} ${start.getFullYear()}`, start, end });
        }
        return buckets;
    }
    if (period.type === 'quarter') {
        const baseY = period.start.getFullYear();
        const baseQ = Math.floor(period.start.getMonth() / 3);
        for (let i = 7; i >= 0; i--) {
            const qIndex = baseQ - i;
            const start = new Date(baseY, qIndex * 3, 1);
            const end = new Date(baseY, qIndex * 3 + 3, 1);
            buckets.push({ label: `T${((start.getMonth() / 3) | 0) + 1} ${start.getFullYear()}`, start, end });
        }
        return buckets;
    }
    if (period.type === 'semester') {
        const baseY = period.start.getFullYear();
        const baseS = period.start.getMonth() < 6 ? 0 : 1;
        for (let i = 5; i >= 0; i--) {
            const sIndex = baseS - i;
            const start = new Date(baseY, sIndex * 6, 1);
            const end = new Date(baseY, sIndex * 6 + 6, 1);
            buckets.push({ label: `S${start.getMonth() < 6 ? 1 : 2} ${start.getFullYear()}`, start, end });
        }
        return buckets;
    }
    if (period.type === 'year') {
        const baseY = period.start.getFullYear();
        for (let i = 4; i >= 0; i--) {
            const start = new Date(baseY - i, 0, 1);
            const end = new Date(baseY - i + 1, 0, 1);
            buckets.push({ label: `${start.getFullYear()}`, start, end });
        }
        return buckets;
    }
    // custom : 6 buckets équidistants
    const totalMs = period.end.getTime() - period.start.getTime();
    const step = Math.max(1, Math.floor(totalMs / 6));
    for (let i = 0; i < 6; i++) {
        const start = new Date(period.start.getTime() + i * step);
        const end = i === 5 ? period.end : new Date(period.start.getTime() + (i + 1) * step);
        const fmt = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        buckets.push({ label: fmt(start), start, end });
    }
    return buckets;
}
/**
 * Produit la clause `where` Prisma pour filtrer une Invoice selon la dimension
 * analytique choisie. Le filtre passe par la convention rattachée :
 * Convention a des relations many-to-many (`properties` et `terrains`) via les
 * tables de jointure ConventionProperty / ConventionTerrain, donc le filtre
 * remonte via `properties.some.property.X` et `terrains.some.terrain.X`.
 */
function invoiceScopeWhere(scope, scopeId) {
    if (scope === 'global' || !scopeId)
        return {};
    // Property n'a pas de `lotissementId` (les lotissements regroupent uniquement
    // des terrains). On exclut donc la branche `properties` pour ce scope.
    if (scope === 'lotissement') {
        return {
            convention: {
                terrains: { some: { terrain: { lotissementId: scopeId } } },
            },
        };
    }
    const field = scope === 'programme' ? 'programmeId' : 'ownerId';
    return {
        convention: {
            OR: [
                { properties: { some: { property: { [field]: scopeId } } } },
                { terrains: { some: { terrain: { [field]: scopeId } } } },
            ],
        },
    };
}
/**
 * Filtre `where` pour une TreasuryOperation selon la dimension analytique.
 *
 * `lotissement`/`programme` utilisent l'imputation analytique directe sur
 * l'opération. `owner` est plus indirect : `TreasuryOperation` n'expose pas
 * de relation Prisma vers `Payment`/`SaleInstallment`, seulement les colonnes
 * FK — on pré-résout donc la liste des paymentId/installmentId qui remontent
 * au propriétaire et on filtre par `IN (...)`.
 */
async function treasuryScopeWhere(db, scope, scopeId) {
    if (scope === 'global' || !scopeId)
        return {};
    if (scope === 'lotissement')
        return { lotissementId: scopeId };
    if (scope === 'programme')
        return { programmeId: scopeId };
    // owner — résolution en deux temps.
    const conventions = await db.convention.findMany({
        where: {
            OR: [
                { properties: { some: { property: { ownerId: scopeId } } } },
                { terrains: { some: { terrain: { ownerId: scopeId } } } },
            ],
        },
        select: { id: true },
    });
    if (conventions.length === 0) {
        // Aucun rattachement → on force un filtre vide qui ne matche rien.
        return { id: -1 };
    }
    const conventionIds = conventions.map((c) => c.id);
    const [payments, installments] = await Promise.all([
        db.payment.findMany({
            where: { invoice: { conventionId: { in: conventionIds } } },
            select: { id: true },
        }),
        db.saleInstallment.findMany({
            where: { conventionId: { in: conventionIds } },
            select: { id: true },
        }),
    ]);
    const paymentIds = payments.map((p) => p.id);
    const installmentIds = installments.map((i) => i.id);
    if (paymentIds.length === 0 && installmentIds.length === 0)
        return { id: -1 };
    return {
        OR: [
            ...(paymentIds.length ? [{ paymentId: { in: paymentIds } }] : []),
            ...(installmentIds.length ? [{ installmentId: { in: installmentIds } }] : []),
        ],
    };
}
// ── Libellés de types de facture ─────────────────────────────────────────────
const INVOICE_TYPE_LABEL = {
    VENTE: 'Ventes',
    ECHEANCE_VENTE: 'Échéances de vente',
    FRAIS_AGENCE: "Frais d'agence",
    FRAIS_DE_GESTION: 'Frais de gestion',
    FRAIS_DEMARCHES_ACD: 'Frais démarches ACD',
    AVANCE: 'Avances reçues',
    CAUTION: 'Cautions reçues',
    OTHER: 'Autres recettes',
};
// Recettes « souscription client » : les paiements d'échéances de vente ainsi que
// les factures auto-générées à l'ouverture d'une convention (apport initial, frais
// d'ouverture de dossier) sont regroupés dans une seule catégorie de recette
// intitulée « VERSEMENT SOUSCRIPTION CLIENT » au compte comptable 585.
const SOUSCRIPTION_LABEL = 'VERSEMENT SOUSCRIPTION CLIENT';
const SOUSCRIPTION_CODE = '585';
const SOUSCRIPTION_INVOICE_TYPES = new Set(['ECHEANCE_VENTE', 'APPORT_INITIAL', 'FRAIS_OUVERTURE_DOSSIER']);
/** Catégorie de recette (libellé + code comptable éventuel) d'un type de facture. */
function invoiceRecetteCategory(type) {
    const t = type ?? 'OTHER';
    if (SOUSCRIPTION_INVOICE_TYPES.has(t))
        return { label: SOUSCRIPTION_LABEL, code: SOUSCRIPTION_CODE };
    return { label: INVOICE_TYPE_LABEL[t] ?? 'Autres recettes' };
}
// ── Récupération du label de la dimension ────────────────────────────────────
async function resolveScopeLabel(db, scope, scopeId) {
    if (scope === 'global' || !scopeId)
        return 'Tous périmètres confondus';
    if (scope === 'lotissement') {
        const row = await db.lotissement.findUnique({ where: { id: scopeId }, select: { nom: true, reference: true } });
        return row ? `Lotissement ${row.reference} — ${row.nom}` : `Lotissement #${scopeId}`;
    }
    if (scope === 'programme') {
        const row = await db.programmeImmobilier.findUnique({ where: { id: scopeId }, select: { nom: true, reference: true } });
        return row ? `Programme ${row.reference} — ${row.nom}` : `Programme #${scopeId}`;
    }
    // owner
    const row = await db.owner.findUnique({
        where: { id: scopeId },
        select: { firstName: true, lastName: true, companyName: true, type: true },
    });
    if (!row)
        return `Propriétaire #${scopeId}`;
    const name = row.type === 'ENTREPRISE'
        ? (row.companyName ?? `Propriétaire #${scopeId}`)
        : `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || `Propriétaire #${scopeId}`;
    return `Propriétaire — ${name}`;
}
async function computePeriodTotals(db, start, end, scope, scopeId) {
    const invWhere = invoiceScopeWhere(scope, scopeId);
    const trWhere = await treasuryScopeWhere(db, scope, scopeId);
    // Recettes — partie 1 : paiements de factures sur la période.
    const payments = await db.payment.findMany({
        where: {
            paidAt: { gte: start, lt: end },
            invoice: { deletedAt: null, ...invWhere },
        },
        select: { amount: true, invoice: { select: { type: true } } },
    });
    // Recettes — partie 2 : factures payées « implicitement » (statut PAYEE sans
    // Payment associé — cas des anciennes données ou règlement direct côté UI).
    const directPaid = await db.invoice.findMany({
        where: {
            deletedAt: null,
            status: 'PAYEE',
            paidAt: { gte: start, lt: end },
            payments: { none: {} },
            ...invWhere,
        },
        select: { total: true, type: true },
    });
    const recettes = {};
    const recettesCodes = {};
    for (const p of payments) {
        const { label, code } = invoiceRecetteCategory(p.invoice?.type);
        recettes[label] = (recettes[label] ?? 0) + Number(p.amount);
        if (code && !recettesCodes[label])
            recettesCodes[label] = code;
    }
    for (const inv of directPaid) {
        const { label, code } = invoiceRecetteCategory(inv.type);
        recettes[label] = (recettes[label] ?? 0) + Number(inv.total);
        if (code && !recettesCodes[label])
            recettesCodes[label] = code;
    }
    // Recettes — partie 3 : opérations de trésorerie ENTREE purement manuelles
    // (non générées par un encaissement de facture, déjà comptées au-dessus).
    // Les entrées sur les comptes « Caisse interne » (CAISSE_CENTRALE) sont exclues :
    // simples déplacements de fonds internes, non du chiffre d'affaires. (Leurs
    // sorties restent comptabilisées en dépenses ci-dessous.)
    const trEntrees = await db.treasuryOperation.findMany({
        where: {
            direction: 'ENTREE',
            operationDate: { gte: start, lt: end },
            deletedAt: null,
            paymentId: null,
            installmentId: null,
            commissionId: null,
            bankAccount: { type: { not: 'CAISSE_CENTRALE' } },
            ...trWhere,
        },
        select: { amount: true, category: { select: { label: true, accountingCode: true } }, label: true },
    });
    for (const op of trEntrees) {
        const cat = op.category?.label ?? op.label ?? 'Autres recettes (trésorerie)';
        recettes[cat] = (recettes[cat] ?? 0) + Number(op.amount);
        if (op.category?.accountingCode && !recettesCodes[cat])
            recettesCodes[cat] = op.category.accountingCode;
    }
    // Dépenses : toutes les sorties de trésorerie sur la période.
    const trSorties = await db.treasuryOperation.findMany({
        where: {
            direction: 'SORTIE',
            operationDate: { gte: start, lt: end },
            deletedAt: null,
            ...trWhere,
        },
        select: { amount: true, category: { select: { label: true, accountingCode: true } }, label: true },
    });
    const depenses = {};
    const depensesCodes = {};
    for (const op of trSorties) {
        const cat = op.category?.label ?? op.label ?? 'Dépenses diverses';
        depenses[cat] = (depenses[cat] ?? 0) + Number(op.amount);
        if (op.category?.accountingCode && !depensesCodes[cat])
            depensesCodes[cat] = op.category.accountingCode;
    }
    const totalRecettes = Object.values(recettes).reduce((s, v) => s + v, 0);
    const totalDepenses = Object.values(depenses).reduce((s, v) => s + v, 0);
    return {
        recettesByCategory: recettes,
        depensesByCategory: depenses,
        recettesCodes,
        depensesCodes,
        totalRecettes,
        totalDepenses,
        resultat: totalRecettes - totalDepenses,
    };
}
async function computeActifPassif(db, asOfDate, scope, scopeId) {
    const invWhere = invoiceScopeWhere(scope, scopeId);
    const trWhere = await treasuryScopeWhere(db, scope, scopeId);
    // ── Actif : Immobilisations ────────────────────────────────────────────────
    // Biens non vendus, valeur indicative = salePrice. Scope filtre par
    // ownerId/lotissementId/programmeId selon la dimension.
    const propertyWhere = { deletedAt: null, status: { not: 'VENDU' } };
    const terrainWhere = { deletedAt: null, statut: { not: 'VENDU' } };
    if (scope === 'lotissement' && scopeId) {
        terrainWhere.lotissementId = scopeId;
        // Properties n'ont pas de lotissement direct → on filtre via terrain uniquement
    }
    else if (scope === 'programme' && scopeId) {
        propertyWhere.programmeId = scopeId;
        terrainWhere.programmeId = scopeId;
    }
    else if (scope === 'owner' && scopeId) {
        propertyWhere.ownerId = scopeId;
        terrainWhere.ownerId = scopeId;
    }
    const [propsList, terrainsList] = await Promise.all([
        scope === 'lotissement' && scopeId
            ? Promise.resolve([])
            : db.property.findMany({
                where: propertyWhere,
                select: { reference: true, salePrice: true },
                take: 200,
            }),
        db.terrain.findMany({
            where: terrainWhere,
            select: { reference: true, prixVente: true },
            take: 200,
        }),
    ]);
    const immobilisations = [];
    let totalImmobilisations = 0;
    // On regroupe par catégorie (Biens / Terrains) plutôt que ligne à ligne :
    // un bilan ligne à ligne sur 200+ biens devient illisible. Détail accessible
    // via les autres modules.
    const sumProps = propsList.reduce((s, p) => s + Number(p.salePrice ?? 0), 0);
    const sumTerr = terrainsList.reduce((s, t) => s + Number(t.prixVente ?? 0), 0);
    if (sumProps > 0) {
        immobilisations.push({ label: `Biens immobiliers (${propsList.length})`, montant: sumProps });
        totalImmobilisations += sumProps;
    }
    if (sumTerr > 0) {
        immobilisations.push({ label: `Terrains (${terrainsList.length})`, montant: sumTerr });
        totalImmobilisations += sumTerr;
    }
    // ── Actif : Créances clients ──────────────────────────────────────────────
    const unpaidInvoices = await db.invoice.findMany({
        where: {
            deletedAt: null,
            status: { in: ['VALIDEE', 'EN_RETARD', 'PARTIEL'] },
            issueDate: { lte: asOfDate },
            ...invWhere,
        },
        select: {
            type: true,
            total: true,
            payments: { where: { paidAt: { lte: asOfDate } }, select: { amount: true } },
        },
    });
    const creancesMap = {};
    for (const inv of unpaidInvoices) {
        const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
        const remaining = Math.max(0, Number(inv.total) - paid);
        if (remaining > 0) {
            const label = INVOICE_TYPE_LABEL[inv.type] ?? 'Autres créances';
            creancesMap[label] = (creancesMap[label] ?? 0) + remaining;
        }
    }
    const creances = Object.entries(creancesMap).map(([label, montant]) => ({ label, montant }));
    const totalCreances = creances.reduce((s, c) => s + c.montant, 0);
    // ── Actif : Échéances de vente à recevoir ─────────────────────────────────
    const installments = await db.saleInstallment.findMany({
        where: {
            status: { in: ['EN_ATTENTE', 'A_REGLER', 'EN_RETARD'] },
            dueDate: { lte: asOfDate },
            // Réutilise le scope Invoice : son fragment `convention` filtre déjà la
            // convention rattachée à l'échéance.
            ...(invWhere.convention ? { convention: invWhere.convention } : {}),
        },
        select: { amount: true, status: true },
    });
    const echeancesMap = { 'À recevoir': 0, 'En retard': 0 };
    for (const it of installments) {
        if (it.status === 'EN_RETARD')
            echeancesMap['En retard'] += Number(it.amount);
        else
            echeancesMap['À recevoir'] += Number(it.amount);
    }
    const echeances = Object.entries(echeancesMap)
        .filter(([, v]) => v > 0)
        .map(([label, montant]) => ({ label, montant }));
    const totalEcheances = echeances.reduce((s, e) => s + e.montant, 0);
    // ── Actif : Trésorerie ────────────────────────────────────────────────────
    // Solde par compte = initialBalance + Σ entrées − Σ sorties (jusqu'à la date).
    // Le scope analytique restreint aux opérations imputées à la dimension :
    // sur scope ≠ global, la « trésorerie » devient le flux net imputé à la
    // dimension (et non un solde de compte au sens bancaire).
    const tresorerie = [];
    let totalTresorerie = 0;
    if (scope === 'global') {
        const accounts = await db.bankAccount.findMany({
            where: { deletedAt: null, isActive: true },
            select: { id: true, name: true, type: true, initialBalance: true },
        });
        for (const acc of accounts) {
            const flux = await db.treasuryOperation.aggregate({
                where: { bankAccountId: acc.id, deletedAt: null, operationDate: { lte: asOfDate } },
                _sum: { amount: true },
            });
            const sortieAgg = await db.treasuryOperation.aggregate({
                where: { bankAccountId: acc.id, deletedAt: null, operationDate: { lte: asOfDate }, direction: 'SORTIE' },
                _sum: { amount: true },
            });
            const entreeAgg = await db.treasuryOperation.aggregate({
                where: { bankAccountId: acc.id, deletedAt: null, operationDate: { lte: asOfDate }, direction: 'ENTREE' },
                _sum: { amount: true },
            });
            // _sum.amount sans direction ne fait pas la distinction : on recalcule
            // explicitement le solde signé.
            void flux;
            const solde = Number(acc.initialBalance) + Number(entreeAgg._sum.amount ?? 0) - Number(sortieAgg._sum.amount ?? 0);
            if (solde !== 0) {
                tresorerie.push({ label: `${acc.name} (${acc.type})`, montant: solde });
                totalTresorerie += solde;
            }
        }
    }
    else {
        // Sur scope analytique, on ne donne qu'un flux net cumulé.
        const entrees = await db.treasuryOperation.aggregate({
            where: { direction: 'ENTREE', deletedAt: null, operationDate: { lte: asOfDate }, ...trWhere },
            _sum: { amount: true },
        });
        const sorties = await db.treasuryOperation.aggregate({
            where: { direction: 'SORTIE', deletedAt: null, operationDate: { lte: asOfDate }, ...trWhere },
            _sum: { amount: true },
        });
        const net = Number(entrees._sum.amount ?? 0) - Number(sorties._sum.amount ?? 0);
        tresorerie.push({ label: 'Flux net de trésorerie imputé', montant: net });
        totalTresorerie = net;
    }
    // ── Passif : Cautions reçues ──────────────────────────────────────────────
    const cautionsAgg = await db.payment.aggregate({
        where: {
            paidAt: { lte: asOfDate },
            invoice: { deletedAt: null, type: 'CAUTION', ...invWhere },
        },
        _sum: { amount: true },
    });
    const cautionsDirect = await db.invoice.aggregate({
        where: {
            deletedAt: null, type: 'CAUTION', status: 'PAYEE',
            paidAt: { lte: asOfDate }, payments: { none: {} }, ...invWhere,
        },
        _sum: { total: true },
    });
    const totalCautions = Number(cautionsAgg._sum.amount ?? 0) + Number(cautionsDirect._sum.total ?? 0);
    const cautions = totalCautions > 0 ? [{ label: 'Cautions encaissées', montant: totalCautions }] : [];
    // ── Passif : Avances reçues ───────────────────────────────────────────────
    const avancesAgg = await db.payment.aggregate({
        where: {
            paidAt: { lte: asOfDate },
            invoice: { deletedAt: null, type: 'AVANCE', ...invWhere },
        },
        _sum: { amount: true },
    });
    const avancesDirect = await db.invoice.aggregate({
        where: {
            deletedAt: null, type: 'AVANCE', status: 'PAYEE',
            paidAt: { lte: asOfDate }, payments: { none: {} }, ...invWhere,
        },
        _sum: { total: true },
    });
    const totalAvances = Number(avancesAgg._sum.amount ?? 0) + Number(avancesDirect._sum.total ?? 0);
    const avances = totalAvances > 0 ? [{ label: 'Avances encaissées', montant: totalAvances }] : [];
    // ── Passif : Dettes envers propriétaires (approximation) ──────────────────
    // Approche : par propriétaire concerné par le scope, on calcule :
    //   (paiements clients sur conventions de gestion liées à ses biens)
    // − (frais de gestion facturés à ce propriétaire — peu fiable, on prend les
    //   factures FRAIS_DE_GESTION dans le scope)
    // − (sorties de trésorerie étiquetées « reversement »)
    //
    // C'est une approximation utile pour piloter, pas un solde comptable.
    let dettesProprietaires = [];
    let totalDettesProprietaires = 0;
    if (scope === 'owner' && scopeId) {
        // Loyers / frais d'agence encaissés sur les biens du propriétaire (hors ventes pures).
        const ownerConvFilter = {
            OR: [
                { properties: { some: { property: { ownerId: scopeId } } } },
                { terrains: { some: { terrain: { ownerId: scopeId } } } },
            ],
        };
        const loyersEncaisses = await db.payment.aggregate({
            where: {
                paidAt: { lte: asOfDate },
                invoice: {
                    deletedAt: null,
                    type: { in: ['FRAIS_AGENCE', 'OTHER'] },
                    convention: ownerConvFilter,
                },
            },
            _sum: { amount: true },
        });
        const fraisGestion = await db.invoice.aggregate({
            where: {
                deletedAt: null,
                type: 'FRAIS_DE_GESTION',
                status: { in: ['PAYEE', 'VALIDEE', 'PARTIEL', 'EN_RETARD'] },
                issueDate: { lte: asOfDate },
                convention: ownerConvFilter,
            },
            _sum: { total: true },
        });
        const reversements = await db.treasuryOperation.findMany({
            where: {
                direction: 'SORTIE',
                deletedAt: null,
                operationDate: { lte: asOfDate },
                category: { label: { contains: 'reversement' } },
                ...trWhere,
            },
            select: { amount: true },
        });
        const sumReversements = reversements.reduce((s, op) => s + Number(op.amount), 0);
        const due = Number(loyersEncaisses._sum?.amount ?? 0)
            - Number(fraisGestion._sum?.total ?? 0)
            - sumReversements;
        if (due !== 0) {
            dettesProprietaires.push({ label: 'Solde dû au propriétaire (approx.)', montant: Math.max(0, due) });
            totalDettesProprietaires = Math.max(0, due);
        }
    }
    else if (scope === 'global') {
        // Vue globale : approximation grossière à partir des sorties non reversées.
        const reversements = await db.treasuryOperation.aggregate({
            where: {
                direction: 'SORTIE',
                deletedAt: null,
                operationDate: { lte: asOfDate },
                category: { label: { contains: 'reversement' } },
            },
            _sum: { amount: true },
        });
        // On n'affiche pas de ligne hypothétique en vue globale : le bouclage par
        // capitaux propres absorbera la différence.
        void reversements;
    }
    // ── Passif : Capitaux propres (ligne de bouclage) ─────────────────────────
    const totalActif = totalImmobilisations + totalCreances + totalEcheances + totalTresorerie;
    const capitauxPropres = totalActif - totalCautions - totalAvances - totalDettesProprietaires;
    const totalPassif = totalCautions + totalAvances + totalDettesProprietaires + capitauxPropres;
    return {
        asOfDate: asOfDate.toISOString(),
        scope: { type: scope, id: scopeId, label: await resolveScopeLabel(db, scope, scopeId) },
        actif: {
            immobilisations, creances, echeances, tresorerie,
            totalImmobilisations, totalCreances, totalEcheances, totalTresorerie,
        },
        passif: {
            cautions, avances, dettesProprietaires,
            totalCautions, totalAvances, totalDettesProprietaires,
            capitauxPropres,
        },
        totalActif, totalPassif,
    };
}
// ── Schémas Zod ──────────────────────────────────────────────────────────────
const periodTypeSchema = zod_1.z.enum(['month', 'last-month', 'quarter', 'semester', 'year', 'custom']);
const scopeSchema = zod_1.z.enum(['global', 'lotissement', 'programme', 'owner']);
const resultatPayloadSchema = zod_1.z.object({
    periodType: periodTypeSchema,
    periodStart: zod_1.z.string().optional(),
    periodEnd: zod_1.z.string().optional(),
    scope: scopeSchema,
    scopeId: zod_1.z.number().int().positive().optional(),
});
const actifPassifPayloadSchema = zod_1.z.object({
    asOfDate: zod_1.z.string().optional(),
    scope: scopeSchema,
    scopeId: zod_1.z.number().int().positive().optional(),
});
const exportPayloadSchema = zod_1.z.object({
    type: zod_1.z.enum(['resultat', 'actif-passif']),
    format: zod_1.z.enum(['pdf', 'xlsx']),
    data: zod_1.z.any(),
    meta: zod_1.z.object({
        title: zod_1.z.string(),
        subtitle: zod_1.z.string().optional(),
        scope: zod_1.z.string().optional(),
    }),
});
// ── Helpers d'export ─────────────────────────────────────────────────────────
function formatXOF(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}
async function getCompanyHeader() {
    const map = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.companyName, settings_service_1.SettingsKeys.companyAddress, settings_service_1.SettingsKeys.companyLogo,
    ]);
    const out = {
        name: map[settings_service_1.SettingsKeys.companyName] ?? 'Afrikimmo',
        address: map[settings_service_1.SettingsKeys.companyAddress] ?? '',
    };
    const logoRel = map[settings_service_1.SettingsKeys.companyLogo];
    if (logoRel) {
        try {
            const abs = (0, storage_service_1.resolveStoragePath)(logoRel);
            if (fs_1.default.existsSync(abs)) {
                const buf = fs_1.default.readFileSync(abs);
                const ext = path_1.default.extname(logoRel).toLowerCase().replace('.', '') || 'png';
                out.logoMime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                out.logoBase64 = buf.toString('base64');
            }
        }
        catch { /* logo manquant — ignoré */ }
    }
    return out;
}
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function buildResultatHtml(data, meta, company, theme) {
    const primary = theme.primary;
    const accent = theme.accent;
    const muted = theme.textMuted;
    const surface = theme.surface;
    const border = theme.border;
    const recettesRows = data.recettes.map((r) => `<tr><td class="code">${escapeHtml(r.code ?? '—')}</td><td>${escapeHtml(r.categorie)}</td><td class="num">${formatXOF(r.montant)}</td><td class="num">${data.totalRecettes ? ((r.montant / data.totalRecettes) * 100).toFixed(1) : '0.0'} %</td></tr>`).join('');
    const depensesRows = data.depenses.map((d) => `<tr><td class="code">${escapeHtml(d.code ?? '—')}</td><td>${escapeHtml(d.categorie)}</td><td class="num">${formatXOF(d.montant)}</td><td class="num">${data.totalDepenses ? ((d.montant / data.totalDepenses) * 100).toFixed(1) : '0.0'} %</td></tr>`).join('');
    const evolutionRows = data.evolution.map((e) => `<tr><td>${escapeHtml(e.label)}</td><td class="num">${formatXOF(e.recettes)}</td><td class="num">${formatXOF(e.depenses)}</td><td class="num ${e.resultat < 0 ? 'neg' : 'pos'}">${formatXOF(e.resultat)}</td></tr>`).join('');
    const logoHtml = company.logoBase64
        ? `<img src="data:${company.logoMime};base64,${company.logoBase64}" style="max-height:60px;max-width:140px"/>`
        : '';
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${accent}; padding-bottom: 8px; margin-bottom: 12px; }
    .company-name { font-size: 14px; font-weight: bold; color: ${primary}; margin: 0; }
    .company-addr { font-size: 9px; color: ${muted}; margin: 2px 0 0; }
    h1 { font-size: 16px; color: ${primary}; margin: 0 0 4px; }
    .sub { color: ${muted}; font-style: italic; font-size: 10px; margin-bottom: 4px; }
    .scope { color: ${muted}; font-size: 10px; margin-bottom: 12px; }
    .kpis { display: flex; gap: 12px; margin-bottom: 14px; }
    .kpi { flex: 1; border: 1px solid ${border}; border-radius: 6px; padding: 8px 10px; background: ${surface}; }
    .kpi .lbl { font-size: 9px; color: ${muted}; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi .val { font-size: 14px; font-weight: bold; color: ${primary}; margin-top: 2px; }
    h2 { font-size: 12px; color: ${primary}; margin: 14px 0 4px; border-bottom: 1px solid ${border}; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: ${primary}; color: #fff; padding: 5px 8px; font-size: 9px; text-align: left; }
    td { padding: 4px 8px; border-bottom: 1px solid ${border}; font-size: 9px; }
    tr:nth-child(even) td { background: ${surface}; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .code { font-variant-numeric: tabular-nums; color: ${muted}; white-space: nowrap; width: 70px; }
    .total-row td { background: ${border}; font-weight: bold; color: ${primary}; }
    .pos { color: #15803d; font-weight: bold; }
    .neg { color: #b91c1c; font-weight: bold; }
  </style></head><body>
    <div class="header">
      <div>
        <p class="company-name">${escapeHtml(company.name)}</p>
        <p class="company-addr">${escapeHtml(company.address)}</p>
      </div>
      ${logoHtml}
    </div>
    <h1>${escapeHtml(meta.title)}</h1>
    ${meta.subtitle ? `<div class="sub">${escapeHtml(meta.subtitle)}</div>` : ''}
    <div class="scope">Périmètre : ${escapeHtml(data.scope.label)}</div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">Recettes</div><div class="val">${formatXOF(data.totalRecettes)}</div></div>
      <div class="kpi"><div class="lbl">Dépenses</div><div class="val">${formatXOF(data.totalDepenses)}</div></div>
      <div class="kpi"><div class="lbl">Résultat net</div><div class="val ${data.resultat < 0 ? 'neg' : 'pos'}">${formatXOF(data.resultat)}</div></div>
    </div>
    <h2>Recettes par catégorie</h2>
    <table><thead><tr><th>N° compte</th><th>Catégorie</th><th class="num">Montant</th><th class="num">Part</th></tr></thead>
      <tbody>${recettesRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Aucune recette sur la période</td></tr>'}
      <tr class="total-row"><td colspan="2">TOTAL RECETTES</td><td class="num">${formatXOF(data.totalRecettes)}</td><td class="num">100.0 %</td></tr>
      </tbody></table>
    <h2>Dépenses par catégorie</h2>
    <table><thead><tr><th>N° compte</th><th>Catégorie</th><th class="num">Montant</th><th class="num">Part</th></tr></thead>
      <tbody>${depensesRows || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Aucune dépense sur la période</td></tr>'}
      <tr class="total-row"><td colspan="2">TOTAL DÉPENSES</td><td class="num">${formatXOF(data.totalDepenses)}</td><td class="num">100.0 %</td></tr>
      </tbody></table>
    <h2>Évolution</h2>
    <table><thead><tr><th>Sous-période</th><th class="num">Recettes</th><th class="num">Dépenses</th><th class="num">Résultat</th></tr></thead>
      <tbody>${evolutionRows}</tbody></table>
  </body></html>`;
}
function buildActifPassifHtml(data, meta, company, theme) {
    const primary = theme.primary;
    const accent = theme.accent;
    const muted = theme.textMuted;
    const surface = theme.surface;
    const border = theme.border;
    const section = (title, rows, sectionTotal) => {
        const tr = rows.length
            ? rows.map((r) => `<tr><td>${escapeHtml(r.label)}</td><td class="num">${formatXOF(r.montant)}</td></tr>`).join('')
            : `<tr><td colspan="2" style="text-align:center;color:#94a3b8">—</td></tr>`;
        return `<tr class="section-row"><td>${escapeHtml(title)}</td><td class="num">${formatXOF(sectionTotal)}</td></tr>${tr}`;
    };
    const equilibreDelta = data.totalActif - data.totalPassif;
    const equilibreClass = Math.abs(equilibreDelta) < 1 ? 'pos' : 'neg';
    const logoHtml = company.logoBase64
        ? `<img src="data:${company.logoMime};base64,${company.logoBase64}" style="max-height:60px;max-width:140px"/>`
        : '';
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${accent}; padding-bottom: 8px; margin-bottom: 12px; }
    .company-name { font-size: 14px; font-weight: bold; color: ${primary}; margin: 0; }
    .company-addr { font-size: 9px; color: ${muted}; margin: 2px 0 0; }
    h1 { font-size: 16px; color: ${primary}; margin: 0 0 4px; }
    .sub { color: ${muted}; font-style: italic; font-size: 10px; margin-bottom: 4px; }
    .scope { color: ${muted}; font-size: 10px; margin-bottom: 12px; }
    .grid { display: flex; gap: 12px; }
    .col { flex: 1; }
    h2 { font-size: 12px; color: ${primary}; margin: 0 0 4px; border-bottom: 1px solid ${border}; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: ${primary}; color: #fff; padding: 5px 8px; font-size: 9px; text-align: left; }
    td { padding: 4px 8px; border-bottom: 1px solid ${border}; font-size: 9px; }
    .section-row td { background: ${surface}; font-weight: bold; color: ${primary}; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total-row td { background: ${border}; font-weight: bold; color: ${primary}; font-size: 10px; }
    .pos { color: #15803d; font-weight: bold; }
    .neg { color: #b91c1c; font-weight: bold; }
    .equilibre { margin-top: 10px; padding: 6px 8px; border: 1px solid ${border}; background: ${surface}; font-size: 10px; }
    .footnote { margin-top: 12px; font-size: 8px; color: ${muted}; font-style: italic; }
  </style></head><body>
    <div class="header">
      <div>
        <p class="company-name">${escapeHtml(company.name)}</p>
        <p class="company-addr">${escapeHtml(company.address)}</p>
      </div>
      ${logoHtml}
    </div>
    <h1>${escapeHtml(meta.title)}</h1>
    ${meta.subtitle ? `<div class="sub">${escapeHtml(meta.subtitle)}</div>` : ''}
    <div class="scope">Périmètre : ${escapeHtml(data.scope.label)}</div>
    <div class="grid">
      <div class="col">
        <h2>ACTIF</h2>
        <table><thead><tr><th>Poste</th><th class="num">Montant</th></tr></thead><tbody>
          ${section('Immobilisations', data.actif.immobilisations, data.actif.totalImmobilisations)}
          ${section('Créances clients', data.actif.creances, data.actif.totalCreances)}
          ${section('Échéances à recevoir', data.actif.echeances, data.actif.totalEcheances)}
          ${section('Trésorerie', data.actif.tresorerie, data.actif.totalTresorerie)}
          <tr class="total-row"><td>TOTAL ACTIF</td><td class="num">${formatXOF(data.totalActif)}</td></tr>
        </tbody></table>
      </div>
      <div class="col">
        <h2>PASSIF</h2>
        <table><thead><tr><th>Poste</th><th class="num">Montant</th></tr></thead><tbody>
          <tr class="section-row"><td>Capitaux propres</td><td class="num">${formatXOF(data.passif.capitauxPropres)}</td></tr>
          ${section('Cautions reçues', data.passif.cautions, data.passif.totalCautions)}
          ${section('Avances reçues', data.passif.avances, data.passif.totalAvances)}
          ${section('Dettes propriétaires', data.passif.dettesProprietaires, data.passif.totalDettesProprietaires)}
          <tr class="total-row"><td>TOTAL PASSIF</td><td class="num">${formatXOF(data.totalPassif)}</td></tr>
        </tbody></table>
      </div>
    </div>
    <div class="equilibre">
      Équilibre Actif/Passif :
      <span class="${equilibreClass}">${Math.abs(equilibreDelta) < 1 ? 'équilibré' : `écart ${formatXOF(equilibreDelta)}`}</span>
    </div>
    <div class="footnote">
      Méthodologie : immobilisations à la valeur de vente indicative (pas d'amortissement). Capitaux propres calculés
      par bouclage (Actif − autres passifs). Dettes propriétaires approximées via les paiements clients et les sorties
      de trésorerie étiquetées « reversement ». Document à usage de pilotage interne.
    </div>
  </body></html>`;
}
async function buildXlsxResultat(data, meta, theme) {
    const NAVY = (0, theme_service_1.hexToArgb)(theme.primary);
    const wb = new exceljs_1.default.Workbook();
    wb.creator = 'Afrikimmo-App';
    wb.created = new Date();
    // Feuille synthèse
    const ws = wb.addWorksheet('Synthèse');
    ws.mergeCells('A1:C1');
    ws.getCell('A1').value = meta.title;
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } };
    ws.getCell('A2').value = meta.subtitle ?? '';
    ws.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
    ws.getCell('A3').value = `Périmètre : ${data.scope.label}`;
    ws.getCell('A3').font = { color: { argb: 'FF64748B' } };
    ws.getCell('A5').value = 'KPI';
    ws.getCell('B5').value = 'Montant (XOF)';
    ws.getCell('A5').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('B5').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    ws.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    ws.getCell('A6').value = 'Total recettes';
    ws.getCell('B6').value = data.totalRecettes;
    ws.getCell('A7').value = 'Total dépenses';
    ws.getCell('B7').value = data.totalDepenses;
    ws.getCell('A8').value = 'Résultat net';
    ws.getCell('B8').value = data.resultat;
    ws.getCell('A8').font = { bold: true };
    ws.getCell('B8').font = { bold: true };
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 18;
    ws.getColumn(3).width = 18;
    const addSection = (sheetName, headers, rows, totalRow, widths) => {
        const sh = wb.addWorksheet(sheetName);
        headers.forEach((h, i) => {
            const c = sh.getCell(1, i + 1);
            c.value = h;
            c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        });
        rows.forEach((r, ri) => {
            r.forEach((v, ci) => {
                const cell = sh.getCell(ri + 2, ci + 1);
                cell.value = v;
                if (ri % 2 === 1)
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            });
        });
        if (totalRow) {
            const trIdx = rows.length + 2;
            totalRow.forEach((v, ci) => {
                const cell = sh.getCell(trIdx, ci + 1);
                cell.value = v;
                cell.font = { bold: true, color: { argb: NAVY } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            });
        }
        headers.forEach((_, i) => { sh.getColumn(i + 1).width = widths?.[i] ?? (i === 0 ? 36 : 18); });
    };
    addSection('Recettes', ['N° compte', 'Catégorie', 'Montant (XOF)', 'Part %'], data.recettes.map((r) => [r.code ?? '—', r.categorie, r.montant, data.totalRecettes ? Number(((r.montant / data.totalRecettes) * 100).toFixed(1)) : 0]), ['', 'TOTAL', data.totalRecettes, 100], [14, 36, 18, 12]);
    addSection('Dépenses', ['N° compte', 'Catégorie', 'Montant (XOF)', 'Part %'], data.depenses.map((d) => [d.code ?? '—', d.categorie, d.montant, data.totalDepenses ? Number(((d.montant / data.totalDepenses) * 100).toFixed(1)) : 0]), ['', 'TOTAL', data.totalDepenses, 100], [14, 36, 18, 12]);
    addSection('Évolution', ['Sous-période', 'Recettes', 'Dépenses', 'Résultat'], data.evolution.map((e) => [e.label, e.recettes, e.depenses, e.resultat]));
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
async function buildXlsxActifPassif(data, meta, theme) {
    const NAVY = (0, theme_service_1.hexToArgb)(theme.primary);
    const wb = new exceljs_1.default.Workbook();
    wb.creator = 'Afrikimmo-App';
    wb.created = new Date();
    const ws = wb.addWorksheet('Bilan');
    ws.mergeCells('A1:D1');
    ws.getCell('A1').value = meta.title;
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } };
    ws.getCell('A2').value = meta.subtitle ?? '';
    ws.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
    ws.getCell('A3').value = `Périmètre : ${data.scope.label}`;
    ws.getCell('A3').font = { color: { argb: 'FF64748B' } };
    let row = 5;
    const writeHeader = (left, right) => {
        [['A', left], ['B', 'Montant'], ['C', right], ['D', 'Montant']].forEach(([col, label]) => {
            const c = ws.getCell(`${col}${row}`);
            c.value = label;
            c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        });
        row++;
    };
    const writeRow = (left, leftAmt, right, rightAmt, section = false) => {
        ws.getCell(`A${row}`).value = left;
        ws.getCell(`B${row}`).value = leftAmt;
        ws.getCell(`C${row}`).value = right;
        ws.getCell(`D${row}`).value = rightAmt;
        if (section) {
            ['A', 'B', 'C', 'D'].forEach((col) => {
                ws.getCell(`${col}${row}`).font = { bold: true, color: { argb: NAVY } };
                ws.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            });
        }
        row++;
    };
    writeHeader('ACTIF', 'PASSIF');
    // On aligne sections par sections. Les longueurs sont différentes : on étend
    // la colonne la plus courte avec des lignes vides.
    const actifSections = [
        { title: 'Immobilisations', items: data.actif.immobilisations, total: data.actif.totalImmobilisations },
        { title: 'Créances clients', items: data.actif.creances, total: data.actif.totalCreances },
        { title: 'Échéances à recevoir', items: data.actif.echeances, total: data.actif.totalEcheances },
        { title: 'Trésorerie', items: data.actif.tresorerie, total: data.actif.totalTresorerie },
    ];
    const passifSections = [
        { title: 'Capitaux propres', items: [{ label: '—', montant: data.passif.capitauxPropres }], total: data.passif.capitauxPropres, mono: true },
        { title: 'Cautions reçues', items: data.passif.cautions, total: data.passif.totalCautions },
        { title: 'Avances reçues', items: data.passif.avances, total: data.passif.totalAvances },
        { title: 'Dettes propriétaires', items: data.passif.dettesProprietaires, total: data.passif.totalDettesProprietaires },
    ];
    const maxLen = Math.max(actifSections.reduce((s, sec) => s + sec.items.length + 1, 0), passifSections.reduce((s, sec) => s + sec.items.length + 1, 0));
    // Aplatit chaque colonne en lignes (titre de section + items)
    const flat = (sections) => {
        const out = [];
        for (const sec of sections) {
            out.push([sec.title, sec.total, true]);
            if (!sec.mono) {
                for (const it of sec.items)
                    out.push([`  ${it.label}`, it.montant, false]);
            }
        }
        while (out.length < maxLen)
            out.push(['', '', false]);
        return out;
    };
    const lhs = flat(actifSections);
    const rhs = flat(passifSections);
    for (let i = 0; i < maxLen; i++) {
        const [lLabel, lAmt, lSec] = lhs[i] ?? ['', '', false];
        const [rLabel, rAmt, rSec] = rhs[i] ?? ['', '', false];
        writeRow(lLabel, lAmt, rLabel, rAmt, lSec || rSec);
    }
    // Ligne TOTAL
    ws.getCell(`A${row}`).value = 'TOTAL ACTIF';
    ws.getCell(`B${row}`).value = data.totalActif;
    ws.getCell(`C${row}`).value = 'TOTAL PASSIF';
    ws.getCell(`D${row}`).value = data.totalPassif;
    ['A', 'B', 'C', 'D'].forEach((col) => {
        ws.getCell(`${col}${row}`).font = { bold: true, color: { argb: NAVY } };
        ws.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    });
    row += 2;
    ws.getCell(`A${row}`).value = 'Méthodologie : valeurs indicatives, capitaux propres par bouclage, dettes propriétaires approximées.';
    ws.getCell(`A${row}`).font = { italic: true, color: { argb: 'FF94A3B8' } };
    ws.mergeCells(`A${row}:D${row}`);
    ws.getColumn(1).width = 40;
    ws.getColumn(2).width = 18;
    ws.getColumn(3).width = 40;
    ws.getColumn(4).width = 18;
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
// ── Handlers IPC ─────────────────────────────────────────────────────────────
function registerBilanIPC() {
    electron_1.ipcMain.handle('bilan:getResultat', async (_event, payload) => {
        try {
            const session = (0, auth_service_1.getSession)(payload?.token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkBilanRole(session);
            const parsed = resultatPayloadSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const db = (0, db_service_1.getDb)();
            const period = computePeriod(parsed.data.periodType, parsed.data.periodStart, parsed.data.periodEnd);
            const { scope, scopeId } = parsed.data;
            const totals = await computePeriodTotals(db, period.start, period.end, scope, scopeId);
            // Série temporelle. La direction (SUPER_ADMIN / ADMIN) voit l'historique
            // complet ; MANAGER / ACCOUNTANT sont limités aux 6 dernières sous-périodes
            // (6 derniers mois sur une vue mensuelle), à l'écran comme à l'export.
            const isDirector = ACTIF_PASSIF_ROLES.includes(session.role);
            const allBuckets = buildEvolutionBuckets(period);
            const buckets = isDirector ? allBuckets : allBuckets.slice(-6);
            const evolution = [];
            for (const b of buckets) {
                const t = await computePeriodTotals(db, b.start, b.end, scope, scopeId);
                evolution.push({ label: b.label, recettes: t.totalRecettes, depenses: t.totalDepenses, resultat: t.resultat });
            }
            const recettes = Object.entries(totals.recettesByCategory)
                .map(([categorie, montant]) => ({ categorie, montant, code: totals.recettesCodes[categorie] ?? null }))
                .sort((a, b) => b.montant - a.montant);
            const depenses = Object.entries(totals.depensesByCategory)
                .map(([categorie, montant]) => ({ categorie, montant, code: totals.depensesCodes[categorie] ?? null }))
                .sort((a, b) => b.montant - a.montant);
            return {
                success: true,
                data: {
                    periode: { label: period.label, start: period.start.toISOString(), end: period.end.toISOString() },
                    scope: { type: scope, id: scopeId, label: await resolveScopeLabel(db, scope, scopeId) },
                    recettes,
                    depenses,
                    totalRecettes: totals.totalRecettes,
                    totalDepenses: totals.totalDepenses,
                    resultat: totals.resultat,
                    evolution,
                },
            };
        }
        catch (err) {
            logger_1.default.error('bilan:getResultat error', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('bilan:getActifPassif', async (_event, payload) => {
        try {
            const session = (0, auth_service_1.getSession)(payload?.token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkActifPassifRole(session);
            const parsed = actifPassifPayloadSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const db = (0, db_service_1.getDb)();
            const asOfDate = parsed.data.asOfDate ? new Date(parsed.data.asOfDate) : new Date();
            if (Number.isNaN(asOfDate.getTime()))
                return { success: false, error: 'Date d\'arrêté invalide' };
            // Inclut la journée complète.
            const endOfDay = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate(), 23, 59, 59);
            const data = await computeActifPassif(db, endOfDay, parsed.data.scope, parsed.data.scopeId);
            return { success: true, data };
        }
        catch (err) {
            logger_1.default.error('bilan:getActifPassif error', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('bilan:export', async (_event, payload) => {
        try {
            const session = (0, auth_service_1.getSession)(payload?.token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkBilanRole(session);
            const parsed = exportPayloadSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            // Bilan Actif/Passif : restriction direction.
            if (parsed.data.type === 'actif-passif')
                checkActifPassifRole(session);
            const parent = electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0] ?? undefined;
            const baseName = `bilan-${parsed.data.type}-${new Date().toISOString().slice(0, 10)}`;
            const ext = parsed.data.format;
            const dialogRes = await electron_1.dialog.showSaveDialog(parent, {
                title: 'Enregistrer le bilan',
                defaultPath: path_1.default.join(electron_1.app.getPath('documents'), `${baseName}.${ext}`),
                filters: [{ name: ext === 'pdf' ? 'Document PDF' : 'Classeur Excel', extensions: [ext] }],
            });
            if (dialogRes.canceled || !dialogRes.filePath) {
                return { success: true, data: { canceled: true } };
            }
            const [theme, company] = await Promise.all([
                (0, theme_service_1.getThemeForUser)(session.userId),
                getCompanyHeader(),
            ]);
            let fileBuffer;
            if (parsed.data.type === 'resultat') {
                const data = parsed.data.data;
                if (parsed.data.format === 'pdf') {
                    const html = buildResultatHtml(data, parsed.data.meta, company, theme);
                    fileBuffer = await (0, pdf_service_1.htmlToPdf)(html, { landscape: false });
                }
                else {
                    fileBuffer = await buildXlsxResultat(data, parsed.data.meta, theme);
                }
            }
            else {
                const data = parsed.data.data;
                if (parsed.data.format === 'pdf') {
                    const html = buildActifPassifHtml(data, parsed.data.meta, company, theme);
                    fileBuffer = await (0, pdf_service_1.htmlToPdf)(html, { landscape: true });
                }
                else {
                    fileBuffer = await buildXlsxActifPassif(data, parsed.data.meta, theme);
                }
            }
            fs_1.default.writeFileSync(dialogRes.filePath, fileBuffer);
            logger_1.default.info(`Export bilan ${parsed.data.type}/${ext} : ${dialogRes.filePath}`);
            return { success: true, data: { path: dialogRes.filePath } };
        }
        catch (err) {
            logger_1.default.error('bilan:export error', err.message);
            return { success: false, error: err.message };
        }
    });
}
