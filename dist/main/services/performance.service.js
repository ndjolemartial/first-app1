"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ser = exports.RANKING_ROSTER_KEY = void 0;
exports.periodBounds = periodBounds;
exports.quarterOf = quarterOf;
exports.computeMetricValue = computeMetricValue;
exports.computeLatenessLinesForEmployee = computeLatenessLinesForEmployee;
exports.computeUnjustifiedLatenessMinutes = computeUnjustifiedLatenessMinutes;
exports.latenessIncludesManagementRoles = latenessIncludesManagementRoles;
exports.latenessEligibleEmployeeIds = latenessEligibleEmployeeIds;
exports.scoreAgainstTarget = scoreAgainstTarget;
exports.weightsForPoste = weightsForPoste;
exports.computeEvaluationKpis = computeEvaluationKpis;
exports.rankingRoster = rankingRoster;
exports.computeRankingByKpi = computeRankingByKpi;
exports.computeRankingByEvaluation = computeRankingByEvaluation;
exports.defaultBasis = defaultBasis;
exports.seedDefaultKpis = seedDefaultKpis;
exports.seedKpiUnits = seedKpiUnits;
exports.computeRanking = computeRanking;
const db_service_1 = require("./db.service");
const settings_service_1 = require("./settings.service");
const attendance_service_1 = require("./attendance.service");
/** Rôles exclus par défaut des Retards & Départs précipités (calcul et affichage). */
const LATENESS_MANAGEMENT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Clé AppSetting : liste (JSON d'ids) des employés à inclure dans les classements. */
exports.RANKING_ROSTER_KEY = 'performance.rankingEmployeeIds';
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** Serialise en clonant (neutralise les Decimal Prisma pour l'IPC). */
const ser = (v) => JSON.parse(JSON.stringify(v));
exports.ser = ser;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
/** Lundi 00:00 de la semaine ISO contenant `d`. */
function isoWeekStart(d) {
    const day = (d.getDay() + 6) % 7; // 0 = lundi
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return start;
}
/** Numéro de semaine ISO (1–53). */
function isoWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
}
/** Date au format JJ/MM/AAAA. */
function fmtFR(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
/** Jour de fin **inclus** d'une période dont la borne `end` est exclusive. */
function lastDayInclusive(end) {
    return new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
}
/** Ajoute au libellé la plage de dates « (Du JJ/MM/AAAA au JJ/MM/AAAA) »
 *  (fin incluse). Ex. « Semaine 27 (Du 29/06/2026 au 05/07/2026) ». */
function withRange(label, start, end) {
    return `${label} (Du ${fmtFR(start)} au ${fmtFR(lastDayInclusive(end))})`;
}
/** Bornes [start, end[ d'une période contenant la date de référence. */
function periodBounds(periodType, ref) {
    const y = ref.getFullYear();
    switch (periodType) {
        case 'SEMAINE': {
            const start = isoWeekStart(ref);
            const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
            return { start, end, label: withRange(`Semaine ${isoWeekNumber(ref)}`, start, end) };
        }
        case 'MOIS': {
            const start = new Date(y, ref.getMonth(), 1);
            const end = new Date(y, ref.getMonth() + 1, 1);
            return { start, end, label: withRange(`${MOIS[ref.getMonth()]} ${y}`, start, end) };
        }
        case 'TRIMESTRE': {
            const q = Math.floor(ref.getMonth() / 3); // 0–3
            const start = new Date(y, q * 3, 1);
            const end = new Date(y, q * 3 + 3, 1);
            return { start, end, label: withRange(`T${q + 1} ${y}`, start, end) };
        }
        case 'SEMESTRE': {
            const s = ref.getMonth() < 6 ? 0 : 1;
            const start = new Date(y, s * 6, 1);
            const end = new Date(y, s * 6 + 6, 1);
            return { start, end, label: withRange(`S${s + 1} ${y}`, start, end) };
        }
        case 'ANNEE':
        default: {
            const start = new Date(y, 0, 1);
            const end = new Date(y + 1, 0, 1);
            return { start, end, label: withRange(`Année ${y}`, start, end) };
        }
    }
}
/** Trimestre (1–4) contenant la date, ou null. */
function quarterOf(ref) {
    return Math.floor(ref.getMonth() / 3) + 1;
}
/**
 * Valeur réelle d'un KPI pour un collaborateur sur [start, end[. Renvoie `null`
 * quand le KPI n'est pas mesurable automatiquement (source MANUAL, ou source
 * nominative sans compte utilisateur rattaché).
 */
async function computeMetricValue(db, employee, kpi, start, end) {
    const uid = employee.userId;
    // RECOVERY_RATE est un chiffre global entreprise (aucune attribution
    // personnelle), à l'inverse des autres métriques de la source ACCOUNTING.
    const needsUser = kpi.metric !== 'RECOVERY_RATE'
        && ['SALES', 'COMMISSIONS', 'ACCOUNTING', 'CRM', 'PROSPECTS', 'SOCIAL'].includes(kpi.source);
    if (needsUser && !uid)
        return null;
    switch (kpi.metric) {
        case 'SALES_COUNT': {
            return db.convention.count({
                where: { deletedAt: null, agentId: uid, signedAt: { gte: start, lt: end } },
            });
        }
        case 'SALES_AMOUNT': {
            const agg = await db.convention.aggregate({
                where: { deletedAt: null, agentId: uid, signedAt: { gte: start, lt: end } },
                _sum: { saleAmount: true },
            });
            return Number(agg._sum.saleAmount ?? 0);
        }
        case 'RESILIATION_COUNT': {
            // Conventions résiliées attribuées à l'agent, datées par leur date d'effet
            // (startDate). La résiliation est une convention de type dédié.
            return db.convention.count({
                where: {
                    deletedAt: null,
                    agentId: uid,
                    type: { in: ['RESILIATION', 'AVENANT_RESILIATION_HERITE'] },
                    startDate: { gte: start, lt: end },
                },
            });
        }
        case 'COMMISSION_AMOUNT': {
            const agg = await db.commission.aggregate({
                where: { deletedAt: null, userId: uid, status: 'PAYEE', paidAt: { gte: start, lt: end } },
                _sum: { amount: true },
            });
            return Number(agg._sum.amount ?? 0);
        }
        case 'ENCAISSEMENT_AMOUNT': {
            const agg = await db.payment.aggregate({
                where: {
                    paidAt: { gte: start, lt: end },
                    invoice: { deletedAt: null, convention: { agentId: uid } },
                },
                _sum: { amount: true },
            });
            return Number(agg._sum.amount ?? 0);
        }
        case 'RECOVERY_RATE': {
            // Taux de recouvrement — chiffre global entreprise (aucune attribution
            // personnelle) : sur les factures dont l'échéance (dueDate) tombe dans
            // la période, part du montant dû effectivement réglée à ce jour (tous
            // règlements confondus, même postérieurs à la période).
            const invoices = await db.invoice.findMany({
                where: {
                    deletedAt: null,
                    status: { notIn: ['BROUILLON', 'ANNULEE'] },
                    dueDate: { gte: start, lt: end },
                },
                select: { id: true, total: true },
            });
            if (!invoices.length)
                return null;
            const totalDue = invoices.reduce((a, inv) => a + Number(inv.total), 0);
            if (totalDue <= 0)
                return null;
            const paidAgg = await db.payment.aggregate({
                where: { invoiceId: { in: invoices.map((inv) => inv.id) } },
                _sum: { amount: true },
            });
            const totalPaid = Number(paidAgg._sum.amount ?? 0);
            return Math.round((totalPaid / totalDue) * 1000) / 10; // %
        }
        case 'CRM_ACTIVITIES_DONE': {
            return db.crmActivity.count({
                where: { userId: uid, status: 'TRAITE', completedAt: { gte: start, lt: end } },
            });
        }
        case 'CRM_VISITS': {
            return db.crmActivity.count({
                where: { userId: uid, type: 'VISITE', completedAt: { gte: start, lt: end } },
            });
        }
        case 'CRM_CALLS': {
            return db.crmActivity.count({
                where: { userId: uid, type: 'APPEL', completedAt: { gte: start, lt: end } },
            });
        }
        case 'PROSPECT_CONVERSION_RATE': {
            // Taux de conversion de la cohorte de prospects assignés à l'agent et créés
            // dans la période : part de ces prospects désormais convertis en clients.
            const [total, converted] = await Promise.all([
                db.prospect.count({
                    where: { deletedAt: null, assignedToId: uid, createdAt: { gte: start, lt: end } },
                }),
                db.prospect.count({
                    where: { deletedAt: null, assignedToId: uid, createdAt: { gte: start, lt: end }, convertedAt: { not: null } },
                }),
            ]);
            if (total === 0)
                return null;
            return Math.round((converted / total) * 1000) / 10; // %
        }
        case 'NEW_POTENTIAL_PROSPECTS': {
            // Nouveaux prospects (créés dans la période, assignés à l'agent) dont le
            // statut actuel est « Client potentiel » (QUALIFIE) ou « Négociation en
            // cours » (NEGOCIATION_EN_COURS).
            return db.prospect.count({
                where: {
                    deletedAt: null,
                    assignedToId: uid,
                    createdAt: { gte: start, lt: end },
                    status: { in: ['QUALIFIE', 'NEGOCIATION_EN_COURS'] },
                },
            });
        }
        case 'SOCIAL_PUBLICATIONS_COUNT': {
            return db.socialPublication.count({
                where: { deletedAt: null, authorId: uid, publishedAt: { gte: start, lt: end } },
            });
        }
        case 'SOCIAL_VIEWS': {
            const agg = await db.socialPublication.aggregate({
                where: { deletedAt: null, authorId: uid, publishedAt: { gte: start, lt: end } },
                _sum: { viewsCount: true },
            });
            return agg._sum.viewsCount ?? 0;
        }
        case 'SOCIAL_INTERACTIONS': {
            const agg = await db.socialPublication.aggregate({
                where: { deletedAt: null, authorId: uid, publishedAt: { gte: start, lt: end } },
                _sum: { interactionsCount: true },
            });
            return agg._sum.interactionsCount ?? 0;
        }
        case 'SOCIAL_FOLLOWERS_GROWTH': {
            // Croissance nette d'abonnés sur la période, cumulée sur les plateformes
            // dont l'agent est responsable : dernier relevé connu en fin de période
            // moins dernier relevé connu avant le début de la période.
            const platforms = await db.socialPlatform.findMany({
                where: { deletedAt: null, responsibleId: uid },
                select: { id: true },
            });
            if (!platforms.length)
                return null;
            let growth = 0;
            for (const p of platforms) {
                const [before, atEnd] = await Promise.all([
                    db.socialFollowerSnapshot.findFirst({ where: { platformId: p.id, date: { lt: start } }, orderBy: { date: 'desc' } }),
                    db.socialFollowerSnapshot.findFirst({ where: { platformId: p.id, date: { lt: end } }, orderBy: { date: 'desc' } }),
                ]);
                growth += (atEnd?.followersCount ?? 0) - (before?.followersCount ?? 0);
            }
            return growth;
        }
        case 'ATTENDANCE_RATE': {
            const records = await db.attendanceRecord.findMany({
                where: { employeeId: employee.id, date: { gte: start, lt: end } },
                select: { status: true },
            });
            const present = records.filter((r) => r.status === 'PRESENT').length;
            const counted = records.filter((r) => ['PRESENT', 'ABSENT', 'MALADIE'].includes(r.status)).length;
            if (counted === 0)
                return null;
            return Math.round((present / counted) * 1000) / 10; // %
        }
        case 'OVERTIME_HOURS': {
            const agg = await db.attendanceRecord.aggregate({
                where: { employeeId: employee.id, date: { gte: start, lt: end } },
                _sum: { overtimeHours: true },
            });
            return Number(agg._sum.overtimeHours ?? 0);
        }
        case 'ABSENCE_DAYS': {
            return db.attendanceRecord.count({
                where: { employeeId: employee.id, date: { gte: start, lt: end }, status: 'ABSENT' },
            });
        }
        case 'LATE_EARLY_DEPARTURE_HOURS': {
            // Par défaut, ne pas calculer ce KPI pour un employé lié à un compte
            // SUPER_ADMIN/ADMIN/MANAGER (paramétrable dans Paramètres).
            if (uid && !(await latenessIncludesManagementRoles())) {
                const linkedUser = await db.user.findUnique({ where: { id: uid }, select: { role: true } });
                if (linkedUser && LATENESS_MANAGEMENT_ROLES.includes(linkedUser.role))
                    return null;
            }
            const minutes = await computeUnjustifiedLatenessMinutes(db, employee.id, start, end);
            return Math.round((minutes / 60) * 100) / 100; // heures, 2 décimales
        }
        case 'IT_INNOVATIONS_IMPLEMENTED': {
            // Nombre d'innovations IT dont les 3 phases sont validées (mise en œuvre
            // complète, 100%) sur la période, datées par la validation de la phase 3.
            return db.itInnovation.count({
                where: {
                    deletedAt: null,
                    employeeId: employee.id,
                    status: 'VALIDEE',
                    phase3ValidatedAt: { gte: start, lt: end },
                },
            });
        }
        case 'MANUAL_VALUE':
        default:
            return null;
    }
}
/**
 * Journées de retard d'arrivée / départ anticipé d'un employé sur [start, end[
 * (uniquement les journées `PRESENT` avec pointage), avec la justification
 * éventuellement déjà enregistrée. Les seuils (arrivée/départ attendus) sont
 * ceux paramétrés pour le pointage QR (`attendance.expectedArrival/Departure`),
 * sauf pour une journée déclarée `AttendanceSpecialDay` (journée continue se
 * terminant à 12h/14h, valable pour toute l'entreprise — Paramètres → Retards
 * & Départs précipités), dont les seuils remplacent alors les seuils globaux
 * pour cette seule date.
 */
async function computeLatenessLinesForEmployee(db, employeeId, start, end) {
    const { expectedArrival, expectedDeparture } = await (0, attendance_service_1.getAttendanceClockSettings)();
    const defaultArrivalThreshold = (0, attendance_service_1.thresholdMinutes)(expectedArrival);
    const defaultDepartureThreshold = (0, attendance_service_1.thresholdMinutes)(expectedDeparture);
    const [records, justifications, specialDays] = await Promise.all([
        db.attendanceRecord.findMany({
            where: { employeeId, date: { gte: start, lt: end }, status: 'PRESENT' },
            select: { date: true, arrivalTime: true, departureTime: true },
            orderBy: { date: 'asc' },
        }),
        db.attendanceDelayJustification.findMany({
            where: { employeeId, date: { gte: start, lt: end } },
            select: {
                id: true, date: true, justified: true, leaveRequestId: true, crmActivityId: true, justifiedById: true, justifiedAt: true,
                tolerated: true, toleratedById: true, toleratedAt: true, notes: true,
            },
        }),
        db.attendanceSpecialDay.findMany({
            where: { date: { gte: start, lt: end } },
            select: { date: true, expectedArrival: true, expectedDeparture: true },
        }),
    ]);
    const justByDate = new Map(justifications.map((j) => [j.date.getTime(), j]));
    const specialByDate = new Map(specialDays.map((s) => [s.date.getTime(), s]));
    const lines = [];
    for (const r of records) {
        const special = specialByDate.get(r.date.getTime());
        const arrivalThreshold = special?.expectedArrival ? (0, attendance_service_1.thresholdMinutes)(special.expectedArrival) : defaultArrivalThreshold;
        const departureThreshold = special ? (0, attendance_service_1.thresholdMinutes)(special.expectedDeparture) : defaultDepartureThreshold;
        const lateMinutes = r.arrivalTime ? Math.max(0, (0, attendance_service_1.minutesOfDay)(r.arrivalTime) - arrivalThreshold) : 0;
        const earlyMinutes = r.departureTime ? Math.max(0, departureThreshold - (0, attendance_service_1.minutesOfDay)(r.departureTime)) : 0;
        const totalMinutes = lateMinutes + earlyMinutes;
        if (totalMinutes <= 0)
            continue;
        const j = justByDate.get(r.date.getTime());
        lines.push({
            employeeId,
            date: r.date,
            arrivalTime: r.arrivalTime,
            departureTime: r.departureTime,
            lateMinutes,
            earlyMinutes,
            totalMinutes,
            justification: j
                ? {
                    id: j.id, justified: j.justified, leaveRequestId: j.leaveRequestId, crmActivityId: j.crmActivityId,
                    justifiedById: j.justifiedById, justifiedAt: j.justifiedAt,
                    tolerated: j.tolerated, toleratedById: j.toleratedById, toleratedAt: j.toleratedAt,
                    notes: j.notes,
                }
                : null,
        });
    }
    return lines;
}
/**
 * Cumul (minutes) des journées de retard/départ précipité NON justifiées ET
 * NON tolérées sur [start, end[ — c'est ce cumul, et lui seul, qui alimente
 * le KPI `LATE_EARLY_DEPARTURE_HOURS` (les journées tolérées, comme les
 * journées justifiées, n'y sont jamais comptées).
 */
async function computeUnjustifiedLatenessMinutes(db, employeeId, start, end) {
    const lines = await computeLatenessLinesForEmployee(db, employeeId, start, end);
    return lines
        .filter((l) => !l.justification?.justified && !l.justification?.tolerated)
        .reduce((sum, l) => sum + l.totalMinutes, 0);
}
/**
 * Indique si les Retards & Départs précipités des employés liés à un compte
 * SUPER_ADMIN/ADMIN/MANAGER doivent être pris en compte (calcul + affichage).
 * Désactivé par défaut (paramétrable dans Paramètres).
 */
async function latenessIncludesManagementRoles() {
    return (await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.latenessIncludeManagementRoles)) === 'true';
}
/** Identifiants des employés liés à un compte utilisateur SUPER_ADMIN/ADMIN/MANAGER. */
async function managementLinkedEmployeeIds(db, employees) {
    const userIds = employees.map((e) => e.userId).filter((id) => id != null);
    if (!userIds.length)
        return new Set();
    const users = await db.user.findMany({ where: { id: { in: userIds }, role: { in: LATENESS_MANAGEMENT_ROLES } }, select: { id: true } });
    const managementUserIds = new Set(users.map((u) => u.id));
    return new Set(employees.filter((e) => e.userId != null && managementUserIds.has(e.userId)).map((e) => e.id));
}
/**
 * Identifiants des employés dont le poste a une pondération non nulle sur les
 * KPI `ABSENCE_DAYS` et `ATTENDANCE_RATE` (défaut : poids 1 si aucun profil ou
 * si le KPI n'y figure pas — cf. `weightsForPoste`). Les employés sans poste
 * sont inclus par défaut (même convention de repli). Par défaut, les employés
 * liés à un compte SUPER_ADMIN/ADMIN/MANAGER sont exclus (paramétrable).
 */
async function latenessEligibleEmployeeIds(db) {
    const [absKpi, attKpi, includeManagement] = await Promise.all([
        db.kpiDefinition.findFirst({ where: { metric: 'ABSENCE_DAYS' }, select: { id: true } }),
        db.kpiDefinition.findFirst({ where: { metric: 'ATTENDANCE_RATE' }, select: { id: true } }),
        latenessIncludesManagementRoles(),
    ]);
    if (!absKpi || !attKpi)
        return [];
    const employees = await db.employee.findMany({ where: { deletedAt: null }, select: { id: true, poste: true, userId: true } });
    const excludedIds = includeManagement ? new Set() : await managementLinkedEmployeeIds(db, employees);
    const posteEligibility = new Map();
    const result = [];
    for (const e of employees) {
        if (excludedIds.has(e.id))
            continue;
        const key = e.poste ?? '__NO_POSTE__';
        let eligible = posteEligibility.get(key);
        if (eligible === undefined) {
            const weights = await weightsForPoste(db, e.poste);
            const wAbs = weights.get(absKpi.id) ?? 1;
            const wAtt = weights.get(attKpi.id) ?? 1;
            eligible = wAbs !== 0 && wAtt !== 0;
            posteEligibility.set(key, eligible);
        }
        if (eligible)
            result.push(e.id);
    }
    return result;
}
/** Note absolue d'une valeur au regard d'une cible (0–100, bornée à 100). */
function scoreAgainstTarget(actual, target, direction) {
    if (!(target > 0))
        return 0;
    const ratio = direction === 'LOWER_BETTER'
        ? (actual <= 0 ? 1 : target / actual)
        : actual / target;
    return Math.round(clamp(ratio, 0, 1) * 1000) / 10;
}
// ── Pondération par poste ────────────────────────────────────────────────────
/** Poids des KPI (id → poids) pour un poste, depuis son profil actif. */
async function weightsForPoste(db, poste) {
    const map = new Map();
    if (!poste)
        return map;
    const profile = await db.performanceWeightProfile.findFirst({
        where: { deletedAt: null, isActive: true, poste },
        orderBy: { updatedAt: 'desc' },
        include: { lines: true },
    });
    if (!profile)
        return map;
    for (const l of profile.lines)
        map.set(l.kpiDefinitionId, Number(l.weight));
    return map;
}
/**
 * Calcule les lignes KPI d'un collaborateur pour une période, en notant chaque
 * KPI au regard de sa cible (ligne existante ou cible par défaut). Retourne les
 * lignes et la note globale pondérée (0–100).
 */
async function computeEvaluationKpis(db, employee, poste, start, end, targets = new Map()) {
    const kpis = (await db.kpiDefinition.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { id: 'asc' },
    }));
    const weights = await weightsForPoste(db, poste);
    const lines = [];
    let scoreSum = 0;
    let weightSum = 0;
    for (const kpi of kpis) {
        const actual = await computeMetricValue(db, employee, kpi, start, end);
        if (actual === null)
            continue; // KPI non mesurable automatiquement
        const target = targets.get(kpi.id) ?? (kpi.defaultTarget != null ? Number(kpi.defaultTarget) : null);
        const score = target != null ? scoreAgainstTarget(actual, target, kpi.direction) : null;
        const weight = weights.get(kpi.id) ?? 1;
        lines.push({ kpiDefinitionId: kpi.id, label: kpi.label, weight, targetValue: target, actualValue: actual, score });
        if (score != null) {
            scoreSum += score * weight;
            weightSum += weight;
        }
    }
    const globalScore = weightSum > 0 ? Math.round((scoreSum / weightSum) * 10) / 10 : 0;
    return { lines, globalScore };
}
/**
 * Liste (ids) des employés à classer, définie par l'admin dans la configuration.
 * `null` = non configurée → tous les employés actifs sont classés (défaut).
 */
