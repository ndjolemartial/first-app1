"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDocumentsIPC = registerDocumentsIPC;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const zod_1 = require("zod");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const storage_service_1 = require("../services/storage.service");
const logger_1 = __importDefault(require("../utils/logger"));
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const PREVIEW_MAX_BYTES = 25 * 1024 * 1024;
/** Classe un type MIME dans un groupe lisible. */
function typeGroupOf(mime) {
    if (mime === 'application/pdf')
        return 'PDF';
    if (mime.startsWith('image/'))
        return 'IMAGE';
    if (mime.startsWith('video/'))
        return 'VIDEO';
    if (mime.startsWith('audio/'))
        return 'AUDIO';
    if (/word|excel|spreadsheet|presentation|officedocument|ms-office/.test(mime))
        return 'OFFICE';
    return 'AUTRE';
}
/** Traduit un groupe de type en condition Prisma sur le champ `type` (MIME). */
function typeGroupWhere(group) {
    switch (group) {
        case 'PDF': return { type: 'application/pdf' };
        case 'IMAGE': return { type: { startsWith: 'image/' } };
        case 'VIDEO': return { type: { startsWith: 'video/' } };
        case 'AUDIO': return { type: { startsWith: 'audio/' } };
        case 'OFFICE': return {
            OR: ['word', 'excel', 'spreadsheet', 'presentation', 'officedocument']
                .map((k) => ({ type: { contains: k } })),
        };
        default: return {};
    }
}
/** Génère le prochain numéro d'archive ARC-AAAA-NNNN. */
async function nextNumeroArchive(db) {
    const year = new Date().getFullYear();
    const last = await db.document.findFirst({
        where: { numeroArchive: { startsWith: `ARC-${year}-` } },
        orderBy: { numeroArchive: 'desc' },
        select: { numeroArchive: true },
    });
    const seq = last?.numeroArchive ? parseInt(last.numeroArchive.split('-')[2], 10) + 1 : 1;
    return `ARC-${year}-${String(seq).padStart(4, '0')}`;
}
/** Enregistre une entrée dans le journal des actions documentaires. */
async function logAudit(db, documentId, action, userId, detail) {
    try {
        await db.documentAuditLog.create({ data: { documentId, action: action, userId, detail } });
    }
    catch (e) {
        logger_1.default.error('documentAuditLog error', e.message);
    }
}
/** Relations incluses dans les listes de documents GED. */
const docInclude = {
    documentCategory: { select: { id: true, name: true, color: true } },
    folder: { select: { id: true, name: true } },
    uploadedBy: { select: { id: true, firstName: true, lastName: true } },
    tags: { include: { tag: true } },
};
const importSchema = zod_1.z.object({
    files: zod_1.z.array(zod_1.z.object({
        sourcePath: zod_1.z.string().optional(),
        fileData: zod_1.z.string().optional(),
        originalName: zod_1.z.string().min(1),
        displayName: zod_1.z.string().optional(),
        mimeType: zod_1.z.string().default('application/octet-stream'),
        size: zod_1.z.number().int().nonnegative().default(0),
    })).min(1),
    description: zod_1.z.string().optional(),
    categoryId: zod_1.z.number().int().positive().optional(),
    folderId: zod_1.z.number().int().positive().optional(),
    tagIds: zod_1.z.array(zod_1.z.number().int().positive()).optional(),
    clientId: zod_1.z.number().int().positive().optional(),
    ownerId: zod_1.z.number().int().positive().optional(),
    propertyId: zod_1.z.number().int().positive().optional(),
    conventionId: zod_1.z.number().int().positive().optional(),
    terrainId: zod_1.z.number().int().positive().optional(),
    lotissementId: zod_1.z.number().int().positive().optional(),
    programmeId: zod_1.z.number().int().positive().optional(),
    projectId: zod_1.z.number().int().positive().optional(),
    prospectId: zod_1.z.number().int().positive().optional(),
    referrerId: zod_1.z.number().int().positive().optional(),
    linkedUserId: zod_1.z.number().int().positive().optional(),
    invoiceId: zod_1.z.number().int().positive().optional(),
    commissionId: zod_1.z.number().int().positive().optional(),
    attestationId: zod_1.z.number().int().positive().optional(),
});
const updateGedSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    categoryId: zod_1.z.number().int().positive().nullable().optional(),
    folderId: zod_1.z.number().int().positive().nullable().optional(),
    tagIds: zod_1.z.array(zod_1.z.number().int().positive()).optional(),
    isPhysical: zod_1.z.boolean().optional(),
    physBureau: zod_1.z.string().optional(),
    physCarton: zod_1.z.string().optional(),
    physClasseur: zod_1.z.string().optional(),
    // Rattachements (null pour détacher)
    clientId: zod_1.z.number().int().positive().nullable().optional(),
    ownerId: zod_1.z.number().int().positive().nullable().optional(),
    propertyId: zod_1.z.number().int().positive().nullable().optional(),
    conventionId: zod_1.z.number().int().positive().nullable().optional(),
    terrainId: zod_1.z.number().int().positive().nullable().optional(),
    lotissementId: zod_1.z.number().int().positive().nullable().optional(),
    programmeId: zod_1.z.number().int().positive().nullable().optional(),
    projectId: zod_1.z.number().int().positive().nullable().optional(),
    prospectId: zod_1.z.number().int().positive().nullable().optional(),
    referrerId: zod_1.z.number().int().positive().nullable().optional(),
    linkedUserId: zod_1.z.number().int().positive().nullable().optional(),
    invoiceId: zod_1.z.number().int().positive().nullable().optional(),
    commissionId: zod_1.z.number().int().positive().nullable().optional(),
    attestationId: zod_1.z.number().int().positive().nullable().optional(),
});
/**
 * Enregistre les handlers IPC pour la gestion des documents.
 */
