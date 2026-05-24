"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerContractsIPC = registerContractsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const commission_service_1 = require("../services/commission.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
// Module Contrats : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const contractBaseSchema = zod_1.z.object({
    assetType: zod_1.z.enum(['PROPERTY', 'TERRAIN']).default('PROPERTY'),
    propertyId: zod_1.z.number().int().positive().optional(),
    terrainId: zod_1.z.number().int().positive().optional(),
    clientId: zod_1.z.number().int().positive(),
    secondaryClientId: zod_1.z.number().int().positive().optional(),
    parentContractId: zod_1.z.number().int().positive().optional(),
    amendmentType: zod_1.z.enum(['PROLONGATION_DELAI', 'TRANSFERT_PROPRIETE', 'TRANSFERT_SITE']).optional(),
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
/** Types de contrat autorisés pour un terrain. */
const TERRAIN_CONTRACT_TYPES = ['SOUSCRIPTION', 'SALE', 'AVENANT', 'RESILIATION'];
/** Types de contrat autorisés pour un bien immobilier. */
const PROPERTY_CONTRACT_TYPES = ['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE'];
/** Types de contrat devant être liés à un contrat initial/précédent. */
const AMENDMENT_TYPES = ['AVENANT', 'RESILIATION'];
/** Vérifie la cohérence rattachement (bien/terrain) ↔ élément sélectionné et type de contrat. */
const contractSchema = contractBaseSchema
    .refine((d) => (d.assetType === 'TERRAIN' ? !!d.terrainId : !!d.propertyId), { message: 'Sélectionnez le bien immobilier ou le terrain rattaché au contrat' })
    .refine((d) => (d.assetType === 'TERRAIN' ? TERRAIN_CONTRACT_TYPES : PROPERTY_CONTRACT_TYPES).includes(d.type), { message: 'Le type de contrat ne correspond pas au type de rattachement (bien / terrain)' })
    .refine((d) => (AMENDMENT_TYPES.includes(d.type) ? !!d.parentContractId : true), { message: 'Un avenant ou une résiliation doit être lié à un contrat initial/précédent' })
    .refine((d) => (d.type === 'AVENANT' ? !!d.amendmentType : true), { message: 'Précisez la nature de l\'avenant' });
const INSTALLMENT_COUNTS = {
    CASH: 0, SUR_3_MOIS: 3, SUR_6_MOIS: 6, SUR_9_MOIS: 9, SUR_12_MOIS: 12,
    SUR_24_MOIS: 24, SUR_36_MOIS: 36, SUR_48_MOIS: 48, SUR_60_MOIS: 60,
};
/**
 * Génère la prochaine référence de contrat : CT-YYYY-NNNN
 */
