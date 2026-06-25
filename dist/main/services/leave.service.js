"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPOS_COMPENSATEUR_TYPE_CODES = void 0;
exports.seedDefaultLeaveTypes = seedDefaultLeaveTypes;
exports.getLeaveAccrual = getLeaveAccrual;
exports.workingDays = workingDays;
exports.computeLeaveBalance = computeLeaveBalance;
exports.computePayslipLeaveCounters = computePayslipLeaveCounters;
exports.approvedLeaveDaysInRange = approvedLeaveDaysInRange;
const db_service_1 = require("./db.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Congés & absences. Types de congés par défaut (contexte ivoirien), calcul des
 * jours ouvrés et du solde de congés payés.
 *
 * Acquisition par défaut : 2,2 jours ouvrables / mois de travail effectif
 * (paramétrable via AppSetting `leave.accrualPerMonth`). Le solde = jours acquis
 * depuis l'embauche − jours de congés payés approuvés.
 */
const DEFAULT_LEAVE_TYPES = [
    { code: 'CONGE_PAYE', name: 'Congé payé', isPaid: true, affectsBalance: true, color: '#2563EB' },
    { code: 'MALADIE', name: 'Congé maladie', isPaid: true, affectsBalance: false, color: '#DC2626' },
    { code: 'MATERNITE', name: 'Congé de maternité', isPaid: true, affectsBalance: false, color: '#DB2777' },
    { code: 'PATERNITE', name: 'Congé de paternité', isPaid: true, affectsBalance: false, color: '#7C3AED' },
    { code: 'EXCEPTIONNEL', name: 'Absence exceptionnelle (événement familial)', isPaid: true, affectsBalance: false, color: '#059669' },
    { code: 'SANS_SOLDE', name: 'Congé sans solde', isPaid: false, affectsBalance: false, color: '#64748B' },
    { code: 'ABSENCE', name: 'Absence non justifiée', isPaid: false, affectsBalance: false, color: '#B45309' },
];
/**
 * Types de congé constituant le « repos compensateur » affiché sur le bulletin :
 * cumul des congés maladie, maternité, paternité et absences exceptionnelles.
 */
exports.REPOS_COMPENSATEUR_TYPE_CODES = ['MALADIE', 'MATERNITE', 'PATERNITE', 'EXCEPTIONNEL'];
/** Crée les types de congés par défaut absents (idempotent). */
async function seedDefaultLeaveTypes() {
    const db = (0, db_service_1.getDb)();
    for (const t of DEFAULT_LEAVE_TYPES) {
        const exists = await db.leaveType.findUnique({ where: { code: t.code }, select: { id: true } });
        if (exists)
            continue;
        await db.leaveType.create({ data: t });
    }
    logger_1.default.info('Types de congés par défaut vérifiés');
}
const ACCRUAL_KEY = 'leave.accrualPerMonth';
const DEFAULT_ACCRUAL = 2.2;
/**
 * Date de démarrage de la comptabilisation des congés payés. Les droits des
 * années antérieures sont réputés déjà soldés (consommés) : l'acquisition
 * comme le décompte des jours pris ne débutent qu'à partir de cette date,
 * ou de la date d'embauche si celle-ci est postérieure.
 */
const ACCRUAL_START = new Date('2026-01-01T00:00:00');
async function getLeaveAccrual() {
    const row = await (0, db_service_1.getDb)().appSetting.findUnique({ where: { key: ACCRUAL_KEY } });
    const v = Number(row?.value);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_ACCRUAL;
}
/**
 * Nombre de jours ouvrés (lundi-vendredi) entre deux dates incluses.
 * Le champ reste modifiable côté formulaire pour les cas particuliers.
 */
function workingDays(start, end) {
    if (end < start)
        return 0;
    let count = 0;
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (d <= last) {
        const day = d.getDay();
        if (day !== 0 && day !== 6)
            count += 1;
        d.setDate(d.getDate() + 1);
    }
    return count;
}
/** Nombre de mois entiers écoulés entre deux dates (≥ 0). */
function monthsBetween(from, to) {
    let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate())
        m -= 1;
    return Math.max(0, m);
}
/** Calcule le solde de congés payés d'un employé. */
async function computeLeaveBalance(employeeId) {
    const db = (0, db_service_1.getDb)();
    const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { hireDate: true, createdAt: true } });
    const accrualPerMonth = await getLeaveAccrual();
    const startRef = employee?.hireDate ?? employee?.createdAt ?? new Date();
    // Acquisition à partir du max(embauche, 1er janvier 2026) : les congés des
    // années antérieures sont considérés déjà consommés (compteur remis à zéro).
    const accrualStart = new Date(Math.max(new Date(startRef).getTime(), ACCRUAL_START.getTime()));
    const monthsSinceHire = monthsBetween(accrualStart, new Date());
    const acquired = Math.round(monthsSinceHire * accrualPerMonth * 10) / 10;
    // Jours de congés payés approuvés (types affectant le solde) pris depuis le
    // début de comptabilisation : on ignore les congés antérieurs (déjà soldés).
    const approved = await db.leaveRequest.findMany({
        where: {
            employeeId, status: 'APPROUVE', deletedAt: null,
            type: { affectsBalance: true }, startDate: { gte: ACCRUAL_START },
        },
        select: { days: true },
    });
    const taken = Math.round(approved.reduce((s, r) => s + Number(r.days), 0) * 10) / 10;
    const remaining = Math.round((acquired - taken) * 10) / 10;
    return { accrualPerMonth, monthsSinceHire, acquired, taken, remaining };
}
const round1 = (n) => Math.round(n * 10) / 10;
/**
 * Compteurs affichés sur le bulletin de paie, pour l'année du bulletin :
 * - Congés payés : acquis = droits totaux depuis l'embauche, pris = demandes
 *   approuvées (types affectant le solde) sur l'année, restant = solde global.
 * - Repos compensateur : cumul des absences approuvées (maladie, maternité,
 *   paternité, exceptionnelle) sur l'année. Pas de notion d'acquis/restant
 *   (colonnes non applicables → null).
 */
