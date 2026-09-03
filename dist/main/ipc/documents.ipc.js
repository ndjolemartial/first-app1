"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedUploadFilesCategory = seedUploadFilesCategory;
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
// CONFORMITE (Module 19) ajouté en lecture — sans quoi le chargé de
// conformité ne pourrait consulter aucune pièce jointe de son propre module
// (aucune équivalence checkRole pour ce rôle exclusif).
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY', 'CONFORMITE'];
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const PREVIEW_MAX_BYTES = 25 * 1024 * 1024;
// Rôles autorisés à voir/déposer les pièces jointes d'une déclaration de
// soupçon (Module 19) — même liste qu'AML_REPORT_MANAGE_ROLES dans aml.ipc.ts,
// dupliquée localement (convention du projet : pas d'import inter-fichiers IPC).
const AML_CONFIDENTIAL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];
// Rôles autorisés à créer une déclaration de soupçon (donc à y joindre des
// pièces juste après sa création) — même liste qu'AML_REPORT_CREATE_ROLES.
const AML_REPORT_CREATE_ROLES = [
    'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION',
    'AGENT', 'AGENT_TECHNIQUE', 'RH', 'CONFORMITE',
];
// Rôles autorisés à gérer un profil/une revue LBC/FT (donc à y joindre
// des pièces) — même liste qu'AML_ROLES.
const AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];
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
// ── Dossiers : espace personnel & dossiers partagés ──────────────────────────
// Rôles à accès TOTAL sur la GED, y compris les espaces personnels des AUTRES
// utilisateurs. Réservé au SUPER_ADMIN : aucun autre rôle (ADMIN inclus) ne peut
// consulter l'espace personnel d'un autre utilisateur — chacun n'accède qu'au sien.
const FOLDER_FULL_ROLES = ['SUPER_ADMIN'];
function isFolderFull(role) {
    return FOLDER_FULL_ROLES.includes(role);
}
// Rôles habilités à gérer les dossiers partagés (création / liste d'accès) et à
// consulter l'ensemble des dossiers PARTAGÉS (hors espaces personnels d'autrui).
const FOLDER_PRIVILEGED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
function isFolderPrivileged(role) {
    return FOLDER_PRIVILEGED_ROLES.includes(role);
}
// Rôles voyant le pool GENERAL de la GED (arborescence commune + documents hors
// dossier). Les autres rôles (AGENT, AGENT_TECHNIQUE, READONLY) n'accèdent qu'à
// leur espace personnel et aux dossiers partagés qui leur sont ouverts.
const GED_GENERAL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
function canSeeGeneralGed(role) {
    return GED_GENERAL_ROLES.includes(role);
}
/** Nom du dossier personnel auto-créé pour chaque utilisateur. */
const HOME_FOLDER_NAME = 'Mon espace personnel';
/** Trouve (ou crée) le dossier personnel (home) de l'utilisateur. */
async function ensureHomeFolder(db, userId) {
    const existing = await db.documentFolder.findFirst({
        where: { kind: 'PERSONAL', ownerId: userId, deletedAt: null },
    });
    if (existing)
        return existing;
    return db.documentFolder.create({
        data: { name: HOME_FOLDER_NAME, kind: 'PERSONAL', ownerId: userId },
    });
}
/** Filtre Prisma de visibilité des DOSSIERS pour la session ({} = tout voir). */
function folderVisibilityWhere(session) {
    if (isFolderFull(session.role))
        return {}; // SUPER_ADMIN : tout, y compris les espaces personnels d'autrui
    const or = [
        // Uniquement SON PROPRE espace personnel / ses propres dossiers.
        { kind: 'PERSONAL', ownerId: session.userId },
        { ownerId: session.userId },
        // Dossiers partagés qui lui sont explicitement ouverts.
        { kind: 'SHARED', accesses: { some: { userId: session.userId } } },
    ];
    // ADMIN / MANAGER : voient l'ensemble des dossiers partagés (mais jamais les
    // espaces personnels des autres utilisateurs).
    if (isFolderPrivileged(session.role))
        or.push({ kind: 'SHARED' });
    // Pool général (arborescence commune).
    if (canSeeGeneralGed(session.role))
        or.push({ kind: 'GENERAL' });
    return { OR: or };
}
/**
 * Filtre Prisma de visibilité des DOCUMENTS selon leur dossier.
 * `null` = accès total (SUPER_ADMIN).
 */
