"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROSPECT_FIELD_LABELS = exports.CLIENT_FIELD_LABELS = exports.PROSPECT_STATUS_LABELS = exports.CLIENT_STATUS_LABELS = void 0;
exports.diffChangedFields = diffChangedFields;
exports.recordStatusChange = recordStatusChange;
exports.buildEntityTimeline = buildEntityTimeline;
exports.recordModification = recordModification;
exports.CLIENT_STATUS_LABELS = {
    ACTIF: 'Actif',
    INACTIF: 'Inactif',
    VIP: 'VIP',
    SUSPENDU: 'Suspendu',
};
exports.PROSPECT_STATUS_LABELS = {
    NOUVEAU: 'Nouveau',
    CONTACTE: 'Contacté',
    QUALIFIE: 'Client potentiel',
    ENVOI_PROPOSITION: 'Proposition',
    NEGOCIATION_EN_COURS: 'Négociation',
    CONVERTI: 'Converti',
    PERDU: 'Perdu',
};
exports.CLIENT_FIELD_LABELS = {
    type: 'Type de client',
    firstName: 'Prénom',
    lastName: 'Nom',
    civilite: 'Civilité',
    statutConjugal: 'Statut conjugal',
    entreprise: 'Entreprise',
    registre_de_commerce: 'Registre de commerce',
    compte_contribuable: 'Compte contribuable',
    website: 'Site web',
    companyActivity: 'Activité de l’entreprise',
    legalRepFirstName: 'Prénom du représentant légal',
    legalRepLastName: 'Nom du représentant légal',
    legalRepPhone: 'Téléphone du représentant légal',
    legalRepIdNumber: 'N° pièce du représentant légal',
    legalRepIdTypeId: 'Type de pièce du représentant légal',
    email: 'Email',
    phone: 'Téléphone',
    mobile: 'Mobile',
    address: 'Adresse',
    commune: 'Commune',
    city: 'Ville',
    postalCode: 'Code postal',
    country: 'Pays',
    nationality: 'Nationalité',
    profession: 'Profession',
    birthDate: 'Date de naissance',
    birthPlace: 'Lieu de naissance',
    idNumber: 'N° pièce d’identité',
    idTypeId: 'Type de pièce d’identité',
    fatherFirstName: 'Prénom du père',
    fatherLastName: 'Nom du père',
    motherFirstName: 'Prénom de la mère',
    motherLastName: 'Nom de la mère',
    notes: 'Notes',
    assignedToId: 'Utilisateur affecté',
    referrerId: 'Apporteur d’affaire',
    isActive: 'Fiche active',
};
exports.PROSPECT_FIELD_LABELS = {
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'Email',
    phone: 'Téléphone',
    mobile: 'Mobile',
    source: 'Source',
    budget: 'Budget',
    notes: 'Notes',
    assignedToId: 'Utilisateur affecté',
};
/**
 * Détermine les champs réellement modifiés entre l'état précédent (`before`,
 * enregistrement Prisma complet) et les données soumises (`data`, uniquement
 * les champs présents dans le payload). Normalise Date/Decimal en chaîne
 * pour une comparaison fiable.
 */
function diffChangedFields(before, data) {
    const norm = (v) => {
        if (v == null)
            return null;
        if (v instanceof Date)
            return v.toISOString();
        if (typeof v === 'object' && typeof v.toString === 'function')
            return v.toString();
        return v;
    };
    const changed = [];
    for (const key of Object.keys(data)) {
        if (data[key] === undefined)
            continue;
        if (norm(before[key]) !== norm(data[key]))
            changed.push(key);
    }
    return changed;
}
/** Enregistre un événement de changement de statut (silencieux si oldValue === newValue). */
async function recordStatusChange(db, p) {
    if (!p.oldValue || p.oldValue === p.newValue)
        return;
    const oldLabel = p.labels[p.oldValue] ?? p.oldValue;
    const newLabel = p.labels[p.newValue] ?? p.newValue;
    await db.entityTimelineEvent.create({
        data: {
            entityType: p.entityType,
            entityId: p.entityId,
            eventType: 'STATUS_CHANGE',
            description: `Statut changé de « ${oldLabel} » à « ${newLabel} »`,
            oldValue: p.oldValue,
            newValue: p.newValue,
            userId: p.userId ?? null,
        },
    });
}
const USER_BRIEF = { id: true, firstName: true, lastName: true };
/**
 * Construit la fiche de suivi chronologique d'un Client ou d'un Prospect en
 * agrégeant : les événements de suivi (statut/modifications, depuis leur mise
 * en place), les activités CRM, les documents importés et — pour un Client
 * uniquement — les paiements reçus et les conventions liées (création et
 * signature). Trié du plus récent au plus ancien.
 */
