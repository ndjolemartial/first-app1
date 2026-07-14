"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAttestationsIPC = registerAttestationsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
/**
 * Contrôle de rôle pour les écritures sur les attestations (création, mise à jour,
 * suppression). ASSISTANTE_DIRECTION, qui hérite normalement des permissions
 * MANAGER, est explicitement exclue : elle ne peut pas modifier une attestation.
 */
function checkWriteRole(session, allowedRoles) {
    if (session.role === 'ASSISTANTE_DIRECTION') {
        throw new Error('Permission insuffisante');
    }
    (0, auth_service_1.checkRole)(session, allowedRoles);
}
/**
 * Rôles autorisés à émettre / modifier une attestation de SOLDE portant sur une
 * souscription héritée (échéances sans convention). Liste explicite, volontairement
 * vérifiée SANS passer par `checkRole` : on veut inclure le comptable (ACCOUNTANT)
 * mais EXCLURE l'assistante de direction, alors que `checkRole` rend ces deux rôles
 * équivalents à un MANAGER. Seuls administrateurs, managers et comptables.
 */
const LEGACY_SOLDE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
function checkLegacySoldeRole(session) {
    if (!LEGACY_SOLDE_ROLES.includes(session.role)) {
        throw new Error("Permission insuffisante : seuls les administrateurs, managers et comptables peuvent "
            + "émettre une attestation de solde sur une échéance héritée");
    }
}
/**
 * Restriction de visibilité d'un AGENT : attestations des clients dont il est le
 * référent (client.assignedToId). Les attestations n'ont pas de statut, donc pas
 * de filtre BROUILLON ici. Renvoie `{}` pour les autres rôles.
 */
function agentScopeWhere(session) {
    if ((0, auth_service_1.isAgentRole)(session.role)) {
        return { client: { assignedToId: session.userId } };
    }
    return {};
}
const ATTESTATION_TYPES = ['ATTRIBUTION', 'CESSION', 'SOLDE', 'TRANSFERT_PROPRIETE'];
/**
 * Schéma de base (objet brut). On le garde séparé des `.refine()` car
 * `ZodEffects` (résultat d'un refine) ne supporte pas `.partial()`, indispensable
 * pour la validation des mises à jour partielles côté `attestations:update`.
 */
const attestationBaseSchema = zod_1.z.object({
    type: zod_1.z.enum(ATTESTATION_TYPES),
    clientId: zod_1.z.number().int().positive(),
    secondaryClientId: zod_1.z.number().int().positive().optional(),
    terrainId: zod_1.z.number().int().positive().optional(),
    propertyId: zod_1.z.number().int().positive().optional(),
    // Sélection multiple de terrains/biens (ATTRIBUTION / CESSION) — doivent
    // provenir respectivement d'un même lotissement / d'un même programme
    // immobilier (cf. assertSingleLotissement / assertSingleProgramme).
    terrainIds: zod_1.z.array(zod_1.z.number().int().positive()).optional(),
    propertyIds: zod_1.z.array(zod_1.z.number().int().positive()).optional(),
    conventionId: zod_1.z.number().int().positive().optional(),
    templateId: zod_1.z.number().int().positive().optional(),
    emittedAt: zod_1.z.string().optional(),
    amount: zod_1.z.number().optional(),
    prixTotalBien: zod_1.z.number().optional(),
    notes: zod_1.z.string().optional(),
});
/** Vrai si un terrain ou un bien est renseigné (singulier ou sélection multiple). */
function hasAsset(d) {
    return !!d.terrainId || !!d.propertyId || !!(d.terrainIds?.length) || !!(d.propertyIds?.length);
}
const attestationSchema = attestationBaseSchema
    .refine((d) => (d.type === 'CESSION' ? !!d.secondaryClientId : true), { message: 'Une attestation de cession nécessite un cédant (client secondaire)' })
    .refine((d) => (d.type === 'CESSION' ? d.clientId !== d.secondaryClientId : true), { message: 'Le cessionnaire et le cédant doivent être deux clients différents' })
    .refine((d) => (d.type === 'CESSION' ? hasAsset(d) : true), { message: 'Une attestation de cession nécessite un terrain ou un bien immobilier cédé' })
    .refine((d) => (d.type === 'TRANSFERT_PROPRIETE' ? !!d.secondaryClientId : true), { message: 'Une attestation de transfert de propriété nécessite l\'ancien propriétaire' })
    .refine((d) => (d.type === 'TRANSFERT_PROPRIETE' ? d.clientId !== d.secondaryClientId : true), { message: 'L\'ancien propriétaire et le nouveau bénéficiaire doivent être différents' });
