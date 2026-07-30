"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCareerProfilesIPC = registerCareerProfilesIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
/** Paramétrage des profils de carrière : réservé aux SEULS SUPER_ADMIN/ADMIN
 *  (rôle exact — aucune équivalence MANAGER/ACCOUNTANT ici). */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const ser = (v) => JSON.parse(JSON.stringify(v));
const stepSchema = zod_1.z.object({
    poste: zod_1.z.string().min(1, 'Poste requis'),
    order: zod_1.z.number().int().positive(),
    rolePrincipal: zod_1.z.string().optional().nullable(),
    competencesDiplomes: zod_1.z.string().optional().nullable(),
    categorieSocioPro: zod_1.z.string().optional().nullable(),
    categorieCode: zod_1.z.string().optional().nullable(),
    avantages: zod_1.z.string().optional().nullable(),
});
const careerProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nom requis'),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
    steps: zod_1.z.array(stepSchema).min(1, 'Au moins une étape (poste) est requise'),
});
/**
 * Vérifie que les postes et les rangs (`order`) soumis sont uniques entre eux
 * (un même poste ne peut apparaître qu'une seule fois au sein d'un même
 * profil — il peut en revanche être partagé par plusieurs profils distincts).
 */
function assertStepsInternallyConsistent(steps) {
    const postes = steps.map((s) => s.poste.trim());
    if (new Set(postes).size !== postes.length)
        return 'Un même poste ne peut apparaître qu\'une seule fois dans la filière.';
    const orders = steps.map((s) => s.order);
    if (new Set(orders).size !== orders.length)
        return 'Les rangs des étapes doivent être uniques.';
    return null;
}
function registerCareerProfilesIPC() {
    electron_1.ipcMain.handle('careerProfiles:list', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.careerProfile.findMany({
                where: { deletedAt: null },
                include: { steps: { orderBy: { order: 'asc' } } },
                orderBy: { name: 'asc' },
            });
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('careerProfiles:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('careerProfiles:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.careerProfile.findFirst({
                where: { id, deletedAt: null },
                include: { steps: { orderBy: { order: 'asc' } } },
            });
            if (!data)
                return { success: false, error: 'Profil de carrière introuvable' };
            return ser({ success: true, data });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('careerProfiles:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = careerProfileSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const d = parsed.data;
            const consistencyError = assertStepsInternallyConsistent(d.steps);
            if (consistencyError)
                return { success: false, error: consistencyError };
            const db = (0, db_service_1.getDb)();
            const data = await db.careerProfile.create({
                data: {
                    name: d.name.trim(),
                    description: d.description || null,
                    isActive: d.isActive ?? true,
                    steps: {
                        create: d.steps.map((s) => ({
                            poste: s.poste.trim(),
                            order: s.order,
                            rolePrincipal: s.rolePrincipal || null,
                            competencesDiplomes: s.competencesDiplomes || null,
                            categorieSocioPro: s.categorieSocioPro || null,
                            categorieCode: s.categorieCode || null,
                            avantages: s.avantages || null,
                        })),
                    },
                },
                include: { steps: { orderBy: { order: 'asc' } } },
            });
            logger_1.default.info(`Profil de carrière créé : ${data.name}`);
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('careerProfiles:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('careerProfiles:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = careerProfileSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const d = parsed.data;
            const consistencyError = assertStepsInternallyConsistent(d.steps);
            if (consistencyError)
                return { success: false, error: consistencyError };
            const db = (0, db_service_1.getDb)();
            const existing = await db.careerProfile.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                return { success: false, error: 'Profil de carrière introuvable' };
            const data = await db.$transaction(async (tx) => {
                await tx.careerProfile.update({
                    where: { id },
                    data: { name: d.name.trim(), description: d.description || null, isActive: d.isActive ?? true },
                });
                await tx.careerProfileStep.deleteMany({ where: { careerProfileId: id } });
                await tx.careerProfileStep.createMany({
                    data: d.steps.map((s) => ({
                        careerProfileId: id,
                        poste: s.poste.trim(),
                        order: s.order,
                        rolePrincipal: s.rolePrincipal || null,
                        competencesDiplomes: s.competencesDiplomes || null,
                        categorieSocioPro: s.categorieSocioPro || null,
                        categorieCode: s.categorieCode || null,
                        avantages: s.avantages || null,
                    })),
                });
                return tx.careerProfile.findUnique({ where: { id }, include: { steps: { orderBy: { order: 'asc' } } } });
            });
            logger_1.default.info(`Profil de carrière modifié : ${data?.name}`);
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('careerProfiles:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('careerProfiles:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            // Les étapes sont réellement supprimées (pas de soft delete) — le profil,
            // lui, reste soft-deleted (traçabilité, cohérent avec le reste de l'app).
            await db.$transaction([
                db.careerProfileStep.deleteMany({ where: { careerProfileId: id } }),
                db.careerProfile.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } }),
            ]);
            logger_1.default.info(`Profil de carrière supprimé (soft) : id=${id}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('careerProfiles:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('careerProfiles:duplicate', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const db = (0, db_service_1.getDb)();
            const original = await db.careerProfile.findFirst({
                where: { id, deletedAt: null },
                include: { steps: { orderBy: { order: 'asc' } } },
            });
            if (!original)
                return { success: false, error: 'Profil de carrière introuvable' };
            const data = await db.careerProfile.create({
                data: {
                    name: `${original.name} (copie)`,
                    description: original.description,
                    isActive: original.isActive,
                    steps: {
                        create: original.steps.map((s) => ({
                            poste: s.poste,
                            order: s.order,
                            rolePrincipal: s.rolePrincipal,
                            competencesDiplomes: s.competencesDiplomes,
                            categorieSocioPro: s.categorieSocioPro,
                            categorieCode: s.categorieCode,
                            avantages: s.avantages,
                        })),
                    },
                },
                include: { steps: { orderBy: { order: 'asc' } } },
            });
            logger_1.default.info(`Profil de carrière dupliqué : « ${original.name} » → « ${data.name} »`);
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('careerProfiles:duplicate error', error.message);
            return { success: false, error: error.message };
        }
    });
}
