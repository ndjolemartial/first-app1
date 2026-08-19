"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePermitEstimate = computePermitEstimate;
exports.toPermitProjectInputs = toPermitProjectInputs;
const applicability_rule_1 = require("./applicability-rule");
const round = (v, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;
// Catégories dont les honoraires sont assujettis à la TVA (prestations
// intellectuelles) — le reste (FRAIS_ADMINISTRATIF, TAXE) en est exclu.
const VAT_LIABLE_CATEGORIES = new Set([
    'ARCHITECTE', 'BET_STRUCTURE', 'BET_FLUIDES', 'BET_ELECTRICITE', 'BET_VRD', 'BET_GEOTECHNIQUE',
    'GEOMETRE', 'ETUDE_SOL', 'ETUDE_HYDROLOGIE', 'ETUDE_ENVIRONNEMENT', 'ETUDE_INCENDIE',
]);
function categoryBucket(category) {
    if (category === 'ARCHITECTE')
        return 'totalArchitecte';
    if (category.startsWith('BET_'))
        return 'totalBET';
    if (category === 'GEOMETRE')
        return 'totalGeometre';
    if (category.startsWith('ETUDE_'))
        return 'totalEtudes';
    if (category === 'FRAIS_ADMINISTRATIF')
        return 'totalFraisAdministratifs';
    return 'totalTaxes';
}
/** Sélectionne la surcharge de taux la plus spécifique (le plus de dimensions renseignées qui matchent). */
function resolveRate(item, inputs) {
    let best = null;
    for (const o of item.rateOverrides) {
        if (o.nature != null && o.nature !== inputs.nature)
            continue;
        if (o.standing != null && o.standing !== inputs.standing)
            continue;
        if (o.communeId != null && o.communeId !== inputs.communeId)
            continue;
        const score = (o.nature != null ? 1 : 0) + (o.standing != null ? 1 : 0) + (o.communeId != null ? 1 : 0);
        if (!best || score > best.score)
            best = { value: Number(o.value), score };
    }
    if (best)
        return { value: best.value, isOverride: true };
    return { value: Number(item.defaultValue), isOverride: false };
}
/** Résout le forfait par tranche de surface (calcMode = BAREME_SURFACE). */
function resolveBracket(item, surface) {
    const sorted = [...item.surfaceBrackets].sort((a, b) => Number(a.minSurface) - Number(b.minSurface));
    for (const b of sorted) {
        const min = Number(b.minSurface);
        const max = b.maxSurface != null ? Number(b.maxSurface) : null;
        if (surface >= min && (max == null || surface <= max))
            return { value: Number(b.value), label: b.label };
    }
    return null;
}
/**
 * Calcule le devis de permis de construire à partir des caractéristiques du
 * projet — charge le catalogue actif, filtre par applicabilité (phase de
 * mission pour les items ARCHITECTE, règle déclarative pour tous), résout
 * taux/tranche, agrège par catégorie.
 */
async function computePermitEstimate(db, inputs) {
    const warnings = [];
    const warn = (m) => warnings.push(m);
    const items = await db.permitFeeItem.findMany({
        where: { isActive: true },
        include: { rateOverrides: true, surfaceBrackets: true },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    const missionPhaseSet = new Set(inputs.missionPhases);
    const ruleInputs = inputs;
    const lines = [];
    let order = 0;
    for (const item of items) {
        // Un item ARCHITECTE lié à une phase de mission n'apparaît que si cette
        // phase est sélectionnée sur le projet (mission Esquisse/APS/APD/…).
        if (item.missionPhase && !missionPhaseSet.has(item.missionPhase))
            continue;
        if (!(0, applicability_rule_1.isApplicable)(item.applicabilityRule, ruleInputs))
            continue;
        const { value: rateValue } = resolveRate(item, inputs);
        let baseAmount = null;
        let montantHT = 0;
        let trace = '';
        switch (item.calcMode) {
            case 'POURCENTAGE_COUT_TRAVAUX': {
                baseAmount = inputs.coutPrevisionnelTravaux;
                if (baseAmount == null || baseAmount <= 0) {
                    warn(`« ${item.label} » : coût prévisionnel des travaux non renseigné — ligne ignorée.`);
                    continue;
                }
                montantHT = round(baseAmount * (rateValue / 100));
                trace = `${round(baseAmount)} FCFA × ${rateValue}% = ${montantHT} FCFA`;
                break;
            }
            case 'FORFAIT': {
                montantHT = round(rateValue);
                trace = `Forfait = ${montantHT} FCFA`;
                break;
            }
            case 'PAR_M2_TERRAIN': {
                baseAmount = inputs.terrainSurface;
                if (baseAmount == null || baseAmount <= 0) {
                    warn(`« ${item.label} » : superficie du terrain non renseignée — ligne ignorée.`);
                    continue;
                }
                montantHT = round(baseAmount * rateValue);
                trace = `${baseAmount} m² × ${rateValue} FCFA/m² = ${montantHT} FCFA`;
                break;
            }
            case 'PAR_M2_BATI': {
                baseAmount = inputs.surfaceBatie;
                if (baseAmount == null || baseAmount <= 0) {
                    warn(`« ${item.label} » : surface bâtie non renseignée — ligne ignorée.`);
                    continue;
                }
                montantHT = round(baseAmount * rateValue);
                trace = `${baseAmount} m² × ${rateValue} FCFA/m² = ${montantHT} FCFA`;
                break;
            }
            case 'BAREME_SURFACE': {
                // Le géomètre travaille sur la superficie du terrain (levé, bornage,
                // implantation) ; les autres catégories en barème de surface (frais
                // administratifs par tranche) portent sur la surface bâtie.
                const surface = item.category === 'GEOMETRE'
                    ? (inputs.terrainSurface ?? inputs.surfaceBatie)
                    : inputs.surfaceBatie;
                baseAmount = surface;
                const bracket = resolveBracket(item, surface);
                if (!bracket) {
                    warn(`« ${item.label} » : aucune tranche de surface définie pour ${surface} m² — ligne ignorée.`);
                    continue;
                }
                montantHT = round(bracket.value);
                trace = `Tranche ${bracket.label ?? `${surface} m²`} = ${montantHT} FCFA`;
                break;
            }
            default:
                continue;
        }
        if (montantHT <= 0)
            continue;
        lines.push({
            feeItemId: item.id, feeItemCode: item.code, category: item.category, label: item.label,
            calcMode: item.calcMode, baseAmount, rateValue, montantHT, trace, order: order++,
        });
    }
    const totals = {
        totalArchitecte: 0, totalBET: 0, totalGeometre: 0, totalEtudes: 0,
        totalFraisAdministratifs: 0, totalTaxes: 0,
    };
    let totalAssujetti = 0;
    for (const l of lines) {
        const bucket = categoryBucket(l.category);
        totals[bucket] += l.montantHT;
        if (VAT_LIABLE_CATEGORIES.has(l.category))
            totalAssujetti += l.montantHT;
    }
    for (const k of Object.keys(totals))
        totals[k] = round(totals[k]);
    const totalHT = round(lines.reduce((s, l) => s + l.montantHT, 0));
    const tvaPct = 18;
    const totalTVA = round(totalAssujetti * (tvaPct / 100));
    const totalTTC = round(totalHT + totalTVA);
    if (lines.length === 0) {
        warn('Aucune prestation applicable — vérifier le catalogue et les caractéristiques du projet (phases de mission notamment).');
    }
    return {
        lines,
        totalArchitecte: totals.totalArchitecte,
        totalBET: totals.totalBET,
        totalGeometre: totals.totalGeometre,
        totalEtudes: totals.totalEtudes,
        totalFraisAdministratifs: totals.totalFraisAdministratifs,
        totalTaxes: totals.totalTaxes,
        totalHT,
        totalTVA,
        totalTTC,
        tvaPct,
        coutPrevisionnelTravauxSnapshot: inputs.coutPrevisionnelTravaux,
        warnings: [...new Set(warnings)],
    };
}
/** Construit un `PermitProjectInputs` normalisé à partir d'un enregistrement PermitProject (Decimal Prisma → number). */
function toPermitProjectInputs(project) {
    const num = (v, fallback = 0) => (v == null ? fallback : Number(v));
    return {
        nature: String(project.nature),
        standing: String(project.standing),
        communeId: project.communeId != null ? Number(project.communeId) : null,
        zoneType: project.zoneType != null ? String(project.zoneType) : null,
        terrainSurface: project.terrainSurface != null ? num(project.terrainSurface) : null,
        surfaceBatie: num(project.surfaceBatie, 0),
        levels: num(project.levels, 1),
        hasSousSol: Boolean(project.hasSousSol),
        nombreBatiments: num(project.nombreBatiments, 1),
        coutPrevisionnelTravaux: project.coutPrevisionnelTravaux != null ? num(project.coutPrevisionnelTravaux) : null,
        hasPiscine: Boolean(project.hasPiscine),
        hasAscenseur: Boolean(project.hasAscenseur),
        hasGroupeElectrogene: Boolean(project.hasGroupeElectrogene),
        hasForage: Boolean(project.hasForage),
        hasCloture: Boolean(project.hasCloture),
        hasVoirieInterieure: Boolean(project.hasVoirieInterieure),
        missionPhases: Array.isArray(project.missionPhases) ? project.missionPhases : [],
    };
}