async function buildEntityTimeline(db, entityType, entityId, entityCreatedAt) {
    const items = [
        {
            date: entityCreatedAt.toISOString(),
            category: 'CREATION',
            title: entityType === 'CLIENT' ? 'Fiche client créée' : 'Fiche prospect créée',
        },
    ];
    const events = await db.entityTimelineEvent.findMany({
        where: { entityType, entityId },
        include: { user: { select: USER_BRIEF } },
    });
    for (const e of events) {
        items.push({
            date: e.createdAt.toISOString(),
            category: e.eventType,
            title: e.eventType === 'STATUS_CHANGE' ? 'Changement de statut' : 'Modification de la fiche',
            description: e.description,
            user: e.user,
        });
    }
    const activityWhere = entityType === 'CLIENT' ? { clientId: entityId } : { prospectId: entityId };
    const activities = await db.crmActivity.findMany({
        where: activityWhere,
        include: { user: { select: USER_BRIEF } },
    });
    for (const a of activities) {
        items.push({
            date: a.createdAt.toISOString(),
            category: 'CRM_ACTIVITY',
            title: a.subject,
            description: a.description,
            user: a.user,
            meta: { activityType: a.type, status: a.status, dueDate: a.dueDate, completedAt: a.completedAt },
        });
    }
    const docWhere = entityType === 'CLIENT'
        ? { clientId: entityId, deletedAt: null }
        : { prospectId: entityId, deletedAt: null };
    const documents = await db.document.findMany({
        where: docWhere,
        select: { name: true, uploadedAt: true, uploadedBy: { select: USER_BRIEF } },
    });
    for (const d of documents) {
        items.push({
            date: d.uploadedAt.toISOString(),
            category: 'DOCUMENT',
            title: `Document ajouté : ${d.name}`,
            user: d.uploadedBy,
        });
    }
    if (entityType === 'CLIENT') {
        const payments = await db.payment.findMany({
            where: { invoice: { clientId: entityId } },
            include: { invoice: { select: { reference: true, type: true } } },
        });
        for (const p of payments) {
            items.push({
                date: p.paidAt.toISOString(),
                category: 'PAYMENT',
                title: `Paiement reçu — ${p.invoice.reference}`,
                amount: Number(p.amount),
                meta: { method: p.method, invoiceType: p.invoice.type, reference: p.reference },
            });
        }
        const conventions = await db.convention.findMany({
            where: { OR: [{ clientId: entityId }, { secondaryClientId: entityId }] },
            select: { id: true, reference: true, type: true, status: true, createdAt: true, signedAt: true },
        });
        for (const c of conventions) {
            items.push({
                date: c.createdAt.toISOString(),
                category: 'CONVENTION',
                title: `Convention créée — ${c.reference}`,
                meta: { conventionId: c.id, conventionType: c.type, status: c.status },
            });
            if (c.signedAt) {
                items.push({
                    date: c.signedAt.toISOString(),
                    category: 'CONVENTION',
                    title: `Convention signée — ${c.reference}`,
                    meta: { conventionId: c.id, conventionType: c.type, status: c.status },
                });
            }
        }
    }
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
}
/** Enregistre un événement de synthèse listant les champs de fiche modifiés. */
async function recordModification(db, p) {
    if (!p.changedFields.length)
        return;
    const labels = p.changedFields.map((f) => p.labels[f] ?? f);
    await db.entityTimelineEvent.create({
        data: {
            entityType: p.entityType,
            entityId: p.entityId,
            eventType: 'MODIFICATION',
            description: `Fiche modifiée : ${labels.join(', ')}`,
            userId: p.userId ?? null,
        },
    });
}
