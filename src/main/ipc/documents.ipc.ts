import { ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];

/**
 * Enregistre les handlers IPC pour la gestion des documents.
 */
export function registerDocumentsIPC(): void {
  ipcMain.handle('documents:uploadIdDocument', async (_event, { token, clientId, fileName, fileType, fileSize, fileData }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
      if (fileSize > maxBytes) return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo)` };

      const storagePath = process.env.STORAGE_PATH ?? './data/storage';
      const dir = path.resolve(storagePath, 'clients', String(clientId), 'identity');
      fs.mkdirSync(dir, { recursive: true });

      const ext = path.extname(fileName);
      const uniqueName = `id_${Date.now()}${ext}`;
      const absPath = path.join(dir, uniqueName);
      const relativePath = path.posix.join('clients', String(clientId), 'identity', uniqueName);

      fs.writeFileSync(absPath, Buffer.from(fileData, 'base64'));

      const db = getDb();

      // Suppression des anciennes pièces d'identité pour ce client
      const oldDocs = await db.document.findMany({ where: { clientId, category: 'identité' }, select: { id: true, path: true } });
      for (const old of oldDocs) {
        const oldAbs = path.resolve(storagePath, old.path);
        if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
      }
      await db.document.deleteMany({ where: { clientId, category: 'identité' } });

      const document = await db.document.create({
        data: { name: fileName, type: fileType, path: relativePath, size: fileSize, category: 'identité', clientId },
      });

      logger.info(`Pièce d'identité enregistrée pour client #${clientId} : ${relativePath}`);
      return { success: true, data: document };
    } catch (error: any) {
      logger.error('documents:uploadIdDocument error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('documents:getByClient', async (_event, { token, clientId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY']);
      const db = getDb();
      const documents = await db.document.findMany({
        where: { clientId },
        orderBy: { uploadedAt: 'desc' },
      });
      return { success: true, data: documents };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Upload d'un document pour un propriétaire.
   * category: 'piece_identite' | 'piece_identite_rep_legal' | 'registre_commerce'
   */
  ipcMain.handle('documents:uploadOwnerDoc', async (_event, { token, ownerId, category, fileName, fileType, fileSize, fileData }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
      if (fileSize > maxBytes) return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo)` };

      const storagePath = process.env.STORAGE_PATH ?? './data/storage';
      const dir = path.resolve(storagePath, 'owners', String(ownerId), category);
      fs.mkdirSync(dir, { recursive: true });

      const ext = path.extname(fileName);
      const uniqueName = `${category}_${Date.now()}${ext}`;
      const absPath = path.join(dir, uniqueName);
      const relativePath = path.posix.join('owners', String(ownerId), category, uniqueName);

      fs.writeFileSync(absPath, Buffer.from(fileData, 'base64'));

      const db = getDb();

      // Remplace l'ancien document de même catégorie
      const oldDocs = await db.document.findMany({ where: { ownerId, category }, select: { id: true, path: true } });
      for (const old of oldDocs) {
        const oldAbs = path.resolve(storagePath, old.path);
        if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
      }
      await db.document.deleteMany({ where: { ownerId, category } });

      const document = await db.document.create({
        data: { name: fileName, type: fileType, path: relativePath, size: fileSize, category, ownerId },
      });

      logger.info(`Document propriétaire #${ownerId} [${category}] enregistré : ${relativePath}`);
      return { success: true, data: document };
    } catch (error: any) {
      logger.error('documents:uploadOwnerDoc error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('documents:getByOwner', async (_event, { token, ownerId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY']);
      const db = getDb();
      const documents = await db.document.findMany({
        where: { ownerId },
        orderBy: { uploadedAt: 'desc' },
      });
      return { success: true, data: documents };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Upload d'un document scanné pour un terrain.
   * category: 'dm_scan' | 'tf_scan' | 'acd_scan'
   */
  ipcMain.handle('documents:uploadTerrainDoc', async (_event, { token, terrainId, category, fileName, fileType, fileSize, fileData }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);

      const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024;
      if (fileSize > maxBytes) return { success: false, error: `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB ?? 10} Mo)` };

      const storagePath = process.env.STORAGE_PATH ?? './data/storage';
      const dir = path.resolve(storagePath, 'terrains', String(terrainId), category);
      fs.mkdirSync(dir, { recursive: true });

      const ext = path.extname(fileName);
      const uniqueName = `${category}_${Date.now()}${ext}`;
      const absPath = path.join(dir, uniqueName);
      const relativePath = path.posix.join('terrains', String(terrainId), category, uniqueName);

      fs.writeFileSync(absPath, Buffer.from(fileData, 'base64'));

      const db = getDb();

      // Remplace l'ancien document de même catégorie
      const oldDocs = await db.document.findMany({ where: { terrainId, category }, select: { id: true, path: true } });
      for (const old of oldDocs) {
        const oldAbs = path.resolve(storagePath, old.path);
        if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
      }
      await db.document.deleteMany({ where: { terrainId, category } });

      const document = await db.document.create({
        data: { name: fileName, type: fileType, path: relativePath, size: fileSize, category, terrainId },
      });

      logger.info(`Document terrain #${terrainId} [${category}] enregistré : ${relativePath}`);
      return { success: true, data: document };
    } catch (error: any) {
      logger.error('documents:uploadTerrainDoc error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('documents:getByTerrain', async (_event, { token, terrainId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY']);
      const db = getDb();
      const documents = await db.document.findMany({
        where: { terrainId },
        orderBy: { uploadedAt: 'desc' },
      });
      return { success: true, data: documents };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('documents:openFile', async (_event, { token, relativePath }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const storagePath = process.env.STORAGE_PATH ?? './data/storage';
      const absPath = path.resolve(storagePath, relativePath);
      if (!fs.existsSync(absPath)) return { success: false, error: 'Fichier introuvable sur le disque' };
      const errMsg = await shell.openPath(absPath);
      if (errMsg) return { success: false, error: errMsg };
      return { success: true };
    } catch (error: any) {
      logger.error('documents:openFile error', error.message);
      return { success: false, error: error.message };
    }
  });
}
