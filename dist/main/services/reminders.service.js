"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultRemindersConfig = seedDefaultRemindersConfig;
exports.getReminderPolicy = getReminderPolicy;
exports.setReminderPolicy = setReminderPolicy;
exports.applyReminderRules = applyReminderRules;
exports.scheduleReminders = scheduleReminders;
const db_service_1 = require("./db.service");
const email_service_1 = require("./email.service");
const sms_service_1 = require("./sms.service");
const whatsapp_service_1 = require("./whatsapp.service");
const settings_service_1 = require("./settings.service");
const templating_service_1 = require("./templating.service");
const logger_1 = __importDefault(require("../utils/logger"));
// ── Défauts ──────────────────────────────────────────────────────────────────
const DEFAULT_POLICY = {
    enabled: true,
    quietHoursStart: '08:00',
    quietHoursEnd: '20:00',
    quietDays: [0], // dimanche
};
// Marqueurs reconnus pour identifier les templates seedés (et les retrouver
// pour les associer aux règles). Le préfixe est conservé dans le nom pour
// faciliter la lecture côté UI.
const TPL_CODES = {
    UPCOMING_EMAIL: '[Politique] Rappel — Échéance à venir (Email)',
    UPCOMING_SMS: '[Politique] Rappel — Échéance à venir (SMS)',
    UPCOMING_WHATSAPP: '[Politique] Rappel — Échéance à venir (WhatsApp)',
    OVERDUE_EMAIL: '[Politique] Relance — Échéance dépassée (Email)',
    OVERDUE_SMS: '[Politique] Relance — Échéance dépassée (SMS)',
    OVERDUE_WHATSAPP: '[Politique] Relance — Échéance dépassée (WhatsApp)',
    OVERDUE_FINAL_EMAIL: '[Politique] Mise en demeure — Retard important (Email)',
    CONV_EXPIRING_EMAIL: '[Politique] Convention — Expiration prochaine (Email)',
    CONV_EXPIRING_SMS: '[Politique] Convention — Expiration prochaine (SMS)',
    CONV_EXPIRING_WHATSAPP: '[Politique] Convention — Expiration prochaine (WhatsApp)',
};
const SEED_TEMPLATES = [
    {
        marker: TPL_CODES.UPCOMING_EMAIL,
        channel: 'EMAIL',
        subject: 'Échéance à venir — {{conventionRef}}',
        body: `Bonjour {{fullName}},

Nous vous rappelons que l'échéance n° {{installmentNumber}} ({{conventionRef}}) est due le {{dueDate}} pour un montant de {{amount}} F CFA.

Merci de prévoir le règlement dans les délais convenus.

Cordialement,
{{companyName}}`,
    },
    {
        marker: TPL_CODES.UPCOMING_SMS,
        channel: 'SMS',
        body: 'Rappel {{companyName}} : echeance n.{{installmentNumber}} ({{conventionRef}}) due le {{dueDate}}, montant {{amount}} F CFA.',
    },
    {
        marker: TPL_CODES.OVERDUE_EMAIL,
        channel: 'EMAIL',
        subject: 'Échéance impayée — {{conventionRef}}',
        body: `Bonjour {{fullName}},

Sauf erreur de notre part, l'échéance n° {{installmentNumber}} ({{conventionRef}}), due le {{dueDate}} pour un montant de {{amount}} F CFA, demeure impayée depuis {{daysLate}} jour(s).

Nous vous prions de régulariser cette situation sous brefs délais. Si le règlement est en cours, merci de bien vouloir nous en informer.

Cordialement,
{{companyName}}`,
    },
    {
        marker: TPL_CODES.OVERDUE_SMS,
        channel: 'SMS',
        body: '{{companyName}} : echeance {{installmentNumber}} ({{conventionRef}}) impayee depuis {{daysLate}}j. Merci de regulariser rapidement.',
    },
    {
        marker: TPL_CODES.OVERDUE_FINAL_EMAIL,
        channel: 'EMAIL',
        subject: 'Mise en demeure — {{conventionRef}}',
        body: `Bonjour {{fullName}},

Malgré nos précédents rappels, l'échéance n° {{installmentNumber}} ({{conventionRef}}), d'un montant de {{amount}} F CFA initialement due le {{dueDate}}, demeure impayée à ce jour ({{daysLate}} jours de retard).

Nous vous mettons en demeure de procéder au règlement intégral sous huit (8) jours. Sans réponse de votre part, nous nous réservons le droit d'engager les procédures contractuelles prévues.

Nous restons à votre disposition pour convenir d'un plan d'apurement.

Cordialement,
{{companyName}}`,
    },
    {
        marker: TPL_CODES.CONV_EXPIRING_EMAIL,
        channel: 'EMAIL',
        subject: 'Votre convention {{conventionRef}} arrive à échéance',
        body: `Bonjour {{fullName}},

Votre convention {{conventionRef}} arrive à échéance le {{endDate}}.

Nous vous invitons à nous contacter pour évoquer son renouvellement ou les modalités de sortie selon votre situation.

Cordialement,
{{companyName}}`,
    },
    {
        marker: TPL_CODES.CONV_EXPIRING_SMS,
        channel: 'SMS',
        body: '{{companyName}} : votre convention {{conventionRef}} expire le {{endDate}}. Merci de nous contacter pour le renouvellement.',
    },
    // ── Variantes WhatsApp — mêmes messages que SMS, format identique ────────
    {
        marker: TPL_CODES.UPCOMING_WHATSAPP,
        channel: 'WHATSAPP',
        body: `Bonjour {{fullName}},
Rappel {{companyName}} : votre échéance n° {{installmentNumber}} ({{conventionRef}}) est due le {{dueDate}} pour un montant de {{amount}} F CFA.
Merci de prévoir le règlement dans les délais convenus.`,
    },
    {
        marker: TPL_CODES.OVERDUE_WHATSAPP,
        channel: 'WHATSAPP',
        body: `Bonjour {{fullName}},
{{companyName}} : votre échéance n° {{installmentNumber}} ({{conventionRef}}) est impayée depuis {{daysLate}} jour(s) (montant {{amount}} F CFA).
Merci de régulariser ou de nous contacter rapidement.`,
    },
    {
        marker: TPL_CODES.CONV_EXPIRING_WHATSAPP,
        channel: 'WHATSAPP',
        body: `Bonjour {{fullName}},
{{companyName}} : votre convention {{conventionRef}} arrive à échéance le {{endDate}}.
Merci de nous contacter pour évoquer son renouvellement.`,
    },
];
const SEED_RULES = [
    // Échéances de vente — préventif
    { code: 'INSTALLMENT_UPCOMING_M15_EMAIL', name: 'Échéance — J-15 (Email)', triggerType: 'INSTALLMENT_UPCOMING', offsetDays: -15, channel: 'EMAIL', templateMarker: TPL_CODES.UPCOMING_EMAIL, isActive: true },
    { code: 'INSTALLMENT_UPCOMING_M7_EMAIL', name: 'Échéance — J-7 (Email)', triggerType: 'INSTALLMENT_UPCOMING', offsetDays: -7, channel: 'EMAIL', templateMarker: TPL_CODES.UPCOMING_EMAIL, isActive: true },
    { code: 'INSTALLMENT_UPCOMING_M7_SMS', name: 'Échéance — J-7 (SMS)', triggerType: 'INSTALLMENT_UPCOMING', offsetDays: -7, channel: 'SMS', templateMarker: TPL_CODES.UPCOMING_SMS, isActive: true },
    { code: 'INSTALLMENT_UPCOMING_M1_SMS', name: 'Échéance — J-1 (SMS)', triggerType: 'INSTALLMENT_UPCOMING', offsetDays: -1, channel: 'SMS', templateMarker: TPL_CODES.UPCOMING_SMS, isActive: true },
    // Échéances de vente — relance
    { code: 'INSTALLMENT_OVERDUE_P1_SMS', name: 'Retard — J+1 (SMS)', triggerType: 'INSTALLMENT_OVERDUE', offsetDays: 1, channel: 'SMS', templateMarker: TPL_CODES.OVERDUE_SMS, isActive: true },
    { code: 'INSTALLMENT_OVERDUE_P5_EMAIL', name: 'Retard — J+5 (Email)', triggerType: 'INSTALLMENT_OVERDUE', offsetDays: 5, channel: 'EMAIL', templateMarker: TPL_CODES.OVERDUE_EMAIL, isActive: true },
    { code: 'INSTALLMENT_OVERDUE_P15_EMAIL', name: 'Retard — J+15 (Email)', triggerType: 'INSTALLMENT_OVERDUE', offsetDays: 15, channel: 'EMAIL', templateMarker: TPL_CODES.OVERDUE_EMAIL, isActive: true },
    { code: 'INSTALLMENT_OVERDUE_P30_EMAIL', name: 'Mise en demeure — J+30 (Email)', triggerType: 'INSTALLMENT_OVERDUE', offsetDays: 30, channel: 'EMAIL', templateMarker: TPL_CODES.OVERDUE_FINAL_EMAIL, isActive: true },
    // Conventions — expiration
    { code: 'CONVENTION_EXPIRING_M90_EMAIL', name: 'Expiration — J-90 (Email)', triggerType: 'CONVENTION_EXPIRING', offsetDays: -90, channel: 'EMAIL', templateMarker: TPL_CODES.CONV_EXPIRING_EMAIL, isActive: true },
    { code: 'CONVENTION_EXPIRING_M30_EMAIL', name: 'Expiration — J-30 (Email)', triggerType: 'CONVENTION_EXPIRING', offsetDays: -30, channel: 'EMAIL', templateMarker: TPL_CODES.CONV_EXPIRING_EMAIL, isActive: true },
    { code: 'CONVENTION_EXPIRING_M7_SMS', name: 'Expiration — J-7 (SMS)', triggerType: 'CONVENTION_EXPIRING', offsetDays: -7, channel: 'SMS', templateMarker: TPL_CODES.CONV_EXPIRING_SMS, isActive: true },
    // ── Variantes WhatsApp — désactivées par défaut (s'activent après paramétrage Twilio WhatsApp).
    { code: 'INSTALLMENT_UPCOMING_M7_WHATSAPP', name: 'Échéance — J-7 (WhatsApp)', triggerType: 'INSTALLMENT_UPCOMING', offsetDays: -7, channel: 'WHATSAPP', templateMarker: TPL_CODES.UPCOMING_WHATSAPP, isActive: false },
    { code: 'INSTALLMENT_UPCOMING_M1_WHATSAPP', name: 'Échéance — J-1 (WhatsApp)', triggerType: 'INSTALLMENT_UPCOMING', offsetDays: -1, channel: 'WHATSAPP', templateMarker: TPL_CODES.UPCOMING_WHATSAPP, isActive: false },
    { code: 'INSTALLMENT_OVERDUE_P1_WHATSAPP', name: 'Retard — J+1 (WhatsApp)', triggerType: 'INSTALLMENT_OVERDUE', offsetDays: 1, channel: 'WHATSAPP', templateMarker: TPL_CODES.OVERDUE_WHATSAPP, isActive: false },
    { code: 'INSTALLMENT_OVERDUE_P15_WHATSAPP', name: 'Retard — J+15 (WhatsApp)', triggerType: 'INSTALLMENT_OVERDUE', offsetDays: 15, channel: 'WHATSAPP', templateMarker: TPL_CODES.OVERDUE_WHATSAPP, isActive: false },
    { code: 'CONVENTION_EXPIRING_M7_WHATSAPP', name: 'Expiration — J-7 (WhatsApp)', triggerType: 'CONVENTION_EXPIRING', offsetDays: -7, channel: 'WHATSAPP', templateMarker: TPL_CODES.CONV_EXPIRING_WHATSAPP, isActive: false },
];
// ── Seed idempotent ──────────────────────────────────────────────────────────
async function seedDefaultRemindersConfig() {
    const db = (0, db_service_1.getDb)();
    // 1. Templates (par nom : on ne recrée pas si présent).
    const templateIdByMarker = new Map();
    for (const t of SEED_TEMPLATES) {
        const existing = await db.commTemplate.findFirst({ where: { name: t.marker } });
        if (existing) {
            templateIdByMarker.set(t.marker, existing.id);
            continue;
        }
        const created = await db.commTemplate.create({
            data: {
                name: t.marker,
                channel: t.channel,
                subject: t.subject ?? null,
                body: t.body,
                variables: extractVariables(t.body, t.subject),
                isActive: true,
            },
        });
        templateIdByMarker.set(t.marker, created.id);
        logger_1.default.info(`Reminder template created: ${t.marker}`);
    }
    // 2. Règles (par code : idempotent).
    for (const r of SEED_RULES) {
        const existing = await db.reminderRule.findUnique({ where: { code: r.code } });
        if (existing)
            continue;
        await db.reminderRule.create({
            data: {
                code: r.code,
                name: r.name,
                description: r.description ?? null,
                triggerType: r.triggerType,
                offsetDays: r.offsetDays,
                channel: r.channel,
                templateId: templateIdByMarker.get(r.templateMarker) ?? null,
                isActive: r.isActive,
            },
        });
        logger_1.default.info(`Reminder rule created: ${r.code}`);
    }
}
/** Extrait les variables {{var}} présentes dans le corps + sujet d'un template. */
function extractVariables(body, subject) {
    const set = new Set();
    const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    const grab = (s) => {
        if (!s)
            return;
        let m;
        while ((m = re.exec(s)) !== null)
            set.add(m[1]);
    };
    grab(body);
    grab(subject);
    return Array.from(set);
}
// ── Politique (settings) ─────────────────────────────────────────────────────
async function getReminderPolicy() {
    const map = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.remindersEnabled,
        settings_service_1.SettingsKeys.remindersQuietStart,
        settings_service_1.SettingsKeys.remindersQuietEnd,
        settings_service_1.SettingsKeys.remindersQuietDays,
    ]);
    let quietDays = DEFAULT_POLICY.quietDays;
    const rawDays = map[settings_service_1.SettingsKeys.remindersQuietDays];
    if (rawDays) {
        try {
            const parsed = JSON.parse(rawDays);
            if (Array.isArray(parsed))
                quietDays = parsed.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6);
        }
        catch { /* ignore malformed */ }
    }
    return {
        enabled: (map[settings_service_1.SettingsKeys.remindersEnabled] ?? 'true') === 'true',
        quietHoursStart: map[settings_service_1.SettingsKeys.remindersQuietStart] ?? DEFAULT_POLICY.quietHoursStart,
        quietHoursEnd: map[settings_service_1.SettingsKeys.remindersQuietEnd] ?? DEFAULT_POLICY.quietHoursEnd,
        quietDays,
    };
}
async function setReminderPolicy(p) {
    const current = await getReminderPolicy();
    const next = {
        enabled: p.enabled ?? current.enabled,
        quietHoursStart: p.quietHoursStart ?? current.quietHoursStart,
        quietHoursEnd: p.quietHoursEnd ?? current.quietHoursEnd,
        quietDays: p.quietDays ?? current.quietDays,
    };
    await (0, settings_service_1.setSettings)([
        { key: settings_service_1.SettingsKeys.remindersEnabled, value: String(next.enabled) },
        { key: settings_service_1.SettingsKeys.remindersQuietStart, value: next.quietHoursStart },
        { key: settings_service_1.SettingsKeys.remindersQuietEnd, value: next.quietHoursEnd },
        { key: settings_service_1.SettingsKeys.remindersQuietDays, value: JSON.stringify(next.quietDays) },
    ]);
    return next;
}
// ── Helpers de date ──────────────────────────────────────────────────────────
function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function addDays(d, days) {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
}
function isWithinQuietWindow(now, policy) {
    if (policy.quietDays.includes(now.getDay()))
        return false;
    const [hStart, mStart] = policy.quietHoursStart.split(':').map(Number);
    const [hEnd, mEnd] = policy.quietHoursEnd.split(':').map(Number);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const start = (hStart || 0) * 60 + (mStart || 0);
    const end = (hEnd || 0) * 60 + (mEnd || 0);
    return minutes >= start && minutes < end;
}
function formatDateFr(d) {
    if (!d)
        return '';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
}
function formatAmount(n) {
    if (n === null || n === undefined || n === '')
        return '';
    const num = typeof n === 'string' ? Number(n) : n;
    if (!Number.isFinite(num))
        return String(n);
    return new Intl.NumberFormat('fr-FR').format(Math.round(num));
}
// ── Rendu des templates ──────────────────────────────────────────────────────
function render(template, vars) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
        const v = vars[k];
        return v === null || v === undefined ? '' : String(v);
    });
}
function buildClientName(c) {
    if (c.type === 'ENTREPRISE')
        return c.entreprise ?? '';
    return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
}
async function applyReminderRules(opts = {}) {
    const db = (0, db_service_1.getDb)();
    const result = { scanned: 0, sent: 0, skipped: 0, failed: 0, reasons: {} };
    const bump = (k) => { result.reasons[k] = (result.reasons[k] ?? 0) + 1; };
    const policy = await getReminderPolicy();
    if (!policy.enabled && !opts.force) {
        logger_1.default.info('Reminders disabled in settings — pass skipped');
        return result;
    }
    const now = new Date();
    if (!opts.force && !isWithinQuietWindow(now, policy)) {
        logger_1.default.info('Reminders pass deferred — outside quiet window');
        return result;
    }
    const companyVars = await (0, templating_service_1.loadCompanyVariables)();
    const companyName = companyVars.companyName || 'Afrikimmo';
    const rules = await db.reminderRule.findMany({
        where: { isActive: true },
        include: { template: true },
    });
    if (rules.length === 0)
        return result;
    const today = startOfDay(now);
    for (const rule of rules) {
        if (!rule.template) {
            bump('rule_without_template');
            continue;
        }
        // Date pivot : on cherche les entités dont la date cible tombe le jour J + offsetDays.
        // (offset négatif = futur pour upcoming/expiring, positif = passé pour overdue.)
        const pivotStart = addDays(today, -rule.offsetDays);
        const pivotEnd = endOfDay(pivotStart);
        const pivotStartIso = startOfDay(pivotStart);
        try {
            if (rule.triggerType === 'INSTALLMENT_UPCOMING' || rule.triggerType === 'INSTALLMENT_OVERDUE') {
                const overdueStatuses = ['A_REGLER', 'EN_RETARD', 'EN_ATTENTE'];
                const installments = await db.saleInstallment.findMany({
                    where: {
                        dueDate: { gte: pivotStartIso, lte: pivotEnd },
                        // Pour les rappels, on ne re-relance pas une échéance payée/annulée.
                        status: { in: overdueStatuses },
                        convention: { deletedAt: null, status: { notIn: ['TERMINER', 'ANNULE'] } },
                    },
                    include: {
                        convention: {
                            include: {
                                client: true,
                            },
                        },
                    },
                });
                for (const inst of installments) {
                    result.scanned += 1;
                    await processCandidate(db, {
                        rule,
                        companyName,
                        dedupeKey: `INSTALLMENT_${inst.id}_J${signed(rule.offsetDays)}_${rule.channel}`,
                        client: inst.convention?.client ?? null,
                        renderVars: {
                            ...companyVars,
                            fullName: buildClientName(inst.convention?.client ?? { type: 'INDIVIDUEL' }),
                            firstName: inst.convention?.client?.firstName ?? '',
                            lastName: inst.convention?.client?.lastName ?? '',
                            conventionRef: inst.convention?.reference ?? '',
                            installmentNumber: inst.installmentNumber,
                            dueDate: formatDateFr(inst.dueDate),
                            amount: formatAmount(inst.amount),
                            daysLate: rule.offsetDays > 0 ? rule.offsetDays : 0,
                            companyName,
                        },
                        relations: {
                            clientId: inst.convention?.clientId ?? null,
                            conventionId: inst.conventionId,
                            installmentId: inst.id,
                        },
                    }, result, bump);
                }
                // Échéances héritées de l'ancienne application (souscription sans
                // convention — cf. SaleInstallment.conventionId/clientId) : même
                // fenêtre de relance, client rattaché directement (pas de détour par
                // Convention.client). `detailsSouscription` remplace la référence de
                // convention dans les variables de message.
                const legacyInstallments = await db.saleInstallment.findMany({
                    where: {
                        conventionId: null,
                        clientId: { not: null },
                        dueDate: { gte: pivotStartIso, lte: pivotEnd },
                        status: { in: overdueStatuses },
                    },
                    include: { client: true },
                });
                for (const inst of legacyInstallments) {
                    result.scanned += 1;
                    await processCandidate(db, {
                        rule,
                        companyName,
                        dedupeKey: `INSTALLMENT_${inst.id}_J${signed(rule.offsetDays)}_${rule.channel}`,
                        client: inst.client ?? null,
                        renderVars: {
                            ...companyVars,
                            fullName: buildClientName(inst.client ?? { type: 'INDIVIDUEL' }),
                            firstName: inst.client?.firstName ?? '',
                            lastName: inst.client?.lastName ?? '',
                            conventionRef: inst.detailsSouscription ?? '',
                            installmentNumber: inst.installmentNumber,
                            dueDate: formatDateFr(inst.dueDate),
                            amount: formatAmount(inst.amount),
                            daysLate: rule.offsetDays > 0 ? rule.offsetDays : 0,
                            companyName,
                        },
                        relations: {
                            clientId: inst.clientId,
                            conventionId: null,
                            installmentId: inst.id,
                        },
                    }, result, bump);
                }
            }
            else if (rule.triggerType === 'CONVENTION_EXPIRING') {
                const conventions = await db.convention.findMany({
                    where: {
                        deletedAt: null,
                        status: 'ACTIVE',
                        endDate: { gte: pivotStartIso, lte: pivotEnd },
                    },
                    include: { client: true },
                });
                for (const conv of conventions) {
                    result.scanned += 1;
                    await processCandidate(db, {
                        rule,
                        companyName,
                        dedupeKey: `CONVENTION_${conv.id}_J${signed(rule.offsetDays)}_${rule.channel}`,
                        client: conv.client ?? null,
                        renderVars: {
                            ...companyVars,
                            fullName: buildClientName(conv.client ?? { type: 'INDIVIDUEL' }),
                            firstName: conv.client?.firstName ?? '',
                            lastName: conv.client?.lastName ?? '',
                            conventionRef: conv.reference,
                            endDate: formatDateFr(conv.endDate),
                            companyName,
                        },
                        relations: {
                            clientId: conv.clientId,
                            conventionId: conv.id,
                        },
                    }, result, bump);
                }
            }
        }
        catch (err) {
            logger_1.default.error(`Reminder rule ${rule.code} pass failed: ${err.message}`);
            bump('rule_pass_error');
        }
    }
    logger_1.default.info(`Reminders pass — scanned=${result.scanned} sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`);
    return result;
}
function signed(n) {
    return n >= 0 ? `+${n}` : `${n}`;
}
async function processCandidate(db, ctx, result, bump) {
    const { rule, dedupeKey, client, renderVars, relations } = ctx;
    if (!client) {
        result.skipped += 1;
        bump('no_client');
        return;
    }
    if (rule.channel === 'EMAIL' && client.emailOptOut) {
        result.skipped += 1;
        bump('email_opt_out');
        return;
    }
    // WhatsApp partage l'opt-out SMS (même canal téléphonique). On gardera la
    // possibilité d'un opt-out WhatsApp dédié plus tard si le besoin émerge.
    if ((rule.channel === 'SMS' || rule.channel === 'WHATSAPP') && client.smsOptOut) {
        result.skipped += 1;
        bump(rule.channel === 'WHATSAPP' ? 'whatsapp_opt_out' : 'sms_opt_out');
        return;
    }
    const recipient = rule.channel === 'EMAIL'
        ? (client.email ?? '')
        : (client.mobile ?? client.phone ?? '');
    if (!recipient) {
        result.skipped += 1;
        bump(rule.channel === 'EMAIL' ? 'no_email' : 'no_phone');
        return;
    }
    // Anti-doublon — unique sur Communication.dedupeKey. Ce contrôle préalable
    // couvre le cas courant (une seule passe à la fois) ; il reste néanmoins
    // sujet à une fenêtre de course si deux passes tournent au même instant
    // (ex. l'app desktop ouverte sur un poste ET le script planifié NAS,
    // `run-reminders-once.ts`, exécutés à quelques millisecondes d'écart) — la
    // contrainte unique en base ci-dessous est le garde-fou définitif.
    const already = await db.communication.findUnique({ where: { dedupeKey } });
    if (already) {
        result.skipped += 1;
        bump('already_sent');
        return;
    }
    const subject = rule.template.subject ? render(rule.template.subject, renderVars) : null;
    const body = render(rule.template.body, renderVars);
    let comm;
    try {
        comm = await db.communication.create({
            data: {
                channel: rule.channel,
                direction: 'SORTANT',
                to: recipient,
                subject,
                body,
                status: 'EN_ATTENTE',
                templateId: rule.templateId,
                clientId: relations.clientId,
                dedupeKey,
                metadata: {
                    ruleCode: rule.code,
                    triggerType: rule.triggerType,
                    offsetDays: rule.offsetDays,
                    conventionId: relations.conventionId ?? null,
                    installmentId: relations.installmentId ?? null,
                },
            },
        });
    }
    catch (createErr) {
        if (createErr?.code === 'P2002') {
            // Une exécution concurrente a créé ce même envoi entre le contrôle
            // ci-dessus et cette création — dédoublonnage garanti par la
            // contrainte unique en base (autorité finale, pas seulement le
            // contrôle applicatif) : on ignore silencieusement, aucun envoi n'a
            // pu avoir lieu deux fois pour cette même personne.
            result.skipped += 1;
            bump('already_sent_race');
            return;
        }
        throw createErr;
    }
    try {
        if (rule.channel === 'EMAIL') {
            await (0, email_service_1.sendEmail)({ to: recipient, subject: subject ?? '(sans objet)', body });
        }
        else if (rule.channel === 'WHATSAPP') {
            await (0, whatsapp_service_1.sendWhatsapp)(recipient, body);
        }
        else {
            await (0, sms_service_1.sendSms)(recipient, body);
        }
        await db.communication.update({
            where: { id: comm.id },
            data: { status: 'ENVOYE', sentAt: new Date() },
        });
        // Journalisation CRM — rappel marqué « traité » puisqu'il s'agit d'un envoi
        // déjà réalisé. L'utilisateur référent retrouvera la trace via la fiche client.
        await db.crmActivity.create({
            data: {
                type: 'RAPPEL',
                subject: subject ?? `Relance ${rule.channel} — ${rule.name}`,
                description: body.length > 500 ? body.slice(0, 500) + '…' : body,
                status: 'TRAITE',
                completedAt: new Date(),
                clientId: relations.clientId,
                conventionId: relations.conventionId ?? null,
                installmentId: relations.installmentId ?? null,
            },
        });
        result.sent += 1;
    }
    catch (sendErr) {
        await db.communication.update({
            where: { id: comm.id },
            data: { status: 'ECHEC', errorMsg: sendErr.message },
        });
        result.failed += 1;
        bump('send_error');
        logger_1.default.error(`Reminder ${dedupeKey} failed: ${sendErr.message}`);
    }
}
// ── Scheduler ────────────────────────────────────────────────────────────────
const PASS_INTERVAL_MS = 60 * 60 * 1000; // 1 h — la passe vérifie elle-même la fenêtre horaire.
let scheduledHandle = null;
function scheduleReminders() {
    // Passe initiale en fire-and-forget (la fenêtre horaire fera l'arbitrage).
    applyReminderRules().catch((e) => logger_1.default.error(`Initial reminders pass failed: ${e.message}`));
    if (scheduledHandle)
        return;
    scheduledHandle = setInterval(() => {
        applyReminderRules().catch((e) => logger_1.default.error(`Scheduled reminders pass failed: ${e.message}`));
    }, PASS_INTERVAL_MS);
}
