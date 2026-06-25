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
    conventionId: zod_1.z.number().int().positive().optional(),
    templateId: zod_1.z.number().int().positive().optional(),
    emittedAt: zod_1.z.string().optional(),
    amount: zod_1.z.number().optional(),
    notes: zod_1.z.string().optional(),
});
const attestationSchema = attestationBaseSchema
    .refine((d) => (d.type === 'CESSION' ? !!d.secondaryClientId : true), { message: 'Une attestation de cession nécessite un cédant (client secondaire)' })
    .refine((d) => (d.type === 'CESSION' ? d.clientId !== d.secondaryClientId : true), { message: 'Le cessionnaire et le cédant doivent être deux clients différents' })
    .refine((d) => (d.type === 'CESSION' ? !!d.terrainId || !!d.propertyId : true), { message: 'Une attestation de cession nécessite un terrain ou un bien immobilier cédé' })
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
    .refine((d) => (d.type === 'CESSION' && ('terrainId' in d || 'propertyId' in d)
    ? !!d.terrainId || !!d.propertyId
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
            additionalAmount: true, apportInitial: true, paymentModalites: true,
            installments: { select: { id: true, amount: true, status: true } },
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
/**
 * Vérifie qu'une souscription héritée (échéances sans convention) est soldée pour
 * le couple (client, terrain). Le solde = somme des montants restant dus
 * (`amount − paidAmount`) sur les échéances héritées NON annulées du client
 * rattachées au terrain (via `terrainLinks` ou le champ direct `terrainId`). Il
 * doit être nul pour émettre une attestation de solde.
 *
 * Lève une `Error` lisible si aucune échéance n'existe pour ce couple ou si le
 * solde reste positif.
 */
async function assertLegacySubscriptionSettled(db, clientId, terrainId) {
    const installments = await db.saleInstallment.findMany({
        where: {
            conventionId: null,
            clientId,
            status: { not: 'ANNULE' },
            OR: [
                { terrainId },
                { terrainLinks: { some: { terrainId } } },
            ],
        },
        select: { amount: true, paidAmount: true },
    });
    if (installments.length === 0) {
        throw new Error('Aucune échéance héritée pour ce client et ce terrain : solde indéterminé');
    }
    const balance = installments.reduce((s, i) => s + Math.max(0, Number(i.amount) - Number(i.paidAmount ?? 0)), 0);
    // Tolérance d'arrondi (centimes) avant de bloquer.
    if (Math.round(balance * 100) / 100 > 0) {
        throw new Error(`Le solde de la souscription héritée doit être à 0 pour émettre cette attestation `
            + `(solde restant : ${Math.round(balance)}).`);
    }
}
/**
 * Met à jour les champs `numeroAttestationAttribution` / `numeroAttestationCession`
 * sur le terrain rattaché lorsqu'une attestation pertinente est émise.
 */
async function syncTerrainAttestationFields(db, terrainId, type, reference) {
    if (!terrainId)
        return;
    if (type === 'ATTRIBUTION') {
        await db.terrain.update({
            where: { id: terrainId },
            data: { numeroAttestationAttribution: reference },
        });
    }
    else if (type === 'CESSION') {
        await db.terrain.update({
            where: { id: terrainId },
            data: { numeroAttestationCession: reference },
        });
    }
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
            if (isLegacySolde) {
                checkLegacySoldeRole(session);
                if (!d.terrainId) {
                    return { success: false, error: 'Une attestation de solde sur une échéance héritée nécessite un terrain' };
                }
                await assertLegacySubscriptionSettled(db, d.clientId, d.terrainId);
            }
            else {
                checkWriteRole(session, WRITE_ROLES);
                // Vérifie l'éligibilité de la convention liée (pas d'avenant /
                // résiliation, et solde = 0 pour SOLDE / TRANSFERT_PROPRIETE).
                await assertConventionEligibleForAttestation(db, d.conventionId, d.type);
            }
            const reference = await nextReference(db);
            const data = {
                reference,
                type: d.type,
                clientId: d.clientId,
                secondaryClientId: d.secondaryClientId,
                terrainId: d.terrainId,
                propertyId: d.propertyId,
                conventionId: d.conventionId,
                templateId: d.templateId,
                emittedAt: d.emittedAt ? new Date(d.emittedAt) : new Date(),
                emittedById: session.userId,
                amount: d.amount,
                notes: d.notes,
            };
            const attestation = await db.attestation.create({ data, include: INCLUDE });
            await syncTerrainAttestationFields(db, d.terrainId, d.type, reference);
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
                select: { type: true, conventionId: true, clientId: true, terrainId: true },
            });
            if (!existing)
                return { success: false, error: 'Attestation introuvable' };
            const effectiveType = d.type ?? existing.type;
            const effectiveConventionId = 'conventionId' in d ? d.conventionId : existing.conventionId;
            const effectiveClientId = d.clientId ?? existing.clientId;
            const effectiveTerrainId = 'terrainId' in d ? d.terrainId : existing.terrainId;
            // Attestation de solde héritée (cf. handler create) : rôles restreints +
            // solde (client, terrain) à 0.
            const isLegacySolde = effectiveType === 'SOLDE' && !effectiveConventionId;
            if (isLegacySolde) {
                checkLegacySoldeRole(session);
                if (!effectiveTerrainId) {
                    return { success: false, error: 'Une attestation de solde sur une échéance héritée nécessite un terrain' };
                }
                await assertLegacySubscriptionSettled(db, effectiveClientId, effectiveTerrainId);
            }
            else {
                checkWriteRole(session, WRITE_ROLES);
                await assertConventionEligibleForAttestation(db, effectiveConventionId, effectiveType);
            }
            const data = { ...d };
            if (d.emittedAt)
                data.emittedAt = new Date(d.emittedAt);
            const attestation = await db.attestation.update({
                where: { id },
                data,
                include: INCLUDE,
            });
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
     * Solde d'une souscription héritée pour le couple (client, terrain). Utilisé par
     * le formulaire d'attestation de solde héritée pour afficher le reste dû et
     * n'autoriser l'émission que lorsqu'il est nul. Renvoie le total souscrit, le
     * total encaissé, le solde restant, le nombre d'échéances et un libellé de
     * souscription (détails hérités de la première échéance, si présent).
     */
    electron_1.ipcMain.handle('attestations:getLegacyBalance', async (_event, { token, clientId, terrainId }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const cId = Number(clientId);
            const tId = Number(terrainId);
            if (!cId || !tId)
                return { success: false, error: 'Client et terrain requis' };
            const db = (0, db_service_1.getDb)();
            const installments = await db.saleInstallment.findMany({
                where: {
                    conventionId: null,
                    clientId: cId,
                    status: { not: 'ANNULE' },
                    OR: [
                        { terrainId: tId },
                        { terrainLinks: { some: { terrainId: tId } } },
                    ],
                },
                orderBy: { installmentNumber: 'asc' },
                select: { amount: true, paidAmount: true, detailsSouscription: true },
            });
            const total = installments.reduce((s, i) => s + Number(i.amount), 0);
            const paid = installments.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0);
            const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
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
