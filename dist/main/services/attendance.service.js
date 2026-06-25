"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkHoursPerDay = getWorkHoursPerDay;
exports.attendanceMonthSummary = attendanceMonthSummary;
exports.computeOvertimeAmount = computeOvertimeAmount;
const db_service_1 = require("./db.service");
/**
 * Pointage / heures. Agrégats mensuels (présence, heures, heures
 * supplémentaires) et valorisation des heures supplémentaires pour la paie.
 *
 * Paramètres (AppSetting) :
 *  - `attendance.monthlyHours`      : base mensuelle d'heures (défaut 173,33) ;
 *  - `attendance.overtimeMajoration`: majoration des heures sup. en % (défaut 15).
 */
const MONTHLY_HOURS_KEY = 'attendance.monthlyHours';
const OVERTIME_MAJ_KEY = 'attendance.overtimeMajoration';
const HOURS_PER_DAY_KEY = 'attendance.hoursPerDay';
const DEFAULT_MONTHLY_HOURS = 173.33;
const DEFAULT_OVERTIME_MAJ = 15;
const DEFAULT_HOURS_PER_DAY = 8;
/** Nombre d'heures de travail par jour (paramétrable, défaut 8h). */
async function getWorkHoursPerDay() {
    const row = await (0, db_service_1.getDb)().appSetting.findUnique({ where: { key: HOURS_PER_DAY_KEY } });
    const v = Number(row?.value);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_HOURS_PER_DAY;
}
async function getAttendanceSettings() {
    const db = (0, db_service_1.getDb)();
    const rows = await db.appSetting.findMany({ where: { key: { in: [MONTHLY_HOURS_KEY, OVERTIME_MAJ_KEY] } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const mh = Number(map.get(MONTHLY_HOURS_KEY));
    const maj = Number(map.get(OVERTIME_MAJ_KEY));
    return {
        monthlyHours: Number.isFinite(mh) && mh > 0 ? mh : DEFAULT_MONTHLY_HOURS,
        overtimeMajoration: Number.isFinite(maj) && maj >= 0 ? maj : DEFAULT_OVERTIME_MAJ,
    };
}
/** Bornes [start, end[ d'un mois (année, mois 1-12). */
function monthBounds(year, month) {
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}
/**
 * Résumé mensuel du pointage d'un employé, avec valorisation des heures
 * supplémentaires sur la base du salaire de base de son dernier contrat.
 */
async function attendanceMonthSummary(employeeId, year, month) {
    const db = (0, db_service_1.getDb)();
    const { start, end } = monthBounds(year, month);
    const records = await db.attendanceRecord.findMany({
        where: { employeeId, date: { gte: start, lt: end } },
    });
    let daysPresent = 0, daysAbsent = 0, daysLeave = 0, totalHours = 0, overtimeHours = 0;
    for (const r of records) {
        if (r.status === 'PRESENT')
            daysPresent += 1;
        else if (r.status === 'ABSENT')
            daysAbsent += 1;
        else if (r.status === 'CONGE' || r.status === 'MALADIE')
            daysLeave += 1;
        totalHours += Number(r.hoursWorked);
        overtimeHours += Number(r.overtimeHours);
    }
    totalHours = Math.round(totalHours * 100) / 100;
    overtimeHours = Math.round(overtimeHours * 100) / 100;
    const contract = await db.employmentContract.findFirst({
        where: { employeeId, deletedAt: null },
        orderBy: { startDate: 'desc' },
        select: { baseSalary: true },
    });
    const overtimeAmount = contract
        ? await computeOvertimeAmount(Number(contract.baseSalary), overtimeHours)
        : 0;
    return { daysPresent, daysAbsent, daysLeave, totalHours, overtimeHours, overtimeAmount };
}
/** Valorise des heures supplémentaires : taux horaire × heures × (1 + majoration). */
async function computeOvertimeAmount(baseSalary, overtimeHours) {
    if (!(overtimeHours > 0) || !(baseSalary > 0))
        return 0;
    const { monthlyHours, overtimeMajoration } = await getAttendanceSettings();
    const hourlyRate = baseSalary / monthlyHours;
    return Math.round(overtimeHours * hourlyRate * (1 + overtimeMajoration / 100));
}
