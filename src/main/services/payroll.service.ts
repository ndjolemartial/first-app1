import fs from 'fs';
import path from 'path';
import { getDb } from './db.service';
import { getSettings, SettingsKeys } from './settings.service';
import { resolveStoragePath } from './storage.service';
import { workingDays, approvedLeaveDaysInRange } from './leave.service';
import { getWorkHoursPerDay } from './attendance.service';
import type { PayslipLeaveCounters } from './leave.service';

/** Charge le logo de l'entreprise en data-URI (`data:image/...;base64,...`) ou null. */
export async function loadPayslipLogo(): Promise<string | null> {
  try {
    const map = await getSettings([SettingsKeys.companyLogo]);
    const logoRel = map[SettingsKeys.companyLogo];
    if (!logoRel) return null;
    const abs = resolveStoragePath(logoRel);
    if (!fs.existsSync(abs)) return null;
    const buf = fs.readFileSync(abs);
    const ext = path.extname(logoRel).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Moteur de paie conforme Côte d'Ivoire.
 *
 * Calcule, à partir du salaire brut imposable :
 *  - les retenues salariales : CNPS (régime retraite), ITS (barème progressif),
 *    CMU ;
 *  - les charges patronales : CNPS (retraite, prestations familiales, accident
 *    du travail), CMU, FDFP (taxe d'apprentissage + formation continue).
 *
 * ⚠️ Les taux, plafonds et le barème ITS par défaut sont des valeurs de
 * référence PARAMÉTRABLES (Paramètres → Paie). Ils doivent être vérifiés au
 * regard de la réglementation en vigueur avant exploitation en production.
 */

export interface ItsBracket {
  /** Borne supérieure mensuelle de la tranche (null = au-delà). */
  upTo: number | null;
  /** Taux de la tranche en %. */
  rate: number;
}

/**
 * Réduction d'Impôt pour Charges de Famille (RICF) : montant de réduction
 * d'impôt selon le nombre de parts IGR (mensuel et annuel).
 */
export interface RicfEntry {
  parts: number;   // nombre de parts IGR (1, 1.5, 2…)
  monthly: number; // réduction mensuelle (FCFA)
  annual: number;  // réduction annuelle (FCFA)
}

/** Catégorie socio-professionnelle : code → salaire de base de référence. */
export interface SalaryCategory {
  code: string;        // ex: 1A, 2B…
  label?: string;      // libellé (groupe) optionnel
  definition?: string; // définition / description optionnelle
  baseSalary: number;  // salaire de base catégoriel (FCFA)
}

export interface PayrollRates {
  cnpsEmployeeRate: number;          // CNPS retraite — part salarié (%)
  cnpsEmployerRetirementRate: number; // CNPS retraite — part employeur (%)
  cnpsFamilyRate: number;            // Prestations familiales — employeur (%)
  cnpsWorkAccidentRate: number;      // Accident du travail — employeur (%)
  cnpsCeiling: number;               // Plafond mensuel régime retraite (FCFA)
  cnpsFamilyCeiling: number;         // Plafond mensuel PF / AT (FCFA)
  transportExemptCeiling: number;    // Plafond mensuel d'indemnité de transport non imposable (FCFA)
  cmuEmployee: number;               // CMU part salarié (forfait FCFA)
  cmuEmployer: number;               // CMU part employeur (forfait FCFA)
  insuranceRate: number;             // Assurance maladie — retenue salarié (%)
  insuranceBase: number;             // Assurance maladie — base de calcul fixe (FCFA)
  itsEmployerRate: number;           // ITS patronale — charge employeur (%) sur le brut
  fdfpApprenticeshipRate: number;    // FDFP taxe d'apprentissage — employeur (%)
  fdfpTrainingRate: number;          // FDFP formation continue — employeur (%)
  itsBrackets: ItsBracket[];         // Barème ITS mensuel progressif
  ricf: RicfEntry[];                 // Réduction d'impôt pour charges de famille (par parts)
  salaryCategories: SalaryCategory[]; // Grille des catégories socio-professionnelles
}

// Valeurs de référence par défaut (à vérifier / ajuster en Paramètres).
const DEFAULT_RATES: PayrollRates = {
  cnpsEmployeeRate: 6.3,
  cnpsEmployerRetirementRate: 7.7,
  cnpsFamilyRate: 5.75,
  cnpsWorkAccidentRate: 3.0,
  cnpsCeiling: 3_375_000,
  cnpsFamilyCeiling: 70_000,
  transportExemptCeiling: 30_000,
  cmuEmployee: 1_000,
  cmuEmployer: 1_000,
  insuranceRate: 0.75,
  insuranceBase: 75_000,
  itsEmployerRate: 1.2,
  fdfpApprenticeshipRate: 0.4,
  fdfpTrainingRate: 0.6,
  itsBrackets: [
    { upTo: 75_000, rate: 0 },
    { upTo: 240_000, rate: 16 },
    { upTo: 800_000, rate: 21 },
    { upTo: 2_400_000, rate: 24 },
    { upTo: null, rate: 32 },
  ],
  ricf: [],
  salaryCategories: [],
};

const RATE_KEY = 'payroll.rates';

/** Récupère les taux de paie (AppSetting `payroll.rates`), repli sur les défauts. */
export async function getPayrollRates(db = getDb()): Promise<PayrollRates> {
  const row = await db.appSetting.findUnique({ where: { key: RATE_KEY } });
  if (!row?.value) return DEFAULT_RATES;
  try {
    const parsed = JSON.parse(row.value);
    // Fusion défensive : un champ manquant retombe sur la valeur par défaut.
    return {
      ...DEFAULT_RATES,
      ...parsed,
      itsBrackets: Array.isArray(parsed.itsBrackets) && parsed.itsBrackets.length > 0
        ? parsed.itsBrackets
        : DEFAULT_RATES.itsBrackets,
      ricf: Array.isArray(parsed.ricf) ? parsed.ricf : [],
      salaryCategories: Array.isArray(parsed.salaryCategories) ? parsed.salaryCategories : [],
    };
  } catch {
    return DEFAULT_RATES;
  }
}

/** Enregistre les taux de paie. */
export async function setPayrollRates(rates: PayrollRates, db = getDb()): Promise<void> {
  await db.appSetting.upsert({
    where: { key: RATE_KEY },
    create: { key: RATE_KEY, value: JSON.stringify(rates) },
    update: { value: JSON.stringify(rates) },
  });
}

const round = (n: number) => Math.round(n);

/** Calcule l'ITS mensuel selon le barème progressif par tranches. */
export function computeIts(taxable: number, brackets: ItsBracket[]): number {
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    const upper = b.upTo ?? Infinity;
    if (taxable > lower) {
      const slice = Math.min(taxable, upper) - lower;
      tax += (slice * b.rate) / 100;
    }
    lower = upper;
    if (taxable <= upper) break;
  }
  return round(tax);
}

/** Réduction RICF mensuelle correspondant à un nombre de parts (0 si absent). */
export function ricfMonthlyForParts(ricf: RicfEntry[] | undefined, parts: number): number {
  if (!Array.isArray(ricf)) return 0;
  const entry = ricf.find((r) => Math.abs(Number(r.parts) - parts) < 0.01);
  return entry ? Math.max(0, round(Number(entry.monthly) || 0)) : 0;
}

export interface PayrollInput {
  baseSalary: number;
  igrParts?: number;           // nombre de parts IGR (réduction RICF)
  sursalaire?: number;         // sursalaire (gain imposable)
  primeAnciennete?: number;    // prime d'ancienneté (gain imposable, calculée auto)
  senioriteRate?: number;      // taux d'ancienneté appliqué (% — pour affichage)
  taxablePrime?: number;       // primes imposables (soumises à cotisations/ITS)
  overtimeAmount?: number;     // heures supplémentaires (imposables) issues du pointage
  transportAllowance?: number; // indemnité de transport (non imposable)
  otherDeductions?: number;    // autres retenues (acompte, avance…)
}

/**
 * Taux de la prime d'ancienneté (convention interprofessionnelle CI) :
 * 2 % du salaire de base après 2 ans, +1 % par année supplémentaire, plafonné
 * à 25 %.
 *
 * L'ancienneté est figée à la date `asOf` — pour un bulletin, la **fin de la
 * période de paie** (et non la date de génération), afin que le taux soit stable
 * quel que soit le moment où le bulletin est généré/recalculé.
 */
export function seniorityRate(hireDate: Date | string | null | undefined, asOf: Date | string = new Date()): number {
  if (!hireDate) return 0;
  const start = new Date(hireDate);
  const ref = asOf instanceof Date ? asOf : new Date(asOf);
  let years = ref.getFullYear() - start.getFullYear();
  const m = ref.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < start.getDate())) years -= 1;
  if (years < 2) return 0;
  return Math.min(years, 25);
}

