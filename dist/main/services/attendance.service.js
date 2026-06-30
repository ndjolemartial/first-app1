"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkHoursPerDay = getWorkHoursPerDay;
exports.attendanceMonthSummary = attendanceMonthSummary;
exports.computeOvertimeAmount = computeOvertimeAmount;
exports.getAttendanceClockSettings = getAttendanceClockSettings;
exports.recordClock = recordClock;
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
const EXPECTED_ARRIVAL_KEY = 'attendance.expectedArrival';
const EXPECTED_DEPARTURE_KEY = 'attendance.expectedDeparture';
const DEFAULT_MONTHLY_HOURS = 173.33;
const DEFAULT_OVERTIME_MAJ = 15;
const DEFAULT_HOURS_PER_DAY = 8;
const DEFAULT_EXPECTED_ARRIVAL = '08:00';
const DEFAULT_EXPECTED_DEPARTURE = '17:00';
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
// ── Pointage par QR Code (heures d'arrivée / départ) ─────────────────────────
const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
/** Seuils horaires (arrivée / départ) paramétrables, format 'HH:MM'. */
async function getAttendanceClockSettings() {
    const db = (0, db_service_1.getDb)();
    const rows = await db.appSetting.findMany({ where: { key: { in: [EXPECTED_ARRIVAL_KEY, EXPECTED_DEPARTURE_KEY] } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const a = map.get(EXPECTED_ARRIVAL_KEY);
    const d = map.get(EXPECTED_DEPARTURE_KEY);
    return {
        expectedArrival: a && HHMM_RE.test(a) ? a : DEFAULT_EXPECTED_ARRIVAL,
        expectedDeparture: d && HHMM_RE.test(d) ? d : DEFAULT_EXPECTED_DEPARTURE,
    };
}
/** Minutes depuis minuit pour une date locale donnée. */
function minutesOfDay(d) {
    return d.getHours() * 60 + d.getMinutes();
}
/** Minutes depuis minuit pour un seuil 'HH:MM'. */
function thresholdMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
/**
 * Enregistre un pointage (arrivée ou départ) pour le membre du personnel associé
 * au compte utilisateur `userId`. Applique les règles :
 *  - un seul pointage d'arrivée et un seul de départ par jour ;
 *  - avertissement si l'arrivée dépasse le seuil ou le départ le précède ;
 *  - calcul des heures travaillées lorsque arrivée et départ sont connus.
 * Lève une erreur (message lisible) en cas de violation de règle.
 */
async function recordClock(userId, type) {
    const db = (0, db_service_1.getDb)();
    const employee = await db.employee.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) {
        throw new Error('Compte d’utilisateur non encore associé à un membre du personnel');
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const existing = await db.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
    });
    if (type === 'arrival' && existing?.arrivalTime) {
        throw new Error('Heure d’arrivée déjà enregistrée aujourd’hui');
    }
    if (type === 'departure' && existing?.departureTime) {
        throw new Error('Heure de départ déjà enregistrée aujourd’hui');
    }
    const arrivalTime = type === 'arrival' ? now : existing?.arrivalTime ?? null;
    const departureTime = type === 'departure' ? now : existing?.departureTime ?? null;
    // Heures travaillées si arrivée et départ connus (différence positive, 2 décimales).
    let hoursWorked = existing ? Number(existing.hoursWorked) : 0;
    if (arrivalTime && departureTime) {
        const diff = (departureTime.getTime() - arrivalTime.getTime()) / 3600000;
        hoursWorked = diff > 0 ? Math.round(diff * 100) / 100 : 0;
    }
    await db.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
        create: {
            employeeId: employee.id, date: today, status: 'PRESENT',
            arrivalTime, departureTime, hoursWorked,
        },
        update: { status: 'PRESENT', arrivalTime, departureTime, hoursWorked },
    });
    // Avertissement de retard / départ anticipé.
    const { expectedArrival, expectedDeparture } = await getAttendanceClockSettings();
    let warning = null;
    if (type === 'arrival' && minutesOfDay(now) > thresholdMinutes(expectedArrival)) {
        warning = `Arrivée en retard (après ${expectedArrival}).`;
    }
    else if (type === 'departure' && minutesOfDay(now) < thresholdMinutes(expectedDeparture)) {
        warning = `Départ avant l’heure limite (${expectedDeparture}).`;
    }
    return {
        type,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        time: now.toISOString(),
        warning,
    };
}
