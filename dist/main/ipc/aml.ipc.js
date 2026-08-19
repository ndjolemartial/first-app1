"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AML_REPORT_CREATE_ROLES = exports.AML_REPORT_MANAGE_ROLES = exports.AML_ROLES = void 0;
exports.registerAmlIPC = registerAmlIPC;
const electron_1 = require("electron");
const zod_1 = require("zod");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const aml_risk_engine_service_1 = require("../services/aml-risk-engine.service");
const logger_1 = __importDefault(require("../utils/logger"));
// Module 19 — Conformité LBC/FT. Rôle CONFORMITE exclusif (comme RH pour
// le Module 12) : aucune équivalence dans checkRole, contrôle par rôle exact.
// MANAGER puis ACCOUNTANT ont été ajoutés avec parité totale ADMIN (y compris
// AML_ADMIN_ONLY ci-dessous) — plein accès explicitement demandé, au-delà du
// périmètre de CONFORMITE lui-même sur les 3 actions les plus sensibles.
exports.AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];
const AML_ADMIN_ONLY = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
// Nommée distinctement d'AML_ROLES pour la lisibilité de la confidentialité,
// bien qu'identique aujourd'hui.
exports.AML_REPORT_MANAGE_ROLES = exports.AML_ROLES;
// Signalement interne d'un soupçon : large, exigence GAFI de remontée
// interne — tous les rôles sauf READONLY.
exports.AML_REPORT_CREATE_ROLES = [
    'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION',
    'AGENT', 'AGENT_TECHNIQUE', 'RH', 'CONFORMITE',
];
// Lecture du badge (résumé non sensible) sur les fiches Client/Owner/Convention —
// via checkRole (équivalences) pour couvrir les mêmes rôles que clients:read.
const AML_BADGE_READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'ACCOUNTANT', 'READONLY', 'CONFORMITE'];
// AGENT / AGENT_TECHNIQUE / ASSISTANTE_DIRECTION / READONLY : accès
// **restreint** au module, limité aux deux interfaces Référentiel de
// vigilance et Formations (jamais Profils/Revues/Déclarations/Tableau de
// bord — cf. RoleGuard dédié dans router.tsx, disjoint du groupe AML_ROLES).
const AML_RESTRICTED_ROLES = ['AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION', 'READONLY'];
// Au sein de ce groupe restreint, seul AGENT_TECHNIQUE peut créer/modifier/
// supprimer une entrée du référentiel de vigilance — AGENT, ASSISTANTE_
// DIRECTION et READONLY y sont en lecture seule (READONLY en particulier,
// conformément à son rôle, n'écrit jamais nulle part dans le module).
const WATCHLIST_RESTRICTED_WRITE_ROLES = ['AGENT_TECHNIQUE'];
/** Vérifie un rôle exact (pas d'équivalence ACCOUNTANT/ASSISTANTE_DIRECTION → MANAGER). */
function checkExactRole(session, allowed) {
    if (!allowed.includes(session.role))
        throw new Error('Permission insuffisante');
}
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);
/** Sérialise pour l'IPC : les Date/Decimal Prisma ne sont pas clonables par Electron. */
const ser = (v) => JSON.parse(JSON.stringify(v));
const subjectTypeSchema = zod_1.z.enum(['CLIENT', 'OWNER']);
async function nextReference(db, model, prefix) {
    const year = new Date().getFullYear();
    const last = await db[model].findFirst({
        where: { reference: { startsWith: `${prefix}-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
/** Lecture volontairement étroite du sujet (Client ou Owner) — jamais l'objet complet. */
async function resolveSubjectSummary(db, subjectType, subjectId) {
    if (subjectType === 'CLIENT') {
        return db.client.findFirst({
            where: { id: subjectId },
            select: { id: true, type: true, firstName: true, lastName: true, entreprise: true, nationality: true, idNumber: true, birthDate: true, country: true },
        });
    }
    return db.owner.findFirst({
        where: { id: subjectId },
        select: { id: true, type: true, firstName: true, lastName: true, companyName: true, country: true },
    });
}
/** Résout les noms des utilisateurs référencés par des colonnes `Int?` sans relation typée pour l'appelant. */
async function resolveUserNames(db, ids) {
    const unique = Array.from(new Set(ids.filter((v) => typeof v === 'number')));
    if (!unique.length)
        return new Map();
    const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, `${u.lastName} ${u.firstName}`]));
}
/* ─── Schémas Zod ────────────────────────────────────────────── */
const profileWriteSchema = zod_1.z.object({
    isPep: zod_1.z.boolean().optional(),
    pepCategory: zod_1.z.enum(['PEP_NATIONAL', 'PEP_ETRANGER', 'PEP_ORGANISATION_INTERNATIONALE', 'PERSONNE_LIEE_PEP']).nullable().optional(),
    pepFunction: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    hasRiskyCountryLink: zod_1.z.boolean().optional(),
    sourceOfFunds: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    sourceOfWealth: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    vigilanceType: zod_1.z.enum(['SIMPLIFIEE', 'NORMALE', 'RENFORCEE']).optional(),
    nextReviewDate: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.date().nullable().optional()),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const profileCreateSchema = profileWriteSchema.extend({
    subjectType: subjectTypeSchema,
    subjectId: zod_1.z.coerce.number().int().positive(),
});
const setRiskFactorsSchema = zod_1.z.object({ riskFactorIds: zod_1.z.array(zod_1.z.coerce.number().int().positive()) });
const beneficialOwnerSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'Prénom requis'),
    lastName: zod_1.z.string().min(1, 'Nom requis'),
    nationality: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    idNumber: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    ownershipPct: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().min(0).max(100).nullable().optional()),
    role: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    isPep: zod_1.z.boolean().optional(),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const riskFactorSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Code requis'),
    label: zod_1.z.string().min(1, 'Libellé requis'),
    category: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    weight: zod_1.z.coerce.number().int().min(0).default(1),
    isAutoDetected: zod_1.z.boolean().optional(),
    description: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    isActive: zod_1.z.boolean().optional(),
});
const thresholdsSchema = zod_1.z.object({
    faibleMax: zod_1.z.coerce.number().int().min(0),
    moyenMax: zod_1.z.coerce.number().int().min(0),
    amountThreshold: zod_1.z.coerce.number().min(0),
}).refine((d) => d.moyenMax >= d.faibleMax, { message: 'Le seuil moyen doit être supérieur ou égal au seuil faible', path: ['moyenMax'] });
const watchlistSchema = zod_1.z.object({
    listType: zod_1.z.enum(['ONU', 'UE', 'NATIONALE', 'GIABA', 'AUTRE']),
    personType: zod_1.z.enum(['PHYSIQUE', 'MORALE']).optional(),
    name: zod_1.z.string().min(1, 'Nom requis'), // Nom et prénoms / raison sociale
    aliases: zod_1.z.array(zod_1.z.string()).optional(),
    sex: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    nationality: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    // number[] — âges connus (indicatifs), plusieurs valeurs fréquentes pour une
    // même personne, comme les dates de naissance ci-dessous.
    ages: zod_1.z.array(zod_1.z.coerce.number().int().min(0).max(150)).optional(),
    // string[] de dates ISO (YYYY-MM-DD) — plusieurs dates de naissance connues
    // pour une même personne (fréquent sur les listes SFC/PPE sources).
    birthDates: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    birthPlace: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    relatedPersons: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    maritalStatus: zod_1.z.preprocess(emptyToNull, zod_1.z.enum(['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE', 'DIVORCE', 'VEUF']).nullable().optional()),
    spokenLanguage: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    residenceCountry: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    address: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    phone: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    profession: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    reason: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    sourceRef: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    isActive: zod_1.z.boolean().optional(),
});
const matchReviewSchema = zod_1.z.object({
    status: zod_1.z.enum(['CONFIRME', 'FAUX_POSITIF']),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const reviewCreateSchema = zod_1.z.object({
    // Source réelle de l'encaissement — un paiement de facture ou une échéance
    // (convention-liée ou héritée). Une revue ne se déclenche plus jamais sur
    // la seule convention.
    sourceType: zod_1.z.enum(['PAYMENT', 'INSTALLMENT', 'INVOICE']),
    sourceId: zod_1.z.coerce.number().int().positive(),
    conventionId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    sourceLabel: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    subjectType: subjectTypeSchema,
    subjectId: zod_1.z.coerce.number().int().positive(),
    triggerReason: zod_1.z.enum(['SEUIL_MONTANT', 'RISQUE_ELEVE', 'PEP', 'PAYS_RISQUE', 'ESPECES', 'WATCHLIST', 'MANUEL']),
    amount: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().nullable().optional()),
    paymentMethod: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const reviewCloseSchema = zod_1.z.object({
    status: zod_1.z.enum(['CLOTUREE_RAS', 'CLOTUREE_DECLAREE']),
    conclusion: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const reportMotifCategory = zod_1.z.enum(['STRUCTURATION', 'ORIGINE_FONDS_SUSPECTE', 'INCOHERENCE_PROFIL', 'MONTAGE_COMPLEXE', 'PEP_NON_JUSTIFIE', 'WATCHLIST_CONFIRMEE', 'AUTRE']);
const reportCreateSchema = zod_1.z.object({
    subjectType: subjectTypeSchema,
    subjectId: zod_1.z.coerce.number().int().positive(),
    conventionId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    transactionReviewId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    motifCategory: reportMotifCategory.nullable().optional(),
    motif: zod_1.z.string().min(1, 'Motif requis'),
});
const reportUpdateSchema = zod_1.z.object({
    motifCategory: reportMotifCategory.nullable().optional(),
    motif: zod_1.z.string().min(1).optional(),
    complianceOfficerId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const reportTransmitSchema = zod_1.z.object({ centifReference: zod_1.z.string().min(1, 'Référence CENTIF requise') });
const reportClassifySchema = zod_1.z.object({ classificationReason: zod_1.z.string().min(1, 'Motif requis') });
const trainingBaseSchema = zod_1.z.object({
    trainingDate: zod_1.z.coerce.date(),
    topic: zod_1.z.string().min(1, 'Sujet requis'),
    provider: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
    durationHours: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().min(0).nullable().optional()),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
// Création : plusieurs participants pour une même session de formation —
// une ligne AmlTraining par participant (registre plat conservé, cf. plan),
// même sujet/date/organisme/durée/notes partagés.
const trainingCreateSchema = trainingBaseSchema.extend({
    userIds: zod_1.z.array(zod_1.z.coerce.number().int().positive()).min(1, 'Sélectionnez au moins un participant'),
});
// Modification : une ligne = un participant, le participant reste modifiable individuellement.
const trainingUpdateSchema = trainingBaseSchema.extend({ userId: zod_1.z.coerce.number().int().positive() }).partial();
/** Enregistre les handlers IPC du module Conformité LBC/FT (Module 19). */
function registerAmlIPC() {
    /* ─── Profils ──────────────────────────────────────────────── */
    electron_1.ipcMain.handle('aml:profiles:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.riskLevel)
                where.riskLevel = filters.riskLevel;
            if (filters.status)
                where.status = filters.status;
            if (filters.subjectType)
                where.subjectType = filters.subjectType;
            const [rows, total] = await db.$transaction([
                db.amlProfile.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
                db.amlProfile.count({ where }),
            ]);
            const data = await Promise.all(rows.map(async (p) => ({ ...p, subject: await resolveSubjectSummary(db, p.subjectType, p.subjectId) })));
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('aml:profiles:list', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:profiles:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const profile = await db.amlProfile.findFirst({
                where: { id: Number(id), deletedAt: null },
                include: {
                    beneficialOwners: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
                    riskFactorLinks: { include: { riskFactor: true } },
                    watchlistMatches: { include: { watchlist: true }, orderBy: { createdAt: 'desc' } },
                    documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } },
                },
            });
            if (!profile)
                return { success: false, error: 'Profil introuvable' };
            const subject = await resolveSubjectSummary(db, profile.subjectType, profile.subjectId);
            const names = await resolveUserNames(db, [profile.validatedById, profile.createdById]);
            const data = {
                ...profile,
                subject,
                validatedByName: profile.validatedById ? names.get(profile.validatedById) ?? null : null,
                createdByName: profile.createdById ? names.get(profile.createdById) ?? null : null,
            };
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:profiles:getById', error.message);
            return { success: false, error: error.message };
        }
    });
    // Badge non sensible pour les fiches Client/Owner — accessible aux mêmes
    // rôles que la lecture de ces fiches (checkRole, avec équivalences).
    electron_1.ipcMain.handle('aml:profiles:getBySubject', async (_event, { token, subjectType, subjectId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, AML_BADGE_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const profile = await db.amlProfile.findFirst({
                where: { subjectType, subjectId: Number(subjectId), deletedAt: null },
                select: { id: true, riskLevel: true, status: true, vigilanceType: true, isPep: true, updatedAt: true },
            });
            return ser({ success: true, data: profile ?? null });
        }
        catch (error) {
            logger_1.default.error('aml:profiles:getBySubject', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:profiles:subjectsWithoutProfile', async (_event, { token, subjectType, search }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlProfile.findMany({ where: { subjectType }, select: { subjectId: true } });
            const excludeIds = existing.map((e) => e.subjectId);
            if (subjectType === 'CLIENT') {
                const data = await db.client.findMany({
                    where: {
                        deletedAt: null,
                        id: { notIn: excludeIds },
                        ...(search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { entreprise: { contains: search } }] } : {}),
                    },
                    select: { id: true, type: true, firstName: true, lastName: true, entreprise: true },
                    orderBy: { lastName: 'asc' },
                    take: 50,
                });
                return ser({ success: true, data });
            }
            const data = await db.owner.findMany({
                where: {
                    deletedAt: null,
                    id: { notIn: excludeIds },
                    ...(search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { companyName: { contains: search } }] } : {}),
                },
                select: { id: true, type: true, firstName: true, lastName: true, companyName: true },
                orderBy: { lastName: 'asc' },
                take: 50,
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:profiles:subjectsWithoutProfile', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:profiles:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = profileCreateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const subject = await resolveSubjectSummary(db, parsed.data.subjectType, parsed.data.subjectId);
            if (!subject)
                return { success: false, error: 'Client ou propriétaire introuvable' };
            const already = await db.amlProfile.findFirst({ where: { subjectType: parsed.data.subjectType, subjectId: parsed.data.subjectId } });
            if (already)
                return { success: false, error: 'Un profil LBC/FT existe déjà pour ce sujet' };
            const reference = await nextReference(db, 'amlProfile', 'LBC');
            const { subjectType, subjectId, ...rest } = parsed.data;
            const profile = await db.amlProfile.create({
                data: { reference, subjectType, subjectId, ...rest, createdById: session.userId },
            });
            logger_1.default.info(`Profil LBC/FT créé : ${profile.reference}`);
            return ser({ success: true, data: profile });
        }
        catch (error) {
            logger_1.default.error('aml:profiles:create', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:profiles:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = profileWriteSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlProfile.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Profil introuvable' };
            const profile = await db.amlProfile.update({ where: { id: existing.id }, data: parsed.data });
            return ser({ success: true, data: profile });
        }
        catch (error) {
            logger_1.default.error('aml:profiles:update', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:profiles:setRiskFactors', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = setRiskFactorsSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlProfile.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Profil introuvable' };
            await db.$transaction(async (tx) => {
                // Ne touche que les liens MANUEL — les liens AUTO restent gérés par recomputeProfileRisk.
                await tx.amlProfileRiskFactor.deleteMany({ where: { profileId: existing.id, source: 'MANUEL' } });
                const currentAuto = await tx.amlProfileRiskFactor.findMany({ where: { profileId: existing.id, source: 'AUTO' }, select: { riskFactorId: true } });
                const autoIds = new Set(currentAuto.map((l) => l.riskFactorId));
                const toCreate = parsed.data.riskFactorIds.filter((rid) => !autoIds.has(rid));
                if (toCreate.length) {
                    await tx.amlProfileRiskFactor.createMany({ data: toCreate.map((riskFactorId) => ({ profileId: existing.id, riskFactorId, source: 'MANUEL' })) });
                }
            });
            const profile = await (0, aml_risk_engine_service_1.recomputeProfileRisk)(db, existing.id);
            return ser({ success: true, data: profile });
        }
        catch (error) {
            logger_1.default.error('aml:profiles:setRiskFactors', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:profiles:computeRisk', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlProfile.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Profil introuvable' };
            const profile = await (0, aml_risk_engine_service_1.recomputeProfileRisk)(db, existing.id);
            return ser({ success: true, data: profile });
        }
        catch (error) {
            logger_1.default.error('aml:profiles:computeRisk', error.message);
            return { success: false, error: error.message };
        }
    });
    const transitionHandler = (status, channel) => {
        electron_1.ipcMain.handle(channel, async (_event, { token, id }) => {
            try {
                const session = (0, auth_service_1.getSession)(token);
                if (!session)
                    return { success: false, error: 'Session expirée' };
                checkExactRole(session, exports.AML_ROLES);
                const db = (0, db_service_1.getDb)();
                const existing = await db.amlProfile.findFirst({ where: { id: Number(id), deletedAt: null } });
                if (!existing)
                    return { success: false, error: 'Profil introuvable' };
                const data = { status };
                if (status === 'VALIDE') {
                    data.validatedById = session.userId;
                    data.validatedAt = new Date();
                }
                const profile = await db.amlProfile.update({ where: { id: existing.id }, data });
                return ser({ success: true, data: profile });
            }
            catch (error) {
                logger_1.default.error(channel, error.message);
                return { success: false, error: error.message };
            }
        });
    };
    transitionHandler('VALIDE', 'aml:profiles:validate');
    transitionHandler('A_REVOIR', 'aml:profiles:markToReview');
    transitionHandler('REFUSE', 'aml:profiles:markRefused');
    electron_1.ipcMain.handle('aml:profiles:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, AML_ADMIN_ONLY);
            const db = (0, db_service_1.getDb)();
            await db.amlProfile.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('aml:profiles:delete', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Bénéficiaires effectifs ──────────────────────────────── */
    electron_1.ipcMain.handle('aml:beneficialOwners:list', async (_event, { token, profileId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.amlBeneficialOwner.findMany({ where: { profileId: Number(profileId), deletedAt: null }, orderBy: { createdAt: 'asc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:beneficialOwners:list', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:beneficialOwners:create', async (_event, { token, profileId, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = beneficialOwnerSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const profile = await db.amlProfile.findFirst({ where: { id: Number(profileId), deletedAt: null } });
            if (!profile)
                return { success: false, error: 'Profil introuvable' };
            const data = await db.amlBeneficialOwner.create({ data: { ...parsed.data, profileId: profile.id } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:beneficialOwners:create', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:beneficialOwners:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = beneficialOwnerSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = await db.amlBeneficialOwner.update({ where: { id: Number(id) }, data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:beneficialOwners:update', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:beneficialOwners:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.amlBeneficialOwner.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('aml:beneficialOwners:delete', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Catalogue des facteurs de risque + seuils ───────────── */
    electron_1.ipcMain.handle('aml:riskFactors:list', async (_event, { token, includeInactive }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (!includeInactive)
                where.isActive = true;
            const data = await db.amlRiskFactorCatalog.findMany({ where, orderBy: [{ category: 'asc' }, { label: 'asc' }] });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:riskFactors:list', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:riskFactors:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = riskFactorSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = await db.amlRiskFactorCatalog.create({ data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            if (error.code === 'P2002')
                return { success: false, error: 'Ce code existe déjà' };
            logger_1.default.error('aml:riskFactors:create', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:riskFactors:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = riskFactorSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = await db.amlRiskFactorCatalog.update({ where: { id: Number(id) }, data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            if (error.code === 'P2002')
                return { success: false, error: 'Ce code existe déjà' };
            logger_1.default.error('aml:riskFactors:update', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:riskFactors:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.amlRiskFactorCatalog.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('aml:riskFactors:delete', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('settings:getAmlRiskThresholds', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const data = await (0, aml_risk_engine_service_1.getAmlRiskThresholds)((0, db_service_1.getDb)());
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('settings:getAmlRiskThresholds', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('settings:updateAmlRiskThresholds', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, AML_ADMIN_ONLY);
            const parsed = thresholdsSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            await (0, aml_risk_engine_service_1.setAmlRiskThresholds)(parsed.data, (0, db_service_1.getDb)());
            return { success: true, data: parsed.data };
        }
        catch (error) {
            logger_1.default.error('settings:updateAmlRiskThresholds', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Référentiel de vigilance (watchlist) ────────────────── */
    electron_1.ipcMain.handle('aml:watchlist:list', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, [...exports.AML_ROLES, ...AML_RESTRICTED_ROLES]);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.listType)
                where.listType = filters.listType;
            if (filters.personType)
                where.personType = filters.personType;
            let data = await db.amlWatchlist.findMany({ where, orderBy: { name: 'asc' } });
            // Recherche élargie — nom, alias, nationalité, pays de résidence habituel —
            // appliquée en mémoire (comme `aml:watchlist:screen` ci-dessous) : le
            // filtre JSON "contains" de Prisma/MySQL ne permet de tester qu'une
            // égalité exacte d'élément de tableau, pas une sous-chaîne au sein d'un
            // alias.
            if (filters.search) {
                const term = String(filters.search).toLowerCase();
                data = data.filter((w) => {
                    const haystacks = [w.name, ...(Array.isArray(w.aliases) ? w.aliases : []), w.nationality, w.residenceCountry];
                    return haystacks.some((v) => typeof v === 'string' && v.toLowerCase().includes(term));
                });
            }
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:watchlist:list', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:watchlist:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, [...exports.AML_ROLES, ...AML_RESTRICTED_ROLES]);
            const db = (0, db_service_1.getDb)();
            const data = await db.amlWatchlist.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!data)
                return { success: false, error: 'Entrée introuvable' };
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:watchlist:getById', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:watchlist:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, [...exports.AML_ROLES, ...WATCHLIST_RESTRICTED_WRITE_ROLES]);
            const parsed = watchlistSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = await db.amlWatchlist.create({ data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:watchlist:create', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:watchlist:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, [...exports.AML_ROLES, ...WATCHLIST_RESTRICTED_WRITE_ROLES]);
            const parsed = watchlistSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = await db.amlWatchlist.update({ where: { id: Number(id) }, data: parsed.data });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:watchlist:update', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:watchlist:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, [...exports.AML_ROLES, ...WATCHLIST_RESTRICTED_WRITE_ROLES]);
            const db = (0, db_service_1.getDb)();
            await db.amlWatchlist.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('aml:watchlist:delete', error.message);
            return { success: false, error: error.message };
        }
    });
    // Rapprochement manuel/semi-assisté — correspondance textuelle sur nom/alias.
    // Aucune connexion à une API externe (aucune n'est disponible localement).
    electron_1.ipcMain.handle('aml:watchlist:screen', async (_event, { token, profileId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const profile = await db.amlProfile.findFirst({ where: { id: Number(profileId), deletedAt: null } });
            if (!profile)
                return { success: false, error: 'Profil introuvable' };
            const subject = await resolveSubjectSummary(db, profile.subjectType, profile.subjectId);
            if (!subject)
                return { success: false, error: 'Sujet introuvable' };
            const names = [
                'firstName' in subject ? [subject.firstName, subject.lastName].filter(Boolean).join(' ') : null,
                subject.entreprise, subject.companyName,
            ].filter((n) => !!n && n.trim().length > 0);
            const active = await db.amlWatchlist.findMany({ where: { deletedAt: null, isActive: true } });
            const matched = active.filter((w) => {
                const candidates = [w.name, ...(Array.isArray(w.aliases) ? w.aliases : [])].map((s) => s.toLowerCase());
                return names.some((n) => candidates.some((c) => c.includes(n.toLowerCase()) || n.toLowerCase().includes(c)));
            });
            const existingMatches = await db.amlWatchlistMatch.findMany({ where: { profileId: profile.id, status: 'A_VERIFIER' }, select: { watchlistId: true } });
            const existingIds = new Set(existingMatches.map((m) => m.watchlistId));
            const toCreate = matched.filter((w) => !existingIds.has(w.id));
            if (toCreate.length) {
                await db.amlWatchlistMatch.createMany({ data: toCreate.map((w) => ({ profileId: profile.id, watchlistId: w.id })) });
            }
            const data = await db.amlWatchlistMatch.findMany({ where: { profileId: profile.id }, include: { watchlist: true }, orderBy: { createdAt: 'desc' } });
            return ser({ success: true, data, matchCount: matched.length });
        }
        catch (error) {
            logger_1.default.error('aml:watchlist:screen', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:watchlistMatches:list', async (_event, { token, profileId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.amlWatchlistMatch.findMany({ where: { profileId: Number(profileId) }, include: { watchlist: true }, orderBy: { createdAt: 'desc' } });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:watchlistMatches:list', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:watchlistMatches:review', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = matchReviewSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlWatchlistMatch.findFirst({ where: { id: Number(id) } });
            if (!existing)
                return { success: false, error: 'Correspondance introuvable' };
            const match = await db.amlWatchlistMatch.update({
                where: { id: existing.id },
                data: { status: parsed.data.status, notes: parsed.data.notes, reviewedById: session.userId, reviewedAt: new Date() },
            });
            if (parsed.data.status === 'CONFIRME')
                await (0, aml_risk_engine_service_1.recomputeProfileRisk)(db, existing.profileId);
            return ser({ success: true, data: match });
        }
        catch (error) {
            logger_1.default.error('aml:watchlistMatches:review', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Revues de transaction ────────────────────────────────── */
    electron_1.ipcMain.handle('aml:reviews:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.status)
                where.status = filters.status;
            const [data, total] = await db.$transaction([
                db.amlTransactionReview.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
                db.amlTransactionReview.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('aml:reviews:list', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:reviews:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const review = await db.amlTransactionReview.findFirst({
                where: { id: Number(id), deletedAt: null },
                include: { documents: { where: { deletedAt: null } }, reports: { where: { deletedAt: null } } },
            });
            if (!review)
                return { success: false, error: 'Revue introuvable' };
            const subject = await resolveSubjectSummary(db, review.subjectType, review.subjectId);
            return ser({ success: true, data: { ...review, subject } });
        }
        catch (error) {
            logger_1.default.error('aml:reviews:getById', error.message);
            return { success: false, error: error.message };
        }
    });
    // Badge non sensible pour la fiche Convention.
    electron_1.ipcMain.handle('aml:reviews:getByConvention', async (_event, { token, conventionId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, AML_BADGE_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const review = await db.amlTransactionReview.findFirst({
                where: { conventionId: Number(conventionId), deletedAt: null },
                orderBy: { createdAt: 'desc' },
                select: { id: true, reference: true, status: true, triggerReason: true },
            });
            return ser({ success: true, data: review ?? null });
        }
        catch (error) {
            logger_1.default.error('aml:reviews:getByConvention', error.message);
            return { success: false, error: error.message };
        }
    });
    // File dérivée, calculée à la demande — pas de tâche planifiée en phase 1.
    // Portée sur les encaissements effectifs (Payment / SaleInstallment
    // encaissée), jamais sur les Conventions elles-mêmes : le risque LBC/FT
    // porte sur l'argent qui bouge, pas sur le contrat signé. Seul critère de
    // déclenchement automatique : le montant dépasse le seuil « élevé »
    // paramétrable (Paramètres → Conformité LBC/FT → Seuils de scoring) —
    // le mode de paiement espèces et le profil à risque ne déclenchent plus
    // seuls une candidature (ils restent disponibles comme motifs de revue
    // manuelle, cf. `triggerReason` à la création).
    electron_1.ipcMain.handle('aml:reviews:pendingCandidates', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const thresholds = await (0, aml_risk_engine_service_1.getAmlRiskThresholds)(db);
            const openReviews = await db.amlTransactionReview.findMany({
                where: { status: { in: ['OUVERTE', 'EN_COURS'] } },
                select: { sourceType: true, sourceId: true },
            });
            const isOpen = (t, id) => openReviews.some((r) => r.sourceType === t && r.sourceId === id);
            // 1) Paiements de factures
            const payments = await db.payment.findMany({
                include: { invoice: { select: { id: true, reference: true, clientId: true, conventionId: true } } },
                orderBy: { paidAt: 'desc' },
                take: 200,
            });
            const paymentCandidates = payments
                .filter((p) => !isOpen('PAYMENT', p.id) && p.invoice.clientId != null)
                .filter((p) => p.amount.gt(thresholds.amountThreshold))
                .map((p) => ({
                sourceType: 'PAYMENT',
                sourceId: p.id,
                amount: p.amount,
                paymentMethod: p.method,
                conventionId: p.invoice.conventionId,
                clientId: p.invoice.clientId,
                label: `Paiement facture ${p.invoice.reference}`,
                date: p.paidAt,
            }));
            // 2) Échéances encaissées (convention-liées + héritées) — un seul
            // modèle, distinguées par la présence de conventionId. Une échéance
            // n'est un encaissement que si status ∈ {PARTIEL, PAYE}.
            const installments = await db.saleInstallment.findMany({
                where: { status: { in: ['PARTIEL', 'PAYE'] } },
                include: { convention: { select: { id: true, reference: true, clientId: true } } },
                orderBy: { paidAt: 'desc' },
                take: 200,
            });
            const installmentCandidates = installments
                .filter((i) => !isOpen('INSTALLMENT', i.id))
                .map((i) => ({ i, resolvedClientId: i.clientId ?? i.convention?.clientId ?? null }))
                .filter((x) => x.resolvedClientId != null)
                .filter((x) => x.i.amount.gt(thresholds.amountThreshold))
                .map(({ i, resolvedClientId }) => ({
                sourceType: 'INSTALLMENT',
                sourceId: i.id,
                amount: i.amount,
                paymentMethod: i.paymentMethod,
                conventionId: i.conventionId,
                clientId: resolvedClientId,
                label: i.conventionId
                    ? `Échéance n°${i.installmentNumber} — ${i.convention?.reference ?? i.conventionId}`
                    : `Échéance héritée — ${i.detailsSouscription ?? 'souscription sans convention'}`,
                date: i.paidAt,
            }));
            // 3) Factures « Apport initial » / « Paiement comptant » (VENTE) réglées
            // sans passer par le grand livre des paiements (`accounting:updateInvoiceStatus`
            // permet de faire basculer une facture directement en PAYEE, ex. « → Payée »
            // sur la fiche facture, sans jamais créer de Payment) — ces encaissements
            // ne remontent donc pas via le bucket (1) ci-dessus. Ne compte que la part
            // non déjà couverte par des Payment enregistrés (évite les doublons quand
            // la facture a bien été réglée via accounting:addPayment).
            const cashInvoices = await db.invoice.findMany({
                where: { deletedAt: null, type: { in: ['APPORT_INITIAL', 'VENTE'] }, status: 'PAYEE', clientId: { not: null } },
                include: { payments: { select: { amount: true } } },
                orderBy: { paidAt: 'desc' },
                take: 200,
            });
            const invoiceCandidates = cashInvoices
                .filter((inv) => !isOpen('INVOICE', inv.id))
                .filter((inv) => inv.payments.reduce((s, p) => s + Number(p.amount), 0) < Number(inv.total))
                .filter((inv) => inv.total.gt(thresholds.amountThreshold))
                .map((inv) => ({
                sourceType: 'INVOICE',
                sourceId: inv.id,
                amount: inv.total,
                paymentMethod: null,
                conventionId: inv.conventionId,
                clientId: inv.clientId,
                label: `${inv.type === 'APPORT_INITIAL' ? 'Apport initial' : 'Paiement comptant'} — facture ${inv.reference}`,
                date: inv.paidAt,
            }));
            const candidates = [...paymentCandidates, ...installmentCandidates, ...invoiceCandidates];
            const clientIds = Array.from(new Set(candidates.map((c) => c.clientId)));
            const clients = clientIds.length
                ? await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, type: true, firstName: true, lastName: true, entreprise: true } })
                : [];
            const clientMap = new Map(clients.map((c) => [c.id, c]));
            const data = candidates
                .map((c) => ({ ...c, client: clientMap.get(c.clientId) ?? null }))
                .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:reviews:pendingCandidates', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:reviews:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = reviewCreateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db, 'amlTransactionReview', 'RC');
            const review = await db.amlTransactionReview.create({
                data: { reference, ...parsed.data, createdById: session.userId },
            });
            logger_1.default.info(`Revue LBC/FT créée : ${review.reference}`);
            return ser({ success: true, data: review });
        }
        catch (error) {
            logger_1.default.error('aml:reviews:create', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:reviews:close', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = reviewCloseSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlTransactionReview.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Revue introuvable' };
            const review = await db.amlTransactionReview.update({
                where: { id: existing.id },
                data: { status: parsed.data.status, conclusion: parsed.data.conclusion, reviewedById: session.userId, reviewedAt: new Date() },
            });
            return ser({ success: true, data: review });
        }
        catch (error) {
            logger_1.default.error('aml:reviews:close', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:reviews:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, AML_ADMIN_ONLY);
            const db = (0, db_service_1.getDb)();
            await db.amlTransactionReview.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('aml:reviews:delete', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Déclarations de soupçon (strictement confidentiel) ──── */
    // Signalement interne — large (tous rôles sauf READONLY), verrouillé sur
    // soi-même, réponse limitée à l'accusé de réception (jamais de relecture
    // possible ensuite pour le déclarant — cf. list/getById ci-dessous).
    electron_1.ipcMain.handle('aml:suspiciousReports:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_REPORT_CREATE_ROLES);
            const parsed = reportCreateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db, 'amlSuspiciousReport', 'DS');
            const report = await db.amlSuspiciousReport.create({
                data: { reference, ...parsed.data, declaredById: session.userId },
            });
            logger_1.default.info(`Déclaration de soupçon créée : ${report.reference}`);
            return ser({ success: true, data: { id: report.id, reference: report.reference } });
        }
        catch (error) {
            logger_1.default.error('aml:suspiciousReports:create', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:suspiciousReports:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_REPORT_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.status)
                where.status = filters.status;
            const [rows, total] = await db.$transaction([
                db.amlSuspiciousReport.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
                db.amlSuspiciousReport.count({ where }),
            ]);
            const names = await resolveUserNames(db, rows.flatMap((r) => [r.declaredById, r.complianceOfficerId, r.transmittedById]));
            const data = await Promise.all(rows.map(async (r) => ({
                ...r,
                subject: await resolveSubjectSummary(db, r.subjectType, r.subjectId),
                declaredByName: names.get(r.declaredById) ?? null,
                complianceOfficerName: r.complianceOfficerId ? names.get(r.complianceOfficerId) ?? null : null,
            })));
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('aml:suspiciousReports:list', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:suspiciousReports:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_REPORT_MANAGE_ROLES);
            const db = (0, db_service_1.getDb)();
            const report = await db.amlSuspiciousReport.findFirst({
                where: { id: Number(id), deletedAt: null },
                include: { documents: { where: { deletedAt: null } }, transactionReview: true },
            });
            if (!report)
                return { success: false, error: 'Déclaration introuvable' };
            const subject = await resolveSubjectSummary(db, report.subjectType, report.subjectId);
            const names = await resolveUserNames(db, [report.declaredById, report.complianceOfficerId, report.transmittedById]);
            const data = {
                ...report,
                subject,
                declaredByName: names.get(report.declaredById) ?? null,
                complianceOfficerName: report.complianceOfficerId ? names.get(report.complianceOfficerId) ?? null : null,
                transmittedByName: report.transmittedById ? names.get(report.transmittedById) ?? null : null,
            };
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:suspiciousReports:getById', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:suspiciousReports:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_REPORT_MANAGE_ROLES);
            const parsed = reportUpdateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlSuspiciousReport.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Déclaration introuvable' };
            const data = { ...parsed.data };
            if (existing.status === 'BROUILLON' && data.complianceOfficerId)
                data.status = 'VALIDEE_INTERNE';
            const report = await db.amlSuspiciousReport.update({ where: { id: existing.id }, data });
            return ser({ success: true, data: report });
        }
        catch (error) {
            logger_1.default.error('aml:suspiciousReports:update', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:suspiciousReports:transmit', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_REPORT_MANAGE_ROLES);
            const parsed = reportTransmitSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlSuspiciousReport.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Déclaration introuvable' };
            const report = await db.amlSuspiciousReport.update({
                where: { id: existing.id },
                data: {
                    status: 'TRANSMISE_CENTIF',
                    centifReference: parsed.data.centifReference,
                    transmittedById: session.userId,
                    transmittedAt: new Date(),
                },
            });
            logger_1.default.info(`Déclaration de soupçon transmise à la CENTIF : ${report.reference}`);
            return ser({ success: true, data: report });
        }
        catch (error) {
            logger_1.default.error('aml:suspiciousReports:transmit', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:suspiciousReports:classify', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_REPORT_MANAGE_ROLES);
            const parsed = reportClassifySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlSuspiciousReport.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Déclaration introuvable' };
            const report = await db.amlSuspiciousReport.update({
                where: { id: existing.id },
                data: { status: 'CLASSEE_SANS_SUITE', classificationReason: parsed.data.classificationReason },
            });
            return ser({ success: true, data: report });
        }
        catch (error) {
            logger_1.default.error('aml:suspiciousReports:classify', error.message);
            return { success: false, error: error.message };
        }
    });
    // Aucun handler `aml:suspiciousReports:delete` n'est jamais enregistré —
    // obligation réglementaire de non-altération (cf. plan Module 19).
    /* ─── Formations du personnel ──────────────────────────────── */
    // Registre plat, pas de workflow de validation. Gestion réservée AML_ROLES,
    // comme le reste du module. Pas de confidentialité particulière (contrairement
    // aux déclarations de soupçon) : une formation n'est pas un secret.
    electron_1.ipcMain.handle('aml:training:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, [...exports.AML_ROLES, ...AML_RESTRICTED_ROLES]);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            // AGENT / AGENT_TECHNIQUE / ASSISTANTE_DIRECTION : uniquement les
            // formations dont ils sont participants — force le filtre, ignore
            // tout `filters.userId` transmis par le client.
            if (AML_RESTRICTED_ROLES.includes(session.role)) {
                where.userId = session.userId;
            }
            else if (filters.userId)
                where.userId = Number(filters.userId);
            if (filters.dateFrom || filters.dateTo) {
                where.trainingDate = {};
                if (filters.dateFrom)
                    where.trainingDate.gte = new Date(filters.dateFrom);
                if (filters.dateTo)
                    where.trainingDate.lte = new Date(`${filters.dateTo}T23:59:59`);
            }
            if (filters.search) {
                where.OR = [{ topic: { contains: filters.search } }, { provider: { contains: filters.search } }];
            }
            const [rows, total] = await db.$transaction([
                db.amlTraining.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { trainingDate: 'desc' } }),
                db.amlTraining.count({ where }),
            ]);
            const names = await resolveUserNames(db, rows.flatMap((r) => [r.userId, r.recordedById]));
            const data = rows.map((r) => ({
                ...r,
                userName: names.get(r.userId) ?? null,
                recordedByName: r.recordedById ? names.get(r.recordedById) ?? null : null,
            }));
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('aml:training:list', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:training:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, [...exports.AML_ROLES, ...AML_RESTRICTED_ROLES]);
            const db = (0, db_service_1.getDb)();
            const training = await db.amlTraining.findFirst({
                where: { id: Number(id), deletedAt: null },
                include: { documents: { where: { deletedAt: null } } },
            });
            if (!training)
                return { success: false, error: 'Formation introuvable' };
            // AGENT / AGENT_TECHNIQUE / ASSISTANTE_DIRECTION : uniquement leurs
            // propres formations — masqué en « introuvable », pas en refus explicite.
            if (AML_RESTRICTED_ROLES.includes(session.role) && training.userId !== session.userId) {
                return { success: false, error: 'Formation introuvable' };
            }
            const names = await resolveUserNames(db, [training.userId, training.recordedById]);
            const data = {
                ...training,
                userName: names.get(training.userId) ?? null,
                recordedByName: training.recordedById ? names.get(training.recordedById) ?? null : null,
            };
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('aml:training:getById', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:training:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = trainingCreateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const { userIds, ...shared } = parsed.data;
            const created = [];
            // Créations séquentielles (pas Promise.all) : nextReference() lit puis
            // écrit la dernière référence — un lot en parallèle risquerait des
            // doublons de référence. Chaque await se termine avant le suivant.
            for (const userId of userIds) {
                const reference = await nextReference(db, 'amlTraining', 'FORM');
                const training = await db.amlTraining.create({
                    data: { reference, userId, ...shared, recordedById: session.userId },
                });
                created.push(training);
            }
            logger_1.default.info(`Formation(s) LBC/FT enregistrée(s) : ${created.map((t) => t.reference).join(', ')}`);
            return ser({ success: true, data: created });
        }
        catch (error) {
            logger_1.default.error('aml:training:create', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:training:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const parsed = trainingUpdateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const existing = await db.amlTraining.findFirst({ where: { id: Number(id), deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Formation introuvable' };
            const training = await db.amlTraining.update({ where: { id: existing.id }, data: parsed.data });
            return ser({ success: true, data: training });
        }
        catch (error) {
            logger_1.default.error('aml:training:update', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('aml:training:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.amlTraining.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('aml:training:delete', error.message);
            return { success: false, error: error.message };
        }
    });
    /* ─── Tableau de bord ──────────────────────────────────────── */
    electron_1.ipcMain.handle('aml:dashboard:overview', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, exports.AML_ROLES);
            const db = (0, db_service_1.getDb)();
            const [byRiskLevel, pepCount, matchesToVerify, reviewsOpen, reportsByStatus] = await Promise.all([
                db.amlProfile.groupBy({ by: ['riskLevel'], where: { deletedAt: null }, _count: true }),
                db.amlProfile.count({ where: { deletedAt: null, isPep: true } }),
                db.amlWatchlistMatch.count({ where: { status: 'A_VERIFIER' } }),
                db.amlTransactionReview.count({ where: { deletedAt: null, status: { in: ['OUVERTE', 'EN_COURS'] } } }),
                db.amlSuspiciousReport.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
            ]);
            return ser({
                success: true,
                data: {
                    byRiskLevel: Object.fromEntries(byRiskLevel.map((r) => [r.riskLevel, r._count])),
                    pepCount,
                    matchesToVerify,
                    reviewsOpen,
                    reportsByStatus: Object.fromEntries(reportsByStatus.map((r) => [r.status, r._count])),
                },
            });
        }
        catch (error) {
            logger_1.default.error('aml:dashboard:overview', error.message);
            return { success: false, error: error.message };
        }
    });
}