/**
 * Schéma de mise à jour : on autorise tous les champs en partiel et on
 * réplique les contraintes CESSION uniquement quand les champs concernés sont
 * effectivement fournis (le cas contraire signifie « non modifié »).
 */
const attestationUpdateSchema = attestationBaseSchema.partial()
    .refine((d) => (d.type === 'CESSION' && 'secondaryClientId' in d ? !!d.secondaryClientId : true), { message: 'Une attestation de cession nécessite un cédant (client secondaire)' })
    .refine((d) => (d.type === 'CESSION' && d.clientId != null && d.secondaryClientId != null
    ? d.clientId !== d.secondaryClientId
    : true), { message: 'Le cessionnaire et le cédant doivent être deux clients différents' })
    .refine((d) => (d.type === 'CESSION' && ('terrainId' in d || 'propertyId' in d || 'terrainIds' in d || 'propertyIds' in d)
    ? hasAsset(d)
    : true), { message: 'Une attestation de cession nécessite un terrain ou un bien immobilier cédé' })
    .refine((d) => (d.type === 'TRANSFERT_PROPRIETE' && 'secondaryClientId' in d ? !!d.secondaryClientId : true), { message: 'Une attestation de transfert de propriété nécessite l\'ancien propriétaire' })
    .refine((d) => (d.type === 'TRANSFERT_PROPRIETE' && d.clientId != null && d.secondaryClientId != null
    ? d.clientId !== d.secondaryClientId
    : true), { message: 'L\'ancien propriétaire et le nouveau bénéficiaire doivent être différents' });
/**
 * Sérialise une valeur pour l'IPC : les objets Decimal de Prisma ne sont pas
 * clonables nativement par Electron. Round-trip JSON → types primitifs.
 */
