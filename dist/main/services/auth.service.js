"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.logout = logout;
exports.getSession = getSession;
exports.requireSession = requireSession;
exports.checkRole = checkRole;
const db_service_1 = require("./db.service");
const crypto_1 = require("../utils/crypto");
const logger_1 = __importDefault(require("../utils/logger"));
const sessions = new Map();
/**
 * Authentifie un utilisateur et crée une session.
 */
async function login(email, password) {
    const db = (0, db_service_1.getDb)();
    const user = await db.user.findUnique({
        where: { email, deletedAt: null },
        select: {
            id: true, uuid: true, matricule: true, firstName: true, lastName: true,
            email: true, password: true, role: true, isActive: true, avatar: true,
        },
    });
    if (!user || !user.isActive) {
        throw new Error('Identifiants invalides ou compte inactif');
    }
    const valid = await (0, crypto_1.comparePassword)(password, user.password);
    if (!valid) {
        throw new Error('Identifiants invalides');
    }
    const token = (0, crypto_1.generateToken)();
    sessions.set(token, { userId: user.id, role: user.role, token, createdAt: new Date() });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    logger_1.default.info(`User ${user.email} logged in`);
    const { password: _, ...safeUser } = user;
    return { user: safeUser, token };
}
/**
 * Invalide la session d'un utilisateur.
 */
function logout(token) {
    sessions.delete(token);
}
/**
 * Récupère la session associée à un token.
 */
function getSession(token) {
    return sessions.get(token);
}
/**
 * Vérifie qu'un appel IPC provient d'une session valide et retourne la session.
 * Le token est transmis via les headers de la WebContents frame.
 */
function requireSession(event) {
    const token = event.sender._authToken;
    if (!token)
        throw new Error('Non authentifié');
    const session = sessions.get(token);
    if (!session)
        throw new Error('Session expirée');
    return session;
}
/**
 * Vérifie les permissions d'un rôle pour une action.
 */
function checkRole(session, allowedRoles) {
    if (!allowedRoles.includes(session.role)) {
        throw new Error('Permission insuffisante');
    }
}
