/**
 * ImapFlow enveloppe toute réponse serveur non-OK dans un message générique
 * « Command failed », qui masque la raison réellement utile renvoyée par le
 * serveur (ex. « Authentication failed. »), disponible sur `responseText`.
 */
export function describeImapError(err: any): string {
  return err?.responseText || err?.response || err?.message || String(err);
}
