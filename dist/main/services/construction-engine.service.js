"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEstimate = computeEstimate;
exports.toProjectInputs = toProjectInputs;
const construction_formulas_1 = require("./construction-formulas");
/**
 * Moteur de calcul du devis de construction (Module 17).
 *
 * Pur vis-à-vis de la persistance : lit la bibliothèque technique (lots,
 * ressources, ouvrages, coefficients) et calcule un résultat en mémoire
 * (`GeneratedEstimate`). L'appelant (construction-projects.ipc.ts) décide de
 * la persister (Niveau 2 → ConstructionEstimate + lignes) ou non (Niveau 1 —
 * `construction:quickEstimate`, purement interactif).
 *
 * Le prix d'une ressource est TOUJOURS lu à chaud (ConstructionResource
 * .unitPrice, éventuellement une variante par ville) au moment de l'appel —
 * un changement de prix se répercute automatiquement sur tous les ouvrages
 * qui en dépendent, dès la prochaine génération.
 */
// Valeurs par défaut de la méthode de prix — pas encore paramétrables via un
// écran Paramètres dédié en Phase 1 (aucune UI « Économie » prévue) ; résolues
// dans cet ordre : options d'appel > ConstructionProject.*Pct (déjà fusionné
// dans `options` par l'appelant IPC) > ces constantes.
const DEFAULT_FRAIS_CHANTIER_PCT = 10;
const DEFAULT_FRAIS_GENERAUX_PCT = 12;
const DEFAULT_MARGE_PCT = 15;
const DEFAULT_TVA_PCT = 18;
const DEFAULT_TOLERANCE_RANGE_PCT = 12;
const DEFAULT_PU_ROUNDING_STEP = 100;
const round = (v, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;
const roundToStep = (v, step) => (step > 0 ? Math.round(v / step) * step : round(v, 2));
/** Résout le prix courant d'une ressource pour la localité choisie (variante > coefficient de ville > prix de base). */
function makePriceResolver(locality, variants) {
    const variantMap = new Map(variants.map((v) => [v.resourceId, Number(v.unitPrice)]));
    const coef = locality ? Number(locality.priceCoefficient) : 1;
    return {
        localityLabel: locality?.label ?? null,
        priceFor(resource) {
            const variant = variantMap.get(resource.id);
            if (variant != null)
                return variant;
            return Number(resource.unitPrice) * coef;
        },
    };
}
/** Charge le profil de coefficients (explicite ou résolu par buildingType×standing) et construit `r()`. */
async function loadRatioContext(db, buildingType, standing, ratioProfileId) {
    const definitions = await db.constructionRatioDefinition.findMany({ where: { isActive: true } });
    const defaultMap = new Map(definitions.map((d) => [d.code, Number(d.defaultValue)]));
    const profile = ratioProfileId
        ? await db.constructionRatioProfile.findUnique({
            where: { id: ratioProfileId },
            include: { values: { include: { ratioDefinition: true } } },
        })
        : await db.constructionRatioProfile.findUnique({
            where: { buildingType_standing: { buildingType: buildingType, standing: standing } },
            include: { values: { include: { ratioDefinition: true } } },
        });
    const valueMap = new Map();
    if (profile)
        for (const v of profile.values)
            valueMap.set(v.ratioDefinition.code, Number(v.value));
    const warnings = [];
    if (!profile) {
        warnings.push(`Aucun profil de coefficients pour « ${buildingType} × ${standing} » — valeurs par défaut du catalogue utilisées pour tous les ratios.`);
    }
    const ratioSnapshot = {};
    const warnedMissing = new Set();
    const r = (code) => {
        if (valueMap.has(code)) {
            const v = valueMap.get(code);
            ratioSnapshot[code] = v;
            return v;
        }
        if (defaultMap.has(code)) {
            const v = defaultMap.get(code);
            ratioSnapshot[code] = v;
            if (profile && !warnedMissing.has(code)) {
                warnedMissing.add(code);
                warnings.push(`Coefficient « ${code} » non défini dans le profil « ${profile.name} » — valeur par défaut du catalogue utilisée.`);
            }
            return v;
        }
        if (!warnedMissing.has(code)) {
            warnedMissing.add(code);
            warnings.push(`Coefficient « ${code} » introuvable dans le catalogue — valeur 0 utilisée (le résultat peut être sous-estimé).`);
        }
        ratioSnapshot[code] = 0;
        return 0;
    };
    return { r, warnings, ratioSnapshot, ratioProfileId: profile?.id ?? null, ratioProfileName: profile?.name ?? null };
}
/** Résolveur mémoïsé + récursif de formule (`ctx.q`), avec détection de cycle. */
function makeFormulaResolver(p, r, d, warn) {
    const cache = new Map();
    const traces = new Map();
    const stack = [];
    const q = (code) => {
        if (cache.has(code))
            return cache.get(code);
        if (stack.includes(code)) {
            warn(`Cycle de formules détecté : ${[...stack, code].join(' → ')} — quantité 0 retournée.`);
            return 0;
        }
        const fn = construction_formulas_1.FORMULAS[code];
        if (!fn) {
            warn(`Formule « ${code} » introuvable dans le registre — quantité 0.`);
            cache.set(code, 0);
            return 0;
        }
        stack.push(code);
        const ctx = { p, r, d, q, warn };
        const { qty, trace } = fn(ctx);
        stack.pop();
        cache.set(code, qty);
        traces.set(code, trace);
        return qty;
    };
    return { q, traces };
}
function computeDeboursSec(wi, priceFor, warn) {
    if (wi.deboursSecOverride != null) {
        const v = Number(wi.deboursSecOverride);
        return { mat: 0, mo: 0, tr: 0, au: v, total: v };
    }
    let mat = 0, mo = 0, tr = 0, au = 0;
    for (const c of wi.components) {
        const pu = priceFor(c.resource);
        if (pu === 0)
            warn(`Prix nul pour la ressource « ${c.resource.code} » (ouvrage ${wi.code}) — vérifier le bordereau de prix.`);
        const qte = Number(c.quantityPerUnit) * (1 + Number(c.wastageRate) / 100);
        const cost = qte * pu;
        switch (c.resource.type) {
            case 'MATERIAU':
                mat += cost;
                break;
            case 'MAIN_OEUVRE':
                mo += cost;
                break;
            case 'TRANSPORT':
                tr += cost;
                break;
            default: au += cost;
        }
    }
    return { mat, mo, tr, au, total: mat + mo + tr + au };
}
/**
 * Déboursé sec → prix de vente HT. CASCADE (défaut, usage BTP) : chaque
 * majoration s'applique au sous-total courant. ADDITIF : les 3 taux
 * s'appliquent directement au déboursé sec.
 */
function applyMarkup(ds, mode, fcPct, fgPct, mgPct, roundingStep) {
    const fc = fcPct / 100, fg = fgPct / 100, mg = mgPct / 100;
    let fraisChantierUnit, fraisGenerauxUnit, margeUnit, pv;
    if (mode === 'ADDITIF') {
        fraisChantierUnit = ds * fc;
        fraisGenerauxUnit = ds * fg;
        margeUnit = ds * mg;
        pv = ds + fraisChantierUnit + fraisGenerauxUnit + margeUnit;
    }
    else {
        const cr = ds * (1 + fc);
        const pr = cr * (1 + fg);
        pv = pr * (1 + mg);
        fraisChantierUnit = cr - ds;
        fraisGenerauxUnit = pr - cr;
        margeUnit = pv - pr;
    }
    return {
        fraisChantierUnit: round(fraisChantierUnit, 4),
        fraisGenerauxUnit: round(fraisGenerauxUnit, 4),
        margeUnit: round(margeUnit, 4),
        prixUnitaireHT: roundToStep(pv, roundingStep),
    };
}
const PHASE_LABELS = {
    GROS_OEUVRE: 'Gros œuvre',
    SECOND_OEUVRE: 'Second œuvre',
    ELECTRICITE: 'Électricité',
    PLOMBERIE: 'Plomberie',
    FINITIONS: 'Finitions',
    VRD: 'VRD',
    AMENAGEMENTS: 'Aménagements',
};
/**
 * Calcule un devis quantitatif et estimatif complet à partir des
 * caractéristiques d'un projet — utilisé aussi bien pour le Niveau 1
 * (estimation rapide, non persistée) que pour le Niveau 2 (devis détaillé,
 * dont le résultat est ensuite persisté par l'appelant).
 */
async function computeEstimate(db, inputs, options = {}) {
    const markupMode = options.markupMode ?? 'CASCADE';
    const fraisChantierPct = options.fraisChantierPct ?? DEFAULT_FRAIS_CHANTIER_PCT;
    const fraisGenerauxPct = options.fraisGenerauxPct ?? DEFAULT_FRAIS_GENERAUX_PCT;
    const margePct = options.margePct ?? DEFAULT_MARGE_PCT;
    const tvaPct = options.tvaPct ?? DEFAULT_TVA_PCT;
    const toleranceRangePct = options.toleranceRangePct ?? DEFAULT_TOLERANCE_RANGE_PCT;
    const puRoundingStep = options.puRoundingStep ?? DEFAULT_PU_ROUNDING_STEP;
    const { r, warnings, ratioSnapshot, ratioProfileId, ratioProfileName } = await loadRatioContext(db, inputs.buildingType, inputs.standing, options.ratioProfileId);
    const warn = (m) => warnings.push(m);
    const d = (0, construction_formulas_1.computeDerivedMetrics)(inputs, r);
    const { q, traces } = makeFormulaResolver(inputs, r, d, warn);
    const locality = options.localityId
        ? await db.constructionLocality.findUnique({ where: { id: options.localityId } })
        : null;
    const variants = options.localityId
        ? await db.constructionResourcePriceVariant.findMany({ where: { localityId: options.localityId, isActive: true } })
        : [];
    const { priceFor, localityLabel } = makePriceResolver(locality, variants);
    const workItems = await db.constructionWorkItem.findMany({
        where: { isActive: true },
        include: { lot: true, components: { include: { resource: true } } },
        orderBy: [{ lot: { numero: 'asc' } }, { sortOrder: 'asc' }],
    });
    const activeLots = await db.constructionLot.findMany({ where: { isActive: true } });
    const lines = [];
    const resourceAcc = new Map();
    const percentItems = [];
    const lotsCovered = new Set();
    let order = 0;
    const addResourceUsage = (wi, qty) => {
        for (const c of wi.components) {
            const nette = qty * Number(c.quantityPerUnit);
            const brute = nette * (1 + Number(c.wastageRate) / 100);
            const existing = resourceAcc.get(c.resource.code);
            const unitPrice = priceFor(c.resource);
            if (existing) {
                existing.quantityNette += nette;
                existing.quantity += brute;
                existing.montant = round(existing.quantity * unitPrice, 2);
            }
            else {
                resourceAcc.set(c.resource.code, {
                    resourceId: c.resource.id,
                    resourceCode: c.resource.code,
                    resourceLabel: c.resource.label,
                    resourceType: c.resource.type,
                    family: c.resource.family,
                    unit: c.resource.unit,
                    quantityNette: round(nette, 3),
                    quantity: round(brute, 3),
                    unitPrice,
                    montant: round(brute * unitPrice, 2),
                });
            }
        }
    };
    for (const wi of workItems) {
        if (wi.percentOfTotalPct != null) {
            percentItems.push(wi);
            continue;
        }
        if (!(0, construction_formulas_1.isApplicable)(wi.applicabilityRule, inputs))
            continue;
        let qty = 0;
        let trace = null;
        if (wi.formulaCode) {
            qty = q(wi.formulaCode) * Number(wi.quantityMultiplier);
            trace = traces.get(wi.formulaCode) ?? null;
        }
        else if (wi.fixedQuantity != null) {
            qty = Number(wi.fixedQuantity) * Number(wi.quantityMultiplier);
            trace = `Quantité fixe = ${wi.fixedQuantity}`;
        }
        else {
            warn(`Ouvrage « ${wi.code} » sans formule ni quantité fixe — ignoré.`);
            continue;
        }
        qty = round(Math.max(0, qty), 3);
        if (qty <= 0)
            continue;
        const ds = computeDeboursSec(wi, priceFor, warn);
        const markup = applyMarkup(ds.total, markupMode, fraisChantierPct, fraisGenerauxPct, margePct, puRoundingStep);
        const montantHT = round(qty * markup.prixUnitaireHT, 2);
        lines.push({
            lotId: wi.lot.id, lotCode: wi.lot.code, lotLabel: wi.lot.label, lotNumero: wi.lot.numero, lotPhase: wi.lot.phase,
            workItemId: wi.id, workItemCode: wi.code, designation: wi.designation, unit: wi.unit,
            computedQuantity: qty, quantity: qty,
            deboursMateriaux: round(ds.mat, 4), deboursMainOeuvre: round(ds.mo, 4), deboursTransport: round(ds.tr, 4), deboursAutres: round(ds.au, 4),
            deboursSecUnitaire: round(ds.total, 4),
            fraisChantierUnit: markup.fraisChantierUnit, fraisGenerauxUnit: markup.fraisGenerauxUnit, margeUnit: markup.margeUnit,
            prixUnitaireHT: markup.prixUnitaireHT, montantHT,
            formulaCode: wi.formulaCode, formulaTrace: trace, order: order++,
        });
        lotsCovered.add(wi.lot.id);
        if (wi.deboursSecOverride == null)
            addResourceUsage(wi, qty);
    }
    const sousTotal = lines.reduce((s, l) => s + l.montantHT, 0);
    for (const wi of percentItems) {
        if (!(0, construction_formulas_1.isApplicable)(wi.applicabilityRule, inputs))
            continue;
        const pct = Number(wi.percentOfTotalPct) / 100;
        const montantHT = round(sousTotal * pct, 2);
        if (montantHT <= 0)
            continue;
        lines.push({
            lotId: wi.lot.id, lotCode: wi.lot.code, lotLabel: wi.lot.label, lotNumero: wi.lot.numero, lotPhase: wi.lot.phase,
            workItemId: wi.id, workItemCode: wi.code, designation: wi.designation, unit: wi.unit ?? 'forfait',
            computedQuantity: 1, quantity: 1,
            // Forfait exprimé directement en % du sous-total des autres lignes — déjà
            // un montant de vente, pas un coût : ne doit pas polluer le déboursé sec
            // ni la cascade frais/marge (montantHT reste seul déterminant de totalHT).
            deboursMateriaux: 0, deboursMainOeuvre: 0, deboursTransport: 0, deboursAutres: 0,
            deboursSecUnitaire: 0, fraisChantierUnit: 0, fraisGenerauxUnit: 0, margeUnit: 0,
            prixUnitaireHT: montantHT, montantHT,
            formulaCode: null, formulaTrace: `${Number(wi.percentOfTotalPct)}% du sous-total des autres lots (${round(sousTotal, 2)})`,
            order: order++,
        });
        lotsCovered.add(wi.lot.id);
    }
    const totalDeboursMateriaux = round(lines.reduce((s, l) => s + l.deboursMateriaux * l.quantity, 0));
    const totalDeboursMainOeuvre = round(lines.reduce((s, l) => s + l.deboursMainOeuvre * l.quantity, 0));
    const totalDeboursTransport = round(lines.reduce((s, l) => s + l.deboursTransport * l.quantity, 0));
    const totalDeboursAutres = round(lines.reduce((s, l) => s + l.deboursAutres * l.quantity, 0));
    const totalDeboursSec = round(totalDeboursMateriaux + totalDeboursMainOeuvre + totalDeboursTransport + totalDeboursAutres);
    const totalFraisChantier = round(lines.reduce((s, l) => s + l.fraisChantierUnit * l.quantity, 0));
    const totalFraisGeneraux = round(lines.reduce((s, l) => s + l.fraisGenerauxUnit * l.quantity, 0));
    const totalMarge = round(lines.reduce((s, l) => s + l.margeUnit * l.quantity, 0));
    const totalHT = round(lines.reduce((s, l) => s + l.montantHT, 0));
    const totalTVA = round(totalHT * (tvaPct / 100));
    const totalTTC = round(totalHT + totalTVA);
    const prixMoyenM2 = inputs.surfaceHabitable > 0 ? round(totalHT / inputs.surfaceHabitable) : null;
    const byPhase = Object.keys(PHASE_LABELS).map((phase) => {
        const montantHT = round(lines.filter((l) => l.lotPhase === phase).reduce((s, l) => s + l.montantHT, 0));
        return { phase: PHASE_LABELS[phase], montantHT, pct: totalHT > 0 ? round((montantHT / totalHT) * 100) : 0 };
    }).filter((p) => p.montantHT > 0);
    const byLotMap = new Map();
    for (const l of lines) {
        const existing = byLotMap.get(l.lotCode);
        if (existing)
            existing.montantHT = round(existing.montantHT + l.montantHT);
        else
            byLotMap.set(l.lotCode, { lotLabel: l.lotLabel, montantHT: l.montantHT });
    }
    const byLot = [...byLotMap.entries()].map(([lotCode, v]) => ({ lotCode, lotLabel: v.lotLabel, montantHT: v.montantHT }));
    const coveragePct = activeLots.length > 0 ? round((lotsCovered.size / activeLots.length) * 100) : 0;
    const uncoveredLots = activeLots.filter((l) => !lotsCovered.has(l.id));
    if (uncoveredLots.length > 0) {
        warn(`${uncoveredLots.length} lot(s) sans ouvrage applicable pour ce projet : ${uncoveredLots.map((l) => l.label).join(', ')}.`);
    }
    return {
        lines,
        resourceLines: [...resourceAcc.values()].sort((a, b) => b.montant - a.montant),
        totalDeboursMateriaux, totalDeboursMainOeuvre, totalDeboursTransport, totalDeboursAutres, totalDeboursSec,
        totalFraisChantier, totalFraisGeneraux, totalMarge, totalHT, totalTVA, totalTTC, prixMoyenM2,
        budgetMin: round(totalHT * (1 - toleranceRangePct / 100)),
        budgetMax: round(totalHT * (1 + toleranceRangePct / 100)),
        toleranceRangePct,
        byPhase, byLot, coveragePct,
        warnings: [...new Set(warnings)],
        ratioProfileId, ratioProfileName, ratioSnapshot,
        localityId: options.localityId ?? null, localityLabel,
        markupMode, fraisChantierPct, fraisGenerauxPct, margePct, tvaPct, puRoundingStep,
    };
}
/** Construit un `ProjectInputs` normalisé à partir d'un enregistrement ConstructionProject (Decimal Prisma → number). */
function toProjectInputs(project) {
    const num = (v, fallback = 0) => (v == null ? fallback : Number(v));
    return {
        buildingType: String(project.buildingType),
        standing: String(project.standing),
        levels: num(project.levels, 1),
        roomCount: num(project.roomCount, 1),
        livingRoomCount: num(project.livingRoomCount, 1),
        bedroomCount: num(project.bedroomCount, 0),
        bathroomCount: num(project.bathroomCount, 0),
        showerRoomCount: num(project.showerRoomCount, 0),
        wcCount: num(project.wcCount, 0),
        surfaceHabitable: num(project.surfaceHabitable, 0),
        surfaceConstruite: project.surfaceConstruite != null ? num(project.surfaceConstruite) : null,
        kitchenType: String(project.kitchenType ?? 'EQUIPEE_STANDARD'),
        roofType: String(project.roofType ?? 'DALLE_PLEINE'),
        joineryType: String(project.joineryType ?? 'ALUMINIUM_STANDARD'),
        interiorJoineryType: String(project.interiorJoineryType ?? project.joineryType ?? 'BOIS_MASSIF'),
        flooringType: String(project.flooringType ?? 'CARRELAGE_GRES_STANDARD'),
        acType: String(project.acType ?? 'SPLIT_PARTIEL'),
        acRoomCount: project.acRoomCount != null ? num(project.acRoomCount) : null,
        hasFalseCeiling: Boolean(project.hasFalseCeiling),
        terrainType: String(project.terrainType ?? 'PLAT'),
        terrainSurface: project.terrainSurface != null ? num(project.terrainSurface) : null,
        sanitationType: String(project.sanitationType ?? 'FOSSE_SEPTIQUE_PUISARD'),
        hasWaterConnection: project.hasWaterConnection !== false,
        hasElectricityConnection: project.hasElectricityConnection !== false,
        fenceLength: num(project.fenceLength, 0),
        fenceHeight: num(project.fenceHeight, 2),
        gateCount: num(project.gateCount, 0),
        hasPool: Boolean(project.hasPool),
        poolSurface: num(project.poolSurface, 0),
        hasExteriorLayout: Boolean(project.hasExteriorLayout),
        exteriorPavedSurface: num(project.exteriorPavedSurface, 0),
        hasLandscaping: Boolean(project.hasLandscaping),
    };
}