async function rankingRoster(db) {
    const raw = await (0, settings_service_1.getSetting)(exports.RANKING_ROSTER_KEY);
    if (!raw)
        return null;
    try {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids) && ids.length > 0)
            return ids.map((v) => Number(v)).filter((v) => Number.isFinite(v));
        return null;
    }
    catch {
        return null;
    }
}
async function activeEmployees(db, roster) {
    const where = { deletedAt: null, status: 'ACTIF' };
    if (roster && roster.length)
        where.id = { in: roster };
    return db.employee.findMany({
        where,
        select: { id: true, userId: true, matricule: true, firstName: true, lastName: true, poste: true, departement: true },
    });
}
const fullName = (e) => `${e.lastName} ${e.firstName}`.trim();
/**
 * Classement fondé sur un score KPI pondéré, normalisé RELATIVEMENT à la cohorte
 * (pour chaque KPI : meilleur = 100). Adapté aux périodes courtes sans cible.
 */
async function computeRankingByKpi(db, start, end, roster) {
    const employees = await activeEmployees(db, roster);
    const kpis = (await db.kpiDefinition.findMany({
        where: { deletedAt: null, isActive: true, source: { not: 'MANUAL' } },
        orderBy: { id: 'asc' },
    }));
    // Valeurs brutes : rawByEmp[empId][kpiId] = actual
    const rawByEmp = new Map();
    for (const emp of employees) {
        const m = new Map();
        for (const kpi of kpis) {
            const v = await computeMetricValue(db, { id: emp.id, userId: emp.userId }, kpi, start, end);
            if (v !== null)
                m.set(kpi.id, v);
        }
        rawByEmp.set(emp.id, m);
    }
    // Extremum par KPI pour la normalisation relative.
    const bestByKpi = new Map();
    for (const kpi of kpis) {
        let best = kpi.direction === 'LOWER_BETTER' ? Number.POSITIVE_INFINITY : 0;
        for (const emp of employees) {
            const v = rawByEmp.get(emp.id)?.get(kpi.id);
            if (v == null)
                continue;
            best = kpi.direction === 'LOWER_BETTER' ? Math.min(best, v) : Math.max(best, v);
        }
        bestByKpi.set(kpi.id, best);
    }
    const entries = [];
    for (const emp of employees) {
        const weights = await weightsForPoste(db, emp.poste);
        const raw = rawByEmp.get(emp.id);
        let scoreSum = 0;
        let weightSum = 0;
        for (const kpi of kpis) {
            const v = raw.get(kpi.id);
            if (v == null)
                continue;
            const best = bestByKpi.get(kpi.id) ?? 0;
            let norm = 0;
            if (kpi.direction === 'LOWER_BETTER') {
                norm = v <= 0 ? 100 : (Number.isFinite(best) && best > 0 ? clamp(best / v, 0, 1) * 100 : 0);
            }
            else {
                norm = best > 0 ? clamp(v / best, 0, 1) * 100 : 0;
            }
            const weight = weights.get(kpi.id) ?? 1;
            scoreSum += norm * weight;
            weightSum += weight;
        }
        entries.push({
            employeeId: emp.id,
            employeeName: fullName(emp),
            matricule: emp.matricule,
            poste: emp.poste,
            departement: emp.departement,
            score: weightSum > 0 ? Math.round((scoreSum / weightSum) * 10) / 10 : 0,
            rank: 0,
            linked: emp.userId != null,
        });
    }
    return rankSort(entries);
}
/**
 * Classement fondé sur la note de la dernière évaluation validée correspondant à
 * la période (par année, et trimestre pour une période trimestrielle).
 */
