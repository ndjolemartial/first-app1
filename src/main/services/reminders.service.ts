import { getDb } from './db.service';
import { sendEmail } from './email.service';
import { sendSms } from './sms.service';
import { sendWhatsapp } from './whatsapp.service';
import {
  SettingsKeys,
  getSetting,
  getSettings,
  setSetting,
  setSettings,
} from './settings.service';
import { loadCompanyVariables } from './templating.service';
import logger from '../utils/logger';

/**
 * Politique de relance — orchestration des rappels email/SMS automatiques.
 *
 * Modèle :
 *   - `ReminderRule` (code unique) : un cas (échéance à venir / en retard / expiration)
 *     × un canal (EMAIL/SMS) × un offset signé en jours.
 *   - `CommTemplate` : modèle de message rattaché à la règle.
 *   - `Communication.dedupeKey` : empreinte unique (cas + entité + offset + canal)
 *     posée à chaque envoi pour empêcher tout doublon.
 *
 * Une passe quotidienne :
 *   1. Liste les règles actives.
 *   2. Pour chaque règle, calcule la date pivot (`today − offsetDays`) et énumère
 *      les entités candidates (échéances / conventions) dont la date pivot
 *      tombe le jour J.
 *   3. Vérifie les opt-outs client + l'absence de dedupeKey déjà posé.
 *   4. Rend le template (substitution `{{var}}`), envoie via le service idoine,
 *      journalise un `Communication` + une `CrmActivity` de type RAPPEL.
 *
 * Heures silencieuses : les envois ne sont pas réalisés en dehors des heures
 * ouvrables paramétrées. Tant qu'on est hors fenêtre, la passe quotidienne ne
 * fait rien — la prochaine fenêtre rattrapera les rappels du jour.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ReminderTriggerType = 'INSTALLMENT_UPCOMING' | 'INSTALLMENT_OVERDUE' | 'CONVENTION_EXPIRING';

export interface ReminderPolicySettings {
  enabled:         boolean;
  quietHoursStart: string;  // 'HH:MM'
  quietHoursEnd:   string;  // 'HH:MM'
  quietDays:       number[]; // 0=dimanche … 6=samedi
}

// ── Défauts ──────────────────────────────────────────────────────────────────

const DEFAULT_POLICY: ReminderPolicySettings = {
  enabled:         true,
  quietHoursStart: '08:00',
  quietHoursEnd:   '20:00',
  quietDays:       [0], // dimanche
};

// Marqueurs reconnus pour identifier les templates seedés (et les retrouver
// pour les associer aux règles). Le préfixe est conservé dans le nom pour
// faciliter la lecture côté UI.
const TPL_CODES = {
  UPCOMING_EMAIL:        '[Politique] Rappel — Échéance à venir (Email)',
  UPCOMING_SMS:          '[Politique] Rappel — Échéance à venir (SMS)',
  UPCOMING_WHATSAPP:     '[Politique] Rappel — Échéance à venir (WhatsApp)',
  OVERDUE_EMAIL:         '[Politique] Relance — Échéance dépassée (Email)',
  OVERDUE_SMS:           '[Politique] Relance — Échéance dépassée (SMS)',
  OVERDUE_WHATSAPP:      '[Politique] Relance — Échéance dépassée (WhatsApp)',
  OVERDUE_FINAL_EMAIL:   '[Politique] Mise en demeure — Retard important (Email)',
  CONV_EXPIRING_EMAIL:   '[Politique] Convention — Expiration prochaine (Email)',
  CONV_EXPIRING_SMS:     '[Politique] Convention — Expiration prochaine (SMS)',
  CONV_EXPIRING_WHATSAPP:'[Politique] Convention — Expiration prochaine (WhatsApp)',
} as const;

interface SeedTemplate {
  marker:   string;
  channel:  'EMAIL' | 'SMS' | 'WHATSAPP';
  subject?: string;
  body:     string;
}

const SEED_TEMPLATES: SeedTemplate[] = [
  {
    marker: TPL_CODES.UPCOMING_EMAIL,
    channel: 'EMAIL',
    subject: 'Échéance à venir — {{conventionRef}}',
    body:
`Bonjour {{fullName}},

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
    body:
`Bonjour {{fullName}},

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
    body:
`Bonjour {{fullName}},

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
    body:
`Bonjour {{fullName}},

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
    body:
`Bonjour {{fullName}},
Rappel {{companyName}} : votre échéance n° {{installmentNumber}} ({{conventionRef}}) est due le {{dueDate}} pour un montant de {{amount}} F CFA.
Merci de prévoir le règlement dans les délais convenus.`,
  },
  {
    marker: TPL_CODES.OVERDUE_WHATSAPP,
    channel: 'WHATSAPP',
    body:
`Bonjour {{fullName}},
{{companyName}} : votre échéance n° {{installmentNumber}} ({{conventionRef}}) est impayée depuis {{daysLate}} jour(s) (montant {{amount}} F CFA).
Merci de régulariser ou de nous contacter rapidement.`,
  },
  {
    marker: TPL_CODES.CONV_EXPIRING_WHATSAPP,
    channel: 'WHATSAPP',
    body:
`Bonjour {{fullName}},
{{companyName}} : votre convention {{conventionRef}} arrive à échéance le {{endDate}}.
Merci de nous contacter pour évoquer son renouvellement.`,
  },
];

interface SeedRule {
  code:        string;
  name:        string;
  description?: string;
  triggerType: ReminderTriggerType;
  offsetDays:  number;
  channel:     'EMAIL' | 'SMS' | 'WHATSAPP';
  templateMarker: string;
  isActive:    boolean;
}

const SEED_RULES: SeedRule[] = [
  // Échéances de vente — préventif
  { code: 'INSTALLMENT_UPCOMING_M15_EMAIL', name: 'Échéance — J-15 (Email)',  triggerType: 'INSTALLMENT_UPCOMING', offsetDays: -15, channel: 'EMAIL', templateMarker: TPL_CODES.UPCOMING_EMAIL, isActive: true },
  { code: 'INSTALLMENT_UPCOMING_M7_EMAIL',  name: 'Échéance — J-7 (Email)',   triggerType: 'INSTALLMENT_UPCOMING', offsetDays:  -7, channel: 'EMAIL', templateMarker: TPL_CODES.UPCOMING_EMAIL, isActive: true },
  { code: 'INSTALLMENT_UPCOMING_M7_SMS',    name: 'Échéance — J-7 (SMS)',     triggerType: 'INSTALLMENT_UPCOMING', offsetDays:  -7, channel: 'SMS',   templateMarker: TPL_CODES.UPCOMING_SMS,   isActive: true },
  { code: 'INSTALLMENT_UPCOMING_M1_SMS',    name: 'Échéance — J-1 (SMS)',     triggerType: 'INSTALLMENT_UPCOMING', offsetDays:  -1, channel: 'SMS',   templateMarker: TPL_CODES.UPCOMING_SMS,   isActive: true },
  // Échéances de vente — relance
  { code: 'INSTALLMENT_OVERDUE_P1_SMS',     name: 'Retard — J+1 (SMS)',       triggerType: 'INSTALLMENT_OVERDUE', offsetDays:   1, channel: 'SMS',   templateMarker: TPL_CODES.OVERDUE_SMS,    isActive: true },
  { code: 'INSTALLMENT_OVERDUE_P5_EMAIL',   name: 'Retard — J+5 (Email)',     triggerType: 'INSTALLMENT_OVERDUE', offsetDays:   5, channel: 'EMAIL', templateMarker: TPL_CODES.OVERDUE_EMAIL,  isActive: true },
  { code: 'INSTALLMENT_OVERDUE_P15_EMAIL',  name: 'Retard — J+15 (Email)',    triggerType: 'INSTALLMENT_OVERDUE', offsetDays:  15, channel: 'EMAIL', templateMarker: TPL_CODES.OVERDUE_EMAIL,  isActive: true },
  { code: 'INSTALLMENT_OVERDUE_P30_EMAIL',  name: 'Mise en demeure — J+30 (Email)', triggerType: 'INSTALLMENT_OVERDUE', offsetDays: 30, channel: 'EMAIL', templateMarker: TPL_CODES.OVERDUE_FINAL_EMAIL, isActive: true },
  // Conventions — expiration
  { code: 'CONVENTION_EXPIRING_M90_EMAIL',  name: 'Expiration — J-90 (Email)',triggerType: 'CONVENTION_EXPIRING', offsetDays: -90, channel: 'EMAIL', templateMarker: TPL_CODES.CONV_EXPIRING_EMAIL, isActive: true },
  { code: 'CONVENTION_EXPIRING_M30_EMAIL',  name: 'Expiration — J-30 (Email)',triggerType: 'CONVENTION_EXPIRING', offsetDays: -30, channel: 'EMAIL', templateMarker: TPL_CODES.CONV_EXPIRING_EMAIL, isActive: true },
  { code: 'CONVENTION_EXPIRING_M7_SMS',     name: 'Expiration — J-7 (SMS)',   triggerType: 'CONVENTION_EXPIRING', offsetDays:  -7, channel: 'SMS',   templateMarker: TPL_CODES.CONV_EXPIRING_SMS,   isActive: true },
  // ── Variantes WhatsApp — désactivées par défaut (s'activent après paramétrage Twilio WhatsApp).
  { code: 'INSTALLMENT_UPCOMING_M7_WHATSAPP',   name: 'Échéance — J-7 (WhatsApp)',   triggerType: 'INSTALLMENT_UPCOMING', offsetDays:  -7, channel: 'WHATSAPP', templateMarker: TPL_CODES.UPCOMING_WHATSAPP,    isActive: false },
  { code: 'INSTALLMENT_UPCOMING_M1_WHATSAPP',   name: 'Échéance — J-1 (WhatsApp)',   triggerType: 'INSTALLMENT_UPCOMING', offsetDays:  -1, channel: 'WHATSAPP', templateMarker: TPL_CODES.UPCOMING_WHATSAPP,    isActive: false },
  { code: 'INSTALLMENT_OVERDUE_P1_WHATSAPP',    name: 'Retard — J+1 (WhatsApp)',     triggerType: 'INSTALLMENT_OVERDUE',  offsetDays:   1, channel: 'WHATSAPP', templateMarker: TPL_CODES.OVERDUE_WHATSAPP,     isActive: false },
  { code: 'INSTALLMENT_OVERDUE_P15_WHATSAPP',   name: 'Retard — J+15 (WhatsApp)',    triggerType: 'INSTALLMENT_OVERDUE',  offsetDays:  15, channel: 'WHATSAPP', templateMarker: TPL_CODES.OVERDUE_WHATSAPP,     isActive: false },
  { code: 'CONVENTION_EXPIRING_M7_WHATSAPP',    name: 'Expiration — J-7 (WhatsApp)', triggerType: 'CONVENTION_EXPIRING',  offsetDays:  -7, channel: 'WHATSAPP', templateMarker: TPL_CODES.CONV_EXPIRING_WHATSAPP, isActive: false },
];

// ── Seed idempotent ──────────────────────────────────────────────────────────

// Empreinte des règles seedées supprimées **définitivement** par un admin
// (`reminders:deleteRule`) — sans cette liste, `seedDefaultRemindersConfig`
// (appelée à chaque démarrage de l'app) ne peut pas distinguer un code jamais
// créé d'un code volontairement supprimé, et le recrée à chaque relance, ce
// qui viderait de son sens la suppression « définitive ». `AppSetting`, pas
// une colonne dédiée : ReminderRule ne porte pas de deletedAt (règle de
// configuration, cf. commentaire sur reminders:deleteRule).
const DELETED_SEED_CODES_KEY = 'reminders.deletedSeedCodes';

async function loadDeletedSeedCodes(): Promise<Set<string>> {
  const raw = await getSetting(DELETED_SEED_CODES_KEY);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** Marque un code de règle comme supprimé définitivement — n'est plus jamais reseedé. */
