"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommunicationIPC = registerCommunicationIPC;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const email_service_1 = require("../services/email.service");
const sms_service_1 = require("../services/sms.service");
const whatsapp_service_1 = require("../services/whatsapp.service");
const templating_service_1 = require("../services/templating.service");
const settings_service_1 = require("../services/settings.service");
const reminders_service_1 = require("../services/reminders.service");
const logger_1 = __importDefault(require("../utils/logger"));
const zod_1 = require("zod");
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
// Clé AppSetting : URL de base du pixel de suivi d'ouverture des emails.
const COMM_TRACKING_KEY = 'communication.tracking.baseUrl';
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];
// Rôles qui voient l'intégralité de l'historique de communication.
// ASSISTANTE_DIRECTION est traité comme MANAGER (équivalence centralisée dans
// auth.service). Les autres rôles (AGENT, READONLY) sont restreints à leurs
// propres envois et aux messages adressés à un client qui leur est rattaché.
const FULL_HISTORY_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
// Rôles qui peuvent cibler n'importe quel client. Les autres ne peuvent cibler
// que leurs clients référents (aligné sur `hasFullView` / clients:list). Note :
// ASSISTANTE_DIRECTION est volontairement exclue (restreinte à ses clients).
const CLIENT_FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
// Ciblage « Prospect » : mêmes règles d'accès que le ciblage Client (onglet
// visible par tous les rôles, liste restreinte côté IPC — prospects:list — et
// vérification de visibilité ci-dessous pour les rôles non privilégiés).
const PROSPECT_FULL_VIEW_ROLES = CLIENT_FULL_VIEW_ROLES;
// Rôles qui peuvent cibler n'importe quel apporteur d'affaires — mêmes règles
// d'accès que le ciblage Client (cf. CLIENT_FULL_VIEW_ROLES / REFERRERS_FULL_
// VIEW_ROLES dans commissions.ipc.ts). Les autres rôles ne peuvent cibler que
// l'apporteur dont ils sont l'utilisateur référent.
const REFERRER_FULL_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const templateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    channel: zod_1.z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
    subject: zod_1.z.string().optional(),
    body: zod_1.z.string().min(1),
    variables: zod_1.z.array(zod_1.z.string()).optional(),
    // Catégorie d'usage : AUTO (relances automatiques) ou MANUEL (envois manuels).
    usageType: zod_1.z.enum(['AUTO', 'MANUEL']).default('MANUEL'),
    isActive: zod_1.z.boolean().default(true),
});
// Rôles voyant tous les modèles (auto + manuel). Les autres ne voient que les
// modèles « manuel » dans l'envoi de message. Test de rôle exact (ASSISTANTE_DIRECTION exclue).
const TEMPLATE_FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
// Rôles disposant déjà, par eux-mêmes, d'un accès complet (lecture + écriture,
// tous types) à l'interface « Modèles de messages ». Rôle EXACT (pas de
// `checkRole`) : MANAGER (et donc ses équivalents ACCOUNTANT/ASSISTANTE_
// DIRECTION) n'y ont plus accès — seul un utilisateur individuellement
// désigné (Paramètres → Modèles de messages → « Gérer les accès ») peut
// encore y accéder, et uniquement aux modèles « manuel ».
const TEMPLATE_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
/** Vrai si `checkRole` autoriserait la session pour ces rôles, sans lever d'exception. */
function hasRole(session, roles) {
    try {
        (0, auth_service_1.checkRole)(session, roles);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Ids des utilisateurs désignés (Paramètres → Modèles de messages) autorisés,
 * en plus de SUPER_ADMIN/ADMIN/MANAGER (et équivalents), à consulter et gérer
 * les modèles de type « manuel » uniquement — jamais les modèles « auto ».
 */
async function manualTemplateEditorIds(db) {
    const raw = await (0, settings_service_1.getSetting)(settings_service_1.SettingsKeys.commTemplateManualEditorIds);
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
    }
    catch {
        return [];
    }
}
// Cibles entité optionnelles — passées par le formulaire d'envoi ciblé pour
// stamper Communication.{clientId, ownerId, conventionId}. Quand l'envoi se
// fait par cible, le `to` reste obligatoire (rempli depuis l'entité côté UI).
const targetFields = {
    clientId: zod_1.z.number().int().positive().optional(),
    ownerId: zod_1.z.number().int().positive().optional(),
    conventionId: zod_1.z.number().int().positive().optional(),
    referrerId: zod_1.z.number().int().positive().optional(),
    prospectId: zod_1.z.number().int().positive().optional(),
};
const sendEmailSchema = zod_1.z.object({
    to: zod_1.z.string().email(),
    subject: zod_1.z.string().min(1),
    body: zod_1.z.string().min(1),
    templateId: zod_1.z.number().int().positive().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    // Envoi « en tant que » l'utilisateur connecté (mode Particulier) : l'adresse
    // d'envoi et le nom d'expéditeur deviennent ceux de l'utilisateur. La
    // signature personnelle, elle, est ajoutée dès que `templateId` est absent
    // (voir plus bas), indépendamment de ce mode.
    senderSelf: zod_1.z.boolean().optional(),
    // Pièces jointes (mode Particulier) : chemins de fichiers locaux à joindre.
    attachments: zod_1.z.array(zod_1.z.object({
        path: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
    })).optional(),
    // Destinataires en copie (CC) / copie cachée (BCC) — listes séparées par , ; ou espace.
    cc: zod_1.z.string().optional(),
    bcc: zod_1.z.string().optional(),
    // Pièce jointe PDF de la convention ciblée (générée côté renderer et transmise
    // en mémoire, base64) — cf. TargetSelector, cible « Convention ».
    conventionAttachment: zod_1.z.object({
        name: zod_1.z.string().min(1),
        base64: zod_1.z.string().min(1),
    }).optional(),
    ...targetFields,
});
/** Découpe une liste d'adresses (séparateurs , ; espaces) et valide le format. */
function parseEmailList(raw) {
    const list = (raw ?? '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    const invalid = list.filter((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
    return { list, invalid };
}
/** Taille totale maximale autorisée pour les pièces jointes d'un email (25 Mo). */
const MAX_ATTACHMENTS_BYTES = 25 * 1024 * 1024;
const sendSmsSchema = zod_1.z.object({
    to: zod_1.z.string().min(8),
    body: zod_1.z.string().min(1),
    templateId: zod_1.z.number().int().positive().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    ...targetFields,
});
const sendWhatsappSchema = zod_1.z.object({
    to: zod_1.z.string().min(8),
    body: zod_1.z.string().min(1),
    templateId: zod_1.z.number().int().positive().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    ...targetFields,
});
const resolveTargetSchema = zod_1.z.object({
    entityType: zod_1.z.enum(['CLIENT', 'PROSPECT', 'REFERRER', 'OWNER', 'CONVENTION']),
    entityId: zod_1.z.number().int().positive(),
    channel: zod_1.z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
});
const CONVENTION_TYPE_LABELS = {
    RENTAL_UNFURNISHED: 'Bail non meublé',
    RENTAL_FURNISHED: 'Bail meublé',
    SALE: 'Vente',
    MANAGEMENT: 'Mandat de gestion',
    COMMERCIAL_LEASE: 'Bail commercial',
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '';
const fmtAmount = (a) => a === null || a === undefined ? '' : Number(a).toLocaleString('fr-FR');
/**
 * Variables communes à tout envoi : variables d'entreprise (paramètres),
 * agence, agent connecté et date du jour. Réutilisées pour la substitution
 * immédiate des modèles dans le formulaire d'envoi.
 */
async function buildCommonVariables(db, userId) {
    const company = await (0, templating_service_1.loadCompanyVariables)();
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
    });
    const agentName = user ? `${user.lastName ?? ''} ${user.firstName ?? ''}`.trim() : '';
    return {
        ...company,
        agencyName: company.companyName ?? '',
        agentName,
        date: new Date().toLocaleDateString('fr-FR'),
    };
}
/** Retire les balises HTML pour produire une version texte brut (alternative email). */
function htmlToPlainText(html) {
    return html
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/\s*(p|div|h[1-6]|li)\s*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
/** Variables « destinataire » à partir d'un client / propriétaire. */
function recipientVariables(rec) {
    const isCompany = rec.type && rec.type !== 'INDIVIDUEL';
    const fullName = isCompany
        ? (rec.entreprise ?? rec.companyName ?? '')
        : `${rec.lastName ?? ''} ${rec.firstName ?? ''}`.trim();
    return {
        civilite: rec.civilite ?? '',
        firstName: rec.firstName ?? '',
        lastName: rec.lastName ?? '',
        fullName,
        email: rec.email ?? '',
        phone: rec.mobile ?? rec.phone ?? '',
    };
}
// Partage de localisation GPS depuis Lotissement / Terrain / Bien vers
// Client / Prospect / Apporteur d'affaires. Le template est lu côté serveur
// (paramètre AppSetting) — il n'est pas modifiable depuis le formulaire de
// partage : l'utilisateur doit passer par Paramètres → Partage de localisation
// pour éditer le modèle. Garantit que tous les envois suivent la version
// approuvée du modèle.
const shareLocationSchema = zod_1.z.object({
    entityType: zod_1.z.enum(['LOTISSEMENT', 'TERRAIN', 'PROPERTY']),
    entityId: zod_1.z.number().int().positive(),
    recipientType: zod_1.z.enum(['CLIENT', 'PROSPECT', 'REFERRER']),
    recipientId: zod_1.z.number().int().positive(),
    channel: zod_1.z.enum(['EMAIL', 'WHATSAPP']),
});
/**
 * Charge l'entité + le destinataire, lit le template depuis Paramètres et
 * applique les substitutions de variables ({{latitude}}, {{googleMapsUrl}}…).
 * Retourne un message prêt à envoyer — sans rien envoyer ni persister.
 *
 * Centralise la logique partagée entre `communication:shareLocation` (envoi
 * réel) et `communication:previewShareLocation` (aperçu côté UI).
 */
async function buildShareLocationContext(payload) {
    const db = (0, db_service_1.getDb)();
    const d = payload;
    // 1. Entité source : fournit la référence, l'adresse et les coordonnées GPS.
    let entityVars = {};
    let entityTitle = '';
    let entityFK = {};
    if (d.entityType === 'LOTISSEMENT') {
        const lot = await db.lotissement.findUnique({
            where: { id: d.entityId },
            select: {
                id: true, reference: true, nom: true, commune: true, quartier: true, ville: true, pays: true,
                latitude: true, longitude: true, deletedAt: true,
            },
        });
        if (!lot || lot.deletedAt)
            return { success: false, error: 'Lotissement introuvable' };
        entityTitle = lot.nom;
        entityVars = {
            reference: lot.reference,
            entityTitle: lot.nom,
            entityType: 'Lotissement',
            nom: lot.nom,
            commune: lot.commune ?? '',
            quartier: lot.quartier ?? '',
            ville: lot.ville,
            pays: lot.pays ?? '',
            address: [lot.quartier, lot.commune, lot.ville, lot.pays].filter(Boolean).join(', '),
            latitude: lot.latitude != null ? String(lot.latitude) : '',
            longitude: lot.longitude != null ? String(lot.longitude) : '',
        };
    }
    else if (d.entityType === 'TERRAIN') {
        const t = await db.terrain.findUnique({
            where: { id: d.entityId },
            select: {
                id: true, reference: true, numeroIlot: true, numeroParcelle: true,
                latitude: true, longitude: true, deletedAt: true,
                lotissement: { select: { nom: true, commune: true, quartier: true, ville: true, pays: true, latitude: true, longitude: true } },
            },
        });
        if (!t || t.deletedAt)
            return { success: false, error: 'Terrain introuvable' };
        // Si le terrain n'a pas ses propres coords, on retombe sur celles du lotissement.
        const lat = t.latitude ?? t.lotissement?.latitude ?? null;
        const lng = t.longitude ?? t.lotissement?.longitude ?? null;
        const parcelle = [t.numeroIlot && `Îlot ${t.numeroIlot}`, t.numeroParcelle && `Lot ${t.numeroParcelle}`].filter(Boolean).join(' · ');
        entityTitle = [t.lotissement?.nom, parcelle].filter(Boolean).join(' — ') || t.reference;
        entityVars = {
            reference: t.reference,
            entityTitle,
            entityType: 'Terrain',
            nom: t.lotissement?.nom ?? '',
            commune: t.lotissement?.commune ?? '',
            quartier: t.lotissement?.quartier ?? '',
            ville: t.lotissement?.ville ?? '',
            pays: t.lotissement?.pays ?? '',
            address: [parcelle, t.lotissement?.quartier, t.lotissement?.commune, t.lotissement?.ville, t.lotissement?.pays].filter(Boolean).join(', '),
            latitude: lat != null ? String(lat) : '',
            longitude: lng != null ? String(lng) : '',
        };
    }
    else {
        const p = await db.property.findUnique({
            where: { id: d.entityId },
            select: {
                id: true, reference: true, type: true, address: true, addressLine2: true,
                city: true, postalCode: true, country: true, latitude: true, longitude: true, deletedAt: true,
            },
        });
        if (!p || p.deletedAt)
            return { success: false, error: 'Bien introuvable' };
        entityTitle = `${p.type} — ${p.address}`;
        entityFK = { propertyId: p.id };
        entityVars = {
            reference: p.reference,
            entityTitle,
            entityType: 'Bien',
            nom: '',
            commune: '',
            quartier: '',
            ville: p.city,
            pays: p.country ?? '',
            address: [p.address, p.addressLine2, p.postalCode, p.city, p.country].filter(Boolean).join(', '),
            latitude: p.latitude != null ? String(p.latitude) : '',
            longitude: p.longitude != null ? String(p.longitude) : '',
        };
    }
    if (!entityVars.latitude || !entityVars.longitude) {
        return { success: false, error: "Aucune coordonnée GPS renseignée sur l'entité — partage impossible." };
    }
    // 2. Destinataire — Client / Prospect / Apporteur.
    const pickRecipient = (rec) => {
        if (d.channel === 'EMAIL')
            return rec.email?.trim() || null;
        return (rec.mobile?.trim() || rec.phone?.trim()) || null;
    };
    let to = null;
    let recipientName = '';
    let recipientFirstName = '';
    let recipientLastName = '';
    let recipientFK = {};
    if (d.recipientType === 'CLIENT') {
        const c = await db.client.findUnique({
            where: { id: d.recipientId },
            select: { id: true, firstName: true, lastName: true, entreprise: true, type: true, email: true, phone: true, mobile: true, deletedAt: true },
        });
        if (!c || c.deletedAt)
            return { success: false, error: 'Client introuvable' };
        to = pickRecipient(c);
        recipientFirstName = c.firstName ?? '';
        recipientLastName = c.lastName ?? '';
        recipientName = c.type !== 'INDIVIDUEL'
            ? (c.entreprise ?? `Client #${c.id}`)
            : `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim();
        recipientFK = { clientId: c.id };
    }
    else if (d.recipientType === 'PROSPECT') {
        const p = await db.prospect.findUnique({
            where: { id: d.recipientId },
            select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, deletedAt: true },
        });
        if (!p || p.deletedAt)
            return { success: false, error: 'Prospect introuvable' };
        to = pickRecipient(p);
        recipientFirstName = p.firstName ?? '';
        recipientLastName = p.lastName ?? '';
        recipientName = `${p.lastName ?? ''} ${p.firstName ?? ''}`.trim();
    }
    else {
        const r = await db.businessReferrer.findUnique({
            where: { id: d.recipientId },
            select: { id: true, firstName: true, lastName: true, companyName: true, email: true, phone: true, mobile: true, deletedAt: true },
        });
        if (!r || r.deletedAt)
            return { success: false, error: "Apporteur d'affaires introuvable" };
        to = pickRecipient(r);
        recipientFirstName = r.firstName;
        recipientLastName = r.lastName;
        recipientName = r.companyName ?? `${r.lastName} ${r.firstName}`.trim();
    }
    if (!to) {
        return {
            success: false,
            error: `Le destinataire n'a pas de ${d.channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné`,
        };
    }
    // 3. Template depuis Paramètres (non éditable côté UI de partage).
    const settingsMap = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.shareLocationEmailSubject,
        settings_service_1.SettingsKeys.shareLocationEmailBody,
        settings_service_1.SettingsKeys.shareLocationWhatsappBody,
    ]);
    let templateSubject;
    let templateBody;
    if (d.channel === 'EMAIL') {
        templateSubject = settingsMap[settings_service_1.SettingsKeys.shareLocationEmailSubject] ?? 'Localisation — {{entityTitle}}';
        templateBody = settingsMap[settings_service_1.SettingsKeys.shareLocationEmailBody] ?? '{{entityTitle}} ({{reference}})\nGPS : {{latitude}}, {{longitude}}\n{{googleMapsUrl}}';
    }
    else {
        templateBody = settingsMap[settings_service_1.SettingsKeys.shareLocationWhatsappBody] ?? '{{entityTitle}} ({{reference}})\nGPS : {{latitude}}, {{longitude}}\n{{googleMapsUrl}}';
    }
    // 4. URLs cartographiques (le `/search/…` Google Earth pose une épingle rouge).
    const lat = entityVars.latitude;
    const lng = entityVars.longitude;
    const locationVars = {
        ...entityVars,
        recipientName,
        recipientFirstName,
        recipientLastName,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        googleEarthUrl: `https://earth.google.com/web/search/${lat},${lng}/@${lat},${lng},150a,1000d,35y,0h,0t,0r`,
        osmUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
    };
    const rendered = await (0, templating_service_1.renderMessage)({ subject: templateSubject, body: templateBody }, locationVars);
    return {
        success: true,
        data: {
            to,
            finalSubject: rendered.subject ?? templateSubject ?? '',
            finalBody: rendered.body,
            entityTitle,
            entityFK,
            recipientFK,
        },
    };
}
function registerCommunicationIPC() {
    // ── Templates ──────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('communication:listTemplates', async (_event, { token, channel }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            if (!hasRole(session, READ_ROLES)) {
                const editorIds = await manualTemplateEditorIds(db);
                if (!editorIds.includes(session.userId))
                    (0, auth_service_1.checkRole)(session, READ_ROLES);
            }
            const where = {};
            if (channel)
                where.channel = channel;
            // Les rôles non privilégiés (et les utilisateurs désignés sans rôle
            // privilégié) ne voient que les modèles « manuel ».
            if (!TEMPLATE_FULL_ACCESS_ROLES.includes(session.role))
                where.usageType = 'MANUEL';
            const data = await db.commTemplate.findMany({
                where,
                orderBy: { name: 'asc' },
            });
            return { success: true, data };
        }
        catch (error) {
            logger_1.default.error('communication:listTemplates error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:getTemplate', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const isPrivileged = hasRole(session, READ_ROLES);
            if (!isPrivileged) {
                const editorIds = await manualTemplateEditorIds(db);
                if (!editorIds.includes(session.userId))
                    (0, auth_service_1.checkRole)(session, READ_ROLES);
            }
            const template = await db.commTemplate.findUnique({ where: { id } });
            if (!template)
                return { success: false, error: 'Template introuvable' };
            if (!isPrivileged && template.usageType !== 'MANUEL') {
                return { success: false, error: 'Permission insuffisante' };
            }
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:createTemplate', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const isPrivileged = hasRole(session, TEMPLATE_ADMIN_ROLES);
            if (!isPrivileged) {
                const editorIds = await manualTemplateEditorIds(db);
                if (!editorIds.includes(session.userId))
                    (0, auth_service_1.checkRole)(session, TEMPLATE_ADMIN_ROLES);
            }
            const parsed = templateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            // Utilisateur désigné (sans rôle privilégié) : ne peut créer que des
            // modèles de type « manuel », quoi que le formulaire indique.
            const usageType = isPrivileged ? d.usageType : 'MANUEL';
            const template = await db.commTemplate.create({
                data: {
                    name: d.name,
                    channel: d.channel,
                    subject: d.subject,
                    body: d.body,
                    variables: d.variables ? d.variables : undefined,
                    usageType,
                    isActive: d.isActive,
                },
            });
            logger_1.default.info(`CommTemplate created: ${template.name}`);
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:updateTemplate', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const isPrivileged = hasRole(session, TEMPLATE_ADMIN_ROLES);
            if (!isPrivileged) {
                const editorIds = await manualTemplateEditorIds(db);
                if (!editorIds.includes(session.userId))
                    (0, auth_service_1.checkRole)(session, TEMPLATE_ADMIN_ROLES);
                const existing = await db.commTemplate.findUnique({ where: { id }, select: { usageType: true } });
                if (!existing)
                    return { success: false, error: 'Modèle introuvable' };
                if (existing.usageType !== 'MANUEL') {
                    return { success: false, error: 'Seuls les modèles de type manuel sont modifiables.' };
                }
            }
            const parsed = templateSchema.partial().safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const d = parsed.data;
            if (d.variables !== undefined)
                d.variables = d.variables;
            // Ne peut pas faire passer un modèle en type « auto ».
            if (!isPrivileged)
                d.usageType = 'MANUEL';
            const template = await db.commTemplate.update({ where: { id }, data: d });
            return { success: true, data: template };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * Indique à l'utilisateur connecté s'il peut gérer les modèles de type
     * « manuel » (consultation/création/modification) — utilisé côté renderer
     * pour afficher (ou non) l'onglet « Modèles de messages » et ses actions.
     * `isPrivileged` = accès complet (auto + manuel) via le rôle.
     */
    electron_1.ipcMain.handle('communication:myTemplatePermissions', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const db = (0, db_service_1.getDb)();
            const isPrivileged = hasRole(session, TEMPLATE_ADMIN_ROLES);
            let canManageManual = isPrivileged;
            if (!canManageManual) {
                const editorIds = await manualTemplateEditorIds(db);
                canManageManual = editorIds.includes(session.userId);
            }
            return { success: true, data: { canManageManual, isPrivileged } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:deleteTemplate', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const db = (0, db_service_1.getDb)();
            const template = await db.commTemplate.delete({ where: { id } });
            // Empêche le seed de démarrage (seedDefaultRemindersConfig, exécuté à
            // chaque lancement de l'app) de recréer ce modèle s'il s'agit de l'un
            // des templates par défaut de la politique de relance (marqueur
            // « [Politique] … ») — sans quoi une suppression ne resterait
            // effective que jusqu'au prochain redémarrage. Sans effet sur un
            // modèle créé manuellement (jamais reseedé de toute façon).
            await (0, reminders_service_1.markTemplateNameDeleted)(template.name);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Historique des communications ──────────────────────────────────────────
    electron_1.ipcMain.handle('communication:getHistory', async (_event, { token, filters = {}, page = 1, limit = 20 }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const where = {};
            if (filters.channel)
                where.channel = filters.channel;
            if (filters.status)
                where.status = filters.status;
            if (filters.direction)
                where.direction = filters.direction;
            if (filters.search) {
                const q = filters.search;
                where.OR = [
                    { to: { contains: q } },
                    { subject: { contains: q } },
                    { body: { contains: q } },
                    // Nom/prénom/email du destinataire ou de l'expéditeur — recherché à
                    // travers toutes les entités qu'une Communication peut rattacher,
                    // quel que soit le sens (SORTANT: le contact est le destinataire ;
                    // ENTRANT: le contact est l'expéditeur). `sender` couvre le
                    // collaborateur ayant déclenché un envoi manuel.
                    { client: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { entreprise: { contains: q } }, { email: { contains: q } }] } },
                    { prospect: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] } },
                    { owner: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { companyName: { contains: q } }, { email: { contains: q } }] } },
                    { referrer: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { companyName: { contains: q } }, { email: { contains: q } }] } },
                    { sender: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] } },
                ];
            }
            // Visibilité restreinte pour les rôles non privilégiés : ne montrer
            // que les messages envoyés par l'utilisateur lui-même OU adressés à
            // un client qui lui est rattaché (Client.assignedToId) OU à un
            // apporteur d'affaires dont il est l'utilisateur référent (mêmes
            // règles d'accès que le ciblage Client) — même règle pour les messages
            // reçus, SAUF exception : un message reçu où l'adresse de l'utilisateur
            // figure en copie/copie cachée (Communication.ccAddresses, capturé par
            // mailbox-poller.service.ts) reste visible même sans droit sur l'entité
            // rattachée, puisqu'il en est un destinataire réel.
            if (!FULL_HISTORY_ROLES.includes(session.role)) {
                const me = await db.user.findUnique({ where: { id: session.userId }, select: { email: true } });
                const ccToken = me?.email ? `|${me.email.toLowerCase()}|` : null;
                where.AND = [
                    ...(where.AND ?? []),
                    {
                        OR: [
                            { senderId: session.userId },
                            { client: { assignedToId: session.userId } },
                            { referrer: { assignedToId: session.userId } },
                            ...(ccToken ? [{ ccAddresses: { contains: ccToken } }] : []),
                        ],
                    },
                ];
            }
            // Filtre optionnel « Mes messages » (SUPER_ADMIN/ADMIN/MANAGER, en vue
            // complète par défaut) : ne montrer que les messages qui LE concernent
            // personnellement — envoyés par lui (senderId), reçus dans sa propre
            // boîte personnelle (MailAccount.userId — cf. « Ma boîte email
            // personnelle », Mon profil ; la boîte système partagée des relances,
            // MailAccount.userId = null, n'est jamais « la boîte de » quelqu'un en
            // particulier), adressés ou mis en copie/copie cachée à son adresse de
            // profil (Communication.to / ccAddresses), ou rattachés à un client ou
            // un prospect dont il est le référent (Client/Prospect.assignedToId).
            if (filters.onlyMine) {
                const [myMailAccounts, me] = await Promise.all([
                    db.mailAccount.findMany({ where: { userId: session.userId }, select: { id: true } }),
                    db.user.findUnique({ where: { id: session.userId }, select: { email: true } }),
                ]);
                const myMailAccountIds = myMailAccounts.map((a) => a.id);
                const ccToken = me?.email ? `|${me.email.toLowerCase()}|` : null;
                where.AND = [
                    ...(where.AND ?? []),
                    {
                        OR: [
                            { senderId: session.userId },
                            ...(myMailAccountIds.length ? [{ mailAccountId: { in: myMailAccountIds } }] : []),
                            ...(me?.email ? [{ to: { equals: me.email } }] : []),
                            ...(ccToken ? [{ ccAddresses: { contains: ccToken } }] : []),
                            { client: { assignedToId: session.userId } },
                            { prospect: { assignedToId: session.userId } },
                        ],
                    },
                ];
            }
            const [data, total] = await db.$transaction([
                db.communication.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        template: { select: { id: true, name: true } },
                        // Identité de l'expéditeur (SORTANT manuel) et de la boîte de
                        // réception (ENTRANT) — affichées dans l'aperçu du message.
                        sender: { select: { id: true, firstName: true, lastName: true, email: true } },
                        mailAccount: { select: { id: true, imapUser: true, label: true } },
                    },
                }),
                db.communication.count({ where }),
            ]);
            return { success: true, data, total };
        }
        catch (error) {
            logger_1.default.error('communication:getHistory error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Marque un message ENTRANT comme lu (première consultation de son aperçu
    // depuis l'historique) — idempotent, ne touche `readAt` que s'il est encore
    // null. Sans effet sur un message SORTANT (déjà « lu » par construction).
    electron_1.ipcMain.handle('communication:markRead', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const comm = await db.communication.findUnique({ where: { id: Number(id) }, select: { direction: true, readAt: true } });
            if (!comm)
                return { success: false, error: 'Message introuvable' };
            if (comm.direction !== 'ENTRANT' || comm.readAt)
                return { success: true };
            await db.communication.update({ where: { id: Number(id) }, data: { readAt: new Date() } });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('communication:markRead error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Rattachement manuel d'une réponse entrante non appariée automatiquement
    // (en-têtes de thread perdus, ou absence de correspondance par adresse
    // connue — cf. mailbox-poller.service.ts). Un seul des 4 champs à la fois.
    const linkInboundSchema = zod_1.z.object({
        clientId: zod_1.z.number().int().positive().optional(),
        prospectId: zod_1.z.number().int().positive().optional(),
        ownerId: zod_1.z.number().int().positive().optional(),
        conventionId: zod_1.z.number().int().positive().optional(),
    });
    electron_1.ipcMain.handle('communication:linkInbound', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = linkInboundSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            if (Object.keys(parsed.data).length !== 1) {
                return { success: false, error: 'Sélectionnez une seule entité à rattacher.' };
            }
            const comm = await (0, db_service_1.getDb)().communication.findUnique({ where: { id: Number(id) } });
            if (!comm)
                return { success: false, error: 'Message introuvable' };
            if (comm.direction !== 'ENTRANT')
                return { success: false, error: 'Seul un message reçu peut être rattaché.' };
            const updated = await (0, db_service_1.getDb)().communication.update({
                where: { id: comm.id },
                data: { clientId: null, prospectId: null, ownerId: null, conventionId: null, ...parsed.data },
            });
            return { success: true, data: updated };
        }
        catch (error) {
            logger_1.default.error('communication:linkInbound error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Configuration du suivi d'ouverture des emails (URL de base du pixel).
    electron_1.ipcMain.handle('communication:getTracking', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const baseUrl = (await (0, settings_service_1.getSetting)(COMM_TRACKING_KEY)) ?? '';
            return { success: true, data: { baseUrl } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:updateTracking', async (_event, { token, baseUrl }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, ['SUPER_ADMIN', 'ADMIN']);
            const url = String(baseUrl ?? '').trim();
            if (url && !/^https?:\/\//i.test(url)) {
                return { success: false, error: "L'URL de suivi doit commencer par http:// ou https://" };
            }
            await (0, settings_service_1.setSetting)(COMM_TRACKING_KEY, url);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ── Envoi Email ────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('communication:sendEmail', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = sendEmailSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(' ; ') };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            // Envoi « en tant que » l'utilisateur connecté (mode Particulier) :
            // adresse + nom d'expéditeur de l'utilisateur.
            let fromOverride = {};
            let bodyWithSignature = d.body;
            let personalSignatureHtml = false;
            // Signature personnelle : ajoutée à tout envoi sans modèle, ainsi qu'aux
            // envois basés sur un modèle de type « manuel » (CommTemplate.usageType
            // = MANUEL) — quelle que soit l'entité ciblée (Particulier ou non). Seuls
            // les modèles de type « auto » (utilisés aussi par les relances,
            // reminders.service.ts, non concerné par ce handler) conservent le
            // comportement existant (signature SMTP via le jeton {{signature}}).
            const template = d.templateId
                ? await db.commTemplate.findUnique({ where: { id: d.templateId }, select: { usageType: true } })
                : null;
            const usePersonalSignature = !d.templateId || template?.usageType === 'MANUEL';
            const needsUserInfo = d.senderSelf || usePersonalSignature;
            if (needsUserInfo) {
                const me = await db.user.findUnique({
                    where: { id: session.userId },
                    select: {
                        firstName: true, lastName: true, email: true, nomCommercial: true,
                        messageSignature: true,
                    },
                });
                if (me) {
                    if (d.senderSelf) {
                        const senderName = (me.nomCommercial || `${me.lastName ?? ''} ${me.firstName ?? ''}`.trim()) || undefined;
                        fromOverride = { fromName: senderName, fromAddress: me.email };
                    }
                    if (usePersonalSignature) {
                        // Signature HTML personnelle.
                        const sigHtml = (me.messageSignature ?? '').trim();
                        if (sigHtml) {
                            // Le corps (provenant de l'éditeur riche) est déjà du HTML : on
                            // assemble corps + signature en HTML et on enverra en HTML.
                            bodyWithSignature = `${d.body}<br><br>${sigHtml}`;
                            personalSignatureHtml = true;
                        }
                    }
                }
            }
            // Destinataires en copie (CC) / copie cachée (BCC).
            const cc = parseEmailList(d.cc);
            const bcc = parseEmailList(d.bcc);
            const badAddrs = [...cc.invalid, ...bcc.invalid];
            if (badAddrs.length) {
                return { success: false, error: `Adresse(s) invalide(s) en copie : ${badAddrs.join(', ')}` };
            }
            // Pièces jointes (mode Particulier) : valide l'existence et la taille totale
            // (≤ 25 Mo), puis prépare les attachements Nodemailer (lecture par chemin).
            let mailAttachments;
            if (d.attachments && d.attachments.length) {
                let totalBytes = 0;
                for (const att of d.attachments) {
                    let stat;
                    try {
                        stat = fs_1.default.statSync(att.path);
                    }
                    catch {
                        // Fichier absent, lecteur réseau déconnecté, permission refusée,
                        // ou fichier cloud (OneDrive…) non encore téléchargé sur le poste.
                        return { success: false, error: `Pièce jointe introuvable ou inaccessible : ${att.name}` };
                    }
                    if (!stat.isFile() || stat.size === 0) {
                        return { success: false, error: `Pièce jointe illisible ou vide : ${att.name}` };
                    }
                    totalBytes += stat.size;
                }
                if (totalBytes > MAX_ATTACHMENTS_BYTES) {
                    return { success: false, error: 'Pièces jointes : taille totale supérieure à 25 Mo.' };
                }
                mailAttachments = d.attachments.map((att) => ({
                    filename: att.name || path_1.default.basename(att.path),
                    path: att.path,
                }));
            }
            // PDF de la convention ciblée (cible « Convention », généré côté
            // renderer via documentExport.renderDocumentPdf puis transmis en base64) :
            // ajouté aux pièces jointes existantes, quel que soit le mode d'envoi.
            if (d.conventionAttachment) {
                const buffer = Buffer.from(d.conventionAttachment.base64, 'base64');
                if (buffer.length > 0) {
                    mailAttachments = [
                        ...(mailAttachments ?? []),
                        { filename: d.conventionAttachment.name, content: buffer },
                    ];
                }
            }
            // Résout les variables d'entreprise ({{companyName}}, {{companyPhoneFixed}}, …)
            // côté serveur — les valeurs ne transitent pas par le renderer.
            const rendered = await (0, templating_service_1.renderMessage)({ subject: d.subject, body: bodyWithSignature }, d.metadata ?? {});
            const finalSubject = rendered.subject ?? d.subject;
            const finalBody = rendered.body;
            // Corps historisé : quand une signature personnelle HTML est ajoutée, le
            // corps peut devenir volumineux (logo éventuel…) → on stocke une version
            // texte pour rester sous la limite de la colonne et garder l'historique lisible.
            const storedBody = personalSignatureHtml ? htmlToPlainText(finalBody) : finalBody;
            const comm = await db.communication.create({
                data: {
                    channel: 'EMAIL',
                    direction: 'SORTANT',
                    to: d.to,
                    subject: finalSubject,
                    body: storedBody,
                    status: 'EN_ATTENTE',
                    templateId: d.templateId ?? null,
                    senderId: session.userId,
                    clientId: d.clientId ?? null,
                    ownerId: d.ownerId ?? null,
                    conventionId: d.conventionId ?? null,
                    referrerId: d.referrerId ?? null,
                    prospectId: d.prospectId ?? null,
                    metadata: d.metadata ? d.metadata : undefined,
                },
            });
            // Pixel de suivi d'ouverture : injecté si une URL de suivi est configurée.
            const trackBase = (await (0, settings_service_1.getSetting)(COMM_TRACKING_KEY))?.trim() || '';
            const trackingPixelUrl = trackBase
                ? `${trackBase}${trackBase.includes('?') ? '&' : '?'}c=${comm.id}`
                : undefined;
            // Envoi via Nodemailer (SMTP) — paramétré côté AppSetting.
            try {
                const info = await (0, email_service_1.sendEmail)({
                    to: d.to,
                    subject: finalSubject,
                    body: storedBody,
                    // Signature HTML : on fournit explicitement le HTML (corps + signature)
                    // pour un rendu fidèle, sinon comportement par défaut.
                    ...(personalSignatureHtml ? { html: finalBody } : {}),
                    ...(mailAttachments ? { attachments: mailAttachments } : {}),
                    ...(cc.list.length ? { cc: cc.list } : {}),
                    ...(bcc.list.length ? { bcc: bcc.list } : {}),
                    ...(trackingPixelUrl ? { trackingPixelUrl } : {}),
                    ...fromOverride,
                });
                // « Remis » : le serveur SMTP a accepté le destinataire principal.
                const delivered = info.accepted.some((a) => a.toLowerCase() === d.to.toLowerCase());
                // Message-ID persisté — permet à une réponse entrante de retrouver cet
                // échange via In-Reply-To/References (cf. mailbox-poller.service.ts).
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ENVOYE', sentAt: new Date(), deliveredAt: delivered ? new Date() : null, messageId: info.messageId },
                });
                logger_1.default.info(`Email sent to ${d.to}`);
                return { success: true, data: { ...comm, status: 'ENVOYE' } };
            }
            catch (sendErr) {
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ECHEC', errorMsg: sendErr.message },
                });
                return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
            }
        }
        catch (error) {
            logger_1.default.error('communication:sendEmail error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Envoi SMS ──────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('communication:sendSms', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = sendSmsSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            // Résout les variables d'entreprise dans le corps avant transmission.
            const rendered = await (0, templating_service_1.renderMessage)({ body: d.body }, d.metadata ?? {});
            const finalBody = rendered.body;
            const comm = await db.communication.create({
                data: {
                    channel: 'SMS',
                    direction: 'SORTANT',
                    to: d.to,
                    body: finalBody,
                    status: 'EN_ATTENTE',
                    templateId: d.templateId ?? null,
                    senderId: session.userId,
                    clientId: d.clientId ?? null,
                    ownerId: d.ownerId ?? null,
                    conventionId: d.conventionId ?? null,
                    referrerId: d.referrerId ?? null,
                    prospectId: d.prospectId ?? null,
                    metadata: d.metadata ? d.metadata : undefined,
                },
            });
            // Envoi via le fournisseur SMS paramétré (Twilio / OVH / Brevo).
            try {
                await (0, sms_service_1.sendSms)(d.to, finalBody);
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ENVOYE', sentAt: new Date() },
                });
                logger_1.default.info(`SMS sent to ${d.to}`);
                return { success: true, data: { ...comm, status: 'ENVOYE' } };
            }
            catch (sendErr) {
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ECHEC', errorMsg: sendErr.message },
                });
                return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
            }
        }
        catch (error) {
            logger_1.default.error('communication:sendSms error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Envoi WhatsApp ─────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('communication:sendWhatsapp', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = sendWhatsappSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const rendered = await (0, templating_service_1.renderMessage)({ body: d.body }, d.metadata ?? {});
            const finalBody = rendered.body;
            const comm = await db.communication.create({
                data: {
                    channel: 'WHATSAPP',
                    direction: 'SORTANT',
                    to: d.to,
                    body: finalBody,
                    status: 'EN_ATTENTE',
                    templateId: d.templateId ?? null,
                    senderId: session.userId,
                    clientId: d.clientId ?? null,
                    ownerId: d.ownerId ?? null,
                    conventionId: d.conventionId ?? null,
                    referrerId: d.referrerId ?? null,
                    prospectId: d.prospectId ?? null,
                    metadata: d.metadata ? d.metadata : undefined,
                },
            });
            try {
                await (0, whatsapp_service_1.sendWhatsapp)(d.to, finalBody);
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ENVOYE', sentAt: new Date() },
                });
                logger_1.default.info(`WhatsApp sent to ${d.to}`);
                return { success: true, data: { ...comm, status: 'ENVOYE' } };
            }
            catch (sendErr) {
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ECHEC', errorMsg: sendErr.message },
                });
                return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
            }
        }
        catch (error) {
            logger_1.default.error('communication:sendWhatsapp error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Renvoi d'un message en échec ────────────────────────────────────────────
    // Réessaie l'envoi d'une Communication existante dont le statut est ECHEC.
    // Met à jour la même ligne (statut + sentAt + errorMsg) — pas de doublon dans
    // l'historique, et le dedupeKey éventuel (relance automatique) est préservé.
    electron_1.ipcMain.handle('communication:resend', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const comm = await db.communication.findUnique({ where: { id } });
            if (!comm)
                return { success: false, error: 'Message introuvable' };
            if (comm.status !== 'ECHEC') {
                return { success: false, error: 'Seuls les messages en échec peuvent être renvoyés' };
            }
            // Statut intermédiaire pour refléter la tentative en cours dans l'UI.
            await db.communication.update({
                where: { id: comm.id },
                data: { status: 'EN_ATTENTE', errorMsg: null },
            });
            try {
                let messageId;
                if (comm.channel === 'EMAIL') {
                    const info = await (0, email_service_1.sendEmail)({ to: comm.to, subject: comm.subject ?? '', body: comm.body });
                    messageId = info.messageId;
                }
                else if (comm.channel === 'SMS') {
                    await (0, sms_service_1.sendSms)(comm.to, comm.body);
                }
                else if (comm.channel === 'WHATSAPP') {
                    await (0, whatsapp_service_1.sendWhatsapp)(comm.to, comm.body);
                }
                else {
                    throw new Error(`Canal non supporté : ${comm.channel}`);
                }
                const updated = await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ENVOYE', sentAt: new Date(), errorMsg: null, ...(messageId ? { messageId } : {}) },
                });
                logger_1.default.info(`Communication ${comm.id} renvoyée avec succès (${comm.channel} → ${comm.to})`);
                return { success: true, data: updated };
            }
            catch (sendErr) {
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ECHEC', errorMsg: sendErr.message },
                });
                return { success: false, error: `Renvoi échoué : ${sendErr.message}` };
            }
        }
        catch (error) {
            logger_1.default.error('communication:resend error', error.message);
            return { success: false, error: error.message };
        }
    });
    // Suppression d'un message en échec uniquement (les envois réussis sont conservés).
    electron_1.ipcMain.handle('communication:delete', async (_event, { token, id }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const db = (0, db_service_1.getDb)();
            const comm = await db.communication.findUnique({ where: { id } });
            if (!comm)
                return { success: false, error: 'Message introuvable' };
            if (comm.status !== 'ECHEC') {
                return { success: false, error: "Seuls les messages dont l'envoi a échoué peuvent être supprimés" };
            }
            await db.communication.delete({ where: { id } });
            logger_1.default.info(`Communication ${id} supprimée (échec, ${comm.channel} → ${comm.to})`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('communication:delete error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Résolution d'une cible (Client / Owner / Convention) ────────────────────
    // Retourne le destinataire à utiliser pour un canal donné et les FK à stamper
    // sur Communication. Le destinataire est calculé côté serveur pour garantir
    // que clientId/ownerId/conventionId restent cohérents avec la chaîne `to`.
    electron_1.ipcMain.handle('communication:resolveTarget', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const parsed = resolveTargetSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const { entityType, entityId, channel } = parsed.data;
            // Variables communes (entreprise / agence / agent / date) résolues une fois.
            const commonVars = await buildCommonVariables(db, session.userId);
            // Sélectionne la propriété adresse selon le canal.
            // EMAIL → email ; SMS/WHATSAPP → mobile puis phone en repli.
            const pickRecipient = (rec) => {
                if (channel === 'EMAIL')
                    return rec.email?.trim() || null;
                return (rec.mobile?.trim() || rec.phone?.trim()) || null;
            };
            if (entityType === 'CLIENT') {
                const c = await db.client.findUnique({
                    where: { id: entityId },
                    select: { id: true, civilite: true, firstName: true, lastName: true, entreprise: true, type: true, email: true, phone: true, mobile: true, deletedAt: true, assignedToId: true, prospect: { select: { assignedToId: true } } },
                });
                if (!c || c.deletedAt)
                    return { success: false, error: 'Client introuvable' };
                // Visibilité restreinte : hors rôles à vue complète, on ne peut cibler
                // qu'un client dont on est l'utilisateur référent (ou issu d'un prospect affecté).
                if (!CLIENT_FULL_VIEW_ROLES.includes(session.role)) {
                    const visible = c.assignedToId === session.userId || c.prospect?.assignedToId === session.userId;
                    if (!visible)
                        return { success: false, error: 'Client inaccessible' };
                }
                const to = pickRecipient(c);
                if (!to)
                    return { success: false, error: `Le client n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
                const label = c.type !== 'INDIVIDUEL' ? (c.entreprise ?? `Client #${c.id}`) : `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
                const variables = { ...commonVars, ...recipientVariables(c) };
                return { success: true, data: { to, label, targets: { clientId: c.id }, variables } };
            }
            if (entityType === 'PROSPECT') {
                const p = await db.prospect.findUnique({
                    where: { id: entityId },
                    select: { id: true, civilite: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, deletedAt: true, assignedToId: true },
                });
                if (!p || p.deletedAt)
                    return { success: false, error: 'Prospect introuvable' };
                // Visibilité restreinte : mêmes règles que le ciblage Client — hors
                // rôles à vue complète, on ne peut cibler qu'un prospect dont on est
                // l'utilisateur référent.
                if (!PROSPECT_FULL_VIEW_ROLES.includes(session.role)) {
                    if (p.assignedToId !== session.userId)
                        return { success: false, error: 'Prospect inaccessible' };
                }
                const to = pickRecipient(p);
                if (!to)
                    return { success: false, error: `Le prospect n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
                const label = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || `Prospect #${p.id}`;
                const variables = { ...commonVars, ...recipientVariables(p) };
                return { success: true, data: { to, label, targets: { prospectId: p.id }, variables } };
            }
            if (entityType === 'REFERRER') {
                const r = await db.businessReferrer.findUnique({
                    where: { id: entityId },
                    select: { id: true, firstName: true, lastName: true, companyName: true, email: true, phone: true, mobile: true, deletedAt: true, assignedToId: true },
                });
                if (!r || r.deletedAt)
                    return { success: false, error: "Apporteur d'affaires introuvable" };
                // Visibilité restreinte : mêmes règles d'accès que le ciblage Client —
                // hors rôles à vue complète, on ne peut cibler qu'un apporteur dont on
                // est l'utilisateur référent.
                if (!REFERRER_FULL_VIEW_ROLES.includes(session.role)) {
                    if (r.assignedToId !== session.userId)
                        return { success: false, error: "Apporteur d'affaires inaccessible" };
                }
                const to = pickRecipient(r);
                if (!to)
                    return { success: false, error: `L'apporteur d'affaires n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
                const label = r.companyName ?? `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
                const variables = {
                    ...commonVars,
                    ...recipientVariables({ ...r, type: r.companyName ? 'ENTREPRISE' : undefined, entreprise: r.companyName }),
                };
                return { success: true, data: { to, label, targets: { referrerId: r.id }, variables } };
            }
            if (entityType === 'OWNER') {
                const o = await db.owner.findUnique({
                    where: { id: entityId },
                    select: { id: true, firstName: true, lastName: true, companyName: true, type: true, email: true, phone: true, mobile: true, deletedAt: true },
                });
                if (!o || o.deletedAt)
                    return { success: false, error: 'Propriétaire introuvable' };
                const to = pickRecipient(o);
                if (!to)
                    return { success: false, error: `Le propriétaire n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
                const label = o.type === 'ENTREPRISE' ? (o.companyName ?? `Propriétaire #${o.id}`) : `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim();
                const variables = { ...commonVars, ...recipientVariables(o) };
                return { success: true, data: { to, label, targets: { ownerId: o.id }, variables } };
            }
            // CONVENTION → client principal de la convention.
            const conv = await db.convention.findUnique({
                where: { id: entityId },
                select: {
                    id: true, reference: true, type: true, startDate: true, endDate: true, rentAmount: true, deletedAt: true,
                    client: { select: { id: true, civilite: true, firstName: true, lastName: true, entreprise: true, type: true, email: true, phone: true, mobile: true } },
                },
            });
            if (!conv || conv.deletedAt)
                return { success: false, error: 'Convention introuvable' };
            if (!conv.client)
                return { success: false, error: 'Convention sans client principal' };
            const to = pickRecipient(conv.client);
            if (!to)
                return { success: false, error: `Le client principal de la convention n'a pas de ${channel === 'EMAIL' ? 'email' : 'numéro mobile/téléphone'} renseigné` };
            const clientLabel = conv.client.type !== 'INDIVIDUEL'
                ? (conv.client.entreprise ?? `Client #${conv.client.id}`)
                : `${conv.client.firstName ?? ''} ${conv.client.lastName ?? ''}`.trim();
            const variables = {
                ...commonVars,
                ...recipientVariables(conv.client),
                conventionRef: conv.reference ?? '',
                conventionType: CONVENTION_TYPE_LABELS[conv.type] ?? String(conv.type ?? ''),
                startDate: fmtDate(conv.startDate),
                endDate: fmtDate(conv.endDate),
                rentAmount: fmtAmount(conv.rentAmount),
            };
            return {
                success: true,
                data: { to, label: `${conv.reference} — ${clientLabel}`, targets: { clientId: conv.client.id, conventionId: conv.id }, variables },
            };
        }
        catch (error) {
            logger_1.default.error('communication:resolveTarget error', error.message);
            return { success: false, error: error.message };
        }
    });
    // ── Partage de localisation GPS ─────────────────────────────────────────────
    // Lotissement / Terrain / Bien → Client / Prospect / Apporteur d'affaires.
    // Le template est lu côté serveur depuis Paramètres (non éditable dans l'UI
    // de partage). Deux handlers partagent la même logique de rendu :
    //   - previewShareLocation : renvoie le message rendu pour l'aperçu UI ;
    //   - shareLocation        : envoie le message et trace dans Communication.
    electron_1.ipcMain.handle('communication:previewShareLocation', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = shareLocationSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const ctx = await buildShareLocationContext(parsed.data);
            if (!ctx.success)
                return ctx;
            return {
                success: true,
                data: {
                    to: ctx.data.to,
                    subject: ctx.data.finalSubject,
                    body: ctx.data.finalBody,
                    entityTitle: ctx.data.entityTitle,
                },
            };
        }
        catch (error) {
            logger_1.default.error('communication:previewShareLocation error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('communication:shareLocation', async (_event, { token, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WRITE_ROLES);
            const parsed = shareLocationSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const ctx = await buildShareLocationContext(parsed.data);
            if (!ctx.success)
                return ctx;
            const db = (0, db_service_1.getDb)();
            const d = parsed.data;
            const { to, finalSubject, finalBody, entityTitle, entityFK, recipientFK } = ctx.data;
            // Trace puis envoie via le canal demandé.
            const comm = await db.communication.create({
                data: {
                    channel: d.channel,
                    direction: 'SORTANT',
                    to,
                    subject: d.channel === 'EMAIL' ? finalSubject : null,
                    body: finalBody,
                    status: 'EN_ATTENTE',
                    senderId: session.userId,
                    clientId: recipientFK.clientId ?? null,
                    metadata: {
                        kind: 'SHARE_LOCATION',
                        entityType: d.entityType,
                        entityId: d.entityId,
                        recipientType: d.recipientType,
                        recipientId: d.recipientId,
                        ...entityFK,
                    },
                },
            });
            try {
                let messageId;
                if (d.channel === 'EMAIL') {
                    const info = await (0, email_service_1.sendEmail)({ to, subject: finalSubject, body: finalBody });
                    messageId = info.messageId;
                }
                else {
                    await (0, whatsapp_service_1.sendWhatsapp)(to, finalBody);
                }
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ENVOYE', sentAt: new Date(), ...(messageId ? { messageId } : {}) },
                });
                logger_1.default.info(`Partage de localisation envoyé (${d.channel} → ${to}, ${d.entityType}#${d.entityId})`);
                return { success: true, data: { ...comm, status: 'ENVOYE', to, subject: finalSubject, body: finalBody, entityTitle } };
            }
            catch (sendErr) {
                await db.communication.update({
                    where: { id: comm.id },
                    data: { status: 'ECHEC', errorMsg: sendErr.message },
                });
                return { success: false, error: `Enregistré mais envoi échoué : ${sendErr.message}` };
            }
        }
        catch (error) {
            logger_1.default.error('communication:shareLocation error', error.message);
            return { success: false, error: error.message };
        }
    });
}
