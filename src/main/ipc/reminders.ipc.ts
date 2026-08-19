import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import {
  getReminderPolicy,
  setReminderPolicy,
  applyReminderRules,
  markRuleCodeDeleted,
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
  channel:     z.enum(['EMAIL', 'SMS', 'WHATSAPP']).optional(),
  templateId:  z.number().int().positive().nullable().optional(),
  name:        z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

// Création : le déclencheur (triggerType) n'est modifiable qu'à la création —
// le moteur (applyReminderRules) dispatche déjà génériquement sur les 3 cas
// existants, quel que soit le nombre de règles par cas : ajouter une règle
// « J-3 SMS » à côté des règles seedées ne demande aucun changement du moteur.
const ruleCreateSchema = z.object({
  triggerType: z.enum(['INSTALLMENT_UPCOMING', 'INSTALLMENT_OVERDUE', 'CONVENTION_EXPIRING']),
  name:        z.string().min(1, 'Nom requis'),
  description: z.string().nullable().optional(),
  offsetDays:  z.number().int().min(-365).max(365),
  channel:     z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
  templateId:  z.number().int().positive().nullable().optional(),
  isActive:    z.boolean().optional(),
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

  ipcMain.handle('reminders:createRule', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = ruleCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb() as any;
      // Code lisible mais garanti unique — jamais réutilisé par le moteur
      // (reminders.service.ts n'en dépend que pour le journal/la traçabilité,
      // cf. Communication.metadata.ruleCode).
      const code = `${d.triggerType}_J${d.offsetDays >= 0 ? '+' : ''}${d.offsetDays}_${d.channel}_${Date.now().toString(36).toUpperCase()}`;
      const rule = await db.reminderRule.create({
        data: {
          code,
          triggerType: d.triggerType,
          name: d.name,
          description: d.description ?? null,
          offsetDays: d.offsetDays,
          channel: d.channel,
          templateId: d.templateId ?? null,
          isActive: d.isActive ?? true,
        },
      });
      logger.info(`Reminder rule created: ${rule.code}`);
      return { success: true, data: rule };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Suppression définitive — `ReminderRule` ne porte pas de `deletedAt` (règle
  // de configuration, pas une entité métier soumise à traçabilité/archivage) :
  // la désactivation (`isActive`) reste le geste réversible ; ceci est
  // irréversible. Une fois supprimée, la règle n'apparaît plus dans les
  // passes de relance (le moteur ne lit que les lignes existantes) ; les
  // `Communication` déjà envoyées conservent leur trace (`metadata.ruleCode`
  // est une simple chaîne, sans FK vers `ReminderRule`).
  ipcMain.handle('reminders:deleteRule', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const db = getDb() as any;
      const rule = await db.reminderRule.delete({ where: { id } });
      // Empêche le seed de démarrage (seedDefaultRemindersConfig, exécuté à
      // chaque lancement de l'app) de recréer ce code — sans quoi une règle
      // seedée « supprimée » ne le resterait que jusqu'au prochain redémarrage.
      await markRuleCodeDeleted(rule.code);
      logger.info(`Reminder rule deleted: ${rule.code}`);
      return { success: true };
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

  // Liste des clients actuellement exclus des relances automatiques (au moins
  // un des deux canaux). Les relances WhatsApp partagent l'opt-out SMS (cf.
  // processCandidate dans reminders.service.ts), donc smsOptOut = true exclut
  // aussi bien les SMS que les WhatsApp.
  ipcMain.handle('reminders:listOptedOutClients', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb() as any;
      const data = await db.client.findMany({
        where: {
          deletedAt: null,
          OR: [{ smsOptOut: true }, { emailOptOut: true }],
        },
        select: {
          id: true,
          type: true,
          firstName: true,
          lastName: true,
          entreprise: true,
          email: true,
          phone: true,
          mobile: true,
          smsOptOut: true,
          emailOptOut: true,
        },
        orderBy: [{ lastName: 'asc' }, { entreprise: 'asc' }],
      });
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
