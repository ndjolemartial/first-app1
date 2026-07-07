/**
 * Rôles autorisés à EXPORTER (PDF/Excel) et IMPRIMER les listes et documents
 * des modules Clients, Prospects, Biens, Terrains, Conventions et Attestations.
 *
 * Tous les autres rôles (AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, RH,
 * READONLY…) n'ont plus la possibilité d'exporter ni d'imprimer ces éléments —
 * les boutons correspondants leur sont masqués côté UI.
 */
export const EXPORT_PRINT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/** Indique si le rôle donné peut exporter/imprimer ces listes et documents. */
export function canExportPrint(role?: string | null): boolean {
  return !!role && EXPORT_PRINT_ROLES.includes(role);
}
