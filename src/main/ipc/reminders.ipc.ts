import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import {
  getReminderPolicy,
  setReminderPolicy,
  applyReminderRules,
} from '../services/reminders.service';
import logger from '../utils/logger';
import { z } from 'zod';

const ADMIN_ROLES   = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES    = [...ADMIN_ROLES, 'ACCOUNTANT', 'AGENT', 'READONLY'];

const policySchema = z.object({
  enabled:         z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietDays:       z.array(z.number().int().min(0).max(6)).optional(),
});

const ruleUpdateSchema = z.object({
  isActive:    z.boolean().optional(),
  offsetDays:  z.number().int().min(-365).max(365).optional(),
  channel:     z.enum(['EMAIL', 'SMS']).optional(),
  templateId:  z.number().int().positive().nullable().optional(),
  name:        z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

const clientOptOutSchema = z.object({
  clientId:    z.number().int().positive(),
  smsOptOut:   z.boolean().optional(),
  emailOptOut: z.boolean().optional(),
});

export function registerRemindersIPC(): void {
  // ── Politique globale ─────────────────────────────────────────────────────

  ipcMain.handle('reminders:getPolicy', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const data = await getReminderPolicy();
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reminders:updatePolicy', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = policySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const data = await setReminderPolicy(parsed.data);
      logger.info(`Reminder policy updated (enabled=${data.enabled})`);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Règles ────────────────────────────────────────────────────────────────

  ipcMain.handle('reminders:listRules', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb() as any;
      const data = await db.reminderRule.findMany({
        orderBy: [{ triggerType: 'asc' }, { offsetDays: 'asc' }],
        include: { template: { select: { id: true, name: true, channel: true } } },
      });
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('reminders:updateRule', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = ruleUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb() as any;
      const rule = await db.reminderRule.update({ where: { id }, data: parsed.data });
      return { success: true, data: rule };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Exécution manuelle ────────────────────────────────────────────────────

  ipcMain.handle('reminders:runNow', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      // `force: true` ignore on/off et heures silencieuses pour le déclenchement manuel.
      const data = await applyReminderRules({ force: true });
      logger.info(`Manual reminders pass — sent=${data.sent} skipped=${data.skipped} failed=${data.failed}`);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Opt-out par client ────────────────────────────────────────────────────

  ipcMain.handle('reminders:setClientOptOut', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = clientOptOutSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb() as any;
      const data: any = {};
      if (parsed.data.smsOptOut   !== undefined) data.smsOptOut   = parsed.data.smsOptOut;
      if (parsed.data.emailOptOut !== undefined) data.emailOptOut = parsed.data.emailOptOut;
      const client = await db.client.update({
        where: { id: parsed.data.clientId },
        data,
        select: { id: true, smsOptOut: true, emailOptOut: true },
      });
      return { success: true, data: client };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
