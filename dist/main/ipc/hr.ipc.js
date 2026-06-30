"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHrIPC = registerHrIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const pdf_service_1 = require("../services/pdf.service");
const contract_template_service_1 = require("../services/contract-template.service");
const payroll_service_1 = require("../services/payroll.service");
const hr_templates_service_1 = require("../services/hr-templates.service");
const leave_service_1 = require("../services/leave.service");
const attendance_service_1 = require("../services/attendance.service");
const treasury_service_1 = require("../services/treasury.service");
const settings_service_1 = require("../services/settings.service");
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
const ser = (v) => JSON.parse(JSON.stringify(v));
const CIVILITE = ['MONSIEUR', 'MADAME', 'MADEMOISELLE'];
const MARITAL = ['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE', 'DIVORCE', 'VEUF'];
const SEXE = ['MASCULIN', 'FEMININ'];
const EMPLOYEE_STATUS = ['ACTIF', 'SUSPENDU', 'CONGE', 'SORTI'];
const CONTRACT_TYPE = ['CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE'];
const CONTRACT_STATUS = ['BROUILLON', 'ACTIF', 'SUSPENDU', 'TERMINE', 'ROMPU'];
const emptyToNull = (v) => (v === '' ? null : v);
const employeeSchema = zod_1.z.object({
    // Matricule : éditable. Laissé vide à la création → généré (EMP-AF-AAAA-NNNN).
    matricule: zod_1.z.string().optional().nullable(),
    civilite: zod_1.z.preprocess(emptyToNull, zod_1.z.enum(CIVILITE).nullable().optional()),
    firstName: zod_1.z.string().min(1, 'Prénom requis'),
    lastName: zod_1.z.string().min(1, 'Nom requis'),
    sexe: zod_1.z.preprocess(emptyToNull, zod_1.z.enum(SEXE).nullable().optional()),
    birthDate: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.date().nullable().optional()),
    birthPlace: zod_1.z.string().optional().nullable(),
    nationality: zod_1.z.string().optional().nullable(),
    maritalStatus: zod_1.z.preprocess(emptyToNull, zod_1.z.enum(MARITAL).nullable().optional()),
    childrenCount: zod_1.z.coerce.number().int().min(0).optional(),
    igrParts: zod_1.z.coerce.number().min(0).optional(),
    email: zod_1.z.string().email('Email invalide').optional().nullable().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional().nullable(),
    mobile: zod_1.z.string().optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    city: zod_1.z.string().optional().nullable(),
    idNumber: zod_1.z.string().optional().nullable(),
    cnpsNumber: zod_1.z.string().optional().nullable(),
    cmuNumber: zod_1.z.string().optional().nullable(),
    bankName: zod_1.z.string().optional().nullable(),
    bankRib: zod_1.z.string().optional().nullable(),
    poste: zod_1.z.string().optional().nullable(),
    departement: zod_1.z.string().optional().nullable(),
    userId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    status: zod_1.z.enum(EMPLOYEE_STATUS).optional(),
    hireDate: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.date().nullable().optional()),
    exitDate: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.date().nullable().optional()),
    exitReason: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
});
const contractSchema = zod_1.z.object({
    employeeId: zod_1.z.coerce.number().int().positive('Employé requis'),
    type: zod_1.z.enum(CONTRACT_TYPE).default('CDI'),
    status: zod_1.z.enum(CONTRACT_STATUS).default('ACTIF'),
    poste: zod_1.z.string().optional().nullable(),
    categorie: zod_1.z.string().optional().nullable(),
    startDate: zod_1.z.coerce.date({ message: 'Date de début requise' }),
    endDate: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.date().nullable().optional()),
    trialEndDate: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.date().nullable().optional()),
    weeklyHours: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().positive().nullable().optional()),
    baseSalary: zod_1.z.coerce.number().nonnegative('Salaire de base requis'),
    // Détail de rémunération (saisi) — figurant dans la clause de rémunération.
    sursalaire: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    primeAnciennete: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    grossSalary: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    its: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    cnps: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    totalDeductions: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    transportAllowance: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    netSalary: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    notes: zod_1.z.string().optional().nullable(),
});
/** Normalise un email vide en null. */
function normEmail(v) {
    const s = typeof v === 'string' ? v.trim() : '';
    return s === '' ? null : s;
}
/** Génère la prochaine référence séquentielle annuelle (préfixe-YYYY-NNNN). */
/**
 * Génère le prochain matricule au format AF-<année>-NNNN.
 * `year` = année d'embauche si indiquée, sinon année en cours.
 */
