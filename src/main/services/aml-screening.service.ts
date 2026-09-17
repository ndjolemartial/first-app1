import { getDb } from './db.service';
import logger from '../utils/logger';

type Db = ReturnType<typeof getDb>;

/**
 * Criblage de masse LBC/FT — croise l'ensemble des entités en relation
 * d'affaires (Clients, Prospects, Propriétaires, Apporteurs d'affaires) avec le
 * Référentiel de vigilance (`AmlWatchlist`).
 *
 * Distinct du criblage profil-par-profil (`aml:watchlist:screen` →
 * `AmlWatchlistMatch`, qui exige un `AmlProfile`) : ici, aucun profil n'est
 * requis, les correspondances vivent dans `AmlScreeningHit` (dédupliquées sur
 * entité × entrée du référentiel) et chaque exécution est tracée dans
 * `AmlScreeningRun` (preuve de criblage auto-générée).
 *
 * Déclenchements :
 *   - manuel (bouton « Lancer un criblage maintenant ») ;
 *   - à l'ajout d'une entité (fire-and-forget dans clients/owners/prospects/
 *     commissions IPC) ;
 *   - à chaque mutation du référentiel (`aml:watchlist:create/update/delete`) ;
 *   - planifié (`scheduleAmlScreening`, présets quotidien/hebdo/mensuel).
 */

/* ─── Correspondance de noms ──────────────────────────────────── */

/** Normalise un nom : minuscules, sans diacritiques, ponctuation → espace. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les diacritiques combinants
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jetons significatifs (≥ 2 caractères), distincts, d'un nom normalisé. */
export function nameTokens(s: string): string[] {
  return Array.from(new Set(normalizeName(s).split(' ').filter((t) => t.length >= 2)));
}

/**
 * Vrai si `a` et `b` désignent vraisemblablement la même personne/entité : tous
 * les jetons du nom le plus court sont présents dans le nom le plus long, avec
 * **au moins 2 jetons** de part et d'autre. Volontairement strict — un nom
 * mono-jeton (prénom seul, alias isolé) ne suffit jamais, sous peine d'un
 * volume ingérable de faux positifs sur un criblage de toute la base.
 */
export function namesMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length < 2 || tb.length < 2) return false;
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const longerSet = new Set(longer);
  return shorter.every((t) => longerSet.has(t));
}

/* ─── Entités criblées ────────────────────────────────────────── */

export type ScreeningEntityType = 'CLIENT' | 'PROSPECT' | 'OWNER' | 'REFERRER';

export interface ScreeningScope {
  CLIENT: boolean;
  PROSPECT: boolean;
  OWNER: boolean;
  REFERRER: boolean;
}

const FULL_SCOPE: ScreeningScope = { CLIENT: true, PROSPECT: true, OWNER: true, REFERRER: true };

interface EntityRow {
  entityType: ScreeningEntityType;
  entityId: number;
  label: string;
  names: string[];
}

function personNames(firstName?: string | null, lastName?: string | null, company?: string | null): { label: string; names: string[] } {
  const fn = (firstName ?? '').trim();
  const ln = (lastName ?? '').trim();
  const co = (company ?? '').trim();
  const label = co || [ln, fn].filter(Boolean).join(' ') || co || '—';
  const names: string[] = [];
  if (fn || ln) {
    names.push([fn, ln].filter(Boolean).join(' '));
    names.push([ln, fn].filter(Boolean).join(' '));
  }
  if (co) names.push(co);
  return { label, names: Array.from(new Set(names.filter(Boolean))) };
}

