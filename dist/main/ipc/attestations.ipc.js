"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAttestationsIPC = registerAttestationsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
const ATTESTATION_TYPES = ['ATTRIBUTION', 'CESSION', 'SOLDE', 'TRANSFERT_PROPRIETE'];
const attestationSchema = zod_1.z
    .object({
    type: zod_1.z.enum(ATTESTATION_TYPES),
    clientId: zod_1.z.number().int().positive(),
    secondaryClientId: zod_1.z.number().int().positive().optional(),
    terrainId: zod_1.z.number().int().positive().optional(),
    propertyId: zod_1.z.number().int().positive().optional(),
    conventionId: zod_1.z.number().int().positive().optional(),
    templateId: zod_1.z.number().int().positive().optional(),
    emittedAt: zod_1.z.string().optional(),
    amount: zod_1.z.number().optional(),
    notes: zod_1.z.string().optional(),
})
    .refine((d) => (d.type === 'CESSION' ? !!d.secondaryClientId : true), { message: 'Une attestation de cession nécessite un cédant (client secondaire)' })
    .refine((d) => (d.type === 'CESSION' ? d.clientId !== d.secondaryClientId : true), { message: 'Le cessionnaire et le cédant doivent être deux clients différents' })
    .refine((d) => !!d.terrainId || !!d.propertyId, { message: 'Sélectionnez un terrain ou un bien immobilier pour l\'attestation' });
/**
 * Sérialise une valeur pour l'IPC : les objets Decimal de Prisma ne sont pas
 * clonables nativement par Electron. Round-trip JSON → types primitifs.
 */
const ser = (v) => JSON.parse(JSON.stringify(v));
/** Référence auto : ATT-YYYY-NNNN, séquence annuelle. */
async function nextReference(db) {
    const year = new Date().getFullYear();
    const last = await db.attestation.findFirst({
        where: { reference: { startsWith: `ATT-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `ATT-${year}-${String(seq).padStart(4, '0')}`;
}
const INCLUDE = {
    client: true,
    secondaryClient: true,
    terrain: { include: { lotissement: true } },
    property: true,
    convention: true,
    template: true,
    emittedBy: { select: { id: true, firstName: true, lastName: true, matricule: true } },
};
/**
 * Met à jour les champs `numeroAttestationAttribution` / `numeroAttestationCession`
 * sur le terrain rattaché lorsqu'une attestation pertinente est émise.
 */
async function syncTerrainAttestationFields(db, terrainId, type, reference) {
    if (!terrainId)
        return;
    if (type === 'ATTRIBUTION') {
        await db.terrain.update({
            where: { id: terrainId },
            data: { numeroAttestationAttribution: reference },
        });
    }
    else if (type === 'CESSION') {
        await db.terrain.update({
            where: { id: terrainId },
            data: { numeroAttestationCession: reference },
        });
    }
}
function registerAttestationsIPC() {
    electron_1.ipcMain.handle('attestations:list', async (_event, { token, filters = {}, page = 1, limit = 50 }) => {
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
                where.clientId = Number(filters.clientId);
            if (filters.conventionId)
                where.conventionId = Number(filters.conventionId);
            if (filters.terrainId)
                where.terrainId = Number(filters.terrainId);
            if (filters.propertyId)
                where.propertyId = Number(filters.propertyId);
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { notes: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.attestation.findMany({
                    where,
                    include: INCLUDE,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { emittedAt: 'desc' },
                }),
                db.attestation.count({ where }),
            ]);
            return { success: true, data: ser(data), total };
        }
        catch (error) {
            logger_1.default.error('attestations:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const attestation = await db.attestation.findUnique({ where: { id }, include: INCLUDE });
            if (!attestation || attestation.deletedAt)
                return { success: false, error: 'Attestation introuvable' };
            return { success: true, data: ser(attestation) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = attestationSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const d = parsed.data;
            const data = {
                reference,
                type: d.type,
                clientId: d.clientId,
                secondaryClientId: d.secondaryClientId,
                terrainId: d.terrainId,
                propertyId: d.propertyId,
                conventionId: d.conventionId,
                templateId: d.templateId,
                emittedAt: d.emittedAt ? new Date(d.emittedAt) : new Date(),
                emittedById: session.userId,
                amount: d.amount,
                notes: d.notes,
            };
            const attestation = await db.attestation.create({ data, include: INCLUDE });
            await syncTerrainAttestationFields(db, d.terrainId, d.type, reference);
            logger_1.default.info(`Attestation created: ${reference} (${d.type})`);
            return { success: true, data: ser(attestation) };
        }
        catch (error) {
            logger_1.default.error('attestations:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = attestationSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const data = { ...d };
            if (d.emittedAt)
                data.emittedAt = new Date(d.emittedAt);
            const attestation = await db.attestation.update({
                where: { id },
                data,
                include: INCLUDE,
            });
            return { success: true, data: ser(attestation) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:typeStats', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.clientId)
                where.clientId = Number(filters.clientId);
            if (filters.conventionId)
                where.conventionId = Number(filters.conventionId);
            if (filters.terrainId)
                where.terrainId = Number(filters.terrainId);
            if (filters.propertyId)
                where.propertyId = Number(filters.propertyId);
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { notes: { contains: filters.search } },
                ];
            }
            const rows = await db.attestation.groupBy({
                by: ['type'],
                where,
                _count: { _all: true },
            });
            const stats = {
                ATTRIBUTION: 0, CESSION: 0, SOLDE: 0, TRANSFERT_PROPRIETE: 0,
            };
            let total = 0;
            for (const r of rows) {
                const n = r._count?._all ?? 0;
                stats[r.type] = n;
                total += n;
            }
            return { success: true, data: { ...stats, total } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.attestation.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