async function computePayslipLeaveCounters(employeeId, year) {
    const db = (0, db_service_1.getDb)();
    const balance = await computeLeaveBalance(employeeId);
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const congeYear = await db.leaveRequest.findMany({
        where: {
            employeeId, status: 'APPROUVE', deletedAt: null,
            type: { affectsBalance: true }, startDate: { gte: start, lt: end },
        },
        select: { days: true },
    });
    const congeTakenYear = round1(congeYear.reduce((s, r) => s + Number(r.days), 0));
    const reposYear = await db.leaveRequest.findMany({
        where: {
            employeeId, status: 'APPROUVE', deletedAt: null,
            type: { code: { in: exports.REPOS_COMPENSATEUR_TYPE_CODES } }, startDate: { gte: start, lt: end },
        },
        select: { days: true },
    });
    const reposTakenYear = round1(reposYear.reduce((s, r) => s + Number(r.days), 0));
    return {
        year,
        conge: { acquired: balance.acquired, takenYear: congeTakenYear, remaining: balance.remaining },
        reposComp: { acquired: null, takenYear: reposTakenYear, remaining: null },
    };
}
/**
 * Jours de congé approuvés dont la date de début est dans [start, end[, ventilés
 * entre congés payés (types affectant le solde) et repos compensateur (cumul des
 * absences maladie / maternité / paternité / exceptionnelle).
 */
async function approvedLeaveDaysInRange(employeeId, start, end) {
    const db = (0, db_service_1.getDb)();
    const reqs = await db.leaveRequest.findMany({
        where: { employeeId, status: 'APPROUVE', deletedAt: null, startDate: { gte: start, lt: end } },
        select: { days: true, type: { select: { code: true, affectsBalance: true } } },
    });
    let congePaye = 0;
    let reposComp = 0;
    for (const r of reqs) {
        const d = Number(r.days);
        if (r.type.affectsBalance)
            congePaye += d;
        else if (exports.REPOS_COMPENSATEUR_TYPE_CODES.includes(r.type.code))
            reposComp += d;
    }
    return { congePaye: round1(congePaye), reposComp: round1(reposComp) };
}
