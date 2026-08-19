"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeImapError = describeImapError;
/**
 * ImapFlow enveloppe toute réponse serveur non-OK dans un message générique
 * « Command failed », qui masque la raison réellement utile renvoyée par le
 * serveur (ex. « Authentication failed. »), disponible sur `responseText`.
 */
function describeImapError(err) {
    return err?.responseText || err?.response || err?.message || String(err);
}
