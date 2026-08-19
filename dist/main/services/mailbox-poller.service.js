"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollMailAccount = pollMailAccount;
exports.pollAllMailAccounts = pollAllMailAccounts;
exports.scheduleMailboxPolling = scheduleMailboxPolling;
const imapflow_1 = require("imapflow");
const mailparser_1 = require("mailparser");
const db_service_1 = require("./db.service");
const secretCrypto_1 = require("../utils/secretCrypto");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Adresses Cc/Bcc d'un message reçu, normalisées en minuscules et encadrées
 * de « | » (ex. "|a@x.ci|b@y.ci|") pour un filtrage `contains` sûr côté
 * visibilité (communication:getHistory) — évite les faux positifs de
 * sous-chaîne d'une simple liste séparée par virgules. `undefined` si aucune.
 * (Bcc n'est généralement pas préservé par le serveur d'envoi d'origine —
 * capturé ici par précaution si jamais présent.)
 */
function extractCcAddresses(...fields) {
    const addresses = fields
        .flatMap((f) => (Array.isArray(f) ? f : f ? [f] : []))
        .flatMap((f) => f.value ?? [])
        .map((v) => v.address?.toLowerCase())
        .filter((a) => !!a);
    const unique = [...new Set(addresses)];
    return unique.length ? `|${unique.join('|')}|` : null;
}
/**
 * Résout le rattachement d'un message entrant par correspondance Message-ID
 * uniquement (In-Reply-To, puis chaque entrée de References) — c'est ce fil
 * qui détermine si le message prolonge un échange initié depuis l'app.
 * Retourne `null` si aucun `Communication` SORTANT ne correspond : le message
 * n'est alors pas une réponse à un envoi de l'app et doit être ignoré par
 * l'appelant, quelle que soit l'adresse de l'expéditeur.
 */
async function resolveAttachment(db, inReplyTo, references) {
    const candidateIds = [inReplyTo, ...references].filter((v) => !!v);
    if (!candidateIds.length)
        return null;
    const parent = await db.communication.findFirst({
        where: { messageId: { in: candidateIds }, direction: 'SORTANT' },
        select: { id: true, clientId: true, ownerId: true, conventionId: true, referrerId: true, prospectId: true },
        orderBy: { createdAt: 'desc' },
    });
    if (!parent)
        return null;
    return {
        parentCommunicationId: parent.id,
        clientId: parent.clientId,
        ownerId: parent.ownerId,
        conventionId: parent.conventionId,
        referrerId: parent.referrerId,
        prospectId: parent.prospectId,
    };
}
/**
 * Rattachement de repli par adresse expéditrice, parmi les contacts connus
 * (Client/Prospect/Owner/BusinessReferrer) — utilisé uniquement pour les
 * boîtes en mode « Recevoir tous les messages », sur un message sans
 * correspondance de fil, pour lui donner malgré tout une entité rattachée
 * quand l'expéditeur est identifiable.
 */