async function nextReference(db) {
    const year = new Date().getFullYear();
    const last = await db.contract.findFirst({
        where: { reference: { startsWith: `CT-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `CT-${year}-${String(seq).padStart(4, '0')}`;
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
 * Vérifie qu'un contrat ne possède pas déjà une résiliation.
 * Un contrat peut avoir plusieurs avenants mais une seule résiliation.
 */
async function assertSingleResiliation(db, type, parentContractId, currentId) {
    if (type !== 'RESILIATION' || !parentContractId)
        return;
    const existing = await db.contract.findFirst({
        where: {
            parentContractId,
            type: 'RESILIATION',
            deletedAt: null,
            ...(currentId ? { id: { not: currentId } } : {}),
        },
        select: { reference: true },
    });
    if (existing) {
        throw new Error(`Ce contrat possède déjà une résiliation (${existing.reference})`);
    }
}
/**
 * Enregistre les handlers IPC pour la gestion des contrats.
 */
function registerContractsIPC() {
    electron_1.ipcMain.handle('contracts:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
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
                where.propertyId = filters.propertyId;
            if (filters.terrainId)
                where.terrainId = filters.terrainId;
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
                    { property: { reference: { contains: filters.search } } },
                    { terrain: { reference: { contains: filters.search } } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.contract.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        property: { select: { id: true, reference: true, address: true, city: true, type: true } },
                        terrain: {
                            select: {
                                id: true, reference: true, numeroIlot: true, numeroParcelle: true,
                                lotissement: { select: { nom: true, ville: true } },
                            },
                        },
                        client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                        agent: { select: { id: true, firstName: true, lastName: true } },
                    },
                }),
                db.contract.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('contracts:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('contracts:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const contract = await db.contract.findUnique({
                where: { id, deletedAt: null },
                include: {
                    property: { include: { owner: { select: { id: true, firstName: true, lastName: true, companyName: true } } } },
                    terrain: {
                        include: {
                            lotissement: { select: { id: true, reference: true, nom: true, ville: true } },
                            owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                        },
                    },
                    client: true,
                    secondaryClient: true,
                    parentContract: { select: { id: true, reference: true, type: true, status: true } },
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
            if (!contract)
                return { success: false, error: 'Contrat introuvable' };
            return ser({ success: true, data: contract });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('contracts:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = contractSchema.safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues
                    .map((i) => `${i.path.join('.') || 'contrat'} : ${i.message}`)
                    .join(' ; ');
                logger_1.default.error('contracts:create validation', msg);
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const d = parsed.data;
            const isTerrain = d.assetType === 'TERRAIN';
            await assertSingleResiliation(db, d.type, d.parentContractId);
            const contract = await db.contract.create({
                data: {
                    reference,
                    assetType: d.assetType,
                    propertyId: isTerrain ? null : d.propertyId,
                    terrainId: isTerrain ? d.terrainId : null,
                    clientId: d.clientId,
                    secondaryClientId: isTerrain ? (d.secondaryClientId ?? null) : null,
                    parentContractId: AMENDMENT_TYPES.includes(d.type) ? d.parentContractId : null,
                    amendmentType: d.type === 'AVENANT' ? d.amendmentType : null,
                    agentId: d.agentId,
                    type: d.type,
                    status: d.status,
                    startDate: new Date(d.startDate),
                    endDate: d.endDate ? new Date(d.endDate) : undefined,
                    signedAt: d.signedAt ? new Date(d.signedAt) : undefined,
                    rentAmount: toDecimal(d.rentAmount),
                    saleAmount: toDecimal(d.saleAmount),
                    apportInitial: toDecimal(d.apportInitial),
                    // Un contrat de terrain ne porte ni caution ni honoraires d'agence
                    deposit: isTerrain ? null : toDecimal(d.deposit),
                    agencyFees: isTerrain ? null : toDecimal(d.agencyFees),
                    charges: toDecimal(d.charges),
                    paymentDay: d.paymentDay,
                    paymentMethod: d.paymentMethod,
                    paymentModalites: d.paymentModalites,
                    installmentCount: d.installmentCount,
                    installmentAmount: toDecimal(d.installmentAmount),
                    firstInstallmentDate: d.firstInstallmentDate ? new Date(d.firstInstallmentDate) : undefined,
                    indexType: d.indexType,
                    notes: d.notes,
                },
            });
            // Met à jour le statut du bien/terrain rattaché si le contrat est ACTIVE
            if (d.status === 'ACTIVE') {
                if (isTerrain && d.terrainId) {
                    // SALE → VENDU, SOUSCRIPTION → RESERVE, RESILIATION → DISPONIBLE, AVENANT → inchangé
                    const terrainStatut = {
                        SALE: 'VENDU', SOUSCRIPTION: 'RESERVE', RESILIATION: 'DISPONIBLE',
                    };
                    const nextStatut = terrainStatut[d.type];
                    if (nextStatut) {
                        await db.terrain.update({ where: { id: d.terrainId }, data: { statut: nextStatut } });
                    }
                }
                else if (!isTerrain && d.propertyId) {
                    await db.property.update({ where: { id: d.propertyId }, data: { status: 'EN_LOCATION' } });
                }
                // Génère automatiquement la commission de l'agent à l'activation
                await (0, commission_service_1.autoGenerateContractCommission)(db, contract.id);
            }
            // Crée l'échéancier saisi dans le formulaire
            if (d.installments && d.installments.length > 0) {
                await db.saleInstallment.createMany({
                    data: d.installments.map((inst, i) => ({
                        contractId: contract.id,
                        installmentNumber: i + 1,
                        dueDate: new Date(inst.dueDate),
                        amount: inst.amount,
                        status: 'EN_ATTENTE',
                    })),
                });
            }
            logger_1.default.info(`Contract created: ${contract.reference}`);
            return ser({ success: true, data: contract });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('contracts:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = contractBaseSchema.partial().safeParse(payload);
            if (!parsed.success) {
                const msg = parsed.error.issues
                    .map((i) => `${i.path.join('.') || 'contrat'} : ${i.message}`)
                    .join(' ; ');
                logger_1.default.error('contracts:update validation', msg);
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const data = { ...d };
            delete data.installments; // relation gérée séparément, pas un champ scalaire
            if (d.startDate)
                data.startDate = new Date(d.startDate);
            if (d.endDate)
                data.endDate = new Date(d.endDate);
            if (d.signedAt)
                data.signedAt = new Date(d.signedAt);
            if (d.firstInstallmentDate)
                data.firstInstallmentDate = new Date(d.firstInstallmentDate);
            // Si le rattachement change, neutralise l'élément non sélectionné
            if (d.assetType === 'TERRAIN') {
                data.propertyId = null;
                // Un contrat de terrain ne porte ni caution ni honoraires d'agence
                data.deposit = null;
                data.agencyFees = null;
            }
            else if (d.assetType === 'PROPERTY') {
                data.terrainId = null;
                data.secondaryClientId = null;
            }
            // Le lien vers le contrat initial/précédent est réservé aux avenants et résiliations
            if (d.type && !AMENDMENT_TYPES.includes(d.type))
                data.parentContractId = null;
            // La nature de l'avenant ne s'applique qu'aux avenants
            if (d.type && d.type !== 'AVENANT')
                data.amendmentType = null;
            if (d.parentContractId && d.parentContractId === id) {
                return { success: false, error: 'Un contrat ne peut pas être lié à lui-même' };
            }
            await assertSingleResiliation(db, d.type, d.parentContractId, id);
            // Statut avant mise à jour, pour détecter le passage à ACTIVE
            const before = await db.contract.findUnique({ where: { id }, select: { status: true } });
            const contract = await db.contract.update({ where: { id, deletedAt: null }, data });
            // Remplace l'échéancier si un nouvel échéancier est fourni
            if (d.installments) {
                await db.saleInstallment.deleteMany({ where: { contractId: id } });
                if (d.installments.length > 0) {
                    await db.saleInstallment.createMany({
                        data: d.installments.map((inst, i) => ({
                            contractId: id,
                            installmentNumber: i + 1,
                            dueDate: new Date(inst.dueDate),
                            amount: inst.amount,
                            status: 'EN_ATTENTE',
                        })),
                    });
                }
            }
            // Génère automatiquement la commission de l'agent lors du passage à ACTIVE
            if (contract.status === 'ACTIVE' && before?.status !== 'ACTIVE') {
                await (0, commission_service_1.autoGenerateContractCommission)(db, contract.id);
            }
            return ser({ success: true, data: contract });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('contracts:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const db = (0, db_service_1.getDb)();
            await db.contract.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * Génère les échéances de vente pour un contrat (paymentModalites != CASH).
     */
    electron_1.ipcMain.handle('contracts:generateInstallments', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const contract = await db.contract.findUnique({
                where: { id, deletedAt: null },
                select: { id: true, saleAmount: true, apportInitial: true, paymentModalites: true, installmentCount: true, firstInstallmentDate: true },
            });
            if (!contract)
                return { success: false, error: 'Contrat introuvable' };
            if (!contract.saleAmount)
                return { success: false, error: 'Montant de vente manquant' };
            if (!contract.firstInstallmentDate)
                return { success: false, error: 'Date de première échéance manquante' };
            const count = contract.installmentCount
                ?? INSTALLMENT_COUNTS[contract.paymentModalites]
                ?? 0;
            if (count <= 0)
                return { success: false, error: 'Nombre d\'échéances invalide' };
            // Montant à financer = prix de vente - apport initial
            const totalAmount = Number(contract.saleAmount) - Number(contract.apportInitial ?? 0);
            const amountPerInstallment = Math.round((totalAmount / count) * 100) / 100;
            // Supprime les anciennes échéances
            await db.saleInstallment.deleteMany({ where: { contractId: id } });
            const installments = [];
            const firstDate = new Date(contract.firstInstallmentDate);
            for (let i = 0; i < count; i++) {
                const dueDate = new Date(firstDate);
                dueDate.setMonth(dueDate.getMonth() + i);
                installments.push({
                    contractId: id,
                    installmentNumber: i + 1,
                    dueDate,
                    amount: amountPerInstallment,
                    status: 'EN_ATTENTE',
                });
            }
            await db.saleInstallment.createMany({ data: installments });
            // Met à jour les champs calculés du contrat
            const lastDate = new Date(firstDate);
            lastDate.setMonth(lastDate.getMonth() + count - 1);
            await db.contract.update({
                where: { id },
                data: {
                    installmentCount: count,
                    installmentAmount: amountPerInstallment,
                    lastInstallmentDate: lastDate,
                },
            });
            const created = await db.saleInstallment.findMany({
                where: { contractId: id },
                orderBy: { installmentNumber: 'asc' },
            });
            logger_1.default.info(`Generated ${count} installments for contract id=${id}`);
            return ser({ success: true, data: created });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('contracts:getInstallments', async (_event, { token, contractId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const installments = await db.saleInstallment.findMany({
                where: { contractId },
                orderBy: { installmentNumber: 'asc' },
            });
            return ser({ success: true, data: installments });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
