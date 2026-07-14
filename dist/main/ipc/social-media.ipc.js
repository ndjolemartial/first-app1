"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocialMediaIPC = registerSocialMediaIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
// Plateformes & Tableau de bord : réservés aux MANAGER+ uniquement.
// Liste EXPLICITE contrôlée par rôle exact (`checkExactRole`, sans
// l'équivalence MANAGER de `checkRole`) : ni ACCOUNTANT, ni ASSISTANTE_DIRECTION
// n'y ont accès (ces deux rôles gardent en revanche l'accès à Publications &
// articles ; ASSISTANTE_DIRECTION garde aussi l'accès à Abonnés — cf. plus bas).
// AGENT, AGENT_TECHNIQUE, RH et READONLY n'ont aucun accès (ni lecture, ni écriture).
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Vérifie un rôle exact, sans l'équivalence ACCOUNTANT/ASSISTANTE_DIRECTION → MANAGER de `checkRole`. */
function checkExactRole(session, allowed) {
    if (!allowed.includes(session.role))
        throw new Error('Permission insuffisante');
}
// Publications & articles : ouvert à tous les rôles à l'exception de READONLY
// (contrairement aux Plateformes et au Tableau de bord, restés réservés aux MANAGER+).
const PUBLICATION_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'RH'];
// Abonnés : SUPER_ADMIN/ADMIN/MANAGER + ASSISTANTE_DIRECTION + AGENT_TECHNIQUE
// (plein accès). Liste EXPLICITE contrôlée par rôle exact (`checkExactRole`,
// sans l'équivalence MANAGER) : ACCOUNTANT n'y a PAS accès.
const SNAPSHOT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANTE_DIRECTION', 'AGENT_TECHNIQUE'];
// Lecture des plateformes : MANAGER+ voient tout ; AGENT_TECHNIQUE peut lister
// (résultat restreint aux plateformes dont il est responsable) pour alimenter
// le sélecteur de la page Abonnés. La gestion (create/update/delete) reste
// réservée à WRITE_ROLES — AGENT_TECHNIQUE ne peut pas gérer les plateformes.
const PLATFORM_READ_ROLES = [...READ_ROLES, 'AGENT_TECHNIQUE'];
// Vue complète des plateformes (pas de restriction par responsable) — liste
// indépendante de READ_ROLES pour ne pas modifier le périmètre de scoping
// existant d'ACCOUNTANT (inchangé par le retrait d'ASSISTANTE_DIRECTION ci-dessus).
const PLATFORM_FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Vrai si le rôle a une vue complète des plateformes (pas de restriction par responsable). */
function hasPlatformFullView(role) {
    return PLATFORM_FULL_VIEW_ROLES.includes(role);
}
/**
 * Fragment `where` limitant les plateformes à celles dont on est responsable,
 * ou sans responsable associé — une plateforme sans responsable reste
 * accessible à l'ensemble des utilisateurs, quel que soit leur périmètre.
 */