function registerDocumentsIPC() {
    electron_1.ipcMain.handle('documents:uploadIdDocument', async (_event, { token, clientId, fileName, fileType, fileSize, fileData }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
            if (fileSize > maxBytes)
                return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo)` };
            const storagePath = process.env.STORAGE_PATH ?? './data/storage';
            const dir = path_1.default.resolve(storagePath, 'clients', String(clientId), 'identity');
            fs_1.default.mkdirSync(dir, { recursive: true });
            const ext = path_1.default.extname(fileName);
            const uniqueName = `id_${Date.now()}${ext}`;
            const absPath = path_1.default.join(dir, uniqueName);
            const relativePath = path_1.default.posix.join('clients', String(clientId), 'identity', uniqueName);
            fs_1.default.writeFileSync(absPath, Buffer.from(fileData, 'base64'));
            const db = (0, db_service_1.getDb)();
            // Suppression des anciennes pièces d'identité pour ce client
            const oldDocs = await db.document.findMany({ where: { clientId, category: 'identité' }, select: { id: true, path: true } });
            for (const old of oldDocs) {
                const oldAbs = path_1.default.resolve(storagePath, old.path);
                if (fs_1.default.existsSync(oldAbs))
                    fs_1.default.unlinkSync(oldAbs);
            }
            await db.document.deleteMany({ where: { clientId, category: 'identité' } });
            const document = await db.document.create({
                data: { name: fileName, type: fileType, path: relativePath, size: fileSize, category: 'identité', clientId },
            });
            logger_1.default.info(`Pièce d'identité enregistrée pour client #${clientId} : ${relativePath}`);
            return { success: true, data: document };
        }
        catch (error) {
            logger_1.default.error('documents:uploadIdDocument error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:getByClient', async (_event, { token, clientId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY']);
            const db = (0, db_service_1.getDb)();
            const documents = await db.document.findMany({
                where: { clientId },
                orderBy: { uploadedAt: 'desc' },
            });
            return { success: true, data: documents };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * Upload d'un document pour un propriétaire.
     * category: 'piece_identite' | 'piece_identite_rep_legal' | 'registre_commerce'
     */
    electron_1.ipcMain.handle('documents:uploadOwnerDoc', async (_event, { token, ownerId, category, fileName, fileType, fileSize, fileData }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
            if (fileSize > maxBytes)
                return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo)` };
            const storagePath = process.env.STORAGE_PATH ?? './data/storage';
            const dir = path_1.default.resolve(storagePath, 'owners', String(ownerId), category);
            fs_1.default.mkdirSync(dir, { recursive: true });
            const ext = path_1.default.extname(fileName);
            const uniqueName = `${category}_${Date.now()}${ext}`;
            const absPath = path_1.default.join(dir, uniqueName);
            const relativePath = path_1.default.posix.join('owners', String(ownerId), category, uniqueName);
            fs_1.default.writeFileSync(absPath, Buffer.from(fileData, 'base64'));
            const db = (0, db_service_1.getDb)();
            // Remplace l'ancien document de même catégorie
            const oldDocs = await db.document.findMany({ where: { ownerId, category }, select: { id: true, path: true } });
            for (const old of oldDocs) {
                const oldAbs = path_1.default.resolve(storagePath, old.path);
                if (fs_1.default.existsSync(oldAbs))
                    fs_1.default.unlinkSync(oldAbs);
            }
            await db.document.deleteMany({ where: { ownerId, category } });
            const document = await db.document.create({
                data: { name: fileName, type: fileType, path: relativePath, size: fileSize, category, ownerId },
            });
            logger_1.default.info(`Document propriétaire #${ownerId} [${category}] enregistré : ${relativePath}`);
            return { success: true, data: document };
        }
        catch (error) {
            logger_1.default.error('documents:uploadOwnerDoc error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:getByOwner', async (_event, { token, ownerId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY']);
            const db = (0, db_service_1.getDb)();
            const documents = await db.document.findMany({
                where: { ownerId },
                orderBy: { uploadedAt: 'desc' },
            });
            return { success: true, data: documents };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * Upload d'un document scanné pour un terrain.
     * category: 'dm_scan' | 'tf_scan' | 'acd_scan'
     */
    electron_1.ipcMain.handle('documents:uploadTerrainDoc', async (_event, { token, terrainId, category, fileName, fileType, fileSize, fileData }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
            if (fileSize > maxBytes)
                return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo)` };
            const storagePath = process.env.STORAGE_PATH ?? './data/storage';
            const dir = path_1.default.resolve(storagePath, 'terrains', String(terrainId), category);
            fs_1.default.mkdirSync(dir, { recursive: true });
            const ext = path_1.default.extname(fileName);
            const uniqueName = `${category}_${Date.now()}${ext}`;
            const absPath = path_1.default.join(dir, uniqueName);
            const relativePath = path_1.default.posix.join('terrains', String(terrainId), category, uniqueName);
            fs_1.default.writeFileSync(absPath, Buffer.from(fileData, 'base64'));
            const db = (0, db_service_1.getDb)();
            // Remplace l'ancien document de même catégorie
            const oldDocs = await db.document.findMany({ where: { terrainId, category }, select: { id: true, path: true } });
            for (const old of oldDocs) {
                const oldAbs = path_1.default.resolve(storagePath, old.path);
                if (fs_1.default.existsSync(oldAbs))
                    fs_1.default.unlinkSync(oldAbs);
            }
            await db.document.deleteMany({ where: { terrainId, category } });
            const document = await db.document.create({
                data: { name: fileName, type: fileType, path: relativePath, size: fileSize, category, terrainId },
            });
            logger_1.default.info(`Document terrain #${terrainId} [${category}] enregistré : ${relativePath}`);
            return { success: true, data: document };
        }
        catch (error) {
            logger_1.default.error('documents:uploadTerrainDoc error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:getByTerrain', async (_event, { token, terrainId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY']);
            const db = (0, db_service_1.getDb)();
            const documents = await db.document.findMany({
                where: { terrainId },
                orderBy: { uploadedAt: 'desc' },
            });
            return { success: true, data: documents };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:openFile', async (_event, { token, relativePath }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const storagePath = process.env.STORAGE_PATH ?? './data/storage';
            const absPath = path_1.default.resolve(storagePath, relativePath);
            if (!fs_1.default.existsSync(absPath))
                return { success: false, error: 'Fichier introuvable sur le disque' };
            const errMsg = await electron_1.shell.openPath(absPath);
            if (errMsg)
                return { success: false, error: errMsg };
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('documents:openFile error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ═══════════════════════════════════════════════════════════════
    // GED — Gestion Électronique de Documents
    // ═══════════════════════════════════════════════════════════════
    electron_1.ipcMain.handle('documents:list', async (_event, { token, filters = {}, page = 1, limit = 24 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.categoryId)
                where.categoryId = Number(filters.categoryId);
            if (filters.folderId)
                where.folderId = Number(filters.folderId);
            if (filters.uploadedById)
                where.uploadedById = Number(filters.uploadedById);
            if (filters.tagId)
                where.tags = { some: { tagId: Number(filters.tagId) } };
            // Filtres par entité rattachée
            for (const fk of [
                'clientId', 'ownerId', 'propertyId', 'conventionId', 'terrainId',
                'lotissementId', 'programmeId', 'projectId', 'prospectId',
                'referrerId', 'linkedUserId', 'invoiceId', 'commissionId', 'attestationId',
            ]) {
                if (filters[fk])
                    where[fk] = Number(filters[fk]);
            }
            if (filters.dateFrom || filters.dateTo) {
                where.uploadedAt = {};
                if (filters.dateFrom)
                    where.uploadedAt.gte = new Date(filters.dateFrom);
                if (filters.dateTo)
                    where.uploadedAt.lte = new Date(`${filters.dateTo}T23:59:59`);
            }
            const and = [];
            if (filters.typeGroup)
                and.push(typeGroupWhere(filters.typeGroup));
            if (filters.search) {
                and.push({
                    OR: [
                        { name: { contains: filters.search } },
                        { numeroArchive: { contains: filters.search } },
                        { description: { contains: filters.search } },
                        { ocrText: { contains: filters.search } },
                    ],
                });
            }
            if (and.length)
                where.AND = and;
            const [data, total] = await db.$transaction([
                db.document.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { uploadedAt: 'desc' },
                    include: docInclude,
                }),
                db.document.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('documents:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const document = await db.document.findFirst({
                where: { id: Number(id), deletedAt: null },
                include: {
                    ...docInclude,
                    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                    owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                    property: { select: { id: true, reference: true } },
                    convention: { select: { id: true, reference: true } },
                    terrain: { select: { id: true, reference: true } },
                    lotissement: { select: { id: true, reference: true, nom: true } },
                    programme: { select: { id: true, reference: true, nom: true } },
                    project: { select: { id: true, reference: true, nom: true } },
                    prospect: { select: { id: true, firstName: true, lastName: true } },
                    referrer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                    linkedUser: { select: { id: true, firstName: true, lastName: true, matricule: true } },
                    invoice: { select: { id: true, reference: true } },
                    commission: { select: { id: true, reference: true } },
                    attestation: { select: { id: true, reference: true, type: true } },
                    auditLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 50,
                        include: { user: { select: { id: true, firstName: true, lastName: true } } },
                    },
                },
            });
            if (!document)
                return { success: false, error: 'Document introuvable' };
            return { success: true, data: document };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:import', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = importSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const created = [];
            for (const f of d.files) {
                const numeroArchive = await nextNumeroArchive(db);
                let stored;
                if (f.sourcePath) {
                    stored = (0, storage_service_1.importGedFile)(f.sourcePath, numeroArchive, f.originalName);
                }
                else if (f.fileData) {
                    stored = (0, storage_service_1.writeGedFile)(Buffer.from(f.fileData, 'base64'), numeroArchive, f.originalName);
                }
                else {
                    return { success: false, error: `Fichier sans source : ${f.originalName}` };
                }
                const doc = await db.document.create({
                    data: {
                        name: f.displayName?.trim() || f.originalName,
                        type: f.mimeType,
                        path: stored.relativePath,
                        size: stored.size,
                        numeroArchive,
                        description: d.description,
                        categoryId: d.categoryId ?? null,
                        folderId: d.folderId ?? null,
                        uploadedById: session.userId,
                        clientId: d.clientId ?? null,
                        ownerId: d.ownerId ?? null,
                        propertyId: d.propertyId ?? null,
                        conventionId: d.conventionId ?? null,
                        terrainId: d.terrainId ?? null,
                        lotissementId: d.lotissementId ?? null,
                        programmeId: d.programmeId ?? null,
                        projectId: d.projectId ?? null,
                        prospectId: d.prospectId ?? null,
                        referrerId: d.referrerId ?? null,
                        linkedUserId: d.linkedUserId ?? null,
                        invoiceId: d.invoiceId ?? null,
                        commissionId: d.commissionId ?? null,
                        attestationId: d.attestationId ?? null,
                        tags: d.tagIds && d.tagIds.length
                            ? { create: d.tagIds.map((tagId) => ({ tagId })) }
                            : undefined,
                    },
                });
                await logAudit(db, doc.id, 'IMPORT', session.userId, `Archivage de « ${f.originalName} »`);
                created.push(doc);
            }
            logger_1.default.info(`GED : ${created.length} document(s) importé(s)`);
            return { success: true, data: created };
        }
        catch (error) {
            logger_1.default.error('documents:import error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = updateGedSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const data = { ...d };
            delete data.tagIds;
            if (d.tagIds) {
                data.tags = { deleteMany: {}, create: d.tagIds.map((tagId) => ({ tagId })) };
            }
            const doc = await db.document.update({ where: { id: Number(id) }, data });
            await logAudit(db, doc.id, 'MODIFICATION', session.userId, 'Mise à jour des métadonnées');
            return { success: true, data: doc };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:remove', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, DELETE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.document.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            await logAudit(db, Number(id), 'SUPPRESSION', session.userId, 'Document mis à la corbeille');
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:open', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const doc = await db.document.findUnique({
                where: { id: Number(id) },
                select: { id: true, path: true, name: true },
            });
            if (!doc)
                return { success: false, error: 'Document introuvable' };
            const abs = (0, storage_service_1.resolveStoragePath)(doc.path);
            if (!fs_1.default.existsSync(abs))
                return { success: false, error: 'Fichier introuvable sur le disque' };
            const errMsg = await electron_1.shell.openPath(abs);
            if (errMsg)
                return { success: false, error: errMsg };
            await logAudit(db, doc.id, 'CONSULTATION', session.userId, `Ouverture de « ${doc.name} »`);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:getFileData', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const doc = await db.document.findUnique({
                where: { id: Number(id) },
                select: { path: true, type: true, name: true, size: true },
            });
            if (!doc)
                return { success: false, error: 'Document introuvable' };
            if (doc.size > PREVIEW_MAX_BYTES) {
                return { success: true, data: { tooLarge: true, mimeType: doc.type, name: doc.name } };
            }
            const buf = (0, storage_service_1.readStorageFile)(doc.path);
            if (!buf)
                return { success: false, error: 'Fichier introuvable sur le disque' };
            return { success: true, data: { base64: buf.toString('base64'), mimeType: doc.type, name: doc.name } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Catégories ───────────────────────────────────────────────
    electron_1.ipcMain.handle('documents:listCategories', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.documentCategory.findMany({
                where: { deletedAt: null },
                orderBy: { name: 'asc' },
                include: { _count: { select: { documents: { where: { deletedAt: null } } } } },
            });
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:createCategory', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const schema = zod_1.z.object({
                name: zod_1.z.string().min(1),
                parentId: zod_1.z.number().int().positive().nullable().optional(),
                color: zod_1.z.string().optional(),
            });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const cat = await db.documentCategory.create({ data: parsed.data });
            return { success: true, data: cat };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:updateCategory', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const schema = zod_1.z.object({
                name: zod_1.z.string().min(1).optional(),
                parentId: zod_1.z.number().int().positive().nullable().optional(),
                color: zod_1.z.string().optional(),
            });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const cat = await db.documentCategory.update({ where: { id: Number(id) }, data: parsed.data });
            return { success: true, data: cat };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:deleteCategory', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, DELETE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.documentCategory.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Dossiers ─────────────────────────────────────────────────
    electron_1.ipcMain.handle('documents:listFolders', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.documentFolder.findMany({
                where: { deletedAt: null },
                orderBy: { name: 'asc' },
                include: { _count: { select: { documents: { where: { deletedAt: null } } } } },
            });
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:createFolder', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const schema = zod_1.z.object({
                name: zod_1.z.string().min(1),
                parentId: zod_1.z.number().int().positive().nullable().optional(),
            });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const folder = await db.documentFolder.create({ data: parsed.data });
            return { success: true, data: folder };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:updateFolder', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const schema = zod_1.z.object({
                name: zod_1.z.string().min(1).optional(),
                parentId: zod_1.z.number().int().positive().nullable().optional(),
            });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const folder = await db.documentFolder.update({ where: { id: Number(id) }, data: parsed.data });
            return { success: true, data: folder };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:deleteFolder', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, DELETE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.documentFolder.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Étiquettes ───────────────────────────────────────────────
    electron_1.ipcMain.handle('documents:listTags', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.tag.findMany({ orderBy: { name: 'asc' } });
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:createTag', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const schema = zod_1.z.object({ name: zod_1.z.string().min(1), color: zod_1.z.string().optional() });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const tag = await db.tag.upsert({
                where: { name: parsed.data.name },
                update: {},
                create: parsed.data,
            });
            return { success: true, data: tag };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:updateTag', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const schema = zod_1.z.object({ name: zod_1.z.string().min(1).optional(), color: zod_1.z.string().optional() });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const tag = await db.tag.update({ where: { id: Number(id) }, data: parsed.data });
            return { success: true, data: tag };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:deleteTag', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, DELETE_ROLES);
            const db = (0, db_service_1.getDb)();
            const tagId = Number(id);
            // Détache l'étiquette de tous les documents.
            await db.documentTag.deleteMany({ where: { tagId } });
            // L'étiquette n'est supprimée que si elle n'est plus utilisée ailleurs (prospects).
            const prospectUse = await db.prospectTag.count({ where: { tagId } });
            if (prospectUse === 0) {
                await db.tag.delete({ where: { id: tagId } });
                return { success: true };
            }
            return { success: true, data: { kept: true } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Journal & tableau de bord ────────────────────────────────
    electron_1.ipcMain.handle('documents:listAudit', async (_event, { token, limit = 100 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.documentAuditLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                include: {
                    user: { select: { id: true, firstName: true, lastName: true } },
                    document: { select: { id: true, name: true, numeroArchive: true } },
                },
            });
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('documents:gedDashboard', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const [total, recent, monthCount, physicalCount, uncategorized, types, byCategory] = await db.$transaction([
                db.document.count({ where: { deletedAt: null } }),
                db.document.findMany({
                    where: { deletedAt: null },
                    orderBy: { uploadedAt: 'desc' },
                    take: 8,
                    include: docInclude,
                }),
                db.document.count({ where: { deletedAt: null, uploadedAt: { gte: monthStart } } }),
                db.document.count({ where: { deletedAt: null, isPhysical: true } }),
                db.document.count({ where: { deletedAt: null, categoryId: null } }),
                db.document.findMany({ where: { deletedAt: null }, select: { type: true } }),
                db.documentCategory.findMany({
                    where: { deletedAt: null },
                    select: {
                        id: true, name: true, color: true,
                        _count: { select: { documents: { where: { deletedAt: null } } } },
                    },
                }),
            ]);
            const byTypeGroup = { PDF: 0, IMAGE: 0, VIDEO: 0, AUDIO: 0, OFFICE: 0, AUTRE: 0 };
            for (const t of types)
                byTypeGroup[typeGroupOf(t.type)]++;
            return {
                success: true,
                data: {
                    total, recent, monthCount, physicalCount, uncategorized,
                    byTypeGroup, byCategory, diskBytes: (0, storage_service_1.directorySize)((0, storage_service_1.storageRoot)()),
                },
            };
        }
        catch (error) {
            logger_1.default.error('documents:gedDashboard error', error.message);
            return { success: false, error: error.message };
        }
    });
}
