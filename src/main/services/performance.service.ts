import { getDb } from './db.service';
import { getSetting, SettingsKeys } from './settings.service';
import { getAttendanceClockSettings, minutesOfDay, thresholdMinutes } from './attendance.service';

/** Rôles exclus par défaut des Retards & Départs précipités (calcul et affichage). */
const LATENESS_MANAGEMENT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Clé AppSetting : liste (JSON d'ids) des employés à inclure dans les classements. */
export const RANKING_ROSTER_KEY = 'performance.rankingEmployeeIds';

/**
 * Moteur de la gestion de la performance (Module 14).
 *
 * Deux responsabilités :
 *  1. Calcul des KPI d'un collaborateur à partir des données de l'application
 *     (ventes/conventions, commissions, encaissements, activités CRM, assiduité,
 *     congés). L'attribution par utilisateur repose sur `Employee.userId` ; les
 *     KPI d'assiduité/congés s'appuient sur `Employee.id`. Un KPI `MANUAL` n'a
 *     pas de source automatique.
 *  2. Calcul des classements multi-périodes (hebdo, mensuel, trimestriel,
 *     semestriel, annuel), soit sur un score KPI pondéré (périodes courtes), soit
 *     sur la note d'évaluation validée (périodes de revue).
 *
 * Tous les montants Prisma `Decimal` sont convertis en `number` avant retour.
 */

type Db = ReturnType<typeof getDb>;

export type RankingPeriodType = 'SEMAINE' | 'MOIS' | 'TRIMESTRE' | 'SEMESTRE' | 'ANNEE';
export type RankingBasis = 'KPI' | 'EVALUATION';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Serialise en clonant (neutralise les Decimal Prisma pour l'IPC). */
export const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

// ── Bornes de période ────────────────────────────────────────────────────────

export interface PeriodBounds {
  start: Date;
  end: Date; // exclusif
  label: string;
}

/** Lundi 00:00 de la semaine ISO contenant `d`. */
function isoWeekStart(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return start;
}

/** Numéro de semaine ISO (1–53). */
function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/** Date au format JJ/MM/AAAA. */
function fmtFR(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Jour de fin **inclus** d'une période dont la borne `end` est exclusive. */
function lastDayInclusive(end: Date): Date {
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
}

/** Ajoute au libellé la plage de dates « (Du JJ/MM/AAAA au JJ/MM/AAAA) »
 *  (fin incluse). Ex. « Semaine 27 (Du 29/06/2026 au 05/07/2026) ». */
function withRange(label: string, start: Date, end: Date): string {
  return `${label} (Du ${fmtFR(start)} au ${fmtFR(lastDayInclusive(end))})`;
}

/** Bornes [start, end[ d'une période contenant la date de référence. */
export function periodBounds(periodType: RankingPeriodType, ref: Date): PeriodBounds {
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
export function quarterOf(ref: Date): number {
  return Math.floor(ref.getMonth() / 3) + 1;
}

// ── Calcul d'une valeur brute de KPI ─────────────────────────────────────────

export interface KpiDef {
  id: number;
  code: string;
  label: string;
  source: string;
  metric: string;
  unit: string | null;
  direction: string; // HIGHER_BETTER | LOWER_BETTER
  defaultTarget: number | null;
}

export interface EmployeeRef {
  id: number;
  userId: number | null;
}

/**
 * Valeur réelle d'un KPI pour un collaborateur sur [start, end[. Renvoie `null`
 * quand le KPI n'est pas mesurable automatiquement (source MANUAL, ou source
 * nominative sans compte utilisateur rattaché).
 */
export async function computeMetricValue(
  db: Db,
  employee: EmployeeRef,
  kpi: Pick<KpiDef, 'source' | 'metric'>,
  start: Date,
  end: Date,
): Promise<number | null> {
  const uid = employee.userId;
  const needsUser = ['SALES', 'COMMISSIONS', 'ACCOUNTING', 'CRM', 'PROSPECTS', 'SOCIAL'].includes(kpi.source);
  if (needsUser && !uid) return null;

  switch (kpi.metric) {
    case 'SALES_COUNT': {
      return db.convention.count({
        where: { deletedAt: null, agentId: uid!, signedAt: { gte: start, lt: end } },
      });
    }
    case 'SALES_AMOUNT': {
      const agg = await db.convention.aggregate({
        where: { deletedAt: null, agentId: uid!, signedAt: { gte: start, lt: end } },
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
          agentId: uid!,
          type: { in: ['RESILIATION', 'AVENANT_RESILIATION_HERITE'] },
          startDate: { gte: start, lt: end },
        },
      });
    }
    case 'COMMISSION_AMOUNT': {
      const agg = await db.commission.aggregate({
        where: { deletedAt: null, userId: uid!, status: 'PAYEE', paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      });
      return Number(agg._sum.amount ?? 0);
    }
    case 'ENCAISSEMENT_AMOUNT': {
      const agg = await db.payment.aggregate({
        where: {
          paidAt: { gte: start, lt: end },
          invoice: { deletedAt: null, convention: { agentId: uid! } },
        },
        _sum: { amount: true },
      });
      return Number(agg._sum.amount ?? 0);
    }
    case 'CRM_ACTIVITIES_DONE': {
      return db.crmActivity.count({
        where: { userId: uid!, status: 'TRAITE', completedAt: { gte: start, lt: end } },
      });
    }
    case 'CRM_VISITS': {
      return db.crmActivity.count({
        where: { userId: uid!, type: 'VISITE', completedAt: { gte: start, lt: end } },
      });
    }
    case 'CRM_CALLS': {
      return db.crmActivity.count({
        where: { userId: uid!, type: 'APPEL', completedAt: { gte: start, lt: end } },
      });
    }
    case 'PROSPECT_CONVERSION_RATE': {
      // Taux de conversion de la cohorte de prospects assignés à l'agent et créés
      // dans la période : part de ces prospects désormais convertis en clients.
      const [total, converted] = await Promise.all([
        db.prospect.count({
          where: { deletedAt: null, assignedToId: uid!, createdAt: { gte: start, lt: end } },
        }),
        db.prospect.count({
          where: { deletedAt: null, assignedToId: uid!, createdAt: { gte: start, lt: end }, convertedAt: { not: null } },
        }),
      ]);
      if (total === 0) return null;
      return Math.round((converted / total) * 1000) / 10; // %
    }
    case 'NEW_POTENTIAL_PROSPECTS': {
      // Nouveaux prospects (créés dans la période, assignés à l'agent) dont le
      // statut actuel est « Client potentiel » (QUALIFIE) ou « Négociation en
      // cours » (NEGOCIATION_EN_COURS).
      return db.prospect.count({
        where: {
          deletedAt: null,
          assignedToId: uid!,
          createdAt: { gte: start, lt: end },
          status: { in: ['QUALIFIE', 'NEGOCIATION_EN_COURS'] },
        },
      });
    }
    case 'SOCIAL_PUBLICATIONS_COUNT': {
      return db.socialPublication.count({
        where: { deletedAt: null, authorId: uid!, publishedAt: { gte: start, lt: end } },
      });
    }
    case 'SOCIAL_VIEWS': {
      const agg = await db.socialPublication.aggregate({
        where: { deletedAt: null, authorId: uid!, publishedAt: { gte: start, lt: end } },
        _sum: { viewsCount: true },
      });
      return agg._sum.viewsCount ?? 0;
    }
    case 'SOCIAL_INTERACTIONS': {
      const agg = await db.socialPublication.aggregate({
        where: { deletedAt: null, authorId: uid!, publishedAt: { gte: start, lt: end } },
        _sum: { interactionsCount: true },
      });
      return agg._sum.interactionsCount ?? 0;
    }
    case 'SOCIAL_FOLLOWERS_GROWTH': {
      // Croissance nette d'abonnés sur la période, cumulée sur les plateformes
      // dont l'agent est responsable : dernier relevé connu en fin de période
      // moins dernier relevé connu avant le début de la période.
      const platforms = await db.socialPlatform.findMany({
        where: { deletedAt: null, responsibleId: uid! },
        select: { id: true },
      });
      if (!platforms.length) return null;
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
      if (counted === 0) return null;
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
        if (linkedUser && LATENESS_MANAGEMENT_ROLES.includes(linkedUser.role)) return null;
      }
      const minutes = await computeUnjustifiedLatenessMinutes(db, employee.id, start, end);
      return Math.round((minutes / 60) * 100) / 100; // heures, 2 décimales
    }
    case 'MANUAL_VALUE':
    default:
      return null;
  }
}

// ── Retards & Départs précipités ────────────────────────────────────────────

export interface LatenessJustification {
  id: number;
  justified: boolean;
  leaveRequestId: number | null;
  crmActivityId: number | null;
  justifiedById: number | null;
  justifiedAt: Date | null;
  // Tolérance : marquage manuel SUPER_ADMIN/ADMIN/MANAGER (sans congé ni
  // activité liée), plafonné par une limite de temps paramétrable. Exclut la
  // journée du cumul non justifié, comme `justified`.
  tolerated: boolean;
  toleratedById: number | null;
  toleratedAt: Date | null;
  notes: string | null;
}

export interface LatenessLine {
  employeeId: number;
  date: Date;
  arrivalTime: Date | null;
  departureTime: Date | null;
  lateMinutes: number;
  earlyMinutes: number;
  totalMinutes: number;
  justification: LatenessJustification | null;
}

/**
 * Journées de retard d'arrivée / départ anticipé d'un employé sur [start, end[
 * (uniquement les journées `PRESENT` avec pointage), avec la justification
 * éventuellement déjà enregistrée. Les seuils (arrivée/départ attendus) sont
 * ceux paramétrés pour le pointage QR (`attendance.expectedArrival/Departure`).
 */
export async function computeLatenessLinesForEmployee(db: Db, employeeId: number, start: Date, end: Date): Promise<LatenessLine[]> {
  const { expectedArrival, expectedDeparture } = await getAttendanceClockSettings();
  const arrivalThreshold = thresholdMinutes(expectedArrival);
  const departureThreshold = thresholdMinutes(expectedDeparture);

  const [records, justifications] = await Promise.all([
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
  ]);
  const justByDate = new Map(justifications.map((j) => [j.date.getTime(), j]));

  const lines: LatenessLine[] = [];
  for (const r of records) {
    const lateMinutes = r.arrivalTime ? Math.max(0, minutesOfDay(r.arrivalTime) - arrivalThreshold) : 0;
    const earlyMinutes = r.departureTime ? Math.max(0, departureThreshold - minutesOfDay(r.departureTime)) : 0;
    const totalMinutes = lateMinutes + earlyMinutes;
    if (totalMinutes <= 0) continue;
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
export async function computeUnjustifiedLatenessMinutes(db: Db, employeeId: number, start: Date, end: Date): Promise<number> {
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
export async function latenessIncludesManagementRoles(): Promise<boolean> {
  return (await getSetting(SettingsKeys.latenessIncludeManagementRoles)) === 'true';
}

/** Identifiants des employés liés à un compte utilisateur SUPER_ADMIN/ADMIN/MANAGER. */
async function managementLinkedEmployeeIds(db: Db, employees: Array<{ id: number; userId: number | null }>): Promise<Set<number>> {
  const userIds = employees.map((e) => e.userId).filter((id): id is number => id != null);
  if (!userIds.length) return new Set();
  const users = await db.user.findMany({ where: { id: { in: userIds }, role: { in: LATENESS_MANAGEMENT_ROLES as any } }, select: { id: true } });
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
export async function latenessEligibleEmployeeIds(db: Db): Promise<number[]> {
  const [absKpi, attKpi, includeManagement] = await Promise.all([
    db.kpiDefinition.findFirst({ where: { metric: 'ABSENCE_DAYS' }, select: { id: true } }),
    db.kpiDefinition.findFirst({ where: { metric: 'ATTENDANCE_RATE' }, select: { id: true } }),
    latenessIncludesManagementRoles(),
  ]);
  if (!absKpi || !attKpi) return [];
  const employees = await db.employee.findMany({ where: { deletedAt: null }, select: { id: true, poste: true, userId: true } });
  const excludedIds = includeManagement ? new Set<number>() : await managementLinkedEmployeeIds(db, employees);
  const posteEligibility = new Map<string, boolean>();
  const result: number[] = [];
  for (const e of employees) {
    if (excludedIds.has(e.id)) continue;
    const key = e.poste ?? '__NO_POSTE__';
    let eligible = posteEligibility.get(key);
    if (eligible === undefined) {
      const weights = await weightsForPoste(db, e.poste);
      const wAbs = weights.get(absKpi.id) ?? 1;
      const wAtt = weights.get(attKpi.id) ?? 1;
      eligible = wAbs !== 0 && wAtt !== 0;
      posteEligibility.set(key, eligible);
    }
    if (eligible) result.push(e.id);
  }
  return result;
}

/** Note absolue d'une valeur au regard d'une cible (0–100, bornée à 100). */
export function scoreAgainstTarget(actual: number, target: number, direction: string): number {
  if (!(target > 0)) return 0;
  const ratio = direction === 'LOWER_BETTER'
    ? (actual <= 0 ? 1 : target / actual)
    : actual / target;
  return Math.round(clamp(ratio, 0, 1) * 1000) / 10;
}

// ── Pondération par poste ────────────────────────────────────────────────────

/** Poids des KPI (id → poids) pour un poste, depuis son profil actif. */
export async function weightsForPoste(db: Db, poste: string | null | undefined): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (!poste) return map;
  const profile = await db.performanceWeightProfile.findFirst({
    where: { deletedAt: null, isActive: true, poste },
    orderBy: { updatedAt: 'desc' },
    include: { lines: true },
  });
  if (!profile) return map;
  for (const l of profile.lines) map.set(l.kpiDefinitionId, Number(l.weight));
  return map;
}

// ── Calcul des KPI d'une évaluation (cible absolue) ──────────────────────────

export interface EvaluationKpiLine {
  kpiDefinitionId: number;
  label: string;
  weight: number;
  targetValue: number | null;
  actualValue: number | null;
  score: number | null;
}

/**
 * Calcule les lignes KPI d'un collaborateur pour une période, en notant chaque
 * KPI au regard de sa cible (ligne existante ou cible par défaut). Retourne les
 * lignes et la note globale pondérée (0–100).
 */
export async function computeEvaluationKpis(
  db: Db,
  employee: EmployeeRef,
  poste: string | null | undefined,
  start: Date,
  end: Date,
  targets: Map<number, number> = new Map(),
): Promise<{ lines: EvaluationKpiLine[]; globalScore: number }> {
  const kpis = (await db.kpiDefinition.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { id: 'asc' },
  })) as unknown as KpiDef[];
  const weights = await weightsForPoste(db, poste);

  const lines: EvaluationKpiLine[] = [];
  let scoreSum = 0;
  let weightSum = 0;
  for (const kpi of kpis) {
    const actual = await computeMetricValue(db, employee, kpi, start, end);
    if (actual === null) continue; // KPI non mesurable automatiquement
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

// ── Classements ──────────────────────────────────────────────────────────────

export interface RankingEntry {
  employeeId: number;
  employeeName: string;
  matricule: string;
  poste: string | null;
  departement: string | null;
  score: number;
  rank: number;
  linked: boolean; // rattaché à un compte utilisateur
}

interface EmployeeRow {
  id: number;
  userId: number | null;
  matricule: string;
  firstName: string;
  lastName: string;
  poste: string | null;
  departement: string | null;
}

/**
 * Liste (ids) des employés à classer, définie par l'admin dans la configuration.
 * `null` = non configurée → tous les employés actifs sont classés (défaut).
 */
export async function rankingRoster(db: Db): Promise<number[] | null> {
  const raw = await getSetting(RANKING_ROSTER_KEY);
  if (!raw) return null;
  try {
    const ids = JSON.parse(raw);
    if (Array.isArray(ids) && ids.length > 0) return ids.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    return null;
  } catch {
    return null;
  }
}

async function activeEmployees(db: Db, roster?: number[] | null): Promise<EmployeeRow[]> {
  const where: any = { deletedAt: null, status: 'ACTIF' };
  if (roster && roster.length) where.id = { in: roster };
  return db.employee.findMany({
    where,
    select: { id: true, userId: true, matricule: true, firstName: true, lastName: true, poste: true, departement: true },
  }) as unknown as Promise<EmployeeRow[]>;
}

const fullName = (e: { firstName: string; lastName: string }): string => `${e.lastName} ${e.firstName}`.trim();

/**
 * Classement fondé sur un score KPI pondéré, normalisé RELATIVEMENT à la cohorte
 * (pour chaque KPI : meilleur = 100). Adapté aux périodes courtes sans cible.
 */
export async function computeRankingByKpi(db: Db, start: Date, end: Date, roster?: number[] | null): Promise<RankingEntry[]> {
  const employees = await activeEmployees(db, roster);
  const kpis = (await db.kpiDefinition.findMany({
    where: { deletedAt: null, isActive: true, source: { not: 'MANUAL' } },
    orderBy: { id: 'asc' },
  })) as unknown as KpiDef[];

  // Valeurs brutes : rawByEmp[empId][kpiId] = actual
  const rawByEmp = new Map<number, Map<number, number>>();
  for (const emp of employees) {
    const m = new Map<number, number>();
    for (const kpi of kpis) {
      const v = await computeMetricValue(db, { id: emp.id, userId: emp.userId }, kpi, start, end);
      if (v !== null) m.set(kpi.id, v);
    }
    rawByEmp.set(emp.id, m);
  }

  // Extremum par KPI pour la normalisation relative.
  const bestByKpi = new Map<number, number>();
  for (const kpi of kpis) {
    let best = kpi.direction === 'LOWER_BETTER' ? Number.POSITIVE_INFINITY : 0;
    for (const emp of employees) {
      const v = rawByEmp.get(emp.id)?.get(kpi.id);
      if (v == null) continue;
      best = kpi.direction === 'LOWER_BETTER' ? Math.min(best, v) : Math.max(best, v);
    }
    bestByKpi.set(kpi.id, best);
  }

  const entries: RankingEntry[] = [];
  for (const emp of employees) {
    const weights = await weightsForPoste(db, emp.poste);
    const raw = rawByEmp.get(emp.id)!;
    let scoreSum = 0;
    let weightSum = 0;
    for (const kpi of kpis) {
      const v = raw.get(kpi.id);
      if (v == null) continue;
      const best = bestByKpi.get(kpi.id) ?? 0;
      let norm = 0;
      if (kpi.direction === 'LOWER_BETTER') {
        norm = v <= 0 ? 100 : (Number.isFinite(best) && best > 0 ? clamp(best / v, 0, 1) * 100 : 0);
      } else {
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
export async function computeRankingByEvaluation(
  db: Db,
  periodType: RankingPeriodType,
  ref: Date,
  roster?: number[] | null,
): Promise<RankingEntry[]> {
  const employees = await activeEmployees(db, roster);
  const year = ref.getFullYear();
  const validated = ['VALIDEE_DIRECTION', 'CLOTUREE'];
  const where: any = { deletedAt: null, status: { in: validated }, year };
  if (periodType === 'TRIMESTRE') where.quarter = quarterOf(ref);

  const entries: RankingEntry[] = [];
  for (const emp of employees) {
    const evalRow = await db.performanceEvaluation.findFirst({
      where: { ...where, employeeId: emp.id },
      orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
      select: { globalScore: true },
    });
    if (!evalRow) continue;
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
function rankSort(entries: RankingEntry[]): RankingEntry[] {
  entries.sort((a, b) => b.score - a.score);
  let rank = 0;
  let prev: number | null = null;
  entries.forEach((e, i) => {
    if (prev === null || e.score < prev) rank = i + 1;
    e.rank = rank;
    prev = e.score;
  });
  return entries;
}

/** Base par défaut d'un classement selon la période (mixte). */
export function defaultBasis(periodType: RankingPeriodType): RankingBasis {
  return periodType === 'SEMAINE' || periodType === 'MOIS' ? 'KPI' : 'EVALUATION';
}

/**
 * Amorce un catalogue de KPI par défaut (idempotent, sur le `code` unique) pour
 * que le module soit immédiatement exploitable. N'écrase aucun KPI existant.
 */
export async function seedDefaultKpis(): Promise<void> {
  const db = getDb();
  const defaults: Array<{ code: string; label: string; category: string; source: string; metric: string; unit: string | null; direction: string }> = [
    { code: 'SALES_COUNT', label: 'Nombre de ventes signées', category: 'Commercial', source: 'SALES', metric: 'SALES_COUNT', unit: 'nb', direction: 'HIGHER_BETTER' },
    { code: 'SALES_AMOUNT', label: 'Montant des ventes signées', category: 'Commercial', source: 'SALES', metric: 'SALES_AMOUNT', unit: 'FCFA', direction: 'HIGHER_BETTER' },
    { code: 'RESILIATION_COUNT', label: 'Nombre de conventions résiliées', category: 'Commercial', source: 'SALES', metric: 'RESILIATION_COUNT', unit: 'nb', direction: 'LOWER_BETTER' },
    { code: 'COMMISSION_AMOUNT', label: 'Commissions encaissées', category: 'Commercial', source: 'COMMISSIONS', metric: 'COMMISSION_AMOUNT', unit: 'FCFA', direction: 'HIGHER_BETTER' },
    { code: 'ENCAISSEMENT_AMOUNT', label: 'Chiffre d’affaire réalisé', category: 'Finance', source: 'ACCOUNTING', metric: 'ENCAISSEMENT_AMOUNT', unit: 'FCFA', direction: 'HIGHER_BETTER' },
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
  ];
  for (const d of defaults) {
    const exists = await db.kpiDefinition.findFirst({ where: { code: d.code }, select: { id: true } });
    if (!exists) await db.kpiDefinition.create({ data: d as any });
  }
}

/**
 * Amorce le référentiel des unités de KPI (idempotent) : unités usuelles + toute
 * unité déjà utilisée par un KPI existant. Sur le `label` unique, sans écraser.
 */
export async function seedKpiUnits(): Promise<void> {
  const db = getDb();
  const defaults = ['FCFA', '%', 'nb', 'h', 'jours', 'points', 'm²', 'm³'];
  const used = await db.kpiDefinition.findMany({
    where: { deletedAt: null, unit: { not: null } },
    select: { unit: true },
    distinct: ['unit'],
  });
  const labels = new Set<string>(defaults);
  for (const u of used) { const l = (u.unit ?? '').trim(); if (l) labels.add(l); }
  for (const label of labels) {
    const exists = await db.kpiUnit.findUnique({ where: { label }, select: { id: true } });
    if (!exists) await db.kpiUnit.create({ data: { label } });
  }
}

/** Calcule un classement complet (choisit la base si non imposée). */
export async function computeRanking(
  db: Db,
  periodType: RankingPeriodType,
  ref: Date,
  basis?: RankingBasis,
): Promise<{ basis: RankingBasis; period: PeriodBounds; entries: RankingEntry[] }> {
  const period = periodBounds(periodType, ref);
  const chosen = basis ?? defaultBasis(periodType);
  const roster = await rankingRoster(db);
  let entries: RankingEntry[];
  if (chosen === 'EVALUATION') {
    entries = await computeRankingByEvaluation(db, periodType, ref, roster);
    // Repli sur les KPI si aucune évaluation validée sur la période.
    if (entries.length === 0) {
      return { basis: 'KPI', period, entries: await computeRankingByKpi(db, period.start, period.end, roster) };
    }
  } else {
    entries = await computeRankingByKpi(db, period.start, period.end, roster);
  }
  return { basis: chosen, period, entries };
}
