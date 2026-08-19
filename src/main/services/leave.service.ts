import { getDb } from './db.service';
import logger from '../utils/logger';

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
export const REPOS_COMPENSATEUR_TYPE_CODES = ['MALADIE', 'MATERNITE', 'PATERNITE', 'EXCEPTIONNEL'];

/** Crée les types de congés par défaut absents (idempotent). */
export async function seedDefaultLeaveTypes(): Promise<void> {
  const db = getDb();
  for (const t of DEFAULT_LEAVE_TYPES) {
    const exists = await db.leaveType.findUnique({ where: { code: t.code }, select: { id: true } });
    if (exists) continue;
    await db.leaveType.create({ data: t });
  }
  logger.info('Types de congés par défaut vérifiés');
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

export async function getLeaveAccrual(): Promise<number> {
  const row = await getDb().appSetting.findUnique({ where: { key: ACCRUAL_KEY } });
  const v = Number(row?.value);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_ACCRUAL;
}

/**
 * Nombre de jours ouvrés (lundi-vendredi) entre deux dates incluses.
 * Le champ reste modifiable côté formulaire pour les cas particuliers.
 */
export function workingDays(start: Date, end: Date): number {
  if (end < start) return 0;
  let count = 0;
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= last) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count += 1;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Nombre de mois calendaires courus entre `from` et `to`, **mois de `to`
 * inclus** — les congés payés s'acquièrent par mois calendaire d'activité
 * (ex. les bulletins de paie courent du 1ᵉʳ au dernier jour du mois), pas au
 * jour près depuis la date anniversaire d'embauche. Ex. from = 1ᵉʳ janvier,
 * to = 31 janvier (même mois) → 1 mois ; to = 31 juillet → 7 mois.
 */
function monthsBetween(from: Date, to: Date): number {
  const m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  return Math.max(0, m);
}

export interface LeaveBalance {
  accrualPerMonth: number;
  monthsSinceHire: number;
  acquired: number;
  taken: number;
  remaining: number;
}

/**
 * Calcule le solde de congés payés d'un employé, à la date `asOf` (par défaut
 * aujourd'hui — solde « en direct », ex. Congés & absences, Mon espace RH).
 * Un appelant qui doit figer un solde historique (ex. bulletin de paie déjà
 * émis) passe la fin de la période concernée : ni l'acquis ni le pris ne
 * doivent alors tenir compte d'évènements postérieurs à cette date.
 */
export async function computeLeaveBalance(employeeId: number, asOf: Date = new Date()): Promise<LeaveBalance> {
  const db = getDb();
  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { hireDate: true, createdAt: true } });
  const accrualPerMonth = await getLeaveAccrual();
  const startRef = employee?.hireDate ?? employee?.createdAt ?? new Date();
  // Acquisition à partir du max(embauche, 1er janvier 2026) : les congés des
  // années antérieures sont considérés déjà consommés (compteur remis à zéro).
  const accrualStart = new Date(Math.max(new Date(startRef).getTime(), ACCRUAL_START.getTime()));
  const monthsSinceHire = monthsBetween(accrualStart, asOf);
  const acquired = Math.round(monthsSinceHire * accrualPerMonth * 10) / 10;

  // Jours de congés payés approuvés (types affectant le solde) pris depuis le
  // début de comptabilisation jusqu'à `asOf` : on ignore les congés antérieurs
  // (déjà soldés) et — pour un solde figé — ceux postérieurs à `asOf`.
  const approved = await db.leaveRequest.findMany({
    where: {
      employeeId, status: 'APPROUVE', deletedAt: null,
      type: { affectsBalance: true }, startDate: { gte: ACCRUAL_START, lte: asOf },
    },
    select: { days: true },
  });
  const taken = Math.round(approved.reduce((s, r) => s + Number(r.days), 0) * 10) / 10;
  const remaining = Math.round((acquired - taken) * 10) / 10;
  return { accrualPerMonth, monthsSinceHire, acquired, taken, remaining };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Compteur (jours). `acquired`/`remaining` à `null` quand non applicable. */
