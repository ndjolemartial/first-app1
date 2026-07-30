/**
 * Conversion de nombres entiers en lettres françaises (orthographe traditionnelle).
 * Copie main-process de `src/renderer/shared/utils/numberToWords.ts` (le
 * process main ne peut pas importer de code sous `src/renderer`, cf.
 * `tsconfig.main.json` : `rootDir: "src/main"`).
 */

const UNITS = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'soixante', 'quatre-vingt', 'quatre-vingt'];

/** Convertit un nombre 0-999 en lettres. `final` = true si rien ne suit (cent → cents). */
function threeDigit(n: number, final: boolean): string {
  if (n < 20) return UNITS[n] ?? '';
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (t === 7 || t === 9) {
      const second = UNITS[10 + u];
      if (t === 7 && u === 1) return 'soixante-et-onze';
      return `${TENS[t]}-${second}`;
    }
    if (u === 0) {
      if (t === 8) return final ? 'quatre-vingts' : 'quatre-vingt';
      return TENS[t];
    }
    if (u === 1 && t !== 8) return `${TENS[t]}-et-un`;
    return `${TENS[t]}-${UNITS[u]}`;
  }
  const c = Math.floor(n / 100);
  const rest = n % 100;
  if (c === 1) {
    return rest === 0 ? 'cent' : `cent ${threeDigit(rest, final)}`;
  }
  if (rest === 0) return final ? `${UNITS[c]} cents` : `${UNITS[c]} cent`;
  return `${UNITS[c]} cent ${threeDigit(rest, final)}`;
}

/** Convertit un entier en lettres françaises. */
export function numberToFrenchWords(n: number): string {
  if (!isFinite(n)) return '';
  if (n === 0) return 'zéro';
  if (n < 0) return `moins ${numberToFrenchWords(-n)}`;
  let v = Math.round(n);
  const parts: string[] = [];

  const billion = Math.floor(v / 1_000_000_000);
  if (billion > 0) {
    parts.push(billion === 1 ? 'un milliard' : `${threeDigit(billion, true)} milliards`);
    v %= 1_000_000_000;
  }

  const million = Math.floor(v / 1_000_000);
  if (million > 0) {
    parts.push(million === 1 ? 'un million' : `${threeDigit(million, true)} millions`);
    v %= 1_000_000;
  }

  const thousand = Math.floor(v / 1000);
  if (thousand > 0) {
    parts.push(thousand === 1 ? 'mille' : `${threeDigit(thousand, false)} mille`);
    v %= 1000;
  }

  if (v > 0) parts.push(threeDigit(v, true));

  return parts.join(' ');
}

/**
 * Convertit un montant en lettres avec libellé de devise. Par défaut « francs CFA »
 * (devise XOF utilisée dans l'application).
 */
export function moneyToFrenchWords(
  amount: number | string | null | undefined,
  options: { singular?: string; plural?: string } = {},
): string {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (!isFinite(n)) return '';
  const singular = options.singular ?? 'franc CFA';
  const plural = options.plural ?? 'francs CFA';
  const abs = Math.round(Math.abs(n));
  const words = numberToFrenchWords(abs);
  const label = abs <= 1 ? singular : plural;
  return n < 0 ? `moins ${words} ${label}` : `${words} ${label}`;
}