async function resolveAttachmentByEmail(db, fromAddress) {
    const empty = { clientId: null, ownerId: null, referrerId: null, prospectId: null };
    if (!fromAddress)
        return empty;
    const addr = fromAddress.toLowerCase();
    const [client, prospect, owner, referrer] = await Promise.all([
        db.client.findFirst({ where: { email: { equals: addr } }, select: { id: true } }),
        db.prospect.findFirst({ where: { email: { equals: addr } }, select: { id: true } }),
        db.owner.findFirst({ where: { email: { equals: addr } }, select: { id: true } }),
        db.businessReferrer.findFirst({ where: { email: { equals: addr } }, select: { id: true } }),
    ]);
    if (client)
        return { ...empty, clientId: client.id };
    if (prospect)
        return { ...empty, prospectId: prospect.id };
    if (owner)
        return { ...empty, ownerId: owner.id };
    if (referrer)
        return { ...empty, referrerId: referrer.id };
    return empty;
}
/** Interroge une boîte IMAP et journalise les nouveaux messages comme `Communication` entrantes. */
async function pollMailAccount(account) {
    const db = (0, db_service_1.getDb)();
    const result = { fetched: 0, matched: 0, errors: 0 };
    const password = (0, secretCrypto_1.decryptSecret)(account.imapPasswordEnc);
    if (!password) {
        await db.mailAccount.update({ where: { id: account.id }, data: { lastError: 'Mot de passe IMAP introuvable ou indéchiffrable', lastPolledAt: new Date() } });
        result.errors += 1;
        return result;
    }
    const client = new imapflow_1.ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        auth: { user: account.imapUser, pass: password },
        logger: false,
    });
    try {
        await client.connect();
        const lock = await client.getMailboxLock(account.folder);
        try {
            const mailbox = client.mailbox;
            const uidNext = mailbox && typeof mailbox !== 'boolean' ? mailbox.uidNext : undefined;
            // Première synchronisation : ne pas importer l'historique de la boîte,
            // seulement fixer le curseur à l'état courant — seuls les messages
            // arrivés APRÈS la connexion de la boîte sont récupérés.
            if (account.lastUid == null) {
                const baseline = Math.max(0, (uidNext ?? 1) - 1);
                await db.mailAccount.update({
                    where: { id: account.id },
                    data: { lastUid: baseline, lastPolledAt: new Date(), lastError: null },
                });
                return result;
            }
            let maxUid = account.lastUid;
            const range = `${account.lastUid + 1}:*`;
            for await (const msg of client.fetch(range, { uid: true, source: true }, { uid: true })) {
                if (msg.uid <= account.lastUid)
                    continue; // borne basse parfois renvoyée par le serveur
                maxUid = Math.max(maxUid, msg.uid);
                if (!msg.source)
                    continue;
                result.fetched += 1;
                try {
                    const parsed = await (0, mailparser_1.simpleParser)(msg.source);
                    const fromAddress = parsed.from?.value?.[0]?.address ?? null;
                    const references = Array.isArray(parsed.references)
                        ? parsed.references
                        : (parsed.references ? [parsed.references] : []);
                    const inReplyTo = parsed.inReplyTo ?? null;
                    // Un message dont le Message-ID correspond à l'un de NOS PROPRES
                    // envois (SORTANT) n'est pas une réponse — c'est notre propre email
                    // qui apparaît dans la boîte surveillée parce que son titulaire en
                    // est aussi le destinataire (ex. client de test utilisant sa propre
                    // adresse). Le journaliser comme ENTRANT créerait une entrée
                    // fantôme (« serviceclient@afrikimmo.ci a répondu » alors que c'est
                    // simplement l'email qu'on a nous-mêmes envoyé).
                    if (parsed.messageId) {
                        const ownOutbound = await db.communication.findFirst({
                            where: { messageId: parsed.messageId, direction: 'SORTANT' },
                            select: { id: true },
                        });
                        if (ownOutbound)
                            continue;
                    }
                    // Restreint aux réponses (ou suites de réponses) à un message
                    // envoyé depuis l'app : sans correspondance de fil, ce n'est ni une
                    // réponse ni la suite d'une conversation initiée depuis l'app — on
                    // l'ignore, quelle que soit l'adresse de l'expéditeur. Exception :
                    // boîte en mode « Recevoir tous les messages » (account.receiveAllMessages)
                    // — le message est journalisé quand même, avec un repli sur
                    // l'adresse expéditrice pour tenter un rattachement à un contact connu.
                    const threadMatch = await resolveAttachment(db, inReplyTo, references);
                    let attachment;
                    if (threadMatch) {
                        attachment = threadMatch;
                        result.matched += 1;
                    }
                    else if (account.receiveAllMessages) {
                        attachment = { parentCommunicationId: null, conventionId: null, ...(await resolveAttachmentByEmail(db, fromAddress)) };
                    }
                    else {
                        continue;
                    }
                    await db.communication.create({
                        data: {
                            channel: 'EMAIL',
                            direction: 'ENTRANT',
                            status: 'RECU',
                            // `to` porte l'adresse de l'AUTRE partie de l'échange, comme pour
                            // les lignes SORTANT (destinataire) — ici l'expéditeur de la
                            // réponse, pour l'affichage dans l'historique (CommunicationPage.tsx
                            // adapte le libellé de colonne « À »/« De » selon `direction`).
                            to: fromAddress ?? account.imapUser,
                            subject: parsed.subject ?? null,
                            body: (typeof parsed.html === 'string' ? parsed.html : null) ?? parsed.text ?? '',
                            deliveredAt: parsed.date ?? new Date(),
                            messageId: parsed.messageId ?? null,
                            inReplyToMessageId: inReplyTo,
                            mailAccountId: account.id,
                            ccAddresses: extractCcAddresses(parsed.cc, parsed.bcc),
                            ...attachment,
                        },
                    });
                }
                catch (msgErr) {
                    // Un message illisible/mal formé ne doit pas interrompre la passe —
                    // même philosophie que reminders.service.ts (essai/erreur par candidat).
                    result.errors += 1;
                    logger_1.default.error(`mailbox-poller: message UID=${msg.uid} (compte ${account.id}) : ${msgErr.message}`);
                }
            }
            await db.mailAccount.update({
                where: { id: account.id },
                data: { lastUid: maxUid, lastPolledAt: new Date(), lastError: null },
            });
        }
        finally {
            lock.release();
        }
        await client.logout();
    }
    catch (err) {
        result.errors += 1;
        logger_1.default.error(`mailbox-poller: échec de connexion (compte ${account.id}, ${account.imapHost}) : ${err.message}`);
        try {
            await db.mailAccount.update({ where: { id: account.id }, data: { lastError: err.message, lastPolledAt: new Date() } });
        }
        catch { /* ignore */ }
        try {
            client.close();
        }
        catch { /* déjà fermé */ }
    }
    return result;
}
/** Interroge toutes les boîtes actives, séquentiellement (jamais en parallèle
 *  — éviter de solliciter plusieurs serveurs IMAP externes en même temps
 *  depuis un poste desktop). */
async function pollAllMailAccounts() {
    const db = (0, db_service_1.getDb)();
    const accounts = await db.mailAccount.findMany({ where: { isActive: true } });
    const total = { accounts: accounts.length, fetched: 0, matched: 0, errors: 0 };
    for (const account of accounts) {
        const r = await pollMailAccount(account);
        total.fetched += r.fetched;
        total.matched += r.matched;
        total.errors += r.errors;
    }
    logger_1.default.info(`Mailbox poll — accounts=${total.accounts} fetched=${total.fetched} matched=${total.matched} errors=${total.errors}`);
    return total;
}
// ── Scheduler ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 min — une réponse est plus sensible au délai qu'une relance.
let scheduledHandle = null;
function scheduleMailboxPolling() {
    pollAllMailAccounts().catch((e) => logger_1.default.error(`Initial mailbox poll failed: ${e.message}`));
    if (scheduledHandle)
        return;
    scheduledHandle = setInterval(() => {
        pollAllMailAccounts().catch((e) => logger_1.default.error(`Scheduled mailbox poll failed: ${e.message}`));
    }, POLL_INTERVAL_MS);
}