export async function markRuleCodeDeleted(code: string): Promise<void> {
  const codes = await loadDeletedSeedCodes();
  if (codes.has(code)) return;
  codes.add(code);
  await setSetting(DELETED_SEED_CODES_KEY, JSON.stringify([...codes]));
}

// Même principe que `DELETED_SEED_CODES_KEY`, appliqué aux TEMPLATES seedés
// (`SEED_TEMPLATES`) plutôt qu'aux règles : `communication:deleteTemplate`
// fait une suppression physique (`commTemplate.delete`) sans laisser aucune
// trace en base — sans cette liste, l'étape 1 de `seedDefaultRemindersConfig`
// (exécutée à chaque démarrage) ne trouve plus le template par son nom et le
// recrée systématiquement, y compris pour les modèles SMS/WhatsApp
// volontairement supprimés dans « Modèles email / SMS ».
const DELETED_SEED_TEMPLATE_NAMES_KEY = 'reminders.deletedSeedTemplateNames';

async function loadDeletedSeedTemplateNames(): Promise<Set<string>> {
  const raw = await getSetting(DELETED_SEED_TEMPLATE_NAMES_KEY);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** `name` correspond-il à un des templates seedés par la politique de relance ? */
export function isSeedReminderTemplateName(name: string): boolean {
  return (Object.values(TPL_CODES) as string[]).includes(name);
}

/** Marque un template seedé comme supprimé définitivement — n'est plus jamais reseedé. */
export async function markTemplateNameDeleted(name: string): Promise<void> {
  if (!isSeedReminderTemplateName(name)) return;
  const names = await loadDeletedSeedTemplateNames();
  if (names.has(name)) return;
  names.add(name);
  await setSetting(DELETED_SEED_TEMPLATE_NAMES_KEY, JSON.stringify([...names]));
}

export async function seedDefaultRemindersConfig(): Promise<void> {
  const db = getDb() as any;
  const deletedCodes = await loadDeletedSeedCodes();
  const deletedTemplateNames = await loadDeletedSeedTemplateNames();

  // 1. Templates (par nom : on ne recrée pas si présent, ni si supprimé
  //    définitivement — une règle encore active référençant ce marqueur
  //    retombe alors sur `templateId: null`, cf. étape 2 ci-dessous).
  const templateIdByMarker = new Map<string, number>();
  for (const t of SEED_TEMPLATES) {
    if (deletedTemplateNames.has(t.marker)) continue;
    const existing = await db.commTemplate.findFirst({ where: { name: t.marker } });
    if (existing) {
      templateIdByMarker.set(t.marker, existing.id);
      continue;
    }
    const created = await db.commTemplate.create({
      data: {
        name:     t.marker,
        channel:  t.channel,
        subject:  t.subject ?? null,
        body:     t.body,
        variables: extractVariables(t.body, t.subject) as any,
        isActive: true,
      },
    });
    templateIdByMarker.set(t.marker, created.id);
    logger.info(`Reminder template created: ${t.marker}`);
  }

  // 2. Règles (par code : idempotent, sauf suppression définitive antérieure).
  for (const r of SEED_RULES) {
    if (deletedCodes.has(r.code)) continue;
    const existing = await db.reminderRule.findUnique({ where: { code: r.code } });
    if (existing) continue;
    await db.reminderRule.create({
      data: {
        code:        r.code,
        name:        r.name,
        description: r.description ?? null,
        triggerType: r.triggerType,
        offsetDays:  r.offsetDays,
        channel:     r.channel,
        templateId:  templateIdByMarker.get(r.templateMarker) ?? null,
        isActive:    r.isActive,
      },
    });
    logger.info(`Reminder rule created: ${r.code}`);
  }
}

/** Extrait les variables {{var}} présentes dans le corps + sujet d'un template. */
function extractVariables(body: string, subject?: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const grab = (s?: string): void => {
    if (!s) return;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) set.add(m[1]);
  };
  grab(body);
  grab(subject);
  return Array.from(set);
}

