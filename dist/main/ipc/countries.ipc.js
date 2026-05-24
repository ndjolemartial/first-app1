"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCountriesIPC = registerCountriesIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Enregistre les handlers IPC de la table de référence des pays.
 */
function registerCountriesIPC() {
    /**
     * Retourne la liste complète des pays (code ISO 3166-1 alpha-2, nom,
     * indicatif téléphonique), triée par nom. Données de référence en lecture seule.
     */
    electron_1.ipcMain.handle('countries:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const data = await db.country.findMany({ orderBy: { name: 'asc' } });
            return { success: true, data };
        }
        catch (error) {
            logger_1.default.error('countries:list error', error.message);
            return { success: false, error: error.message };
        }
    });
}
