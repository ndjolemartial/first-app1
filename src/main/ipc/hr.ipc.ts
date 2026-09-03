import { ipcMain, shell } from 'electron';
import fs from 'fs';
import { getDb } from '../services/db.service';
import { getSession } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';
import { htmlToPdf, openPrintPreview } from '../services/pdf.service';
import { loadContractCompany } from '../services/contract-template.service';
import { getDefaultRates } from '../services/commission.service';
import {
  computePayroll, computePrimeAnciennete, getPayrollRates, setPayrollRates,
  loadPayslipCompany, renderPayslipHtml, loadPayslipLogo, computePayslipTotals, type PayrollRates,
} from '../services/payroll.service';
import {
  resolvePayslipTemplate,
} from '../services/hr-templates.service';
import { workingDays, computeLeaveBalance, computePayslipLeaveCounters } from '../services/leave.service';
import { attendanceMonthSummary } from '../services/attendance.service';
import { computeLatenessLinesForEmployee, latenessEligibleEmployeeIds } from '../services/performance.service';
import { recordTreasuryOperation, computeBalances } from '../services/treasury.service';
import { getSetting, SettingsKeys } from '../services/settings.service';
import { readStorageFile, writeEmployeeSignedContract, writeLeaveSignedDocument, removeStorageFile, resolveStoragePath } from '../services/storage.service';

/**
 * Module RH / Paie — Phase 1 : gestion du personnel et des contrats de travail.
 *
 * Accès réservé au rôle dédié RH ainsi qu'aux administrateurs (SUPER_ADMIN,
 * ADMIN). Les autres rôles n'ont aucun accès au module (données personnelles
 * sensibles). Toutes les écritures sont validées par Zod et utilisent le soft
 * delete (`deletedAt`).
 */

// Rôles pleinement habilités sur le module RH (personnel, paie, configuration).
// ACCOUNTANT (Comptable) dispose du plein accès RH & Paie, au même titre que RH.
const HR_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT'];
// Rôles à accès RESTREINT : MANAGER et ASSISTANTE_DIRECTION accèdent au module
// mais uniquement pour les employés dont le contrat en cours n'est PAS un CDI
// (dès qu'un employé passe en CDI, il leur est masqué). Ils ne peuvent pas
// enregistrer le pointage ni modifier la configuration (modèles, taux…).
const HR_SCOPED_ROLES = ['MANAGER', 'ASSISTANTE_DIRECTION'];
// Écritures « administratives » (configuration : modèles, taux, catégories… et
// enregistrement du pointage) — réservées aux admins / RH.
const HR_WRITE_ROLES = [...HR_ADMIN_ROLES];
// Configuration des « Modèles de contrats de travail » (modèles de contrats,
// fonctions, fiches de poste) : ACCOUNTANT (Comptable) en est EXCLU, comme
// MANAGER — malgré son plein accès au reste du module RH & Paie (HR_WRITE_ROLES).
// Seul le volet « Objectifs assignés » (OBJECTIVE_WRITE_ROLES) leur reste ouvert.
const CONTRACT_TEMPLATE_CONFIG_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RH'];
// Écritures opérationnelles (personnel, contrats, bulletins, congés) : admins +
// rôles restreints (ces derniers filtrés aux employés non-CDI).
const HR_OPERATIONAL_ROLES = [...HR_ADMIN_ROLES, ...HR_SCOPED_ROLES];
// Lecture : admins + rôles restreints (filtrés aux employés non-CDI).
const HR_READ_ROLES = [...HR_ADMIN_ROLES, ...HR_SCOPED_ROLES];

// Pointage : le Comptable (ACCOUNTANT) en est EXCLU, malgré son plein accès au
// reste du module RH & Paie. Écriture = admins / RH ; lecture = + MANAGER / AD.
const ATTENDANCE_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RH'];
const ATTENDANCE_READ_ROLES = [...ATTENDANCE_WRITE_ROLES, ...HR_SCOPED_ROLES];

// Retards & Départs précipités : réservé à SUPER_ADMIN/ADMIN/MANAGER
// exclusivement (ni RH, ni ACCOUNTANT, ni ASSISTANTE_DIRECTION). Contrôle de
// rôle EXACT (checkHrRole), sans équivalence.
const LATENESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

// Personnel (détail/écritures), contrats et bulletins de paie : accès admins,
// RH, Comptable, MANAGER — et ASSISTANTE_DIRECTION (accès opérationnel
// restreint, cf. HR_SCOPED_ROLES : consulter + gérer, limité aux employés
// dont le contrat en cours n'est pas un CDI, via assertEmployeeAccessible /
// hrScopeWhere déjà appliqués par ces handlers).
const HR_STAFF_READ_ROLES  = [...HR_ADMIN_ROLES, 'MANAGER'];
const HR_STAFF_WRITE_ROLES = [...HR_ADMIN_ROLES, 'MANAGER'];
// Variantes ouvertes à ASSISTANTE_DIRECTION — tout ce qui touche la « fiche »
// personnel/contrat/bulletin (consultation, création, modification), mais PAS
// la suppression ni les opérations financières (marquer un bulletin payé,
// choisir un compte bancaire de paiement — hors périmètre Trésorerie/
// Comptabilité de ce rôle, cf. hr:payslips:payAccounts/updateStatus/
// updatePayment, restés sur HR_STAFF_READ_ROLES/HR_STAFF_WRITE_ROLES).
const HR_STAFF_READ_ROLES_SCOPED  = [...HR_STAFF_READ_ROLES, 'ASSISTANTE_DIRECTION'];
const HR_STAFF_WRITE_ROLES_SCOPED = [...HR_STAFF_WRITE_ROLES, 'ASSISTANTE_DIRECTION'];

/**
 * Contrôle de rôle EXACT pour le module RH (n'applique pas les équivalences de
 * `checkRole`, afin que ACCOUNTANT — équivalent MANAGER — n'obtienne PAS l'accès
 * RH accordé à MANAGER / ASSISTANTE_DIRECTION).
 */
function checkHrRole(session: { role: string }, allowed: string[]): void {
  if (!allowed.includes(session.role)) throw new Error('Permission insuffisante');
}

const isScopedHr = (role: string): boolean => HR_SCOPED_ROLES.includes(role);

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Identifiants des employés MASQUÉS aux rôles restreints : ceux dont le
 * « contrat en cours » est un CDI. Contrat en cours = contrat ACTIF le plus
 * récent (à défaut, le plus récent par date de début). Les employés sans
 * contrat restent accessibles (non-CDI par défaut).
 */
async function hrExcludedEmployeeIds(db: ReturnType<typeof getDb>): Promise<number[]> {
  const contracts = await db.employmentContract.findMany({
    where: { deletedAt: null },
    select: { employeeId: true, type: true, status: true, startDate: true },
  });
  const byEmp = new Map<number, Array<{ type: string; status: string; startDate: Date }>>();
  for (const c of contracts) {
    const list = byEmp.get(c.employeeId) ?? [];
    list.push({ type: c.type as string, status: c.status as string, startDate: c.startDate as Date });
    byEmp.set(c.employeeId, list);
  }
  const excluded: number[] = [];
  for (const [empId, list] of byEmp) {
    const actifs = list.filter((c) => c.status === 'ACTIF');
    const pool = actifs.length ? actifs : list;
    pool.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    if (pool[0]?.type === 'CDI') excluded.push(empId);
  }
  return excluded;
}

/**
 * Employés MASQUÉS à un rôle restreint pour l'accès RH « par défaut » (personnel,
 * contrats de travail, bulletins) :
 *   - MANAGER : accède à TOUS les employés (y compris CDI), à l'exception de ceux
 *     rattachés à un compte utilisateur SUPER_ADMIN / ADMIN.
 *   - ASSISTANTE_DIRECTION : reste limitée aux employés non-CDI.
 */
async function hrDefaultExcludedIds(session: { role: string }, db: ReturnType<typeof getDb>): Promise<number[]> {
  if (session.role === 'MANAGER') return hrEmployeeIdsByUserRoles(db, ['SUPER_ADMIN', 'ADMIN']);
  if (session.role === 'ASSISTANTE_DIRECTION') return hrExcludedEmployeeIds(db);
  return [];
}

/** Vérifie qu'un rôle restreint peut accéder à cet employé (périmètre par défaut). */
async function assertEmployeeAccessible(session: { role: string }, db: ReturnType<typeof getDb>, employeeId: number | null | undefined): Promise<void> {
  if (!isScopedHr(session.role) || employeeId == null) return;
  const excluded = await hrDefaultExcludedIds(session, db);
  if (excluded.includes(Number(employeeId))) {
    throw new Error('Accès restreint à cet employé.');
  }
}

/** Fragment `where` restreignant aux employés accessibles (par champ id d'employé). */
async function hrScopeWhere(session: { role: string }, db: ReturnType<typeof getDb>, field: 'id' | 'employeeId'): Promise<Record<string, any>> {
  if (!isScopedHr(session.role)) return {};
  const excluded = await hrDefaultExcludedIds(session, db);
  return excluded.length ? { [field]: { notIn: excluded } } : {};
}

// ── Périmètre spécifique Pointage & Congés ──────────────────────────────────
// Sur ces deux modules, MANAGER et ASSISTANTE_DIRECTION accèdent à TOUS les
// employés (y compris CDI), à l'exception de ceux dont le compte utilisateur
// rattaché a un rôle « privilégié » :
//   - ASSISTANTE_DIRECTION : exclut les comptes admin (SUPER_ADMIN/ADMIN) ET MANAGER
//   - MANAGER              : exclut uniquement les comptes admin (SUPER_ADMIN/ADMIN)
// Les admins / RH ne sont pas restreints.

/** Employés dont le compte utilisateur rattaché a l'un des rôles donnés. */
async function hrEmployeeIdsByUserRoles(db: ReturnType<typeof getDb>, roles: string[]): Promise<number[]> {
  const emps = await db.employee.findMany({
    where: { deletedAt: null, user: { is: { role: { in: roles as any } } } },
    select: { id: true },
  });
  return emps.map((e) => e.id);
}

/** Identifiants exclus pour le pointage / congés selon le rôle. */
async function hrExcludedAttendanceLeave(session: { role: string }, db: ReturnType<typeof getDb>): Promise<number[]> {
  if (session.role === 'ASSISTANTE_DIRECTION') return hrEmployeeIdsByUserRoles(db, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
  if (session.role === 'MANAGER') return hrEmployeeIdsByUserRoles(db, ['SUPER_ADMIN', 'ADMIN']);
  return [];
}

async function assertEmployeeAccessibleAL(session: { role: string }, db: ReturnType<typeof getDb>, employeeId: number | null | undefined): Promise<void> {
  if (!isScopedHr(session.role) || employeeId == null) return;
  const excluded = await hrExcludedAttendanceLeave(session, db);
  if (excluded.includes(Number(employeeId))) throw new Error('Accès restreint à cet employé.');
}

async function hrScopeWhereAL(session: { role: string }, db: ReturnType<typeof getDb>, field: 'id' | 'employeeId'): Promise<Record<string, any>> {
  if (!isScopedHr(session.role)) return {};
  const excluded = await hrExcludedAttendanceLeave(session, db);
  return excluded.length ? { [field]: { notIn: excluded } } : {};
}

/** Identifiant de l'employé lié au compte connecté (self-service), ou null. */
async function getMyEmployeeId(session: { userId?: number | null }, db: ReturnType<typeof getDb>): Promise<number | null> {
  if (session.userId == null) return null;
  const emp = await db.employee.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true } });
  return emp?.id ?? null;
}

/** Libellés de statut d'une demande de congé. */
const LEAVE_STATUS_FR: Record<string, string> = {
  EN_ATTENTE: 'En attente', APPROUVE: 'Approuvé', REFUSE: 'Refusé', ANNULE: 'Annulé',
};

/**
 * Fiche imprimable « Congés & Absence » : détails de la demande + blocs de
 * signatures (Le Demandeur, Le Responsable hiérarchique, Le Directeur Général).
 */