// ── Politique (settings) ─────────────────────────────────────────────────────

export async function getReminderPolicy(): Promise<ReminderPolicySettings> {
  const map = await getSettings([
    SettingsKeys.remindersEnabled,
    SettingsKeys.remindersQuietStart,
    SettingsKeys.remindersQuietEnd,
    SettingsKeys.remindersQuietDays,
  ]);
  let quietDays: number[] = DEFAULT_POLICY.quietDays;
  const rawDays = map[SettingsKeys.remindersQuietDays];
  if (rawDays) {
    try {
      const parsed = JSON.parse(rawDays);
      if (Array.isArray(parsed)) quietDays = parsed.map((n: any) => Number(n)).filter((n) => n >= 0 && n <= 6);
    } catch { /* ignore malformed */ }
  }
  return {
    enabled:         (map[SettingsKeys.remindersEnabled] ?? 'true') === 'true',
    quietHoursStart: map[SettingsKeys.remindersQuietStart] ?? DEFAULT_POLICY.quietHoursStart,
    quietHoursEnd:   map[SettingsKeys.remindersQuietEnd]   ?? DEFAULT_POLICY.quietHoursEnd,
    quietDays,
  };
}

export async function setReminderPolicy(p: Partial<ReminderPolicySettings>): Promise<ReminderPolicySettings> {
  const current = await getReminderPolicy();
  const next: ReminderPolicySettings = {
    enabled:         p.enabled         ?? current.enabled,
    quietHoursStart: p.quietHoursStart ?? current.quietHoursStart,
    quietHoursEnd:   p.quietHoursEnd   ?? current.quietHoursEnd,
    quietDays:       p.quietDays       ?? current.quietDays,
  };
  await setSettings([
    { key: SettingsKeys.remindersEnabled,    value: String(next.enabled) },
    { key: SettingsKeys.remindersQuietStart, value: next.quietHoursStart },
    { key: SettingsKeys.remindersQuietEnd,   value: next.quietHoursEnd },
    { key: SettingsKeys.remindersQuietDays,  value: JSON.stringify(next.quietDays) },
  ]);
  return next;
}