function platformScopeWhere(session) {
    return hasPlatformFullView(session.role)
        ? {}
        : { OR: [{ responsibleId: session.userId }, { responsibleId: null }] };
}
/** Vérifie l'accès à une plateforme donnée pour les relevés d'abonnés (sinon lève). */
async function assertPlatformAccessible(db, session, platformId) {
    if (hasPlatformFullView(session.role))
        return;
    const platform = await db.socialPlatform.findFirst({ where: { id: platformId, deletedAt: null }, select: { responsibleId: true } });
    if (!platform)
        throw new Error('Accès restreint : vous n’êtes pas responsable de cette plateforme.');
    // Une plateforme sans responsable associé reste accessible à tous.
    if (platform.responsibleId !== null && platform.responsibleId !== session.userId) {
        throw new Error('Accès restreint : vous n’êtes pas responsable de cette plateforme.');
    }
}
// Publications & articles — périmètre : SUPER_ADMIN/ADMIN/MANAGER voient et
// gèrent toutes les publications ; les autres rôles autorisés (ACCOUNTANT,
// ASSISTANTE_DIRECTION, AGENT, AGENT_TECHNIQUE, RH) ne voient/gèrent que celles
// dont ils sont l'auteur (`authorId`).
const PUBLICATION_FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
function hasPublicationFullView(role) {
    return PUBLICATION_FULL_VIEW_ROLES.includes(role);
}
/** Fragment `where` limitant les publications à celles de l'auteur (rôles restreints). */
function publicationScopeWhere(session) {
    return hasPublicationFullView(session.role) ? {} : { authorId: session.userId };
}
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);
/** Sérialise pour l'IPC : les Date Prisma ne sont pas clonables par Electron. */
const ser = (v) => JSON.parse(JSON.stringify(v));
const platformSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Nom requis'),
    type: zod_1.z.enum(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'X_TWITTER', 'YOUTUBE', 'WEBSITE', 'AUTRE']),
    url: zod_1.z.preprocess(emptyToNull, zod_1.z.string().url('URL invalide').nullable().optional()),
    responsibleId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    isActive: zod_1.z.boolean().optional(),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const publicationSchema = zod_1.z.object({
    platformId: zod_1.z.coerce.number().int().positive('Plateforme requise'),
    type: zod_1.z.enum(['PUBLICATION', 'ARTICLE']).default('PUBLICATION'),
    title: zod_1.z.string().min(1, 'Titre requis'),
    publishedAt: zod_1.z.coerce.date(),
    url: zod_1.z.preprocess(emptyToNull, zod_1.z.string().url('URL invalide').nullable().optional()),
    viewsCount: zod_1.z.coerce.number().int().min(0).default(0),
    interactionsCount: zod_1.z.coerce.number().int().min(0).default(0),
    authorId: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const snapshotSchema = zod_1.z.object({
    platformId: zod_1.z.coerce.number().int().positive('Plateforme requise'),
    date: zod_1.z.coerce.date(),
    followersCount: zod_1.z.coerce.number().int().min(0),
    recordedById: zod_1.z.preprocess(emptyToNull, zod_1.z.coerce.number().int().positive().nullable().optional()),
    notes: zod_1.z.preprocess(emptyToNull, zod_1.z.string().nullable().optional()),
});
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
/**
 * Tableau de bord du module : compteurs, courbes d'évolution (12 mois
 * glissants) des publications/vues/interactions et des abonnés, et
 * répartition par plateforme.
 */
async function buildSocialDashboard(db) {
    const now = new Date();
    const platforms = await db.socialPlatform.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
    const activeIds = platforms.filter((p) => p.isActive).map((p) => p.id);
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const pubs = await db.socialPublication.findMany({
        where: { deletedAt: null, publishedAt: { gte: trendStart } },
        select: { publishedAt: true, viewsCount: true, interactionsCount: true },
    });
    const trend = [];
    for (let i = 11; i >= 0; i--) {
        const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const items = pubs.filter((p) => p.publishedAt >= s && p.publishedAt < e);
        trend.push({
            label: `${MOIS[s.getMonth()]} ${String(s.getFullYear()).slice(2)}`,
            publications: items.length,
            views: items.reduce((a, p) => a + p.viewsCount, 0),
            interactions: items.reduce((a, p) => a + p.interactionsCount, 0),
        });
    }
    // Abonnés : dernier relevé connu à la fin de chaque mois, sommé sur les
    // plateformes actives (reconstruction d'une courbe cumulative à partir de
    // relevés ponctuels).
    const snapshots = activeIds.length
        ? await db.socialFollowerSnapshot.findMany({
            where: { platformId: { in: activeIds } },
            orderBy: { date: 'asc' },
            select: { platformId: true, date: true, followersCount: true },
        })
        : [];
    const followersTrend = [];
    for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        let total = 0;
        for (const platId of activeIds) {
            const platSnaps = snapshots.filter((s) => s.platformId === platId && s.date < monthEnd);
            if (platSnaps.length)
                total += platSnaps[platSnaps.length - 1].followersCount;
        }
        followersTrend.push({ label: `${MOIS[monthStart.getMonth()]} ${String(monthStart.getFullYear()).slice(2)}`, total });
    }
    const byPlatform = await Promise.all(platforms.map(async (p) => {
        const [pubAgg, lastSnap] = await Promise.all([
            db.socialPublication.aggregate({
                where: { deletedAt: null, platformId: p.id },
                _count: { _all: true },
                _sum: { viewsCount: true, interactionsCount: true },
            }),
            db.socialFollowerSnapshot.findFirst({ where: { platformId: p.id }, orderBy: { date: 'desc' } }),
        ]);
        return {
            id: p.id,
            name: p.name,
            type: p.type,
            isActive: p.isActive,
            publications: pubAgg._count._all,
            views: pubAgg._sum.viewsCount ?? 0,
            interactions: pubAgg._sum.interactionsCount ?? 0,
            followers: lastSnap?.followersCount ?? null,
            followersDate: lastSnap?.date ?? null,
        };
    }));
    const counters = {
        platforms: platforms.length,
        activePlatforms: activeIds.length,
        publicationsTotal: byPlatform.reduce((a, p) => a + p.publications, 0),
        viewsTotal: byPlatform.reduce((a, p) => a + p.views, 0),
        interactionsTotal: byPlatform.reduce((a, p) => a + p.interactions, 0),
        followersTotal: byPlatform.reduce((a, p) => a + (p.followers ?? 0), 0),
    };
    return { counters, trend, followersTrend, byPlatform };
}
function registerSocialMediaIPC() {
    // ── Plateformes ─────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('socialMedia:listPlatforms', async (_event, { token, includeInactive = true }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, PLATFORM_READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...platformScopeWhere(session) };
            if (!includeInactive)
                where.isActive = true;
            const platforms = await db.socialPlatform.findMany({
                where,
                orderBy: { name: 'asc' },
                include: {
                    responsible: { select: { id: true, firstName: true, lastName: true } },
                    _count: { select: { publications: { where: { deletedAt: null } } } },
                },
            });
            return ser({ success: true, data: platforms });
        }
        catch (error) {
            logger_1.default.error('socialMedia:listPlatforms', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('socialMedia:createPlatform', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const parsed = platformSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const platform = await db.socialPlatform.create({ data: parsed.data });
            logger_1.default.info(`Plateforme réseau social/web créée : ${platform.name}`);
            return ser({ success: true, data: platform });
        }
        catch (error) {
            logger_1.default.error('socialMedia:createPlatform', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('socialMedia:updatePlatform', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const parsed = platformSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const platform = await db.socialPlatform.update({ where: { id, deletedAt: null }, data: parsed.data });
            return ser({ success: true, data: platform });
        }
        catch (error) {
            logger_1.default.error('socialMedia:updatePlatform', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('socialMedia:deletePlatform', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.socialPlatform.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('socialMedia:deletePlatform', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Publications / articles ─────────────────────────────────────────────
    electron_1.ipcMain.handle('socialMedia:listPublications', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, PUBLICATION_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = { deletedAt: null, ...publicationScopeWhere(session) };
            if (filters.platformId)
                where.platformId = Number(filters.platformId);
            if (filters.type)
                where.type = filters.type;
            // Filtre explicite par auteur : réservé aux rôles en vue complète (sinon
            // le périmètre « auteur = soi-même » imposé ci-dessus prévaut).
            if (filters.authorId && hasPublicationFullView(session.role))
                where.authorId = Number(filters.authorId);
            if (filters.dateFrom || filters.dateTo) {
                where.publishedAt = {};
                if (filters.dateFrom)
                    where.publishedAt.gte = new Date(filters.dateFrom);
                if (filters.dateTo)
                    where.publishedAt.lte = new Date(filters.dateTo);
            }
            if (filters.search) {
                where.title = { contains: filters.search };
            }
            const [data, total] = await db.$transaction([
                db.socialPublication.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { publishedAt: 'desc' },
                    include: {
                        platform: { select: { id: true, name: true, type: true } },
                        author: { select: { id: true, firstName: true, lastName: true } },
                        attachments: { where: { deletedAt: null }, select: { id: true, name: true, numeroArchive: true } },
                    },
                }),
                db.socialPublication.count({ where }),
            ]);
            return ser({ success: true, data, total });
        }
        catch (error) {
            logger_1.default.error('socialMedia:listPublications', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('socialMedia:createPublication', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, PUBLICATION_ROLES);
            const parsed = publicationSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            // Rôles restreints : l'auteur est nécessairement soi-même (ignore toute
            // valeur soumise), afin de rester dans son propre périmètre.
            const data = hasPublicationFullView(session.role)
                ? parsed.data
                : { ...parsed.data, authorId: session.userId };
            const publication = await db.socialPublication.create({ data });
            logger_1.default.info(`Publication créée : ${publication.title}`);
            return ser({ success: true, data: publication });
        }
        catch (error) {
            logger_1.default.error('socialMedia:createPublication', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('socialMedia:updatePublication', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, PUBLICATION_ROLES);
            const db = (0, db_service_1.getDb)();
            if (!hasPublicationFullView(session.role)) {
                const existing = await db.socialPublication.findFirst({ where: { id, deletedAt: null }, select: { authorId: true } });
                if (!existing)
                    return { success: false, error: 'Publication introuvable' };
                if (existing.authorId !== session.userId)
                    return { success: false, error: 'Accès restreint : vous n’êtes pas l’auteur de cette publication.' };
            }
            const parsed = publicationSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            // Rôles restreints : impossible de réattribuer la publication à un autre auteur.
            const data = hasPublicationFullView(session.role)
                ? parsed.data
                : { ...parsed.data, authorId: session.userId };
            const publication = await db.socialPublication.update({ where: { id, deletedAt: null }, data });
            return ser({ success: true, data: publication });
        }
        catch (error) {
            logger_1.default.error('socialMedia:updatePublication', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('socialMedia:deletePublication', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Suppression réservée à SUPER_ADMIN/ADMIN/MANAGER — les autres rôles
            // autorisés sur le module (auteurs inclus) ne peuvent que créer/modifier.
            checkExactRole(session, PUBLICATION_FULL_VIEW_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.socialPublication.update({ where: { id }, data: { deletedAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('socialMedia:deletePublication', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Relevés d'abonnés ───────────────────────────────────────────────────
    electron_1.ipcMain.handle('socialMedia:listSnapshots', async (_event, { token, platformId, limit = 50 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, SNAPSHOT_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = {};
            if (platformId) {
                await assertPlatformAccessible(db, session, Number(platformId));
                where.platformId = Number(platformId);
            }
            else if (!hasPlatformFullView(session.role)) {
                // Aucune plateforme précisée : restreint aux plateformes dont on est
                // responsable, ou sans responsable associé (accessibles à tous).
                const myPlatforms = await db.socialPlatform.findMany({
                    where: { deletedAt: null, OR: [{ responsibleId: session.userId }, { responsibleId: null }] },
                    select: { id: true },
                });
                where.platformId = { in: myPlatforms.length ? myPlatforms.map((p) => p.id) : [-1] };
            }
            const snapshots = await db.socialFollowerSnapshot.findMany({
                where,
                orderBy: { date: 'desc' },
                take: limit,
                include: {
                    platform: { select: { id: true, name: true, type: true } },
                    recordedBy: { select: { id: true, firstName: true, lastName: true } },
                },
            });
            return ser({ success: true, data: snapshots });
        }
        catch (error) {
            logger_1.default.error('socialMedia:listSnapshots', error.message);
            return { success: false, error: error.message };
        }
    });
    // Crée ou met à jour le relevé du jour pour une plateforme (unique
    // platformId+date) : évite les doublons en cas de double saisie.
    electron_1.ipcMain.handle('socialMedia:upsertSnapshot', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, SNAPSHOT_ROLES);
            const parsed = snapshotSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            await assertPlatformAccessible(db, session, parsed.data.platformId);
            const { platformId, date, ...rest } = parsed.data;
            const snapshot = await db.socialFollowerSnapshot.upsert({
                where: { platformId_date: { platformId, date } },
                create: { platformId, date, ...rest },
                update: { ...rest },
            });
            return ser({ success: true, data: snapshot });
        }
        catch (error) {
            logger_1.default.error('socialMedia:upsertSnapshot', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('socialMedia:deleteSnapshot', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            // Suppression réservée à SUPER_ADMIN/ADMIN/MANAGER — les autres rôles
            // autorisés sur Abonnés (ASSISTANTE_DIRECTION, AGENT_TECHNIQUE) ne
            // peuvent que créer un relevé, pas en supprimer.
            checkExactRole(session, PLATFORM_FULL_VIEW_ROLES);
            const db = (0, db_service_1.getDb)();
            await db.socialFollowerSnapshot.delete({ where: { id } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('socialMedia:deleteSnapshot', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Tableau de bord ─────────────────────────────────────────────────────
    electron_1.ipcMain.handle('socialMedia:dashboard', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            checkExactRole(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const data = await buildSocialDashboard(db);
            return ser({ success: true, data });
        }
        catch (error) {
            logger_1.default.error('socialMedia:dashboard', error.message);
            return { success: false, error: error.message };
        }
    });
}
