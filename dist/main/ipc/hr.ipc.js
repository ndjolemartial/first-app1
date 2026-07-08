"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHrIPC = registerHrIPC;
exports.seedJobPositionsFromEmployees = seedJobPositionsFromEmployees;
exports.seedDepartmentsFromEmployees = seedDepartmentsFromEmployees;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const pdf_service_1 = require("../services/pdf.service");
const contract_template_service_1 = require("../services/contract-template.service");
const commission_service_1 = require("../services/commission.service");
const payroll_service_1 = require("../services/payroll.service");
const hr_templates_service_1 = require("../services/hr-templates.service");
const leave_service_1 = require("../services/leave.service");
const attendance_service_1 = require("../services/attendance.service");
const treasury_service_1 = require("../services/treasury.service");
const settings_service_1 = require("../services/settings.service");
const storage_service_1 = require("../services/storage.service");
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
// Écritures opérationnelles (personnel, contrats, bulletins, congés) : admins +
// rôles restreints (ces derniers filtrés aux employés non-CDI).
const HR_OPERATIONAL_ROLES = [...HR_ADMIN_ROLES, ...HR_SCOPED_ROLES];
// Lecture : admins + rôles restreints (filtrés aux employés non-CDI).
const HR_READ_ROLES = [...HR_ADMIN_ROLES, ...HR_SCOPED_ROLES];
// Pointage : le Comptable (ACCOUNTANT) en est EXCLU, malgré son plein accès au
// reste du module RH & Paie. Écriture = admins / RH ; lecture = + MANAGER / AD.
const ATTENDANCE_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RH'];
const ATTENDANCE_READ_ROLES = [...ATTENDANCE_WRITE_ROLES, ...HR_SCOPED_ROLES];
// Personnel (détail/écritures), contrats et bulletins de paie : ASSISTANTE_DIRECTION
// en est EXCLUE (elle ne conserve que Congés & Pointage). Accès : admins, RH,
// Comptable et MANAGER. (La liste `employees:list` reste ouverte à AD car elle
// alimente les sélecteurs d'employés des pages Congés / Pointage.)
const HR_STAFF_READ_ROLES = [...HR_ADMIN_ROLES, 'MANAGER'];
const HR_STAFF_WRITE_ROLES = [...HR_ADMIN_ROLES, 'MANAGER'];
/**
 * Contrôle de rôle EXACT pour le module RH (n'applique pas les équivalences de
 * `checkRole`, afin que ACCOUNTANT — équivalent MANAGER — n'obtienne PAS l'accès
 * RH accordé à MANAGER / ASSISTANTE_DIRECTION).
 */
function checkHrRole(session, allowed) {
    if (!allowed.includes(session.role))
        throw new Error('Permission insuffisante');
}
const isScopedHr = (role) => HR_SCOPED_ROLES.includes(role);
const ser = (v) => JSON.parse(JSON.stringify(v));
/**
 * Identifiants des employés MASQUÉS aux rôles restreints : ceux dont le
 * « contrat en cours » est un CDI. Contrat en cours = contrat ACTIF le plus
 * récent (à défaut, le plus récent par date de début). Les employés sans
 * contrat restent accessibles (non-CDI par défaut).
 */