/**
 * Montant de la prime d'ancienneté = salaire de base × taux d'ancienneté,
 * l'ancienneté étant appréciée à la date `asOf` (fin de période de paie).
 */
export function computePrimeAnciennete(
  baseSalary: number,
  hireDate: Date | string | null | undefined,
  asOf?: Date | string,
): { rate: number; amount: number } {
  const rate = seniorityRate(hireDate, asOf);
  return { rate, amount: Math.round((baseSalary * rate) / 100) };
}

export interface PayrollLine {
  type: 'GAIN' | 'RETENUE' | 'CHARGE_PATRONALE' | 'INFO';
  label: string;
  base?: number;
  rate?: number;
  amount: number;
  order: number;
}

export interface PayrollResult {
  baseSalary: number;
  grossTaxable: number;
  totalGains: number;
  cnpsEmployee: number;
  its: number;
  cmuEmployee: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  employerCharges: number;
  employerCost: number;
  lines: PayrollLine[];
}

/** Calcule l'ensemble d'un bulletin de paie à partir des entrées et des taux. */
export function computePayroll(input: PayrollInput, rates: PayrollRates): PayrollResult {
  const baseSalary = Math.max(0, round(input.baseSalary || 0));
  const sursalaire = Math.max(0, round(input.sursalaire || 0));
  const primeAnciennete = Math.max(0, round(input.primeAnciennete || 0));
  const taxablePrime = Math.max(0, round(input.taxablePrime || 0));
  const overtime = Math.max(0, round(input.overtimeAmount || 0));
  const transport = Math.max(0, round(input.transportAllowance || 0));
  const otherDeductions = Math.max(0, round(input.otherDeductions || 0));

  // Indemnité de transport : exonérée jusqu'au plafond, surplus imposable.
  const transportCeiling = rates.transportExemptCeiling ?? 30_000;
  const transportExempt = Math.min(transport, transportCeiling);
  const transportTaxable = Math.max(0, transport - transportCeiling);

  const grossTaxable = baseSalary + sursalaire + primeAnciennete + taxablePrime + overtime + transportTaxable;
  const totalGains = grossTaxable + transportExempt;

  // Retenues salariales
  const cnpsBase = Math.min(grossTaxable, rates.cnpsCeiling);
  const cnpsEmployee = round((cnpsBase * rates.cnpsEmployeeRate) / 100);
  // ITS salarié = ITS du barème − réduction RICF mensuelle (selon parts IGR).
  const itsBareme = computeIts(grossTaxable, rates.itsBrackets);
  const ricfMonthly = ricfMonthlyForParts(rates.ricf, input.igrParts ?? 1);
  const its = Math.max(0, itsBareme - ricfMonthly);
  const cmuEmployee = round(rates.cmuEmployee);
  const totalDeductions = cnpsEmployee + its + cmuEmployee + otherDeductions;
  const netSalary = totalGains - totalDeductions;

  // Charges patronales
  const familyBase = Math.min(grossTaxable, rates.cnpsFamilyCeiling);
  const cnpsEmployerRetirement = round((cnpsBase * rates.cnpsEmployerRetirementRate) / 100);
  const cnpsFamily = round((familyBase * rates.cnpsFamilyRate) / 100);
  const cnpsWorkAccident = round((familyBase * rates.cnpsWorkAccidentRate) / 100);
  const cmuEmployer = round(rates.cmuEmployer);
  const fdfpApprentissage = round((grossTaxable * rates.fdfpApprenticeshipRate) / 100);
  const fdfpFormation = round((grossTaxable * rates.fdfpTrainingRate) / 100);
  const itsEmployer = round((grossTaxable * (rates.itsEmployerRate ?? 0)) / 100);
  const employerCharges = cnpsEmployerRetirement + cnpsFamily + cnpsWorkAccident + cmuEmployer + fdfpApprentissage + fdfpFormation + itsEmployer;
  const employerCost = totalGains + employerCharges;

  const lines: PayrollLine[] = [];
  let o = 0;
  lines.push({ type: 'GAIN', label: 'Salaire de base', amount: baseSalary, order: o++ });
  if (sursalaire > 0) lines.push({ type: 'GAIN', label: 'Sursalaire', amount: sursalaire, order: o++ });
  if (primeAnciennete > 0) lines.push({ type: 'GAIN', label: "Prime d'ancienneté", base: baseSalary, rate: input.senioriteRate, amount: primeAnciennete, order: o++ });
  if (taxablePrime > 0) lines.push({ type: 'GAIN', label: 'Primes imposables', amount: taxablePrime, order: o++ });
  if (overtime > 0) lines.push({ type: 'GAIN', label: 'Heures supplémentaires', amount: overtime, order: o++ });
  if (transportExempt > 0) lines.push({ type: 'GAIN', label: 'Indemnité de transport (non imposable)', amount: transportExempt, order: o++ });
  if (transportTaxable > 0) lines.push({ type: 'GAIN', label: 'Indemnité de transport (part imposable)', amount: transportTaxable, order: o++ });
  lines.push({ type: 'RETENUE', label: 'CNPS (retraite) — part salarié', base: cnpsBase, rate: rates.cnpsEmployeeRate, amount: cnpsEmployee, order: o++ });
  lines.push({ type: 'RETENUE', label: 'ITS salarié', base: grossTaxable, amount: its, order: o++ });
  lines.push({ type: 'RETENUE', label: 'CMU — part salarié', amount: cmuEmployee, order: o++ });
  if (otherDeductions > 0) lines.push({ type: 'RETENUE', label: 'Autres retenues', amount: otherDeductions, order: o++ });
  lines.push({ type: 'CHARGE_PATRONALE', label: 'CNPS (retraite) — part employeur', base: cnpsBase, rate: rates.cnpsEmployerRetirementRate, amount: cnpsEmployerRetirement, order: o++ });
  lines.push({ type: 'CHARGE_PATRONALE', label: 'CNPS prestations familiales', base: familyBase, rate: rates.cnpsFamilyRate, amount: cnpsFamily, order: o++ });
  lines.push({ type: 'CHARGE_PATRONALE', label: 'CNPS accident du travail', base: familyBase, rate: rates.cnpsWorkAccidentRate, amount: cnpsWorkAccident, order: o++ });
  lines.push({ type: 'CHARGE_PATRONALE', label: 'CMU — part employeur', amount: cmuEmployer, order: o++ });
  lines.push({ type: 'CHARGE_PATRONALE', label: "FDFP — taxe d'apprentissage", base: grossTaxable, rate: rates.fdfpApprenticeshipRate, amount: fdfpApprentissage, order: o++ });
  lines.push({ type: 'CHARGE_PATRONALE', label: 'FDFP — formation continue', base: grossTaxable, rate: rates.fdfpTrainingRate, amount: fdfpFormation, order: o++ });
  lines.push({ type: 'CHARGE_PATRONALE', label: 'ITS patronale', base: grossTaxable, rate: rates.itsEmployerRate, amount: itsEmployer, order: o++ });

  return {
    baseSalary, grossTaxable, totalGains, cnpsEmployee, its, cmuEmployee, otherDeductions,
    totalDeductions, netSalary, employerCharges, employerCost, lines,
  };
}