async function nextEmployeeMatricule(db, year) {
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
async function nextContractReference(db) {
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
function registerHrIPC() {
    /* ─── Personnel ─────────────────────────────────────────────── */
    electron_1.ipcMain.handle('hr:employees:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
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
            if (filters.status)
                where.status = filters.status;
            if (filters.departement)
                where.departement = { contains: String(filters.departement) };
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
        }
        catch (error) {
            logger_1.default.error('hr:employees:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:employees:stats', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const rows = await db.employee.groupBy({
                by: ['status'],
                where: { deletedAt: null },
                _count: { _all: true },
            });
            const stats = {};
            for (const r of rows)
                stats[r.status] = r._count._all;
            return { success: true, data: stats };
        }
        catch (error) {
            logger_1.default.error('hr:employees:stats error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:employees:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const employee = await db.employee.findFirst({
                where: { id, deletedAt: null },
                include: {
                    contracts: { where: { deletedAt: null }, orderBy: { startDate: 'desc' } },
                    user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
                },
            });
            if (!employee)
                return { success: false, error: 'Employé introuvable' };
            return ser({ success: true, data: employee });
        }
        catch (error) {
            logger_1.default.error('hr:employees:getById error', error.message);
            return { success: false, error: error.message };
        }
    });
    /**
     * Liste des utilisateurs de l'application proposables pour être liés à un
     * membre du personnel. Renvoie les comptes actifs non encore rattachés à un
     * autre employé (le compte de l'employé en cours d'édition est conservé via
     * `excludeEmployeeId`). Réservé aux rôles RH/Admin.
     */
    electron_1.ipcMain.handle('hr:employees:linkableUsers', async (_event, { token, excludeEmployeeId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            // « Lié » s'entend au sens de la contrainte d'unicité userId (tout employé,
            // y compris archivé) : on n'expose donc que les comptes sans employé, plus
            // celui déjà rattaché à l'employé édité.
            const orClauses = [{ employee: { is: null } }];
            if (excludeEmployeeId)
                orClauses.push({ employee: { is: { id: Number(excludeEmployeeId) } } });
            const data = await db.user.findMany({
                where: { deletedAt: null, isActive: true, OR: orClauses },
                select: { id: true, firstName: true, lastName: true, matricule: true, email: true, role: true },
                orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            });
            return { success: true, data };
        }
        catch (error) {
            logger_1.default.error('hr:employees:linkableUsers error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:employees:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const parsed = employeeSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            // Matricule : valeur saisie si fournie (unicité vérifiée), sinon généré
            // au format EMP-AF-<année d'embauche ou année en cours>-NNNN.
            let matricule = (d.matricule ?? '').trim();
            if (matricule) {
                const exists = await db.employee.findFirst({ where: { matricule }, select: { id: true } });
                if (exists)
                    return { success: false, error: 'Ce matricule est déjà utilisé.' };
            }
            else {
                const year = d.hireDate ? new Date(d.hireDate).getFullYear() : new Date().getFullYear();
                matricule = await nextEmployeeMatricule(db, year);
            }
            // Compte utilisateur lié : un utilisateur ne peut être rattaché qu'à un seul employé.
            if (d.userId != null) {
                const linked = await db.employee.findFirst({ where: { userId: d.userId }, select: { id: true } });
                if (linked)
                    return { success: false, error: 'Cet utilisateur est déjà lié à un autre membre du personnel.' };
            }
            const employee = await db.employee.create({
                data: {
                    ...d,
                    email: normEmail(d.email),
                    matricule,
                },
            });
            logger_1.default.info(`Employé créé : ${matricule}`);
            return ser({ success: true, data: employee });
        }
        catch (error) {
            logger_1.default.error('hr:employees:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:employees:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const parsed = employeeSchema.partial().safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            if ('email' in data)
                data.email = normEmail(data.email);
            // Matricule modifiable : on ignore une valeur vide ; sinon unicité contrôlée.
            if ('matricule' in data) {
                const m = String(data.matricule ?? '').trim();
                if (!m) {
                    delete data.matricule;
                }
                else {
                    const exists = await db.employee.findFirst({ where: { matricule: m, id: { not: id } }, select: { id: true } });
                    if (exists)
                        return { success: false, error: 'Ce matricule est déjà utilisé.' };
                    data.matricule = m;
                }
            }
            // Compte utilisateur lié : vérifier qu'il n'est pas déjà rattaché à un autre employé.
            if (data.userId != null) {
                const linked = await db.employee.findFirst({ where: { userId: data.userId, id: { not: id } }, select: { id: true } });
                if (linked)
                    return { success: false, error: 'Cet utilisateur est déjà lié à un autre membre du personnel.' };
            }
            const employee = await db.employee.update({ where: { id }, data });
            logger_1.default.info(`Employé mis à jour : id=${id}`);
            return ser({ success: true, data: employee });
        }
        catch (error) {
            logger_1.default.error('hr:employees:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:employees:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.employee.update({ where: { id }, data: { deletedAt: new Date() } });
            logger_1.default.info(`Employé archivé (soft delete) : id=${id}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:employees:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Contrats de travail ───────────────────────────────────── */
    electron_1.ipcMain.handle('hr:contracts:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
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
            const db = (0, db_service_1.getDb)();
            const employee = await db.employee.findFirst({ where: { id: d.employeeId, deletedAt: null } });
            if (!employee)
                return { success: false, error: 'Employé introuvable' };
            const reference = await nextContractReference(db);
            const contract = await db.employmentContract.create({
                data: { ...d, reference },
            });
            logger_1.default.info(`Contrat créé : ${reference} (employé ${d.employeeId})`);
            return ser({ success: true, data: contract });
        }
        catch (error) {
            logger_1.default.error('hr:contracts:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contracts:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const parsed = contractSchema.partial().safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            delete data.employeeId; // le rattachement ne change pas après création
            const contract = await db.employmentContract.update({ where: { id }, data });
            logger_1.default.info(`Contrat mis à jour : id=${id}`);
            return ser({ success: true, data: contract });
        }
        catch (error) {
            logger_1.default.error('hr:contracts:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contracts:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.employmentContract.update({ where: { id }, data: { deletedAt: new Date() } });
            logger_1.default.info(`Contrat archivé (soft delete) : id=${id}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:contracts:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Aperçu / impression d'un contrat : génère le PDF à partir du modèle ivoirien
    // correspondant au type de contrat, puis ouvre le visualiseur intégré.
    electron_1.ipcMain.handle('hr:contracts:print', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const contract = await db.employmentContract.findFirst({
                where: { id, deletedAt: null },
                include: { employee: true },
            });
            if (!contract || !contract.employee)
                return { success: false, error: 'Contrat introuvable' };
            const company = await (0, contract_template_service_1.loadContractCompany)();
            const body = await (0, hr_templates_service_1.resolveContractTemplateBody)(contract.type);
            const html = (0, contract_template_service_1.renderContractHtml)(contract, contract.employee, company, body);
            const pdf = await (0, pdf_service_1.htmlToPdf)(html, { landscape: false });
            await (0, pdf_service_1.openPrintPreview)(pdf, `Contrat ${contract.reference}`);
            logger_1.default.info(`Aperçu impression contrat : ${contract.reference}`);
            return { success: true, data: { previewing: true } };
        }
        catch (error) {
            logger_1.default.error('hr:contracts:print error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Paie / bulletins ──────────────────────────────────────── */
    const generateSchema = zod_1.z.object({
        employeeId: zod_1.z.coerce.number().int().positive(),
        periodYear: zod_1.z.coerce.number().int().min(2000).max(2100),
        periodMonth: zod_1.z.coerce.number().int().min(1).max(12),
        sursalaire: zod_1.z.coerce.number().nonnegative().optional(),
        taxablePrime: zod_1.z.coerce.number().nonnegative().optional(),
        transportAllowance: zod_1.z.coerce.number().nonnegative().optional(),
        otherDeductions: zod_1.z.coerce.number().nonnegative().optional(),
        // Inclure automatiquement les heures supplémentaires du pointage du mois.
        includeOvertime: zod_1.z.coerce.boolean().optional(),
    });
    async function nextPayslipReference(db) {
        const year = new Date().getFullYear();
        const last = await db.payslip.findFirst({
            where: { reference: { startsWith: `BUL-${year}-` } },
            orderBy: { reference: 'desc' },
            select: { reference: true },
        });
        const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
        return `BUL-${year}-${String(seq).padStart(4, '0')}`;
    }
    electron_1.ipcMain.handle('hr:payslips:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.employeeId)
                where.employeeId = Number(filters.employeeId);
            if (filters.status)
                where.status = filters.status;
            if (filters.periodYear)
                where.periodYear = Number(filters.periodYear);
            if (filters.periodMonth)
                where.periodMonth = Number(filters.periodMonth);
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
        }
        catch (error) {
            logger_1.default.error('hr:payslips:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:payslips:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
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
            if (!payslip)
                return { success: false, error: 'Bulletin introuvable' };
            return ser({ success: true, data: payslip });
        }
        catch (error) {
            logger_1.default.error('hr:payslips:getById error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:payslips:generate', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const parsed = generateSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
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
            if (!employee)
                return { success: false, error: 'Employé introuvable' };
            const contract = employee.contracts[0];
            if (!contract)
                return { success: false, error: "Aucun contrat actif : définissez d'abord un contrat avec un salaire de base." };
            const rates = await (0, payroll_service_1.getPayrollRates)(db);
            // Heures supplémentaires : valorisées depuis le pointage du mois (option).
            let overtimeAmount = 0;
            if (d.includeOvertime !== false) {
                const summary = await (0, attendance_service_1.attendanceMonthSummary)(employee.id, d.periodYear, d.periodMonth);
                overtimeAmount = summary.overtimeAmount;
            }
            const prime = (0, payroll_service_1.computePrimeAnciennete)(Number(contract.baseSalary), employee.hireDate);
            const result = (0, payroll_service_1.computePayroll)({
                baseSalary: Number(contract.baseSalary),
                igrParts: Number(employee.igrParts ?? 1),
                sursalaire: d.sursalaire,
                primeAnciennete: prime.amount,
                senioriteRate: prime.rate,
                taxablePrime: d.taxablePrime,
                overtimeAmount,
                transportAllowance: d.transportAllowance,
                otherDeductions: d.otherDeductions,
            }, rates);
            const lineData = result.lines.map((l) => ({
                type: l.type, label: l.label,
                base: l.base != null ? l.base : null,
                rate: l.rate != null ? l.rate : null,
                amount: l.amount, order: l.order,
            }));
            const amounts = {
                contractId: contract.id,
                baseSalary: result.baseSalary,
                grossTaxable: result.grossTaxable,
                totalGains: result.totalGains,
                cnpsEmployee: result.cnpsEmployee,
                its: result.its,
                cmuEmployee: result.cmuEmployee,
                otherDeductions: result.otherDeductions,
                totalDeductions: result.totalDeductions,
                netSalary: result.netSalary,
                employerCharges: result.employerCharges,
                employerCost: result.employerCost,
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
                logger_1.default.info(`Bulletin régénéré : ${payslip.reference} (employé ${employee.id}, ${d.periodMonth}/${d.periodYear})`);
            }
            else {
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
                logger_1.default.info(`Bulletin généré : ${reference} (employé ${employee.id}, ${d.periodMonth}/${d.periodYear})`);
            }
            return ser({ success: true, data: payslip });
        }
        catch (error) {
            logger_1.default.error('hr:payslips:generate error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Modification d'un bulletin encore en BROUILLON : on recalcule à partir des
    // entrées ajustables (primes, indemnité transport, autres retenues, heures
    // supplémentaires). L'employé, la période et la référence ne changent pas.
    const payslipEditSchema = zod_1.z.object({
        sursalaire: zod_1.z.coerce.number().nonnegative().optional(),
        taxablePrime: zod_1.z.coerce.number().nonnegative().optional(),
        transportAllowance: zod_1.z.coerce.number().nonnegative().optional(),
        otherDeductions: zod_1.z.coerce.number().nonnegative().optional(),
        includeOvertime: zod_1.z.coerce.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:payslips:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const parsed = payslipEditSchema.safeParse(payload);
            if (!parsed.success) {
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            }
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const payslip = await db.payslip.findFirst({ where: { id, deletedAt: null } });
            if (!payslip)
                return { success: false, error: 'Bulletin introuvable' };
            if (payslip.status !== 'BROUILLON') {
                return { success: false, error: 'Seul un bulletin en brouillon peut être modifié.' };
            }
            const employee = await db.employee.findFirst({
                where: { id: payslip.employeeId, deletedAt: null },
                include: { contracts: { where: { deletedAt: null }, orderBy: { startDate: 'desc' }, take: 1 } },
            });
            if (!employee)
                return { success: false, error: 'Employé introuvable' };
            const contract = employee.contracts[0];
            if (!contract)
                return { success: false, error: "Aucun contrat actif pour recalculer le bulletin." };
            const rates = await (0, payroll_service_1.getPayrollRates)(db);
            let overtimeAmount = 0;
            if (d.includeOvertime !== false) {
                const summary = await (0, attendance_service_1.attendanceMonthSummary)(employee.id, payslip.periodYear, payslip.periodMonth);
                overtimeAmount = summary.overtimeAmount;
            }
            const prime = (0, payroll_service_1.computePrimeAnciennete)(Number(contract.baseSalary), employee.hireDate);
            const result = (0, payroll_service_1.computePayroll)({
                baseSalary: Number(contract.baseSalary),
                igrParts: Number(employee.igrParts ?? 1),
                sursalaire: d.sursalaire,
                primeAnciennete: prime.amount,
                senioriteRate: prime.rate,
                taxablePrime: d.taxablePrime,
                overtimeAmount,
                transportAllowance: d.transportAllowance,
                otherDeductions: d.otherDeductions,
            }, rates);
            await db.payslipLine.deleteMany({ where: { payslipId: id } });
            const updated = await db.payslip.update({
                where: { id },
                data: {
                    contractId: contract.id,
                    baseSalary: result.baseSalary,
                    grossTaxable: result.grossTaxable,
                    totalGains: result.totalGains,
                    cnpsEmployee: result.cnpsEmployee,
                    its: result.its,
                    cmuEmployee: result.cmuEmployee,
                    otherDeductions: result.otherDeductions,
                    totalDeductions: result.totalDeductions,
                    netSalary: result.netSalary,
                    employerCharges: result.employerCharges,
                    employerCost: result.employerCost,
                    lines: {
                        create: result.lines.map((l) => ({
                            type: l.type, label: l.label,
                            base: l.base != null ? l.base : null,
                            rate: l.rate != null ? l.rate : null,
                            amount: l.amount, order: l.order,
                        })),
                    },
                },
                include: { lines: true },
            });
            logger_1.default.info(`Bulletin modifié : ${updated.reference}`);
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('hr:payslips:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Convertit une date 'AAAA-MM-JJ' (input date) en Date à midi local pour éviter
    // tout décalage de fuseau ; accepte aussi une date/ISO complète.
    const parsePayDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(`${v}T12:00:00`) : new Date(v);
    const PAYMENT_METHODS = ['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY'];
    /**
     * Charge et valide le compte de trésorerie à débiter pour un salaire.
     * Le règlement d'un salaire ne peut se faire que depuis un compte commun
     * (non rattaché à un utilisateur) et actif.
     */
    async function loadSalaryAccount(db, bankAccountId) {
        const account = await db.bankAccount.findFirst({ where: { id: bankAccountId, deletedAt: null } });
        if (!account)
            return { error: 'Compte à débiter introuvable' };
        if (account.linkedUserId != null) {
            return { error: 'Le salaire doit être réglé depuis un compte commun (non rattaché à un utilisateur).' };
        }
        if (!account.isActive)
            return { error: 'Ce compte de trésorerie est inactif.' };
        return { account };
    }
    /** Objet d'opération « Salaires » (SORTIE) : réutilisé ou créé à la volée. */
    async function resolveSalaryCategoryId(db) {
        const existing = await db.treasuryCategory.findFirst({
            where: { deletedAt: null, direction: 'SORTIE', label: { contains: 'Salaire' } },
            orderBy: { id: 'asc' },
        });
        if (existing)
            return existing.id;
        const created = await db.treasuryCategory.create({ data: { label: 'Salaires', direction: 'SORTIE' } });
        return created.id;
    }
    /**
     * Synchronise le décaissement de trésorerie associé à un bulletin payé.
     * Crée l'opération (SORTIE, source PAIE) si un compte est fourni et qu'aucune
     * n'existe ; sinon met à jour l'opération existante (montant, date, mode,
     * compte si fourni). Sans compte fourni ni opération existante, ne fait rien.
     */
    async function syncPayslipOperation(db, payslip, opts) {
        const existing = await db.treasuryOperation.findFirst({ where: { payslipId: payslip.id, deletedAt: null } });
        if (!existing && opts.bankAccountId == null)
            return;
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
                    amount: amount,
                    operationDate: opts.paidAt,
                    ...(opts.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
                    label,
                    categoryId,
                },
            });
        }
        else if (opts.bankAccountId != null) {
            await (0, treasury_service_1.recordTreasuryOperation)(db, {
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
    async function cancelPayslipOperation(db, payslipId) {
        await db.treasuryOperation.updateMany({
            where: { payslipId, deletedAt: null },
            data: { deletedAt: new Date() },
        });
    }
    /**
     * Liste les comptes de trésorerie débitables pour un salaire (communs, actifs),
     * avec leur solde courant, pour alimenter le sélecteur de paiement RH.
     */
    electron_1.ipcMain.handle('hr:payslips:payAccounts', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const accounts = await db.bankAccount.findMany({
                where: { deletedAt: null, isActive: true, linkedUserId: null },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, type: true, currency: true },
            });
            const balances = await (0, treasury_service_1.computeBalances)(db, accounts.map((a) => a.id));
            const data = accounts.map((a) => ({ ...a, balance: balances.get(a.id)?.balance ?? 0 }));
            // Compte par défaut défini dans les Paramètres (validé contre la liste disponible)
            const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.payrollDefaultAccountId);
            const defaultId = raw ? Number(raw) : null;
            const defaultAccountId = defaultId != null && accounts.some((a) => a.id === defaultId) ? defaultId : null;
            return ser({ success: true, data, defaultAccountId });
        }
        catch (error) {
            logger_1.default.error('hr:payslips:payAccounts error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:payslips:updateStatus', async (_event, { token, id, status, paymentMethod, paidAt, bankAccountId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            if (!['BROUILLON', 'VALIDE', 'PAYE', 'ANNULE'].includes(status)) {
                return { success: false, error: 'Statut invalide' };
            }
            if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
                return { success: false, error: 'Mode de paiement invalide' };
            }
            const db = (0, db_service_1.getDb)();
            const current = await db.payslip.findFirst({
                where: { id, deletedAt: null },
                include: { employee: { select: { firstName: true, lastName: true } } },
            });
            if (!current)
                return { success: false, error: 'Bulletin introuvable' };
            const data = { status };
            if (status === 'PAYE') {
                const when = paidAt ? parsePayDate(paidAt) : new Date();
                data.paidAt = when;
                if (paymentMethod)
                    data.paymentMethod = paymentMethod;
                // Décaissement en comptabilité si un compte à débiter est fourni
                if (bankAccountId != null) {
                    const res = await loadSalaryAccount(db, bankAccountId);
                    if (res.error)
                        return { success: false, error: res.error };
                    await syncPayslipOperation(db, current, {
                        bankAccountId,
                        paidAt: when,
                        paymentMethod: paymentMethod ?? current.paymentMethod,
                        userId: session.userId,
                    });
                }
            }
            else {
                // Sortie du statut « payé » → annuler le décaissement éventuel
                await cancelPayslipOperation(db, id);
            }
            const payslip = await db.payslip.update({ where: { id }, data });
            logger_1.default.info(`Bulletin ${id} → statut ${status}`);
            return ser({ success: true, data: payslip });
        }
        catch (error) {
            logger_1.default.error('hr:payslips:updateStatus error', error.message);
            return { success: false, error: error.message };
        }
    });
    /** Modifier la date, le mode et/ou le compte de paiement d'un bulletin payé. */
    electron_1.ipcMain.handle('hr:payslips:updatePayment', async (_event, { token, id, paidAt, paymentMethod, bankAccountId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
                return { success: false, error: 'Mode de paiement invalide' };
            }
            const db = (0, db_service_1.getDb)();
            const payslip = await db.payslip.findFirst({
                where: { id, deletedAt: null },
                include: { employee: { select: { firstName: true, lastName: true } } },
            });
            if (!payslip)
                return { success: false, error: 'Bulletin introuvable' };
            if (payslip.status !== 'PAYE') {
                return { success: false, error: "Seul un bulletin payé peut voir ses informations de paiement modifiées." };
            }
            if (bankAccountId != null) {
                const res = await loadSalaryAccount(db, bankAccountId);
                if (res.error)
                    return { success: false, error: res.error };
            }
            const data = {};
            if (paidAt)
                data.paidAt = parsePayDate(paidAt);
            if (paymentMethod)
                data.paymentMethod = paymentMethod;
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
            logger_1.default.info(`Bulletin ${updated.reference} : informations de paiement modifiées`);
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('hr:payslips:updatePayment error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:payslips:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.payslip.update({ where: { id }, data: { deletedAt: new Date() } });
            logger_1.default.info(`Bulletin archivé (soft delete) : id=${id}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:payslips:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:payslips:print', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const payslip = await db.payslip.findFirst({
                where: { id, deletedAt: null },
                include: { employee: true, contract: { select: { poste: true, categorie: true, startDate: true } }, lines: { orderBy: { order: 'asc' } } },
            });
            if (!payslip || !payslip.employee)
                return { success: false, error: 'Bulletin introuvable' };
            const company = await (0, payroll_service_1.loadPayslipCompany)();
            const template = await (0, hr_templates_service_1.resolvePayslipTemplate)();
            const logo = await (0, payroll_service_1.loadPayslipLogo)();
            const counters = await (0, leave_service_1.computePayslipLeaveCounters)(payslip.employeeId, payslip.periodYear);
            const totals = await (0, payroll_service_1.computePayslipTotals)(payslip);
            const html = (0, payroll_service_1.renderPayslipHtml)(payslip, payslip.employee, company, template ?? undefined, logo, counters, totals);
            const pdf = await (0, pdf_service_1.htmlToPdf)(html, { landscape: false });
            await (0, pdf_service_1.openPrintPreview)(pdf, `Bulletin ${payslip.reference}`);
            logger_1.default.info(`Aperçu impression bulletin : ${payslip.reference}`);
            return { success: true, data: { previewing: true } };
        }
        catch (error) {
            logger_1.default.error('hr:payslips:print error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Paramètres de paie (taux) ─────────────────────────────── */
    electron_1.ipcMain.handle('hr:payroll:getRates', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const rates = await (0, payroll_service_1.getPayrollRates)((0, db_service_1.getDb)());
            return { success: true, data: rates };
        }
        catch (error) {
            logger_1.default.error('hr:payroll:getRates error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:payroll:setRates', async (_event, { token, rates }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            await (0, payroll_service_1.setPayrollRates)(rates, (0, db_service_1.getDb)());
            logger_1.default.info('Taux de paie mis à jour');
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:payroll:setRates error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Modèles de contrats de travail ────────────────────────── */
    const contractTplSchema = zod_1.z.object({
        name: zod_1.z.string().min(1, 'Nom requis'),
        type: zod_1.z.enum(CONTRACT_TYPE),
        body: zod_1.z.string().min(1, 'Contenu requis'),
        isDefault: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:contractTemplates:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const data = await (0, db_service_1.getDb)().contractTemplate.findMany({
                where: { deletedAt: null },
                orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { id: 'asc' }],
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:contractTemplates:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contractTemplates:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const parsed = contractTplSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const db = (0, db_service_1.getDb)();
            if (parsed.data.isDefault) {
                await db.contractTemplate.updateMany({ where: { type: parsed.data.type }, data: { isDefault: false } });
            }
            const data = await db.contractTemplate.create({ data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:contractTemplates:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contractTemplates:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const parsed = contractTplSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const db = (0, db_service_1.getDb)();
            const current = await db.contractTemplate.findUnique({ where: { id }, select: { type: true } });
            if (parsed.data.isDefault && current) {
                await db.contractTemplate.updateMany({ where: { type: current.type, id: { not: id } }, data: { isDefault: false } });
            }
            const data = await db.contractTemplate.update({ where: { id }, data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:contractTemplates:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contractTemplates:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            await (0, db_service_1.getDb)().contractTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:contractTemplates:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Modèles de bulletins de paie ──────────────────────────── */
    const payslipTplSchema = zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        layout: zod_1.z.enum(['MODELE_1', 'MODELE_2', 'MODELE_3']).optional(),
        headerHtml: zod_1.z.string().nullable().optional(),
        footerHtml: zod_1.z.string().nullable().optional(),
        accentColor: zod_1.z.string().optional(),
        isDefault: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:payslipTemplates:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const data = await (0, db_service_1.getDb)().payslipTemplate.findMany({ orderBy: { id: 'asc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:payslipTemplates:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:payslipTemplates:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const parsed = payslipTplSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const db = (0, db_service_1.getDb)();
            if (parsed.data.isDefault) {
                await db.payslipTemplate.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
            }
            const data = await db.payslipTemplate.update({ where: { id }, data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:payslipTemplates:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Congés & absences ─────────────────────────────────────── */
    const leaveRequestSchema = zod_1.z.object({
        employeeId: zod_1.z.coerce.number().int().positive('Employé requis'),
        typeId: zod_1.z.coerce.number().int().positive('Type de congé requis'),
        startDate: zod_1.z.coerce.date({ message: 'Date de début requise' }),
        endDate: zod_1.z.coerce.date({ message: 'Date de fin requise' }),
        days: zod_1.z.coerce.number().positive().optional(),
        reason: zod_1.z.string().optional().nullable(),
    });
    async function nextLeaveReference(db) {
        const year = new Date().getFullYear();
        const last = await db.leaveRequest.findFirst({
            where: { reference: { startsWith: `CGE-${year}-` } },
            orderBy: { reference: 'desc' },
            select: { reference: true },
        });
        const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
        return `CGE-${year}-${String(seq).padStart(4, '0')}`;
    }
    electron_1.ipcMain.handle('hr:leaveTypes:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const data = await (0, db_service_1.getDb)().leaveType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:leaveTypes:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:leave:balance', async (_event, { token, employeeId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const balance = await (0, leave_service_1.computeLeaveBalance)(Number(employeeId));
            return { success: true, data: balance };
        }
        catch (error) {
            logger_1.default.error('hr:leave:balance error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:leaveRequests:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.employeeId)
                where.employeeId = Number(filters.employeeId);
            if (filters.status)
                where.status = filters.status;
            if (filters.typeId)
                where.typeId = Number(filters.typeId);
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
        }
        catch (error) {
            logger_1.default.error('hr:leaveRequests:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:leaveRequests:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            const parsed = leaveRequestSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const d = parsed.data;
            if (d.endDate < d.startDate)
                return { success: false, error: 'La date de fin doit être postérieure à la date de début.' };
            const db = (0, db_service_1.getDb)();
            const days = d.days != null && d.days > 0 ? d.days : (0, leave_service_1.workingDays)(d.startDate, d.endDate);
            if (!(days > 0))
                return { success: false, error: 'Le nombre de jours doit être supérieur à 0.' };
            const reference = await nextLeaveReference(db);
            const data = await db.leaveRequest.create({
                data: {
                    reference, employeeId: d.employeeId, typeId: d.typeId,
                    startDate: d.startDate, endDate: d.endDate, days: days,
                    reason: d.reason ?? null,
                },
            });
            logger_1.default.info(`Demande de congé créée : ${reference}`);
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:leaveRequests:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:leaveRequests:decide', async (_event, { token, id, status, note }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            if (!['APPROUVE', 'REFUSE', 'ANNULE', 'EN_ATTENTE'].includes(status)) {
                return { success: false, error: 'Statut invalide' };
            }
            const db = (0, db_service_1.getDb)();
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
            logger_1.default.info(`Demande de congé ${id} → ${status}`);
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:leaveRequests:decide error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:leaveRequests:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            await (0, db_service_1.getDb)().leaveRequest.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:leaveRequests:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Pointage / heures ─────────────────────────────────────── */
    const attendanceRowSchema = zod_1.z.object({
        employeeId: zod_1.z.coerce.number().int().positive(),
        date: zod_1.z.string().min(1), // 'YYYY-MM-DD'
        status: zod_1.z.enum(['PRESENT', 'ABSENT', 'CONGE', 'REPOS', 'FERIE', 'MALADIE']),
        hoursWorked: zod_1.z.coerce.number().nonnegative().optional(),
        overtimeHours: zod_1.z.coerce.number().nonnegative().optional(),
        notes: zod_1.z.string().optional().nullable(),
    });
    electron_1.ipcMain.handle('hr:attendance:list', async (_event, { token, employeeId, year, month }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const start = new Date(Number(year), Number(month) - 1, 1);
            const end = new Date(Number(year), Number(month), 1);
            const data = await db.attendanceRecord.findMany({
                where: { employeeId: Number(employeeId), date: { gte: start, lt: end } },
                orderBy: { date: 'asc' },
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:attendance:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:attendance:summary', async (_event, { token, employeeId, year, month }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_READ_ROLES);
            const data = await (0, attendance_service_1.attendanceMonthSummary)(Number(employeeId), Number(year), Number(month));
            return { success: true, data };
        }
        catch (error) {
            logger_1.default.error('hr:attendance:summary error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:attendance:bulkUpsert', async (_event, { token, records }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, HR_WRITE_ROLES);
            if (!Array.isArray(records))
                return { success: false, error: 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            let saved = 0;
            for (const raw of records) {
                const parsed = attendanceRowSchema.safeParse(raw);
                if (!parsed.success)
                    continue;
                const r = parsed.data;
                const date = new Date(`${r.date}T00:00:00.000Z`);
                const payload = {
                    status: r.status,
                    hoursWorked: (r.hoursWorked ?? 0),
                    overtimeHours: (r.overtimeHours ?? 0),
                    notes: r.notes ?? null,
                };
                await db.attendanceRecord.upsert({
                    where: { employeeId_date: { employeeId: r.employeeId, date } },
                    create: { employeeId: r.employeeId, date, ...payload },
                    update: payload,
                });
                saved += 1;
            }
            logger_1.default.info(`Pointage : ${saved} journée(s) enregistrée(s)`);
            return { success: true, data: { saved } };
        }
        catch (error) {
            logger_1.default.error('hr:attendance:bulkUpsert error', error.message);
            return { success: false, error: error.message };
        }
    });
}