function documentFolderVisibilityWhere(session) {
    if (isFolderFull(session.role))
        return null;
    const or = [
        // Documents rangés dans son propre espace personnel / ses propres dossiers.
        { folder: { is: { kind: 'PERSONAL', ownerId: session.userId } } },
        { folder: { is: { ownerId: session.userId } } },
        { folder: { is: { kind: 'SHARED', accesses: { some: { userId: session.userId } } } } },
    ];
    // ADMIN / MANAGER : tous les dossiers partagés.
    if (isFolderPrivileged(session.role))
        or.push({ folder: { is: { kind: 'SHARED' } } });
    // Pool général (documents hors dossier + dossiers GENERAL).
    if (canSeeGeneralGed(session.role)) {
        or.push({ folderId: null });
        or.push({ folder: { is: { kind: 'GENERAL' } } });
    }
    return { OR: or };
}
/** Vérifie qu'un utilisateur peut DÉPOSER dans un dossier (lecture + dépôt). */
async function canWriteFolder(db, session, folderId) {
    if (folderId == null)
        return true; // hors dossier : règle de rôle standard
    if (isFolderFull(session.role))
        return true;
    const folder = await db.documentFolder.findUnique({
        where: { id: folderId },
        include: {
            accesses: { where: { userId: session.userId }, select: { userId: true } },
        },
    });
    if (!folder || folder.deletedAt)
        return false;
    if (folder.ownerId === session.userId)
        return true;
    // Espace personnel d'un autre utilisateur : SUPER_ADMIN uniquement (déjà court-circuité plus haut).
    if (folder.kind === 'PERSONAL')
        return false;
    if (folder.kind === 'SHARED') {
        if (isFolderPrivileged(session.role))
            return true;
        return folder.accesses.length > 0;
    }
    if (folder.kind === 'GENERAL')
        return canSeeGeneralGed(session.role);
    return false;
}
/** Vérifie qu'un utilisateur peut CONSULTER un document selon son dossier. */
async function canReadDocumentFolder(db, session, folderId) {
    if (isFolderFull(session.role))
        return true;
    if (folderId == null)
        return canSeeGeneralGed(session.role); // hors dossier = pool général
    const folder = await db.documentFolder.findUnique({
        where: { id: folderId },
        include: {
            accesses: { where: { userId: session.userId }, select: { userId: true } },
        },
    });
    if (!folder)
        return true; // dossier supprimé : ne bloque pas l'accès au document
    if (folder.ownerId === session.userId)
        return true;
    // Espace personnel d'un autre utilisateur : SUPER_ADMIN uniquement.
    if (folder.kind === 'PERSONAL')
        return false;
    if (folder.kind === 'SHARED') {
        if (isFolderPrivileged(session.role))
            return true;
        return folder.accesses.length > 0;
    }
    if (folder.kind === 'GENERAL')
        return canSeeGeneralGed(session.role);
    return false;
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
/** Nom de la catégorie par défaut des fichiers importés sans catégorie choisie. */
const UPLOAD_FILES_CATEGORY = 'UPLOAD FILES';
/**
 * Renvoie l'id de la catégorie par défaut « UPLOAD FILES », en la créant si
 * elle n'existe pas encore. Sert à classer automatiquement les fichiers
 * importés dans la GED sans choix de catégorie.
 */
async function ensureUploadFilesCategoryId(db) {
    const existing = await db.documentCategory.findFirst({
        where: { name: UPLOAD_FILES_CATEGORY, deletedAt: null },
        select: { id: true },
    });
    if (existing)
        return existing.id;
    const created = await db.documentCategory.create({
        data: { name: UPLOAD_FILES_CATEGORY, color: '#64748b' },
        select: { id: true },
    });
    return created.id;
}
/** Seed au démarrage : garantit l'existence de la catégorie « UPLOAD FILES ». */
async function seedUploadFilesCategory() {
    await ensureUploadFilesCategoryId((0, db_service_1.getDb)());
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
    treasuryOperationId: zod_1.z.number().int().positive().optional(),
    crmActivityId: zod_1.z.number().int().positive().optional(),
    socialPublicationId: zod_1.z.number().int().positive().optional(),
    itInnovationId: zod_1.z.number().int().positive().optional(),
    itInnovationPhase: zod_1.z.number().int().min(1).max(3).optional(),
    amlProfileId: zod_1.z.number().int().positive().optional(),
    amlTransactionReviewId: zod_1.z.number().int().positive().optional(),
    amlSuspiciousReportId: zod_1.z.number().int().positive().optional(),
    amlTrainingId: zod_1.z.number().int().positive().optional(),
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
    treasuryOperationId: zod_1.z.number().int().positive().nullable().optional(),
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
                where: { clientId, deletedAt: null },
                orderBy: { uploadedAt: 'desc' },
            });
            return { success: true, data: documents };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * Upload d'un document pour un client, catégorisé.
     * category: 'piece_identite_rep_legal' | 'registre_commerce' | …
     * (la pièce d'identité d'un client particulier reste gérée par
     *  `documents:uploadIdDocument`, catégorie « identité »).
     */
    electron_1.ipcMain.handle('documents:uploadClientDoc', async (_event, { token, clientId, category, fileName, fileType, fileSize, fileData }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
            if (fileSize > maxBytes)
                return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo)` };
            const storagePath = process.env.STORAGE_PATH ?? './data/storage';
            const dir = path_1.default.resolve(storagePath, 'clients', String(clientId), category);
            fs_1.default.mkdirSync(dir, { recursive: true });
            const ext = path_1.default.extname(fileName);
            const uniqueName = `${category}_${Date.now()}${ext}`;
            const absPath = path_1.default.join(dir, uniqueName);
            const relativePath = path_1.default.posix.join('clients', String(clientId), category, uniqueName);
            fs_1.default.writeFileSync(absPath, Buffer.from(fileData, 'base64'));
            const db = (0, db_service_1.getDb)();
            // Remplace l'ancien document de même catégorie pour ce client.
            const oldDocs = await db.document.findMany({ where: { clientId, category }, select: { id: true, path: true } });
            for (const old of oldDocs) {
                const oldAbs = path_1.default.resolve(storagePath, old.path);
                if (fs_1.default.existsSync(oldAbs))
                    fs_1.default.unlinkSync(oldAbs);
            }
            await db.document.deleteMany({ where: { clientId, category } });
            const document = await db.document.create({
                data: { name: fileName, type: fileType, path: relativePath, size: fileSize, category, clientId },
            });
            logger_1.default.info(`Document client #${clientId} [${category}] enregistré : ${relativePath}`);
            return { success: true, data: document };
        }
        catch (error) {
            logger_1.default.error('documents:uploadClientDoc error', error.message);
            return { success: false, error: error.message };
        }
    });
    /**
     * Upload de plusieurs documents pour un client, sous une même catégorie —
     * contrairement à `documents:uploadClientDoc` (un seul document par
     * catégorie, remplacé à chaque nouvel envoi), chaque appel s'ajoute aux
     * documents déjà présents. Utilisé pour les justificatifs pouvant être
     * multiples (ex. « justificatif_origine_fonds »).
     */
    electron_1.ipcMain.handle('documents:uploadClientDocs', async (_event, { token, clientId, category, files }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            if (!Array.isArray(files) || files.length === 0)
                return { success: false, error: 'Aucun fichier' };
            const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
            const oversized = files.find((f) => f.fileSize > maxBytes);
            if (oversized)
                return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo) : ${oversized.fileName}` };
            const storagePath = process.env.STORAGE_PATH ?? './data/storage';
            const dir = path_1.default.resolve(storagePath, 'clients', String(clientId), category);
            fs_1.default.mkdirSync(dir, { recursive: true });
            const db = (0, db_service_1.getDb)();
            const created = [];
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const ext = path_1.default.extname(f.fileName);
                const uniqueName = `${category}_${Date.now()}_${i}${ext}`;
                const absPath = path_1.default.join(dir, uniqueName);
                const relativePath = path_1.default.posix.join('clients', String(clientId), category, uniqueName);
                fs_1.default.writeFileSync(absPath, Buffer.from(f.fileData, 'base64'));
                const document = await db.document.create({
                    data: { name: f.fileName, type: f.fileType, path: relativePath, size: f.fileSize, category, clientId },
                });
                created.push(document);
            }
            logger_1.default.info(`Documents client #${clientId} [${category}] ajoutés : ${created.length}`);
            return { success: true, data: created };
        }
        catch (error) {
            logger_1.default.error('documents:uploadClientDocs error', error.message);
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
                where: { ownerId, deletedAt: null },
                orderBy: { uploadedAt: 'desc' },
            });
            return { success: true, data: documents };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * Upload de plusieurs documents pour un propriétaire, sous une même
     * catégorie — chaque appel s'ajoute aux documents déjà présents (ne
     * remplace pas), même principe que `documents:uploadClientDocs`.
     * Utilisé pour les justificatifs d'origine des fonds.
     */
    electron_1.ipcMain.handle('documents:uploadOwnerDocs', async (_event, { token, ownerId, category, files }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            if (!Array.isArray(files) || files.length === 0)
                return { success: false, error: 'Aucun fichier' };
            const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
            const oversized = files.find((f) => f.fileSize > maxBytes);
            if (oversized)
                return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo) : ${oversized.fileName}` };
            const storagePath = process.env.STORAGE_PATH ?? './data/storage';
            const dir = path_1.default.resolve(storagePath, 'owners', String(ownerId), category);
            fs_1.default.mkdirSync(dir, { recursive: true });
            const db = (0, db_service_1.getDb)();
            const created = [];
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const ext = path_1.default.extname(f.fileName);
                const uniqueName = `${category}_${Date.now()}_${i}${ext}`;
                const absPath = path_1.default.join(dir, uniqueName);
                const relativePath = path_1.default.posix.join('owners', String(ownerId), category, uniqueName);
                fs_1.default.writeFileSync(absPath, Buffer.from(f.fileData, 'base64'));
                const document = await db.document.create({
                    data: { name: f.fileName, type: f.fileType, path: relativePath, size: f.fileSize, category, ownerId },
                });
                created.push(document);
            }
            logger_1.default.info(`Documents propriétaire #${ownerId} [${category}] ajoutés : ${created.length}`);
            return { success: true, data: created };
        }
        catch (error) {
            logger_1.default.error('documents:uploadOwnerDocs error', error.message);
            return { success: false, error: error.message };
        }
    });
    /**
     * Upload de plusieurs documents pour un apporteur d'affaire, sous une même
     * catégorie — chaque appel s'ajoute aux documents déjà présents (ne
     * remplace pas), même principe que `documents:uploadClientDocs`.
     * Utilisé pour les justificatifs d'origine des fonds.
     */
    electron_1.ipcMain.handle('documents:uploadReferrerDocs', async (_event, { token, referrerId, category, files }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            if (!Array.isArray(files) || files.length === 0)
                return { success: false, error: 'Aucun fichier' };
            const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
            const oversized = files.find((f) => f.fileSize > maxBytes);
            if (oversized)
                return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo) : ${oversized.fileName}` };
            const storagePath = process.env.STORAGE_PATH ?? './data/storage';
            const dir = path_1.default.resolve(storagePath, 'referrers', String(referrerId), category);
            fs_1.default.mkdirSync(dir, { recursive: true });
            const db = (0, db_service_1.getDb)();
            const created = [];
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const ext = path_1.default.extname(f.fileName);
                const uniqueName = `${category}_${Date.now()}_${i}${ext}`;
                const absPath = path_1.default.join(dir, uniqueName);
                const relativePath = path_1.default.posix.join('referrers', String(referrerId), category, uniqueName);
                fs_1.default.writeFileSync(absPath, Buffer.from(f.fileData, 'base64'));
                const document = await db.document.create({
                    data: { name: f.fileName, type: f.fileType, path: relativePath, size: f.fileSize, category, referrerId },
                });
                created.push(document);
            }
            logger_1.default.info(`Documents apporteur d'affaire #${referrerId} [${category}] ajoutés : ${created.length}`);
            return { success: true, data: created };
        }
        catch (error) {
            logger_1.default.error('documents:uploadReferrerDocs error', error.message);
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
                where: { terrainId, deletedAt: null },
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
            if (filters.uncategorized)
                where.categoryId = null; // documents non classés
            if (filters.folderId)
                where.folderId = Number(filters.folderId);
            if (filters.uploadedById)
                where.uploadedById = Number(filters.uploadedById);
            if (filters.tagId)
                where.tags = { some: { tagId: Number(filters.tagId) } };
            // Confidentialité LBC/FT : les pièces jointes d'une déclaration de
            // soupçon sont invisibles à la GED générale hors rôles habilités
            // (obligation de non-divulgation / « tipping-off »).
            if (!AML_CONFIDENTIAL_ROLES.includes(session.role))
                where.amlSuspiciousReportId = null;
            // Filtres par entité rattachée
            for (const fk of [
                'clientId', 'ownerId', 'propertyId', 'conventionId', 'terrainId',
                'lotissementId', 'programmeId', 'projectId', 'prospectId',
                'referrerId', 'linkedUserId', 'invoiceId', 'commissionId', 'attestationId',
                'treasuryOperationId',
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
            // Restriction d'accès par dossier (espace personnel / partagé).
            const folderWhere = documentFolderVisibilityWhere(session);
            if (folderWhere)
                and.push(folderWhere);
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
                    treasuryOperation: { select: { id: true, reference: true, bankAccountId: true } },
                    auditLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 50,
                        include: { user: { select: { id: true, firstName: true, lastName: true } } },
                    },
                },
            });
            if (!document)
                return { success: false, error: 'Document introuvable' };
            // Confidentialité LBC/FT : ne pas révéler l'existence du document.
            if (document.amlSuspiciousReportId != null && !AML_CONFIDENTIAL_ROLES.includes(session.role)) {
                return { success: false, error: 'Document introuvable' };
            }
            if (!(await canReadDocumentFolder(db, session, document.folderId))) {
                return { success: false, error: 'Accès refusé à ce document' };
            }
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
            const parsed = importSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const targetFolderId = d.folderId ?? null;
            // Dépôt dans son espace personnel ou un dossier partagé autorisé : permis à
            // TOUS les utilisateurs (même sans droit d'écriture général sur la GED).
            let personalOrSharedUpload = false;
            if (targetFolderId != null && !isFolderPrivileged(session.role)) {
                const folder = await db.documentFolder.findUnique({
                    where: { id: targetFolderId },
                    include: { accesses: { where: { userId: session.userId }, select: { userId: true } } },
                });
                if (folder && !folder.deletedAt) {
                    if (folder.kind === 'PERSONAL' && folder.ownerId === session.userId)
                        personalOrSharedUpload = true;
                    if (folder.kind === 'SHARED' && folder.accesses.length > 0)
                        personalOrSharedUpload = true;
                }
            }
            // Dépôt rattaché à une entité LBC/FT (Module 19) : contourne le droit
            // d'écriture général de la GED, avec ses propres contrôles dédiés.
            let amlUpload = false;
            if (d.amlProfileId != null || d.amlTransactionReviewId != null || d.amlTrainingId != null) {
                if (!AML_ROLES.includes(session.role))
                    return { success: false, error: 'Permission insuffisante' };
                amlUpload = true;
            }
            else if (d.amlSuspiciousReportId != null) {
                if (!AML_REPORT_CREATE_ROLES.includes(session.role))
                    return { success: false, error: 'Permission insuffisante' };
                const report = await db.amlSuspiciousReport.findFirst({
                    where: { id: d.amlSuspiciousReportId, deletedAt: null },
                    select: { status: true, declaredById: true },
                });
                if (!report || report.status !== 'BROUILLON' || report.declaredById !== session.userId) {
                    return { success: false, error: 'Vous ne pouvez plus joindre de pièce à cette déclaration' };
                }
                amlUpload = true;
            }
            // Dépôt hors espace perso/partagé/LBC-FT-FP : droit d'écriture standard requis.
            if (!personalOrSharedUpload && !amlUpload)
                (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            if (!(await canWriteFolder(db, session, targetFolderId))) {
                return { success: false, error: "Vous n'avez pas le droit de déposer dans ce dossier" };
            }
            // Sans catégorie choisie → catégorie par défaut « UPLOAD FILES » (créée si absente).
            const effectiveCategoryId = d.categoryId ?? await ensureUploadFilesCategoryId(db);
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
                        categoryId: effectiveCategoryId,
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
                        treasuryOperationId: d.treasuryOperationId ?? null,
                        crmActivityId: d.crmActivityId ?? null,
                        socialPublicationId: d.socialPublicationId ?? null,
                        itInnovationId: d.itInnovationId ?? null,
                        itInnovationPhase: d.itInnovationPhase ?? null,
                        amlProfileId: d.amlProfileId ?? null,
                        amlTransactionReviewId: d.amlTransactionReviewId ?? null,
                        amlSuspiciousReportId: d.amlSuspiciousReportId ?? null,
                        amlTrainingId: d.amlTrainingId ?? null,
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
            const docId = Number(id);
            const doc = await db.document.findUnique({ where: { id: docId }, select: { path: true } });
            if (!doc)
                return { success: false, error: 'Document introuvable' };
            await db.document.update({ where: { id: docId }, data: { deletedAt: new Date() } });
            // Supprime le fichier physique pour les documents gérés par l'application
            // (chemin relatif dans le dossier de stockage). Les archives importées
            // « en référence » ont un chemin ABSOLU (UNC) pointant vers l'original sur
            // le partage réseau : on ne supprime pas ces fichiers maîtres.
            let fileRemoved = false;
            if (doc.path && !path_1.default.isAbsolute(doc.path)) {
                (0, storage_service_1.removeStorageFile)(doc.path);
                fileRemoved = true;
            }
            await logAudit(db, docId, 'SUPPRESSION', session.userId, fileRemoved ? 'Document supprimé (fichier retiré du stockage)' : 'Document supprimé (référence externe conservée)');
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
                select: {
                    id: true, path: true, name: true, folderId: true, amlSuspiciousReportId: true,
                    crmActivity: { select: { type: true } },
                },
            });
            if (!doc)
                return { success: false, error: 'Document introuvable' };
            if (doc.amlSuspiciousReportId != null && !AML_CONFIDENTIAL_ROLES.includes(session.role)) {
                return { success: false, error: 'Document introuvable' };
            }
            // AGENT_TECHNIQUE : accès aux pièces jointes des activités « Créas /
            // Publications / Articles » de tous les utilisateurs (même exception que
            // sur la visibilité de l'activité elle-même, cf. buildVisibilityWhere
            // dans crm.ipc.ts), quel que soit le dossier GED de dépôt du document.
            const agentTechniquePublicationBypass = session.role === 'AGENT_TECHNIQUE' && doc.crmActivity?.type === 'CREATION_PUBLICATION';
            if (!agentTechniquePublicationBypass && !(await canReadDocumentFolder(db, session, doc.folderId))) {
                return { success: false, error: 'Accès refusé à ce document' };
            }
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
                select: {
                    path: true, type: true, name: true, size: true, folderId: true, amlSuspiciousReportId: true,
                    crmActivity: { select: { type: true } },
                },
            });
            if (!doc)
                return { success: false, error: 'Document introuvable' };
            if (doc.amlSuspiciousReportId != null && !AML_CONFIDENTIAL_ROLES.includes(session.role)) {
                return { success: false, error: 'Document introuvable' };
            }
            // AGENT_TECHNIQUE : accès aux pièces jointes des activités « Créas /
            // Publications / Articles » de tous les utilisateurs — cf. documents:open.
            const agentTechniquePublicationBypass = session.role === 'AGENT_TECHNIQUE' && doc.crmActivity?.type === 'CREATION_PUBLICATION';
            if (!agentTechniquePublicationBypass && !(await canReadDocumentFolder(db, session, doc.folderId))) {
                return { success: false, error: 'Accès refusé à ce document' };
            }
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
            // Garantit l'existence de l'espace personnel de l'utilisateur courant.
            await ensureHomeFolder(db, session.userId);
            const data = await db.documentFolder.findMany({
                where: { deletedAt: null, ...folderVisibilityWhere(session) },
                orderBy: [{ kind: 'asc' }, { name: 'asc' }],
                include: {
                    _count: { select: { documents: { where: { deletedAt: null } } } },
                    accesses: { select: { userId: true } },
                    owner: { select: { id: true, firstName: true, lastName: true } },
                },
            });
            // Métadonnées d'affichage : accès (liste d'ids), home de l'utilisateur courant.
            // Seul le SUPER_ADMIN voit les espaces personnels des autres utilisateurs ;
            // leur nom est alors suffixé du propriétaire afin de les distinguer.
            const enriched = data.map((f) => {
                const isOwnHome = f.kind === 'PERSONAL' && f.ownerId === session.userId;
                let name = f.name;
                if (f.kind === 'PERSONAL' && !isOwnHome && f.owner) {
                    const owner = `${f.owner.firstName ?? ''} ${f.owner.lastName ?? ''}`.trim();
                    name = owner ? `Espace personnel — ${owner}` : f.name;
                }
                return {
                    ...f,
                    name,
                    accessUserIds: f.accesses.map((a) => a.userId),
                    isOwnHome,
                };
            });
            return { success: true, data: enriched };
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
                // Type de dossier : GENERAL (par défaut) ou SHARED (partagé). Le dossier
                // PERSONAL est créé automatiquement, jamais via cette API.
                kind: zod_1.z.enum(['GENERAL', 'SHARED']).optional(),
                // Utilisateurs autorisés (dossier partagé).
                userIds: zod_1.z.array(zod_1.z.number().int().positive()).optional(),
            });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const { name, parentId, kind = 'GENERAL', userIds = [] } = parsed.data;
            if (kind === 'SHARED' && !isFolderPrivileged(session.role)) {
                return { success: false, error: 'Seuls les administrateurs et managers peuvent créer un dossier partagé' };
            }
            const db = (0, db_service_1.getDb)();
            const folder = await db.documentFolder.create({
                data: {
                    name,
                    parentId: parentId ?? null,
                    kind,
                    ownerId: kind === 'SHARED' ? session.userId : null,
                    ...(kind === 'SHARED' && userIds.length
                        ? { accesses: { create: userIds.map((userId) => ({ userId })) } }
                        : {}),
                },
            });
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
                // Mise à jour de la liste d'accès (dossier partagé) — null/omis = inchangé.
                userIds: zod_1.z.array(zod_1.z.number().int().positive()).nullable().optional(),
            });
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const { name, parentId, userIds } = parsed.data;
            const db = (0, db_service_1.getDb)();
            const current = await db.documentFolder.findUnique({ where: { id: Number(id) } });
            if (!current || current.deletedAt)
                return { success: false, error: 'Dossier introuvable' };
            // La liste d'accès n'est modifiable que sur un dossier partagé, par un rôle privilégié.
            if (userIds !== undefined && userIds !== null) {
                if (current.kind !== 'SHARED') {
                    return { success: false, error: "La liste d'accès ne concerne que les dossiers partagés" };
                }
                if (!isFolderPrivileged(session.role)) {
                    return { success: false, error: 'Seuls les administrateurs et managers peuvent modifier les accès' };
                }
            }
            const folder = await db.$transaction(async (tx) => {
                const data = {};
                if (name !== undefined)
                    data.name = name;
                if (parentId !== undefined)
                    data.parentId = parentId;
                const f = Object.keys(data).length
                    ? await tx.documentFolder.update({ where: { id: Number(id) }, data })
                    : current;
                if (current.kind === 'SHARED' && userIds !== undefined && userIds !== null) {
                    await tx.documentFolderAccess.deleteMany({ where: { folderId: Number(id) } });
                    if (userIds.length) {
                        await tx.documentFolderAccess.createMany({
                            data: userIds.map((userId) => ({ folderId: Number(id), userId })),
                        });
                    }
                }
                return f;
            });
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
            const folder = await db.documentFolder.findUnique({ where: { id: Number(id) } });
            if (!folder)
                return { success: false, error: 'Dossier introuvable' };
            if (folder.kind === 'PERSONAL') {
                return { success: false, error: 'Un espace personnel ne peut pas être supprimé' };
            }
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
            const [total, recent, monthCount, physicalCount, uncategorized, types, byCategory, sizeAgg] = await db.$transaction([
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
                // Espace disque = somme des tailles réelles de tous les documents
                // (inclut les archives référencées dont la taille a été renseignée).
                db.document.aggregate({ where: { deletedAt: null }, _sum: { size: true } }),
            ]);
            const byTypeGroup = { PDF: 0, IMAGE: 0, VIDEO: 0, AUDIO: 0, OFFICE: 0, AUTRE: 0 };
            for (const t of types)
                byTypeGroup[typeGroupOf(t.type)]++;
            return {
                success: true,
                data: {
                    total, recent, monthCount, physicalCount, uncategorized,
                    byTypeGroup, byCategory, diskBytes: Number(sizeAgg._sum.size ?? 0),
                },
            };
        }
        catch (error) {
            logger_1.default.error('documents:gedDashboard error', error.message);
            return { success: false, error: error.message };
        }
    });
}
