/**
 * Évaluateur de règle d'applicabilité déclarative — générique, sans
 * dépendance à un domaine métier particulier. Utilisé par le moteur de
 * devis de construction (`construction-formulas.ts`, qui ré-exporte ce
 * module pour compatibilité) et par le moteur de devis de permis de
 * construire (`permit-engine.service.ts`), chacun avec son propre shape
 * de « caractéristiques du projet ».
 */

type RuleOperator = 'eq' | 'ne' | 'in' | 'notIn' | 'gt' | 'gte' | 'lt' | 'lte';
interface RuleCondition { field: string; eq?: unknown; ne?: unknown; in?: unknown[]; notIn?: unknown[]; gt?: number; gte?: number; lt?: number; lte?: number; }
export interface ApplicabilityRule { all?: (RuleCondition | ApplicabilityRule)[]; any?: (RuleCondition | ApplicabilityRule)[]; not?: RuleCondition | ApplicabilityRule; }

function evalCondition(cond: RuleCondition, p: Record<string, unknown>): boolean {
  const value = p[cond.field];
  const ops: Array<[RuleOperator, unknown]> = [
    ['eq', cond.eq], ['ne', cond.ne], ['in', cond.in], ['notIn', cond.notIn],
    ['gt', cond.gt], ['gte', cond.gte], ['lt', cond.lt], ['lte', cond.lte],
  ];
  for (const [op, target] of ops) {
    if (target === undefined) continue;
    switch (op) {
      case 'eq': if (value !== target) return false; break;
      case 'ne': if (value === target) return false; break;
      case 'in': if (!Array.isArray(target) || !target.includes(value)) return false; break;
      case 'notIn': if (Array.isArray(target) && target.includes(value)) return false; break;
      case 'gt': if (!(Number(value) > (target as number))) return false; break;
      case 'gte': if (!(Number(value) >= (target as number))) return false; break;
      case 'lt': if (!(Number(value) < (target as number))) return false; break;
      case 'lte': if (!(Number(value) <= (target as number))) return false; break;
    }
  }
  return true;
}

/** Évalue une règle d'applicabilité déclarative contre un objet de caractéristiques. `null`/`undefined` = toujours applicable. */
export function isApplicable(rule: ApplicabilityRule | null | undefined, p: Record<string, unknown>): boolean {
  if (!rule) return true;
  if (rule.all) return rule.all.every((r) => ('field' in r ? evalCondition(r as RuleCondition, p) : isApplicable(r as ApplicabilityRule, p)));
  if (rule.any) return rule.any.some((r) => ('field' in r ? evalCondition(r as RuleCondition, p) : isApplicable(r as ApplicabilityRule, p)));
  if (rule.not) return !isApplicable('field' in rule.not ? { all: [rule.not] } : (rule.not as ApplicabilityRule), p);
  return true;
}
