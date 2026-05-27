/**
 * Conversion de nombres entiers en lettres françaises (orthographe traditionnelle).
 *
 * Règles appliquées :
 *   - « cent » et « vingt » prennent un « s » quand ils terminent l'adjectif numéral
 *     (ex. « deux cents », « quatre-vingts »), mais sont invariables s'ils sont
 *     suivis d'un autre adjectif numéral (« deux cent un », « quatre-vingt mille »).
 *   - « mille » est invariable ; « million » / « milliard » sont des noms et
 *     prennent un « s » au pluriel — auquel cas le « s » de cent/vingt est conservé.
 *   - L'arrondi se fait à l'entier le plus proche (les centimes sont ignorés).
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
    // 70-79 / 90-99 : la dizaine se combine avec l'unité 10-19.
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
  // 100-999
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

  // Milliards (nom : cents/vingts conservent leur « s »)
  const billion = Math.floor(v / 1_000_000_000);
  if (billion > 0) {
    parts.push(billion === 1 ? 'un milliard' : `${threeDigit(billion, true)} milliards`);
    v %= 1_000_000_000;
  }

  // Millions (nom : cents/vingts conservent leur « s »)
  const million = Math.floor(v / 1_000_000);
  if (million > 0) {
    parts.push(million === 1 ? 'un million' : `${threeDigit(million, true)} millions`);
    v %= 1_000_000;
  }

  // Milliers (adjectif numéral : cents/vingts perdent leur « s »)
  const thousand = Math.floor(v / 1000);
  if (thousand > 0) {
    parts.push(thousand === 1 ? 'mille' : `${threeDigit(thousand, false)} mille`);
    v %= 1000;
  }

  // Centaines, dizaines, unités (terminal)
  if (v > 0) parts.push(threeDigit(v, true));

  return parts.join(' ');
}

/**
 * Convertit un montant en lettres avec libellé de devise. Par défaut « francs CFA »
 * (devise XOF utilisée dans l'application). Le libellé est accordé en nombre
 * (singulier pour 0 et 1, pluriel sinon).
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

/**
 * Convertit un nombre quelconque (potentiellement décimal) en lettres, sans devise.
 * Utilisé pour les superficies, comptages, etc. Les décimales non nulles sont
 * exprimées sous la forme « N virgule M ».
 */
export function decimalToFrenchWords(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!isFinite(n)) return '';
  const sign = n < 0 ? 'moins ' : '';
  const abs = Math.abs(n);
  const intPart = Math.trunc(abs);
  const intWords = numberToFrenchWords(intPart);
  // Décimales : on prend la chaîne après le séparateur (sans zéros traînants).
  const frac = String(abs).split('.')[1]?.replace(/0+$/, '') ?? '';
  if (frac === '') return `${sign}${intWords}`;
  // Chaque chiffre des décimales est lu indépendamment (ex : 12,53 → « douze virgule cinquante-trois »)
  const fracNum = parseInt(frac, 10);
  return `${sign}${intWords} virgule ${numberToFrenchWords(fracNum)}`;
}
