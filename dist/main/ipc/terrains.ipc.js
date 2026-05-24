"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTerrainsIPC = registerTerrainsIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const terrainSchema = zod_1.z.object({
    lotissementId: zod_1.z.coerce.number().int().positive('Lotissement requis'),
    programmeId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    ownerId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    clientId: zod_1.z.coerce.number().int().positive().optional().nullable(),
    numeroIlot: zod_1.z.string().optional(),
    numeroParcelle: zod_1.z.string().optional(),
    statut: zod_1.z.enum(['DISPONIBLE', 'RESERVE', 'VENDU', 'SOUS_OPTION']).default('DISPONIBLE'),
    surface: zod_1.z.coerce.number().positive().optional().nullable(),
    prixVente: zod_1.z.coerce.number().positive().optional().nullable(),
    viabilise: zod_1.z.boolean().default(false),
    numeroADU: zod_1.z.string().optional(),
    numeroAttestationAttribution: zod_1.z.string().optional(),
    numeroAttestationCession: zod_1.z.string().optional(),
    numeroDM: zod_1.z.string().optional(),
    titreFoncier: zod_1.z.string().optional(),
    numeroACD: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    latitude: zod_1.z.coerce.number().optional().nullable(),
    longitude: zod_1.z.coerce.number().optional().nullable(),
    // Frais de démarches ACD (option client).
    acdDemarchesEnabled: zod_1.z.boolean().optional(),
    acdDemarchesAmount: zod_1.z.coerce.number().nonnegative().optional().nullable(),
    acdDemarchesStartDate: zod_1.z.coerce.date().optional().nullable(),
    acdDemarchesInstallmentCount: zod_1.z.coerce.number().int().positive().optional().nullable(),
});
// Module Terrains : MANAGER+ (ACCOUNTANT inclus via checkRole) ont un accès complet.
// AGENT et READONLY peuvent consulter uniquement les terrains DISPONIBLE (lecture seule).
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];
/** Rôles disposant d'une vue globale (sans filtrage par statut). */
const FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
function hasFullView(role) {
    return FULL_VIEW_ROLES.includes(role);
}
const ser = (v) => JSON.parse(JSON.stringify(v));
/**
 * Génère la prochaine référence TER-YYYY-NNNN.
 */
async function nextReference(db) {
    const year = new Date().getFullYear();
    const last = await db.terrain.findFirst({
        where: { reference: { startsWith: `TER-${year}-` } },
        orderBy: { reference: 'desc' },
    });
    const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
    return `TER-${year}-${String(seq).padStart(4, '0')}`;
}
/**
 * Enregistre les handlers IPC pour la gestion des terrains.
 */