function renderLeaveRequestHtml(req: any, emp: any, company: any, logo?: string | null, slogan?: string): string {
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmtDate = (d: unknown) => (d ? new Date(d as any).toLocaleDateString('fr-FR') : '—');
  const sigle = company?.name || 'AFRIKIMMO';
  // Coordonnées de l'entreprise (colonne de droite de l'en-tête) : contact + adresse.
  const infoLines = [
    company?.phone ? `Tél : ${company.phone}` : '',
    ...(company?.address ? String(company.address).split(/\r?\n/) : []),
  ].filter(Boolean);
  const empName = `${emp?.lastName ?? ''} ${emp?.firstName ?? ''}`.trim() || '—';
  const matricule = emp?.matricule ? `${esc(emp.matricule)} — ` : '';
  const row = (label: string, value: string) => `<tr><td class="lbl">${esc(label)}</td><td class="val">${value}</td></tr>`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; font-size: 13px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .head .brand { text-align: left; }
    .head .logo { max-height: 72px; max-width: 200px; display: block; }
    .head .sigle-lg { font-size: 18px; font-weight: bold; color: #1E3A5F; }
    .head .slogan { margin-top: 4px; font-size: 11px; font-style: italic; color: #475569; max-width: 240px; }
    .head .company-info { text-align: right; font-size: 12px; color: #334155; line-height: 1.5; }
    .head .company-info .sigle { font-weight: bold; font-size: 13px; color: #0f172a; }
    h1 { font-size: 18px; text-align: center; text-transform: uppercase; letter-spacing: .5px; margin: 18px 0 22px; color: #1E3A5F; }
    table.details { width: 100%; border-collapse: collapse; }
    table.details td { padding: 8px 10px; border: 1px solid #cbd5e1; vertical-align: top; }
    td.lbl { width: 38%; background: #f1f5f9; font-weight: 600; color: #334155; }
    td.val { color: #0f172a; }
    .sign { display: flex; justify-content: space-between; gap: 28px; margin-top: 56px; }
    .sign .box { flex: 1; text-align: center; }
    .sign .role { font-weight: 600; font-size: 12px; text-transform: uppercase; color: #334155; }
    /* Zone de signature agrandie (espace suffisant pour signer / cacheter). */
    .sign .line { margin-top: 130px; border-top: 1px solid #64748b; padding-top: 4px; font-size: 11px; color: #64748b; }
    .foot { margin-top: 40px; font-size: 11px; color: #64748b; text-align: right; }
  </style></head><body>
    <div class="head">
      <div class="brand">
        ${logo ? `<img class="logo" src="${logo}"/>` : `<div class="sigle-lg">${esc(sigle)}</div>`}
        ${slogan ? `<div class="slogan">${esc(slogan)}</div>` : ''}
      </div>
      <div class="company-info">
        <div class="sigle">${esc(sigle)}</div>
        ${infoLines.map((l) => `<div>${esc(l)}</div>`).join('')}
      </div>
    </div>
    <h1>Fiche de congés &amp; absence</h1>
    <table class="details">
      ${row('Référence', esc(req.reference))}
      ${row('Employé', `${matricule}${esc(empName)}`)}
      ${row('Poste', esc(emp?.poste ?? '—'))}
      ${row('Type', esc(req.type?.name ?? '—'))}
      ${row('Période', `Du <strong>${fmtDate(req.startDate)}</strong> au <strong>${fmtDate(req.endDate)}</strong>`)}
      ${row('Nombre de jours', `${esc(String(Number(req.days)))} jour(s) ouvré(s)`)}
      ${row('Motif', esc(req.reason ?? '—'))}
      ${row('Statut', esc(LEAVE_STATUS_FR[req.status] ?? req.status))}
      ${row('Date de la demande', fmtDate(req.createdAt))}
    </table>
    <div class="sign">
      <div class="box"><div class="role">Le Demandeur</div><div class="line">Nom &amp; signature</div></div>
      <div class="box"><div class="role">Le Responsable hiérarchique</div><div class="line">Nom &amp; signature</div></div>
      <div class="box"><div class="role">Le Directeur Général</div><div class="line">Nom &amp; signature</div></div>
    </div>
    <div class="foot">Fait à ${esc(emp?.city || 'Abidjan')}, le ${fmtDate(new Date())}</div>
  </body></html>`;
}

const CIVILITE = ['Monsieur', 'Madame', 'Mademoiselle'] as const;
const MARITAL = ['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE', 'DIVORCE', 'VEUF'] as const;
const SEXE = ['MASCULIN', 'FEMININ'] as const;
const EMPLOYEE_STATUS = ['ACTIF', 'SUSPENDU', 'CONGE', 'SORTI'] as const;
const CONTRACT_TYPE = ['CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE', 'ESSAI', 'AVENANT_CDD', 'RENOUVELLEMENT_ESSAI'] as const;
const CONTRACT_STATUS = ['BROUILLON', 'ACTIF', 'SUSPENDU', 'TERMINE', 'ROMPU'] as const;

const emptyToNull = (v: unknown) => (v === '' ? null : v);

const employeeSchema = z.object({
  // Matricule : éditable. Laissé vide à la création → généré (EMP-AF-AAAA-NNNN).
  matricule: z.string().optional().nullable(),
  civilite: z.preprocess(emptyToNull, z.enum(CIVILITE).nullable().optional()),
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  sexe: z.preprocess(emptyToNull, z.enum(SEXE).nullable().optional()),
  birthDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  birthPlace: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  maritalStatus: z.preprocess(emptyToNull, z.enum(MARITAL).nullable().optional()),
  childrenCount: z.coerce.number().int().min(0).optional(),
  igrParts: z.coerce.number().min(0).optional(),
  email: z.string().email('Email invalide').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  idNumber: z.string().optional().nullable(),
  cnpsNumber: z.string().optional().nullable(),
  cmuNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankRib: z.string().optional().nullable(),
  bankCode: z.string().optional().nullable(),
  bankGuichetCode: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankRibKey: z.string().optional().nullable(),
  poste: z.string().optional().nullable(),
  departement: z.string().optional().nullable(),
  // Filière de carrière : un employé n'est rattaché qu'à un seul profil à la fois.
  careerProfileId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  userId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  // Responsable hiérarchique (évaluateur au titre de la gestion de la performance).
  managerId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  status: z.enum(EMPLOYEE_STATUS).optional(),
  hireDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  exitDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  exitReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const contractSchema = z.object({
  employeeId: z.coerce.number().int().positive('Employé requis'),
  type: z.enum(CONTRACT_TYPE).default('CDI'),
  status: z.enum(CONTRACT_STATUS).default('ACTIF'),
  poste: z.string().optional().nullable(),
  categorie: z.string().optional().nullable(),
  startDate: z.coerce.date({ message: 'Date de début requise' }),
  endDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  trialEndDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  weeklyHours: z.preprocess(emptyToNull, z.coerce.number().positive().nullable().optional()),
  baseSalary: z.coerce.number().nonnegative('Salaire de base requis'),
  // Détail de rémunération (saisi) — figurant dans la clause de rémunération.
  sursalaire: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  primeAnciennete: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  grossSalary: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  its: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  cnps: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  cmu: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  totalDeductions: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  transportAllowance: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  netSalary: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  // Avenant CDD : contrat CDD initial amendé (requis pour le type AVENANT_CDD).
  parentContractId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  // Autorité responsable : employé signataire/responsable au titre du contrat.
  responsibleAuthorityId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  // Fonction de l'employé (référentiel paramétrable).
  functionId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  // Objectifs assignés (référentiel paramétrable).
  objectiveId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  // Commissions sur activité (instantané libellé + taux) auxquelles l'employé a droit.
  activityCommissions: z
    .array(z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      rate: z.coerce.number().min(0).max(100),
    }))
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
});

/** Normalise un email vide en null. */
function normEmail(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}

/** Génère la prochaine référence séquentielle annuelle (préfixe-YYYY-NNNN). */
/**
 * Génère le prochain matricule au format AF-<année>-NNNN.
 * `year` = année d'embauche si indiquée, sinon année en cours.
 */
async function nextEmployeeMatricule(db: ReturnType<typeof getDb>, year: number): Promise<string> {
  const prefix = `AF-${year}-`;
  const last = await db.employee.findFirst({
    where: { matricule: { startsWith: prefix } },
    orderBy: { matricule: 'desc' },
    select: { matricule: true },
  });
  // Séquence = dernier segment (AF-AAAA-NNNN → index 2).
  const seq = last ? parseInt(last.matricule.split('-')[2], 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function nextContractReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.employmentContract.findFirst({
    where: { reference: { startsWith: `CTR-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `CTR-${year}-${String(seq).padStart(4, '0')}`;
}

/** Enregistre les handlers IPC du module RH / Paie. */
export function registerHrIPC(): void {
  /* ─── Personnel ─────────────────────────────────────────────── */

  ipcMain.handle('hr:employees:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.search) {
        const s = String(filters.search);
        where.OR = [
          { firstName: { contains: s } },
          { lastName: { contains: s } },
          { matricule: { contains: s } },
          { poste: { contains: s } },
          { email: { contains: s } },
        ];
      }
      if (filters.status) where.status = filters.status;
      if (filters.departement) where.departement = { contains: String(filters.departement) };
      // Rôles restreints : périmètre selon le contexte.
      //  - `leaveRequest` (sélecteur d'une nouvelle demande de congé) : AUCUNE
      //    restriction — AD & MANAGER voient tous les employés (actifs via le
      //    filtre status), afin de pouvoir déposer une demande pour n'importe qui.
      //  - `attendanceLeave` (pointage) : AD voit tous sauf comptes admin/manager.
      //  - sinon (personnel) : périmètre « non-CDI » (AD) / admin-liés (MANAGER).
      if (filters.context !== 'leaveRequest') {
        Object.assign(where, filters.context === 'attendanceLeave'
          ? await hrScopeWhereAL(session, db, 'id')
          : await hrScopeWhere(session, db, 'id'));
      }
      const [data, total] = await db.$transaction([
        db.employee.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { matricule: 'desc' },
          include: {
            contracts: {
              where: { deletedAt: null },
              orderBy: { startDate: 'desc' },
              take: 1,
            },
          },
        }),
        db.employee.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('hr:employees:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:employees:stats', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES_SCOPED);
      const db = getDb();
      const rows = await db.employee.groupBy({
        by: ['status'],
        where: { deletedAt: null, ...(await hrScopeWhere(session, db, 'id')) },
        _count: { _all: true },
      });
      const stats: Record<string, number> = {};
      for (const r of rows) stats[r.status] = r._count._all;
      return { success: true, data: stats };
    } catch (error: any) {
      logger.error('hr:employees:stats error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:employees:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES_SCOPED);
      const db = getDb();
      const employee = await db.employee.findFirst({
        where: { id, deletedAt: null },
        include: {
          contracts: { where: { deletedAt: null }, orderBy: { startDate: 'desc' } },
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
      });
      if (!employee) return { success: false, error: 'Employé introuvable' };
      await assertEmployeeAccessible(session, db, id);
      return ser({ success: true, data: employee });
    } catch (error: any) {
      logger.error('hr:employees:getById error', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Liste des utilisateurs de l'application proposables pour être liés à un
   * membre du personnel. Renvoie les comptes actifs non encore rattachés à un
   * autre employé (le compte de l'employé en cours d'édition est conservé via
   * `excludeEmployeeId`). Réservé aux rôles RH/Admin.
   */
  ipcMain.handle('hr:employees:linkableUsers', async (_event, { token, excludeEmployeeId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES_SCOPED);
      const db = getDb();
      // « Lié » s'entend au sens de la contrainte d'unicité userId (tout employé,
      // y compris archivé) : on n'expose donc que les comptes sans employé, plus
      // celui déjà rattaché à l'employé édité.
      const orClauses: any[] = [{ employee: { is: null } }];
      if (excludeEmployeeId) orClauses.push({ employee: { is: { id: Number(excludeEmployeeId) } } });
      const data = await db.user.findMany({
        where: { deletedAt: null, isActive: true, OR: orClauses },
        select: { id: true, firstName: true, lastName: true, matricule: true, email: true, role: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      return { success: true, data };
    } catch (error: any) {
      logger.error('hr:employees:linkableUsers error', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Filières (profils de carrière actifs) sélectionnables sur la fiche employé —
   * lecture seule, ouverte à tous les rôles pouvant éditer un employé (contrairement
   * à `careerProfiles:list`, réservé au paramétrage SUPER_ADMIN/ADMIN).
   */
  ipcMain.handle('hr:employees:careerProfiles', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES_SCOPED);
      const db = getDb();
      const data = await db.careerProfile.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      return { success: true, data };
    } catch (error: any) {
      logger.error('hr:employees:careerProfiles error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:employees:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES_SCOPED);
      const parsed = employeeSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const db = getDb();
      const d = parsed.data;
      // Matricule : valeur saisie si fournie (unicité vérifiée), sinon généré
      // au format EMP-AF-<année d'embauche ou année en cours>-NNNN.
      let matricule = (d.matricule ?? '').trim();
      if (matricule) {
        const exists = await db.employee.findFirst({ where: { matricule }, select: { id: true } });
        if (exists) return { success: false, error: 'Ce matricule est déjà utilisé.' };
      } else {
        const year = d.hireDate ? new Date(d.hireDate).getFullYear() : new Date().getFullYear();
        matricule = await nextEmployeeMatricule(db, year);
      }
      // Compte utilisateur lié : un utilisateur ne peut être rattaché qu'à un seul employé.
      if (d.userId != null) {
        const linked = await db.employee.findFirst({ where: { userId: d.userId }, select: { id: true } });
        if (linked) return { success: false, error: 'Cet utilisateur est déjà lié à un autre membre du personnel.' };
      }
      const employee = await db.employee.create({
        data: {
          ...d,
          email: normEmail(d.email),
          matricule,
        } as any,
      });
      // Le matricule de l'utilisateur lié doit toujours refléter celui de l'employé.
      if (employee.userId != null) {
        await db.user.update({ where: { id: employee.userId }, data: { matricule } });
      }
      logger.info(`Employé créé : ${matricule}`);
      return ser({ success: true, data: employee });
    } catch (error: any) {
      logger.error('hr:employees:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:employees:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES_SCOPED);
      const parsed = employeeSchema.partial().safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const db = getDb();
      await assertEmployeeAccessible(session, db, id);
      const data: any = { ...parsed.data };
      if ('email' in data) data.email = normEmail(data.email);
      // Matricule modifiable : on ignore une valeur vide ; sinon unicité contrôlée.
      if ('matricule' in data) {
        const m = String(data.matricule ?? '').trim();
        if (!m) {
          delete data.matricule;
        } else {
          const exists = await db.employee.findFirst({ where: { matricule: m, id: { not: id } }, select: { id: true } });
          if (exists) return { success: false, error: 'Ce matricule est déjà utilisé.' };
          data.matricule = m;
        }
      }
      // Compte utilisateur lié : vérifier qu'il n'est pas déjà rattaché à un autre employé.
      if (data.userId != null) {
        const linked = await db.employee.findFirst({ where: { userId: data.userId, id: { not: id } }, select: { id: true } });
        if (linked) return { success: false, error: 'Cet utilisateur est déjà lié à un autre membre du personnel.' };
      }
      const employee = await db.employee.update({ where: { id }, data });
      // Le matricule de l'utilisateur lié doit toujours refléter celui de l'employé.
      if (employee.userId != null) {
        await db.user.update({ where: { id: employee.userId }, data: { matricule: employee.matricule } });
      }
      logger.info(`Employé mis à jour : id=${id}`);
      return ser({ success: true, data: employee });
    } catch (error: any) {
      logger.error('hr:employees:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:employees:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const db = getDb();
      await assertEmployeeAccessible(session, db, id);
      await db.employee.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Employé archivé (soft delete) : id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('hr:employees:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Contrats de travail ───────────────────────────────────── */

  /**
   * Valide un avenant CDD : rattachement obligatoire à un contrat CDD existant
   * du même employé, date de fin requise, et **délai cumulé ≤ 2 ans** — la date
   * de fin de l'avenant ne doit pas dépasser 2 ans après le début du CDD initial.
   * Retourne un message d'erreur, ou `null` si l'avenant est valide.
   */
  async function validateAvenantCdd(
    db: ReturnType<typeof getDb>,
    args: { employeeId: number; parentContractId?: number | null; endDate?: Date | null; selfId?: number },
  ): Promise<string | null> {
    if (!args.parentContractId) return 'Un avenant CDD doit être rattaché à un contrat CDD existant.';
    if (args.selfId && args.parentContractId === args.selfId) return 'Un avenant ne peut être rattaché à lui-même.';
    if (!args.endDate) return 'Une date de fin est requise pour un avenant CDD.';
    const parent = await db.employmentContract.findFirst({
      where: { id: args.parentContractId, deletedAt: null },
    });
    if (!parent) return 'Contrat CDD initial introuvable.';
    if (parent.type !== 'CDD') return 'Le contrat à amender doit être un CDD.';
    if (parent.employeeId !== args.employeeId) return "Le contrat CDD initial n'appartient pas à cet employé.";
    // Délai cumulé : la fin de l'avenant ne doit pas dépasser 2 ans après le
    // début du CDD initial (gère naturellement plusieurs avenants successifs).
    const maxEnd = new Date(parent.startDate);
    maxEnd.setFullYear(maxEnd.getFullYear() + 2);
    if (args.endDate.getTime() > maxEnd.getTime()) {
      return `Le délai cumulé du CDD et de ses avenants ne peut excéder 2 ans (date de fin maximale : ${maxEnd.toLocaleDateString('fr-FR')}).`;
    }
    return null;
  }

  const DAY_MS = 86_400_000;
  const durationDays = (start: Date, end: Date) => Math.round((end.getTime() - start.getTime()) / DAY_MS);

  /** Vérifie qu'un CDD ne dépasse pas 2 ans (24 mois). Retourne un message ou null. */
  function cddDurationError(startDate?: Date | string | null, endDate?: Date | string | null): string | null {
    if (!startDate || !endDate) return null; // l'exigence de date de fin est traitée à part
    const maxEnd = new Date(startDate);
    maxEnd.setFullYear(maxEnd.getFullYear() + 2);
    if (new Date(endDate).getTime() > maxEnd.getTime()) {
      return "La durée d'un CDD ne peut excéder 2 ans (24 mois).";
    }
    return null;
  }

  /**
   * Valide une lettre de renouvellement d'essai : rattachement obligatoire à un
   * contrat ESSAI existant du même employé, dates requises, et **durée égale à
   * celle de l'essai initial** (renouvellement à l'identique).
   * Retourne un message d'erreur, ou `null` si valide.
   */
  async function validateRenouvellementEssai(
    db: ReturnType<typeof getDb>,
    args: { employeeId: number; parentContractId?: number | null; startDate?: Date | null; endDate?: Date | null; selfId?: number },
  ): Promise<string | null> {
    if (!args.parentContractId) return "Une lettre de renouvellement d'essai doit être rattachée à un contrat ESSAI existant.";
    if (args.selfId && args.parentContractId === args.selfId) return 'Un renouvellement ne peut être rattaché à lui-même.';
    if (!args.startDate || !args.endDate) return 'Les dates de début et de fin sont requises pour un renouvellement d\'essai.';
    const parent = await db.employmentContract.findFirst({
      where: { id: args.parentContractId, deletedAt: null },
    });
    if (!parent) return 'Contrat ESSAI initial introuvable.';
    if (parent.type !== 'ESSAI') return 'Le contrat à renouveler doit être un contrat ESSAI.';
    if (parent.employeeId !== args.employeeId) return "Le contrat ESSAI initial n'appartient pas à cet employé.";
    // La durée de l'essai initial est portée par sa fin de période d'essai
    // (repli sur la date de fin pour les enregistrements antérieurs).
    const parentEnd = parent.trialEndDate ?? parent.endDate;
    if (!parentEnd) return "L'essai initial n'a pas de fin de période d'essai : impossible de déterminer sa durée.";
    const initialDuration = durationDays(parent.startDate, parentEnd);
    const renewalDuration = durationDays(args.startDate, args.endDate);
    // Tolérance d'un jour (bornes incluses/exclues selon la saisie).
    if (Math.abs(renewalDuration - initialDuration) > 1) {
      return `La lettre de renouvellement doit avoir la même durée que l'essai initial (${initialDuration} jour(s)).`;
    }
    return null;
  }

  ipcMain.handle('hr:contracts:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES_SCOPED);
      const parsed = contractSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const d = parsed.data;
      const db = getDb();
      const employee = await db.employee.findFirst({ where: { id: d.employeeId, deletedAt: null } });
      if (!employee) return { success: false, error: 'Employé introuvable' };
      await assertEmployeeAccessible(session, db, d.employeeId);
      if (d.type === 'AVENANT_CDD') {
        const err = await validateAvenantCdd(db, {
          employeeId: d.employeeId, parentContractId: d.parentContractId, endDate: d.endDate ?? null,
        });
        if (err) return { success: false, error: err };
      } else if (d.type === 'RENOUVELLEMENT_ESSAI') {
        const err = await validateRenouvellementEssai(db, {
          employeeId: d.employeeId, parentContractId: d.parentContractId,
          startDate: d.startDate ?? null, endDate: d.endDate ?? null,
        });
        if (err) return { success: false, error: err };
      } else {
        // Seuls l'avenant CDD et le renouvellement d'essai portent un parent.
        d.parentContractId = null;
        if (['CDD', 'STAGE', 'INTERIM'].includes(d.type) && !d.endDate) {
          return { success: false, error: 'Une date de fin est requise pour un contrat à durée déterminée.' };
        }
        if (d.type === 'CDD') {
          const err = cddDurationError(d.startDate, d.endDate);
          if (err) return { success: false, error: err };
        }
      }
      const reference = await nextContractReference(db);
      const contract = await db.employmentContract.create({
        data: { ...d, reference } as any,
      });
      logger.info(`Contrat créé : ${reference} (employé ${d.employeeId})`);
      return ser({ success: true, data: contract });
    } catch (error: any) {
      logger.error('hr:contracts:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contracts:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES_SCOPED);
      const parsed = contractSchema.partial().safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const db = getDb();
      const existing = await db.employmentContract.findFirst({ where: { id, deletedAt: null } });
      if (!existing) return { success: false, error: 'Contrat introuvable' };
      await assertEmployeeAccessible(session, db, existing.employeeId);
      const data: any = { ...parsed.data };
      delete data.employeeId; // le rattachement ne change pas après création
      const effType = data.type ?? existing.type;
      if (effType === 'AVENANT_CDD') {
        const parentContractId = data.parentContractId !== undefined ? data.parentContractId : existing.parentContractId;
        const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
        const err = await validateAvenantCdd(db, {
          employeeId: existing.employeeId, parentContractId, endDate, selfId: id,
        });
        if (err) return { success: false, error: err };
      } else if (effType === 'RENOUVELLEMENT_ESSAI') {
        const parentContractId = data.parentContractId !== undefined ? data.parentContractId : existing.parentContractId;
        const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
        const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
        const err = await validateRenouvellementEssai(db, {
          employeeId: existing.employeeId, parentContractId, startDate, endDate, selfId: id,
        });
        if (err) return { success: false, error: err };
      } else {
        data.parentContractId = null;
        if (effType === 'CDD') {
          const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
          const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
          const err = cddDurationError(startDate, endDate);
          if (err) return { success: false, error: err };
        }
      }
      const contract = await db.employmentContract.update({ where: { id }, data });
      logger.info(`Contrat mis à jour : id=${id}`);
      return ser({ success: true, data: contract });
    } catch (error: any) {
      logger.error('hr:contracts:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contracts:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const db = getDb();
      const existing = await db.employmentContract.findFirst({ where: { id, deletedAt: null }, select: { employeeId: true } });
      if (existing) await assertEmployeeAccessible(session, db, existing.employeeId);
      await db.employmentContract.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Contrat archivé (soft delete) : id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('hr:contracts:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Données de rendu d'un contrat (contrat + employé + entreprise). Le document
  // est ensuite assemblé et exporté côté renderer (zones + modèle éditable),
  // comme pour les conventions.
  ipcMain.handle('hr:contracts:getRenderData', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES_SCOPED);
      const db = getDb();
      const contract = await db.employmentContract.findFirst({
        where: { id, deletedAt: null },
        include: { employee: true, parentContract: true, responsibleAuthority: true, fonction: true, objective: true },
      });
      if (!contract || !contract.employee) return { success: false, error: 'Contrat introuvable' };
      await assertEmployeeAccessible(session, db, contract.employeeId);
      // Numéro de l'avenant : rang de cet avenant parmi les avenants successifs
      // du même CDD parent (ordre de création). Vide pour les autres contrats.
      if (contract.type === 'AVENANT_CDD' && contract.parentContractId) {
        const siblings = await db.employmentContract.findMany({
          where: { deletedAt: null, type: 'AVENANT_CDD', parentContractId: contract.parentContractId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });
        const idx = siblings.findIndex((s) => s.id === contract.id);
        (contract as any).avenantNumber = idx >= 0 ? idx + 1 : siblings.length;
      }
      const company = await loadContractCompany();
      return ser({ success: true, data: { contract, employee: contract.employee, company } });
    } catch (error: any) {
      logger.error('hr:contracts:getRenderData error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Catalogue des lignes de « commissions sur activité » proposées sur un contrat.
  // Le taux par défaut réutilise les taux de commission paramétrés (vente/location/
  // dossier) ; « Constructions et ouvrages » a un taux par défaut fixe de 10 %.
  ipcMain.handle('hr:commissionActivities:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES_SCOPED);
      const rates = await getDefaultRates(getDb());
      const data = [
        { key: 'VENTE', label: 'Vente', defaultRate: rates.saleRate },
        { key: 'LOCATION', label: 'Location', defaultRate: rates.rentalRate },
        { key: 'SOUSCRIPTION', label: 'Souscription', defaultRate: rates.saleRate },
        { key: 'FRAIS_DOSSIER', label: 'Frais de dossier', defaultRate: rates.dossierRate },
        { key: 'FRAIS_DEMARCHES_ACD', label: 'Frais de démarches ACD', defaultRate: rates.dossierRate },
        { key: 'CONSTRUCTIONS_OUVRAGES', label: 'Prestations diverses', defaultRate: 10 },
      ];
      return { success: true, data };
    } catch (error: any) {
      logger.error('hr:commissionActivities:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Paie / bulletins ──────────────────────────────────────── */

  const generateSchema = z.object({
    employeeId: z.coerce.number().int().positive(),
    periodYear: z.coerce.number().int().min(2000).max(2100),
    periodMonth: z.coerce.number().int().min(1).max(12),
    sursalaire: z.coerce.number().nonnegative().optional(),
    taxablePrime: z.coerce.number().nonnegative().optional(),
    transportAllowance: z.coerce.number().nonnegative().optional(),
    commissionsVente: z.coerce.number().nonnegative().optional(),
    // Inclure automatiquement les heures supplémentaires du pointage du mois.
    includeOvertime: z.coerce.boolean().optional(),
  });

  async function nextPayslipReference(db: ReturnType<typeof getDb>): Promise<string> {
    const year = new Date().getFullYear();
    const last = await db.payslip.findFirst({
      where: { reference: { startsWith: `BUL-${year}-` } },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `BUL-${year}-${String(seq).padStart(4, '0')}`;
  }

  interface GeneratePayslipParams {
    employeeId: number;
    periodYear: number;
    periodMonth: number;
    sursalaire?: number;
    taxablePrime?: number;
    transportAllowance?: number;
    commissionsVente?: number;
    includeOvertime?: boolean;
  }

  /**
   * Cœur de la génération d'un bulletin (calcul + création/réutilisation d'un
   * bulletin archivé de la même période) — factorisé pour être réutilisé par
   * `hr:payslips:generate` (saisie manuelle) et `hr:payslips:duplicate`
   * (reprend les entrées ajustables d'un bulletin existant pour une autre
   * période/un autre employé). Un seul bulletin par employé et par période :
   * l'appelant doit avoir vérifié l'absence de bulletin existant non supprimé.
   */
  async function generatePayslipCore(db: ReturnType<typeof getDb>, p: GeneratePayslipParams) {
    const existing = await db.payslip.findFirst({
      where: { employeeId: p.employeeId, periodYear: p.periodYear, periodMonth: p.periodMonth },
    });
    if (existing && !existing.deletedAt) {
      return { success: false as const, error: 'Un bulletin existe déjà pour cet employé sur cette période.' };
    }

    const employee = await db.employee.findFirst({
      where: { id: p.employeeId, deletedAt: null },
      include: { contracts: { where: { deletedAt: null }, orderBy: { startDate: 'desc' }, take: 1 } },
    });
    if (!employee) return { success: false as const, error: 'Employé introuvable' };
    const contract = employee.contracts[0];
    if (!contract) return { success: false as const, error: "Aucun contrat actif : définissez d'abord un contrat avec un salaire de base." };

    const rates = await getPayrollRates(db);
    // Heures supplémentaires : valorisées depuis le pointage du mois (option).
    let overtimeAmount = 0;
    if (p.includeOvertime !== false) {
      const summary = await attendanceMonthSummary(employee.id, p.periodYear, p.periodMonth);
      overtimeAmount = summary.overtimeAmount;
    }
    // Ancienneté figée à la fin de la période de paie (et non à la date du jour).
    const periodEnd = new Date(p.periodYear, p.periodMonth, 0);
    const prime = computePrimeAnciennete(Number(contract.baseSalary), employee.hireDate, periodEnd);
    const result = computePayroll(
      {
        baseSalary: Number(contract.baseSalary),
        igrParts: Number(employee.igrParts ?? 1),
        sursalaire: p.sursalaire,
        primeAnciennete: prime.amount,
        senioriteRate: prime.rate,
        taxablePrime: p.taxablePrime,
        overtimeAmount,
        transportAllowance: p.transportAllowance,
        commissionsVente: p.commissionsVente,
      },
      rates,
    );
    const lineData = result.lines.map((l) => ({
      type: l.type, label: l.label,
      base: l.base != null ? (l.base as any) : null,
      rate: l.rate != null ? (l.rate as any) : null,
      amount: l.amount as any, order: l.order,
    }));
    const amounts = {
      contractId: contract.id,
      // Figé à la génération : un changement ultérieur du nombre de parts
      // IGR de l'employé ne doit jamais modifier un bulletin déjà émis.
      igrParts: employee.igrParts as any,
      baseSalary: result.baseSalary as any,
      grossTaxable: result.grossTaxable as any,
      totalGains: result.totalGains as any,
      cnpsEmployee: result.cnpsEmployee as any,
      its: result.its as any,
      cmuEmployee: result.cmuEmployee as any,
      totalDeductions: result.totalDeductions as any,
      netSalary: result.netSalary as any,
      employerCharges: result.employerCharges as any,
      employerCost: result.employerCost as any,
    };

    let payslip;
    if (existing) {
      // Réutilise le bulletin archivé de la même période : on le réinitialise
      // (statut, paiement) et on régénère ses lignes.
      await db.payslipLine.deleteMany({ where: { payslipId: existing.id } });
      payslip = await db.payslip.update({
        where: { id: existing.id },
        data: {
          ...amounts,
          status: 'BROUILLON', paidAt: null, paymentMethod: null, deletedAt: null,
          lines: { create: lineData },
        },
        include: { lines: true },
      });
      logger.info(`Bulletin régénéré : ${payslip.reference} (employé ${employee.id}, ${p.periodMonth}/${p.periodYear})`);
    } else {
      const reference = await nextPayslipReference(db);
      payslip = await db.payslip.create({
        data: {
          reference,
          employeeId: employee.id,
          periodYear: p.periodYear,
          periodMonth: p.periodMonth,
          ...amounts,
          lines: { create: lineData },
        },
        include: { lines: true },
      });
      logger.info(`Bulletin généré : ${reference} (employé ${employee.id}, ${p.periodMonth}/${p.periodYear})`);
    }
    return { success: true as const, data: payslip };
  }

  ipcMain.handle('hr:payslips:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.employeeId) where.employeeId = Number(filters.employeeId);
      if (filters.status) where.status = filters.status;
      if (filters.periodYear) where.periodYear = Number(filters.periodYear);
      if (filters.periodMonth) where.periodMonth = Number(filters.periodMonth);
      // Rôles restreints : uniquement les bulletins des employés non-CDI.
      const scope = await hrScopeWhere(session, db, 'employeeId');
      if (scope.employeeId) (where.AND ??= []).push({ employeeId: scope.employeeId });
      const [data, total] = await db.$transaction([
        db.payslip.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { reference: 'desc' }],
          include: { employee: { select: { id: true, matricule: true, firstName: true, lastName: true } } },
        }),
        db.payslip.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('hr:payslips:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:payslips:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES);
      const db = getDb();
      const payslip = await db.payslip.findFirst({
        where: { id, deletedAt: null },
        include: {
          employee: true,
          contract: { select: { id: true, reference: true, poste: true, categorie: true, startDate: true } },
          lines: { orderBy: { order: 'asc' } },
          operations: {
            where: { deletedAt: null },
            select: { id: true, reference: true, bankAccountId: true, amount: true, bankAccount: { select: { name: true } } },
            take: 1,
          },
        },
      });
      if (!payslip) return { success: false, error: 'Bulletin introuvable' };
      await assertEmployeeAccessible(session, db, payslip.employeeId);
      return ser({ success: true, data: payslip });
    } catch (error: any) {
      logger.error('hr:payslips:getById error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:payslips:generate', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const parsed = generateSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const d = parsed.data;
      const db = getDb();
      await assertEmployeeAccessible(session, db, d.employeeId);
      const result = await generatePayslipCore(db, d);
      return ser(result);
    } catch (error: any) {
      logger.error('hr:payslips:generate error', error.message);
      return { success: false, error: error.message };
    }
  });

  const duplicateSchema = z.object({
    sourceId: z.coerce.number().int().positive(),
    employeeId: z.coerce.number().int().positive(),
    periodYear: z.coerce.number().int().min(2000).max(2100),
    periodMonth: z.coerce.number().int().min(1).max(12),
  });

  /**
   * Duplique un bulletin existant vers un autre employé et/ou une autre
   * période : reprend ses entrées ajustables (sursalaire, prime imposable,
   * indemnité transport, heures supplémentaires incluses ou non) et les
   * recalcule intégralement (CNPS/ITS/CMU/charges) pour la cible, à partir du
   * contrat et des taux en vigueur — jamais une simple copie des montants
   * source, qui seraient faux pour un autre employé/une autre période. Bloqué
   * si un bulletin existe déjà pour l'employé/la période cible (même règle
   * que `hr:payslips:generate`, réutilisée par `generatePayslipCore`).
   */
  ipcMain.handle('hr:payslips:duplicate', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const parsed = duplicateSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const d = parsed.data;
      const db = getDb();
      const source = await db.payslip.findFirst({
        where: { id: d.sourceId, deletedAt: null },
        include: { lines: true },
      });
      if (!source) return { success: false, error: 'Bulletin source introuvable' };
      await assertEmployeeAccessible(session, db, source.employeeId);
      await assertEmployeeAccessible(session, db, d.employeeId);

      const lineAmount = (label: string) => Number(source.lines.find((l) => l.label === label)?.amount ?? 0);
      const result = await generatePayslipCore(db, {
        employeeId: d.employeeId,
        periodYear: d.periodYear,
        periodMonth: d.periodMonth,
        sursalaire: lineAmount('Sursalaire'),
        taxablePrime: lineAmount('Primes imposables'),
        transportAllowance: lineAmount('Indemnité de transport (non imposable)') + lineAmount('Indemnité de transport (part imposable)'),
        commissionsVente: lineAmount('Commissions sur vente'),
        includeOvertime: lineAmount('Heures supplémentaires') > 0,
      });
      if (result.success) {
        logger.info(`Bulletin dupliqué depuis ${source.reference} → ${(result.data as any).reference}`);
      }
      return ser(result);
    } catch (error: any) {
      logger.error('hr:payslips:duplicate error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Modification d'un bulletin encore en BROUILLON : on recalcule à partir des
  // entrées ajustables (primes, indemnité transport, heures supplémentaires).
  // L'employé, la période et la référence ne changent pas.
  const payslipEditSchema = z.object({
    sursalaire: z.coerce.number().nonnegative().optional(),
    taxablePrime: z.coerce.number().nonnegative().optional(),
    transportAllowance: z.coerce.number().nonnegative().optional(),
    commissionsVente: z.coerce.number().nonnegative().optional(),
    includeOvertime: z.coerce.boolean().optional(),
  });

  ipcMain.handle('hr:payslips:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const parsed = payslipEditSchema.safeParse(payload);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      }
      const d = parsed.data;
      const db = getDb();
      const payslip = await db.payslip.findFirst({ where: { id, deletedAt: null } });
      if (!payslip) return { success: false, error: 'Bulletin introuvable' };
      await assertEmployeeAccessible(session, db, payslip.employeeId);
      if (payslip.status !== 'BROUILLON') {
        return { success: false, error: 'Seul un bulletin en brouillon peut être modifié.' };
      }

      const employee = await db.employee.findFirst({
        where: { id: payslip.employeeId, deletedAt: null },
        include: { contracts: { where: { deletedAt: null }, orderBy: { startDate: 'desc' }, take: 1 } },
      });
      if (!employee) return { success: false, error: 'Employé introuvable' };
      const contract = employee.contracts[0];
      if (!contract) return { success: false, error: "Aucun contrat actif pour recalculer le bulletin." };

      const rates = await getPayrollRates(db);
      let overtimeAmount = 0;
      if (d.includeOvertime !== false) {
        const summary = await attendanceMonthSummary(employee.id, payslip.periodYear, payslip.periodMonth);
        overtimeAmount = summary.overtimeAmount;
      }
      // Ancienneté figée à la fin de la période de paie (et non à la date du jour).
      const periodEnd = new Date(payslip.periodYear, payslip.periodMonth, 0);
      const prime = computePrimeAnciennete(Number(contract.baseSalary), employee.hireDate, periodEnd);
      const result = computePayroll(
        {
          baseSalary: Number(contract.baseSalary),
          // Nombre de parts IGR figé à la génération du bulletin — un recalcul
          // (brouillon modifié) ne doit pas reprendre la valeur courante,
          // potentiellement différente, du profil de l'employé.
          igrParts: Number(payslip.igrParts ?? 1),
          sursalaire: d.sursalaire,
          primeAnciennete: prime.amount,
          senioriteRate: prime.rate,
          taxablePrime: d.taxablePrime,
          overtimeAmount,
          transportAllowance: d.transportAllowance,
          commissionsVente: d.commissionsVente,
        },
        rates,
      );

      await db.payslipLine.deleteMany({ where: { payslipId: id } });
      const updated = await db.payslip.update({
        where: { id },
        data: {
          contractId: contract.id,
          baseSalary: result.baseSalary as any,
          grossTaxable: result.grossTaxable as any,
          totalGains: result.totalGains as any,
          cnpsEmployee: result.cnpsEmployee as any,
          its: result.its as any,
          cmuEmployee: result.cmuEmployee as any,
          totalDeductions: result.totalDeductions as any,
          netSalary: result.netSalary as any,
          employerCharges: result.employerCharges as any,
          employerCost: result.employerCost as any,
          lines: {
            create: result.lines.map((l) => ({
              type: l.type, label: l.label,
              base: l.base != null ? (l.base as any) : null,
              rate: l.rate != null ? (l.rate as any) : null,
              amount: l.amount as any, order: l.order,
            })),
          },
        },
        include: { lines: true },
      });
      logger.info(`Bulletin modifié : ${updated.reference}`);
      return ser({ success: true, data: updated });
    } catch (error: any) {
      logger.error('hr:payslips:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Convertit une date 'AAAA-MM-JJ' (input date) en Date à midi local pour éviter
  // tout décalage de fuseau ; accepte aussi une date/ISO complète.
  const parsePayDate = (v: any): Date =>
    /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(`${v}T12:00:00`) : new Date(v);
  const PAYMENT_METHODS = ['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY'];

  /**
   * Charge et valide le compte de trésorerie à débiter pour un salaire.
   * Le règlement d'un salaire ne peut se faire que depuis un compte commun
   * (non rattaché à un utilisateur) et actif.
   */
  async function loadSalaryAccount(db: any, bankAccountId: number) {
    const account = await db.bankAccount.findFirst({ where: { id: bankAccountId, deletedAt: null } });
    if (!account) return { error: 'Compte à débiter introuvable' as string };
    if (account.linkedUserId != null) {
      return { error: 'Le salaire doit être réglé depuis un compte commun (non rattaché à un utilisateur).' };
    }
    if (!account.isActive) return { error: 'Ce compte de trésorerie est inactif.' };
    return { account };
  }

  /** Objet d'opération « Salaires » (SORTIE) : réutilisé ou créé à la volée. */
  async function resolveSalaryCategoryId(db: any): Promise<number> {
    const existing = await db.treasuryCategory.findFirst({
      where: { deletedAt: null, direction: 'SORTIE', label: { contains: 'Salaire' } },
      orderBy: { id: 'asc' },
    });
    if (existing) return existing.id;
    const created = await db.treasuryCategory.create({ data: { label: 'Salaires', direction: 'SORTIE' } });
    return created.id;
  }

  /**
   * Synchronise le décaissement de trésorerie associé à un bulletin payé.
   * Crée l'opération (SORTIE, source PAIE) si un compte est fourni et qu'aucune
   * n'existe ; sinon met à jour l'opération existante (montant, date, mode,
   * compte si fourni). Sans compte fourni ni opération existante, ne fait rien.
   */
  async function syncPayslipOperation(
    db: any,
    payslip: any,
    opts: { bankAccountId?: number; paidAt: Date; paymentMethod?: string | null; userId?: number | null },
  ): Promise<void> {
    const existing = await db.treasuryOperation.findFirst({ where: { payslipId: payslip.id, deletedAt: null } });
    if (!existing && opts.bankAccountId == null) return;

    const emp = payslip.employee;
    const empName = emp ? `${emp.lastName ?? ''} ${emp.firstName ?? ''}`.trim() : '';
    const label = `Salaire ${payslip.reference}${empName ? ` — ${empName}` : ''}`;
    const categoryId = await resolveSalaryCategoryId(db);
    const amount = Number(payslip.netSalary);

    if (existing) {
      await db.treasuryOperation.update({
        where: { id: existing.id },
        data: {
          ...(opts.bankAccountId != null ? { bankAccountId: opts.bankAccountId } : {}),
          amount: amount as any,
          operationDate: opts.paidAt,
          ...(opts.paymentMethod ? { paymentMethod: opts.paymentMethod as any } : {}),
          label,
          categoryId,
        },
      });
    } else if (opts.bankAccountId != null) {
      await recordTreasuryOperation(db, {
        bankAccountId: opts.bankAccountId,
        direction: 'SORTIE',
        amount,
        label,
        operationDate: opts.paidAt,
        categoryId,
        paymentMethod: opts.paymentMethod ?? undefined,
        source: 'PAIE',
        payslipId: payslip.id,
        createdById: opts.userId ?? null,
      });
    }
  }

  /** Annule (soft delete) le décaissement de trésorerie associé à un bulletin. */
  async function cancelPayslipOperation(db: any, payslipId: number): Promise<void> {
    await db.treasuryOperation.updateMany({
      where: { payslipId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Liste les comptes de trésorerie débitables pour un salaire (communs, actifs),
   * avec leur solde courant, pour alimenter le sélecteur de paiement RH.
   */
  ipcMain.handle('hr:payslips:payAccounts', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES);
      const db = getDb();
      const accounts = await db.bankAccount.findMany({
        where: { deletedAt: null, isActive: true, linkedUserId: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, type: true, currency: true },
      });
      const balances = await computeBalances(db, accounts.map((a) => a.id));
      const data = accounts.map((a) => ({ ...a, balance: balances.get(a.id)?.balance ?? 0 }));
      // Compte par défaut défini dans les Paramètres (validé contre la liste disponible)
      const raw = await getSetting(SettingsKeys.payrollDefaultAccountId);
      const defaultId = raw ? Number(raw) : null;
      const defaultAccountId = defaultId != null && accounts.some((a) => a.id === defaultId) ? defaultId : null;
      return ser({ success: true, data, defaultAccountId });
    } catch (error: any) {
      logger.error('hr:payslips:payAccounts error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:payslips:updateStatus', async (_event, { token, id, status, paymentMethod, paidAt, bankAccountId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      if (!['BROUILLON', 'VALIDE', 'PAYE', 'ANNULE'].includes(status)) {
        return { success: false, error: 'Statut invalide' };
      }
      if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
        return { success: false, error: 'Mode de paiement invalide' };
      }
      const db = getDb();
      const current = await db.payslip.findFirst({
        where: { id, deletedAt: null },
        include: { employee: { select: { firstName: true, lastName: true } } },
      });
      if (!current) return { success: false, error: 'Bulletin introuvable' };
      await assertEmployeeAccessible(session, db, current.employeeId);

      const data: any = { status };
      if (status === 'PAYE') {
        const when = paidAt ? parsePayDate(paidAt) : new Date();
        data.paidAt = when;
        if (paymentMethod) data.paymentMethod = paymentMethod;
        // Décaissement en comptabilité si un compte à débiter est fourni
        if (bankAccountId != null) {
          const res = await loadSalaryAccount(db, bankAccountId);
          if (res.error) return { success: false, error: res.error };
          await syncPayslipOperation(db, current, {
            bankAccountId,
            paidAt: when,
            paymentMethod: paymentMethod ?? current.paymentMethod,
            userId: session.userId,
          });
        }
      } else {
        // Sortie du statut « payé » → annuler le décaissement éventuel
        await cancelPayslipOperation(db, id);
      }
      const payslip = await db.payslip.update({ where: { id }, data });
      logger.info(`Bulletin ${id} → statut ${status}`);
      return ser({ success: true, data: payslip });
    } catch (error: any) {
      logger.error('hr:payslips:updateStatus error', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Modifier la date, le mode et/ou le compte de paiement d'un bulletin payé. */
  ipcMain.handle('hr:payslips:updatePayment', async (_event, { token, id, paidAt, paymentMethod, bankAccountId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
        return { success: false, error: 'Mode de paiement invalide' };
      }
      const db = getDb();
      const payslip = await db.payslip.findFirst({
        where: { id, deletedAt: null },
        include: { employee: { select: { firstName: true, lastName: true } } },
      });
      if (!payslip) return { success: false, error: 'Bulletin introuvable' };
      await assertEmployeeAccessible(session, db, payslip.employeeId);
      if (payslip.status !== 'PAYE') {
        return { success: false, error: "Seul un bulletin payé peut voir ses informations de paiement modifiées." };
      }
      if (bankAccountId != null) {
        const res = await loadSalaryAccount(db, bankAccountId);
        if (res.error) return { success: false, error: res.error };
      }
      const data: any = {};
      if (paidAt) data.paidAt = parsePayDate(paidAt);
      if (paymentMethod) data.paymentMethod = paymentMethod;
      if (Object.keys(data).length === 0 && bankAccountId == null) {
        return { success: false, error: 'Aucune modification fournie' };
      }
      const updated = await db.payslip.update({ where: { id }, data });
      // Répercuter sur le décaissement de trésorerie associé
      await syncPayslipOperation(db, { ...payslip, ...updated, employee: payslip.employee }, {
        bankAccountId: bankAccountId ?? undefined,
        paidAt: updated.paidAt ?? new Date(),
        paymentMethod: updated.paymentMethod,
        userId: session.userId,
      });
      logger.info(`Bulletin ${updated.reference} : informations de paiement modifiées`);
      return ser({ success: true, data: updated });
    } catch (error: any) {
      logger.error('hr:payslips:updatePayment error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:payslips:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const db = getDb();
      const current = await db.payslip.findFirst({ where: { id, deletedAt: null }, select: { employeeId: true } });
      if (current) await assertEmployeeAccessible(session, db, current.employeeId);
      await db.payslip.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Bulletin archivé (soft delete) : id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('hr:payslips:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:payslips:print', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_READ_ROLES);
      const db = getDb();
      const payslip = await db.payslip.findFirst({
        where: { id, deletedAt: null },
        include: { employee: true, contract: { select: { poste: true, categorie: true, startDate: true, type: true } }, lines: { orderBy: { order: 'asc' } } },
      });
      if (!payslip || !payslip.employee) return { success: false, error: 'Bulletin introuvable' };
      await assertEmployeeAccessible(session, db, payslip.employeeId);
      const company = await loadPayslipCompany();
      const template = await resolvePayslipTemplate();
      const logo = await loadPayslipLogo();
      const counters = await computePayslipLeaveCounters(payslip.employeeId, payslip.periodYear, payslip.periodMonth, payslip.contract?.type === 'ESSAI' || payslip.contract?.type === 'RENOUVELLEMENT_ESSAI');
      const totals = await computePayslipTotals(payslip);
      const html = renderPayslipHtml(payslip, payslip.employee, company, template ?? undefined, logo, counters, totals);
      const pdf = await htmlToPdf(html, { landscape: false });
      await openPrintPreview(pdf, `Bulletin ${payslip.reference}`);
      logger.info(`Aperçu impression bulletin : ${payslip.reference}`);
      return { success: true, data: { previewing: true } };
    } catch (error: any) {
      logger.error('hr:payslips:print error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Paramètres de paie (taux) ─────────────────────────────── */

  ipcMain.handle('hr:payroll:getRates', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const rates = await getPayrollRates(getDb());
      return { success: true, data: rates };
    } catch (error: any) {
      logger.error('hr:payroll:getRates error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:payroll:setRates', async (_event, { token, rates }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_WRITE_ROLES);
      await setPayrollRates(rates as PayrollRates, getDb());
      logger.info('Taux de paie mis à jour');
      return { success: true };
    } catch (error: any) {
      logger.error('hr:payroll:setRates error', error.message);
      return { success: false, error: error.message };
    }
  });

  const payrollPreviewSchema = z.object({
    baseSalary: z.number().min(0),
    sursalaire: z.number().min(0).optional(),
    primeAnciennete: z.number().min(0).optional(),
    transportAllowance: z.number().min(0).optional(),
  });

  /**
   * Aperçu de calcul de paie (ITS, CNPS salarié, CMU salarié, brut, total des
   * retenues, net à payer) à partir des composantes de rémunération d'un
   * contrat — réutilise tel quel `computePayroll()`, le même cœur de calcul
   * que la génération d'un bulletin (`hr:payslips:generate`), pour garantir
   * des résultats strictement identiques. Aucune écriture (pas de bulletin
   * créé), lecture seule des taux courants.
   */
  ipcMain.handle('hr:payroll:preview', async (_event, { token, ...payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES_SCOPED);
      const parsed = payrollPreviewSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const rates = await getPayrollRates(getDb());
      const result = computePayroll(parsed.data, rates);
      return {
        success: true,
        data: {
          its: result.its, cnpsEmployee: result.cnpsEmployee, cmuEmployee: result.cmuEmployee,
          grossSalary: result.grossTaxable, totalDeductions: result.totalDeductions, netSalary: result.netSalary,
        },
      };
    } catch (error: any) {
      logger.error('hr:payroll:preview error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Modèles de contrats de travail ────────────────────────── */

  const bgColor = z.preprocess(
    (v) => (v === '' || v === null ? null : v),
    z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/, 'Couleur invalide').nullable().optional(),
  );
  const contractTplSchema = z.object({
    name: z.string().min(1, 'Nom requis'),
    type: z.enum(CONTRACT_TYPE),
    // En-tête monobloc (texte/image) — image insérée → 100 % de la largeur.
    header:       z.string().optional(),
    headerWidth:  z.number().int().min(20).max(100).default(100),
    headerHeight: z.number().int().min(40).max(800).default(140),
    // Corps possiblement vide si tout est en zones.
    body: z.string().default(''),
    footer:       z.string().optional(),
    footerWidth:  z.number().int().min(20).max(100).default(100),
    footerHeight: z.number().int().min(40).max(800).default(140),
    footerBgColor: bgColor,
    endOfDocument:       z.string().optional(),
    endOfDocumentWidth:  z.number().int().min(20).max(100).default(100),
    endOfDocumentHeight: z.number().int().min(40).max(800).default(140),
    endOfDocumentBgColor: bgColor,
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('hr:contractTemplates:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // Lecture ouverte à tout utilisateur authentifié : les modèles ne sont
      // que des mises en page (utilisées aussi par l'espace self-service pour
      // afficher son propre contrat). Aucune donnée personnelle.
      const data = await getDb().contractTemplate.findMany({
        where: { deletedAt: null },
        orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { id: 'asc' }],
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:contractTemplates:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contractTemplates:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, CONTRACT_TEMPLATE_CONFIG_ROLES);
      const parsed = contractTplSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const db = getDb();
      if (parsed.data.isDefault) {
        await db.contractTemplate.updateMany({ where: { type: parsed.data.type as any }, data: { isDefault: false } });
      }
      const data = await db.contractTemplate.create({ data: parsed.data as any });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:contractTemplates:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contractTemplates:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, CONTRACT_TEMPLATE_CONFIG_ROLES);
      const parsed = contractTplSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const db = getDb();
      const current = await db.contractTemplate.findUnique({ where: { id }, select: { type: true } });
      if (parsed.data.isDefault && current) {
        await db.contractTemplate.updateMany({ where: { type: current.type, id: { not: id } }, data: { isDefault: false } });
      }
      const data = await db.contractTemplate.update({ where: { id }, data: parsed.data as any });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:contractTemplates:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contractTemplates:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, CONTRACT_TEMPLATE_CONFIG_ROLES);
      await getDb().contractTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:contractTemplates:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Catégories socio-professionnelles & délais d'essai ─────── */

  const essaiCategorySchema = z.object({
    label: z.string().min(1, 'Libellé requis'),
    durationValue: z.coerce.number().int().positive('Durée invalide'),
    durationUnit: z.enum(['JOURS', 'MOIS']).default('MOIS'),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('hr:essaiCategories:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().essaiCategory.findMany({ where, orderBy: { label: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:essaiCategories:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:essaiCategories:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_WRITE_ROLES);
      const parsed = essaiCategorySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const data = await getDb().essaiCategory.create({ data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, error: 'Cette catégorie existe déjà' };
      logger.error('hr:essaiCategories:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:essaiCategories:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_WRITE_ROLES);
      const parsed = essaiCategorySchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const data = await getDb().essaiCategory.update({ where: { id }, data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, error: 'Cette catégorie existe déjà' };
      logger.error('hr:essaiCategories:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:essaiCategories:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_WRITE_ROLES);
      await getDb().essaiCategory.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:essaiCategories:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Fonctions de l'employé (référentiel) ──────────────────── */

  const contractFunctionSchema = z.object({
    titre: z.string().min(1, 'Titre requis'),
    contenu: z.string().optional().default(''),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('hr:contractFunctions:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().contractFunction.findMany({ where, orderBy: { titre: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:contractFunctions:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contractFunctions:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, CONTRACT_TEMPLATE_CONFIG_ROLES);
      const parsed = contractFunctionSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const data = await getDb().contractFunction.create({ data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:contractFunctions:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contractFunctions:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, CONTRACT_TEMPLATE_CONFIG_ROLES);
      const parsed = contractFunctionSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const data = await getDb().contractFunction.update({ where: { id }, data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:contractFunctions:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contractFunctions:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, CONTRACT_TEMPLATE_CONFIG_ROLES);
      await getDb().contractFunction.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:contractFunctions:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Postes / Fonctions (référentiel du champ « Poste ») ──────────────── */

  // Liste des postes utilisée par le sélecteur « Poste » de la fiche employé.
  // Lecture : rôles ayant accès au module RH. Écriture : rôles habilités à créer
  // un employé (admins / RH / MANAGER) — création à la volée depuis le formulaire.
  const jobPositionSchema = z.object({
    label: z.string().min(1, 'Libellé requis'),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('hr:jobPositions:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().jobPosition.findMany({ where, orderBy: { label: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:jobPositions:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:jobPositions:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const parsed = jobPositionSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const label = parsed.data.label.trim();
      // Réactive un poste homonyme précédemment supprimé plutôt que d'échouer sur l'unicité.
      const existing = await getDb().jobPosition.findUnique({ where: { label } });
      if (existing) {
        const data = await getDb().jobPosition.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
        return ser({ success: true, data });
      }
      const data = await getDb().jobPosition.create({ data: { label, isActive: parsed.data.isActive ?? true } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:jobPositions:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:jobPositions:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const parsed = jobPositionSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const data: any = { ...parsed.data };
      if (typeof data.label === 'string') data.label = data.label.trim();
      const updated = await getDb().jobPosition.update({ where: { id }, data });
      return ser({ success: true, data: updated });
    } catch (error: any) {
      logger.error('hr:jobPositions:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:jobPositions:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      await getDb().jobPosition.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:jobPositions:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Départements / Services (référentiel du champ « Département ») ────── */

  const departmentSchema = z.object({
    label: z.string().min(1, 'Libellé requis'),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('hr:departments:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().department.findMany({ where, orderBy: { label: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:departments:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:departments:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const parsed = departmentSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const label = parsed.data.label.trim();
      const existing = await getDb().department.findUnique({ where: { label } });
      if (existing) {
        const data = await getDb().department.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
        return ser({ success: true, data });
      }
      const data = await getDb().department.create({ data: { label, isActive: parsed.data.isActive ?? true } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:departments:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:departments:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      const parsed = departmentSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const data: any = { ...parsed.data };
      if (typeof data.label === 'string') data.label = data.label.trim();
      const updated = await getDb().department.update({ where: { id }, data });
      return ser({ success: true, data: updated });
    } catch (error: any) {
      logger.error('hr:departments:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:departments:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_STAFF_WRITE_ROLES);
      await getDb().department.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:departments:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Objectifs assignés (référentiel — même principe que les fonctions) ── */

  // Écriture des objectifs assignés : admins/RH + MANAGER (contrairement aux
  // autres configurations RH, réservées aux admins/RH). Test de rôle exact.
  const OBJECTIVE_WRITE_ROLES = [...HR_WRITE_ROLES, 'MANAGER'];

  const contractObjectiveSchema = z.object({
    titre: z.string().min(1, 'Titre requis'),
    contenu: z.string().optional().default(''),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('hr:contractObjectives:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().contractObjective.findMany({ where, orderBy: { titre: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:contractObjectives:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contractObjectives:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, OBJECTIVE_WRITE_ROLES);
      const parsed = contractObjectiveSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const data = await getDb().contractObjective.create({ data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:contractObjectives:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contractObjectives:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, OBJECTIVE_WRITE_ROLES);
      const parsed = contractObjectiveSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const data = await getDb().contractObjective.update({ where: { id }, data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:contractObjectives:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:contractObjectives:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, OBJECTIVE_WRITE_ROLES);
      await getDb().contractObjective.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:contractObjectives:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Modèles de fiche de poste ─────────────────────────────── */

  const jobDescTplSchema = z.object({
    name: z.string().min(1, 'Nom requis'),
    header:       z.string().optional(),
    headerWidth:  z.number().int().min(20).max(100).default(100),
    headerHeight: z.number().int().min(40).max(800).default(140),
    body: z.string().default(''),
    footer:       z.string().optional(),
    footerWidth:  z.number().int().min(20).max(100).default(100),
    footerHeight: z.number().int().min(40).max(800).default(140),
    footerBgColor: bgColor,
    endOfDocument:       z.string().optional(),
    endOfDocumentWidth:  z.number().int().min(20).max(100).default(100),
    endOfDocumentHeight: z.number().int().min(40).max(800).default(140),
    endOfDocumentBgColor: bgColor,
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('hr:jobDescriptionTemplates:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      // Lecture ouverte à tout utilisateur authentifié (mise en page uniquement ;
      // réutilisée par l'espace self-service pour la fiche de poste personnelle).
      const data = await getDb().jobDescriptionTemplate.findMany({
        where: { deletedAt: null },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:jobDescriptionTemplates:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:jobDescriptionTemplates:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, CONTRACT_TEMPLATE_CONFIG_ROLES);
      const parsed = jobDescTplSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const db = getDb();
      if (parsed.data.isDefault) await db.jobDescriptionTemplate.updateMany({ where: { deletedAt: null }, data: { isDefault: false } });
      const data = await db.jobDescriptionTemplate.create({ data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:jobDescriptionTemplates:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:jobDescriptionTemplates:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, CONTRACT_TEMPLATE_CONFIG_ROLES);
      const parsed = jobDescTplSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const db = getDb();
      if (parsed.data.isDefault) await db.jobDescriptionTemplate.updateMany({ where: { deletedAt: null, id: { not: id } }, data: { isDefault: false } });
      const data = await db.jobDescriptionTemplate.update({ where: { id }, data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:jobDescriptionTemplates:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:jobDescriptionTemplates:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, CONTRACT_TEMPLATE_CONFIG_ROLES);
      await getDb().jobDescriptionTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:jobDescriptionTemplates:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Modèles de bulletins de paie ──────────────────────────── */

  const payslipTplSchema = z.object({
    name: z.string().min(1).optional(),
    layout: z.enum(['MODELE_1', 'MODELE_2', 'MODELE_3']).optional(),
    headerHtml: z.string().nullable().optional(),
    footerHtml: z.string().nullable().optional(),
    accentColor: z.string().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('hr:payslipTemplates:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const data = await getDb().payslipTemplate.findMany({ orderBy: { id: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:payslipTemplates:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:payslipTemplates:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_WRITE_ROLES);
      const parsed = payslipTplSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const db = getDb();
      if (parsed.data.isDefault) {
        await db.payslipTemplate.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      }
      const data = await db.payslipTemplate.update({ where: { id }, data: parsed.data as any });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:payslipTemplates:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Congés & absences ─────────────────────────────────────── */

  const leaveRequestSchema = z.object({
    employeeId: z.coerce.number().int().positive('Employé requis'),
    typeId: z.coerce.number().int().positive('Type de congé requis'),
    startDate: z.coerce.date({ message: 'Date de début requise' }),
    endDate: z.coerce.date({ message: 'Date de fin requise' }),
    days: z.coerce.number().positive().optional(),
    reason: z.string().optional().nullable(),
  });

  async function nextLeaveReference(db: ReturnType<typeof getDb>): Promise<string> {
    const year = new Date().getFullYear();
    const last = await db.leaveRequest.findFirst({
      where: { reference: { startsWith: `CGE-${year}-` } },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `CGE-${year}-${String(seq).padStart(4, '0')}`;
  }

  ipcMain.handle('hr:leaveTypes:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const data = await getDb().leaveType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:leaveTypes:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:leave:balance', async (_event, { token, employeeId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const balance = await computeLeaveBalance(Number(employeeId));
      return { success: true, data: balance };
    } catch (error: any) {
      logger.error('hr:leave:balance error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:leaveRequests:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.employeeId) where.employeeId = Number(filters.employeeId);
      if (filters.status) where.status = filters.status;
      if (filters.typeId) where.typeId = Number(filters.typeId);
      // Congés : accès à tous les employés pour les rôles habilités (y compris
      // AD & MANAGER) — pas de restriction de périmètre sur ce module.
      const [data, total] = await db.$transaction([
        db.leaveRequest.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { startDate: 'desc' },
          include: {
            employee: { select: { id: true, matricule: true, firstName: true, lastName: true } },
            type: { select: { id: true, name: true, color: true, isPaid: true } },
          },
        }),
        db.leaveRequest.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('hr:leaveRequests:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:leaveRequests:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_OPERATIONAL_ROLES);
      const parsed = leaveRequestSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const d = parsed.data;
      if (d.endDate < d.startDate) return { success: false, error: 'La date de fin doit être postérieure à la date de début.' };
      const db = getDb();
      const days = d.days != null && d.days > 0 ? d.days : workingDays(d.startDate, d.endDate);
      if (!(days > 0)) return { success: false, error: 'Le nombre de jours doit être supérieur à 0.' };
      const reference = await nextLeaveReference(db);
      const data = await db.leaveRequest.create({
        data: {
          reference, employeeId: d.employeeId, typeId: d.typeId,
          startDate: d.startDate, endDate: d.endDate, days: days as any,
          reason: d.reason ?? null,
        },
      });
      logger.info(`Demande de congé créée : ${reference}`);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:leaveRequests:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:leaveRequests:decide', async (_event, { token, id, status, note }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_OPERATIONAL_ROLES);
      if (!['APPROUVE', 'REFUSE', 'ANNULE', 'EN_ATTENTE'].includes(status)) {
        return { success: false, error: 'Statut invalide' };
      }
      const db = getDb();
      const decided = status === 'APPROUVE' || status === 'REFUSE';
      const data = await db.leaveRequest.update({
        where: { id },
        data: {
          status,
          decisionNote: note ?? null,
          decidedById: decided ? session.userId : null,
          decidedAt: decided ? new Date() : null,
        },
      });
      logger.info(`Demande de congé ${id} → ${status}`);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:leaveRequests:decide error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:leaveRequests:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_OPERATIONAL_ROLES);
      const db = getDb();
      await db.leaveRequest.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:leaveRequests:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Fiche imprimable « Congés & Absence » (détails + signatures).
  ipcMain.handle('hr:leaveRequests:print', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const db = getDb();
      const request = await db.leaveRequest.findFirst({
        where: { id, deletedAt: null },
        include: {
          employee: { select: { id: true, matricule: true, firstName: true, lastName: true, poste: true, city: true } },
          type: { select: { name: true } },
        },
      });
      if (!request || !request.employee) return { success: false, error: 'Demande introuvable' };
      const company = await loadContractCompany();
      const logo = await loadPayslipLogo();
      const slogan = (await getSetting(SettingsKeys.companySlogan)) ?? '';
      const html = renderLeaveRequestHtml(request, request.employee, company, logo, slogan);
      const pdf = await htmlToPdf(html, { landscape: false });
      await openPrintPreview(pdf, `Congé ${request.reference}`);
      logger.info(`Aperçu impression congé : ${request.reference}`);
      return { success: true, data: { previewing: true } };
    } catch (error: any) {
      logger.error('hr:leaveRequests:print error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Fiche « Congés & Absence » signée (scannée) jointe après validation ──────
  const LEAVE_SIGNED_MAX = 40 * 1024 * 1024;
  const leaveSignedSchema = z.object({
    id: z.coerce.number().int().positive(),
    name: z.string().min(1),
    type: z.string().min(1),
    size: z.number().int().positive(),
    dataBase64: z.string().min(1),
  });

  ipcMain.handle('hr:leaveRequests:uploadSigned', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_OPERATIONAL_ROLES);
      const parsed = leaveSignedSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const d = parsed.data;
      if (d.size > LEAVE_SIGNED_MAX) return { success: false, error: `Fichier trop volumineux (max ${Math.round(LEAVE_SIGNED_MAX / 1024 / 1024)} Mo).` };
      const db = getDb();
      const req = await db.leaveRequest.findFirst({ where: { id: d.id, deletedAt: null } });
      if (!req) return { success: false, error: 'Demande introuvable' };
      if (req.status !== 'APPROUVE') {
        return { success: false, error: 'La fiche signée ne peut être jointe qu\'après validation de la demande.' };
      }
      const buf = Buffer.from(d.dataBase64, 'base64');
      if (buf.length === 0) return { success: false, error: 'Fichier vide ou invalide' };
      if (req.signedDocPath) removeStorageFile(req.signedDocPath); // remplace l'éventuelle pièce jointe
      const { relativePath, size } = writeLeaveSignedDocument(d.id, buf, d.name);
      const data = await db.leaveRequest.update({
        where: { id: d.id },
        data: { signedDocPath: relativePath, signedDocName: d.name, signedDocType: d.type, signedDocSize: size, signedDocAt: new Date() },
        select: { id: true, signedDocName: true, signedDocType: true, signedDocSize: true, signedDocAt: true },
      });
      logger.info(`Fiche de congé signée jointe : demande ${d.id}`);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:leaveRequests:uploadSigned error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:leaveRequests:openSigned', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const db = getDb();
      const req = await db.leaveRequest.findFirst({ where: { id, deletedAt: null }, select: { employeeId: true, signedDocPath: true } });
      if (!req || !req.signedDocPath) return { success: false, error: 'Aucune fiche signée jointe.' };
      const abs = resolveStoragePath(req.signedDocPath);
      if (!fs.existsSync(abs)) return { success: false, error: 'Fichier introuvable sur le disque' };
      const err = await shell.openPath(abs);
      if (err) return { success: false, error: err };
      return { success: true };
    } catch (error: any) {
      logger.error('hr:leaveRequests:openSigned error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:leaveRequests:removeSigned', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_OPERATIONAL_ROLES);
      const db = getDb();
      const req = await db.leaveRequest.findFirst({ where: { id, deletedAt: null }, select: { employeeId: true, signedDocPath: true } });
      if (!req) return { success: false, error: 'Demande introuvable' };
      if (req.signedDocPath) removeStorageFile(req.signedDocPath);
      await db.leaveRequest.update({
        where: { id },
        data: { signedDocPath: null, signedDocName: null, signedDocType: null, signedDocSize: null, signedDocAt: null },
      });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:leaveRequests:removeSigned error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Pointage / heures ─────────────────────────────────────── */

  const attendanceRowSchema = z.object({
    employeeId: z.coerce.number().int().positive(),
    date: z.string().min(1), // 'YYYY-MM-DD'
    status: z.enum(['PRESENT', 'ABSENT', 'CONGE', 'REPOS', 'FERIE', 'MALADIE']),
    hoursWorked: z.coerce.number().nonnegative().optional(),
    overtimeHours: z.coerce.number().nonnegative().optional(),
    notes: z.string().optional().nullable(),
  });

  ipcMain.handle('hr:attendance:list', async (_event, { token, employeeId, year, month }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, ATTENDANCE_READ_ROLES);
      const db = getDb();
      await assertEmployeeAccessibleAL(session, db, Number(employeeId));
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 1);
      const data = await db.attendanceRecord.findMany({
        where: { employeeId: Number(employeeId), date: { gte: start, lt: end } },
        orderBy: { date: 'asc' },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:attendance:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:attendance:summary', async (_event, { token, employeeId, year, month }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, ATTENDANCE_READ_ROLES);
      await assertEmployeeAccessibleAL(session, getDb(), Number(employeeId));
      const data = await attendanceMonthSummary(Number(employeeId), Number(year), Number(month));
      return { success: true, data };
    } catch (error: any) {
      logger.error('hr:attendance:summary error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:attendance:bulkUpsert', async (_event, { token, records }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, ATTENDANCE_WRITE_ROLES);
      if (!Array.isArray(records)) return { success: false, error: 'Données invalides' };
      const db = getDb();
      let saved = 0;
      for (const raw of records) {
        const parsed = attendanceRowSchema.safeParse(raw);
        if (!parsed.success) continue;
        const r = parsed.data;
        const date = new Date(`${r.date}T00:00:00.000Z`);
        const payload = {
          status: r.status,
          hoursWorked: (r.hoursWorked ?? 0) as any,
          overtimeHours: (r.overtimeHours ?? 0) as any,
          notes: r.notes ?? null,
        };
        await db.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: r.employeeId, date } },
          create: { employeeId: r.employeeId, date, ...payload },
          update: payload,
        });
        saved += 1;
      }
      logger.info(`Pointage : ${saved} journée(s) enregistrée(s)`);
      return { success: true, data: { saved } };
    } catch (error: any) {
      logger.error('hr:attendance:bulkUpsert error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Retards & Départs précipités ──────────────────────────── */

  const latenessJustifySchema = z.object({
    employeeId: z.coerce.number().int().positive(),
    date: z.string().min(1), // 'YYYY-MM-DD'
    leaveRequestId: z.coerce.number().int().positive().optional(),
    crmActivityId: z.coerce.number().int().positive().optional(),
    notes: z.string().optional().nullable(),
  }).refine((d) => (d.leaveRequestId != null) !== (d.crmActivityId != null), {
    message: 'Choisissez soit une demande de congé approuvée, soit une activité (pas les deux).',
  });

  const latenessTolerateSchema = z.object({
    employeeId: z.coerce.number().int().positive(),
    date: z.string().min(1), // 'YYYY-MM-DD'
    notes: z.string().optional().nullable(),
  });

  /** Bornes [start, end[ locales d'un jour 'YYYY-MM-DD'. */
  function dayBounds(dateStr: string): { start: Date; end: Date } {
    const [y, m, d] = dateStr.split('-').map(Number);
    return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
  }

  ipcMain.handle('hr:lateness:list', async (_event, { token, year, month, employeeId, onlyUnjustified }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const now = new Date();
      // year/month = 0 (ou absent) → sentinel « Toutes les années » / « Tous
      // les mois » côté formulaire (LatenessPage.tsx). Bornes de requête :
      // - année + mois précisés : la seule fenêtre mensuelle (comportement historique).
      // - année précisée, mois « tous » : toute l'année.
      // - année « toutes », mois précisé : tout l'historique, filtré par mois en mémoire ci-dessous.
      // - les deux « tous » : tout l'historique.
      const y = year ? Number(year) : null;
      const m = month ? Number(month) : null;
      let start: Date;
      let end: Date;
      if (y != null && m != null) {
        start = new Date(y, m - 1, 1);
        end = new Date(y, m, 1);
      } else if (y != null) {
        start = new Date(y, 0, 1);
        end = new Date(y + 1, 0, 1);
      } else {
        start = new Date(2000, 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
      }
      // Filtre supplémentaire en mémoire : seul le cas « toutes les années +
      // mois précis » ne peut pas être réduit à une simple fenêtre continue
      // de dates (bornes DB déjà exactes dans tous les autres cas).
      const filterMonthAcrossYears = y == null && m != null ? m : null;

      let employeeIds: number[];
      if (LATENESS_ROLES.includes(session.role)) {
        employeeIds = await latenessEligibleEmployeeIds(db);
        // MANAGER : même périmètre que Pointage (exclut les comptes SUPER_ADMIN/ADMIN).
        if (session.role === 'MANAGER') {
          const excluded = await hrExcludedAttendanceLeave(session, db);
          employeeIds = employeeIds.filter((id) => !excluded.includes(id));
        }
        if (employeeId) employeeIds = employeeIds.filter((id) => id === Number(employeeId));
      } else {
        // Autres rôles : autoconsultation uniquement (l'employé lié à son
        // propre compte), sans filtre Collaborateur ni condition d'éligibilité
        // (celle-ci ne sert qu'à réduire le volume affiché aux admins/managers).
        const me = await db.employee.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true } });
        employeeIds = me ? [me.id] : [];
      }
      if (!employeeIds.length) return ser({ success: true, data: [] });

      const employees = await db.employee.findMany({
        where: { id: { in: employeeIds }, deletedAt: null },
        select: { id: true, matricule: true, firstName: true, lastName: true, poste: true },
      });
      const empById = new Map(employees.map((e) => [e.id, e]));

      const allLines: any[] = [];
      for (const id of employeeIds) {
        const emp = empById.get(id);
        if (!emp) continue;
        const lines = await computeLatenessLinesForEmployee(db, id, start, end);
        for (const l of lines) {
          if (filterMonthAcrossYears != null && l.date.getMonth() + 1 !== filterMonthAcrossYears) continue;
          if (onlyUnjustified && (l.justification?.justified || l.justification?.tolerated)) continue;
          allLines.push({
            ...l,
            matricule: emp.matricule,
            employeeName: `${emp.lastName} ${emp.firstName}`.trim(),
            poste: emp.poste,
          });
        }
      }
      allLines.sort((a, b) => b.date.getTime() - a.date.getTime());
      return ser({ success: true, data: allLines });
    } catch (error: any) {
      logger.error('hr:lateness:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:lateness:linkableLeaveRequests', async (_event, { token, employeeId, date }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, LATENESS_ROLES);
      const db = getDb();
      const { start } = dayBounds(String(date));
      const data = await db.leaveRequest.findMany({
        where: {
          employeeId: Number(employeeId),
          deletedAt: null,
          status: 'APPROUVE',
          startDate: { lte: start },
          endDate: { gte: start },
        },
        select: { id: true, reference: true, startDate: true, endDate: true, type: { select: { name: true } } },
        orderBy: { startDate: 'desc' },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:lateness:linkableLeaveRequests error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:lateness:linkableActivities', async (_event, { token, employeeId, date }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, LATENESS_ROLES);
      const db = getDb();
      const employee = await db.employee.findFirst({ where: { id: Number(employeeId) }, select: { userId: true } });
      if (!employee?.userId) return ser({ success: true, data: [] });
      const { start, end } = dayBounds(String(date));
      const data = await db.crmActivity.findMany({
        where: {
          userId: employee.userId,
          type: 'VISITE',
          status: 'TRAITE',
          completedAt: { gte: start, lt: end },
          delayJustification: null, // jamais utilisée pour justifier une autre journée
        },
        select: { id: true, subject: true, completedAt: true },
        orderBy: { completedAt: 'desc' },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:lateness:linkableActivities error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Lie une journée de retard/départ précipité à un justificatif (congé
  // approuvé ou activité « Visite chantier / Sortie en clientèle / Courses »
  // traitée) et la marque justifiée par l'administrateur/manager connecté.
  ipcMain.handle('hr:lateness:justify', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, LATENESS_ROLES);
      const parsed = latenessJustifySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const db = getDb();
      const { start } = dayBounds(d.date);

      if (d.leaveRequestId != null) {
        const leave = await db.leaveRequest.findFirst({
          where: { id: d.leaveRequestId, employeeId: d.employeeId, deletedAt: null, status: 'APPROUVE', startDate: { lte: start }, endDate: { gte: start } },
          select: { id: true },
        });
        if (!leave) return { success: false, error: 'Demande de congé introuvable, non approuvée, ou ne couvrant pas cette journée.' };
      }
      if (d.crmActivityId != null) {
        const activity = await db.crmActivity.findFirst({
          where: { id: d.crmActivityId, type: 'VISITE', status: 'TRAITE', delayJustification: null },
          select: { id: true },
        });
        if (!activity) return { success: false, error: 'Activité introuvable, non traitée, ou déjà utilisée pour justifier une autre journée.' };
      }

      const data = await db.attendanceDelayJustification.upsert({
        where: { employeeId_date: { employeeId: d.employeeId, date: start } },
        create: {
          employeeId: d.employeeId,
          date: start,
          leaveRequestId: d.leaveRequestId ?? null,
          crmActivityId: d.crmActivityId ?? null,
          justified: true,
          justifiedById: session.userId,
          justifiedAt: new Date(),
          notes: d.notes ?? null,
        },
        update: {
          leaveRequestId: d.leaveRequestId ?? null,
          crmActivityId: d.crmActivityId ?? null,
          justified: true,
          justifiedById: session.userId,
          justifiedAt: new Date(),
          // Justifier une journée annule une éventuelle tolérance précédente
          // (les deux statuts sont mutuellement exclusifs).
          tolerated: false,
          toleratedById: null,
          toleratedAt: null,
          notes: d.notes ?? null,
        },
      });
      logger.info(`Retard/départ précipité justifié : employé #${d.employeeId}, ${d.date}`);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:lateness:justify error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Retire la justification d'une journée (retour à l'état « non justifiée »).
  ipcMain.handle('hr:lateness:unjustify', async (_event, { token, employeeId, date }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, LATENESS_ROLES);
      const db = getDb();
      const { start } = dayBounds(String(date));
      await db.attendanceDelayJustification.deleteMany({ where: { employeeId: Number(employeeId), date: start } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:lateness:unjustify error', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Limite de tolérance par défaut (minutes) si aucune valeur n'est encore paramétrée. */
  const DEFAULT_LATENESS_TOLERANCE_MINUTES = 15;

  /** Limite de tolérance courante (minutes), paramétrable dans Paramètres. */
  async function latenessToleranceMinutes(): Promise<number> {
    const raw = Number(await getSetting(SettingsKeys.latenessToleranceMinutes));
    return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_LATENESS_TOLERANCE_MINUTES;
  }

  // Marque une journée de retard/départ précipité « Tolérée » — réservé à
  // SUPER_ADMIN/ADMIN/MANAGER, uniquement si le temps de la journée
  // n'excède pas la limite paramétrée (Paramètres → Retards & Départs
  // précipités). Contrairement à `justify`, aucun congé ni activité liée.
  ipcMain.handle('hr:lateness:tolerate', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, LATENESS_ROLES);
      const parsed = latenessTolerateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const db = getDb();
      const { start, end } = dayBounds(d.date);

      const lines = await computeLatenessLinesForEmployee(db, d.employeeId, start, end);
      const line = lines.find((l) => l.date.getTime() === start.getTime());
      if (!line) return { success: false, error: 'Aucun retard ou départ précipité à tolérer pour cette journée.' };
      const limit = await latenessToleranceMinutes();
      if (line.totalMinutes > limit) {
        return { success: false, error: `Le temps de cette journée (${line.totalMinutes} min) dépasse la limite tolérée (${limit} min).` };
      }

      const data = await db.attendanceDelayJustification.upsert({
        where: { employeeId_date: { employeeId: d.employeeId, date: start } },
        create: {
          employeeId: d.employeeId,
          date: start,
          tolerated: true,
          toleratedById: session.userId,
          toleratedAt: new Date(),
          notes: d.notes ?? null,
        },
        update: {
          tolerated: true,
          toleratedById: session.userId,
          toleratedAt: new Date(),
          // Tolérer une journée annule une éventuelle justification précédente
          // (les deux statuts sont mutuellement exclusifs).
          justified: false,
          leaveRequestId: null,
          crmActivityId: null,
          justifiedById: null,
          justifiedAt: null,
          notes: d.notes ?? null,
        },
      });
      logger.info(`Retard/départ précipité toléré : employé #${d.employeeId}, ${d.date}`);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:lateness:tolerate error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Retire la tolérance d'une journée (retour à l'état « non justifiée »).
  ipcMain.handle('hr:lateness:untolerate', async (_event, { token, employeeId, date }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, LATENESS_ROLES);
      const db = getDb();
      const { start } = dayBounds(String(date));
      await db.attendanceDelayJustification.deleteMany({ where: { employeeId: Number(employeeId), date: start } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:lateness:untolerate error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Self-service : « Mon espace RH & Paie » (lecture seule) ────
   * Accessible à TOUT utilisateur authentifié ; strictement limité à l'employé
   * lié à son compte (Employee.userId). Aucune écriture.
   */

  ipcMain.handle('hr:me:overview', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const employee = await db.employee.findFirst({
        where: { userId: session.userId, deletedAt: null },
        include: {
          contracts: {
            // Self-service : on masque les contrats antérieurs à 2026 (anciens
            // modèles) — seuls les contrats signés téléversés font foi pour eux.
            where: { deletedAt: null, startDate: { gte: new Date('2026-01-01T00:00:00.000Z') } },
            orderBy: { startDate: 'desc' },
            include: { fonction: true },
          },
        },
      });
      if (!employee) return ser({ success: true, data: { employee: null, leaveBalance: null } });
      let leaveBalance: any = null;
      try { leaveBalance = await computeLeaveBalance(employee.id); } catch { /* solde indisponible */ }
      return ser({ success: true, data: { employee, leaveBalance } });
    } catch (error: any) {
      logger.error('hr:me:overview error', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Profil de carrière (filière + étapes ordonnées) de l'employé connecté, avec
   * le rang correspondant à son poste actuel mis en évidence côté renderer. Un
   * employé n'appartient qu'à **une seule filière à la fois** : priorité au
   * rattachement explicite (`Employee.careerProfileId`, fiche personnel) ; à
   * défaut, repli sur la première filière dont une étape correspond à son poste
   * (comportement historique, pour les employés pas encore explicitement liés —
   * arbitraire si plusieurs filières partagent ce poste). `null` si aucun profil
   * n'est trouvé par ces deux voies, ou s'il n'a pas de poste renseigné.
   */
  ipcMain.handle('hr:me:careerProfile', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const employeeId = await getMyEmployeeId(session, db);
      if (!employeeId) return ser({ success: true, data: null });
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { poste: true, careerProfileId: true },
      });
      if (!employee) return ser({ success: true, data: null });

      if (employee.careerProfileId) {
        const profile = await db.careerProfile.findFirst({
          where: { id: employee.careerProfileId, deletedAt: null, isActive: true },
          include: { steps: { orderBy: { order: 'asc' } } },
        });
        if (profile) return ser({ success: true, data: { profile, currentPoste: employee.poste } });
      }

      if (!employee.poste) return ser({ success: true, data: null });
      const step = await db.careerProfileStep.findFirst({
        where: { poste: employee.poste, careerProfile: { deletedAt: null, isActive: true } },
        include: { careerProfile: { include: { steps: { orderBy: { order: 'asc' } } } } },
      });
      if (!step) return ser({ success: true, data: null });
      return ser({ success: true, data: { profile: step.careerProfile, currentPoste: employee.poste } });
    } catch (error: any) {
      logger.error('hr:me:careerProfile error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:me:payslips', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      if (!myId) return ser({ success: true, data: [] });
      const data = await db.payslip.findMany({
        where: { employeeId: myId, deletedAt: null },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { reference: 'desc' }],
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:me:payslips error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:me:payslip', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      const payslip = await db.payslip.findFirst({
        where: { id, deletedAt: null },
        include: {
          employee: true,
          contract: { select: { id: true, reference: true, poste: true, categorie: true, startDate: true } },
          lines: { orderBy: { order: 'asc' } },
        },
      });
      if (!payslip || !myId || payslip.employeeId !== myId) return { success: false, error: 'Bulletin introuvable' };
      return ser({ success: true, data: payslip });
    } catch (error: any) {
      logger.error('hr:me:payslip error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:me:payslipPrint', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      const payslip = await db.payslip.findFirst({
        where: { id, deletedAt: null },
        include: { employee: true, contract: { select: { poste: true, categorie: true, startDate: true, type: true } }, lines: { orderBy: { order: 'asc' } } },
      });
      if (!payslip || !payslip.employee || !myId || payslip.employeeId !== myId) return { success: false, error: 'Bulletin introuvable' };
      const company = await loadPayslipCompany();
      const template = await resolvePayslipTemplate();
      const logo = await loadPayslipLogo();
      const counters = await computePayslipLeaveCounters(payslip.employeeId, payslip.periodYear, payslip.periodMonth, payslip.contract?.type === 'ESSAI' || payslip.contract?.type === 'RENOUVELLEMENT_ESSAI');
      const totals = await computePayslipTotals(payslip);
      const html = renderPayslipHtml(payslip, payslip.employee, company, template ?? undefined, logo, counters, totals);
      const pdf = await htmlToPdf(html, { landscape: false });
      await openPrintPreview(pdf, `Bulletin ${payslip.reference}`);
      return { success: true, data: { previewing: true } };
    } catch (error: any) {
      logger.error('hr:me:payslipPrint error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:me:attendance', async (_event, { token, year, month }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      if (!myId) return ser({ success: true, data: [] });
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 1);
      const data = await db.attendanceRecord.findMany({
        where: { employeeId: myId, date: { gte: start, lt: end } },
        orderBy: { date: 'asc' },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:me:attendance error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:me:leaveRequests', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      if (!myId) return ser({ success: true, data: [] });
      const data = await db.leaveRequest.findMany({
        where: { employeeId: myId, deletedAt: null },
        orderBy: { startDate: 'desc' },
        include: { type: { select: { id: true, name: true, color: true, isPaid: true } } },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:me:leaveRequests error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:me:contractRenderData', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      const contract = await db.employmentContract.findFirst({
        where: { id, deletedAt: null },
        include: { employee: true, parentContract: true, responsibleAuthority: true, fonction: true, objective: true },
      });
      if (!contract || !contract.employee || !myId || contract.employeeId !== myId) return { success: false, error: 'Contrat introuvable' };
      const company = await loadContractCompany();
      return ser({ success: true, data: { contract, employee: contract.employee, company } });
    } catch (error: any) {
      logger.error('hr:me:contractRenderData error', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Règlement intérieur : document GED ciblé par l'admin (Paramètres). Renvoyé
   * à tout utilisateur authentifié pour consultation / impression (lecture seule).
   */
  ipcMain.handle('hr:me:reglementInterieur', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const raw = await getSetting(SettingsKeys.hrReglementInterieurDocId);
      const id = raw ? Number(raw) : null;
      if (!id) return { success: true, data: { configured: false } };
      const doc = await getDb().document.findFirst({
        where: { id, deletedAt: null },
        select: { name: true, type: true, size: true, path: true },
      });
      if (!doc) return { success: true, data: { configured: false } };
      const MAX = 40 * 1024 * 1024;
      if (doc.size > MAX) return { success: true, data: { configured: true, tooLarge: true, name: doc.name, mimeType: doc.type } };
      const buf = readStorageFile(doc.path);
      if (!buf) return { success: false, error: 'Fichier introuvable sur le disque' };
      return { success: true, data: { configured: true, name: doc.name, mimeType: doc.type, base64: buf.toString('base64') } };
    } catch (error: any) {
      logger.error('hr:me:reglementInterieur error', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Impression du règlement intérieur via la fenêtre d'aperçu intégrée (même
   * mécanisme fiable que les bulletins / contrats). PDF imprimé tel quel ; image
   * enveloppée dans un PDF ; autres formats non imprimables directement.
   */
  ipcMain.handle('hr:me:reglementInterieurPrint', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const raw = await getSetting(SettingsKeys.hrReglementInterieurDocId);
      const id = raw ? Number(raw) : null;
      if (!id) return { success: false, error: 'Aucun règlement intérieur défini.' };
      const doc = await getDb().document.findFirst({
        where: { id, deletedAt: null },
        select: { name: true, type: true, path: true },
      });
      if (!doc) return { success: false, error: 'Document introuvable' };
      const buf = readStorageFile(doc.path);
      if (!buf) return { success: false, error: 'Fichier introuvable sur le disque' };
      let pdf: Buffer;
      if (doc.type === 'application/pdf') {
        pdf = buf;
      } else if ((doc.type ?? '').startsWith('image/')) {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0}img{max-width:100%;display:block;margin:0 auto}</style></head><body><img src="data:${doc.type};base64,${buf.toString('base64')}"></body></html>`;
        pdf = await htmlToPdf(html, { landscape: false });
      } else {
        return { success: false, error: 'Ce format ne peut pas être imprimé directement. Téléchargez le fichier.' };
      }
      await openPrintPreview(pdf, doc.name || 'Règlement intérieur');
      return { success: true, data: { previewing: true } };
    } catch (error: any) {
      logger.error('hr:me:reglementInterieurPrint error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Contrats signés (fichiers téléversés par employé) ────────── */

  const SIGNED_MAX = 40 * 1024 * 1024;
  const signedUploadSchema = z.object({
    employeeId: z.coerce.number().int().positive(),
    name: z.string().min(1),
    type: z.string().min(1),
    size: z.number().int().positive(),
    dataBase64: z.string().min(1),
  });

  ipcMain.handle('hr:signedContracts:list', async (_event, { token, employeeId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const db = getDb();
      await assertEmployeeAccessible(session, db, Number(employeeId));
      const data = await db.employeeSignedContract.findMany({
        where: { employeeId: Number(employeeId), deletedAt: null },
        orderBy: { uploadedAt: 'desc' },
        select: { id: true, name: true, type: true, size: true, uploadedAt: true },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:signedContracts:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:signedContracts:upload', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_OPERATIONAL_ROLES);
      const parsed = signedUploadSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      const d = parsed.data;
      if (d.size > SIGNED_MAX) return { success: false, error: `Fichier trop volumineux (max ${Math.round(SIGNED_MAX / 1024 / 1024)} Mo).` };
      const db = getDb();
      await assertEmployeeAccessible(session, db, d.employeeId);
      const emp = await db.employee.findFirst({ where: { id: d.employeeId, deletedAt: null }, select: { id: true } });
      if (!emp) return { success: false, error: 'Employé introuvable' };
      const buf = Buffer.from(d.dataBase64, 'base64');
      if (buf.length === 0) return { success: false, error: 'Fichier vide ou invalide' };
      const { relativePath, size } = writeEmployeeSignedContract(d.employeeId, buf, d.name);
      const data = await db.employeeSignedContract.create({
        data: { employeeId: d.employeeId, name: d.name, type: d.type, path: relativePath, size, uploadedById: session.userId ?? null },
        select: { id: true, name: true, type: true, size: true, uploadedAt: true },
      });
      logger.info(`Contrat signé téléversé : ${d.name} (employé ${d.employeeId})`);
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:signedContracts:upload error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:signedContracts:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_OPERATIONAL_ROLES);
      const db = getDb();
      const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
      if (!rec) return { success: false, error: 'Contrat signé introuvable' };
      await assertEmployeeAccessible(session, db, rec.employeeId);
      removeStorageFile(rec.path);
      await db.employeeSignedContract.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:signedContracts:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:signedContracts:fileData', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const db = getDb();
      const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
      if (!rec) return { success: false, error: 'Contrat signé introuvable' };
      await assertEmployeeAccessible(session, db, rec.employeeId);
      if (rec.size > SIGNED_MAX) return { success: true, data: { tooLarge: true, name: rec.name, mimeType: rec.type } };
      const buf = readStorageFile(rec.path);
      if (!buf) return { success: false, error: 'Fichier introuvable sur le disque' };
      return { success: true, data: { name: rec.name, mimeType: rec.type, base64: buf.toString('base64') } };
    } catch (error: any) {
      logger.error('hr:signedContracts:fileData error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:signedContracts:open', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkHrRole(session, HR_READ_ROLES);
      const db = getDb();
      const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
      if (!rec) return { success: false, error: 'Contrat signé introuvable' };
      await assertEmployeeAccessible(session, db, rec.employeeId);
      const abs = resolveStoragePath(rec.path);
      if (!fs.existsSync(abs)) return { success: false, error: 'Fichier introuvable sur le disque' };
      const err = await shell.openPath(abs);
      if (err) return { success: false, error: err };
      return { success: true };
    } catch (error: any) {
      logger.error('hr:signedContracts:open error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Self-service : mes contrats signés (lecture seule).
  ipcMain.handle('hr:me:signedContracts', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      if (!myId) return ser({ success: true, data: [] });
      const data = await db.employeeSignedContract.findMany({
        where: { employeeId: myId, deletedAt: null },
        orderBy: { uploadedAt: 'desc' },
        select: { id: true, name: true, type: true, size: true, uploadedAt: true },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('hr:me:signedContracts error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:me:signedContractFile', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
      if (!rec || !myId || rec.employeeId !== myId) return { success: false, error: 'Contrat signé introuvable' };
      if (rec.size > SIGNED_MAX) return { success: true, data: { tooLarge: true, name: rec.name, mimeType: rec.type } };
      const buf = readStorageFile(rec.path);
      if (!buf) return { success: false, error: 'Fichier introuvable sur le disque' };
      return { success: true, data: { name: rec.name, mimeType: rec.type, base64: buf.toString('base64') } };
    } catch (error: any) {
      logger.error('hr:me:signedContractFile error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('hr:me:signedContractOpen', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
      if (!rec || !myId || rec.employeeId !== myId) return { success: false, error: 'Contrat signé introuvable' };
      const abs = resolveStoragePath(rec.path);
      if (!fs.existsSync(abs)) return { success: false, error: 'Fichier introuvable sur le disque' };
      const err = await shell.openPath(abs);
      if (err) return { success: false, error: err };
      return { success: true };
    } catch (error: any) {
      logger.error('hr:me:signedContractOpen error', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Impression d'un de mes contrats signés via la fenêtre d'aperçu native. */
  ipcMain.handle('hr:me:signedContractPrint', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const myId = await getMyEmployeeId(session, db);
      const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
      if (!rec || !myId || rec.employeeId !== myId) return { success: false, error: 'Contrat signé introuvable' };
      const buf = readStorageFile(rec.path);
      if (!buf) return { success: false, error: 'Fichier introuvable sur le disque' };
      let pdf: Buffer;
      if (rec.type === 'application/pdf') {
        pdf = buf;
      } else if ((rec.type ?? '').startsWith('image/')) {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0}img{max-width:100%;display:block;margin:0 auto}</style></head><body><img src="data:${rec.type};base64,${buf.toString('base64')}"></body></html>`;
        pdf = await htmlToPdf(html, { landscape: false });
      } else {
        return { success: false, error: 'Ce format ne peut pas être imprimé directement. Téléchargez le fichier.' };
      }
      await openPrintPreview(pdf, rec.name || 'Contrat signé');
      return { success: true, data: { previewing: true } };
    } catch (error: any) {
      logger.error('hr:me:signedContractPrint error', error.message);
      return { success: false, error: error.message };
    }
  });
}

/**
 * Amorce le référentiel des postes à partir des valeurs « poste » déjà saisies
 * sur les fiches employés (idempotent). Permet au sélecteur « Poste » de proposer
 * d'emblée les postes existants, sans écraser ni dupliquer.
 */
export async function seedJobPositionsFromEmployees(): Promise<void> {
  const db = getDb();
  const rows = await db.employee.findMany({
    where: { deletedAt: null, poste: { not: null } },
    select: { poste: true },
    distinct: ['poste'],
  });
  for (const r of rows) {
    const label = (r.poste ?? '').trim();
    if (!label) continue;
    const exists = await db.jobPosition.findUnique({ where: { label }, select: { id: true } });
    if (!exists) await db.jobPosition.create({ data: { label } });
  }
}

/**
 * Amorce le référentiel des départements/services à partir des valeurs déjà
 * saisies sur les fiches employés (idempotent).
 */
export async function seedDepartmentsFromEmployees(): Promise<void> {
  const db = getDb();
  const rows = await db.employee.findMany({
    where: { deletedAt: null, departement: { not: null } },
    select: { departement: true },
    distinct: ['departement'],
  });
  for (const r of rows) {
    const label = (r.departement ?? '').trim();
    if (!label) continue;
    const exists = await db.department.findUnique({ where: { label }, select: { id: true } });
    if (!exists) await db.department.create({ data: { label } });
  }
}