async function computeRankingByEvaluation(db, periodType, ref, roster) {
    const employees = await activeEmployees(db, roster);
    const year = ref.getFullYear();
    const validated = ['VALIDEE_DIRECTION', 'CLOTUREE'];
    const where = { deletedAt: null, status: { in: validated }, year };
    if (periodType === 'TRIMESTRE')
        where.quarter = quarterOf(ref);
    const entries = [];
    for (const emp of employees) {
        const evalRow = await db.performanceEvaluation.findFirst({
            where: { ...where, employeeId: emp.id },
            orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
            select: { globalScore: true },
        });
        if (!evalRow)
            continue;
        entries.push({
            employeeId: emp.id,
            employeeName: fullName(emp),
            matricule: emp.matricule,
            poste: emp.poste,
            departement: emp.departement,
            score: Number(evalRow.globalScore ?? 0),
            rank: 0,
            linked: emp.userId != null,
        });
    }
    return rankSort(entries);
}
/** Tri décroissant + attribution des rangs (ex æquo = même rang). */
function rankSort(entries) {
    entries.sort((a, b) => b.score - a.score);
    let rank = 0;
    let prev = null;
    entries.forEach((e, i) => {
        if (prev === null || e.score < prev)
            rank = i + 1;
        e.rank = rank;
        prev = e.score;
    });
    return entries;
}
/** Base par défaut d'un classement selon la période (mixte). */
function defaultBasis(periodType) {
    return periodType === 'SEMAINE' || periodType === 'MOIS' ? 'KPI' : 'EVALUATION';
}
/**
 * Amorce un catalogue de KPI par défaut (idempotent, sur le `code` unique) pour
 * que le module soit immédiatement exploitable. N'écrase aucun KPI existant.
 */