async function loadEntities(db: Db, scope: ScreeningScope, only?: { type: ScreeningEntityType; id: number }): Promise<EntityRow[]> {
  const rows: EntityRow[] = [];

  const wantType = (t: ScreeningEntityType) => scope[t] && (!only || only.type === t);
  const idFilter = (t: ScreeningEntityType) => (only && only.type === t ? { id: only.id } : {});

  if (wantType('CLIENT')) {
    const clients = await db.client.findMany({
      where: { deletedAt: null, ...idFilter('CLIENT') },
      select: { id: true, firstName: true, lastName: true, entreprise: true },
    });
    for (const c of clients) {
      const { label, names } = personNames(c.firstName, c.lastName, c.entreprise);
      if (names.length) rows.push({ entityType: 'CLIENT', entityId: c.id, label, names });
    }
  }
  if (wantType('PROSPECT')) {
    const prospects = await db.prospect.findMany({
      where: { deletedAt: null, ...idFilter('PROSPECT') },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const p of prospects) {
      const { label, names } = personNames(p.firstName, p.lastName, null);
      if (names.length) rows.push({ entityType: 'PROSPECT', entityId: p.id, label, names });
    }
  }
  if (wantType('OWNER')) {
    const owners = await db.owner.findMany({
      where: { deletedAt: null, ...idFilter('OWNER') },
      select: { id: true, firstName: true, lastName: true, companyName: true },
    });
    for (const o of owners) {
      const { label, names } = personNames(o.firstName, o.lastName, o.companyName);
      if (names.length) rows.push({ entityType: 'OWNER', entityId: o.id, label, names });
    }
  }
  if (wantType('REFERRER')) {
    const referrers = await db.businessReferrer.findMany({
      where: { deletedAt: null, ...idFilter('REFERRER') },
      select: { id: true, firstName: true, lastName: true, companyName: true },
    });
    for (const r of referrers) {
      const { label, names } = personNames(r.firstName, r.lastName, r.companyName);
      if (names.length) rows.push({ entityType: 'REFERRER', entityId: r.id, label, names });
    }
  }
  return rows;
}

/* ─── Run ─────────────────────────────────────────────────────── */

export type ScreeningTrigger = 'MANUEL' | 'ENTITE_AJOUTEE' | 'REFERENTIEL_MAJ' | 'PLANIFIE';

export interface RunScreeningOptions {
  trigger: ScreeningTrigger;
  scope?: Partial<ScreeningScope>;
  operatorId?: number | null;
  operatorName?: string | null;
  /** Restreint le criblage à une seule entité (déclenchement « à l'ajout »). */
  onlyEntity?: { type: ScreeningEntityType; id: number };
}

async function nextRunReference(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.amlScreeningRun.findFirst({
    where: { reference: { startsWith: `CRIB-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `CRIB-${year}-${String(seq).padStart(4, '0')}`;
}

export interface RunScreeningResult {
  runId: number;
  reference: string;
  entitiesScreened: number;
  hitsNew: number;
  hitsTotal: number;
}

/** Exécute un criblage et persiste `AmlScreeningRun` + `AmlScreeningHit`. */
export async function runScreening(opts: RunScreeningOptions): Promise<RunScreeningResult> {
  const db = getDb();
  const scope: ScreeningScope = { ...FULL_SCOPE, ...(opts.scope ?? {}) };
  if (opts.onlyEntity) {
    for (const t of Object.keys(scope) as ScreeningEntityType[]) scope[t] = t === opts.onlyEntity.type;
  }

  const baseAlert = await db.amlWatchlistAlert.findFirst({
    where: { deletedAt: null, integratedAt: { not: null } },
    orderBy: { integratedAt: 'desc' },
    select: { id: true, reference: true, title: true, integratedAt: true },
  });
  const baseVersionLabel = baseAlert
    ? `${baseAlert.reference} — ${baseAlert.title} (intégrée le ${baseAlert.integratedAt?.toISOString().slice(0, 10)})`
    : 'Référentiel interne — aucune alerte enregistrée';

  const reference = await nextRunReference(db);
  const run = await db.amlScreeningRun.create({
    data: {
      reference,
      trigger: opts.trigger,
      status: 'EN_COURS',
      baseAlertId: baseAlert?.id ?? null,
      baseVersionLabel,
      scopeClients: scope.CLIENT,
      scopeProspects: scope.PROSPECT,
      scopeOwners: scope.OWNER,
      scopeReferrers: scope.REFERRER,
      operatorId: opts.operatorId ?? null,
      operatorName: opts.operatorName ?? (opts.trigger === 'PLANIFIE' ? 'Système (planifié)' : null),
    },
  });

  try {
    const watchlist = await db.amlWatchlist.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, aliases: true },
    });
    const wlNames = watchlist.map((w) => ({
      id: w.id,
      terms: [w.name, ...(Array.isArray(w.aliases) ? (w.aliases as string[]) : [])].filter((t): t is string => !!t && t.trim().length > 0),
    }));

    const entities = await loadEntities(db, scope, opts.onlyEntity);

    // Correspondances trouvées lors de ce run.
    type Found = { entityType: ScreeningEntityType; entityId: number; label: string; watchlistId: number; matchedOn: string; detail: string };
    const found: Found[] = [];
    for (const ent of entities) {
      for (const wl of wlNames) {
        let hitTerm: { entTerm: string; refTerm: string } | null = null;
        for (const refTerm of wl.terms) {
          for (const entTerm of ent.names) {
            if (namesMatch(entTerm, refTerm)) { hitTerm = { entTerm, refTerm }; break; }
          }
          if (hitTerm) break;
        }
        if (hitTerm) {
          found.push({
            entityType: ent.entityType,
            entityId: ent.entityId,
            label: ent.label,
            watchlistId: wl.id,
            matchedOn: hitTerm.refTerm,
            detail: `« ${hitTerm.entTerm} » (entité) ↔ « ${hitTerm.refTerm} » (référentiel)`,
          });
        }
      }
    }

    // Clés existantes pour les types du périmètre → distinguer création / mise à jour.
    const scopedTypes = (Object.keys(scope) as ScreeningEntityType[]).filter((t) => scope[t]);
    const existing = await db.amlScreeningHit.findMany({
      where: opts.onlyEntity
        ? { entityType: opts.onlyEntity.type, entityId: opts.onlyEntity.id }
        : { entityType: { in: scopedTypes } },
      select: { id: true, entityType: true, entityId: true, watchlistId: true },
    });
    const keyOf = (t: string, e: number, w: number) => `${t}#${e}#${w}`;
    const existingMap = new Map(existing.map((h) => [keyOf(h.entityType, h.entityId, h.watchlistId), h.id]));

    const now = new Date();
    let hitsNew = 0;
    const seenKeys = new Set<string>();
    for (const f of found) {
      const key = keyOf(f.entityType, f.entityId, f.watchlistId);
      seenKeys.add(key);
      const existingId = existingMap.get(key);
      if (existingId) {
        await db.amlScreeningHit.update({
          where: { id: existingId },
          data: {
            entityLabel: f.label,
            matchedOn: f.matchedOn,
            matchDetail: f.detail,
            lastRunId: run.id,
            lastDetectedAt: now,
            stillMatching: true,
          },
        });
      } else {
        await db.amlScreeningHit.create({
          data: {
            entityType: f.entityType,
            entityId: f.entityId,
            entityLabel: f.label,
            watchlistId: f.watchlistId,
            matchedOn: f.matchedOn,
            matchDetail: f.detail,
            runId: run.id,
            lastRunId: run.id,
            firstDetectedAt: now,
            lastDetectedAt: now,
          },
        });
        hitsNew += 1;
      }
    }

    // Les correspondances du périmètre non revues par ce run ne matchent plus.
    const staleIds = existing
      .filter((h) => !seenKeys.has(keyOf(h.entityType, h.entityId, h.watchlistId)))
      .map((h) => h.id);
    if (staleIds.length) {
      await db.amlScreeningHit.updateMany({ where: { id: { in: staleIds }, stillMatching: true }, data: { stillMatching: false } });
    }

    const hitsTotal = await db.amlScreeningHit.count({
      where: { stillMatching: true, ...(opts.onlyEntity ? {} : { entityType: { in: scopedTypes } }) },
    });

    const finished = await db.amlScreeningRun.update({
      where: { id: run.id },
      data: {
        status: 'TERMINE',
        finishedAt: new Date(),
        watchlistCount: watchlist.length,
        entitiesScreened: entities.length,
        hitsNew,
        hitsTotal,
      },
    });
    logger.info(`[aml-screening] ${finished.reference} (${opts.trigger}) — ${entities.length} entités, ${hitsNew} nouvelles correspondances, ${hitsTotal} au total`);
    return { runId: run.id, reference: finished.reference, entitiesScreened: entities.length, hitsNew, hitsTotal };
  } catch (err: any) {
    await db.amlScreeningRun.update({
      where: { id: run.id },
      data: { status: 'ECHEC', finishedAt: new Date(), errorMsg: err.message },
    });
    logger.error(`[aml-screening] run ${run.reference} failed: ${err.message}`);
    throw err;
  }
}

/** Crible une seule entité nouvellement créée (fire-and-forget côté IPC). */
export function screenEntity(type: ScreeningEntityType, id: number, opts: { trigger?: ScreeningTrigger; operatorId?: number | null } = {}): Promise<RunScreeningResult> {
  return runScreening({
    trigger: opts.trigger ?? 'ENTITE_AJOUTEE',
    operatorId: opts.operatorId ?? null,
    onlyEntity: { type, id },
  });
}

/* ─── Planification ───────────────────────────────────────────── */

export type ScreeningFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface AmlScreeningSchedule {
  enabled: boolean;
  frequency: ScreeningFrequency;
  weekday: number; // 0=dimanche … 6=samedi (fréquence WEEKLY)
  monthday: number; // 1..28 (fréquence MONTHLY)
  hour: number; // 0..23 — heure à partir de laquelle la passe du jour peut s'exécuter
}

const DEFAULT_SCHEDULE: AmlScreeningSchedule = { enabled: false, frequency: 'WEEKLY', weekday: 1, monthday: 1, hour: 2 };
const SCHEDULE_KEY = 'aml.screening.schedule';
const LAST_RUN_KEY = 'aml.screening.lastRunAt';

export async function getAmlScreeningSchedule(db: Db = getDb()): Promise<AmlScreeningSchedule> {
  const row = await db.appSetting.findUnique({ where: { key: SCHEDULE_KEY } });
  if (!row?.value) return DEFAULT_SCHEDULE;
  try {
    return { ...DEFAULT_SCHEDULE, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export async function setAmlScreeningSchedule(schedule: AmlScreeningSchedule, db: Db = getDb()): Promise<void> {
  await db.appSetting.upsert({
    where: { key: SCHEDULE_KEY },
    create: { key: SCHEDULE_KEY, value: JSON.stringify(schedule) },
    update: { value: JSON.stringify(schedule) },
  });
}

async function getLastRunAt(db: Db): Promise<Date | null> {
  const row = await db.appSetting.findUnique({ where: { key: LAST_RUN_KEY } });
  return row?.value ? new Date(row.value) : null;
}

async function setLastRunAt(db: Db, when: Date): Promise<void> {
  await db.appSetting.upsert({
    where: { key: LAST_RUN_KEY },
    create: { key: LAST_RUN_KEY, value: when.toISOString() },
    update: { value: when.toISOString() },
  });
}

/** Numéro de semaine ISO (lundi–dimanche) au format `AAAA-Wnn`. */
function isoYearWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7; // dimanche 0 → 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum); // jeudi de la semaine courante
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Clé de la période calendaire courante selon la fréquence : deux dates qui
 * partagent la même clé appartiennent à la même période — la passe planifiée
 * ne s'exécute donc **qu'une seule fois** par période, quel que soit le rythme
 * réel de déclenchement (setInterval 30 min in-process, ou tâche planifiée du
 * système exécutant `run-aml-screening-once.js`).
 */
function periodKey(freq: ScreeningFrequency, d: Date): string {
  if (freq === 'MONTHLY') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (freq === 'WEEKLY') return isoYearWeek(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const normDow = (i: number) => (i === 0 ? 7 : i); // getDay : dimanche 0 → 7 (fin de semaine)

export function isScreeningDue(sched: AmlScreeningSchedule, lastRunAt: Date | null, now: Date): boolean {
  if (!sched.enabled) return false;
  if (now.getHours() < sched.hour) return false;
  if (!lastRunAt) return true;
  // Déjà exécuté dans la période calendaire courante (jour / semaine ISO /
  // mois) → rien à faire, même si l'échéance « théorique » est repassée.
  if (periodKey(sched.frequency, lastRunAt) === periodKey(sched.frequency, now)) return false;
  if (sched.frequency === 'DAILY') return true;
  // Nouvelle période : dû dès que le jour visé est atteint — ou dépassé
  // (rattrapage si la machine était éteinte ce jour-là).
  if (sched.frequency === 'WEEKLY') return normDow(now.getDay()) >= normDow(sched.weekday);
  return now.getDate() >= sched.monthday; // MONTHLY
}

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 min — la passe vérifie elle-même l'échéance.
let scheduledHandle: NodeJS.Timeout | null = null;

export interface ScheduledScreeningOutcome {
  ran: boolean;
  reference?: string;
  entitiesScreened?: number;
  hitsNew?: number;
  hitsTotal?: number;
  skippedReason?: string;
}

/**
 * Le Référentiel de vigilance a-t-il été modifié depuis le dernier criblage
 * **complet** mené à terme ? Compare `MAX(AmlWatchlist.updatedAt)` (créations,
 * modifications et suppressions douces passent toutes par `.create()`/
 * `.update()`, qui posent `@updatedAt`) à la date de démarrage du dernier
 * `AmlScreeningRun` de périmètre complet (`MANUEL` / `REFERENTIEL_MAJ` /
 * `PLANIFIE` — pas `ENTITE_AJOUTEE`, qui ne crible qu'une entité).
 */
async function watchlistChangedSinceLastFullScreening(db: Db): Promise<boolean> {
  const [wlMax, lastRun] = await Promise.all([
    db.amlWatchlist.aggregate({ _max: { updatedAt: true } }),
    db.amlScreeningRun.findFirst({
      where: { status: 'TERMINE', trigger: { in: ['MANUEL', 'REFERENTIEL_MAJ', 'PLANIFIE'] } },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
  ]);
  const lastChange = wlMax._max.updatedAt;
  if (!lastChange) return false; // référentiel vide
  return !lastRun || lastChange > lastRun.startedAt;
}

/**
 * Exécute une passe de criblage **si elle est due** — soit au regard de
 * `aml.screening.schedule` (fréquence quotidienne / hebdomadaire / mensuelle),
 * soit parce que le **Référentiel de vigilance a été modifié** depuis le
 * dernier criblage complet (exigence : « un criblage s'exécute à chaque mise à
 * jour du Référentiel de vigilance ») — ou **inconditionnellement** si `force`.
 *
 * Le volet « référentiel modifié » est un **filet de sécurité** : le criblage
 * immédiat déclenché en fire-and-forget par `aml:watchlist:create/update/
 * delete` reste le chemin principal, mais il peut ne pas aboutir (app fermée
 * avant la fin de la passe, ou modification faite hors application via un
 * script / Prisma Studio). Il s'applique **même si la planification périodique
 * est désactivée**.
 *
 * Logique unique partagée par le planificateur in-process (`scheduleAmlScreening`,
 * `setInterval` 30 min) et le script autonome `run-aml-screening-once.ts`.
 */
export async function runScheduledScreening(
  opts: { force?: boolean; operatorName?: string } = {},
): Promise<ScheduledScreeningOutcome> {
  const db = getDb();
  const sched = await getAmlScreeningSchedule(db);
  const lastRunAt = await getLastRunAt(db);

  const dueByFrequency = opts.force || isScreeningDue(sched, lastRunAt, new Date());
  const wlChanged = !dueByFrequency && (await watchlistChangedSinceLastFullScreening(db));

  if (!dueByFrequency && !wlChanged) {
    return {
      ran: false,
      skippedReason: !sched.enabled
        ? 'planification désactivée'
        : `pas encore dû (fréquence ${sched.frequency})`,
    };
  }

  const result = await runScreening({
    trigger: wlChanged ? 'REFERENTIEL_MAJ' : 'PLANIFIE',
    operatorName: opts.operatorName ?? (wlChanged ? 'Système (référentiel modifié)' : 'Système (planifié)'),
  });
  // Marqueur de fréquence : mis à jour uniquement pour une vraie passe
  // planifiée — un rattrapage « référentiel modifié » ne décale pas le
  // calendrier hebdo/mensuel.
  if (dueByFrequency) await setLastRunAt(db, new Date());

  return {
    ran: true,
    reference: result.reference,
    entitiesScreened: result.entitiesScreened,
    hitsNew: result.hitsNew,
    hitsTotal: result.hitsTotal,
  };
}

/** Démarre la passe planifiée du criblage (in-process, tant que l'app tourne). */
export function scheduleAmlScreening(): void {
  runScheduledScreening().catch((e) => logger.error(`Initial AML screening pass failed: ${e.message}`));
  if (scheduledHandle) return;
  scheduledHandle = setInterval(() => {
    runScheduledScreening().catch((e) => logger.error(`Scheduled AML screening pass failed: ${e.message}`));
  }, POLL_INTERVAL_MS);
}
