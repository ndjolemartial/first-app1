"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthIPC = registerAuthIPC;
const electron_1 = require("electron");
const auth_service_1 = require("../services/auth.service");
const crypto_1 = require("../utils/crypto");
const db_service_1 = require("../services/db.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Enregistre les handlers IPC pour l'authentification.
 */
function registerAuthIPC() {
    electron_1.ipcMain.handle('auth:login', async (_event, { email, password }) => {
        try {
            const result = await (0, auth_service_1.login)(email, password);
            return { success: true, data: result };
        }
        catch (error) {
            logger_1.default.warn(`Login failed for ${email}: ${error.message}`);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('auth:logout', async (_event, { token }) => {
        try {
            (0, auth_service_1.logout)(token);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('auth:me', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const user = await db.user.findUnique({
                where: { id: session.userId },
                select: {
                    id: true, uuid: true, matricule: true, firstName: true, lastName: true,
                    email: true, role: true, isActive: true, avatar: true, lastLoginAt: true,
                },
            });
            return { success: true, data: user };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('auth:changePassword', async (_event, { token, currentPassword, newPassword }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const user = await db.user.findUnique({ where: { id: session.userId } });
            if (!user)
                return { success: false, error: 'Utilisateur introuvable' };
            const { comparePassword } = await Promise.resolve().then(() => __importStar(require('../utils/crypto')));
            const valid = await comparePassword(currentPassword, user.password);
            if (!valid)
                return { success: false, error: 'Mot de passe actuel incorrect' };
            const hashed = await (0, crypto_1.hashPassword)(newPassword);
            await db.user.update({ where: { id: user.id }, data: { password: hashed } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
