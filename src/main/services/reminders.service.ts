import { getDb } from './db.service';
import { sendEmail } from './email.service';
import { sendSms } from './sms.service';
import {
  SettingsKeys,
  getSettings,
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
  OVERDUE_EMAIL:         '[Politique] Relance — Échéance dépassée (Email)',
  OVERDUE_SMS:           '[Politique] Relance — Échéance dépassée (SMS)',
  OVERDUE_FINAL_EMAIL:   '[Politique] Mise en demeure — Retard important (Email)',
  CONV_EXPIRING_EMAIL:   '[Politique] Convention — Expiration prochaine (Email)',
  CONV_EXPIRING_SMS:     '[Politique] Convention — Expiration prochaine (SMS)',
} as const;

interface SeedTemplate {
  marker:   string;
  channel:  'EMAIL' | 'SMS';
  subject?: string;
  body:     string;
}

const SEED_TEMPLATES: SeedTemplate[] = [
  {
    marker: TPL_CODES.UPCOMING_EMAIL,
    channel: 'EMAIL',
    subject: 'Échéance à venir — convention {{conventionRef}}',
    body:
`Bonjour {{fullName}},

Nous vous rappelons que l'échéance n° {{installmentNumber}} de votre convention {{conventionRef}} est due le {{dueDate}} pour un montant de {{amount}} F CFA.

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
    subject: 'Échéance impayée — convention {{conventionRef}}',
    body:
`Bonjour {{fullName}},

Sauf erreur de notre part, l'échéance n° {{installmentNumber}} de votre convention {{conventionRef}}, due le {{dueDate}} pour un montant de {{amount}} F CFA, demeure impayée depuis {{daysLate}} jour(s).

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
    subject: 'Mise en demeure — convention {{conventionRef}}',
    body:
`Bonjour {{fullName}},

Malgré nos précédents rappels, l'échéance n° {{installmentNumber}} de votre convention {{conventionRef}}, d'un montant de {{amount}} F CFA initialement due le {{dueDate}}, demeure impayée à ce jour ({{daysLate}} jours de retard).

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
];

interface SeedRule {
  code:        string;
  name:        string;
  description?: string;
  triggerType: ReminderTriggerType;
  offsetDays:  number;
  channel:     'EMAIL' | 'SMS';
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
];

// ── Seed idempotent ──────────────────────────────────────────────────────────

export async function seedDefaultRemindersConfig(): Promise<void> {
  const db = getDb() as any;

  // 1. Templates (par nom : on ne recrée pas si présent).
  const templateIdByMarker = new Map<string, number>();
  for (const t of SEED_TEMPLATES) {
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

  // 2. Règles (par code : idempotent).
  for (const r of SEED_RULES) {
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

// ── Rendu des templates ──────────────────────────────────────────────────────

function render(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

function buildClientName(c: { type: string; firstName?: string | null; lastName?: string | null; entreprise?: string | null }): string {
  if (c.type === 'ENTREPRISE') return c.entreprise ?? '';
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
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
            client:    inst.convention?.client ?? null,
            renderVars: {
              ...companyVars,
              fullName:           buildClientName(inst.convention?.client ?? { type: 'INDIVIDUEL' }),
              firstName:          inst.convention?.client?.firstName ?? '',
              lastName:           inst.convention?.client?.lastName ?? '',
              conventionRef:      inst.convention?.reference ?? '',
              installmentNumber:  inst.installmentNumber,
              dueDate:            formatDateFr(inst.dueDate),
              amount:             formatAmount(inst.amount as any),
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
      } else if (rule.triggerType === 'CONVENTION_EXPIRING') {
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
  if (rule.channel === 'SMS'   && client.smsOptOut)   { result.skipped += 1; bump('sms_opt_out');   return; }

  const recipient = rule.channel === 'EMAIL'
    ? (client.email ?? '')
    : (client.mobile ?? client.phone ?? '');
  if (!recipient) { result.skipped += 1; bump(rule.channel === 'EMAIL' ? 'no_email' : 'no_phone'); return; }

  // Anti-doublon — unique sur Communication.dedupeKey.
  const already = await db.communication.findUnique({ where: { dedupeKey } });
  if (already) { result.skipped += 1; bump('already_sent'); return; }

  const subject = rule.template.subject ? render(rule.template.subject, renderVars) : null;
  const body    = render(rule.template.body, renderVars);

  const comm = await db.communication.create({
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

  try {
    if (rule.channel === 'EMAIL') {
      await sendEmail({ to: recipient, subject: subject ?? '(sans objet)', body });
    } else {
      await sendSms(recipient, body);
    }
    await db.communication.update({
      where: { id: comm.id },
      data:  { status: 'ENVOYE', sentAt: new Date() },
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
