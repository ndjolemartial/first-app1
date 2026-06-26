/**
 * Moteur de conditions pour les modèles de conventions et d'attestations.
 *
 * Syntaxe supportée (proche de Mustache, en français) :
 *
 *   {{#si variable == "valeur"}}texte affiché si la condition est vraie{{/si}}
 *
 *   {{#si variable != "valeur"}}…{{sinon}}…{{/si}}
 *
 *   {{#si variable > "0"}}…{{/si}}           (comparaison numérique : > < >= <=)
 *
 *   {{#si variable}}…{{/si}}                 (vrai si la variable est non vide)
 *   {{#si !variable}}…{{/si}}                (vrai si la variable est vide)
 *
 * Les comparaisons sont **numériques** dès que la valeur attendue et la valeur
 * résolue se réduisent toutes deux à un nombre (le formatage monétaire — espaces,
 * « F CFA », séparateurs — est ignoré). Ainsi `convention.soldeAnterieur == "0"`
 * est vrai lorsque le solde vaut 0, même affiché « 0 F CFA ». À défaut (civilité,
 * type d'attestation…), on retombe sur une comparaison de texte stricte.
 *
 * Les blocs conditionnels sont résolus AVANT la substitution des variables
 * (`{{token}}`), pour que le contenu non retenu ne soit pas inutilement
 * substitué et pour permettre de placer des `{{tokens}}` à l'intérieur des
 * branches conditionnelles.
 */

/** Sépare le contenu d'une branche conditionnelle en parties « vrai » / « faux ». */
function splitOnSinon(content: string): { trueText: string; falseText: string } {
  const sinonRegex = /\{\{\s*sinon\s*\}\}/i;
  const match = content.match(sinonRegex);
  if (!match) return { trueText: content, falseText: '' };
  const idx = match.index!;
  return {
    trueText:  content.substring(0, idx),
    falseText: content.substring(idx + match[0].length),
  };
}

/** Opérateurs de comparaison reconnus par le moteur de conditions. */
export type ConditionOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

/**
 * Tente d'interpréter une chaîne comme un nombre, en ignorant le formatage
 * monétaire/français (espaces, symbole devise « F CFA », séparateurs de
 * milliers, virgule décimale). Retourne `null` si la chaîne ne représente pas
 * un nombre — auquel cas la comparaison retombe sur du texte.
 */
function toNumber(raw: string): number | null {
  if (raw == null) return null;
  // Ne conserver que chiffres, séparateurs et signe.
  let s = String(raw).replace(/[^\d.,-]/g, '');
  if (s === '' || s === '-') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Le dernier séparateur rencontré est le séparateur décimal.
    s = lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const parts = s.split(',');
    // « 1234,56 » → décimal ; « 1,500,000 » → séparateurs de milliers.
    s = (parts.length === 2 && parts[1].length <= 2)
      ? `${parts[0]}.${parts[1]}`
      : s.replace(/,/g, '');
  } else if (lastDot > -1) {
    const parts = s.split('.');
    if (!(parts.length === 2 && parts[1].length <= 2)) {
      s = s.replace(/\./g, ''); // points = séparateurs de milliers
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Évalue une comparaison entre la valeur résolue et la valeur attendue.
 * Numérique si les deux côtés sont des nombres (formatage devise ignoré),
 * sinon comparaison de texte stricte.
 */
function compare(
  actual: string,
  operator: ConditionOperator,
  expected: string,
): boolean {
  const a = actual.trim();
  const e = expected.trim();
  const na = toNumber(a);
  const ne = toNumber(e);
  const numeric = na !== null && ne !== null;
  switch (operator) {
    case '==': return numeric ? na === ne : a === e;
    case '!=': return numeric ? na !== ne : a !== e;
    case '>':  return numeric ? na! > ne! : a > e;
    case '<':  return numeric ? na! < ne! : a < e;
    case '>=': return numeric ? na! >= ne! : a >= e;
    case '<=': return numeric ? na! <= ne! : a <= e;
    default:   return false;
  }
}

/**
 * Évalue les blocs conditionnels d'un HTML de modèle et conserve uniquement
 * la branche correspondante. Les conditions ne s'imbriquent pas (une seule
 * profondeur supportée — suffisant pour les cas pratiques).
 */
export function evaluateConditionals(
  html: string,
  vars: Record<string, string>,
): string {
  if (!html) return html;
  // Bloc avec comparaison : {{#si <var> <op> "<value>"}}…{{/si}}
  // Les opérateurs à deux caractères (>=, <=) sont placés avant les variantes
  // à un caractère pour être reconnus en priorité par l'alternance.
  const compareRegex = /\{\{#si\s+([\w.]+)\s*(>=|<=|==|!=|>|<)\s*"([^"]*)"\s*\}\}([\s\S]*?)\{\{\/si\}\}/g;
  let result = html.replace(compareRegex, (_m, variable, operator, expected, content) => {
    const { trueText, falseText } = splitOnSinon(content);
    const actual = Object.prototype.hasOwnProperty.call(vars, variable) ? vars[variable] : '';
    return compare(actual, operator as ConditionOperator, expected) ? trueText : falseText;
  });
  // Bloc « truthy » : {{#si <var>}}…{{/si}} ou {{#si !<var>}}…{{/si}}
  const truthyRegex = /\{\{#si\s+(!)?([\w.]+)\s*\}\}([\s\S]*?)\{\{\/si\}\}/g;
  result = result.replace(truthyRegex, (_m, negate, variable, content) => {
    const { trueText, falseText } = splitOnSinon(content);
    const actual = Object.prototype.hasOwnProperty.call(vars, variable) ? vars[variable] : '';
    const isTruthy = actual != null && actual.trim() !== '';
    return (negate ? !isTruthy : isTruthy) ? trueText : falseText;
  });
  return result;
}

/**
 * Construit la chaîne de markup d'une condition à insérer dans l'éditeur.
 * Utilisé par le dialogue d'insertion.
 */
export function buildConditionalSnippet(args: {
  variable: string;
  operator: ConditionOperator;
  expected: string;
  trueText: string;
  falseText?: string;
}): string {
  const { variable, operator, expected, trueText, falseText } = args;
  const head = `{{#si ${variable} ${operator} "${expected}"}}`;
  const tail = '{{/si}}';
  if (falseText && falseText.trim() !== '') {
    return `${head}${trueText}{{sinon}}${falseText}${tail}`;
  }
  return `${head}${trueText}${tail}`;
}
