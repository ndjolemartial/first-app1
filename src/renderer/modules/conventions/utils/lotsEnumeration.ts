import { numberToFrenchWords } from '../../../shared/utils/numberToWords';

/** Élément minimal nécessaire pour énumérer un lot souscrit. */
export interface LotEnumItem {
  numeroIlot?: string | null;
  numeroParcelle?: string | null;
  surface?: number | string | null;
}

function isNonEmpty(v: unknown): boolean {
  return v != null && String(v).trim() !== '';
}

function hasKnownRef(t: LotEnumItem): boolean {
  return isNonEmpty(t.numeroIlot) && isNonEmpty(t.numeroParcelle);
}

function toNumber(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

/**
 * Libellé d'une superficie : "1 923 m²" ou "1 923,5 m²".
 * Lorsque la superficie est nulle ou non finie, on rend « non défini » plutôt
 * qu'un trompeur « 0 m² ».
 */
function surfaceLabel(n: number): string {
  if (!isFinite(n) || n === 0) return 'non défini';
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m²`;
}

/** "X (N) lot/lots" — nombre en lettres puis en chiffres, accord pluriel. */
function lotsHeader(count: number): string {
  const words = numberToFrenchWords(count);
  return `${words} (${count}) lot${count > 1 ? 's' : ''}`;
}

/**
 * "de superficie" pour un seul lot (un total n'a pas de sens à 1 élément) ;
 * "de superficie totale" dès qu'il y a au moins deux lots groupés.
 */
function surfacePhrase(count: number, surface: string): string {
  return count > 1 ? `de superficie totale ${surface}` : `de superficie ${surface}`;
}

/** Jointure type "a, b, c et d" (virgules + « et » devant le dernier). */
function joinFrench(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/**
 * Génère la phrase d'énumération des lots souscrits selon trois cas :
 *  1. Tous les lots ont leurs références (ilot + parcelle) renseignées :
 *     « quatre (4) lots à savoir le lot 1 ilot 2 de superficie 500 m², … »
 *  2. Aucune référence n'est connue :
 *     « quatre (4) lots de superficie totale 1 923 m² dont les références
 *     seront précisées plus tard. »
 *     Cas particulier à 1 lot : « un (1) lot de superficie 523 m² … »
 *     (pas de « totale » quand il n'y a qu'un seul élément).
 *  3. Mixte : on liste les lots connus puis on regroupe les autres :
 *     « quatre (4) lots à savoir le lot 1 ilot 2 …, le lot 4 ilot 37 … et
 *     deux (2) lots de superficie totale 1 023 m² (les références manquantes
 *     seront précisées plus tard). »
 */
export function lotsEnumeration(terrains: LotEnumItem[] | null | undefined): string {
  if (!terrains || terrains.length === 0) return '';
  const total = terrains.length;
  const known = terrains.filter(hasKnownRef);
  const unknown = terrains.filter((t) => !hasKnownRef(t));

  const knownParts = known.map(
    (t) => `le lot ${t.numeroParcelle} ilot ${t.numeroIlot} de superficie ${surfaceLabel(toNumber(t.surface))}`,
  );
  const unknownTotalSurface = unknown.reduce((sum, t) => sum + toNumber(t.surface), 0);

  // Cas 1 : toutes les références sont connues.
  if (unknown.length === 0) {
    return `${lotsHeader(total)} à savoir ${joinFrench(knownParts)}`;
  }

  // Cas 2 : aucune référence n'est connue.
  if (known.length === 0) {
    return `${lotsHeader(total)} ${surfacePhrase(total, surfaceLabel(unknownTotalSurface))} dont les références seront précisées plus tard`;
  }

  // Cas 3 : mixte — on liste les connus puis on regroupe le reste.
  const unknownGroup =
    `${lotsHeader(unknown.length)} ${surfacePhrase(unknown.length, surfaceLabel(unknownTotalSurface))}`
    + ` (les références manquantes seront précisées plus tard)`;
  return `${lotsHeader(total)} à savoir ${joinFrench([...knownParts, unknownGroup])}`;
}
