"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConstructionProjectsIPC = registerConstructionProjectsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const construction_engine_service_1 = require("../services/construction-engine.service");
const quotes_ipc_1 = require("./quotes.ipc");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
/**
 * Projets & estimations du moteur de devis de construction (Module 17).
 *
 * Création/génération/conversion réservées à SUPER_ADMIN, ADMIN, MANAGER,
 * ACCOUNTANT (vue complète, `FULL_ACCESS`). Les autres rôles (AGENT,
 * AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, READONLY) sont en **lecture seule**,
 * limitée aux projets rattachés à un client ou un prospect dont ils sont le
 * référent commercial (`Client.assignedToId` / `Prospect.assignedToId`) —
 * périmètre par référent, et non plus par créateur du projet.
 */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const FULL_ACCESS = WRITE_ROLES;
const READ_ROLES = [...FULL_ACCESS, 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY'];
/** Suppression d'un projet ou d'une estimation : réservée à SUPER_ADMIN/ADMIN/MANAGER (ACCOUNTANT exclu, contrairement à la création/modification). */
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Filtre de visibilité (liste) : vue complète pour `FULL_ACCESS`, sinon limité aux projets dont le client OU le prospect rattaché a l'utilisateur pour référent. */
function scopeWhere(session) {
    if (FULL_ACCESS.includes(session.role))
        return {};
    return {
        OR: [
            { client: { is: { assignedToId: session.userId } } },
            { prospect: { is: { assignedToId: session.userId } } },
        ],
    };
}
/** Contrôle d'accès à un projet précis (fiche, génération, conversion…) — même périmètre par référent que `scopeWhere`. */
async function canAccess(db, session, project) {
    if (FULL_ACCESS.includes(session.role))
        return true;
    if (!project.clientId && !project.prospectId)
        return false;
    const [client, prospect] = await Promise.all([
        project.clientId ? db.client.findUnique({ where: { id: project.clientId }, select: { assignedToId: true } }) : Promise.resolve(null),
        project.prospectId ? db.prospect.findUnique({ where: { id: project.prospectId }, select: { assignedToId: true } }) : Promise.resolve(null),
    ]);
    return client?.assignedToId === session.userId || prospect?.assignedToId === session.userId;
}
const ser = (v) => JSON.parse(JSON.stringify(v));
const dec = (v) => (v == null ? null : String(v));
/**
 * Nombre optionnel tolérant la chaîne vide — le panneau « Estimation rapide »
 * (`QuickEstimatePanel`) envoie l'état brut du formulaire à `quickEstimate`
 * (`characteristics`), où un champ numérique optionnel non renseigné vaut `''`
 * (valeur par défaut d'un `<input type="number">` vide), et non `null`/absent
 * comme le fait le payload normalisé de `create`/`update`. Sans ce
 * préprocesseur, Zod rejette `''` avec « expected number, received string ».
 */
const optionalNumber = (schema) => zod_1.z.preprocess((v) => (v === '' ? undefined : v), schema.nullable().optional());
const BUILDING_TYPES = ['VILLA_BASSE', 'VILLA_DUPLEX', 'VILLA_TRIPLEX', 'MAISON_ECONOMIQUE', 'IMMEUBLE_R_PLUS', 'BUREAU', 'COMMERCE', 'ENTREPOT_HANGAR', 'AUTRE'];
const STANDINGS = ['ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE'];
const KITCHEN_TYPES = ['NUE', 'SIMPLE_PAILLASSE', 'EQUIPEE_STANDARD', 'EQUIPEE_HAUT_DE_GAMME'];
const ROOF_TYPES = ['DALLE_PLEINE', 'CHARPENTE_BOIS_TOLE', 'CHARPENTE_BOIS_TUILE', 'CHARPENTE_METALLIQUE_BAC', 'MIXTE_DALLE_CHARPENTE'];
const JOINERY_TYPES = ['ALUMINIUM_STANDARD', 'ALUMINIUM_VITRAGE_TEINTE', 'PVC', 'BOIS_MASSIF', 'METALLIQUE', 'MIXTE_ALU_BOIS'];
const FLOORING_TYPES = ['CHAPE_LISSEE', 'CARRELAGE_GRES_STANDARD', 'CARRELAGE_GRES_CERAME', 'GRANITO', 'MARBRE', 'PARQUET_BOIS', 'MIXTE'];
const AC_TYPES = ['AUCUNE', 'VENTILATION_SEULE', 'SPLIT_PARTIEL', 'SPLIT_TOUTES_PIECES', 'GAINABLE_CENTRALISE'];
const TERRAIN_TYPES = ['PLAT', 'LEGERE_PENTE', 'FORTE_PENTE', 'MARECAGEUX_REMBLAI', 'ROCHEUX'];
const SANITATION_TYPES = ['FOSSE_SEPTIQUE_PUISARD', 'FOSSE_TOUTES_EAUX_EPANDAGE', 'MICRO_STATION', 'RACCORDEMENT_RESEAU_COLLECTIF', 'AUCUN'];
const MARKUP_MODES = ['CASCADE', 'ADDITIF'];
const PRECISION_LEVELS = ['NIVEAU_1', 'NIVEAU_2', 'NIVEAU_3'];
const projectSchema = zod_1.z.object({
    nom: zod_1.z.string().min(1, 'Nom du projet requis'),
    clientId: zod_1.z.number().int().positive().nullable().optional(),
    prospectId: zod_1.z.number().int().positive().nullable().optional(),
    terrainId: zod_1.z.number().int().positive().nullable().optional(),
    projectId: zod_1.z.number().int().positive().nullable().optional(),
    agentId: zod_1.z.number().int().positive().nullable().optional(),
    buildingType: zod_1.z.enum(BUILDING_TYPES).default('VILLA_BASSE'),
    standing: zod_1.z.enum(STANDINGS).default('MOYEN_STANDING'),
    levels: zod_1.z.number().int().min(1).default(1),
    roomCount: zod_1.z.number().int().min(1).default(1),
    livingRoomCount: zod_1.z.number().int().min(0).default(1),
    bedroomCount: zod_1.z.number().int().min(0).default(0),
    bathroomCount: zod_1.z.number().int().min(0).default(0),
    showerRoomCount: zod_1.z.number().int().min(0).default(0),
    wcCount: zod_1.z.number().int().min(0).default(0),
    surfaceHabitable: zod_1.z.number().positive(),
    surfaceConstruite: optionalNumber(zod_1.z.number().positive()),
    kitchenType: zod_1.z.enum(KITCHEN_TYPES).default('EQUIPEE_STANDARD'),
    roofType: zod_1.z.enum(ROOF_TYPES).default('DALLE_PLEINE'),
    joineryType: zod_1.z.enum(JOINERY_TYPES).default('ALUMINIUM_STANDARD'),
    interiorJoineryType: zod_1.z.enum(JOINERY_TYPES).nullable().optional(),
    flooringType: zod_1.z.enum(FLOORING_TYPES).default('CARRELAGE_GRES_STANDARD'),
    acType: zod_1.z.enum(AC_TYPES).default('SPLIT_PARTIEL'),
    acRoomCount: optionalNumber(zod_1.z.number().int().min(0)),
    hasFalseCeiling: zod_1.z.boolean().default(false),
    terrainType: zod_1.z.enum(TERRAIN_TYPES).default('PLAT'),
    terrainSurface: optionalNumber(zod_1.z.number().positive()),
    localityId: zod_1.z.number().int().positive().nullable().optional(),
    ville: zod_1.z.string().nullable().optional(),
    commune: zod_1.z.string().nullable().optional(),
    quartier: zod_1.z.string().nullable().optional(),
    sanitationType: zod_1.z.enum(SANITATION_TYPES).default('FOSSE_SEPTIQUE_PUISARD'),
    hasWaterConnection: zod_1.z.boolean().default(true),
    hasElectricityConnection: zod_1.z.boolean().default(true),
    fenceLength: optionalNumber(zod_1.z.number().min(0)),
    fenceHeight: optionalNumber(zod_1.z.number().min(0)),
    gateCount: zod_1.z.number().int().min(0).default(0),
    hasPool: zod_1.z.boolean().default(false),
    poolSurface: optionalNumber(zod_1.z.number().min(0)),
    hasExteriorLayout: zod_1.z.boolean().default(false),
    exteriorPavedSurface: optionalNumber(zod_1.z.number().min(0)),
    hasLandscaping: zod_1.z.boolean().default(false),
    fraisChantierPct: optionalNumber(zod_1.z.number().min(0)),
    fraisGenerauxPct: optionalNumber(zod_1.z.number().min(0)),
    margePct: optionalNumber(zod_1.z.number().min(0)),
    tvaPct: optionalNumber(zod_1.z.number().min(0)),
    markupMode: zod_1.z.enum(MARKUP_MODES).nullable().optional(),
    description: zod_1.z.string().nullable().optional(),
    notes: zod_1.z.string().nullable().optional(),
});
const computeOptionsSchema = zod_1.z.object({
    ratioProfileId: zod_1.z.number().int().positive().nullable().optional(),
    localityId: zod_1.z.number().int().positive().nullable().optional(),
    fraisChantierPct: optionalNumber(zod_1.z.number().min(0)),
    fraisGenerauxPct: optionalNumber(zod_1.z.number().min(0)),
    margePct: optionalNumber(zod_1.z.number().min(0)),
    tvaPct: optionalNumber(zod_1.z.number().min(0)),
    markupMode: zod_1.z.enum(MARKUP_MODES).nullable().optional(),
    puRoundingStep: zod_1.z.number().int().positive().nullable().optional(),
    toleranceRangePct: optionalNumber(zod_1.z.number().min(0)),
});
const generateSchema = zod_1.z.object({
    projectId: zod_1.z.number().int().positive(),
    precisionLevel: zod_1.z.enum(PRECISION_LEVELS).default('NIVEAU_2'),
    label: zod_1.z.string().nullable().optional(),
    options: computeOptionsSchema.default({}),
    createQuote: zod_1.z.boolean().default(false),
    quote: zod_1.z.object({
        prospectId: zod_1.z.number().int().positive().nullable().optional(),
        clientId: zod_1.z.number().int().positive().nullable().optional(),
        agentId: zod_1.z.number().int().positive().nullable().optional(),
        objet: zod_1.z.string().nullable().optional(),
        validUntil: zod_1.z.string().nullable().optional(),
        taxRate: zod_1.z.number().min(0).default(0),
        templateId: zod_1.z.number().int().positive().nullable().optional(),
        referenceColumnLabel: zod_1.z.string().nullable().optional(),
        splitLaborByLot: zod_1.z.boolean().default(false).optional(),
    }).optional(),
});
const toQuoteSchema = zod_1.z.object({
    estimateId: zod_1.z.number().int().positive(),
    payload: zod_1.z.object({
        prospectId: zod_1.z.number().int().positive().nullable().optional(),
        clientId: zod_1.z.number().int().positive().nullable().optional(),
        agentId: zod_1.z.number().int().positive().nullable().optional(),
        objet: zod_1.z.string().nullable().optional(),
        validUntil: zod_1.z.string().nullable().optional(),
        taxRate: zod_1.z.number().min(0).default(0),
        templateId: zod_1.z.number().int().positive().nullable().optional(),
        referenceColumnLabel: zod_1.z.string().nullable().optional(),
        splitLaborByLot: zod_1.z.boolean().default(false).optional(),
    }),
});
/** Référence auto PC-YYYY-NNNN (projets de construction). */
async function nextProjectReference(db) {
    const year = new Date().getFullYear();
    const last = await db.constructionProject.findFirst({
        where: { reference: { startsWith: `PC-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `PC-${year}-${String(seq).padStart(4, '0')}`;
}
/** Référence auto EST-YYYY-NNNN (estimations). */
async function nextEstimateReference(db) {
    const year = new Date().getFullYear();
    const last = await db.constructionEstimate.findFirst({
        where: { reference: { startsWith: `EST-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `EST-${year}-${String(seq).padStart(4, '0')}`;
}
/** Sérialise les champs Decimal d'un projet en `data` Prisma pour create/update. */
function projectDataFromPayload(d) {
    return {
        ...d,
        surfaceHabitable: dec(d.surfaceHabitable),
        surfaceConstruite: d.surfaceConstruite != null ? dec(d.surfaceConstruite) : null,
        terrainSurface: d.terrainSurface != null ? dec(d.terrainSurface) : null,
        fenceLength: d.fenceLength != null ? dec(d.fenceLength) : null,
        fenceHeight: d.fenceHeight != null ? dec(d.fenceHeight) : null,
        poolSurface: d.poolSurface != null ? dec(d.poolSurface) : null,
        exteriorPavedSurface: d.exteriorPavedSurface != null ? dec(d.exteriorPavedSurface) : null,
        fraisChantierPct: d.fraisChantierPct != null ? dec(d.fraisChantierPct) : null,
        fraisGenerauxPct: d.fraisGenerauxPct != null ? dec(d.fraisGenerauxPct) : null,
        margePct: d.margePct != null ? dec(d.margePct) : null,
        tvaPct: d.tvaPct != null ? dec(d.tvaPct) : null,
    };
}
const PROJECT_INCLUDE = {
    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
    prospect: { select: { id: true, firstName: true, lastName: true } },
    terrain: { select: { id: true, reference: true } },
    agent: { select: { id: true, firstName: true, lastName: true } },
    locality: true,
    _count: { select: { estimates: true } },
};
/**
 * Construit les lignes d'articles à partir des lignes d'une estimation.
 *
 * Par défaut (`splitLaborByLot: false`), reprend chaque ligne telle quelle —
 * la main d'œuvre reste fondue dans le prix unitaire de l'ouvrage (comportement
 * historique, inchangé).
 *
 * Avec `splitLaborByLot: true`, chaque ligne voit sa part main d'œuvre
 * (`deboursMainOeuvre`, déjà connue par ouvrage) retirée de son prix — au
 * même ratio de marquage que le reste (`prixUnitaireHT / deboursSecUnitaire`,
 * un facteur multiplicatif constant quel que soit le déboursé, cf. cascade
 * DS→CR→PR→PV dans `construction-engine.service.ts`) — et une ligne
 * récapitulative « Main d'œuvre — <lot> » est ajoutée en fin de chaque lot.
 * Le sous-total de chaque lot (et le total du devis) reste identique au
 * centime près : la ligne main d'œuvre est calculée par complément
 * (`montant − matériaux`), jamais par un recalcul indépendant.
 */
function buildQuoteItems(lines, splitLaborByLot) {
    const active = lines.filter((l) => Number(l.quantity) > 0);
    if (!splitLaborByLot) {
        return active.map((l) => ({
            lineType: 'ARTICLE', designation: l.designation, reference: l.lotCode, category: l.lotLabel,
            quantity: Number(l.quantity), unit: l.unit, unitPrice: Number(l.prixUnitaireHT), total: Number(l.montantHT),
        }));
    }
    const laborByLot = new Map(); // lotCode -> montant main d'œuvre cumulé
    const lotLabelByCode = new Map();
    const materialItems = active.map((l) => {
        const qty = Number(l.quantity);
        const montant = Number(l.montantHT);
        const ds = Number(l.deboursSecUnitaire);
        const moDS = Number(l.deboursMainOeuvre);
        lotLabelByCode.set(l.lotCode, l.lotLabel);
        if (ds > 0 && moDS > 0) {
            const ratio = Number(l.prixUnitaireHT) / ds;
            const moUnitPrice = Math.round(moDS * ratio * 100) / 100;
            const materialUnitPrice = Math.round((Number(l.prixUnitaireHT) - moUnitPrice) * 100) / 100;
            const materialMontant = Math.round(materialUnitPrice * qty * 100) / 100;
            const moMontant = Math.round((montant - materialMontant) * 100) / 100; // complément exact, pas de dérive centime
            laborByLot.set(l.lotCode, (laborByLot.get(l.lotCode) ?? 0) + moMontant);
            return {
                lineType: 'ARTICLE', designation: l.designation, reference: l.lotCode, category: l.lotLabel,
                quantity: qty, unit: l.unit, unitPrice: materialUnitPrice, total: materialMontant,
            };
        }
        return {
            lineType: 'ARTICLE', designation: l.designation, reference: l.lotCode, category: l.lotLabel,
            quantity: qty, unit: l.unit, unitPrice: Number(l.prixUnitaireHT), total: montant,
        };
    });
    const laborItems = Array.from(laborByLot.entries())
        .filter(([, montant]) => montant > 0)
        .map(([lotCode, montant]) => ({
        lineType: 'ARTICLE', designation: `Main d'œuvre — ${lotLabelByCode.get(lotCode)}`,
        reference: lotCode, category: lotLabelByCode.get(lotCode), quantity: 1, unit: null,
        unitPrice: montant, total: montant,
    }));
    // Les lignes « Main d'œuvre » sont ajoutées en fin de tableau : groupItemsByCategory
    // (quoteTemplate.ts) regroupe par catégorie en préservant l'ordre d'insertion au sein
    // d'un groupe, donc chacune atterrit bien en dernière ligne de son lot.
    return [...materialItems, ...laborItems];
}
/**
 * Construit les lignes `QuoteItem` et les totaux d'un devis à partir des
 * lignes d'une estimation — mapping direct lot → catégorie (déclenche le
 * regroupement/sous-total déjà géré par `groupItemsByCategory`, cf.
 * `quoteTemplate.ts`), sans dupliquer la logique de totaux du module Devis
 * (réutilisation de `resolveQuoteAmounts`/`nextReference` exportées telles
 * quelles par `quotes.ipc.ts`).
 */
async function buildQuoteFromEstimate(tx, session, estimate, projectNom, lines, payload) {
    if (!payload.clientId && !payload.prospectId) {
        throw new Error('Sélectionnez un client ou un prospect destinataire du devis.');
    }
    const quoteItems = buildQuoteItems(lines, payload.splitLaborByLot ?? false);
    const { subtotal, taxAmount, total } = (0, quotes_ipc_1.resolveQuoteAmounts)(quoteItems.map((it) => ({ quantity: it.quantity, unitPrice: it.unitPrice })), { taxRate: payload.taxRate ?? 0 });
    const reference = await (0, quotes_ipc_1.nextReference)(tx);
    const quote = await tx.quote.create({
        data: {
            reference,
            type: 'PRESTATION',
            status: 'BROUILLON',
            objet: payload.objet?.trim() || `Construction — ${projectNom}`,
            prospectId: payload.prospectId ?? null,
            clientId: payload.clientId ?? null,
            agentId: payload.agentId ?? null,
            validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
            taxRate: dec(payload.taxRate ?? 0),
            subtotal: dec(subtotal),
            taxAmount: dec(taxAmount),
            total: dec(total),
            templateId: payload.templateId ?? null,
            referenceColumnLabel: payload.referenceColumnLabel ?? null,
            notes: `Généré depuis l'estimation ${estimate.reference} du ${new Date().toLocaleDateString('fr-FR')}.`,
            createdById: session.userId,
            items: {
                create: quoteItems.map((it, i) => ({
                    lineType: it.lineType,
                    designation: it.designation,
                    reference: it.reference,
                    category: it.category,
                    quantity: dec(it.quantity),
                    unit: it.unit,
                    unitPrice: dec(it.unitPrice),
                    total: dec(it.total),
                    order: i,
                })),
            },
        },
    });
    return { id: quote.id, reference: quote.reference };
}
function registerConstructionProjectsIPC() {
    // ── Projets ──────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('construction:projects:list', async (_event, { token, filters = {}, page = 1, limit = 50 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...scopeWhere(session) };
            if (filters.status)
                where.status = filters.status;
            if (filters.buildingType)
                where.buildingType = filters.buildingType;
            if (filters.standing)
                where.standing = filters.standing;
            if (filters.clientId)
                where.clientId = Number(filters.clientId);
            if (filters.prospectId)
                where.prospectId = Number(filters.prospectId);
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { nom: { contains: filters.search } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.constructionProject.findMany({ where, include: PROJECT_INCLUDE, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
                db.constructionProject.count({ where }),
            ]);
            return { success: true, data: ser(data), total };
        }
        catch (error) {
            logger_1.default.error('construction:projects:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:projects:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const project = await db.constructionProject.findUnique({
                where: { id: Number(id) },
                include: { ...PROJECT_INCLUDE, estimates: { where: { deletedAt: null }, orderBy: { version: 'desc' } } },
            });
            if (!project || project.deletedAt)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, project)))
                return { success: false, error: 'Projet inaccessible' };
            return { success: true, data: ser(project) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:projects:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = projectSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const reference = await nextProjectReference(db);
            const data = await db.constructionProject.create({
                data: { ...projectDataFromPayload(parsed.data), reference, createdById: session.userId },
                include: PROJECT_INCLUDE,
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:projects:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:projects:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.constructionProject.findUnique({ where: { id: Number(id) } });
            if (!existing || existing.deletedAt)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, existing)))
                return { success: false, error: 'Projet inaccessible' };
            const parsed = projectSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const data = await db.constructionProject.update({
                where: { id: Number(id) },
                data: projectDataFromPayload(parsed.data),
                include: PROJECT_INCLUDE,
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            logger_1.default.error('construction:projects:update error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:projects:duplicate', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const source = await db.constructionProject.findUnique({ where: { id: Number(id) } });
            if (!source || source.deletedAt)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, source)))
                return { success: false, error: 'Projet inaccessible' };
            const reference = await nextProjectReference(db);
            const { id: _id, uuid: _uuid, reference: _ref, createdAt, updatedAt, deletedAt, status, ...rest } = source;
            const data = await db.constructionProject.create({
                data: { ...rest, reference, nom: `${source.nom} (copie)`, status: 'BROUILLON', createdById: session.userId },
                include: PROJECT_INCLUDE,
            });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:projects:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, DELETE_ROLES);
            const db = (0, db_service_1.getDb)();
            const existing = await db.constructionProject.findUnique({ where: { id: Number(id) }, select: { clientId: true, prospectId: true, deletedAt: true } });
            if (!existing || existing.deletedAt)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, existing)))
                return { success: false, error: 'Projet inaccessible' };
            await db.constructionProject.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Niveau 1 — Estimation rapide (non persistée) ────────────────────
    electron_1.ipcMain.handle('construction:quickEstimate', async (_event, { token, projectId, characteristics }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            let source = null;
            if (projectId) {
                const project = await db.constructionProject.findUnique({ where: { id: Number(projectId) } });
                if (!project || project.deletedAt)
                    return { success: false, error: 'Projet introuvable' };
                if (!(await canAccess(db, session, project)))
                    return { success: false, error: 'Projet inaccessible' };
                source = project;
            }
            else if (characteristics) {
                const parsed = projectSchema.partial({ nom: true }).safeParse({ nom: 'x', ...characteristics });
                if (!parsed.success)
                    return { success: false, error: parsed.error.issues[0]?.message ?? 'Caractéristiques invalides' };
                source = parsed.data;
            }
            else {
                return { success: false, error: 'projectId ou characteristics requis' };
            }
            const inputs = (0, construction_engine_service_1.toProjectInputs)(source);
            const result = await (0, construction_engine_service_1.computeEstimate)(db, inputs, {
                localityId: source.localityId ?? undefined,
                fraisChantierPct: source.fraisChantierPct != null ? Number(source.fraisChantierPct) : undefined,
                fraisGenerauxPct: source.fraisGenerauxPct != null ? Number(source.fraisGenerauxPct) : undefined,
                margePct: source.margePct != null ? Number(source.margePct) : undefined,
                tvaPct: source.tvaPct != null ? Number(source.tvaPct) : undefined,
                markupMode: source.markupMode ?? undefined,
            });
            return {
                success: true,
                data: {
                    totalHT: result.totalHT, budgetMin: result.budgetMin, budgetMax: result.budgetMax,
                    toleranceRangePct: result.toleranceRangePct, prixMoyenM2: result.prixMoyenM2,
                    byPhase: result.byPhase, byLot: result.byLot, coveragePct: result.coveragePct,
                    totalDeboursSec: result.totalDeboursSec, totalMarge: result.totalMarge,
                    warnings: result.warnings,
                },
            };
        }
        catch (error) {
            logger_1.default.error('construction:quickEstimate error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Génération d'une estimation (Niveau 1 ou 2, persistée) ──────────
    electron_1.ipcMain.handle('construction:generateEstimate', async (_event, { token, ...payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = generateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const d = parsed.data;
            const db = (0, db_service_1.getDb)();
            const project = await db.constructionProject.findUnique({ where: { id: d.projectId } });
            if (!project || project.deletedAt)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, project)))
                return { success: false, error: 'Projet inaccessible' };
            if (d.createQuote && !d.quote)
                return { success: false, error: 'Informations du devis manquantes (createQuote=true).' };
            const inputs = (0, construction_engine_service_1.toProjectInputs)(project);
            const opts = d.options;
            const result = await (0, construction_engine_service_1.computeEstimate)(db, inputs, {
                ratioProfileId: opts.ratioProfileId ?? undefined,
                localityId: opts.localityId ?? project.localityId ?? undefined,
                fraisChantierPct: opts.fraisChantierPct ?? (project.fraisChantierPct != null ? Number(project.fraisChantierPct) : undefined),
                fraisGenerauxPct: opts.fraisGenerauxPct ?? (project.fraisGenerauxPct != null ? Number(project.fraisGenerauxPct) : undefined),
                margePct: opts.margePct ?? (project.margePct != null ? Number(project.margePct) : undefined),
                tvaPct: opts.tvaPct ?? (project.tvaPct != null ? Number(project.tvaPct) : undefined),
                markupMode: opts.markupMode ?? project.markupMode ?? undefined,
                puRoundingStep: opts.puRoundingStep ?? undefined,
                toleranceRangePct: opts.toleranceRangePct ?? undefined,
            });
            const reference = await nextEstimateReference(db);
            const lastVersion = await db.constructionEstimate.findFirst({ where: { projectId: d.projectId }, orderBy: { version: 'desc' }, select: { version: true } });
            const version = (lastVersion?.version ?? 0) + 1;
            const created = await db.$transaction(async (tx) => {
                const estimate = await tx.constructionEstimate.create({
                    data: {
                        reference, projectId: d.projectId, version, precisionLevel: d.precisionLevel, status: 'BROUILLON', label: d.label ?? null,
                        ratioProfileId: result.ratioProfileId, ratioProfileName: result.ratioProfileName, ratioSnapshot: result.ratioSnapshot,
                        localityId: result.localityId, localityLabel: result.localityLabel,
                        markupMode: result.markupMode, fraisChantierPct: dec(result.fraisChantierPct), fraisGenerauxPct: dec(result.fraisGenerauxPct),
                        margePct: dec(result.margePct), tvaPct: dec(result.tvaPct), puRoundingStep: result.puRoundingStep,
                        totalDeboursMateriaux: dec(result.totalDeboursMateriaux), totalDeboursMainOeuvre: dec(result.totalDeboursMainOeuvre),
                        totalDeboursTransport: dec(result.totalDeboursTransport), totalDeboursAutres: dec(result.totalDeboursAutres),
                        totalDeboursSec: dec(result.totalDeboursSec), totalFraisChantier: dec(result.totalFraisChantier),
                        totalFraisGeneraux: dec(result.totalFraisGeneraux), totalMarge: dec(result.totalMarge),
                        totalHT: dec(result.totalHT), totalTVA: dec(result.totalTVA), totalTTC: dec(result.totalTTC),
                        prixMoyenM2: result.prixMoyenM2 != null ? dec(result.prixMoyenM2) : null,
                        toleranceRangePct: dec(result.toleranceRangePct), budgetMin: dec(result.budgetMin), budgetMax: dec(result.budgetMax),
                        coveragePct: dec(result.coveragePct), warnings: result.warnings,
                        generatedById: session.userId,
                    },
                });
                if (result.lines.length) {
                    await tx.constructionEstimateLine.createMany({
                        data: result.lines.map((l) => ({
                            estimateId: estimate.id, lotId: l.lotId, lotCode: l.lotCode, lotLabel: l.lotLabel, lotNumero: l.lotNumero, lotPhase: l.lotPhase,
                            workItemId: l.workItemId, workItemCode: l.workItemCode, designation: l.designation, unit: l.unit,
                            computedQuantity: dec(l.computedQuantity), quantity: dec(l.quantity),
                            deboursMateriaux: dec(l.deboursMateriaux), deboursMainOeuvre: dec(l.deboursMainOeuvre),
                            deboursTransport: dec(l.deboursTransport), deboursAutres: dec(l.deboursAutres), deboursSecUnitaire: dec(l.deboursSecUnitaire),
                            fraisChantierUnit: dec(l.fraisChantierUnit), fraisGenerauxUnit: dec(l.fraisGenerauxUnit), margeUnit: dec(l.margeUnit),
                            prixUnitaireHT: dec(l.prixUnitaireHT), montantHT: dec(l.montantHT),
                            formulaCode: l.formulaCode, formulaTrace: l.formulaTrace, order: l.order,
                        })),
                    });
                }
                if (result.resourceLines.length) {
                    await tx.constructionEstimateResourceLine.createMany({
                        data: result.resourceLines.map((r, i) => ({
                            estimateId: estimate.id, resourceId: r.resourceId, resourceCode: r.resourceCode, resourceLabel: r.resourceLabel,
                            resourceType: r.resourceType, family: r.family, unit: r.unit,
                            quantityNette: dec(r.quantityNette), quantity: dec(r.quantity), unitPrice: dec(r.unitPrice), montant: dec(r.montant),
                            order: i,
                        })),
                    });
                }
                let quoteInfo = null;
                if (d.createQuote && d.quote) {
                    quoteInfo = await buildQuoteFromEstimate(tx, session, estimate, project.nom, result.lines, d.quote);
                    await tx.constructionEstimate.update({
                        where: { id: estimate.id },
                        data: { quoteId: quoteInfo.id, quoteReference: quoteInfo.reference, convertedAt: new Date(), status: 'CONVERTI' },
                    });
                }
                await tx.constructionProject.update({ where: { id: d.projectId }, data: { status: quoteInfo ? 'DEVIS_EMIS' : 'ESTIME' } });
                return tx.constructionEstimate.findUnique({ where: { id: estimate.id }, include: { lines: { orderBy: { order: 'asc' } }, resourceLines: true } });
            });
            return { success: true, data: ser(created) };
        }
        catch (error) {
            logger_1.default.error('construction:generateEstimate error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Estimations ──────────────────────────────────────────────────────
    electron_1.ipcMain.handle('construction:estimates:list', async (_event, { token, projectId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const project = await db.constructionProject.findUnique({ where: { id: Number(projectId) }, select: { clientId: true, prospectId: true } });
            if (!project)
                return { success: false, error: 'Projet introuvable' };
            if (!(await canAccess(db, session, project)))
                return { success: false, error: 'Projet inaccessible' };
            const data = await db.constructionEstimate.findMany({ where: { projectId: Number(projectId), deletedAt: null }, orderBy: { version: 'desc' } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    async function loadEstimate(db, session, id) {
        const estimate = await db.constructionEstimate.findUnique({
            where: { id }, include: { project: true, lines: { orderBy: { order: 'asc' } }, resourceLines: { orderBy: { montant: 'desc' } } },
        });
        if (!estimate || estimate.deletedAt)
            return null;
        if (!(await canAccess(db, session, estimate.project)))
            throw new Error('Estimation inaccessible');
        return estimate;
    }
    electron_1.ipcMain.handle('construction:estimates:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const estimate = await loadEstimate((0, db_service_1.getDb)(), session, Number(id));
            if (!estimate)
                return { success: false, error: 'Estimation introuvable' };
            return { success: true, data: ser(estimate) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:estimates:summary', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const estimate = await loadEstimate((0, db_service_1.getDb)(), session, Number(id));
            if (!estimate)
                return { success: false, error: 'Estimation introuvable' };
            const byPhaseMap = new Map();
            const byLotMap = new Map();
            for (const l of estimate.lines) {
                byPhaseMap.set(l.lotPhase, (byPhaseMap.get(l.lotPhase) ?? 0) + Number(l.montantHT));
                const existing = byLotMap.get(l.lotCode);
                if (existing)
                    existing.montantHT += Number(l.montantHT);
                else
                    byLotMap.set(l.lotCode, { lotLabel: l.lotLabel, montantHT: Number(l.montantHT) });
            }
            const totalHT = Number(estimate.totalHT);
            const tauxMargeSurPV = totalHT > 0 ? Math.round((Number(estimate.totalMarge) / totalHT) * 1000) / 10 : 0;
            return {
                success: true,
                data: {
                    project: ser(estimate.project),
                    byPhase: [...byPhaseMap.entries()].map(([phase, montantHT]) => ({ phase, montantHT })),
                    byLot: [...byLotMap.entries()].map(([lotCode, v]) => ({ lotCode, ...v })),
                    totalDeboursSec: Number(estimate.totalDeboursSec), totalFraisChantier: Number(estimate.totalFraisChantier),
                    totalFraisGeneraux: Number(estimate.totalFraisGeneraux), totalMarge: Number(estimate.totalMarge),
                    totalHT, totalTVA: Number(estimate.totalTVA), totalTTC: Number(estimate.totalTTC), tauxMargeSurPV,
                    prixMoyenM2: estimate.prixMoyenM2 != null ? Number(estimate.prixMoyenM2) : null,
                    coveragePct: estimate.coveragePct != null ? Number(estimate.coveragePct) : null,
                    warnings: estimate.warnings ?? [],
                },
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:estimates:materials', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const estimate = await loadEstimate((0, db_service_1.getDb)(), session, Number(id));
            if (!estimate)
                return { success: false, error: 'Estimation introuvable' };
            const data = estimate.resourceLines.filter((r) => r.resourceType === 'MATERIAU' || r.resourceType === 'MATERIEL' || r.resourceType === 'SOUS_TRAITANCE');
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:estimates:labor', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const estimate = await loadEstimate((0, db_service_1.getDb)(), session, Number(id));
            if (!estimate)
                return { success: false, error: 'Estimation introuvable' };
            const HEURES_PAR_JOUR = 8;
            const data = estimate.resourceLines
                .filter((r) => r.resourceType === 'MAIN_OEUVRE')
                .map((r) => ({ ...r, hommeJours: Math.round((Number(r.quantity) / HEURES_PAR_JOUR) * 100) / 100 }));
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:estimates:toQuote', async (_event, { token, ...payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = toQuoteSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
            const db = (0, db_service_1.getDb)();
            const estimate = await db.constructionEstimate.findUnique({
                where: { id: parsed.data.estimateId }, include: { project: true, lines: { orderBy: { order: 'asc' } } },
            });
            if (!estimate || estimate.deletedAt)
                return { success: false, error: 'Estimation introuvable' };
            if (!(await canAccess(db, session, estimate.project)))
                return { success: false, error: 'Estimation inaccessible' };
            if (estimate.quoteId)
                return { success: false, error: 'Cette estimation a déjà été convertie en devis.' };
            const result = await db.$transaction(async (tx) => {
                const quoteInfo = await buildQuoteFromEstimate(tx, session, estimate, estimate.project.nom, estimate.lines, parsed.data.payload);
                await tx.constructionEstimate.update({
                    where: { id: estimate.id },
                    data: { quoteId: quoteInfo.id, quoteReference: quoteInfo.reference, convertedAt: new Date(), status: 'CONVERTI' },
                });
                await tx.constructionProject.update({ where: { id: estimate.projectId }, data: { status: 'DEVIS_EMIS' } });
                return quoteInfo;
            });
            return { success: true, data: result };
        }
        catch (error) {
            logger_1.default.error('construction:estimates:toQuote error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:estimates:setStatus', async (_event, { token, id, status }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const estimate = await db.constructionEstimate.findUnique({ where: { id: Number(id) }, include: { project: true } });
            if (!estimate || estimate.deletedAt)
                return { success: false, error: 'Estimation introuvable' };
            if (!(await canAccess(db, session, estimate.project)))
                return { success: false, error: 'Estimation inaccessible' };
            if (!['VALIDE', 'OBSOLETE'].includes(status))
                return { success: false, error: 'Statut invalide' };
            const data = await db.constructionEstimate.update({ where: { id: Number(id) }, data: { status } });
            return { success: true, data: ser(data) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('construction:estimates:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, DELETE_ROLES);
            const db = (0, db_service_1.getDb)();
            const estimate = await db.constructionEstimate.findUnique({ where: { id: Number(id) }, include: { project: true } });
            if (!estimate || estimate.deletedAt)
                return { success: false, error: 'Estimation introuvable' };
            if (!(await canAccess(db, session, estimate.project)))
                return { success: false, error: 'Estimation inaccessible' };
            await db.constructionEstimate.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
