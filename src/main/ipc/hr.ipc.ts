import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';
import { htmlToPdf, openPrintPreview } from '../services/pdf.service';
import { loadContractCompany, renderContractHtml } from '../services/contract-template.service';
import {
  computePayroll, computePrimeAnciennete, getPayrollRates, setPayrollRates,
  loadPayslipCompany, renderPayslipHtml, loadPayslipLogo, computePayslipTotals, type PayrollRates,
} from '../services/payroll.service';
import {
  resolveContractTemplateBody, resolvePayslipTemplate,
} from '../services/hr-templates.service';
import { workingDays, computeLeaveBalance, computePayslipLeaveCounters } from '../services/leave.service';
import { attendanceMonthSummary } from '../services/attendance.service';
import { recordTreasuryOperation, computeBalances } from '../services/treasury.service';
import { getSetting, SettingsKeys } from '../services/settings.service';

/**
 * Module RH / Paie — Phase 1 : gestion du personnel et des contrats de travail.
 *
 * Accès réservé au rôle dédié RH ainsi qu'aux administrateurs (SUPER_ADMIN,
 * ADMIN). Les autres rôles n'ont aucun accès au module (données personnelles
 * sensibles). Toutes les écritures sont validées par Zod et utilisent le soft
 * delete (`deletedAt`).
 */

