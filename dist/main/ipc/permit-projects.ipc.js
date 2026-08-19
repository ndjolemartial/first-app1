"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMIT_CATEGORY_LABELS = void 0;
exports.registerPermitProjectsIPC = registerPermitProjectsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const permit_engine_service_1 = require("../services/permit-engine.service");
const quotes_ipc_1 = require("./quotes.ipc");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
/**
 * Projets & estimations du moteur de devis de permis de construire
 * (Module 18). Mêmes conventions de rôle que le Module 17 (Construction) :
 * création/génération/conversion réservées à la vue complète (SUPER_ADMIN,
 * ADMIN, MANAGER, ACCOUNTANT) ; les autres rôles disposant d'un accès au
 * module (AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, READONLY) sont en
 * lecture seule, limitée aux projets rattachés à un client ou un prospect
 * dont ils sont le référent commercial.
 */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const FULL_ACCESS = WRITE_ROLES;
const READ_ROLES = [...FULL_ACCESS, 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY'];
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
function scopeWhere(session) {
    if (FULL_ACCESS.includes(session.role))
        return {};
    return {
        OR: [
            { client: { is: { assignedToId: session.userId } } },
            { prospect: { is: { assignedToId: session.userId } } },
        ],
    };
}
async function canAccess(db, session, project) {
    if (FULL_ACCESS.includes(session.role))
        return true;
    if (!project.clientId && !project.prospectId)
        return false;
    const [client, prospect] = await Promise.all([
        project.clientId ? db.client.findUnique({ where: { id: project.clientId }, select: { assignedToId: true } }) : Promise.resolve(null),
        project.prospectId ? db.prospect.findUnique({ where: { id: project.prospectId }, select: { assignedToId: true } }) : Promise.resolve(null),
    ]);
    return client?.assignedToId === session.userId || prospect?.assignedToId === session.userId;
}
const ser = (v) => JSON.parse(JSON.stringify(v));
const dec = (v) => (v == null ? null : String(v));
const optionalNumber = (schema) => zod_1.z.preprocess((v) => (v === '' ? undefined : v), schema.nullable().optional());
const NATURES = ['VILLA', 'IMMEUBLE', 'COMMERCE', 'BUREAU', 'HOTEL', 'USINE', 'ENTREPOT'];
const STANDINGS = ['ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE'];
const ZONE_TYPES = ['URBAINE', 'RURALE'];
const MISSION_PHASES = ['ESQUISSE', 'APS', 'APD', 'PLANS_EXECUTION', 'SUIVI_CHANTIER', 'RECEPTION'];
exports.PERMIT_CATEGORY_LABELS = {
    ARCHITECTE: 'Honoraires Architecte',
    BET_STRUCTURE: 'BET Structure',
    BET_FLUIDES: 'BET Fluides',
    BET_ELECTRICITE: 'BET Électricité',
    BET_VRD: 'BET VRD',
    BET_GEOTECHNIQUE: 'BET Géotechnique',
    GEOMETRE: 'Géomètre',
    ETUDE_SOL: 'Étude de sol',
    ETUDE_HYDROLOGIE: 'Étude hydrologique',
    ETUDE_ENVIRONNEMENT: "Étude d'impact environnemental",
    ETUDE_INCENDIE: 'Étude sécurité incendie',
    FRAIS_ADMINISTRATIF: 'Frais administratifs',
    TAXE: 'Taxes',
};
const projectSchema = zod_1.z.object({
    nom: zod_1.z.string().min(1, 'Nom du projet requis'),
    clientId: zod_1.z.number().int().positive().nullable().optional(),
    prospectId: zod_1.z.number().int().positive().nullable().optional(),
    agentId: zod_1.z.number().int().positive().nullable().optional(),
    constructionProjectId: zod_1.z.number().int().positive().nullable().optional(),
    nature: zod_1.z.enum(NATURES),
    standing: zod_1.z.enum(STANDINGS).default('MOYEN_STANDING'),
    communeId: zod_1.z.number().int().positive().nullable().optional(),
    zoneType: zod_1.z.enum(ZONE_TYPES).nullable().optional(),
    terrainSurface: optionalNumber(zod_1.z.number().positive()),
    surfaceBatie: zod_1.z.number().positive(),
    levels: zod_1.z.number().int().min(1).default(1),
    hasSousSol: zod_1.z.boolean().default(false),
    nombreBatiments: zod_1.z.number().int().min(1).default(1),
    coutPrevisionnelTravaux: optionalNumber(zod_1.z.number().positive()),
    hasPiscine: zod_1.z.boolean().default(false),
    hasAscenseur: zod_1.z.boolean().default(false),
    hasGroupeElectrogene: zod_1.z.boolean().default(false),
    hasForage: zod_1.z.boolean().default(false),
    hasCloture: zod_1.z.boolean().default(false),
    hasVoirieInterieure: zod_1.z.boolean().default(false),
    missionPhases: zod_1.z.array(zod_1.z.enum(MISSION_PHASES)).default(['ESQUISSE', 'APS', 'APD', 'PLANS_EXECUTION']),
    description: zod_1.z.string().nullable().optional(),
    notes: zod_1.z.string().nullable().optional(),
});
const toQuoteSchema = zod_1.z.object({
    estimateId: zod_1.z.number().int().positive(),
    payload: zod_1.z.object({
        prospectId: zod_1.z.number().int().positive().nullable().optional(),
        clientId: zod_1.z.number().int().positive().nullable().optional(),
        agentId: zod_1.z.number().int().positive().nullable().optional(),
        objet: zod_1.z.string().nullable().optional(),
        validUntil: zod_1.z.string().nullable().optional(),
        taxRate: zod_1.z.number().min(0).default(0),
        templateId: zod_1.z.number().int().positive().nullable().optional(),
        referenceColumnLabel: zod_1.z.string().nullable().optional(),
    }),
});
/** Référence auto PRM-YYYY-NNNN (projets de permis). */
async function nextProjectReference(db) {
    const year = new Date().getFullYear();
    const last = await db.permitProject.findFirst({
        where: { reference: { startsWith: `PRM-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `PRM-${year}-${String(seq).padStart(4, '0')}`;
}
/** Référence auto PRE-YYYY-NNNN (estimations de permis). */
async function nextEstimateReference(db) {
    const year = new Date().getFullYear();
    const last = await db.permitEstimate.findFirst({
        where: { reference: { startsWith: `PRE-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `PRE-${year}-${String(seq).padStart(4, '0')}`;
}
/**
 * Coût prévisionnel des travaux par défaut lorsqu'un `ConstructionProject`
 * est rattaché et que l'utilisateur n'a pas renseigné le champ manuellement —
 * lu depuis la dernière estimation de construction (non obsolète), la plus
 * récente en version. Simple valeur de départ copiée dans le projet de
 * permis (pas de lien vivant) : reste modifiable ensuite indépendamment.
 */
async function resolveDefaultCout(db, constructionProjectId) {
    if (!constructionProjectId)
        return null;
    const estimate = await db.constructionEstimate.findFirst({
        where: { projectId: constructionProjectId, deletedAt: null, status: { not: 'OBSOLETE' } },
        orderBy: { version: 'desc' },
        select: { totalHT: true },
    });
    return estimate ? Number(estimate.totalHT) : null;
}
function projectDataFromPayload(d) {
    return {
        ...d,
        terrainSurface: d.terrainSurface != null ? dec(d.terrainSurface) : null,
        surfaceBatie: dec(d.surfaceBatie),
        coutPrevisionnelTravaux: d.coutPrevisionnelTravaux != null ? dec(d.coutPrevisionnelTravaux) : null,
    };
}
const PROJECT_INCLUDE = {
    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
    prospect: { select: { id: true, firstName: true, lastName: true } },
    agent: { select: { id: true, firstName: true, lastName: true } },
    commune: true,
    constructionProject: { select: { id: true, reference: true, nom: true } },
    _count: { select: { estimates: true } },
};
function registerPermitProjectsIPC() {
    // ── Projets ──────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('permits:projects:list', async (_event, { token, filters = {}, page = 1, limit = 50 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...scopeWhere(session) };
            if (filters.status)
                where.status = filters.status;
            if (filters.nature)
                where.nature = filters.nature;
            if (filters.standing)
                where.standing = filters.standing;
            if (filters.clientId)
                where.clientId = Number(filters.clientId);
            if (filters.prospectId)
                where.prospectId = Number(filters.prospectId);
            if (filters.search) {
                where.OR = [{ reference: { contains: filters.search } }, { nom: { contains: filters.search } }];
            }
            const [data, total] = await db.$transaction([
                db.permitProject.findMany({ where, include: PROJECT_INCLUDE, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
                db.permitProject.count({ where }),
            ]);
            return { success: true, data: ser(data), total };
        }
        catch (error) {
            logger_1.default.error('permits:projects:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:projects:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const project = await db.permitProject.findUnique({
                where: { id: Number(id) },
                include: { ...PROJECT_INCLUDE, estimates: { where: { deletedAt: null }, orderBy: { version: 'desc' } } },
            });
            if (!project || project.deletedAt)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, project)))
                return { success: false, error: 'Projet inaccessible' };
            return { success: true, data: ser(project) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:projects:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = projectSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const reference = await nextProjectReference(db);
            const d = parsed.data;
            if (d.coutPrevisionnelTravaux == null && d.constructionProjectId) {
                d.coutPrevisionnelTravaux = await resolveDefaultCout(db, d.constructionProjectId);
            }
            const data = await db.permitProject.create({
                data: { ...projectDataFromPayload(d), reference, createdById: session.userId },
                include: PROJECT_INCLUDE,
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('permits:projects:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:projects:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.permitProject.findUnique({ where: { id: Number(id) } });
            if (!existing || existing.deletedAt)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, existing)))
                return { success: false, error: 'Projet inaccessible' };
            const parsed = projectSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const data = await db.permitProject.update({
                where: { id: Number(id) },
                data: projectDataFromPayload(parsed.data),
                include: PROJECT_INCLUDE,
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('permits:projects:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:projects:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, DELETE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.permitProject.findUnique({ where: { id: Number(id) }, select: { clientId: true, prospectId: true, deletedAt: true } });
            if (!existing || existing.deletedAt)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, existing)))
                return { success: false, error: 'Projet inaccessible' };
            // Supprime en cascade les estimations générées pour ce projet et les
            // devis commerciaux (module Devis) qu'elles ont éventuellement créés —
            // PermitEstimate.quoteId est un scalaire sans FK (même principe que
            // ConstructionEstimate.quoteId) : sans ce rattrapage, ils resteraient
            // orphelins, rattachés à un projet supprimé et introuvables depuis
            // nulle part dans l'app.
            const now = new Date();
            const estimates = await db.permitEstimate.findMany({
                where: { projectId: Number(id), deletedAt: null },
                select: { id: true, quoteId: true },
            });
            const quoteIds = [...new Set(estimates.map((e) => e.quoteId).filter((qid) => qid != null))];
            await db.$transaction([
                db.permitProject.update({ where: { id: Number(id) }, data: { deletedAt: now } }),
                ...(estimates.length ? [db.permitEstimate.updateMany({ where: { id: { in: estimates.map((e) => e.id) } }, data: { deletedAt: now } })] : []),
                ...(quoteIds.length ? [db.quote.updateMany({ where: { id: { in: quoteIds }, deletedAt: null }, data: { deletedAt: now } })] : []),
            ]);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Estimation rapide (non persistée) ───────────────────────────────
    electron_1.ipcMain.handle('permits:quickEstimate', async (_event, { token, projectId, characteristics }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            let source = null;
            if (projectId) {
                const project = await db.permitProject.findUnique({ where: { id: Number(projectId) } });
                if (!project || project.deletedAt)
                    return { success: false, error: 'Projet introuvable' };
                if (!(await canAccess(db, session, project)))
                    return { success: false, error: 'Projet inaccessible' };
                source = project;
            }
            else if (characteristics) {
                const parsed = projectSchema.partial({ nom: true }).safeParse({ nom: 'x', ...characteristics });
                if (!parsed.success)
                    return { success: false, error: parsed.error.issues[0]?.message ?? 'Caractéristiques invalides' };
                source = parsed.data;
            }
            else {
                return { success: false, error: 'projectId ou characteristics requis' };
            }
            const inputs = (0, permit_engine_service_1.toPermitProjectInputs)(source);
            const result = await (0, permit_engine_service_1.computePermitEstimate)(db, inputs);
            return { success: true, data: result };
        }
        catch (error) {
            logger_1.default.error('permits:quickEstimate error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Génération d'une estimation (persistée) ─────────────────────────
    electron_1.ipcMain.handle('permits:generateEstimate', async (_event, { token, projectId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const project = await db.permitProject.findUnique({ where: { id: Number(projectId) } });
            if (!project || project.deletedAt)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, project)))
                return { success: false, error: 'Projet inaccessible' };
            const inputs = (0, permit_engine_service_1.toPermitProjectInputs)(project);
            const result = await (0, permit_engine_service_1.computePermitEstimate)(db, inputs);
            const reference = await nextEstimateReference(db);
            const lastVersion = await db.permitEstimate.findFirst({ where: { projectId: Number(projectId) }, orderBy: { version: 'desc' }, select: { version: true } });
            const version = (lastVersion?.version ?? 0) + 1;
            const created = await db.$transaction(async (tx) => {
                const estimate = await tx.permitEstimate.create({
                    data: {
                        reference, projectId: Number(projectId), version, status: 'BROUILLON',
                        totalArchitecte: dec(result.totalArchitecte), totalBET: dec(result.totalBET),
                        totalGeometre: dec(result.totalGeometre), totalEtudes: dec(result.totalEtudes),
                        totalFraisAdministratifs: dec(result.totalFraisAdministratifs), totalTaxes: dec(result.totalTaxes),
                        totalHT: dec(result.totalHT), totalTVA: dec(result.totalTVA), totalTTC: dec(result.totalTTC),
                        tvaPct: dec(result.tvaPct),
                        coutPrevisionnelTravauxSnapshot: result.coutPrevisionnelTravauxSnapshot != null ? dec(result.coutPrevisionnelTravauxSnapshot) : null,
                        warnings: result.warnings,
                        generatedById: session.userId,
                    },
                });
                if (result.lines.length) {
                    await tx.permitEstimateLine.createMany({
                        data: result.lines.map((l) => ({
                            estimateId: estimate.id, feeItemId: l.feeItemId, feeItemCode: l.feeItemCode, category: l.category,
                            label: l.label, calcMode: l.calcMode, baseAmount: l.baseAmount != null ? dec(l.baseAmount) : null,
                            rateValue: dec(l.rateValue), montantHT: dec(l.montantHT), trace: l.trace, order: l.order,
                        })),
                    });
                }
                await tx.permitProject.update({ where: { id: Number(projectId) }, data: { status: 'ESTIME' } });
                return tx.permitEstimate.findUnique({ where: { id: estimate.id }, include: { lines: { orderBy: { order: 'asc' } } } });
            });
            return { success: true, data: ser(created) };
        }
        catch (error) {
            logger_1.default.error('permits:generateEstimate error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Estimations ──────────────────────────────────────────────────────
    electron_1.ipcMain.handle('permits:estimates:list', async (_event, { token, projectId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const project = await db.permitProject.findUnique({ where: { id: Number(projectId) }, select: { clientId: true, prospectId: true } });
            if (!project)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, project)))
                return { success: false, error: 'Projet inaccessible' };
            const data = await db.permitEstimate.findMany({ where: { projectId: Number(projectId), deletedAt: null }, orderBy: { version: 'desc' } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    async function loadEstimate(db, session, id) {
        const estimate = await db.permitEstimate.findUnique({
            where: { id }, include: { project: true, lines: { orderBy: { order: 'asc' } } },
        });
        if (!estimate || estimate.deletedAt)
            return null;
        if (!(await canAccess(db, session, estimate.project)))
            throw new Error('Estimation inaccessible');
        return estimate;
    }
    electron_1.ipcMain.handle('permits:estimates:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const estimate = await loadEstimate((0, db_service_1.getDb)(), session, Number(id));
            if (!estimate)
                return { success: false, error: 'Estimation introuvable' };
            return { success: true, data: ser(estimate) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:estimates:setStatus', async (_event, { token, id, status }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const estimate = await db.permitEstimate.findUnique({ where: { id: Number(id) }, include: { project: true } });
            if (!estimate || estimate.deletedAt)
                return { success: false, error: 'Estimation introuvable' };
            if (!(await canAccess(db, session, estimate.project)))
                return { success: false, error: 'Estimation inaccessible' };
            if (!['VALIDE', 'OBSOLETE'].includes(status))
                return { success: false, error: 'Statut invalide' };
            const data = await db.permitEstimate.update({ where: { id: Number(id) }, data: { status } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('permits:estimates:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, DELETE_ROLES);
            const db = (0, db_service_1.getDb)();
            const estimate = await db.permitEstimate.findUnique({ where: { id: Number(id) }, include: { project: true } });
            if (!estimate || estimate.deletedAt)
                return { success: false, error: 'Estimation introuvable' };
            if (!(await canAccess(db, session, estimate.project)))
                return { success: false, error: 'Estimation inaccessible' };
            await db.permitEstimate.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Conversion en devis commercial ──────────────────────────────────
    electron_1.ipcMain.handle('permits:estimates:toQuote', async (_event, { token, ...payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = toQuoteSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const estimate = await db.permitEstimate.findUnique({
                where: { id: parsed.data.estimateId }, include: { project: true, lines: { orderBy: { order: 'asc' } } },
            });
            if (!estimate || estimate.deletedAt)
                return { success: false, error: 'Estimation introuvable' };
            if (!(await canAccess(db, session, estimate.project)))
                return { success: false, error: 'Estimation inaccessible' };
            if (estimate.quoteId)
                return { success: false, error: 'Cette estimation a déjà été convertie en devis.' };
            const p = parsed.data.payload;
            if (!p.clientId && !p.prospectId)
                return { success: false, error: 'Sélectionnez un client ou un prospect destinataire du devis.' };
            const quoteItems = estimate.lines.map((l) => ({
                lineType: 'ARTICLE',
                designation: l.label,
                reference: l.feeItemCode ?? '',
                category: exports.PERMIT_CATEGORY_LABELS[l.category] ?? l.category,
                quantity: 1,
                unit: null,
                unitPrice: Number(l.montantHT),
                total: Number(l.montantHT),
            }));
            const { subtotal, taxAmount, total } = (0, quotes_ipc_1.resolveQuoteAmounts)(quoteItems.map((it) => ({ quantity: it.quantity, unitPrice: it.unitPrice })), { taxRate: p.taxRate ?? 0 });
            const result = await db.$transaction(async (tx) => {
                const reference = await (0, quotes_ipc_1.nextReference)(tx);
                const quote = await tx.quote.create({
                    data: {
                        reference, type: 'PRESTATION', status: 'BROUILLON',
                        objet: p.objet?.trim() || `Permis de construire — ${estimate.project.nom}`,
                        prospectId: p.prospectId ?? null, clientId: p.clientId ?? null, agentId: p.agentId ?? null,
                        validUntil: p.validUntil ? new Date(p.validUntil) : null,
                        taxRate: dec(p.taxRate ?? 0), subtotal: dec(subtotal),
                        taxAmount: dec(taxAmount), total: dec(total),
                        templateId: p.templateId ?? null, referenceColumnLabel: p.referenceColumnLabel ?? null,
                        notes: `Généré depuis l'estimation ${estimate.reference} du ${new Date().toLocaleDateString('fr-FR')}.`,
                        createdById: session.userId,
                        items: {
                            create: quoteItems.map((it, i) => ({
                                lineType: it.lineType, designation: it.designation, reference: it.reference, category: it.category,
                                quantity: dec(it.quantity), unit: it.unit, unitPrice: dec(it.unitPrice),
                                total: dec(it.total), order: i,
                            })),
                        },
                    },
                });
                await tx.permitEstimate.update({
                    where: { id: estimate.id },
                    data: { quoteId: quote.id, quoteReference: quote.reference, convertedAt: new Date(), status: 'CONVERTI' },
                });
                await tx.permitProject.update({ where: { id: estimate.projectId }, data: { status: 'DEVIS_EMIS' } });
                return { id: quote.id, reference: quote.reference };
            });
            return { success: true, data: result };
        }
        catch (error) {
            logger_1.default.error('permits:estimates:toQuote error', error.message);
            return { success: false, error: error.message };
        }
    });
}
