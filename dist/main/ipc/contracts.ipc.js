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
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
const contractBaseSchema = zod_1.z.object({
    assetType: zod_1.z.enum(['PROPERTY', 'TERRAIN']).default('PROPERTY'),
    propertyId: zod_1.z.number().int().positive().optional(),
    terrainId: zod_1.z.number().int().positive().optional(),
    clientId: zod_1.z.number().int().positive(),
    agentId: zod_1.z.number().int().optional(),
    type: zod_1.z.enum(['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE']),
    status: zod_1.z.enum(['BROUILLON', 'ACTIVE', 'EXPIRE', 'TERMINER', 'ANNULE', 'ATTENTE_SIGNATURE']).default('BROUILLON'),
    startDate: zod_1.z.string().datetime(),
    endDate: zod_1.z.string().datetime().optional(),
    signedAt: zod_1.z.string().datetime().optional(),
    rentAmount: zod_1.z.number().optional(),
    saleAmount: zod_1.z.number().optional(),
    deposit: zod_1.z.number().optional(),
    agencyFees: zod_1.z.number().optional(),
    charges: zod_1.z.number().optional(),
    paymentDay: zod_1.z.number().int().min(1).max(31).optional(),
    paymentMethod: zod_1.z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY']).default('ESPECE'),
    paymentModalites: zod_1.z.enum(['CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS', 'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS']).default('CASH'),
    installmentCount: zod_1.z.number().int().optional(),
    installmentAmount: zod_1.z.number().optional(),
    firstInstallmentDate: zod_1.z.string().datetime().optional(),
    indexType: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
/** Vérifie qu'un bien OU un terrain est rattaché au contrat selon le type choisi. */
const contractSchema = contractBaseSchema.refine((d) => (d.assetType === 'TERRAIN' ? !!d.terrainId : !!d.propertyId), { message: 'Sélectionnez le bien immobilier ou le terrain rattaché au contrat' });
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
            return { success: true, data, total };
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
                    agent: { select: { id: true, firstName: true, lastName: true } },
                    installments: { orderBy: { installmentNumber: 'asc' } },
                    invoices: { where: { deletedAt: null }, orderBy: { issueDate: 'desc' }, take: 20 },
                    documents: { orderBy: { uploadedAt: 'desc' } },
                },
            });
            if (!contract)
                return { success: false, error: 'Contrat introuvable' };
            return { success: true, data: contract };
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
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const d = parsed.data;
            const isTerrain = d.assetType === 'TERRAIN';
            const contract = await db.contract.create({
                data: {
                    reference,
                    assetType: d.assetType,
                    propertyId: isTerrain ? null : d.propertyId,
                    terrainId: isTerrain ? d.terrainId : null,
                    clientId: d.clientId,
                    agentId: d.agentId,
                    type: d.type,
                    status: d.status,
                    startDate: new Date(d.startDate),
                    endDate: d.endDate ? new Date(d.endDate) : undefined,
                    signedAt: d.signedAt ? new Date(d.signedAt) : undefined,
                    rentAmount: toDecimal(d.rentAmount),
                    saleAmount: toDecimal(d.saleAmount),
                    deposit: toDecimal(d.deposit),
                    agencyFees: toDecimal(d.agencyFees),
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
                    await db.terrain.update({
                        where: { id: d.terrainId },
                        data: { statut: d.type === 'SALE' ? 'VENDU' : 'RESERVE' },
                    });
                }
                else if (!isTerrain && d.propertyId) {
                    await db.property.update({ where: { id: d.propertyId }, data: { status: 'EN_LOCATION' } });
                }
                // Génère automatiquement la commission de l'agent à l'activation
                await (0, commission_service_1.autoGenerateContractCommission)(db, contract.id);
            }
            logger_1.default.info(`Contract created: ${contract.reference}`);
            return { success: true, data: contract };
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
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const data = { ...d };
            if (d.startDate)
                data.startDate = new Date(d.startDate);
            if (d.endDate)
                data.endDate = new Date(d.endDate);
            if (d.signedAt)
                data.signedAt = new Date(d.signedAt);
            if (d.firstInstallmentDate)
                data.firstInstallmentDate = new Date(d.firstInstallmentDate);
            // Si le rattachement change, neutralise l'élément non sélectionné
            if (d.assetType === 'TERRAIN')
                data.propertyId = null;
            else if (d.assetType === 'PROPERTY')
                data.terrainId = null;
            // Statut avant mise à jour, pour détecter le passage à ACTIVE
            const before = await db.contract.findUnique({ where: { id }, select: { status: true } });
            const contract = await db.contract.update({ where: { id, deletedAt: null }, data });
            // Génère automatiquement la commission de l'agent lors du passage à ACTIVE
            if (contract.status === 'ACTIVE' && before?.status !== 'ACTIVE') {
                await (0, commission_service_1.autoGenerateContractCommission)(db, contract.id);
            }
            return { success: true, data: contract };
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
                select: { id: true, saleAmount: true, paymentModalites: true, installmentCount: true, firstInstallmentDate: true },
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
            const totalAmount = Number(contract.saleAmount);
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
            return { success: true, data: created };
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
            return { success: true, data: installments };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
