import { ipcMain } from 'electron';
import { ImapFlow } from 'imapflow';
import { z } from 'zod';
import { getSession } from '../services/auth.service';
import { getDb } from '../services/db.service';
import { encryptSecret, decryptSecret } from '../utils/secretCrypto';
import { describeImapError } from '../utils/imapError';
import { SECRET_MASK } from '../services/settings.service';
import logger from '../utils/logger';

/**
 * Boîte email personnelle (self-service) — un utilisateur connecte
 * volontairement (opt-in) sa propre boîte IMAP pour récupérer, dans l'app,
 * les réponses aux emails qu'il envoie « en tant que lui-même » (mode
 * `senderSelf`, communication.ipc.ts) et qui atterrissent sinon uniquement
 * dans sa vraie boîte mail (Gmail, Outlook…), hors de l'application.
 *
 * Strictement self-only — aucun paramètre d'utilisateur cible, comme
 * `auth:updateProfile` (auth.ipc.ts) : chaque utilisateur ne gère que sa
 * propre `MailAccount` (userId = session.userId). Accessible à tout
 * utilisateur authentifié, sans restriction de rôle.
 */

const mailAccountSchema = z.object({
  host:     z.string().optional(),
  port:     z.coerce.number().int().min(1).max(65535).optional(),
  secure:   z.boolean().optional(),
  user:     z.string().optional(),
  password: z.string().optional(),
  folder:   z.string().optional(),
  isActive: z.boolean().optional(),
  // À true, mailbox-poller.service.ts journalise tous les messages reçus
  // dans cette boîte, pas seulement les réponses à un envoi de l'app.
  receiveAllMessages: z.boolean().optional(),
});

export function registerMailAccountIPC(): void {
  ipcMain.handle('mailAccount:get', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const account = await db.mailAccount.findUnique({ where: { userId: session.userId } });
      return {
        success: true,
        data: account ? {
          host:        account.imapHost,
          port:        account.imapPort,
          secure:      account.imapSecure,
          user:        account.imapUser,
          password:    SECRET_MASK,
          passwordSet: true,
          folder:      account.folder,
          isActive:    account.isActive,
          receiveAllMessages: account.receiveAllMessages,
          lastPolledAt: account.lastPolledAt,
          lastError:    account.lastError,
        } : null,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mailAccount:upsert', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const parsed = mailAccountSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const d = parsed.data;
      const db = getDb();
      const existing = await db.mailAccount.findUnique({ where: { userId: session.userId } });

      const data: any = {};
      if (d.host !== undefined) data.imapHost = d.host;
      if (d.port !== undefined) data.imapPort = d.port;
      if (d.secure !== undefined) data.imapSecure = d.secure;
      if (d.user !== undefined) data.imapUser = d.user;
      if (d.folder !== undefined) data.folder = d.folder;
      if (d.isActive !== undefined) data.isActive = d.isActive;
      if (d.receiveAllMessages !== undefined) data.receiveAllMessages = d.receiveAllMessages;
      if (d.password !== undefined && d.password !== SECRET_MASK) {
        data.imapPasswordEnc = encryptSecret(d.password);
      }

      if (existing) {
        await db.mailAccount.update({ where: { id: existing.id }, data });
      } else {
        if (!data.imapHost || !data.imapUser || !data.imapPasswordEnc) {
          return { success: false, error: 'Hôte, utilisateur et mot de passe requis.' };
        }
        await db.mailAccount.create({
          data: {
            userId: session.userId,
            imapHost: data.imapHost,
            imapPort: data.imapPort ?? 993,
            imapSecure: data.imapSecure ?? true,
            imapUser: data.imapUser,
            imapPasswordEnc: data.imapPasswordEnc,
            folder: data.folder ?? 'INBOX',
            isActive: data.isActive ?? true,
            receiveAllMessages: data.receiveAllMessages ?? false,
          },
        });
      }
      logger.info(`Boîte email personnelle mise à jour (utilisateur ${session.userId})`);
      return { success: true };
    } catch (err: any) {
      logger.error('mailAccount:upsert', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mailAccount:test', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const account = await db.mailAccount.findUnique({ where: { userId: session.userId } });
      // Teste en priorité les valeurs actuellement saisies dans le formulaire
      // (pas encore enregistrées), avec repli sur le compte déjà enregistré
      // pour tout champ omis — notamment le mot de passe, jamais renvoyé en
      // clair au renderer (masqué par SECRET_MASK une fois défini).
      const parsed = mailAccountSchema.safeParse(payload ?? {});
      if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
      const d = parsed.data;
      const host = d.host || account?.imapHost;
      const port = d.port ?? account?.imapPort ?? 993;
      const secure = d.secure ?? account?.imapSecure ?? true;
      const user = d.user || account?.imapUser;
      const password = d.password && d.password !== SECRET_MASK
        ? d.password
        : account ? decryptSecret(account.imapPasswordEnc) : undefined;
      if (!host || !user || !password) {
        return { success: false, error: 'Hôte, utilisateur et mot de passe requis.' };
      }
      const client = new ImapFlow({
        host, port, secure,
        auth: { user, pass: password }, logger: false,
      });
      try {
        await client.connect();
        await client.logout();
      } finally {
        try { client.close(); } catch { /* déjà fermé */ }
      }
      return { success: true };
    } catch (err: any) {
      logger.error('mailAccount:test', err.message);
      return { success: false, error: `Connexion IMAP échouée : ${describeImapError(err)}` };
    }
  });

  ipcMain.handle('mailAccount:delete', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await db.mailAccount.deleteMany({ where: { userId: session.userId } });
      logger.info(`Boîte email personnelle supprimée (utilisateur ${session.userId})`);
      return { success: true };
    } catch (err: any) {
      logger.error('mailAccount:delete', err.message);
      return { success: false, error: err.message };
    }
  });
}
