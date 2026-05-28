"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConventionsIPC = registerConventionsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const commission_service_1 = require("../services/commission.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
// Module Conventions : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const conventionBaseSchema = zod_1.z.object({
    assetType: zod_1.z.enum(['PROPERTY', 'TERRAIN']).default('PROPERTY'),
    // Listes des biens / terrains rattachés à la convention (selon assetType).
    // Une convention peut couvrir plusieurs biens OU plusieurs terrains.
    propertyIds: zod_1.z.array(zod_1.z.number().int().positive()).optional(),
    terrainIds: zod_1.z.array(zod_1.z.number().int().positive()).optional(),
    clientId: zod_1.z.number().int().positive(),
    secondaryClientId: zod_1.z.number().int().positive().optional(),
    parentConventionId: zod_1.z.number().int().positive().optional(),
    amendmentType: zod_1.z.enum(['PROLONGATION_DELAI', 'TRANSFERT_PROPRIETE', 'TRANSFERT_SITE']).optional(),
    souscriptionType: zod_1.z.enum(['STANDARD', 'AVEC_ACD', 'FINANCEMENT_PROJET']).optional(),
    agentId: zod_1.z.number().int().optional(),
    type: zod_1.z.enum(['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION']),
    status: zod_1.z.enum(['BROUILLON', 'ACTIVE', 'EXPIRE', 'TERMINER', 'ANNULE', 'ATTENTE_SIGNATURE']).default('BROUILLON'),
    startDate: zod_1.z.string().datetime(),
    endDate: zod_1.z.string().datetime().optional(),
    signedAt: zod_1.z.string().datetime().optional(),
    rentAmount: zod_1.z.number().optional(),
    saleAmount: zod_1.z.number().optional(),
    apportInitial: zod_1.z.number().optional(),
    deposit: zod_1.z.number().optional(),
    agencyFees: zod_1.z.number().optional(),
    charges: zod_1.z.number().optional(),
    fraisOuvertureDossier: zod_1.z.number().optional(),
    // Avenant de transfert de site uniquement — complément éventuel à payer
    // lié au changement de lot. Ignoré pour tout autre type de convention.
    additionalAmount: zod_1.z.number().optional(),
    paymentDay: zod_1.z.number().int().min(1).max(31).optional(),
    paymentMethod: zod_1.z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'NON_DEFINI']).default('ESPECE'),
    paymentModalites: zod_1.z.enum(['CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS', 'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS']).default('CASH'),
    installmentCount: zod_1.z.number().int().optional(),
    installmentAmount: zod_1.z.number().optional(),
    firstInstallmentDate: zod_1.z.string().datetime().optional(),
    // Échéancier saisi dans le formulaire (dates + montants par échéance)
    installments: zod_1.z.array(zod_1.z.object({
        dueDate: zod_1.z.string(),
        amount: zod_1.z.number(),
    })).optional(),
    indexType: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
/** Types de convention autorisés pour un terrain. */
const TERRAIN_CONVENTION_TYPES = ['SOUSCRIPTION', 'SALE', 'AVENANT', 'RESILIATION'];
/** Types de convention autorisés pour un bien immobilier. */
const PROPERTY_CONVENTION_TYPES = ['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE'];
/** Types de convention devant être liés à une convention initiale/précédente. */
const AMENDMENT_TYPES = ['AVENANT', 'RESILIATION'];
/** Vérifie la cohérence rattachement (bien/terrain) ↔ élément sélectionné et type de convention. */
const conventionSchema = conventionBaseSchema
    .refine((d) => (d.assetType === 'TERRAIN'
    ? (d.terrainIds && d.terrainIds.length > 0)
    : (d.propertyIds && d.propertyIds.length > 0)), { message: 'Sélectionnez au moins un bien immobilier ou un terrain à rattacher à la convention' })
    .refine((d) => (d.assetType === 'TERRAIN' ? TERRAIN_CONVENTION_TYPES : PROPERTY_CONVENTION_TYPES).includes(d.type), { message: 'Le type de convention ne correspond pas au type de rattachement (bien / terrain)' })
    .refine((d) => (AMENDMENT_TYPES.includes(d.type) ? !!d.parentConventionId : true), { message: 'Un avenant ou une résiliation doit être lié à une convention initiale/précédente' })
    .refine((d) => (d.type === 'AVENANT' ? !!d.amendmentType : true), { message: 'Précisez la nature de l\'avenant' })
    .refine((d) => (d.type === 'SOUSCRIPTION' ? !!d.souscriptionType : true), { message: 'Précisez la nature de la souscription' });