/* ─── Récapitulatif mois / cumul annuel ─────────────────────────── */

/** Couple de valeurs : mois en cours et cumul de la période écoulée de l'année. */
export interface MetricPair { month: number; ytd: number }

export interface PayslipTotals {
  brut: MetricPair;          // salaire brut (total des gains)
  chargesSal: MetricPair;    // total des charges/retenues salariales
  chargesPat: MetricPair;    // total des charges patronales
  netImposable: MetricPair;  // net imposable (base de calcul de l'ITS)
  hours: MetricPair;         // heures de travail (hors heures sup., congés et repos déduits)
}

/**
 * Récapitulatif affiché sur le bulletin : pour chaque rubrique, la valeur du
 * mois en cours et le cumul de la période déjà écoulée de l'année (de janvier
 * au mois du bulletin inclus). Les heures de travail = jours ouvrés − congés
 * payés − repos compensateur, multipliés par le nombre d'heures par jour
 * (heures supplémentaires non comptées).
 */
export async function computePayslipTotals(payslip: any): Promise<PayslipTotals> {
  const db = getDb();
  const year = payslip.periodYear as number;
  const month = payslip.periodMonth as number; // 1-12
  const employeeId = payslip.employeeId as number;

  // Cumul des bulletins de l'année jusqu'au mois courant inclus (hors annulés).
  const ytd = await db.payslip.findMany({
    where: {
      employeeId, periodYear: year, periodMonth: { lte: month },
      deletedAt: null, status: { not: 'ANNULE' },
    },
    select: { totalGains: true, totalDeductions: true, employerCharges: true, grossTaxable: true },
  });
  const sum = (key: 'totalGains' | 'totalDeductions' | 'employerCharges' | 'grossTaxable') =>
    ytd.reduce((s, p) => s + Number((p as any)[key]), 0);

  // Heures de travail : jours ouvrés − congés payés − repos compensateur.
  const hoursPerDay = await getWorkHoursPerDay();
  const yearStart = new Date(year, 0, 1);
  const monthStart = new Date(year, month - 1, 1);
  const monthLastDay = new Date(year, month, 0);      // dernier jour du mois
  const nextMonthStart = new Date(year, month, 1);     // borne exclusive
  const monthLeave = await approvedLeaveDaysInRange(employeeId, monthStart, nextMonthStart);
  const ytdLeave = await approvedLeaveDaysInRange(employeeId, yearStart, nextMonthStart);
  const monthWorkDays = Math.max(0, workingDays(monthStart, monthLastDay) - monthLeave.congePaye - monthLeave.reposComp);
  const ytdWorkDays = Math.max(0, workingDays(yearStart, monthLastDay) - ytdLeave.congePaye - ytdLeave.reposComp);
  const r1 = (n: number) => Math.round(n * 10) / 10;

  return {
    brut: { month: Number(payslip.totalGains), ytd: sum('totalGains') },
    chargesSal: { month: Number(payslip.totalDeductions), ytd: sum('totalDeductions') },
    chargesPat: { month: Number(payslip.employerCharges), ytd: sum('employerCharges') },
    netImposable: { month: Number(payslip.grossTaxable), ytd: sum('grossTaxable') },
    hours: { month: r1(monthWorkDays * hoursPerDay), ytd: r1(ytdWorkDays * hoursPerDay) },
  };
}