async function seedDefaultKpis() {
    const db = (0, db_service_1.getDb)();
    const defaults = [
        { code: 'SALES_COUNT', label: 'Nombre de ventes signées', category: 'Commercial', source: 'SALES', metric: 'SALES_COUNT', unit: 'nb', direction: 'HIGHER_BETTER' },
        { code: 'SALES_AMOUNT', label: 'Montant des ventes signées', category: 'Commercial', source: 'SALES', metric: 'SALES_AMOUNT', unit: 'FCFA', direction: 'HIGHER_BETTER' },
        { code: 'RESILIATION_COUNT', label: 'Nombre de conventions résiliées', category: 'Commercial', source: 'SALES', metric: 'RESILIATION_COUNT', unit: 'nb', direction: 'LOWER_BETTER' },
        { code: 'COMMISSION_AMOUNT', label: 'Commissions encaissées', category: 'Commercial', source: 'COMMISSIONS', metric: 'COMMISSION_AMOUNT', unit: 'FCFA', direction: 'HIGHER_BETTER' },
        { code: 'ENCAISSEMENT_AMOUNT', label: 'Chiffre d’affaire réalisé', category: 'Finance', source: 'ACCOUNTING', metric: 'ENCAISSEMENT_AMOUNT', unit: 'FCFA', direction: 'HIGHER_BETTER' },
        { code: 'RECOVERY_RATE', label: 'Taux de recouvrement', category: 'Finance', source: 'ACCOUNTING', metric: 'RECOVERY_RATE', unit: '%', direction: 'HIGHER_BETTER' },
        { code: 'CRM_ACTIVITIES_DONE', label: 'Activités CRM traitées', category: 'Activité', source: 'CRM', metric: 'CRM_ACTIVITIES_DONE', unit: 'nb', direction: 'HIGHER_BETTER' },
        { code: 'CRM_VISITS', label: 'Visites, Sorties en Clientèle ou Courses réalisées', category: 'Activité', source: 'CRM', metric: 'CRM_VISITS', unit: 'nb', direction: 'HIGHER_BETTER' },
        { code: 'PROSPECT_CONVERSION_RATE', label: 'Taux de conversion prospects → clients', category: 'Commercial', source: 'PROSPECTS', metric: 'PROSPECT_CONVERSION_RATE', unit: '%', direction: 'HIGHER_BETTER' },
        { code: 'NEW_POTENTIAL_PROSPECTS', label: 'Nouveaux Clients potentiels', category: 'Commercial', source: 'PROSPECTS', metric: 'NEW_POTENTIAL_PROSPECTS', unit: 'nb', direction: 'HIGHER_BETTER' },
        { code: 'SOCIAL_PUBLICATIONS_COUNT', label: 'Publications & articles réalisés', category: 'Réseaux sociaux & Web', source: 'SOCIAL', metric: 'SOCIAL_PUBLICATIONS_COUNT', unit: 'nb', direction: 'HIGHER_BETTER' },
        { code: 'SOCIAL_VIEWS', label: 'Vues générées (réseaux sociaux & web)', category: 'Réseaux sociaux & Web', source: 'SOCIAL', metric: 'SOCIAL_VIEWS', unit: 'vues', direction: 'HIGHER_BETTER' },
        { code: 'SOCIAL_INTERACTIONS', label: 'Interactions générées (réseaux sociaux & web)', category: 'Réseaux sociaux & Web', source: 'SOCIAL', metric: 'SOCIAL_INTERACTIONS', unit: 'interactions', direction: 'HIGHER_BETTER' },
        { code: 'SOCIAL_FOLLOWERS_GROWTH', label: 'Croissance du nombre d’abonnés', category: 'Réseaux sociaux & Web', source: 'SOCIAL', metric: 'SOCIAL_FOLLOWERS_GROWTH', unit: 'nb', direction: 'HIGHER_BETTER' },
        { code: 'ATTENDANCE_RATE', label: 'Taux de présence', category: 'Assiduité', source: 'ATTENDANCE', metric: 'ATTENDANCE_RATE', unit: '%', direction: 'HIGHER_BETTER' },
        { code: 'ABSENCE_DAYS', label: 'Jours d’absence', category: 'Assiduité', source: 'ATTENDANCE', metric: 'ABSENCE_DAYS', unit: 'j', direction: 'LOWER_BETTER' },
        { code: 'LATE_EARLY_DEPARTURE_HOURS', label: 'Taux de retard ou de Départ précipité', category: 'Assiduité', source: 'ATTENDANCE', metric: 'LATE_EARLY_DEPARTURE_HOURS', unit: 'h', direction: 'LOWER_BETTER' },
        { code: 'IT_INNOVATIONS_IMPLEMENTED', label: 'Nombre d’innovations IT mises en œuvre', category: 'Innovation IT', source: 'IT_INNOVATION', metric: 'IT_INNOVATIONS_IMPLEMENTED', unit: 'nb', direction: 'HIGHER_BETTER' },
    ];
    for (const d of defaults) {
        const exists = await db.kpiDefinition.findFirst({ where: { code: d.code }, select: { id: true } });
        if (!exists)
            await db.kpiDefinition.create({ data: d });
    }
}
/**
 * Amorce le référentiel des unités de KPI (idempotent) : unités usuelles + toute
 * unité déjà utilisée par un KPI existant. Sur le `label` unique, sans écraser.
 */
