"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRemindersIPC = registerRemindersIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const reminders_service_1 = require("../services/reminders.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...ADMIN_ROLES, 'ACCOUNTANT', 'AGENT', 'READONLY'];
const policySchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    quietHoursStart: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    quietHoursEnd: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    quietDays: zod_1.z.array(zod_1.z.number().int().min(0).max(6)).optional(),
});
const ruleUpdateSchema = zod_1.z.object({
    isActive: zod_1.z.boolean().optional(),
    offsetDays: zod_1.z.number().int().min(-365).max(365).optional(),
    channel: zod_1.z.enum(['EMAIL', 'SMS', 'WHATSAPP']).optional(),
    templateId: zod_1.z.number().int().positive().nullable().optional(),
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().nullable().optional(),
});
const clientOptOutSchema = zod_1.z.object({
    clientId: zod_1.z.number().int().positive(),
    smsOptOut: zod_1.z.boolean().optional(),
    emailOptOut: zod_1.z.boolean().optional(),
});
function registerRemindersIPC() {
    // ── Politique globale ─────────────────────────────────────────────────────
    electron_1.ipcMain.handle('reminders:getPolicy', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const data = await (0, reminders_service_1.getReminderPolicy)();
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('reminders:updatePolicy', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = policySchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const data = await (0, reminders_service_1.setReminderPolicy)(parsed.data);
            logger_1.default.info(`Reminder policy updated (enabled=${data.enabled})`);
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Règles ────────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('reminders:listRules', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await db.reminderRule.findMany({
                orderBy: [{ triggerType: 'asc' }, { offsetDays: 'asc' }],
                include: { template: { select: { id: true, name: true, channel: true } } },
            });
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('reminders:updateRule', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = ruleUpdateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const rule = await db.reminderRule.update({ where: { id }, data: parsed.data });
            return { success: true, data: rule };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Exécution manuelle ────────────────────────────────────────────────────
    electron_1.ipcMain.handle('reminders:runNow', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            // `force: true` ignore on/off et heures silencieuses pour le déclenchement manuel.
            const data = await (0, reminders_service_1.applyReminderRules)({ force: true });
            logger_1.default.info(`Manual reminders pass — sent=${data.sent} skipped=${data.skipped} failed=${data.failed}`);
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Opt-out par client ────────────────────────────────────────────────────
    electron_1.ipcMain.handle('reminders:setClientOptOut', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ADMIN_ROLES);
            const parsed = clientOptOutSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = {};
            if (parsed.data.smsOptOut !== undefined)
                data.smsOptOut = parsed.data.smsOptOut;
            if (parsed.data.emailOptOut !== undefined)
                data.emailOptOut = parsed.data.emailOptOut;
            const client = await db.client.update({
                where: { id: parsed.data.clientId },
                data,
                select: { id: true, smsOptOut: true, emailOptOut: true },
            });
            return { success: true, data: client };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
