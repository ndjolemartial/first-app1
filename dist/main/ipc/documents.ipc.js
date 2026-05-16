"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDocumentsIPC = registerDocumentsIPC;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
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
}