function registerTerrainsIPC() {
    electron_1.ipcMain.handle('terrains:list', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.lotissementId)
                where.lotissementId = Number(filters.lotissementId);
            if (filters.programmeId)
                where.programmeId = Number(filters.programmeId);
            if (filters.statut)
                where.statut = filters.statut;
            if (filters.viabilise !== undefined)
                where.viabilise = filters.viabilise;
            if (filters.clientId)
                where.clientId = Number(filters.clientId);
            // AGENT / READONLY ne voient que les terrains DISPONIBLE (statut imposé).
            if (!hasFullView(session.role))
                where.statut = 'DISPONIBLE';
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { numeroParcelle: { contains: filters.search } },
                    { numeroIlot: { contains: filters.search } },
                    { titreFoncier: { contains: filters.search } },
                    { client: { firstName: { contains: filters.search } } },
                    { client: { lastName: { contains: filters.search } } },
                    { client: { entreprise: { contains: filters.search } } },
                ];
            }
            const [data, total] = await db.$transaction([
                db.terrain.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: [{ lotissementId: 'asc' }, { numeroIlot: 'asc' }, { numeroParcelle: 'asc' }],
                    include: {
                        lotissement: { select: { id: true, reference: true, nom: true, ville: true } },
                        programme: { select: { id: true, reference: true, nom: true } },
                        client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                    },
                }),
                db.terrain.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('terrains:list error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:getById', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const terrain = await db.terrain.findUnique({
                where: { id, deletedAt: null },
                include: {
                    lotissement: true,
                    programme: true,
                    owner: true,
                    client: true,
                    documents: { orderBy: { uploadedAt: 'desc' } },
                    photos: { orderBy: { order: 'asc' } },
                    activities: { orderBy: { createdAt: 'desc' }, take: 20 },
                    conventionLinks: {
                        where: { convention: { deletedAt: null } },
                        include: {
                            convention: {
                                include: {
                                    client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                                },
                            },
                        },
                        orderBy: { convention: { createdAt: 'desc' } },
                    },
                    // Factures rattachées au terrain (typiquement les frais de démarches ACD).
                    invoices: {
                        where: { deletedAt: null },
                        orderBy: { dueDate: 'asc' },
                        include: { payments: { select: { amount: true, paidAt: true } } },
                    },
                },
            });
            if (!terrain)
                return { success: false, error: 'Terrain introuvable' };
            // AGENT / READONLY ne peuvent consulter qu'un terrain DISPONIBLE.
            if (!hasFullView(session.role) && terrain.statut !== 'DISPONIBLE') {
                return { success: false, error: 'Terrain inaccessible' };
            }
            return ser({ success: true, data: terrain });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:create', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = terrainSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const reference = await nextReference(db);
            const data = { ...parsed.data, reference };
            if (data.ownerId === null || data.ownerId === undefined)
                delete data.ownerId;
            if (data.clientId === null || data.clientId === undefined)
                delete data.clientId;
            if (data.programmeId === null || data.programmeId === undefined)
                delete data.programmeId;
            if (data.prixVente === null)
                delete data.prixVente;
            const terrain = await db.terrain.create({ data });
            logger_1.default.info(`Terrain créé: ${terrain.reference}`);
            return ser({ success: true, data: terrain });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:update', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = terrainSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const data = { ...parsed.data };
            // Règle métier : si le statut cible est RESERVE / VENDU / SOUS_OPTION,
            // un attributaire (clientId) doit être présent — soit dans le payload,
            // soit déjà rattaché au terrain.
            const targetStatut = data.statut;
            if (targetStatut && ['VENDU', 'RESERVE', 'SOUS_OPTION'].includes(targetStatut)) {
                const payloadClientId = data.clientId;
                const hasClientInPayload = payloadClientId !== undefined && payloadClientId !== null && payloadClientId !== '';
                if (!hasClientInPayload) {
                    const current = await db.terrain.findUnique({
                        where: { id },
                        select: { clientId: true },
                    });
                    if (!current?.clientId) {
                        return {
                            success: false,
                            error: 'Un attributaire doit être rattaché au terrain avant de passer en statut Réservé, Vendu ou Sous option.',
                        };
                    }
                }
            }
            // Règle métier symétrique : retour à DISPONIBLE → détacher l'attributaire.
            if (targetStatut === 'DISPONIBLE')
                data.clientId = null;
            const terrain = await db.terrain.update({ where: { id, deletedAt: null }, data });
            return ser({ success: true, data: terrain });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:updateStatut', async (_event, { token, id, statut }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            // Règle métier : un terrain ne peut être marqué RESERVE / VENDU / SOUS_OPTION
            // qu'à condition qu'un attributaire (clientId) lui soit déjà rattaché.
            if (['VENDU', 'RESERVE', 'SOUS_OPTION'].includes(statut)) {
                const current = await db.terrain.findUnique({
                    where: { id },
                    select: { clientId: true },
                });
                if (!current?.clientId) {
                    return {
                        success: false,
                        error: 'Un attributaire doit être rattaché au terrain avant de passer en statut Réservé, Vendu ou Sous option.',
                    };
                }
            }
            // Règle métier symétrique : un terrain DISPONIBLE n'a pas d'attributaire —
            // on détache automatiquement le client rattaché.
            const updateData = { statut };
            if (statut === 'DISPONIBLE')
                updateData.clientId = null;
            const terrain = await db.terrain.update({ where: { id }, data: updateData });
            return ser({ success: true, data: terrain });
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:statusStats', async (_event, { token, filters = {} }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null };
            if (filters.lotissementId)
                where.lotissementId = Number(filters.lotissementId);
            if (filters.programmeId)
                where.programmeId = Number(filters.programmeId);
            if (filters.viabilise !== undefined)
                where.viabilise = filters.viabilise;
            if (filters.clientId)
                where.clientId = Number(filters.clientId);
            if (!hasFullView(session.role))
                where.statut = 'DISPONIBLE';
            if (filters.search) {
                where.OR = [
                    { reference: { contains: filters.search } },
                    { numeroParcelle: { contains: filters.search } },
                    { numeroIlot: { contains: filters.search } },
                    { titreFoncier: { contains: filters.search } },
                    { client: { firstName: { contains: filters.search } } },
                    { client: { lastName: { contains: filters.search } } },
                    { client: { entreprise: { contains: filters.search } } },
                ];
            }
            const rows = await db.terrain.groupBy({
                by: ['statut'],
                where,
                _count: { _all: true },
            });
            const stats = {
                DISPONIBLE: 0, RESERVE: 0, VENDU: 0, SOUS_OPTION: 0,
            };
            let total = 0;
            for (const r of rows) {
                const n = r._count?._all ?? 0;
                stats[r.statut] = n;
                total += n;
            }
            return { success: true, data: { ...stats, total } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('terrains:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
            const db = (0, db_service_1.getDb)();
            await db.terrain.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── FRAIS DE DÉMARCHES ACD ──────────────────────────────────────────────
    // Génère les factures (BROUILLON, type FRAIS_DEMARCHES_ACD) selon les
    // modalités saisies sur le terrain : 1 facture si comptant, N factures
    // mensuelles à partir de acdDemarchesStartDate si échelonné. Refuse si des
    // factures non annulées existent déjà — appeler d'abord `cancelAcdInvoices`.
    electron_1.ipcMain.handle('terrains:generateAcdInvoices', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const terrain = await db.terrain.findUnique({
                where: { id, deletedAt: null },
                include: { lotissement: { select: { reference: true, nom: true } } },
            });
            if (!terrain)
                return { success: false, error: 'Terrain introuvable' };
            if (!terrain.acdDemarchesEnabled) {
                return { success: false, error: "L'option « Frais de démarches ACD » n'est pas activée sur ce terrain." };
            }
            if (!terrain.clientId) {
                return { success: false, error: "Aucun attributaire (client) n'est rattaché au terrain — impossible d'émettre les factures." };
            }
            const amount = Number(terrain.acdDemarchesAmount ?? 0);
            if (amount <= 0)
                return { success: false, error: 'Montant des frais ACD invalide.' };
            const count = terrain.acdDemarchesInstallmentCount ?? 0;
            if (count < 1)
                return { success: false, error: "Nombre d'échéances invalide." };
            if (!terrain.acdDemarchesStartDate)
                return { success: false, error: 'Date de début requise.' };
            const existing = await db.invoice.findMany({
                where: { terrainId: id, type: 'FRAIS_DEMARCHES_ACD', status: { not: 'ANNULEE' }, deletedAt: null },
                select: { id: true },
            });
            if (existing.length > 0) {
                return { success: false, error: 'Des factures ACD non annulées existent déjà. Annulez-les avant de régénérer.' };
            }
            // Réf. de facture FAC-YYYY-NNNN — utilise le compteur global existant.
            const year = new Date().getFullYear();
            const last = await db.invoice.findFirst({
                where: { reference: { startsWith: `FAC-${year}-` } },
                orderBy: { reference: 'desc' },
                select: { reference: true },
            });
            let seq = last ? parseInt(last.reference.split('-')[2], 10) : 0;
            const round2 = (n) => Math.round(n * 100) / 100;
            const perInstallment = round2(amount / count);
            // Le dernier échéancier porte le reste pour absorber les arrondis.
            const lastAmount = round2(amount - perInstallment * (count - 1));
            const created = [];
            const start = new Date(terrain.acdDemarchesStartDate);
            // Décalages des rappels CRM autour de la date d'échéance (jours avant).
            const REMINDER_OFFSETS_DAYS = [15, 7, 0];
            let activitiesCreated = 0;
            for (let i = 0; i < count; i++) {
                seq += 1;
                const reference = `FAC-${year}-${String(seq).padStart(4, '0')}`;
                const dueDate = new Date(start);
                dueDate.setMonth(dueDate.getMonth() + i);
                const itemAmount = i === count - 1 ? lastAmount : perInstallment;
                const description = count === 1
                    ? `Frais de démarches ACD — Terrain ${terrain.reference}`
                    : `Frais de démarches ACD — Terrain ${terrain.reference} — Échéance ${i + 1}/${count}`;
                const inv = await db.invoice.create({
                    data: {
                        reference,
                        type: 'FRAIS_DEMARCHES_ACD',
                        status: 'BROUILLON',
                        clientId: terrain.clientId,
                        terrainId: terrain.id,
                        subtotal: itemAmount,
                        taxRate: 0,
                        taxAmount: 0,
                        total: itemAmount,
                        issueDate: new Date(),
                        dueDate,
                        items: {
                            create: [{
                                    description,
                                    quantity: 1,
                                    unitPrice: itemAmount,
                                    total: itemAmount,
                                }],
                        },
                    },
                });
                created.push(inv);
                // Rappels CRM (J-15, J-7, J-0) — un par offset, tous liés à la même
                // facture. Ils basculent à TRAITE quand la facture est payée et à
                // ANNULE si elle est annulée (voir helper syncInvoiceActivities).
                for (const offsetDays of REMINDER_OFFSETS_DAYS) {
                    const reminderDate = new Date(dueDate);
                    reminderDate.setDate(reminderDate.getDate() - offsetDays);
                    const echeanceLabel = count > 1 ? ` (échéance ${i + 1}/${count})` : '';
                    const dueLabel = offsetDays === 0
                        ? "aujourd'hui"
                        : `dans ${offsetDays} jour${offsetDays > 1 ? 's' : ''}`;
                    await db.crmActivity.create({
                        data: {
                            type: 'RAPPEL',
                            subject: `Frais ACD — Terrain ${terrain.reference}${echeanceLabel} — Échéance ${dueLabel}`,
                            description: `Montant : ${itemAmount} FCFA — À régler avant le ${dueDate.toLocaleDateString('fr-FR')}.`,
                            status: 'EN_ATTENTE',
                            dueDate: reminderDate,
                            userId: session.userId,
                            clientId: terrain.clientId,
                            terrainId: terrain.id,
                            invoiceId: inv.id,
                        },
                    });
                    activitiesCreated += 1;
                }
            }
            logger_1.default.info(`Frais ACD : ${count} facture(s) et ${activitiesCreated} rappel(s) CRM générés pour le terrain ${terrain.reference}`);
            return ser({ success: true, data: { count: created.length, reminders: activitiesCreated } });
        }
        catch (error) {
            logger_1.default.error('terrains:generateAcdInvoices error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Annule (soft cancel) toutes les factures ACD non encore payées du terrain.
    // Les factures déjà PAYEE / PARTIEL ne sont pas touchées (encaissements actés).
    // Les rappels CRM liés aux factures annulées basculent en ANNULE.
    electron_1.ipcMain.handle('terrains:cancelAcdInvoices', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            // Récupère les ids des factures qui vont être annulées pour synchroniser
            // les rappels CRM associés en une seule passe.
            const targets = await db.invoice.findMany({
                where: {
                    terrainId: id,
                    type: 'FRAIS_DEMARCHES_ACD',
                    status: { in: ['BROUILLON', 'ENVOYEE', 'EN_RETARD'] },
                    deletedAt: null,
                },
                select: { id: true },
            });
            const targetIds = targets.map((t) => t.id);
            if (targetIds.length === 0) {
                return { success: true, data: { cancelled: 0 } };
            }
            const [invoiceResult] = await db.$transaction([
                db.invoice.updateMany({
                    where: { id: { in: targetIds } },
                    data: { status: 'ANNULEE' },
                }),
                db.crmActivity.updateMany({
                    where: { invoiceId: { in: targetIds }, status: 'EN_ATTENTE' },
                    data: { status: 'ANNULE' },
                }),
            ]);
            return { success: true, data: { cancelled: invoiceResult.count } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Met à jour la date d'échéance et/ou le montant des factures ACD d'un terrain.
    // Refuse toute modification d'une facture PAYEE ou PARTIEL. Exige que la somme
    // des factures actives (non ANNULEE) corresponde au montant ACD configuré sur
    // le terrain (acdDemarchesAmount), à 1 centime près.
    electron_1.ipcMain.handle('terrains:updateAcdInvoices', async (_event, { token, terrainId, invoices }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const updateSchema = zod_1.z.object({
                terrainId: zod_1.z.number().int().positive(),
                invoices: zod_1.z.array(zod_1.z.object({
                    id: zod_1.z.number().int().positive(),
                    dueDate: zod_1.z.string(),
                    amount: zod_1.z.number().nonnegative(),
                })).min(1),
            });
            const parsed = updateSchema.safeParse({ terrainId, invoices });
            if (!parsed.success) {
                const msg = parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ');
                return { success: false, error: msg };
            }
            const db = (0, db_service_1.getDb)();
            const terrain = await db.terrain.findUnique({
                where: { id: terrainId, deletedAt: null },
                select: { id: true, reference: true, clientId: true, acdDemarchesEnabled: true, acdDemarchesAmount: true },
            });
            if (!terrain)
                return { success: false, error: 'Terrain introuvable' };
            if (!terrain.acdDemarchesEnabled)
                return { success: false, error: "L'option « Frais de démarches ACD » n'est pas activée sur ce terrain." };
            if (!terrain.acdDemarchesAmount)
                return { success: false, error: 'Montant des frais ACD manquant.' };
            // Toutes les factures ACD non annulées du terrain (référence de comparaison)
            const existing = await db.invoice.findMany({
                where: { terrainId, type: 'FRAIS_DEMARCHES_ACD', status: { not: 'ANNULEE' }, deletedAt: null },
                orderBy: { dueDate: 'asc' },
            });
            if (existing.length === 0)
                return { success: false, error: 'Aucune facture ACD active à modifier.' };
            const updatesById = new Map();
            for (const u of parsed.data.invoices)
                updatesById.set(u.id, { dueDate: u.dueDate, amount: u.amount });
            // Valide chaque modification : appartient au terrain, modifiable (ni PAYEE ni PARTIEL)
            for (const u of parsed.data.invoices) {
                const found = existing.find((e) => e.id === u.id);
                if (!found)
                    return { success: false, error: `Facture #${u.id} introuvable pour ce terrain` };
                if (found.status === 'PAYEE' || found.status === 'PARTIEL') {
                    return { success: false, error: `La facture ${found.reference} est ${found.status === 'PAYEE' ? 'payée' : 'partiellement payée'} et ne peut pas être modifiée.` };
                }
            }
            const expectedTotal = Math.round(Number(terrain.acdDemarchesAmount) * 100) / 100;
            let newTotal = 0;
            for (const e of existing) {
                const u = updatesById.get(e.id);
                newTotal += u ? u.amount : Number(e.total);
            }
            newTotal = Math.round(newTotal * 100) / 100;
            if (Math.abs(newTotal - expectedTotal) > 0.01) {
                return {
                    success: false,
                    error: `Le total des factures (${newTotal.toFixed(2)}) ne correspond pas au montant ACD (${expectedTotal.toFixed(2)})`,
                };
            }
            // Met à jour chaque facture et son item unique (les factures ACD ont 1 item),
            // puis régénère les rappels CRM (J-15, J-7, J-0) pour les factures touchées.
            const REMINDER_OFFSETS_DAYS = [15, 7, 0];
            const updatedIds = parsed.data.invoices.map((u) => u.id);
            await db.$transaction(async (tx) => {
                for (const u of parsed.data.invoices) {
                    const due = new Date(u.dueDate);
                    await tx.invoice.update({
                        where: { id: u.id },
                        data: {
                            dueDate: due,
                            subtotal: u.amount,
                            taxAmount: 0,
                            total: u.amount,
                        },
                    });
                    await tx.invoiceItem.updateMany({
                        where: { invoiceId: u.id },
                        data: { unitPrice: u.amount, total: u.amount },
                    });
                }
                // Régénère les rappels CRM EN_ATTENTE pour les factures modifiées
                await tx.crmActivity.deleteMany({
                    where: { invoiceId: { in: updatedIds }, type: 'RAPPEL', status: 'EN_ATTENTE' },
                });
                const refreshed = await tx.invoice.findMany({
                    where: { id: { in: updatedIds } },
                    select: { id: true, total: true, dueDate: true, status: true, clientId: true, terrainId: true },
                });
                const activeRefreshed = refreshed.filter((r) => r.status !== 'PAYEE' && r.status !== 'PARTIEL');
                const totalActiveCount = existing.length;
                for (const r of activeRefreshed) {
                    const idx = existing.findIndex((e) => e.id === r.id);
                    const positionLabel = totalActiveCount > 1 ? ` (échéance ${idx + 1}/${totalActiveCount})` : '';
                    for (const offsetDays of REMINDER_OFFSETS_DAYS) {
                        const reminderDate = new Date(r.dueDate);
                        reminderDate.setDate(reminderDate.getDate() - offsetDays);
                        const dueLabel = offsetDays === 0
                            ? "aujourd'hui"
                            : `dans ${offsetDays} jour${offsetDays > 1 ? 's' : ''}`;
                        await tx.crmActivity.create({
                            data: {
                                type: 'RAPPEL',
                                subject: `Frais ACD — Terrain ${terrain.reference}${positionLabel} — Échéance ${dueLabel}`,
                                description: `Montant : ${Number(r.total)} FCFA — À régler avant le ${new Date(r.dueDate).toLocaleDateString('fr-FR')}.`,
                                status: 'EN_ATTENTE',
                                dueDate: reminderDate,
                                userId: session.userId,
                                clientId: r.clientId,
                                terrainId: r.terrainId,
                                invoiceId: r.id,
                            },
                        });
                    }
                }
            });
            const finalInvoices = await db.invoice.findMany({
                where: { terrainId, type: 'FRAIS_DEMARCHES_ACD', deletedAt: null },
                orderBy: { dueDate: 'asc' },
            });
            logger_1.default.info(`Frais ACD : ${parsed.data.invoices.length} facture(s) modifiée(s) pour le terrain ${terrain.reference}`);
            return ser({ success: true, data: finalInvoices });
        }
        catch (error) {
            logger_1.default.error('terrains:updateAcdInvoices error', error.message);
            return { success: false, error: error.message };
        }
    });
}