/* ─── Rendu PDF du bulletin ─────────────────────────────────────── */

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

interface PayslipCompany { name: string; registre: string; contribuable: string; address: string; phone: string }

export async function loadPayslipCompany(): Promise<PayslipCompany> {
  const map = await getSettings([
    SettingsKeys.companyName, SettingsKeys.companyRegistre, SettingsKeys.companyContribuable,
    SettingsKeys.companyAddress, SettingsKeys.companyPhoneFixed,
  ]);
  return {
    name: map[SettingsKeys.companyName] ?? 'AFRIKIMMO',
    registre: map[SettingsKeys.companyRegistre] ?? '',
    contribuable: map[SettingsKeys.companyContribuable] ?? '',
    address: map[SettingsKeys.companyAddress] ?? '',
    phone: map[SettingsKeys.companyPhoneFixed] ?? '',
  };
}

export interface PayslipTemplateOpts {
  layout?: string;            // MODELE_1 | MODELE_2 | MODELE_3
  headerHtml?: string | null;
  footerHtml?: string | null;
  accentColor?: string | null;
}

/** CSS propre à chaque modèle de bulletin (MODELE_1/2/3). */
function payslipLayoutCss(layout: string, accent: string): string {
  if (layout === 'MODELE_2') {
    // Moderne : bordure d'accent, en-têtes clairs, lignes alternées.
    return `
  body { border-top: 6px solid ${accent}; }
  .head { border-bottom: none; }
  th { background: transparent; color: ${accent}; border-bottom: 2px solid ${accent}; }
  td { border-bottom: 1px solid #eef2f7; }
  table tbody tr:nth-child(even) td { background: #f8fafc; }
  .tot { background: ${accent}0d; border-radius: 8px; padding: 10px 14px; }`;
  }
  if (layout === 'MODELE_3') {
    // Compact : police réduite, tableaux denses.
    return `
  body { font-size: 10.5px; }
  .head { padding-bottom: 6px; }
  .doc h1 { font-size: 14px; }
  th { background: #e2e8f0; color: #334155; padding: 3px 6px; }
  td { padding: 2px 6px; }
  .sec { margin-top: 8px; }
  table { margin-top: 6px; }`;
  }
  // MODELE_1 (classique)
  return `
  th { background: ${accent}; color: #fff; }`;
}

