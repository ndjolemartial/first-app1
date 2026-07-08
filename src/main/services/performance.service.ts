import { getDb } from './db.service';
import { getSetting } from './settings.service';

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
  const needsUser = ['SALES', 'COMMISSIONS', 'ACCOUNTING', 'CRM', 'PROSPECTS'].includes(kpi.source);
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
    case 'MANUAL_VALUE':
    default:
      return null;
  }
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

const fullName = (e: { firstName: string; lastName: string }): string => `${e.firstName} ${e.lastName}`.trim();

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
    { code: 'CRM_VISITS', label: 'Visites réalisées', category: 'Activité', source: 'CRM', metric: 'CRM_VISITS', unit: 'nb', direction: 'HIGHER_BETTER' },
    { code: 'PROSPECT_CONVERSION_RATE', label: 'Taux de conversion prospects → clients', category: 'Commercial', source: 'PROSPECTS', metric: 'PROSPECT_CONVERSION_RATE', unit: '%', direction: 'HIGHER_BETTER' },
    { code: 'ATTENDANCE_RATE', label: 'Taux de présence', category: 'Assiduité', source: 'ATTENDANCE', metric: 'ATTENDANCE_RATE', unit: '%', direction: 'HIGHER_BETTER' },
    { code: 'ABSENCE_DAYS', label: 'Jours d’absence', category: 'Assiduité', source: 'ATTENDANCE', metric: 'ABSENCE_DAYS', unit: 'j', direction: 'LOWER_BETTER' },
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