const HR_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RH'];
const HR_READ_ROLES = [...HR_WRITE_ROLES];

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const CIVILITE = ['MONSIEUR', 'MADAME', 'MADEMOISELLE'] as const;
const MARITAL = ['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE', 'DIVORCE', 'VEUF'] as const;
const SEXE = ['MASCULIN', 'FEMININ'] as const;
const EMPLOYEE_STATUS = ['ACTIF', 'SUSPENDU', 'CONGE', 'SORTI'] as const;
const CONTRACT_TYPE = ['CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE'] as const;
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
  poste: z.string().optional().nullable(),
  departement: z.string().optional().nullable(),
  userId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
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
  totalDeductions: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  transportAllowance: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
  netSalary: z.preprocess(emptyToNull, z.coerce.number().nonnegative().nullable().optional()),
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
      checkRole(session, HR_READ_ROLES);
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
      checkRole(session, HR_READ_ROLES);
      const db = getDb();
      const rows = await db.employee.groupBy({
        by: ['status'],
        where: { deletedAt: null },
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
      checkRole(session, HR_READ_ROLES);
      const db = getDb();
      const employee = await db.employee.findFirst({
        where: { id, deletedAt: null },
        include: {
          contracts: { where: { deletedAt: null }, orderBy: { startDate: 'desc' } },
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
      });
      if (!employee) return { success: false, error: 'Employé introuvable' };
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
      checkRole(session, HR_READ_ROLES);
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

  ipcMain.handle('hr:employees:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, HR_WRITE_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
      const parsed = employeeSchema.partial().safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const db = getDb();
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
      checkRole(session, HR_WRITE_ROLES);
      const db = getDb();
      await db.employee.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Employé archivé (soft delete) : id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('hr:employees:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Contrats de travail ───────────────────────────────────── */

  ipcMain.handle('hr:contracts:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, HR_WRITE_ROLES);
      const parsed = contractSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const d = parsed.data;
      // Un CDD / STAGE / INTERIM doit avoir une date de fin.
      if (['CDD', 'STAGE', 'INTERIM'].includes(d.type) && !d.endDate) {
        return { success: false, error: 'Une date de fin est requise pour un contrat à durée déterminée.' };
      }
      const db = getDb();
      const employee = await db.employee.findFirst({ where: { id: d.employeeId, deletedAt: null } });
      if (!employee) return { success: false, error: 'Employé introuvable' };
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
      checkRole(session, HR_WRITE_ROLES);
      const parsed = contractSchema.partial().safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const db = getDb();
      const data: any = { ...parsed.data };
      delete data.employeeId; // le rattachement ne change pas après création
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
      checkRole(session, HR_WRITE_ROLES);
      const db = getDb();
      await db.employmentContract.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Contrat archivé (soft delete) : id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('hr:contracts:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Aperçu / impression d'un contrat : génère le PDF à partir du modèle ivoirien
  // correspondant au type de contrat, puis ouvre le visualiseur intégré.
  ipcMain.handle('hr:contracts:print', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, HR_READ_ROLES);
      const db = getDb();
      const contract = await db.employmentContract.findFirst({
        where: { id, deletedAt: null },
        include: { employee: true },
      });
      if (!contract || !contract.employee) return { success: false, error: 'Contrat introuvable' };
      const company = await loadContractCompany();
      const body = await resolveContractTemplateBody(contract.type);
      const html = renderContractHtml(contract, contract.employee, company, body);
      const pdf = await htmlToPdf(html, { landscape: false });
      await openPrintPreview(pdf, `Contrat ${contract.reference}`);
      logger.info(`Aperçu impression contrat : ${contract.reference}`);
      return { success: true, data: { previewing: true } };
    } catch (error: any) {
      logger.error('hr:contracts:print error', error.message);
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
    otherDeductions: z.coerce.number().nonnegative().optional(),
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

  ipcMain.handle('hr:payslips:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, HR_READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.employeeId) where.employeeId = Number(filters.employeeId);
      if (filters.status) where.status = filters.status;
      if (filters.periodYear) where.periodYear = Number(filters.periodYear);
      if (filters.periodMonth) where.periodMonth = Number(filters.periodMonth);
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
      checkRole(session, HR_READ_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
      const parsed = generateSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const d = parsed.data;
      const db = getDb();
      // Un seul bulletin par employé et par période. L'index unique
      // (employeeId, periodYear, periodMonth) ne tient pas compte du soft delete :
      // on recherche donc aussi les bulletins archivés afin de les réutiliser
      // (sinon la recréation viole la contrainte d'unicité).
      const existing = await db.payslip.findFirst({
        where: { employeeId: d.employeeId, periodYear: d.periodYear, periodMonth: d.periodMonth },
      });
      if (existing && !existing.deletedAt) {
        return { success: false, error: 'Un bulletin existe déjà pour cet employé sur cette période.' };
      }

      const employee = await db.employee.findFirst({
        where: { id: d.employeeId, deletedAt: null },
        include: { contracts: { where: { deletedAt: null }, orderBy: { startDate: 'desc' }, take: 1 } },
      });
      if (!employee) return { success: false, error: 'Employé introuvable' };
      const contract = employee.contracts[0];
      if (!contract) return { success: false, error: "Aucun contrat actif : définissez d'abord un contrat avec un salaire de base." };

      const rates = await getPayrollRates(db);
      // Heures supplémentaires : valorisées depuis le pointage du mois (option).
      let overtimeAmount = 0;
      if (d.includeOvertime !== false) {
        const summary = await attendanceMonthSummary(employee.id, d.periodYear, d.periodMonth);
        overtimeAmount = summary.overtimeAmount;
      }
      const prime = computePrimeAnciennete(Number(contract.baseSalary), employee.hireDate);
      const result = computePayroll(
        {
          baseSalary: Number(contract.baseSalary),
          igrParts: Number(employee.igrParts ?? 1),
          sursalaire: d.sursalaire,
          primeAnciennete: prime.amount,
          senioriteRate: prime.rate,
          taxablePrime: d.taxablePrime,
          overtimeAmount,
          transportAllowance: d.transportAllowance,
          otherDeductions: d.otherDeductions,
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
        baseSalary: result.baseSalary as any,
        grossTaxable: result.grossTaxable as any,
        totalGains: result.totalGains as any,
        cnpsEmployee: result.cnpsEmployee as any,
        its: result.its as any,
        cmuEmployee: result.cmuEmployee as any,
        otherDeductions: result.otherDeductions as any,
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
        logger.info(`Bulletin régénéré : ${payslip.reference} (employé ${employee.id}, ${d.periodMonth}/${d.periodYear})`);
      } else {
        const reference = await nextPayslipReference(db);
        payslip = await db.payslip.create({
          data: {
            reference,
            employeeId: employee.id,
            periodYear: d.periodYear,
            periodMonth: d.periodMonth,
            ...amounts,
            lines: { create: lineData },
          },
          include: { lines: true },
        });
        logger.info(`Bulletin généré : ${reference} (employé ${employee.id}, ${d.periodMonth}/${d.periodYear})`);
      }
      return ser({ success: true, data: payslip });
    } catch (error: any) {
      logger.error('hr:payslips:generate error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Modification d'un bulletin encore en BROUILLON : on recalcule à partir des
  // entrées ajustables (primes, indemnité transport, autres retenues, heures
  // supplémentaires). L'employé, la période et la référence ne changent pas.
  const payslipEditSchema = z.object({
    sursalaire: z.coerce.number().nonnegative().optional(),
    taxablePrime: z.coerce.number().nonnegative().optional(),
    transportAllowance: z.coerce.number().nonnegative().optional(),
    otherDeductions: z.coerce.number().nonnegative().optional(),
    includeOvertime: z.coerce.boolean().optional(),
  });

  ipcMain.handle('hr:payslips:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, HR_WRITE_ROLES);
      const parsed = payslipEditSchema.safeParse(payload);
      if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
      }
      const d = parsed.data;
      const db = getDb();
      const payslip = await db.payslip.findFirst({ where: { id, deletedAt: null } });
      if (!payslip) return { success: false, error: 'Bulletin introuvable' };
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
      const prime = computePrimeAnciennete(Number(contract.baseSalary), employee.hireDate);
      const result = computePayroll(
        {
          baseSalary: Number(contract.baseSalary),
          igrParts: Number(employee.igrParts ?? 1),
          sursalaire: d.sursalaire,
          primeAnciennete: prime.amount,
          senioriteRate: prime.rate,
          taxablePrime: d.taxablePrime,
          overtimeAmount,
          transportAllowance: d.transportAllowance,
          otherDeductions: d.otherDeductions,
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
          otherDeductions: result.otherDeductions as any,
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
      checkRole(session, HR_READ_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
      if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
        return { success: false, error: 'Mode de paiement invalide' };
      }
      const db = getDb();
      const payslip = await db.payslip.findFirst({
        where: { id, deletedAt: null },
        include: { employee: { select: { firstName: true, lastName: true } } },
      });
      if (!payslip) return { success: false, error: 'Bulletin introuvable' };
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
      checkRole(session, HR_WRITE_ROLES);
      const db = getDb();
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
      checkRole(session, HR_READ_ROLES);
      const db = getDb();
      const payslip = await db.payslip.findFirst({
        where: { id, deletedAt: null },
        include: { employee: true, contract: { select: { poste: true, categorie: true, startDate: true } }, lines: { orderBy: { order: 'asc' } } },
      });
      if (!payslip || !payslip.employee) return { success: false, error: 'Bulletin introuvable' };
      const company = await loadPayslipCompany();
      const template = await resolvePayslipTemplate();
      const logo = await loadPayslipLogo();
      const counters = await computePayslipLeaveCounters(payslip.employeeId, payslip.periodYear);
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
      checkRole(session, HR_READ_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
      await setPayrollRates(rates as PayrollRates, getDb());
      logger.info('Taux de paie mis à jour');
      return { success: true };
    } catch (error: any) {
      logger.error('hr:payroll:setRates error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Modèles de contrats de travail ────────────────────────── */

  const contractTplSchema = z.object({
    name: z.string().min(1, 'Nom requis'),
    type: z.enum(CONTRACT_TYPE),
    body: z.string().min(1, 'Contenu requis'),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

  ipcMain.handle('hr:contractTemplates:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, HR_READ_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
      await getDb().contractTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:contractTemplates:delete error', error.message);
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
      checkRole(session, HR_READ_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
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
      checkRole(session, HR_READ_ROLES);
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
      checkRole(session, HR_READ_ROLES);
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
      checkRole(session, HR_READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.employeeId) where.employeeId = Number(filters.employeeId);
      if (filters.status) where.status = filters.status;
      if (filters.typeId) where.typeId = Number(filters.typeId);
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
      checkRole(session, HR_WRITE_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
      await getDb().leaveRequest.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('hr:leaveRequests:delete error', error.message);
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
      checkRole(session, HR_READ_ROLES);
      const db = getDb();
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
      checkRole(session, HR_READ_ROLES);
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
      checkRole(session, HR_WRITE_ROLES);
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
}