export function renderPayslipHtml(
  payslip: any,
  employee: any,
  company: PayslipCompany,
  template?: PayslipTemplateOpts,
  logoDataUri?: string | null,
  counters?: PayslipLeaveCounters | null,
  totals?: PayslipTotals | null,
): string {
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = (n: unknown) => `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)))}`;
  const fmtDate = (d: unknown) => (d ? new Date(d as any).toLocaleDateString('fr-FR') : '—');
  /** Ancienneté en années/mois calculée à la fin de la période de paie. */
  const seniorityText = (hire: unknown): string => {
    if (!hire) return '—';
    const start = new Date(hire as any);
    if (isNaN(start.getTime())) return '—';
    const ref = new Date(payslip.periodYear, payslip.periodMonth, 0); // dernier jour du mois de la période
    let months = (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth());
    if (ref.getDate() < start.getDate()) months -= 1;
    if (months < 0) return '—';
    const y = Math.floor(months / 12);
    const m = months % 12;
    const parts: string[] = [];
    if (y > 0) parts.push(`${y} an${y > 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} mois`);
    return parts.length ? parts.join(' ') : "moins d'un mois";
  };
  const categorie = payslip.contract?.categorie || employee.categorie || '—';
  const name = `${employee.lastName ?? ''} ${employee.firstName ?? ''}`.trim();
  const periodStart = new Date(payslip.periodYear, (payslip.periodMonth ?? 1) - 1, 1);
  const periodEnd = new Date(payslip.periodYear, payslip.periodMonth ?? 1, 0); // dernier jour du mois
  const period = `du ${fmtDate(periodStart)} au ${fmtDate(periodEnd)}`;
  const paymentText = payslip.paidAt
    ? `Paiement le ${fmtDate(payslip.paidAt)}${payslip.paymentMethod ? ` par ${String(payslip.paymentMethod).replace(/_/g, ' ')}` : ''}`
    : '';
  const lines: any[] = (payslip.lines ?? []).slice().sort((a: any, b: any) => a.order - b.order);
  const gains = lines.filter((l) => l.type === 'GAIN');
  const retenues = lines.filter((l) => l.type === 'RETENUE');
  const charges = lines.filter((l) => l.type === 'CHARGE_PATRONALE');

  const accent = (template?.accentColor && template.accentColor.trim()) || '#1E3A5F';
  const layout = template?.layout || 'MODELE_1';

  const rows = (arr: any[]) => arr.map((l) => `
    <tr>
      <td>${esc(l.label)}</td>
      <td class="num">${l.nombre != null ? esc(l.nombre) : ''}</td>
      <td class="num">${l.base != null ? fmt(l.base) : ''}</td>
      <td class="num">${l.rate != null ? `${Number(l.rate)} %` : ''}</td>
      <td class="num">${fmt(l.amount)}</td>
    </tr>`).join('');

  // Tableau des compteurs de congés / repos compensateur (jours), à gauche des
  // signatures : 2 lignes (congés payés, repos compensateur) × 4 colonnes.
  const fmtDays = (n: unknown) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(Number(n ?? 0));
  const dayCell = (v: number | null) => `<td class="num">${v == null ? '—' : fmtDays(v)}</td>`;
  const counterCells = (c: { acquired: number | null; takenYear: number; remaining: number | null }) =>
    `${dayCell(c.acquired)}${dayCell(c.takenYear)}${dayCell(c.remaining)}`;
  const countersHtml = counters
    ? `<table class="counters">
        <thead><tr>
          <th>Compteurs (jours) — ${counters.year}</th><th class="num">Acquis</th><th class="num">Pris</th><th class="num">Restant</th>
        </tr></thead>
        <tbody>
          <tr><td>Congés payés</td>${counterCells(counters.conge)}</tr>
          <tr><td>Repos compensateur</td>${counterCells(counters.reposComp)}</tr>
        </tbody>
      </table>`
    : '<div></div>';

  // Récapitulatif : 2 lignes (mois en cours / cumul de la période écoulée) ×
  // salaire brut, charges salariales, charges patronales, net imposable, heures.
  const totalsRow = (label: string, pick: (m: MetricPair) => number) => `
    <tr>
      <td>${label}</td>
      <td class="num">${fmt(pick(totals!.brut))}</td>
      <td class="num">${fmt(pick(totals!.chargesSal))}</td>
      <td class="num">${fmt(pick(totals!.chargesPat))}</td>
      <td class="num">${fmt(pick(totals!.netImposable))}</td>
      <td class="num">${fmtDays(pick(totals!.hours))} h</td>
    </tr>`;
  const totalsHtml = totals
    ? `<table class="totals">
        <thead><tr>
          <th>Période</th><th class="num">Salaire brut</th><th class="num">Charges salariales</th>
          <th class="num">Charges patronales</th><th class="num">Net imposable</th><th class="num">Heures travaillées</th>
        </tr></thead>
        <tbody>
          ${totalsRow('Mois en cours', (m) => m.month)}
          ${totalsRow('Cumul (période écoulée)', (m) => m.ytd)}
        </tbody>
      </table>`
    : '';

  const defaultHeader = `
    <div>
      ${logoDataUri
        ? `<img class="logo" src="${logoDataUri}"/>`
        : `<div class="company">${esc(company.name)}</div>`}
      <div class="lines">${[company.address, company.phone && `Tél : ${company.phone}`, company.registre && `RCCM : ${company.registre}`].filter(Boolean).map(esc).join('<br>')}</div>
    </div>`;
  const headerHtml = template?.headerHtml && template.headerHtml.trim() ? template.headerHtml : defaultHeader;
  const defaultFooter = `Bulletin établi le ${new Date().toLocaleDateString('fr-FR')}. Document conforme au régime social (CNPS) et fiscal (ITS) de Côte d'Ivoire. Les montants sont exprimés en FCFA.`;
  const footerHtml = template?.footerHtml && template.footerHtml.trim() ? template.footerHtml : defaultFooter;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${accent}; padding-bottom: 10px; }
  .company { font-size: 16px; font-weight: bold; color: ${accent}; }
  .logo { max-height: 104px; max-width: 330px; object-fit: contain; }
  .lines { font-size: 10px; color: #475569; }
  .company-full { margin-top: 10px; text-align: center; font-size: 11px; font-weight: bold; color: ${accent}; }
  .doc { text-align: right; }
  .doc h1 { font-size: 22px; color: ${accent}; margin: 0; }
  .doc .period { font-size: 12px; color: #334155; }
  .emp { margin-top: 14px; display: flex; justify-content: space-between; font-size: 11px; }
  .emp .name { font-weight: bold; font-size: 13px; }
  /* Largeurs de colonnes fixes : les 3 tableaux (gains/retenues/charges)
     partagent la même grille → colonnes alignées et proportionnelles. */
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; table-layout: fixed; }
  th { text-align: center; vertical-align: middle; padding: 4px 8px; }
  th.num { text-align: right; }
  td { padding: 2.5px 8px; border-bottom: 1px solid #e2e8f0; overflow-wrap: break-word; }
  /* Fin séparateur vertical entre les colonnes. */
  th, td { border-right: 1px solid #e2e8f0; }
  th:last-child, td:last-child { border-right: none; }
  .num { text-align: right; }
  col.c-designation { width: 40%; }
  col.c-nombre { width: 12%; }
  col.c-base { width: 18%; }
  col.c-taux { width: 12%; }
  col.c-montant { width: 18%; }
  .sec { margin-top: 10px; font-size: 11px; text-transform: uppercase; color: ${accent}; font-weight: bold; }
  .tot { margin-top: 8px; margin-left: auto; width: 300px; }
  .tot div { display: flex; justify-content: space-between; padding: 2px 0; }
  .tot .net { font-weight: bold; font-size: 14px; color: ${accent}; border-top: 2px solid ${accent}; padding-top: 5px; }
  .foot { margin-top: 12px; font-size: 10px; color: #64748b; }
  /* Bas de bulletin : compteurs de congés à gauche, espaces de signature à droite. */
  .bottom { margin-top: 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-right: 4px; break-inside: avoid; page-break-inside: avoid; }
  /* Récapitulatif mois / cumul (2 lignes × colonnes de rubriques). */
  .totals { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; margin-top: 10px; }
  .totals th, .totals td { border: 1px solid #cbd5e1; padding: 3px 6px; }
  .totals thead th { background: ${accent}; color: #fff; text-align: center; }
  .totals th:first-child { text-align: left; }
  .totals tbody td:first-child { font-weight: bold; color: #334155; background: #f1f5f9; }
  .totals td.num, .totals th.num { text-align: right; }
  /* Tableau des compteurs de congés / repos compensateur (2 lignes × 4 colonnes). */
  .counters { border-collapse: collapse; font-size: 10px; margin-top: 0; }
  .counters th, .counters td { border: 1px solid #cbd5e1; padding: 3px 6px; }
  .counters thead th { background: ${accent}; color: #fff; text-align: center; }
  .counters tbody td:first-child { font-weight: bold; color: #334155; background: #f1f5f9; }
  .counters th:first-child { text-align: left; }
  .counters th.num, .counters td.num { text-align: center; width: 48px; }
  /* Zones de signature (ne pas rétrécir : conserver la taille des cadres). */
  .signatures { display: flex; justify-content: flex-end; gap: 14px; flex-shrink: 0; }
  .sign-box { width: 165px; border: 1.5px solid #64748b; border-radius: 4px; }
  .sign-box .s-label { font-size: 10px; font-weight: bold; color: #475569; padding: 3px 6px; border-bottom: 1px solid #cbd5e1; text-align: center; }
  .sign-box .s-space { height: 52px; }
  ${payslipLayoutCss(layout, accent)}
</style></head><body>
  <div class="head">
    ${headerHtml}
    <div class="doc">
      <h1>BULLETIN DE PAIE</h1>
      <div class="period">Période ${esc(period)}</div>
      ${paymentText ? `<div class="period">${esc(paymentText)}</div>` : ''}
      <div class="lines">${esc(payslip.reference)}</div>
    </div>
  </div>

  <div class="emp">
    <div>
      <div class="name">${esc(name)}</div>
      <div>Matricule : ${esc(employee.matricule)}</div>
      <div>Emploi : ${esc(payslip.contract?.poste || employee.poste || '—')}</div>
      <div>Catégorie socio-professionnelle : ${esc(categorie)}</div>
      <div>Date d'embauche : ${esc(fmtDate(employee.hireDate))}</div>
      <div>Ancienneté : ${esc(seniorityText(employee.hireDate))}</div>
    </div>
    <div style="text-align:right">
      <div>N° CNPS : ${esc(employee.cnpsNumber || '—')}</div>
      <div>N° CMU : ${esc(employee.cmuNumber || '—')}</div>
      <div>Parts IGR : ${esc(employee.igrParts != null ? Number(employee.igrParts) : 1)}</div>
    </div>
  </div>

  <div class="sec">Gains</div>
  <table><colgroup><col class="c-designation"><col class="c-nombre"><col class="c-base"><col class="c-taux"><col class="c-montant"></colgroup><thead><tr><th>Désignation</th><th class="num">Nombre</th><th class="num">Base</th><th class="num">Taux</th><th class="num">Montant</th></tr></thead>
    <tbody>${rows(gains)}<tr><td colspan="4"><strong>Total des gains (brut)</strong></td><td class="num"><strong>${fmt(payslip.totalGains)}</strong></td></tr></tbody></table>

  <div class="sec">Retenues salariales</div>
  <table><colgroup><col class="c-designation"><col class="c-nombre"><col class="c-base"><col class="c-taux"><col class="c-montant"></colgroup><thead><tr><th>Désignation</th><th class="num">Nombre</th><th class="num">Base</th><th class="num">Taux</th><th class="num">Montant</th></tr></thead>
    <tbody>${rows(retenues)}<tr><td colspan="4"><strong>Total des retenues</strong></td><td class="num"><strong>${fmt(payslip.totalDeductions)}</strong></td></tr></tbody></table>

  <div class="tot">
    <div><span>Total des gains</span><span>${fmt(payslip.totalGains)} FCFA</span></div>
    <div><span>Total des retenues</span><span>- ${fmt(payslip.totalDeductions)} FCFA</span></div>
    <div class="net"><span>NET À PAYER</span><span>${fmt(payslip.netSalary)} FCFA</span></div>
  </div>

  <div class="sec">Charges patronales (information)</div>
  <table><colgroup><col class="c-designation"><col class="c-nombre"><col class="c-base"><col class="c-taux"><col class="c-montant"></colgroup><thead><tr><th>Désignation</th><th class="num">Nombre</th><th class="num">Base</th><th class="num">Taux</th><th class="num">Montant</th></tr></thead>
    <tbody>${rows(charges)}<tr><td colspan="4"><strong>Total charges patronales</strong></td><td class="num"><strong>${fmt(payslip.employerCharges)}</strong></td></tr></tbody></table>

  ${totalsHtml}

  <div class="bottom">
    ${countersHtml}
    <div class="signatures">
      <div class="sign-box"><div class="s-label">Employé</div><div class="s-space"></div></div>
      <div class="sign-box"><div class="s-label">Employeur</div><div class="s-space"></div></div>
    </div>
  </div>

  <div class="foot">${footerHtml}</div>
  <div class="company-full">Afrique Immo Builders (AFRIKIMMO)</div>
</body></html>`;
}