const INSTALLMENT_COUNTS = {
    CASH: 0, SUR_3_MOIS: 3, SUR_6_MOIS: 6, SUR_9_MOIS: 9, SUR_12_MOIS: 12,
    SUR_24_MOIS: 24, SUR_36_MOIS: 36, SUR_48_MOIS: 48, SUR_60_MOIS: 60,
};
/**
 * Génère la prochaine référence de convention : CV-YYYY-NNNN
 */
async function nextReference(db) {
    const year = new Date().getFullYear();
    const last = await db.convention.findFirst({
        where: { reference: { startsWith: `CV-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `CV-${year}-${String(seq).padStart(4, '0')}`;
}
function toDecimal(val) {
    return val;
}
/**
 * Sérialise une valeur pour l'IPC : les objets `Decimal` de Prisma ne sont pas
 * clonables par Electron. Le round-trip JSON les convertit en types simples.
 */
const ser = (v) => JSON.parse(JSON.stringify(v));
/**
 * Vérifie que tous les terrains rattachés à une convention proviennent du
 * même lotissement (règle métier : pas de mélange entre lotissements).
 * Les terrains sans lotissement sont autorisés à condition que TOUS les
 * terrains de la convention le soient.
 */
async function assertSingleLotissement(db, terrainIds) {
    if (!terrainIds || terrainIds.length < 2)
        return;
    const terrains = await db.terrain.findMany({
        where: { id: { in: terrainIds } },
        select: { id: true, reference: true, lotissementId: true },
    });
    const lotIds = new Set(terrains.map((t) => t.lotissementId ?? null));
    if (lotIds.size > 1) {
        throw new Error('Tous les terrains rattachés à une convention doivent provenir du même lotissement.');
    }
}
/**
 * Vérifie qu'une convention ne possède pas déjà une résiliation.
 * Une convention peut avoir plusieurs avenants mais une seule résiliation.
 */
async function assertSingleResiliation(db, type, parentConventionId, currentId) {
    if (type !== 'RESILIATION' || !parentConventionId)
        return;
    const existing = await db.convention.findFirst({
        where: {
            parentConventionId,
            type: 'RESILIATION',
            deletedAt: null,
            ...(currentId ? { id: { not: currentId } } : {}),
        },
        select: { reference: true },
    });
    if (existing) {
        throw new Error(`Cette convention possède déjà une résiliation (${existing.reference})`);
    }
}
/** Include utilisé pour récupérer les biens et terrains rattachés à une convention en liste. */
const linksIncludeList = {
    properties: {
        orderBy: { order: 'asc' },
        include: {
            property: { select: { id: true, reference: true, address: true, city: true, type: true } },
        },
    },
    terrains: {
        orderBy: { order: 'asc' },
        include: {
            terrain: {
                select: {
                    id: true, reference: true, numeroIlot: true, numeroParcelle: true,
                    lotissement: { select: { nom: true, ville: true } },
                },
            },
        },
    },
};
/** Include utilisé pour la fiche détail d'une convention (relations enrichies). */
const linksIncludeDetail = {
    properties: {
        orderBy: { order: 'asc' },
        include: {
            property: {
                include: {
                    owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                },
            },
        },
    },
    terrains: {
        orderBy: { order: 'asc' },
        include: {
            terrain: {
                include: {
                    lotissement: {
                        select: {
                            id: true, reference: true, nom: true,
                            commune: true, ville: true, pays: true,
                            titleNumber: true,
                            titleType: { select: { id: true, code: true, label: true, documentsLivres: true } },
                        },
                    },
                    owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                },
            },
        },
    },
};
/**
 * Enregistre les handlers IPC pour la gestion des conventions.
 */
function registerConventionsIPC() {
    electron_1.ipcMain.handle('conventions:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.type)
                where.type = filters.type;
            if (filters.status)
                where.status = filters.status;
            if (filters.clientId)
                where.clientId = filters.clientId;
            if (filters.propertyId)
                where.properties = { some: { propertyId: Number(filters.propertyId) } };
            if (filters.terrainId)
                where.terrains = { some: { terrainId: Number(filters.terrainId) } };
            if (filters.assetType)
                where.assetType = filters.assetType;
            if (filters.agentId)
                where.agentId = filters.agentId;
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { notes: { contains: filters.search } },
                    { client: { firstName: { contains: filters.search } } },
                    { client: { lastName: { contains: filters.search } } },
                    { properties: { some: { property: { reference: { contains: filters.search } } } } },
                    { terrains: { some: { terrain: { reference: { contains: filters.search } } } } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.convention.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        ...linksIncludeList,
                        client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                        agent: { select: { id: true, firstName: true, lastName: true } },
                    },
                }),
                db.convention.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('conventions:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventions:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const convention = await db.convention.findUnique({
                where: { id, deletedAt: null },
                include: {
                    ...linksIncludeDetail,
                    client: { include: { idType: { select: { id: true, code: true, label: true } } } },
                    secondaryClient: { include: { idType: { select: { id: true, code: true, label: true } } } },
                    // Convention parente — on charge en plus signedAt, saleAmount,
                    // apportInitial, l'échéancier (pour le solde), la liste de ses
                    // amendments (pour le numéro d'avenant courant) et le premier
                    // terrain rattaché avec son lotissement (pour les variables
                    // {{convention.initiale.lotissement.*}}).
                    parentConvention: {
                        select: {
                            id: true, reference: true, type: true, status: true,
                            signedAt: true, saleAmount: true, apportInitial: true,
                            // Nécessaire pour distinguer paiement comptant (CASH) et
                            // paiement échelonné dans le calcul du total des versements.
                            paymentModalites: true,
                            installments: {
                                select: { id: true, amount: true, status: true },
                                orderBy: { installmentNumber: 'asc' },
                            },
                            amendments: {
                                where: { deletedAt: null },
                                select: { id: true, createdAt: true, reference: true },
                                orderBy: { createdAt: 'asc' },
                            },
                            terrains: {
                                orderBy: { order: 'asc' },
                                select: {
                                    terrain: {
                                        select: {
                                            id: true,
                                            // Champs requis par lotsEnumeration() pour le rendu de
                                            // la variable {{convention.initiale.lotsSouscrits}}.
                                            numeroIlot: true, numeroParcelle: true, surface: true,
                                            lotissement: { select: { id: true, nom: true, ville: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    amendments: {
                        where: { deletedAt: null },
                        select: { id: true, reference: true, type: true, status: true, createdAt: true },
                        orderBy: { createdAt: 'asc' },
                    },
                    agent: { select: { id: true, firstName: true, lastName: true } },
                    installments: { orderBy: { installmentNumber: 'asc' } },
                    invoices: { where: { deletedAt: null }, orderBy: { issueDate: 'desc' }, take: 20 },
                    documents: { orderBy: { uploadedAt: 'desc' } },
                },
            });
            if (!convention)
                return { success: false, error: 'Convention introuvable' };
            return ser({ success: true, data: convention });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventions:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = conventionSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues
                    .map((i) => `${i.path.join('.') || 'convention'} : ${i.message}`)
                    .join(' ; ');
                logger_1.default.error('conventions:create validation', msg);
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const d = parsed.data;
            const isTerrain = d.assetType === 'TERRAIN';
            await assertSingleResiliation(db, d.type, d.parentConventionId);
            const propertyIds = isTerrain ? [] : (d.propertyIds ?? []);
            const terrainIds = isTerrain ? (d.terrainIds ?? []) : [];
            if (isTerrain)
                await assertSingleLotissement(db, terrainIds);
            const convention = await db.convention.create({
                data: {
                    reference,
                    assetType: d.assetType,
                    clientId: d.clientId,
                    secondaryClientId: isTerrain ? (d.secondaryClientId ?? null) : null,
                    parentConventionId: AMENDMENT_TYPES.includes(d.type) ? d.parentConventionId : null,
                    amendmentType: d.type === 'AVENANT' ? d.amendmentType : null,
                    souscriptionType: d.type === 'SOUSCRIPTION' ? d.souscriptionType : null,
                    agentId: d.agentId,
                    type: d.type,
                    status: d.status,
                    startDate: new Date(d.startDate),
                    endDate: d.endDate ? new Date(d.endDate) : undefined,
                    signedAt: d.signedAt ? new Date(d.signedAt) : undefined,
                    rentAmount: toDecimal(d.rentAmount),
                    saleAmount: toDecimal(d.saleAmount),
                    apportInitial: toDecimal(d.apportInitial),
                    // Une convention de terrain ne porte ni caution ni honoraires d'agence
                    deposit: isTerrain ? null : toDecimal(d.deposit),
                    agencyFees: isTerrain ? null : toDecimal(d.agencyFees),
                    charges: toDecimal(d.charges),
                    fraisOuvertureDossier: toDecimal(d.fraisOuvertureDossier),
                    // additionalAmount n'a de sens que pour l'avenant de transfert de site
                    additionalAmount: (d.type === 'AVENANT' && d.amendmentType === 'TRANSFERT_SITE')
                        ? toDecimal(d.additionalAmount)
                        : null,
                    paymentDay: d.paymentDay,
                    paymentMethod: d.paymentMethod,
                    paymentModalites: d.paymentModalites,
                    installmentCount: d.installmentCount,
                    installmentAmount: toDecimal(d.installmentAmount),
                    firstInstallmentDate: d.firstInstallmentDate ? new Date(d.firstInstallmentDate) : undefined,
                    indexType: d.indexType,
                    notes: d.notes,
                    properties: propertyIds.length > 0
                        ? { create: propertyIds.map((propertyId, i) => ({ propertyId, order: i })) }
                        : undefined,
                    terrains: terrainIds.length > 0
                        ? { create: terrainIds.map((terrainId, i) => ({ terrainId, order: i })) }
                        : undefined,
                },
            });
            // Met à jour le statut du bien/terrain rattaché si la convention est ACTIVE
            if (d.status === 'ACTIVE') {
                if (isTerrain && terrainIds.length > 0) {
                    // SALE → VENDU, SOUSCRIPTION → RESERVE, RESILIATION → DISPONIBLE, AVENANT → inchangé
                    const terrainStatut = {
                        SALE: 'VENDU', SOUSCRIPTION: 'RESERVE', RESILIATION: 'DISPONIBLE',
                    };
                    const nextStatut = terrainStatut[d.type];
                    if (nextStatut) {
                        // Pour les transitions vers RESERVE / VENDU, le client principal
                        // de la convention devient l'attributaire des terrains rattachés
                        // (règle métier : un statut non-DISPONIBLE exige un attributaire).
                        // Pour RESILIATION → DISPONIBLE, on détache l'attributaire.
                        const data = { statut: nextStatut };
                        if (nextStatut === 'RESERVE' || nextStatut === 'VENDU') {
                            data.clientId = d.clientId;
                        }
                        else if (nextStatut === 'DISPONIBLE') {
                            data.clientId = null;
                        }
                        await db.terrain.updateMany({ where: { id: { in: terrainIds } }, data });
                    }
                }
                else if (!isTerrain && propertyIds.length > 0) {
                    await db.property.updateMany({ where: { id: { in: propertyIds } }, data: { status: 'EN_LOCATION' } });
                }
                // Génère automatiquement la commission de l'agent à l'activation
                await (0, commission_service_1.autoGenerateConventionCommission)(db, convention.id);
            }
            // Crée l'échéancier saisi dans le formulaire
            if (d.installments && d.installments.length > 0) {
                await db.saleInstallment.createMany({
                    data: d.installments.map((inst, i) => ({
                        conventionId: convention.id,
                        installmentNumber: i + 1,
                        dueDate: new Date(inst.dueDate),
                        amount: inst.amount,
                        status: 'EN_ATTENTE',
                    })),
                });
            }
            logger_1.default.info(`Convention created: ${convention.reference}`);
            return ser({ success: true, data: convention });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventions:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = conventionBaseSchema.partial().safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues
                    .map((i) => `${i.path.join('.') || 'convention'} : ${i.message}`)
                    .join(' ; ');
                logger_1.default.error('conventions:update validation', msg);
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const data = { ...d };
            // Champs traités séparément (relations / dates)
            delete data.installments;
            delete data.propertyIds;
            delete data.terrainIds;
            if (d.startDate)
                data.startDate = new Date(d.startDate);
            if (d.endDate)
                data.endDate = new Date(d.endDate);
            if (d.signedAt)
                data.signedAt = new Date(d.signedAt);
            if (d.firstInstallmentDate)
                data.firstInstallmentDate = new Date(d.firstInstallmentDate);
            // Si le rattachement change, neutralise les liens du type non sélectionné
            if (d.assetType === 'TERRAIN') {
                // Une convention de terrain ne porte ni caution ni honoraires d'agence
                data.deposit = null;
                data.agencyFees = null;
            }
            else if (d.assetType === 'PROPERTY') {
                data.secondaryClientId = null;
            }
            // Le lien vers la convention initiale/précédente est réservé aux avenants et résiliations
            if (d.type && !AMENDMENT_TYPES.includes(d.type))
                data.parentConventionId = null;
            // La nature de l'avenant ne s'applique qu'aux avenants
            if (d.type && d.type !== 'AVENANT')
                data.amendmentType = null;
            // La nature de la souscription ne s'applique qu'aux souscriptions
            if (d.type && d.type !== 'SOUSCRIPTION')
                data.souscriptionType = null;
            // Le montant supplémentaire ne concerne que l'avenant de transfert de site —
            // pour tout autre type / nature, on neutralise la valeur côté base.
            if (d.type && !(d.type === 'AVENANT' && d.amendmentType === 'TRANSFERT_SITE')) {
                data.additionalAmount = null;
            }
            if (d.parentConventionId && d.parentConventionId === id) {
                return { success: false, error: 'Une convention ne peut pas être liée à elle-même' };
            }
            await assertSingleResiliation(db, d.type, d.parentConventionId, id);
            // Statut avant mise à jour, pour détecter le passage à ACTIVE
            const before = await db.convention.findUnique({
                where: { id },
                select: { status: true, assetType: true },
            });
            const convention = await db.convention.update({ where: { id, deletedAt: null }, data });
            // Remplace les rattachements si une liste est fournie
            const effectiveAssetType = d.assetType ?? before?.assetType ?? 'PROPERTY';
            if (d.propertyIds !== undefined || d.assetType === 'TERRAIN') {
                // Tout passage à TERRAIN supprime les biens ; sinon on remplace selon la liste fournie
                await db.conventionProperty.deleteMany({ where: { conventionId: id } });
                if (effectiveAssetType === 'PROPERTY' && d.propertyIds && d.propertyIds.length > 0) {
                    await db.conventionProperty.createMany({
                        data: d.propertyIds.map((propertyId, i) => ({ conventionId: id, propertyId, order: i })),
                    });
                }
            }
            if (d.terrainIds !== undefined || d.assetType === 'PROPERTY') {
                if (effectiveAssetType === 'TERRAIN') {
                    await assertSingleLotissement(db, d.terrainIds);
                }
                await db.conventionTerrain.deleteMany({ where: { conventionId: id } });
                if (effectiveAssetType === 'TERRAIN' && d.terrainIds && d.terrainIds.length > 0) {
                    await db.conventionTerrain.createMany({
                        data: d.terrainIds.map((terrainId, i) => ({ conventionId: id, terrainId, order: i })),
                    });
                }
            }
            // Remplace l'échéancier si un nouvel échéancier est fourni
            if (d.installments) {
                await db.saleInstallment.deleteMany({ where: { conventionId: id } });
                if (d.installments.length > 0) {
                    await db.saleInstallment.createMany({
                        data: d.installments.map((inst, i) => ({
                            conventionId: id,
                            installmentNumber: i + 1,
                            dueDate: new Date(inst.dueDate),
                            amount: inst.amount,
                            status: 'EN_ATTENTE',
                        })),
                    });
                }
            }
            // Lors du passage à ACTIVE : applique le statut induit aux biens / terrains
            // rattachés (mêmes règles que la création), puis génère la commission.
            if (convention.status === 'ACTIVE' && before?.status !== 'ACTIVE') {
                if (effectiveAssetType === 'TERRAIN') {
                    const links = await db.conventionTerrain.findMany({
                        where: { conventionId: id },
                        select: { terrainId: true },
                    });
                    const ids = links.map((l) => l.terrainId);
                    const terrainStatut = {
                        SALE: 'VENDU', SOUSCRIPTION: 'RESERVE', RESILIATION: 'DISPONIBLE',
                    };
                    const nextStatut = terrainStatut[convention.type];
                    if (nextStatut && ids.length > 0) {
                        // Pour les transitions vers RESERVE / VENDU, le client principal
                        // de la convention devient l'attributaire des terrains rattachés.
                        // Pour RESILIATION → DISPONIBLE, on détache l'attributaire.
                        const updateData = { statut: nextStatut };
                        if (nextStatut === 'RESERVE' || nextStatut === 'VENDU') {
                            updateData.clientId = convention.clientId;
                        }
                        else if (nextStatut === 'DISPONIBLE') {
                            updateData.clientId = null;
                        }
                        await db.terrain.updateMany({ where: { id: { in: ids } }, data: updateData });
                    }
                }
                else {
                    const links = await db.conventionProperty.findMany({
                        where: { conventionId: id },
                        select: { propertyId: true },
                    });
                    const ids = links.map((l) => l.propertyId);
                    if (ids.length > 0) {
                        await db.property.updateMany({ where: { id: { in: ids } }, data: { status: 'EN_LOCATION' } });
                    }
                }
                await (0, commission_service_1.autoGenerateConventionCommission)(db, convention.id);
            }
            return ser({ success: true, data: convention });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventions:statusStats', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.type)
                where.type = filters.type;
            if (filters.clientId)
                where.clientId = filters.clientId;
            if (filters.propertyId)
                where.properties = { some: { propertyId: Number(filters.propertyId) } };
            if (filters.terrainId)
                where.terrains = { some: { terrainId: Number(filters.terrainId) } };
            if (filters.assetType)
                where.assetType = filters.assetType;
            if (filters.agentId)
                where.agentId = filters.agentId;
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { notes: { contains: filters.search } },
                    { client: { firstName: { contains: filters.search } } },
                    { client: { lastName: { contains: filters.search } } },
                    { properties: { some: { property: { reference: { contains: filters.search } } } } },
                    { terrains: { some: { terrain: { reference: { contains: filters.search } } } } },
                ];
            }
            const rows = await db.convention.groupBy({
                by: ['status'],
                where,
                _count: { _all: true },
            });
            const stats = {
                BROUILLON: 0, ATTENTE_SIGNATURE: 0, ACTIVE: 0,
                EXPIRE: 0, TERMINER: 0, ANNULE: 0,
            };
            let total = 0;
            for (const r of rows) {
                const n = r._count?._all ?? 0;
                stats[r.status] = n;
                total += n;
            }
            return { success: true, data: { ...stats, total } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventions:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const db = (0, db_service_1.getDb)();
            await db.convention.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * Génère les échéances de vente pour une convention (paymentModalites != CASH).
     */
    electron_1.ipcMain.handle('conventions:generateInstallments', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const convention = await db.convention.findUnique({
                where: { id, deletedAt: null },
                select: { id: true, saleAmount: true, apportInitial: true, paymentModalites: true, installmentCount: true, firstInstallmentDate: true },
            });
            if (!convention)
                return { success: false, error: 'Convention introuvable' };
            if (!convention.saleAmount)
                return { success: false, error: 'Montant de vente manquant' };
            if (!convention.firstInstallmentDate)
                return { success: false, error: 'Date de première échéance manquante' };
            const count = convention.installmentCount
                ?? INSTALLMENT_COUNTS[convention.paymentModalites]
                ?? 0;
            if (count <= 0)
                return { success: false, error: 'Nombre d\'échéances invalide' };
            // Montant à financer = prix de vente - apport initial
            const totalAmount = Number(convention.saleAmount) - Number(convention.apportInitial ?? 0);
            const amountPerInstallment = Math.round((totalAmount / count) * 100) / 100;
            // Supprime les anciennes échéances
            await db.saleInstallment.deleteMany({ where: { conventionId: id } });
            const installments = [];
            const firstDate = new Date(convention.firstInstallmentDate);
            for (let i = 0; i < count; i++) {
                const dueDate = new Date(firstDate);
                dueDate.setMonth(dueDate.getMonth() + i);
                installments.push({
                    conventionId: id,
                    installmentNumber: i + 1,
                    dueDate,
                    amount: amountPerInstallment,
                    status: 'EN_ATTENTE',
                });
            }
            await db.saleInstallment.createMany({ data: installments });
            // Met à jour les champs calculés de la convention
            const lastDate = new Date(firstDate);
            lastDate.setMonth(lastDate.getMonth() + count - 1);
            await db.convention.update({
                where: { id },
                data: {
                    installmentCount: count,
                    installmentAmount: amountPerInstallment,
                    lastInstallmentDate: lastDate,
                },
            });
            const created = await db.saleInstallment.findMany({
                where: { conventionId: id },
                orderBy: { installmentNumber: 'asc' },
            });
            logger_1.default.info(`Generated ${count} installments for convention id=${id}`);
            return ser({ success: true, data: created });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('conventions:getInstallments', async (_event, { token, conventionId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const installments = await db.saleInstallment.findMany({
                where: { conventionId },
                orderBy: { installmentNumber: 'asc' },
            });
            return ser({ success: true, data: installments });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * Met à jour la date d'échéance et/ou le montant d'une ou plusieurs lignes
     * d'échéances d'une convention. Refuse toute modification d'une ligne payée
     * et exige que la somme totale (lignes payées + lignes modifiées) corresponde
     * au montant à financer (saleAmount - apportInitial), à 1 centime près.
     */
    electron_1.ipcMain.handle('conventions:updateInstallments', async (_event, { token, conventionId, installments }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const updateSchema = zod_1.z.object({
                conventionId: zod_1.z.number().int().positive(),
                installments: zod_1.z.array(zod_1.z.object({
                    id: zod_1.z.number().int().positive(),
                    dueDate: zod_1.z.string(),
                    amount: zod_1.z.number().nonnegative(),
                })).min(1),
            });
            const parsed = updateSchema.safeParse({ conventionId, installments });
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const convention = await db.convention.findUnique({
                where: { id: conventionId, deletedAt: null },
                select: { id: true, saleAmount: true, apportInitial: true },
            });
            if (!convention)
                return { success: false, error: 'Convention introuvable' };
            if (!convention.saleAmount)
                return { success: false, error: 'Montant de vente manquant' };
            const existing = await db.saleInstallment.findMany({
                where: { conventionId },
                orderBy: { installmentNumber: 'asc' },
            });
            if (existing.length === 0)
                return { success: false, error: 'Aucune échéance à modifier' };
            const updatesById = new Map();
            for (const u of parsed.data.installments)
                updatesById.set(u.id, { dueDate: u.dueDate, amount: u.amount });
            // Toute ligne modifiée doit appartenir à la convention et ne pas être PAYE
            for (const u of parsed.data.installments) {
                const found = existing.find((e) => e.id === u.id);
                if (!found)
                    return { success: false, error: `Échéance #${u.id} introuvable pour cette convention` };
                if (found.status === 'PAYE') {
                    return { success: false, error: `L'échéance n°${found.installmentNumber} est payée et ne peut pas être modifiée` };
                }
            }
            // Recompose le total final : pour chaque ligne existante, on prend
            // soit la valeur modifiée, soit le montant actuel (cas des lignes non touchées).
            const expectedTotal = Number(convention.saleAmount) - Number(convention.apportInitial ?? 0);
            let newTotal = 0;
            for (const e of existing) {
                const u = updatesById.get(e.id);
                newTotal += u ? u.amount : Number(e.amount);
            }
            // Tolérance de 1 centime pour absorber les arrondis flottants
            if (Math.abs(newTotal - expectedTotal) > 0.01) {
                return {
                    success: false,
                    error: `Le total des échéances (${newTotal.toFixed(2)}) ne correspond pas au montant à payer (${expectedTotal.toFixed(2)})`,
                };
            }
            await db.$transaction(parsed.data.installments.map((u) => db.saleInstallment.update({
                where: { id: u.id },
                data: { dueDate: new Date(u.dueDate), amount: u.amount },
            })));
            // Recalcule la date de dernière échéance et le montant unitaire moyen
            const refreshed = await db.saleInstallment.findMany({
                where: { conventionId },
                orderBy: { installmentNumber: 'asc' },
            });
            const lastDue = refreshed.reduce((acc, r) => {
                const d = new Date(r.dueDate);
                return !acc || d > acc ? d : acc;
            }, null);
            await db.convention.update({
                where: { id: conventionId },
                data: {
                    lastInstallmentDate: lastDue ?? undefined,
                    installmentAmount: refreshed.length > 0 ? Number(refreshed[0].amount) : undefined,
                },
            });
            logger_1.default.info(`Updated ${parsed.data.installments.length} installments for convention id=${conventionId}`);
            return ser({ success: true, data: refreshed });
        }
        catch (error) {
            logger_1.default.error('conventions:updateInstallments error', error.message);
            return { success: false, error: error.message };
        }
    });
}