export interface LeaveCounter {
  acquired: number | null;   // jours acquis (droits) — null si non applicable
  takenYear: number;         // jours pris sur l'année du bulletin
  remaining: number | null;  // solde restant — null si non applicable
}

export interface PayslipLeaveCounters {
  year: number;
  conge: LeaveCounter;      // congés payés
  reposComp: LeaveCounter;  // repos compensateur (cumul d'absences)
}

/**
 * Compteurs affichés sur le bulletin de paie, pour l'année du bulletin :
 * - Congés payés : acquis = droits totaux depuis l'embauche, pris = demandes
 *   approuvées (types affectant le solde) sur l'année, restant = solde global.
 * - Repos compensateur : cumul des absences approuvées (maladie, maternité,
 *   paternité, exceptionnelle) sur l'année. Pas de notion d'acquis/restant
 *   (colonnes non applicables → null).
 *
 * `month` (le mois de la période du bulletin, 1-12) fige tous les compteurs à
 * la **fin de ce mois** : un bulletin déjà émis ne doit plus voir ses
 * compteurs de congés évoluer au fil du temps (ni parce que de nouveaux
 * congés sont pris plus tard dans l'année, ni parce que le solde acquis
 * continue de courir jusqu'à aujourd'hui). Sans `month` (repli sur le 31
 * décembre de `year`), le comportement reste celui d'un cumul annuel complet.
 *
 * `isEssaiContract` : un contrat/période d'essai (ESSAI, RENOUVELLEMENT_ESSAI)
 * n'ouvre pas droit aux congés payés — la ligne « Congés payés » du bulletin
 * reste à 0 (acquis/pris/restant), quel que soit le solde par ailleurs.
 */
export async function computePayslipLeaveCounters(
  employeeId: number, year: number, month?: number, isEssaiContract = false,
): Promise<PayslipLeaveCounters> {
  const db = getDb();
  const asOf = month != null ? new Date(year, month, 0, 23, 59, 59, 999) : new Date(year, 11, 31, 23, 59, 59, 999);
  const balance = await computeLeaveBalance(employeeId, asOf);
  const start = new Date(year, 0, 1);

  const congeYear = await db.leaveRequest.findMany({
    where: {
      employeeId, status: 'APPROUVE', deletedAt: null,
      type: { affectsBalance: true }, startDate: { gte: start, lte: asOf },
    },
    select: { days: true },
  });
  const congeTakenYear = round1(congeYear.reduce((s, r) => s + Number(r.days), 0));

  const reposYear = await db.leaveRequest.findMany({
    where: {
      employeeId, status: 'APPROUVE', deletedAt: null,
      type: { code: { in: REPOS_COMPENSATEUR_TYPE_CODES } }, startDate: { gte: start, lte: asOf },
    },
    select: { days: true },
  });
  const reposTakenYear = round1(reposYear.reduce((s, r) => s + Number(r.days), 0));

  return {
    year,
    conge: isEssaiContract
      ? { acquired: 0, takenYear: 0, remaining: 0 }
      : { acquired: balance.acquired, takenYear: congeTakenYear, remaining: balance.remaining },
    reposComp: { acquired: null, takenYear: reposTakenYear, remaining: null },
  };
}

/**
 * Jours de congé approuvés dont la date de début est dans [start, end[, ventilés
 * entre congés payés (types affectant le solde) et repos compensateur (cumul des
 * absences maladie / maternité / paternité / exceptionnelle).
 */
export async function approvedLeaveDaysInRange(
  employeeId: number,
  start: Date,
  end: Date,
): Promise<{ congePaye: number; reposComp: number }> {
  const db = getDb();
  const reqs = await db.leaveRequest.findMany({
    where: { employeeId, status: 'APPROUVE', deletedAt: null, startDate: { gte: start, lt: end } },
    select: { days: true, type: { select: { code: true, affectsBalance: true } } },
  });
  let congePaye = 0;
  let reposComp = 0;
  for (const r of reqs) {
    const d = Number(r.days);
    if (r.type.affectsBalance) congePaye += d;
    else if (REPOS_COMPENSATEUR_TYPE_CODES.includes(r.type.code)) reposComp += d;
  }
  return { congePaye: round1(congePaye), reposComp: round1(reposComp) };
}
