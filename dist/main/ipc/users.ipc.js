"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUsersIPC = registerUsersIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const crypto_1 = require("../utils/crypto");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const createUserSchema = zod_1.z.object({
    matricule: zod_1.z.string().min(1),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    login: zod_1.z.string().optional(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'READONLY']),
    phone: zod_1.z.string().optional(),
    mobile: zod_1.z.string().optional(),
    fonction: zod_1.z.string().optional(),
    idNumber: zod_1.z.string().optional(),
    civilite: zod_1.z.enum(['MONSIEUR', 'MADAME', 'MADEMOISELLE']).optional(),
    statutConjugal: zod_1.z.enum(['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE']).optional(),
    hireDate: zod_1.z.string().optional(),
    cnpsNumber: zod_1.z.string().optional(),
    residence: zod_1.z.string().optional(),
});
const updateUserSchema = createUserSchema
    .omit({ password: true })
    .extend({ isActive: zod_1.z.boolean().optional() })
    .partial();
/**
 * Enregistre les handlers IPC pour la gestion des utilisateurs.
 */
function registerUsersIPC() {
    electron_1.ipcMain.handle('users:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.role)
                where.role = filters.role;
            if (filters.isActive !== undefined)
                where.isActive = filters.isActive;
            if (filters.search) {
                where.OR = [
                    { firstName: { contains: filters.search } },
                    { lastName: { contains: filters.search } },
                    { email: { contains: filters.search } },
                    { matricule: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.user.findMany({
                    where,
                    select: {
                        id: true, uuid: true, matricule: true, firstName: true, lastName: true,
                        email: true, role: true, isActive: true, avatar: true, phone: true,
                        mobile: true, lastLoginAt: true, createdAt: true,
                    },
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                db.user.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('users:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('users:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const db = (0, db_service_1.getDb)();
            const user = await db.user.findUnique({
                where: { id, deletedAt: null },
                select: {
                    id: true, uuid: true, matricule: true, firstName: true, lastName: true,
                    email: true, login: true, role: true, isActive: true, avatar: true, phone: true,
                    mobile: true, fonction: true, idNumber: true, civilite: true,
                    statutConjugal: true, hireDate: true, cnpsNumber: true, residence: true,
                    lastLoginAt: true, createdAt: true, updatedAt: true,
                },
            });
            if (!user)
                return { success: false, error: 'Utilisateur introuvable' };
            return { success: true, data: user };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('users:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const parsed = createUserSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const { password, hireDate, ...rest } = parsed.data;
            const hashed = await (0, crypto_1.hashPassword)(password);
            const user = await db.user.create({
                data: { ...rest, password: hashed, hireDate: hireDate ? new Date(hireDate) : null },
                select: {
                    id: true, uuid: true, matricule: true, firstName: true, lastName: true,
                    email: true, role: true, isActive: true,
                },
            });
            logger_1.default.info(`User created: ${user.email}`);
            return { success: true, data: user };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('users:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const parsed = updateUserSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const { hireDate, ...rest } = parsed.data;
            const data = { ...rest };
            if (hireDate !== undefined)
                data.hireDate = hireDate ? new Date(hireDate) : null;
            const user = await db.user.update({
                where: { id, deletedAt: null },
                data,
                select: {
                    id: true, uuid: true, firstName: true, lastName: true, email: true,
                    role: true, isActive: true,
                },
            });
            return { success: true, data: user };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('users:resetPassword', async (_event, { token, id, newPassword }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            if (!newPassword || newPassword.length < 6)
                return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' };
            const db = (0, db_service_1.getDb)();
            const hashed = await (0, crypto_1.hashPassword)(newPassword);
            await db.user.update({ where: { id }, data: { password: hashed } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('users:toggleActive', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const db = (0, db_service_1.getDb)();
            const user = await db.user.findUnique({ where: { id }, select: { isActive: true } });
            if (!user)
                return { success: false, error: 'Utilisateur introuvable' };
            const updated = await db.user.update({
                where: { id },
                data: { isActive: !user.isActive },
                select: { id: true, isActive: true },
            });
            return { success: true, data: updated };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