async function seedKpiUnits() {
    const db = (0, db_service_1.getDb)();
    const defaults = ['FCFA', '%', 'nb', 'h', 'jours', 'points', 'm²', 'm³'];
    const used = await db.kpiDefinition.findMany({
        where: { deletedAt: null, unit: { not: null } },
        select: { unit: true },
        distinct: ['unit'],
    });
    const labels = new Set(defaults);
    for (const u of used) {
        const l = (u.unit ?? '').trim();
        if (l)
            labels.add(l);
    }
    for (const label of labels) {
        const exists = await db.kpiUnit.findUnique({ where: { label }, select: { id: true } });
        if (!exists)
            await db.kpiUnit.create({ data: { label } });
    }
}
/** Calcule un classement complet (choisit la base si non imposée). */
async function computeRanking(db, periodType, ref, basis) {
    const period = periodBounds(periodType, ref);
    const chosen = basis ?? defaultBasis(periodType);
    const roster = await rankingRoster(db);
    let entries;
    if (chosen === 'EVALUATION') {
        entries = await computeRankingByEvaluation(db, periodType, ref, roster);
        // Repli sur les KPI si aucune évaluation validée sur la période.
        if (entries.length === 0) {
            return { basis: 'KPI', period, entries: await computeRankingByKpi(db, period.start, period.end, roster) };
        }
    }
    else {
        entries = await computeRankingByKpi(db, period.start, period.end, roster);
    }
    return { basis: chosen, period, entries };
}
