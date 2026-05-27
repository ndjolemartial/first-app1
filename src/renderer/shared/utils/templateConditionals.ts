/**
 * Moteur de conditions pour les modèles de conventions et d'attestations.
 *
 * Syntaxe supportée (proche de Mustache, en français) :
 *
 *   {{#si variable == "valeur"}}texte affiché si la condition est vraie{{/si}}
 *
 *   {{#si variable != "valeur"}}…{{sinon}}…{{/si}}
 *
 *   {{#si variable}}…{{/si}}                 (vrai si la variable est non vide)
 *   {{#si !variable}}…{{/si}}                (vrai si la variable est vide)
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

/** Évalue une comparaison entre la valeur résolue et la valeur attendue. */
function compare(
  actual: string,
  operator: '==' | '!=',
  expected: string,
): boolean {
  const a = actual.trim();
  const e = expected.trim();
  if (operator === '==') return a === e;
  return a !== e;
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
  const compareRegex = /\{\{#si\s+([\w.]+)\s*(==|!=)\s*"([^"]*)"\s*\}\}([\s\S]*?)\{\{\/si\}\}/g;
  let result = html.replace(compareRegex, (_m, variable, operator, expected, content) => {
    const { trueText, falseText } = splitOnSinon(content);
    const actual = Object.prototype.hasOwnProperty.call(vars, variable) ? vars[variable] : '';
    return compare(actual, operator as '==' | '!=', expected) ? trueText : falseText;
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
  operator: '==' | '!=';
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
