"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMailAccountIPC = registerMailAccountIPC;
const electron_1 = require("electron");
const imapflow_1 = require("imapflow");
const zod_1 = require("zod");
const auth_service_1 = require("../services/auth.service");
const db_service_1 = require("../services/db.service");
const secretCrypto_1 = require("../utils/secretCrypto");
const imapError_1 = require("../utils/imapError");
const settings_service_1 = require("../services/settings.service");
const logger_1 = __importDefault(require("../utils/logger"));
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
const mailAccountSchema = zod_1.z.object({
    host: zod_1.z.string().optional(),
    port: zod_1.z.coerce.number().int().min(1).max(65535).optional(),
    secure: zod_1.z.boolean().optional(),
    user: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
    folder: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    // À true, mailbox-poller.service.ts journalise tous les messages reçus
    // dans cette boîte, pas seulement les réponses à un envoi de l'app.
    receiveAllMessages: zod_1.z.boolean().optional(),
});
function registerMailAccountIPC() {
    electron_1.ipcMain.handle('mailAccount:get', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const account = await db.mailAccount.findUnique({ where: { userId: session.userId } });
            return {
                success: true,
                data: account ? {
                    host: account.imapHost,
                    port: account.imapPort,
                    secure: account.imapSecure,
                    user: account.imapUser,
                    password: settings_service_1.SECRET_MASK,
                    passwordSet: true,
                    folder: account.folder,
                    isActive: account.isActive,
                    receiveAllMessages: account.receiveAllMessages,
                    lastPolledAt: account.lastPolledAt,
                    lastError: account.lastError,
                } : null,
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('mailAccount:upsert', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const parsed = mailAccountSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const existing = await db.mailAccount.findUnique({ where: { userId: session.userId } });
            const data = {};
            if (d.host !== undefined)
                data.imapHost = d.host;
            if (d.port !== undefined)
                data.imapPort = d.port;
            if (d.secure !== undefined)
                data.imapSecure = d.secure;
            if (d.user !== undefined)
                data.imapUser = d.user;
            if (d.folder !== undefined)
                data.folder = d.folder;
            if (d.isActive !== undefined)
                data.isActive = d.isActive;
            if (d.receiveAllMessages !== undefined)
                data.receiveAllMessages = d.receiveAllMessages;
            if (d.password !== undefined && d.password !== settings_service_1.SECRET_MASK) {
                data.imapPasswordEnc = (0, secretCrypto_1.encryptSecret)(d.password);
            }
            if (existing) {
                await db.mailAccount.update({ where: { id: existing.id }, data });
            }
            else {
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
            logger_1.default.info(`Boîte email personnelle mise à jour (utilisateur ${session.userId})`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('mailAccount:upsert', err.message);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('mailAccount:test', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const account = await db.mailAccount.findUnique({ where: { userId: session.userId } });
            // Teste en priorité les valeurs actuellement saisies dans le formulaire
            // (pas encore enregistrées), avec repli sur le compte déjà enregistré
            // pour tout champ omis — notamment le mot de passe, jamais renvoyé en
            // clair au renderer (masqué par SECRET_MASK une fois défini).
            const parsed = mailAccountSchema.safeParse(payload ?? {});
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            const d = parsed.data;
            const host = d.host || account?.imapHost;
            const port = d.port ?? account?.imapPort ?? 993;
            const secure = d.secure ?? account?.imapSecure ?? true;
            const user = d.user || account?.imapUser;
            const password = d.password && d.password !== settings_service_1.SECRET_MASK
                ? d.password
                : account ? (0, secretCrypto_1.decryptSecret)(account.imapPasswordEnc) : undefined;
            if (!host || !user || !password) {
                return { success: false, error: 'Hôte, utilisateur et mot de passe requis.' };
            }
            const client = new imapflow_1.ImapFlow({
                host, port, secure,
                auth: { user, pass: password }, logger: false,
            });
            try {
                await client.connect();
                await client.logout();
            }
            finally {
                try {
                    client.close();
                }
                catch { /* déjà fermé */ }
            }
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('mailAccount:test', err.message);
            return { success: false, error: `Connexion IMAP échouée : ${(0, imapError_1.describeImapError)(err)}` };
        }
    });
    electron_1.ipcMain.handle('mailAccount:delete', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            await db.mailAccount.deleteMany({ where: { userId: session.userId } });
            logger_1.default.info(`Boîte email personnelle supprimée (utilisateur ${session.userId})`);
            return { success: true };
        }
        catch (err) {
            logger_1.default.error('mailAccount:delete', err.message);
            return { success: false, error: err.message };
        }
    });
}