// ── Helpers de date ──────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function isWithinQuietWindow(now: Date, policy: ReminderPolicySettings): boolean {
  if (policy.quietDays.includes(now.getDay())) return false;
  const [hStart, mStart] = policy.quietHoursStart.split(':').map(Number);
  const [hEnd,   mEnd]   = policy.quietHoursEnd.split(':').map(Number);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = (hStart || 0) * 60 + (mStart || 0);
  const end   = (hEnd   || 0) * 60 + (mEnd   || 0);
  return minutes >= start && minutes < end;
}

function formatDateFr(d: Date | null | undefined): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
}

function formatAmount(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return String(n);
  return new Intl.NumberFormat('fr-FR').format(Math.round(num));
}

// Solde restant dû d'une échéance (montant − déjà encaissé). Une échéance
// PARTIEL n'est due, et ne doit être relancée, qu'à hauteur de ce reliquat —
// jamais du montant initial de l'échéance.
function remainingInstallmentAmount(inst: { amount: any; paidAmount?: any }): number {
  const amount = Number(inst.amount ?? 0);
  const paid = Number(inst.paidAmount ?? 0);
  return Math.max(0, amount - paid);
}

// ── Rendu des templates ──────────────────────────────────────────────────────

function render(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

function buildClientName(c: { type: string; firstName?: string | null; lastName?: string | null; entreprise?: string | null }): string {
  if (c.type !== 'INDIVIDUEL') return c.entreprise ?? '';
  return `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim();
}

// ── Passe principale ─────────────────────────────────────────────────────────

interface PassResult {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  reasons: Record<string, number>;
}

export async function applyReminderRules(opts: { force?: boolean } = {}): Promise<PassResult> {
  const db = getDb() as any;
  const result: PassResult = { scanned: 0, sent: 0, skipped: 0, failed: 0, reasons: {} };
  const bump = (k: string): void => { result.reasons[k] = (result.reasons[k] ?? 0) + 1; };

  const policy = await getReminderPolicy();
  if (!policy.enabled && !opts.force) {
    logger.info('Reminders disabled in settings — pass skipped');
    return result;
  }
  const now = new Date();
  if (!opts.force && !isWithinQuietWindow(now, policy)) {
    logger.info('Reminders pass deferred — outside quiet window');
    return result;
  }

  const companyVars = await loadCompanyVariables();
  const companyName = companyVars.companyName || 'Afrikimmo';

  const rules = await db.reminderRule.findMany({
    where: { isActive: true },
    include: { template: true },
  });
  if (rules.length === 0) return result;

  const today = startOfDay(now);
  for (const rule of rules) {
    if (!rule.template) { bump('rule_without_template'); continue; }
    // Date pivot : on cherche les entités dont la date cible tombe le jour J + offsetDays.
    // (offset négatif = futur pour upcoming/expiring, positif = passé pour overdue.)
    const pivotStart = addDays(today, -rule.offsetDays);
    const pivotEnd   = endOfDay(pivotStart);
    const pivotStartIso = startOfDay(pivotStart);

    try {
      if (rule.triggerType === 'INSTALLMENT_UPCOMING' || rule.triggerType === 'INSTALLMENT_OVERDUE') {
        // PARTIEL inclus : une échéance partiellement réglée reste due, les
        // rappels continuent. Seul un solde totalement réglé (PAYE) — ou une
        // échéance annulée — arrête les rappels planifiés sur cette échéance.
        const overdueStatuses = ['A_REGLER', 'EN_RETARD', 'EN_ATTENTE', 'PARTIEL'];
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
            client:    inst.convention?.client ?? null,
            renderVars: {
              ...companyVars,
              fullName:           buildClientName(inst.convention?.client ?? { type: 'INDIVIDUEL' }),
              firstName:          inst.convention?.client?.firstName ?? '',
              lastName:           inst.convention?.client?.lastName ?? '',
              conventionRef:      inst.convention?.reference ?? '',
              installmentNumber:  inst.installmentNumber,
              dueDate:            formatDateFr(inst.dueDate),
              amount:             formatAmount(remainingInstallmentAmount(inst)),
              daysLate:           rule.offsetDays > 0 ? rule.offsetDays : 0,
              companyName,
            },
            relations: {
              clientId:     inst.convention?.clientId ?? null,
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
            client:    inst.client ?? null,
            renderVars: {
              ...companyVars,
              fullName:           buildClientName(inst.client ?? { type: 'INDIVIDUEL' }),
              firstName:          inst.client?.firstName ?? '',
              lastName:           inst.client?.lastName ?? '',
              conventionRef:      inst.detailsSouscription ?? '',
              installmentNumber:  inst.installmentNumber,
              dueDate:            formatDateFr(inst.dueDate),
              amount:             formatAmount(remainingInstallmentAmount(inst)),
              daysLate:           rule.offsetDays > 0 ? rule.offsetDays : 0,
              companyName,
            },
            relations: {
              clientId:      inst.clientId,
              conventionId:  null,
              installmentId: inst.id,
            },
          }, result, bump);
        }
      } else if (rule.triggerType === 'CONVENTION_EXPIRING') {
        const conventions = await db.convention.findMany({
          where: {
            deletedAt: null,
            status: 'ACTIVE',
            endDate: { gte: pivotStartIso, lte: pivotEnd },
            // Une convention déjà renouvelée ou ayant reçu un avenant (autre
            // convention active la référençant via parentConventionId) n'est
            // plus candidate : son échéance d'origine est caduque, le
            // renouvellement/avenant porte sa propre date de fin.
            amendments: { none: { deletedAt: null, status: { not: 'ANNULE' } } },
          },
          include: { client: true },
        });
        for (const conv of conventions) {
          result.scanned += 1;
          await processCandidate(db, {
            rule,
            companyName,
            dedupeKey: `CONVENTION_${conv.id}_J${signed(rule.offsetDays)}_${rule.channel}`,
            client:    conv.client ?? null,
            renderVars: {
              ...companyVars,
              fullName:      buildClientName(conv.client ?? { type: 'INDIVIDUEL' }),
              firstName:     conv.client?.firstName ?? '',
              lastName:      conv.client?.lastName ?? '',
              conventionRef: conv.reference,
              endDate:       formatDateFr(conv.endDate),
              companyName,
            },
            relations: {
              clientId:     conv.clientId,
              conventionId: conv.id,
            },
          }, result, bump);
        }
      }
    } catch (err: any) {
      logger.error(`Reminder rule ${rule.code} pass failed: ${err.message}`);
      bump('rule_pass_error');
    }
  }

  logger.info(`Reminders pass — scanned=${result.scanned} sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`);
  return result;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

interface CandidateCtx {
  rule:        any;
  companyName: string;
  dedupeKey:   string;
  client:      any | null;
  renderVars:  Record<string, any>;
  relations: {
    clientId:      number | null;
    conventionId?: number | null;
    installmentId?: number | null;
  };
}

async function processCandidate(
  db: any,
  ctx: CandidateCtx,
  result: PassResult,
  bump: (k: string) => void,
): Promise<void> {
  const { rule, dedupeKey, client, renderVars, relations } = ctx;

  if (!client) { result.skipped += 1; bump('no_client'); return; }
  if (rule.channel === 'EMAIL' && client.emailOptOut) { result.skipped += 1; bump('email_opt_out'); return; }
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
  if (!recipient) { result.skipped += 1; bump(rule.channel === 'EMAIL' ? 'no_email' : 'no_phone'); return; }

  // Anti-doublon — unique sur Communication.dedupeKey. Ce contrôle préalable
  // couvre le cas courant (une seule passe à la fois) ; il reste néanmoins
  // sujet à une fenêtre de course si deux passes tournent au même instant
  // (ex. l'app desktop ouverte sur un poste ET le script planifié NAS,
  // `run-reminders-once.ts`, exécutés à quelques millisecondes d'écart) — la
  // contrainte unique en base ci-dessous est le garde-fou définitif.
  const already = await db.communication.findUnique({ where: { dedupeKey } });
  if (already) { result.skipped += 1; bump('already_sent'); return; }

  const subject = rule.template.subject ? render(rule.template.subject, renderVars) : null;
  const body    = render(rule.template.body, renderVars);

  let comm;
  try {
    comm = await db.communication.create({
      data: {
        channel:    rule.channel,
        direction:  'SORTANT',
        to:         recipient,
        subject,
        body,
        status:     'EN_ATTENTE',
        templateId: rule.templateId,
        clientId:   relations.clientId,
        dedupeKey,
        metadata: {
          ruleCode:      rule.code,
          triggerType:   rule.triggerType,
          offsetDays:    rule.offsetDays,
          conventionId:  relations.conventionId ?? null,
          installmentId: relations.installmentId ?? null,
        } as any,
      },
    });
  } catch (createErr: any) {
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
    // Message-ID sortant (email uniquement) — persisté pour permettre à une
    // réponse entrante de retrouver cet échange via In-Reply-To/References
    // (cf. mailbox-poller.service.ts).
    let messageId: string | undefined;
    if (rule.channel === 'EMAIL') {
      const info = await sendEmail({ to: recipient, subject: subject ?? '(sans objet)', body });
      messageId = info.messageId;
    } else if (rule.channel === 'WHATSAPP') {
      await sendWhatsapp(recipient, body);
    } else {
      await sendSms(recipient, body);
    }
    await db.communication.update({
      where: { id: comm.id },
      data:  { status: 'ENVOYE', sentAt: new Date(), ...(messageId ? { messageId } : {}) },
    });
    // Journalisation CRM — rappel marqué « traité » puisqu'il s'agit d'un envoi
    // déjà réalisé. L'utilisateur référent retrouvera la trace via la fiche client.
    await db.crmActivity.create({
      data: {
        type:          'RAPPEL',
        subject:       subject ?? `Relance ${rule.channel} — ${rule.name}`,
        description:   body.length > 500 ? body.slice(0, 500) + '…' : body,
        status:        'TRAITE',
        completedAt:   new Date(),
        clientId:      relations.clientId,
        conventionId:  relations.conventionId ?? null,
        installmentId: relations.installmentId ?? null,
      },
    });
    result.sent += 1;
  } catch (sendErr: any) {
    await db.communication.update({
      where: { id: comm.id },
      data:  { status: 'ECHEC', errorMsg: sendErr.message },
    });
    result.failed += 1;
    bump('send_error');
    logger.error(`Reminder ${dedupeKey} failed: ${sendErr.message}`);
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

const PASS_INTERVAL_MS = 60 * 60 * 1000; // 1 h — la passe vérifie elle-même la fenêtre horaire.
let scheduledHandle: NodeJS.Timeout | null = null;

export function scheduleReminders(): void {
  // Passe initiale en fire-and-forget (la fenêtre horaire fera l'arbitrage).
  applyReminderRules().catch((e) => logger.error(`Initial reminders pass failed: ${e.message}`));
  if (scheduledHandle) return;
  scheduledHandle = setInterval(() => {
    applyReminderRules().catch((e) => logger.error(`Scheduled reminders pass failed: ${e.message}`));
  }, PASS_INTERVAL_MS);
}
