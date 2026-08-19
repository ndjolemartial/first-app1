"use strict";
/**
 * Évaluateur de règle d'applicabilité déclarative — générique, sans
 * dépendance à un domaine métier particulier. Utilisé par le moteur de
 * devis de construction (`construction-formulas.ts`, qui ré-exporte ce
 * module pour compatibilité) et par le moteur de devis de permis de
 * construire (`permit-engine.service.ts`), chacun avec son propre shape
 * de « caractéristiques du projet ».
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApplicable = isApplicable;
function evalCondition(cond, p) {
    const value = p[cond.field];
    const ops = [
        ['eq', cond.eq], ['ne', cond.ne], ['in', cond.in], ['notIn', cond.notIn],
        ['gt', cond.gt], ['gte', cond.gte], ['lt', cond.lt], ['lte', cond.lte],
    ];
    for (const [op, target] of ops) {
        if (target === undefined)
            continue;
        switch (op) {
            case 'eq':
                if (value !== target)
                    return false;
                break;
            case 'ne':
                if (value === target)
                    return false;
                break;
            case 'in':
                if (!Array.isArray(target) || !target.includes(value))
                    return false;
                break;
            case 'notIn':
                if (Array.isArray(target) && target.includes(value))
                    return false;
                break;
            case 'gt':
                if (!(Number(value) > target))
                    return false;
                break;
            case 'gte':
                if (!(Number(value) >= target))
                    return false;
                break;
            case 'lt':
                if (!(Number(value) < target))
                    return false;
                break;
            case 'lte':
                if (!(Number(value) <= target))
                    return false;
                break;
        }
    }
    return true;
}
/** Évalue une règle d'applicabilité déclarative contre un objet de caractéristiques. `null`/`undefined` = toujours applicable. */
function isApplicable(rule, p) {
    if (!rule)
        return true;
    if (rule.all)
        return rule.all.every((r) => ('field' in r ? evalCondition(r, p) : isApplicable(r, p)));
    if (rule.any)
        return rule.any.some((r) => ('field' in r ? evalCondition(r, p) : isApplicable(r, p)));
    if (rule.not)
        return !isApplicable('field' in rule.not ? { all: [rule.not] } : rule.not, p);
    return true;
}