const ser = (v) => JSON.parse(JSON.stringify(v));
/** Référence auto : ATT-YYYY-NNNN, séquence annuelle. */
async function nextReference(db) {
    const year = new Date().getFullYear();
    const last = await db.attestation.findFirst({
        where: { reference: { startsWith: `ATT-${year}-` } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `ATT-${year}-${String(seq).padStart(4, '0')}`;
}
/**
 * Vérifie que tous les terrains d'une attestation (sélection multiple)
 * proviennent du même lotissement — même règle que pour une convention
 * (cf. `assertSingleLotissement` dans conventions.ipc.ts). Un terrain a
 * toujours un lotissement (`lotissementId` non nul).
 */
async function assertSingleLotissement(db, terrainIds) {
    if (!terrainIds || terrainIds.length < 2)
        return;
    const terrains = await db.terrain.findMany({
        where: { id: { in: terrainIds } },
        select: { id: true, lotissementId: true },
    });
    const lotIds = new Set(terrains.map((t) => t.lotissementId));
    if (lotIds.size > 1) {
        throw new Error('Tous les terrains d\'une attestation doivent provenir du même lotissement.');
    }
}
/**
 * Vérifie que les biens immobiliers d'une attestation (sélection multiple)
 * proviennent du même programme immobilier lorsque celui-ci est déterminable.
 * Seuls les biens ayant effectivement un programme doivent être homogènes
 * entre eux ; les biens sans programme (`programmeId` null) n'imposent aucune
 * contrainte (sélection libre dans ce cas).
 */
async function assertSingleProgramme(db, propertyIds) {
    if (!propertyIds || propertyIds.length < 2)
        return;
    const properties = await db.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, programmeId: true },
    });
    const programmeIds = new Set(properties.map((p) => p.programmeId).filter((id) => id != null));
    if (programmeIds.size > 1) {
        throw new Error('Tous les biens immobiliers d\'une attestation doivent provenir du même programme immobilier.');
    }
}
const INCLUDE = {
    client: { include: { idType: { select: { id: true, code: true, label: true } } } },
    secondaryClient: { include: { idType: { select: { id: true, code: true, label: true } } } },
    terrain: {
        include: {
            lotissement: {
                include: {
                    titleType: { select: { id: true, code: true, label: true, documentsLivres: true } },
                },
            },
        },
    },
    property: true,
    // Sélection multiple de terrains/biens — le champ singulier terrain/property
    // ci-dessus reste aligné sur le premier élément pour compatibilité.
    terrains: {
        orderBy: { order: 'asc' },
        include: {
            terrain: {
                include: {
                    lotissement: {
                        include: {
                            titleType: { select: { id: true, code: true, label: true, documentsLivres: true } },
                        },
                    },
                },
            },
        },
    },
    properties: {
        orderBy: { order: 'asc' },
        include: { property: true },
    },
    convention: {
        include: {
            _count: { select: { terrains: true } },
            // Terrains rattachés à la convention — nécessaires pour résoudre
            // {{convention.lotsSouscrits}} et {{convention.lotissement.*}} dans
            // le modèle d'attestation.
            terrains: {
                orderBy: { order: 'asc' },
                include: {
                    terrain: {
                        select: {
                            id: true, reference: true, numeroIlot: true, numeroParcelle: true, surface: true,
                            lotissement: { select: { id: true, nom: true, ville: true } },
                        },
                    },
                },
            },
            // Terrains ANTÉRIEURS rattachés à la convention — nécessaires pour
            // résoudre {{convention.lotissementAnterieur.nom|ville}} et le coût total
            // des lots antérieurs dans le modèle d'attestation (champ « Terrains
            // antérieurs rattachés »).
            priorTerrains: {
                orderBy: { order: 'asc' },
                include: {
                    terrain: {
                        select: {
                            id: true, reference: true, numeroIlot: true, numeroParcelle: true,
                            surface: true, prixVente: true,
                            lotissement: { select: { id: true, nom: true, ville: true } },
                        },
                    },
                },
            },
            // Échéancier de la convention liée — utilisé pour résoudre
            // {{avenant.echeancier}} lorsque la convention est un avenant
            // de transfert de site en paiement échelonné.
            installments: { orderBy: { installmentNumber: 'asc' } },
            // Convention parente — pour les attestations liées à un avenant : permet
            // de résoudre les variables {{convention.initiale.*}} et {{avenant.numero}}.
            // On charge aussi le premier terrain rattaché et son lotissement pour
            // {{convention.initiale.lotissement.nom|ville}}.
            parentConvention: {
                select: {
                    id: true, reference: true, signedAt: true, saleAmount: true, apportInitial: true,
                    // Nécessaire pour distinguer paiement comptant (CASH) et
                    // paiement échelonné dans le calcul du total des versements.
                    paymentModalites: true,
                    installments: {
                        select: { id: true, amount: true, status: true },
                        orderBy: { installmentNumber: 'asc' },
                    },
                    amendments: {
                        where: { deletedAt: null },
                        select: { id: true, createdAt: true },
                        orderBy: { createdAt: 'asc' },
                    },
                    terrains: {
                        orderBy: { order: 'asc' },
                        select: {
                            terrain: {
                                select: {
                                    id: true,
                                    // Champs requis par lotsEnumeration() pour le rendu de
                                    // la variable {{convention.initiale.lotsSouscrits}}.
                                    numeroIlot: true, numeroParcelle: true, surface: true,
                                    lotissement: { select: { id: true, nom: true, ville: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    template: true,
    emittedBy: { select: { id: true, firstName: true, lastName: true, matricule: true } },
    documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } },
};
/**
 * Vérifie qu'une convention liée est éligible au type d'attestation demandé.
 *
 * Règles :
 *   1. Une attestation ne peut jamais être rattachée à un AVENANT ni à une
 *      RESILIATION — quel que soit le type d'attestation.
 *   2. Une attestation SOLDE ou TRANSFERT_PROPRIETE ne peut être émise que
 *      lorsque le solde de la souscription liée est strictement à zéro
 *      (prix de vente + frais d'ouverture + frais supplémentaires
 *      − apport − échéances payées ; les frais ACD ne sont jamais comptés).
 *
 * Lève une `Error` lisible en cas de violation.
 */
async function assertConventionEligibleForAttestation(db, conventionId, attestationType) {
    if (!conventionId)
        return;
    const c = await db.convention.findUnique({
        where: { id: conventionId, deletedAt: null },
        select: {
            id: true, type: true, status: true, saleAmount: true, fraisOuvertureDossier: true,
            additionalAmount: true, apportInitial: true, paymentModalites: true, priorConventionDate: true, priorSolde: true,
            installments: { select: { id: true, amount: true, paidAmount: true, status: true } },
        },
    });
    if (!c)
        throw new Error('Convention liée introuvable');
    if (c.status === 'BROUILLON') {
        throw new Error('Impossible d\'associer une attestation à une convention en brouillon : finalisez-la d\'abord');
    }
    if (c.type === 'AVENANT' || c.type === 'RESILIATION') {
        throw new Error('Une attestation ne peut pas être liée à un avenant ni à une convention de résiliation');
    }
    if (attestationType === 'SOLDE' || attestationType === 'TRANSFERT_PROPRIETE') {
        if (isHeritedConvention(c)) {
            // Convention héritée : le solde est celui de ses échéances (montant restant
            // dû = amount − paidAmount) si elle en a, sinon le solde antérieur importé
            // (`priorSolde`). On autorise l'attestation dès que ce solde est ≤ 0.
            const balance = heritedBalance(c);
            if (balance == null) {
                throw new Error('Solde de la convention héritée indéterminé : aucune échéance ni solde antérieur renseigné.');
            }
            if (Math.round(balance * 100) / 100 > 0) {
                throw new Error(`Le solde des échéances de la convention héritée doit être inférieur ou égal à 0 pour émettre cette attestation (solde restant : ${Math.round(balance)}).`);
            }
            return;
        }
        const sale = Number(c.saleAmount ?? 0);
        if (!sale) {
            throw new Error('La convention liée n\'a pas de montant de souscription : solde indéterminé');
        }
        let balance;
        if (c.paymentModalites === 'CASH') {
            balance = 0;
        }
        else {
            const totalDu = sale
                + Number(c.fraisOuvertureDossier ?? 0)
                + Number(c.additionalAmount ?? 0);
            const apport = Number(c.apportInitial ?? 0);
            const paid = (c.installments ?? [])
                .filter((i) => i.status === 'PAYE')
                .reduce((s, i) => s + (Number(i.amount) || 0), 0);
            balance = Math.max(0, totalDu - apport - paid);
        }
        if (balance > 0) {
            throw new Error(`Le solde de la souscription doit être à 0 pour émettre cette attestation (solde restant : ${balance}).`);
        }
    }
}
/** Types de conventions « héritées » (importées de la base antérieure). */
const HERITED_CONVENTION_TYPES = ['AVENANT_DELAI_HERITE', 'AVENANT_TRANSFERT_SITE_HERITE', 'AVENANT_RESILIATION_HERITE'];
/** Vrai si la convention est héritée (date d'origine importée ou type hérité). */
function isHeritedConvention(c) {
    return c.priorConventionDate != null || (c.type != null && HERITED_CONVENTION_TYPES.includes(c.type));
}
/**
 * Solde d'une convention héritée : montant restant dû sur ses échéances non
 * annulées (amount − paidAmount) si elle en a, sinon le solde antérieur importé
 * (`priorSolde`). `null` si indéterminé (ni échéance, ni solde antérieur).
 */
function heritedBalance(c) {
    const active = (c.installments ?? []).filter((i) => i.status !== 'ANNULE');
    if (active.length > 0) {
        return active.reduce((s, i) => s + (Number(i.amount) - Number(i.paidAmount ?? 0)), 0);
    }
    if (c.priorSolde != null)
        return Number(c.priorSolde);
    return null;
}
/**
 * Vérifie qu'une souscription héritée (échéances sans convention) est soldée pour
 * le couple (client, terrain(s)). Le solde = somme des montants restant dus
 * (`amount − paidAmount`) sur les échéances héritées NON annulées du client
 * rattachées à l'un des terrains (via `terrainLinks` ou le champ direct
 * `terrainId`). Il doit être nul pour émettre une attestation de solde.
 *
 * Lève une `Error` lisible si aucune échéance n'existe pour ce couple ou si le
 * solde reste positif.
 */
async function assertLegacySubscriptionSettled(db, clientId, terrainIds = []) {
    // Terrain(s) optionnel(s) : s'ils sont fournis, on cible la souscription de
    // ces terrains ; sinon on considère toutes les échéances héritées du client
    // (souscription héritée sans terrain rattaché).
    const clientWhere = { conventionId: null, clientId, status: { not: 'ANNULE' } };
    const where = { ...clientWhere };
    if (terrainIds.length > 0) {
        where.OR = [{ terrainId: { in: terrainIds } }, { terrainLinks: { some: { terrainId: { in: terrainIds } } } }];
    }
    let installments = await db.saleInstallment.findMany({
        where,
        select: { amount: true, paidAmount: true },
    });
    // Repli : des terrains ont été précisés mais aucune échéance héritée n'y
    // correspond → on retombe sur l'ensemble des échéances héritées du client
    // (la souscription héritée peut ne pas être rattachée à ces terrains).
    if (installments.length === 0 && terrainIds.length > 0) {
        installments = await db.saleInstallment.findMany({
            where: clientWhere,
            select: { amount: true, paidAmount: true },
        });
    }
    if (installments.length === 0) {
        throw new Error('Aucune échéance héritée pour ce client : solde indéterminé');
    }
    // Solde net = total souscrit − total réglé (peut être ≤ 0). On autorise
    // l'attestation dès que ce solde est inférieur ou égal à 0.
    const balance = installments.reduce((s, i) => s + (Number(i.amount) - Number(i.paidAmount ?? 0)), 0);
    // Tolérance d'arrondi (centimes) avant de bloquer.
    if (Math.round(balance * 100) / 100 > 0) {
        throw new Error(`Le solde de la souscription héritée doit être inférieur ou égal à 0 pour émettre cette attestation `
            + `(solde restant : ${Math.round(balance)}).`);
    }
}
/**
 * Met à jour les champs `numeroAttestationAttribution` / `numeroAttestationCession`
 * sur le(s) terrain(s) rattaché(s) lorsqu'une attestation pertinente est émise.
 */
async function syncTerrainAttestationFields(db, terrainIds, type, reference) {
    if (terrainIds.length === 0)
        return;
    if (type === 'ATTRIBUTION') {
        await db.terrain.updateMany({
            where: { id: { in: terrainIds } },
            data: { numeroAttestationAttribution: reference },
        });
    }
    else if (type === 'CESSION') {
        await db.terrain.updateMany({
            where: { id: { in: terrainIds } },
            data: { numeroAttestationCession: reference },
        });
    }
}
/** Déduplique une liste d'identifiants en conservant l'ordre de première apparition. */
function dedupeIds(ids) {
    return Array.from(new Set(ids));
}
function registerAttestationsIPC() {
    electron_1.ipcMain.handle('attestations:list', async (_event, { token, filters = {}, page = 1, limit = 50 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.type)
                where.type = filters.type;
            if (filters.clientId)
                where.clientId = Number(filters.clientId);
            if (filters.conventionId)
                where.conventionId = Number(filters.conventionId);
            if (filters.terrainId)
                where.terrainId = Number(filters.terrainId);
            if (filters.propertyId)
                where.propertyId = Number(filters.propertyId);
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { notes: { contains: filters.search } },
                ];
            }
            // AGENT : restreint aux attestations de ses clients référents.
            Object.assign(where, agentScopeWhere(session));
            const [data, total] = await db.$transaction([
                db.attestation.findMany({
                    where,
                    include: INCLUDE,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { emittedAt: 'desc' },
                }),
                db.attestation.count({ where }),
            ]);
            return { success: true, data: ser(data), total };
        }
        catch (error) {
            logger_1.default.error('attestations:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const attestation = await db.attestation.findUnique({ where: { id }, include: INCLUDE });
            if (!attestation || attestation.deletedAt)
                return { success: false, error: 'Attestation introuvable' };
            // AGENT : accès limité aux attestations de ses clients référents.
            if ((0, auth_service_1.isAgentRole)(session.role) && attestation.client?.assignedToId !== session.userId) {
                return { success: false, error: 'Attestation inaccessible' };
            }
            return { success: true, data: ser(attestation) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const parsed = attestationSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            // Attestation de SOLDE sur une souscription héritée : aucune convention
            // liée, le solde est calculé sur le couple (client, terrain). Rôles
            // restreints (admin / manager / comptable, sans assistante de direction)
            // et solde obligatoirement à 0.
            const isLegacySolde = d.type === 'SOLDE' && !d.conventionId;
            // Sélection multiple de terrains/biens — repli sur le champ singulier
            // terrainId/propertyId pour compatibilité (anciens payloads mono-bien).
            const terrainIds = dedupeIds(d.terrainIds?.length ? d.terrainIds : (d.terrainId ? [d.terrainId] : []));
            const propertyIds = dedupeIds(d.propertyIds?.length ? d.propertyIds : (d.propertyId ? [d.propertyId] : []));
            if (isLegacySolde) {
                checkLegacySoldeRole(session);
                // Terrain(s) optionnel(s) : une souscription héritée peut n'être
                // rattachée à aucun terrain (échéances importées sans terrain).
                await assertLegacySubscriptionSettled(db, d.clientId, terrainIds);
                await assertSingleLotissement(db, terrainIds);
            }
            else {
                checkWriteRole(session, WRITE_ROLES);
                // Vérifie l'éligibilité de la convention liée (pas d'avenant /
                // résiliation, et solde = 0 pour SOLDE / TRANSFERT_PROPRIETE).
                await assertConventionEligibleForAttestation(db, d.conventionId, d.type);
                await assertSingleLotissement(db, terrainIds);
                await assertSingleProgramme(db, propertyIds);
            }
            const reference = await nextReference(db);
            const data = {
                reference,
                type: d.type,
                clientId: d.clientId,
                secondaryClientId: d.secondaryClientId,
                terrainId: terrainIds[0],
                propertyId: propertyIds[0],
                conventionId: d.conventionId,
                templateId: d.templateId,
                emittedAt: d.emittedAt ? new Date(d.emittedAt) : new Date(),
                emittedById: session.userId,
                amount: d.amount,
                prixTotalBien: d.prixTotalBien,
                notes: d.notes,
                terrains: terrainIds.length
                    ? { create: terrainIds.map((terrainId, order) => ({ terrainId, order })) }
                    : undefined,
                properties: propertyIds.length
                    ? { create: propertyIds.map((propertyId, order) => ({ propertyId, order })) }
                    : undefined,
            };
            const attestation = await db.attestation.create({ data, include: INCLUDE });
            await syncTerrainAttestationFields(db, terrainIds, d.type, reference);
            logger_1.default.info(`Attestation created: ${reference} (${d.type})`);
            return { success: true, data: ser(attestation) };
        }
        catch (error) {
            logger_1.default.error('attestations:create error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const parsed = attestationUpdateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            // Calcule les valeurs effectives après mise à jour : on charge l'existant
            // pour combler les champs non transmis dans le payload partiel.
            const existing = await db.attestation.findUnique({
                where: { id },
                select: {
                    type: true, conventionId: true, clientId: true, terrainId: true,
                    terrains: { select: { terrainId: true } },
                },
            });
            if (!existing)
                return { success: false, error: 'Attestation introuvable' };
            const effectiveType = d.type ?? existing.type;
            const effectiveConventionId = 'conventionId' in d ? d.conventionId : existing.conventionId;
            const effectiveClientId = d.clientId ?? existing.clientId;
            // Sélection multiple de terrains/biens — envoyée intégralement par le
            // formulaire à chaque enregistrement (pas de fusion delta nécessaire).
            const terrainIds = d.terrainIds != null ? dedupeIds(d.terrainIds) : undefined;
            const propertyIds = d.propertyIds != null ? dedupeIds(d.propertyIds) : undefined;
            const existingTerrainIds = existing.terrains.length
                ? existing.terrains.map((t) => t.terrainId)
                : (existing.terrainId ? [existing.terrainId] : []);
            const effectiveTerrainIds = terrainIds ?? existingTerrainIds;
            // Attestation de solde héritée (cf. handler create) : rôles restreints +
            // solde (client, terrain) à 0.
            const isLegacySolde = effectiveType === 'SOLDE' && !effectiveConventionId;
            if (isLegacySolde) {
                checkLegacySoldeRole(session);
                await assertLegacySubscriptionSettled(db, effectiveClientId, effectiveTerrainIds);
                await assertSingleLotissement(db, effectiveTerrainIds);
            }
            else {
                checkWriteRole(session, WRITE_ROLES);
                await assertConventionEligibleForAttestation(db, effectiveConventionId, effectiveType);
                await assertSingleLotissement(db, terrainIds);
                await assertSingleProgramme(db, propertyIds);
            }
            const data = { ...d };
            delete data.terrainIds;
            delete data.propertyIds;
            if (d.emittedAt)
                data.emittedAt = new Date(d.emittedAt);
            if (terrainIds) {
                data.terrainId = terrainIds[0] ?? null;
                data.terrains = { deleteMany: {}, create: terrainIds.map((terrainId, order) => ({ terrainId, order })) };
            }
            if (propertyIds) {
                data.propertyId = propertyIds[0] ?? null;
                data.properties = { deleteMany: {}, create: propertyIds.map((propertyId, order) => ({ propertyId, order })) };
            }
            const attestation = await db.attestation.update({
                where: { id },
                data,
                include: INCLUDE,
            });
            if (terrainIds)
                await syncTerrainAttestationFields(db, terrainIds, effectiveType, attestation.reference);
            return { success: true, data: ser(attestation) };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:typeStats', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.clientId)
                where.clientId = Number(filters.clientId);
            if (filters.conventionId)
                where.conventionId = Number(filters.conventionId);
            if (filters.terrainId)
                where.terrainId = Number(filters.terrainId);
            if (filters.propertyId)
                where.propertyId = Number(filters.propertyId);
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { notes: { contains: filters.search } },
                ];
            }
            // AGENT : restreint aux attestations de ses clients référents.
            Object.assign(where, agentScopeWhere(session));
            const rows = await db.attestation.groupBy({
                by: ['type'],
                where,
                _count: { _all: true },
            });
            const stats = {
                ATTRIBUTION: 0, CESSION: 0, SOLDE: 0, TRANSFERT_PROPRIETE: 0,
            };
            let total = 0;
            for (const r of rows) {
                const n = r._count?._all ?? 0;
                stats[r.type] = n;
                total += n;
            }
            return { success: true, data: { ...stats, total } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * Solde d'une souscription héritée pour le couple (client, terrain(s)). Utilisé
     * par le formulaire d'attestation de solde héritée pour afficher le reste dû et
     * n'autoriser l'émission que lorsqu'il est nul. Renvoie le total souscrit, le
     * total encaissé, le solde restant, le nombre d'échéances et un libellé de
     * souscription (détails hérités de la première échéance, si présent).
     *
     * `terrainIds` (sélection multiple) est prioritaire sur `terrainId` (compatibilité).
     */
    electron_1.ipcMain.handle('attestations:getLegacyBalance', async (_event, { token, clientId, terrainId, terrainIds }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const cId = Number(clientId);
            const tIds = Array.isArray(terrainIds) && terrainIds.length
                ? terrainIds.map(Number).filter(Boolean)
                : (Number(terrainId) ? [Number(terrainId)] : []); // vide = toutes les échéances du client
            if (!cId)
                return { success: false, error: 'Client requis' };
            const db = (0, db_service_1.getDb)();
            const clientWhere = { conventionId: null, clientId: cId, status: { not: 'ANNULE' } };
            const where = { ...clientWhere };
            if (tIds.length)
                where.OR = [{ terrainId: { in: tIds } }, { terrainLinks: { some: { terrainId: { in: tIds } } } }];
            let installments = await db.saleInstallment.findMany({
                where,
                orderBy: { installmentNumber: 'asc' },
                select: { amount: true, paidAmount: true, detailsSouscription: true },
            });
            // Repli : terrain(s) précisé(s) sans échéance rattachée → toutes les échéances du client.
            if (installments.length === 0 && tIds.length) {
                installments = await db.saleInstallment.findMany({
                    where: clientWhere,
                    orderBy: { installmentNumber: 'asc' },
                    select: { amount: true, paidAmount: true, detailsSouscription: true },
                });
            }
            const total = installments.reduce((s, i) => s + Number(i.amount), 0);
            const paid = installments.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0);
            // Solde net (peut être ≤ 0 en cas de règlement intégral ou de trop-perçu).
            const balance = Math.round((total - paid) * 100) / 100;
            const detailsSouscription = installments.find((i) => i.detailsSouscription)?.detailsSouscription ?? null;
            return ser({
                success: true,
                data: { total, paid, balance, count: installments.length, detailsSouscription },
            });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('attestations:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkWriteRole(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.attestation.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