async function hrExcludedEmployeeIds(db) {
    const contracts = await db.employmentContract.findMany({
        where: { deletedAt: null },
        select: { employeeId: true, type: true, status: true, startDate: true },
    });
    const byEmp = new Map();
    for (const c of contracts) {
        const list = byEmp.get(c.employeeId) ?? [];
        list.push({ type: c.type, status: c.status, startDate: c.startDate });
        byEmp.set(c.employeeId, list);
    }
    const excluded = [];
    for (const [empId, list] of byEmp) {
        const actifs = list.filter((c) => c.status === 'ACTIF');
        const pool = actifs.length ? actifs : list;
        pool.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        if (pool[0]?.type === 'CDI')
            excluded.push(empId);
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
async function hrDefaultExcludedIds(session, db) {
    if (session.role === 'MANAGER')
        return hrEmployeeIdsByUserRoles(db, ['SUPER_ADMIN', 'ADMIN']);
    if (session.role === 'ASSISTANTE_DIRECTION')
        return hrExcludedEmployeeIds(db);
    return [];
}
/** Vérifie qu'un rôle restreint peut accéder à cet employé (périmètre par défaut). */
async function assertEmployeeAccessible(session, db, employeeId) {
    if (!isScopedHr(session.role) || employeeId == null)
        return;
    const excluded = await hrDefaultExcludedIds(session, db);
    if (excluded.includes(Number(employeeId))) {
        throw new Error('Accès restreint à cet employé.');
    }
}
/** Fragment `where` restreignant aux employés accessibles (par champ id d'employé). */
async function hrScopeWhere(session, db, field) {
    if (!isScopedHr(session.role))
        return {};
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
async function hrEmployeeIdsByUserRoles(db, roles) {
    const emps = await db.employee.findMany({
        where: { deletedAt: null, user: { is: { role: { in: roles } } } },
        select: { id: true },
    });
    return emps.map((e) => e.id);
}
/** Identifiants exclus pour le pointage / congés selon le rôle. */
async function hrExcludedAttendanceLeave(session, db) {
    if (session.role === 'ASSISTANTE_DIRECTION')
        return hrEmployeeIdsByUserRoles(db, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
    if (session.role === 'MANAGER')
        return hrEmployeeIdsByUserRoles(db, ['SUPER_ADMIN', 'ADMIN']);
    return [];
}
async function assertEmployeeAccessibleAL(session, db, employeeId) {
    if (!isScopedHr(session.role) || employeeId == null)
        return;
    const excluded = await hrExcludedAttendanceLeave(session, db);
    if (excluded.includes(Number(employeeId)))
        throw new Error('Accès restreint à cet employé.');
}
async function hrScopeWhereAL(session, db, field) {
    if (!isScopedHr(session.role))
        return {};
    const excluded = await hrExcludedAttendanceLeave(session, db);
    return excluded.length ? { [field]: { notIn: excluded } } : {};
}
/** Identifiant de l'employé lié au compte connecté (self-service), ou null. */
async function getMyEmployeeId(session, db) {
    if (session.userId == null)
        return null;
    const emp = await db.employee.findFirst({ where: { userId: session.userId, deletedAt: null }, select: { id: true } });
    return emp?.id ?? null;
}
/** Libellés de statut d'une demande de congé. */
const LEAVE_STATUS_FR = {
    EN_ATTENTE: 'En attente', APPROUVE: 'Approuvé', REFUSE: 'Refusé', ANNULE: 'Annulé',
};
/**
 * Fiche imprimable « Congés & Absence » : détails de la demande + blocs de
 * signatures (Le Demandeur, Le Responsable hiérarchique, Le Directeur Général).
 */
function renderLeaveRequestHtml(req, emp, company, logo, slogan) {
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
    const sigle = company?.name || 'AFRIKIMMO';
    // Coordonnées de l'entreprise (colonne de droite de l'en-tête) : contact + adresse.
    const infoLines = [
        company?.phone ? `Tél : ${company.phone}` : '',
        ...(company?.address ? String(company.address).split(/\r?\n/) : []),
    ].filter(Boolean);
    const empName = `${emp?.lastName ?? ''} ${emp?.firstName ?? ''}`.trim() || '—';
    const matricule = emp?.matricule ? `${esc(emp.matricule)} — ` : '';
    const row = (label, value) => `<tr><td class="lbl">${esc(label)}</td><td class="val">${value}</td></tr>`;
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
const CIVILITE = ['MONSIEUR', 'MADAME', 'MADEMOISELLE'];
const MARITAL = ['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE', 'DIVORCE', 'VEUF'];
const SEXE = ['MASCULIN', 'FEMININ'];
const EMPLOYEE_STATUS = ['ACTIF', 'SUSPENDU', 'CONGE', 'SORTI'];
const CONTRACT_TYPE = ['CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE', 'ESSAI', 'AVENANT_CDD', 'RENOUVELLEMENT_ESSAI'];
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
    // Responsable hiérarchique (évaluateur au titre de la gestion de la performance).
    managerId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
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
    cmu: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    totalDeductions: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    transportAllowance: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    netSalary: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nonnegative().nullable().optional()),
    // Avenant CDD : contrat CDD initial amendé (requis pour le type AVENANT_CDD).
    parentContractId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    // Autorité responsable : employé signataire/responsable au titre du contrat.
    responsibleAuthorityId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    // Fonction de l'employé (référentiel paramétrable).
    functionId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    // Objectifs assignés (référentiel paramétrable).
    objectiveId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    // Commissions sur activité (instantané libellé + taux) auxquelles l'employé a droit.
    activityCommissions: zod_1.z
        .array(zod_1.z.object({
        key: zod_1.z.string().min(1),
        label: zod_1.z.string().min(1),
        rate: zod_1.z.coerce.number().min(0).max(100),
    }))
        .optional()
        .nullable(),
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
            checkHrRole(session, HR_READ_ROLES);
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
            checkHrRole(session, HR_STAFF_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const rows = await db.employee.groupBy({
                by: ['status'],
                where: { deletedAt: null, ...(await hrScopeWhere(session, db, 'id')) },
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
            checkHrRole(session, HR_STAFF_READ_ROLES);
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
            await assertEmployeeAccessible(session, db, id);
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
            checkHrRole(session, HR_STAFF_READ_ROLES);
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const parsed = employeeSchema.partial().safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            await assertEmployeeAccessible(session, db, id);
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await assertEmployeeAccessible(session, db, id);
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
    /**
     * Valide un avenant CDD : rattachement obligatoire à un contrat CDD existant
     * du même employé, date de fin requise, et **délai cumulé ≤ 2 ans** — la date
     * de fin de l'avenant ne doit pas dépasser 2 ans après le début du CDD initial.
     * Retourne un message d'erreur, ou `null` si l'avenant est valide.
     */
    async function validateAvenantCdd(db, args) {
        if (!args.parentContractId)
            return 'Un avenant CDD doit être rattaché à un contrat CDD existant.';
        if (args.selfId && args.parentContractId === args.selfId)
            return 'Un avenant ne peut être rattaché à lui-même.';
        if (!args.endDate)
            return 'Une date de fin est requise pour un avenant CDD.';
        const parent = await db.employmentContract.findFirst({
            where: { id: args.parentContractId, deletedAt: null },
        });
        if (!parent)
            return 'Contrat CDD initial introuvable.';
        if (parent.type !== 'CDD')
            return 'Le contrat à amender doit être un CDD.';
        if (parent.employeeId !== args.employeeId)
            return "Le contrat CDD initial n'appartient pas à cet employé.";
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
    const durationDays = (start, end) => Math.round((end.getTime() - start.getTime()) / DAY_MS);
    /** Vérifie qu'un CDD ne dépasse pas 2 ans (24 mois). Retourne un message ou null. */
    function cddDurationError(startDate, endDate) {
        if (!startDate || !endDate)
            return null; // l'exigence de date de fin est traitée à part
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
    async function validateRenouvellementEssai(db, args) {
        if (!args.parentContractId)
            return "Une lettre de renouvellement d'essai doit être rattachée à un contrat ESSAI existant.";
        if (args.selfId && args.parentContractId === args.selfId)
            return 'Un renouvellement ne peut être rattaché à lui-même.';
        if (!args.startDate || !args.endDate)
            return 'Les dates de début et de fin sont requises pour un renouvellement d\'essai.';
        const parent = await db.employmentContract.findFirst({
            where: { id: args.parentContractId, deletedAt: null },
        });
        if (!parent)
            return 'Contrat ESSAI initial introuvable.';
        if (parent.type !== 'ESSAI')
            return 'Le contrat à renouveler doit être un contrat ESSAI.';
        if (parent.employeeId !== args.employeeId)
            return "Le contrat ESSAI initial n'appartient pas à cet employé.";
        // La durée de l'essai initial est portée par sa fin de période d'essai
        // (repli sur la date de fin pour les enregistrements antérieurs).
        const parentEnd = parent.trialEndDate ?? parent.endDate;
        if (!parentEnd)
            return "L'essai initial n'a pas de fin de période d'essai : impossible de déterminer sa durée.";
        const initialDuration = durationDays(parent.startDate, parentEnd);
        const renewalDuration = durationDays(args.startDate, args.endDate);
        // Tolérance d'un jour (bornes incluses/exclues selon la saisie).
        if (Math.abs(renewalDuration - initialDuration) > 1) {
            return `La lettre de renouvellement doit avoir la même durée que l'essai initial (${initialDuration} jour(s)).`;
        }
        return null;
    }
    electron_1.ipcMain.handle('hr:contracts:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const parsed = contractSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const employee = await db.employee.findFirst({ where: { id: d.employeeId, deletedAt: null } });
            if (!employee)
                return { success: false, error: 'Employé introuvable' };
            await assertEmployeeAccessible(session, db, d.employeeId);
            if (d.type === 'AVENANT_CDD') {
                const err = await validateAvenantCdd(db, {
                    employeeId: d.employeeId, parentContractId: d.parentContractId, endDate: d.endDate ?? null,
                });
                if (err)
                    return { success: false, error: err };
            }
            else if (d.type === 'RENOUVELLEMENT_ESSAI') {
                const err = await validateRenouvellementEssai(db, {
                    employeeId: d.employeeId, parentContractId: d.parentContractId,
                    startDate: d.startDate ?? null, endDate: d.endDate ?? null,
                });
                if (err)
                    return { success: false, error: err };
            }
            else {
                // Seuls l'avenant CDD et le renouvellement d'essai portent un parent.
                d.parentContractId = null;
                if (['CDD', 'STAGE', 'INTERIM'].includes(d.type) && !d.endDate) {
                    return { success: false, error: 'Une date de fin est requise pour un contrat à durée déterminée.' };
                }
                if (d.type === 'CDD') {
                    const err = cddDurationError(d.startDate, d.endDate);
                    if (err)
                        return { success: false, error: err };
                }
            }
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const parsed = contractSchema.partial().safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const existing = await db.employmentContract.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Contrat introuvable' };
            await assertEmployeeAccessible(session, db, existing.employeeId);
            const data = { ...parsed.data };
            delete data.employeeId; // le rattachement ne change pas après création
            const effType = data.type ?? existing.type;
            if (effType === 'AVENANT_CDD') {
                const parentContractId = data.parentContractId !== undefined ? data.parentContractId : existing.parentContractId;
                const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
                const err = await validateAvenantCdd(db, {
                    employeeId: existing.employeeId, parentContractId, endDate, selfId: id,
                });
                if (err)
                    return { success: false, error: err };
            }
            else if (effType === 'RENOUVELLEMENT_ESSAI') {
                const parentContractId = data.parentContractId !== undefined ? data.parentContractId : existing.parentContractId;
                const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
                const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
                const err = await validateRenouvellementEssai(db, {
                    employeeId: existing.employeeId, parentContractId, startDate, endDate, selfId: id,
                });
                if (err)
                    return { success: false, error: err };
            }
            else {
                data.parentContractId = null;
                if (effType === 'CDD') {
                    const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
                    const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
                    const err = cddDurationError(startDate, endDate);
                    if (err)
                        return { success: false, error: err };
                }
            }
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.employmentContract.findFirst({ where: { id, deletedAt: null }, select: { employeeId: true } });
            if (existing)
                await assertEmployeeAccessible(session, db, existing.employeeId);
            await db.employmentContract.update({ where: { id }, data: { deletedAt: new Date() } });
            logger_1.default.info(`Contrat archivé (soft delete) : id=${id}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:contracts:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Données de rendu d'un contrat (contrat + employé + entreprise). Le document
    // est ensuite assemblé et exporté côté renderer (zones + modèle éditable),
    // comme pour les conventions.
    electron_1.ipcMain.handle('hr:contracts:getRenderData', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_STAFF_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const contract = await db.employmentContract.findFirst({
                where: { id, deletedAt: null },
                include: { employee: true, parentContract: true, responsibleAuthority: true, fonction: true, objective: true },
            });
            if (!contract || !contract.employee)
                return { success: false, error: 'Contrat introuvable' };
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
                contract.avenantNumber = idx >= 0 ? idx + 1 : siblings.length;
            }
            const company = await (0, contract_template_service_1.loadContractCompany)();
            return ser({ success: true, data: { contract, employee: contract.employee, company } });
        }
        catch (error) {
            logger_1.default.error('hr:contracts:getRenderData error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Catalogue des lignes de « commissions sur activité » proposées sur un contrat.
    // Le taux par défaut réutilise les taux de commission paramétrés (vente/location/
    // dossier) ; « Constructions et ouvrages » a un taux par défaut fixe de 10 %.
    electron_1.ipcMain.handle('hr:commissionActivities:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_STAFF_READ_ROLES);
            const rates = await (0, commission_service_1.getDefaultRates)((0, db_service_1.getDb)());
            const data = [
                { key: 'VENTE', label: 'Vente', defaultRate: rates.saleRate },
                { key: 'LOCATION', label: 'Location', defaultRate: rates.rentalRate },
                { key: 'SOUSCRIPTION', label: 'Souscription', defaultRate: rates.saleRate },
                { key: 'FRAIS_DOSSIER', label: 'Frais de dossier', defaultRate: rates.dossierRate },
                { key: 'FRAIS_DEMARCHES_ACD', label: 'Frais de démarches ACD', defaultRate: rates.dossierRate },
                { key: 'CONSTRUCTIONS_OUVRAGES', label: 'Prestations diverses', defaultRate: 10 },
            ];
            return { success: true, data };
        }
        catch (error) {
            logger_1.default.error('hr:commissionActivities:list error', error.message);
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
            checkHrRole(session, HR_STAFF_READ_ROLES);
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
            // Rôles restreints : uniquement les bulletins des employés non-CDI.
            const scope = await hrScopeWhere(session, db, 'employeeId');
            if (scope.employeeId)
                (where.AND ??= []).push({ employeeId: scope.employeeId });
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
            checkHrRole(session, HR_STAFF_READ_ROLES);
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
            await assertEmployeeAccessible(session, db, payslip.employeeId);
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const parsed = generateSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            await assertEmployeeAccessible(session, db, d.employeeId);
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
            // Ancienneté figée à la fin de la période de paie (et non à la date du jour).
            const periodEnd = new Date(d.periodYear, d.periodMonth, 0);
            const prime = (0, payroll_service_1.computePrimeAnciennete)(Number(contract.baseSalary), employee.hireDate, periodEnd);
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const parsed = payslipEditSchema.safeParse(payload);
            if (!parsed.success) {
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            }
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const payslip = await db.payslip.findFirst({ where: { id, deletedAt: null } });
            if (!payslip)
                return { success: false, error: 'Bulletin introuvable' };
            await assertEmployeeAccessible(session, db, payslip.employeeId);
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
            // Ancienneté figée à la fin de la période de paie (et non à la date du jour).
            const periodEnd = new Date(payslip.periodYear, payslip.periodMonth, 0);
            const prime = (0, payroll_service_1.computePrimeAnciennete)(Number(contract.baseSalary), employee.hireDate, periodEnd);
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
            checkHrRole(session, HR_STAFF_READ_ROLES);
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
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
            await assertEmployeeAccessible(session, db, current.employeeId);
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
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
            await assertEmployeeAccessible(session, db, payslip.employeeId);
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
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const current = await db.payslip.findFirst({ where: { id, deletedAt: null }, select: { employeeId: true } });
            if (current)
                await assertEmployeeAccessible(session, db, current.employeeId);
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
            checkHrRole(session, HR_STAFF_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const payslip = await db.payslip.findFirst({
                where: { id, deletedAt: null },
                include: { employee: true, contract: { select: { poste: true, categorie: true, startDate: true } }, lines: { orderBy: { order: 'asc' } } },
            });
            if (!payslip || !payslip.employee)
                return { success: false, error: 'Bulletin introuvable' };
            await assertEmployeeAccessible(session, db, payslip.employeeId);
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
            checkHrRole(session, HR_READ_ROLES);
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
            checkHrRole(session, HR_WRITE_ROLES);
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
    const bgColor = zod_1.z.preprocess((v) => (v === '' || v === null ? null : v), zod_1.z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/, 'Couleur invalide').nullable().optional());
    const contractTplSchema = zod_1.z.object({
        name: zod_1.z.string().min(1, 'Nom requis'),
        type: zod_1.z.enum(CONTRACT_TYPE),
        // En-tête monobloc (texte/image) — image insérée → 100 % de la largeur.
        header: zod_1.z.string().optional(),
        headerWidth: zod_1.z.number().int().min(20).max(100).default(100),
        headerHeight: zod_1.z.number().int().min(40).max(800).default(140),
        // Corps possiblement vide si tout est en zones.
        body: zod_1.z.string().default(''),
        footer: zod_1.z.string().optional(),
        footerWidth: zod_1.z.number().int().min(20).max(100).default(100),
        footerHeight: zod_1.z.number().int().min(40).max(800).default(140),
        footerBgColor: bgColor,
        endOfDocument: zod_1.z.string().optional(),
        endOfDocumentWidth: zod_1.z.number().int().min(20).max(100).default(100),
        endOfDocumentHeight: zod_1.z.number().int().min(40).max(800).default(140),
        endOfDocumentBgColor: bgColor,
        isDefault: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:contractTemplates:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Lecture ouverte à tout utilisateur authentifié : les modèles ne sont
            // que des mises en page (utilisées aussi par l'espace self-service pour
            // afficher son propre contrat). Aucune donnée personnelle.
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
            checkHrRole(session, HR_WRITE_ROLES);
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
            checkHrRole(session, HR_WRITE_ROLES);
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
            checkHrRole(session, HR_WRITE_ROLES);
            await (0, db_service_1.getDb)().contractTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:contractTemplates:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Catégories socio-professionnelles & délais d'essai ─────── */
    const essaiCategorySchema = zod_1.z.object({
        label: zod_1.z.string().min(1, 'Libellé requis'),
        durationValue: zod_1.z.coerce.number().int().positive('Durée invalide'),
        durationUnit: zod_1.z.enum(['JOURS', 'MOIS']).default('MOIS'),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:essaiCategories:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().essaiCategory.findMany({ where, orderBy: { label: 'asc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:essaiCategories:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:essaiCategories:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_WRITE_ROLES);
            const parsed = essaiCategorySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const data = await (0, db_service_1.getDb)().essaiCategory.create({ data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            if (error.code === 'P2002')
                return { success: false, error: 'Cette catégorie existe déjà' };
            logger_1.default.error('hr:essaiCategories:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:essaiCategories:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_WRITE_ROLES);
            const parsed = essaiCategorySchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const data = await (0, db_service_1.getDb)().essaiCategory.update({ where: { id }, data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            if (error.code === 'P2002')
                return { success: false, error: 'Cette catégorie existe déjà' };
            logger_1.default.error('hr:essaiCategories:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:essaiCategories:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_WRITE_ROLES);
            await (0, db_service_1.getDb)().essaiCategory.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:essaiCategories:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Fonctions de l'employé (référentiel) ──────────────────── */
    const contractFunctionSchema = zod_1.z.object({
        titre: zod_1.z.string().min(1, 'Titre requis'),
        contenu: zod_1.z.string().optional().default(''),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:contractFunctions:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().contractFunction.findMany({ where, orderBy: { titre: 'asc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:contractFunctions:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contractFunctions:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_WRITE_ROLES);
            const parsed = contractFunctionSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const data = await (0, db_service_1.getDb)().contractFunction.create({ data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:contractFunctions:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contractFunctions:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_WRITE_ROLES);
            const parsed = contractFunctionSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const data = await (0, db_service_1.getDb)().contractFunction.update({ where: { id }, data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:contractFunctions:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contractFunctions:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_WRITE_ROLES);
            await (0, db_service_1.getDb)().contractFunction.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:contractFunctions:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Postes / Fonctions (référentiel du champ « Poste ») ──────────────── */
    // Liste des postes utilisée par le sélecteur « Poste » de la fiche employé.
    // Lecture : rôles ayant accès au module RH. Écriture : rôles habilités à créer
    // un employé (admins / RH / MANAGER) — création à la volée depuis le formulaire.
    const jobPositionSchema = zod_1.z.object({
        label: zod_1.z.string().min(1, 'Libellé requis'),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:jobPositions:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().jobPosition.findMany({ where, orderBy: { label: 'asc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:jobPositions:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:jobPositions:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const parsed = jobPositionSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const label = parsed.data.label.trim();
            // Réactive un poste homonyme précédemment supprimé plutôt que d'échouer sur l'unicité.
            const existing = await (0, db_service_1.getDb)().jobPosition.findUnique({ where: { label } });
            if (existing) {
                const data = await (0, db_service_1.getDb)().jobPosition.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
                return ser({ success: true, data });
            }
            const data = await (0, db_service_1.getDb)().jobPosition.create({ data: { label, isActive: parsed.data.isActive ?? true } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:jobPositions:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:jobPositions:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const parsed = jobPositionSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const data = { ...parsed.data };
            if (typeof data.label === 'string')
                data.label = data.label.trim();
            const updated = await (0, db_service_1.getDb)().jobPosition.update({ where: { id }, data });
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('hr:jobPositions:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:jobPositions:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            await (0, db_service_1.getDb)().jobPosition.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:jobPositions:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Départements / Services (référentiel du champ « Département ») ────── */
    const departmentSchema = zod_1.z.object({
        label: zod_1.z.string().min(1, 'Libellé requis'),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:departments:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().department.findMany({ where, orderBy: { label: 'asc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:departments:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:departments:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const parsed = departmentSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const label = parsed.data.label.trim();
            const existing = await (0, db_service_1.getDb)().department.findUnique({ where: { label } });
            if (existing) {
                const data = await (0, db_service_1.getDb)().department.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
                return ser({ success: true, data });
            }
            const data = await (0, db_service_1.getDb)().department.create({ data: { label, isActive: parsed.data.isActive ?? true } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:departments:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:departments:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            const parsed = departmentSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const data = { ...parsed.data };
            if (typeof data.label === 'string')
                data.label = data.label.trim();
            const updated = await (0, db_service_1.getDb)().department.update({ where: { id }, data });
            return ser({ success: true, data: updated });
        }
        catch (error) {
            logger_1.default.error('hr:departments:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:departments:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_STAFF_WRITE_ROLES);
            await (0, db_service_1.getDb)().department.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:departments:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Objectifs assignés (référentiel — même principe que les fonctions) ── */
    // Écriture des objectifs assignés : admins/RH + MANAGER (contrairement aux
    // autres configurations RH, réservées aux admins/RH). Test de rôle exact.
    const OBJECTIVE_WRITE_ROLES = [...HR_WRITE_ROLES, 'MANAGER'];
    const contractObjectiveSchema = zod_1.z.object({
        titre: zod_1.z.string().min(1, 'Titre requis'),
        contenu: zod_1.z.string().optional().default(''),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:contractObjectives:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await (0, db_service_1.getDb)().contractObjective.findMany({ where, orderBy: { titre: 'asc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:contractObjectives:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contractObjectives:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, OBJECTIVE_WRITE_ROLES);
            const parsed = contractObjectiveSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const data = await (0, db_service_1.getDb)().contractObjective.create({ data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:contractObjectives:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contractObjectives:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, OBJECTIVE_WRITE_ROLES);
            const parsed = contractObjectiveSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const data = await (0, db_service_1.getDb)().contractObjective.update({ where: { id }, data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:contractObjectives:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:contractObjectives:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, OBJECTIVE_WRITE_ROLES);
            await (0, db_service_1.getDb)().contractObjective.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:contractObjectives:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Modèles de fiche de poste ─────────────────────────────── */
    const jobDescTplSchema = zod_1.z.object({
        name: zod_1.z.string().min(1, 'Nom requis'),
        header: zod_1.z.string().optional(),
        headerWidth: zod_1.z.number().int().min(20).max(100).default(100),
        headerHeight: zod_1.z.number().int().min(40).max(800).default(140),
        body: zod_1.z.string().default(''),
        footer: zod_1.z.string().optional(),
        footerWidth: zod_1.z.number().int().min(20).max(100).default(100),
        footerHeight: zod_1.z.number().int().min(40).max(800).default(140),
        footerBgColor: bgColor,
        endOfDocument: zod_1.z.string().optional(),
        endOfDocumentWidth: zod_1.z.number().int().min(20).max(100).default(100),
        endOfDocumentHeight: zod_1.z.number().int().min(40).max(800).default(140),
        endOfDocumentBgColor: bgColor,
        isDefault: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    electron_1.ipcMain.handle('hr:jobDescriptionTemplates:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Lecture ouverte à tout utilisateur authentifié (mise en page uniquement ;
            // réutilisée par l'espace self-service pour la fiche de poste personnelle).
            const data = await (0, db_service_1.getDb)().jobDescriptionTemplate.findMany({
                where: { deletedAt: null },
                orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:jobDescriptionTemplates:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:jobDescriptionTemplates:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_WRITE_ROLES);
            const parsed = jobDescTplSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const db = (0, db_service_1.getDb)();
            if (parsed.data.isDefault)
                await db.jobDescriptionTemplate.updateMany({ where: { deletedAt: null }, data: { isDefault: false } });
            const data = await db.jobDescriptionTemplate.create({ data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:jobDescriptionTemplates:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:jobDescriptionTemplates:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_WRITE_ROLES);
            const parsed = jobDescTplSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const db = (0, db_service_1.getDb)();
            if (parsed.data.isDefault)
                await db.jobDescriptionTemplate.updateMany({ where: { deletedAt: null, id: { not: id } }, data: { isDefault: false } });
            const data = await db.jobDescriptionTemplate.update({ where: { id }, data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:jobDescriptionTemplates:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:jobDescriptionTemplates:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_WRITE_ROLES);
            await (0, db_service_1.getDb)().jobDescriptionTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:jobDescriptionTemplates:delete error', error.message);
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
            checkHrRole(session, HR_READ_ROLES);
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
            checkHrRole(session, HR_WRITE_ROLES);
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
            checkHrRole(session, HR_READ_ROLES);
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
            checkHrRole(session, HR_READ_ROLES);
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
            checkHrRole(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.employeeId)
                where.employeeId = Number(filters.employeeId);
            if (filters.status)
                where.status = filters.status;
            if (filters.typeId)
                where.typeId = Number(filters.typeId);
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
            checkHrRole(session, HR_OPERATIONAL_ROLES);
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
            checkHrRole(session, HR_OPERATIONAL_ROLES);
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
            checkHrRole(session, HR_OPERATIONAL_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.leaveRequest.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:leaveRequests:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Fiche imprimable « Congés & Absence » (détails + signatures).
    electron_1.ipcMain.handle('hr:leaveRequests:print', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const request = await db.leaveRequest.findFirst({
                where: { id, deletedAt: null },
                include: {
                    employee: { select: { id: true, matricule: true, firstName: true, lastName: true, poste: true, city: true } },
                    type: { select: { name: true } },
                },
            });
            if (!request || !request.employee)
                return { success: false, error: 'Demande introuvable' };
            const company = await (0, contract_template_service_1.loadContractCompany)();
            const logo = await (0, payroll_service_1.loadPayslipLogo)();
            const slogan = (await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.companySlogan)) ?? '';
            const html = renderLeaveRequestHtml(request, request.employee, company, logo, slogan);
            const pdf = await (0, pdf_service_1.htmlToPdf)(html, { landscape: false });
            await (0, pdf_service_1.openPrintPreview)(pdf, `Congé ${request.reference}`);
            logger_1.default.info(`Aperçu impression congé : ${request.reference}`);
            return { success: true, data: { previewing: true } };
        }
        catch (error) {
            logger_1.default.error('hr:leaveRequests:print error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Fiche « Congés & Absence » signée (scannée) jointe après validation ──────
    const LEAVE_SIGNED_MAX = 40 * 1024 * 1024;
    const leaveSignedSchema = zod_1.z.object({
        id: zod_1.z.coerce.number().int().positive(),
        name: zod_1.z.string().min(1),
        type: zod_1.z.string().min(1),
        size: zod_1.z.number().int().positive(),
        dataBase64: zod_1.z.string().min(1),
    });
    electron_1.ipcMain.handle('hr:leaveRequests:uploadSigned', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_OPERATIONAL_ROLES);
            const parsed = leaveSignedSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const d = parsed.data;
            if (d.size > LEAVE_SIGNED_MAX)
                return { success: false, error: `Fichier trop volumineux (max ${Math.round(LEAVE_SIGNED_MAX / 1024 / 1024)} Mo).` };
            const db = (0, db_service_1.getDb)();
            const req = await db.leaveRequest.findFirst({ where: { id: d.id, deletedAt: null } });
            if (!req)
                return { success: false, error: 'Demande introuvable' };
            if (req.status !== 'APPROUVE') {
                return { success: false, error: 'La fiche signée ne peut être jointe qu\'après validation de la demande.' };
            }
            const buf = Buffer.from(d.dataBase64, 'base64');
            if (buf.length === 0)
                return { success: false, error: 'Fichier vide ou invalide' };
            if (req.signedDocPath)
                (0, storage_service_1.removeStorageFile)(req.signedDocPath); // remplace l'éventuelle pièce jointe
            const { relativePath, size } = (0, storage_service_1.writeLeaveSignedDocument)(d.id, buf, d.name);
            const data = await db.leaveRequest.update({
                where: { id: d.id },
                data: { signedDocPath: relativePath, signedDocName: d.name, signedDocType: d.type, signedDocSize: size, signedDocAt: new Date() },
                select: { id: true, signedDocName: true, signedDocType: true, signedDocSize: true, signedDocAt: true },
            });
            logger_1.default.info(`Fiche de congé signée jointe : demande ${d.id}`);
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:leaveRequests:uploadSigned error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:leaveRequests:openSigned', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const req = await db.leaveRequest.findFirst({ where: { id, deletedAt: null }, select: { employeeId: true, signedDocPath: true } });
            if (!req || !req.signedDocPath)
                return { success: false, error: 'Aucune fiche signée jointe.' };
            const abs = (0, storage_service_1.resolveStoragePath)(req.signedDocPath);
            if (!fs_1.default.existsSync(abs))
                return { success: false, error: 'Fichier introuvable sur le disque' };
            const err = await electron_1.shell.openPath(abs);
            if (err)
                return { success: false, error: err };
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:leaveRequests:openSigned error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:leaveRequests:removeSigned', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_OPERATIONAL_ROLES);
            const db = (0, db_service_1.getDb)();
            const req = await db.leaveRequest.findFirst({ where: { id, deletedAt: null }, select: { employeeId: true, signedDocPath: true } });
            if (!req)
                return { success: false, error: 'Demande introuvable' };
            if (req.signedDocPath)
                (0, storage_service_1.removeStorageFile)(req.signedDocPath);
            await db.leaveRequest.update({
                where: { id },
                data: { signedDocPath: null, signedDocName: null, signedDocType: null, signedDocSize: null, signedDocAt: null },
            });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:leaveRequests:removeSigned error', error.message);
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
            checkHrRole(session, ATTENDANCE_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            await assertEmployeeAccessibleAL(session, db, Number(employeeId));
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
            checkHrRole(session, ATTENDANCE_READ_ROLES);
            await assertEmployeeAccessibleAL(session, (0, db_service_1.getDb)(), Number(employeeId));
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
            checkHrRole(session, ATTENDANCE_WRITE_ROLES);
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
    /* ─── Self-service : « Mon espace RH & Paie » (lecture seule) ────
     * Accessible à TOUT utilisateur authentifié ; strictement limité à l'employé
     * lié à son compte (Employee.userId). Aucune écriture.
     */
    electron_1.ipcMain.handle('hr:me:overview', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
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
            if (!employee)
                return ser({ success: true, data: { employee: null, leaveBalance: null } });
            let leaveBalance = null;
            try {
                leaveBalance = await (0, leave_service_1.computeLeaveBalance)(employee.id);
            }
            catch { /* solde indisponible */ }
            return ser({ success: true, data: { employee, leaveBalance } });
        }
        catch (error) {
            logger_1.default.error('hr:me:overview error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:me:payslips', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            if (!myId)
                return ser({ success: true, data: [] });
            const data = await db.payslip.findMany({
                where: { employeeId: myId, deletedAt: null },
                orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { reference: 'desc' }],
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:me:payslips error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:me:payslip', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            const payslip = await db.payslip.findFirst({
                where: { id, deletedAt: null },
                include: {
                    employee: true,
                    contract: { select: { id: true, reference: true, poste: true, categorie: true, startDate: true } },
                    lines: { orderBy: { order: 'asc' } },
                },
            });
            if (!payslip || !myId || payslip.employeeId !== myId)
                return { success: false, error: 'Bulletin introuvable' };
            return ser({ success: true, data: payslip });
        }
        catch (error) {
            logger_1.default.error('hr:me:payslip error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:me:payslipPrint', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            const payslip = await db.payslip.findFirst({
                where: { id, deletedAt: null },
                include: { employee: true, contract: { select: { poste: true, categorie: true, startDate: true } }, lines: { orderBy: { order: 'asc' } } },
            });
            if (!payslip || !payslip.employee || !myId || payslip.employeeId !== myId)
                return { success: false, error: 'Bulletin introuvable' };
            const company = await (0, payroll_service_1.loadPayslipCompany)();
            const template = await (0, hr_templates_service_1.resolvePayslipTemplate)();
            const logo = await (0, payroll_service_1.loadPayslipLogo)();
            const counters = await (0, leave_service_1.computePayslipLeaveCounters)(payslip.employeeId, payslip.periodYear);
            const totals = await (0, payroll_service_1.computePayslipTotals)(payslip);
            const html = (0, payroll_service_1.renderPayslipHtml)(payslip, payslip.employee, company, template ?? undefined, logo, counters, totals);
            const pdf = await (0, pdf_service_1.htmlToPdf)(html, { landscape: false });
            await (0, pdf_service_1.openPrintPreview)(pdf, `Bulletin ${payslip.reference}`);
            return { success: true, data: { previewing: true } };
        }
        catch (error) {
            logger_1.default.error('hr:me:payslipPrint error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:me:attendance', async (_event, { token, year, month }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            if (!myId)
                return ser({ success: true, data: [] });
            const start = new Date(Number(year), Number(month) - 1, 1);
            const end = new Date(Number(year), Number(month), 1);
            const data = await db.attendanceRecord.findMany({
                where: { employeeId: myId, date: { gte: start, lt: end } },
                orderBy: { date: 'asc' },
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:me:attendance error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:me:leaveRequests', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            if (!myId)
                return ser({ success: true, data: [] });
            const data = await db.leaveRequest.findMany({
                where: { employeeId: myId, deletedAt: null },
                orderBy: { startDate: 'desc' },
                include: { type: { select: { id: true, name: true, color: true, isPaid: true } } },
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:me:leaveRequests error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:me:contractRenderData', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            const contract = await db.employmentContract.findFirst({
                where: { id, deletedAt: null },
                include: { employee: true, parentContract: true, responsibleAuthority: true, fonction: true, objective: true },
            });
            if (!contract || !contract.employee || !myId || contract.employeeId !== myId)
                return { success: false, error: 'Contrat introuvable' };
            const company = await (0, contract_template_service_1.loadContractCompany)();
            return ser({ success: true, data: { contract, employee: contract.employee, company } });
        }
        catch (error) {
            logger_1.default.error('hr:me:contractRenderData error', error.message);
            return { success: false, error: error.message };
        }
    });
    /**
     * Règlement intérieur : document GED ciblé par l'admin (Paramètres). Renvoyé
     * à tout utilisateur authentifié pour consultation / impression (lecture seule).
     */
    electron_1.ipcMain.handle('hr:me:reglementInterieur', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.hrReglementInterieurDocId);
            const id = raw ? Number(raw) : null;
            if (!id)
                return { success: true, data: { configured: false } };
            const doc = await (0, db_service_1.getDb)().document.findFirst({
                where: { id, deletedAt: null },
                select: { name: true, type: true, size: true, path: true },
            });
            if (!doc)
                return { success: true, data: { configured: false } };
            const MAX = 40 * 1024 * 1024;
            if (doc.size > MAX)
                return { success: true, data: { configured: true, tooLarge: true, name: doc.name, mimeType: doc.type } };
            const buf = (0, storage_service_1.readStorageFile)(doc.path);
            if (!buf)
                return { success: false, error: 'Fichier introuvable sur le disque' };
            return { success: true, data: { configured: true, name: doc.name, mimeType: doc.type, base64: buf.toString('base64') } };
        }
        catch (error) {
            logger_1.default.error('hr:me:reglementInterieur error', error.message);
            return { success: false, error: error.message };
        }
    });
    /**
     * Impression du règlement intérieur via la fenêtre d'aperçu intégrée (même
     * mécanisme fiable que les bulletins / contrats). PDF imprimé tel quel ; image
     * enveloppée dans un PDF ; autres formats non imprimables directement.
     */
    electron_1.ipcMain.handle('hr:me:reglementInterieurPrint', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.hrReglementInterieurDocId);
            const id = raw ? Number(raw) : null;
            if (!id)
                return { success: false, error: 'Aucun règlement intérieur défini.' };
            const doc = await (0, db_service_1.getDb)().document.findFirst({
                where: { id, deletedAt: null },
                select: { name: true, type: true, path: true },
            });
            if (!doc)
                return { success: false, error: 'Document introuvable' };
            const buf = (0, storage_service_1.readStorageFile)(doc.path);
            if (!buf)
                return { success: false, error: 'Fichier introuvable sur le disque' };
            let pdf;
            if (doc.type === 'application/pdf') {
                pdf = buf;
            }
            else if ((doc.type ?? '').startsWith('image/')) {
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0}img{max-width:100%;display:block;margin:0 auto}</style></head><body><img src="data:${doc.type};base64,${buf.toString('base64')}"></body></html>`;
                pdf = await (0, pdf_service_1.htmlToPdf)(html, { landscape: false });
            }
            else {
                return { success: false, error: 'Ce format ne peut pas être imprimé directement. Téléchargez le fichier.' };
            }
            await (0, pdf_service_1.openPrintPreview)(pdf, doc.name || 'Règlement intérieur');
            return { success: true, data: { previewing: true } };
        }
        catch (error) {
            logger_1.default.error('hr:me:reglementInterieurPrint error', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Contrats signés (fichiers téléversés par employé) ────────── */
    const SIGNED_MAX = 40 * 1024 * 1024;
    const signedUploadSchema = zod_1.z.object({
        employeeId: zod_1.z.coerce.number().int().positive(),
        name: zod_1.z.string().min(1),
        type: zod_1.z.string().min(1),
        size: zod_1.z.number().int().positive(),
        dataBase64: zod_1.z.string().min(1),
    });
    electron_1.ipcMain.handle('hr:signedContracts:list', async (_event, { token, employeeId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            await assertEmployeeAccessible(session, db, Number(employeeId));
            const data = await db.employeeSignedContract.findMany({
                where: { employeeId: Number(employeeId), deletedAt: null },
                orderBy: { uploadedAt: 'desc' },
                select: { id: true, name: true, type: true, size: true, uploadedAt: true },
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:signedContracts:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:signedContracts:upload', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_OPERATIONAL_ROLES);
            const parsed = signedUploadSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const d = parsed.data;
            if (d.size > SIGNED_MAX)
                return { success: false, error: `Fichier trop volumineux (max ${Math.round(SIGNED_MAX / 1024 / 1024)} Mo).` };
            const db = (0, db_service_1.getDb)();
            await assertEmployeeAccessible(session, db, d.employeeId);
            const emp = await db.employee.findFirst({ where: { id: d.employeeId, deletedAt: null }, select: { id: true } });
            if (!emp)
                return { success: false, error: 'Employé introuvable' };
            const buf = Buffer.from(d.dataBase64, 'base64');
            if (buf.length === 0)
                return { success: false, error: 'Fichier vide ou invalide' };
            const { relativePath, size } = (0, storage_service_1.writeEmployeeSignedContract)(d.employeeId, buf, d.name);
            const data = await db.employeeSignedContract.create({
                data: { employeeId: d.employeeId, name: d.name, type: d.type, path: relativePath, size, uploadedById: session.userId ?? null },
                select: { id: true, name: true, type: true, size: true, uploadedAt: true },
            });
            logger_1.default.info(`Contrat signé téléversé : ${d.name} (employé ${d.employeeId})`);
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:signedContracts:upload error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:signedContracts:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_OPERATIONAL_ROLES);
            const db = (0, db_service_1.getDb)();
            const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
            if (!rec)
                return { success: false, error: 'Contrat signé introuvable' };
            await assertEmployeeAccessible(session, db, rec.employeeId);
            (0, storage_service_1.removeStorageFile)(rec.path);
            await db.employeeSignedContract.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:signedContracts:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:signedContracts:fileData', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
            if (!rec)
                return { success: false, error: 'Contrat signé introuvable' };
            await assertEmployeeAccessible(session, db, rec.employeeId);
            if (rec.size > SIGNED_MAX)
                return { success: true, data: { tooLarge: true, name: rec.name, mimeType: rec.type } };
            const buf = (0, storage_service_1.readStorageFile)(rec.path);
            if (!buf)
                return { success: false, error: 'Fichier introuvable sur le disque' };
            return { success: true, data: { name: rec.name, mimeType: rec.type, base64: buf.toString('base64') } };
        }
        catch (error) {
            logger_1.default.error('hr:signedContracts:fileData error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:signedContracts:open', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkHrRole(session, HR_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
            if (!rec)
                return { success: false, error: 'Contrat signé introuvable' };
            await assertEmployeeAccessible(session, db, rec.employeeId);
            const abs = (0, storage_service_1.resolveStoragePath)(rec.path);
            if (!fs_1.default.existsSync(abs))
                return { success: false, error: 'Fichier introuvable sur le disque' };
            const err = await electron_1.shell.openPath(abs);
            if (err)
                return { success: false, error: err };
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:signedContracts:open error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Self-service : mes contrats signés (lecture seule).
    electron_1.ipcMain.handle('hr:me:signedContracts', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            if (!myId)
                return ser({ success: true, data: [] });
            const data = await db.employeeSignedContract.findMany({
                where: { employeeId: myId, deletedAt: null },
                orderBy: { uploadedAt: 'desc' },
                select: { id: true, name: true, type: true, size: true, uploadedAt: true },
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('hr:me:signedContracts error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:me:signedContractFile', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
            if (!rec || !myId || rec.employeeId !== myId)
                return { success: false, error: 'Contrat signé introuvable' };
            if (rec.size > SIGNED_MAX)
                return { success: true, data: { tooLarge: true, name: rec.name, mimeType: rec.type } };
            const buf = (0, storage_service_1.readStorageFile)(rec.path);
            if (!buf)
                return { success: false, error: 'Fichier introuvable sur le disque' };
            return { success: true, data: { name: rec.name, mimeType: rec.type, base64: buf.toString('base64') } };
        }
        catch (error) {
            logger_1.default.error('hr:me:signedContractFile error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('hr:me:signedContractOpen', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
            if (!rec || !myId || rec.employeeId !== myId)
                return { success: false, error: 'Contrat signé introuvable' };
            const abs = (0, storage_service_1.resolveStoragePath)(rec.path);
            if (!fs_1.default.existsSync(abs))
                return { success: false, error: 'Fichier introuvable sur le disque' };
            const err = await electron_1.shell.openPath(abs);
            if (err)
                return { success: false, error: err };
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('hr:me:signedContractOpen error', error.message);
            return { success: false, error: error.message };
        }
    });
    /** Impression d'un de mes contrats signés via la fenêtre d'aperçu native. */
    electron_1.ipcMain.handle('hr:me:signedContractPrint', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const myId = await getMyEmployeeId(session, db);
            const rec = await db.employeeSignedContract.findFirst({ where: { id, deletedAt: null } });
            if (!rec || !myId || rec.employeeId !== myId)
                return { success: false, error: 'Contrat signé introuvable' };
            const buf = (0, storage_service_1.readStorageFile)(rec.path);
            if (!buf)
                return { success: false, error: 'Fichier introuvable sur le disque' };
            let pdf;
            if (rec.type === 'application/pdf') {
                pdf = buf;
            }
            else if ((rec.type ?? '').startsWith('image/')) {
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0}img{max-width:100%;display:block;margin:0 auto}</style></head><body><img src="data:${rec.type};base64,${buf.toString('base64')}"></body></html>`;
                pdf = await (0, pdf_service_1.htmlToPdf)(html, { landscape: false });
            }
            else {
                return { success: false, error: 'Ce format ne peut pas être imprimé directement. Téléchargez le fichier.' };
            }
            await (0, pdf_service_1.openPrintPreview)(pdf, rec.name || 'Contrat signé');
            return { success: true, data: { previewing: true } };
        }
        catch (error) {
            logger_1.default.error('hr:me:signedContractPrint error', error.message);
            return { success: false, error: error.message };
        }
    });
}
/**
 * Amorce le référentiel des postes à partir des valeurs « poste » déjà saisies
 * sur les fiches employés (idempotent). Permet au sélecteur « Poste » de proposer
 * d'emblée les postes existants, sans écraser ni dupliquer.
 */
async function seedJobPositionsFromEmployees() {
    const db = (0, db_service_1.getDb)();
    const rows = await db.employee.findMany({
        where: { deletedAt: null, poste: { not: null } },
        select: { poste: true },
        distinct: ['poste'],
    });
    for (const r of rows) {
        const label = (r.poste ?? '').trim();
        if (!label)
            continue;
        const exists = await db.jobPosition.findUnique({ where: { label }, select: { id: true } });
        if (!exists)
            await db.jobPosition.create({ data: { label } });
    }
}
/**
 * Amorce le référentiel des départements/services à partir des valeurs déjà
 * saisies sur les fiches employés (idempotent).
 */
async function seedDepartmentsFromEmployees() {
    const db = (0, db_service_1.getDb)();
    const rows = await db.employee.findMany({
        where: { deletedAt: null, departement: { not: null } },
        select: { departement: true },
        distinct: ['departement'],
    });
    for (const r of rows) {
        const label = (r.departement ?? '').trim();
        if (!label)
            continue;
        const exists = await db.department.findUnique({ where: { label }, select: { id: true } });
        if (!exists)
            await db.department.create({ data: { label } });
    }
}
