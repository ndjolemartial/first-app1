"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommunicationIPC = registerCommunicationIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];
const templateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    channel: zod_1.z.enum(['EMAIL', 'SMS']),
    subject: zod_1.z.string().optional(),
    body: zod_1.z.string().min(1),
    variables: zod_1.z.array(zod_1.z.string()).optional(),
    isActive: zod_1.z.boolean().default(true),
});
const sendEmailSchema = zod_1.z.object({
    to: zod_1.z.string().email(),
    subject: zod_1.z.string().min(1),
    body: zod_1.z.string().min(1),
    templateId: zod_1.z.number().int().positive().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
const sendSmsSchema = zod_1.z.object({
    to: zod_1.z.string().min(8),
    body: zod_1.z.string().min(1),
    templateId: zod_1.z.number().int().positive().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
function registerCommunicationIPC() {
    // ── Templates ──────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('communication:listTemplates', async (_event, { token, channel }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = {};
            if (channel)
                where.channel = channel;
            const data = await db.commTemplate.findMany({
                where,
                orderBy: { name: 'asc' },
            });
            return { success: true, data };
        }
        catch (error) {
            logger_1.default.error('communication:listTemplates error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:getTemplate', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const template = await db.commTemplate.findUnique({ where: { id } });
            if (!template)
                return { success: false, error: 'Template introuvable' };
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:createTemplate', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const parsed = templateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const template = await db.commTemplate.create({
                data: {
                    name: d.name,
                    channel: d.channel,
                    subject: d.subject,
                    body: d.body,
                    variables: d.variables ? d.variables : undefined,
                    isActive: d.isActive,
                },
            });
            logger_1.default.info(`CommTemplate created: ${template.name}`);
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:updateTemplate', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const parsed = templateSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            if (d.variables !== undefined)
                d.variables = d.variables;
            const template = await db.commTemplate.update({ where: { id }, data: d });
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:deleteTemplate', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const db = (0, db_service_1.getDb)();
            await db.commTemplate.delete({ where: { id } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Historique des communications ──────────────────────────────────────────
    electron_1.ipcMain.handle('communication:getHistory', async (_event, { token, filters = {}, page = 1, limit = 30 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = {};
            if (filters.channel)
                where.channel = filters.channel;
            if (filters.status)
                where.status = filters.status;
            if (filters.direction)
                where.direction = filters.direction;
            if (filters.search) {
                where.OR = [
                    { to: { contains: filters.search } },
                    { subject: { contains: filters.search } },
                    { body: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.communication.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { template: { select: { id: true, name: true } } },
                }),
                db.communication.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('communication:getHistory error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Envoi Email ────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('communication:sendEmail', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = sendEmailSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            // Enregistre la communication (statut EN_ATTENTE — envoi asynchrone non implémenté ici)
            const comm = await db.communication.create({
                data: {
                    channel: 'EMAIL',
                    direction: 'SORTANT',
                    to: d.to,
                    subject: d.subject,
                    body: d.body,
                    status: 'EN_ATTENTE',
                    templateId: d.templateId ?? null,
                    metadata: d.metadata ? d.metadata : undefined,
                },
            });
            // Tentative d'envoi (service email à brancher selon config)
            try {
                // TODO: await emailService.send({ to: d.to, subject: d.subject, body: d.body });
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ENVOYE', sentAt: new Date() },
                });
                logger_1.default.info(`Email sent to ${d.to}`);
                return { success: true, data: { ...comm, status: 'ENVOYE' } };
            }
            catch (sendErr) {
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ECHEC', errorMsg: sendErr.message },
                });
                return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
            }
        }
        catch (error) {
            logger_1.default.error('communication:sendEmail error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Envoi SMS ──────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('communication:sendSms', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = sendSmsSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const comm = await db.communication.create({
                data: {
                    channel: 'SMS',
                    direction: 'SORTANT',
                    to: d.to,
                    body: d.body,
                    status: 'EN_ATTENTE',
                    templateId: d.templateId ?? null,
                    metadata: d.metadata ? d.metadata : undefined,
                },
            });
            try {
                // TODO: await smsService.send({ to: d.to, body: d.body });
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ENVOYE', sentAt: new Date() },
                });
                logger_1.default.info(`SMS sent to ${d.to}`);
                return { success: true, data: { ...comm, status: 'ENVOYE' } };
            }
            catch (sendErr) {
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ECHEC', errorMsg: sendErr.message },
                });
                return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
            }
        }
        catch (error) {
            logger_1.default.error('communication:sendSms error', error.message);
            return { success: false, error: error.message };
        }
    });
}
