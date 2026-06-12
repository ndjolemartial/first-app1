"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConfigIPC = registerConfigIPC;
const electron_1 = require("electron");
const client_1 = require("@prisma/client");
const loadEnv_1 = require("../utils/loadEnv");
const db_service_1 = require("../services/db.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Configuration de la connexion base de données — accessible AVANT
 * authentification (la BDD peut être injoignable). Aucun jeton requis : ces
 * handlers ne lisent/écrivent que le fichier de config local et testent une
 * connexion. Réservé à un usage poste de travail (application de bureau).
 */
const isValidConfig = (c) => c && typeof c.host === 'string' && c.host.trim() !== ''
    && typeof c.database === 'string' && c.database.trim() !== ''
    && typeof c.user === 'string';
function registerConfigIPC() {
    // Lecture de la configuration courante (pré-remplit l'écran de réglage).
    electron_1.ipcMain.handle('config:getDb', async () => {
        try {
            return { success: true, data: { ...(0, loadEnv_1.readDbConfig)(), envFile: (0, loadEnv_1.getEnvFilePath)() } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Test de connexion avec les paramètres fournis (sans rien enregistrer).
    electron_1.ipcMain.handle('config:testDb', async (_event, { config }) => {
        if (!isValidConfig(config)) {
            return { success: false, error: 'Hôte, base et utilisateur sont requis.' };
        }
        const url = (0, loadEnv_1.buildDatabaseUrl)(config);
        const client = new client_1.PrismaClient({ datasourceUrl: url });
        try {
            await client.$queryRawUnsafe('SELECT 1');
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
        finally {
            await client.$disconnect().catch(() => undefined);
        }
    });
    // Enregistre la configuration puis reconstruit le client Prisma à chaud.
    electron_1.ipcMain.handle('config:saveDb', async (_event, { config }) => {
        if (!isValidConfig(config)) {
            return { success: false, error: 'Hôte, base et utilisateur sont requis.' };
        }
        try {
            const url = (0, loadEnv_1.buildDatabaseUrl)(config);
            (0, loadEnv_1.writeDatabaseUrl)(url);
            await (0, db_service_1.reconnectDb)();
            logger_1.default.info(`Configuration BDD mise à jour (${config.host}:${config.port}/${config.database})`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error(`config:saveDb error: ${error.message}`);
            return { success: false, error: error.message };
        }
    });
}
