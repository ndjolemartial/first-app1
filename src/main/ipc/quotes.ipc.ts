import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Module Devis.
 *
 * Lecture : tous les rôles authentifiés. Écriture (création / édition / envoi /
 * acceptation / refus) : AGENT et plus (le devis est au cœur du métier
 * commercial). Conversion en convention : réservée aux MANAGER+ (mêmes droits
 * que le module Conventions).
 */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT'];
const READ_ROLES = [...WRITE_ROLES, 'ACCOUNTANT', 'READONLY'];
const CONVERT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/**
 * Rôles ayant accès à TOUS les devis. Les autres rôles (AGENT, AGENT_TECHNIQUE,
 * ASSISTANTE_DIRECTION, READONLY) ne voient et ne manipulent que les devis
 * qu'ils ont eux-mêmes créés (createdById).
 */
const QUOTE_FULL_ACCESS = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/** Filtre Prisma de visibilité : `{}` (tout) ou restreint à ses propres devis. */
function scopeWhere(session: { role: string; userId: number }): Record<string, unknown> {
  return QUOTE_FULL_ACCESS.includes(session.role) ? {} : { createdById: session.userId };
}

/** Vrai si la session peut accéder/modifier un devis créé par `createdById`. */
function canAccessQuote(session: { role: string; userId: number }, createdById: number | null): boolean {
  return QUOTE_FULL_ACCESS.includes(session.role) || createdById === session.userId;
}

const PAYMENT_MODALITES = [
  'CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS',
  'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS',
] as const;

const QUOTE_TYPES = ['VENTE_TERRAIN', 'VENTE_BIEN', 'PRESTATION', 'FRAIS'] as const;

/** Sérialise les Decimal Prisma (non clonables par l'IPC Electron). */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const QUOTE_ITEM_LINE_TYPES = ['ARTICLE', 'TITLE', 'SUBTITLE'] as const;

const itemSchema = z.object({
  lineType: z.enum(QUOTE_ITEM_LINE_TYPES).default('ARTICLE'),
  designation: z.string().min(1, 'Désignation requise'),
  reference: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  quantity: z.number().min(0).default(1),
  unit: z.string().nullable().optional(),
  unitPrice: z.number().min(0).default(0),
  catalogItemId: z.number().int().positive().nullable().optional(),
});

/**
 * Normalise une ligne de devis : les lignes de titre/sous-titre ne portent
 * qu'un texte (désignation) — quantité, prix, unité, référence et catégorie
 * sont forcés à vide/zéro côté serveur, quoi qu'ait envoyé le client, afin
 * qu'elles ne puissent jamais impacter les totaux.
 */
function normalizeItem<T extends { lineType?: string; quantity: number; unitPrice: number; unit?: string | null; reference?: string | null; category?: string | null; catalogItemId?: number | null }>(it: T): T {
  if (it.lineType === 'ARTICLE' || !it.lineType) return it;
  return { ...it, quantity: 0, unitPrice: 0, unit: null, reference: null, category: null, catalogItemId: null };
}

const quoteBaseSchema = z.object({
  type: z.enum(QUOTE_TYPES).default('VENTE_TERRAIN'),
  objet: z.string().max(255).nullable().optional(),
  prospectId: z.number().int().positive().nullable().optional(),
  clientId: z.number().int().positive().nullable().optional(),
  terrainId: z.number().int().positive().nullable().optional(),
  propertyId: z.number().int().positive().nullable().optional(),
  // Sélection multiple de terrains/biens (mêmes principe que les Attestations) —
  // `terrainId`/`propertyId` restent en scalaires (alignés sur le 1ᵉʳ élément)
  // pour compatibilité avec la conversion en convention/facture.
  terrainIds: z.array(z.number().int().positive()).optional(),
  propertyIds: z.array(z.number().int().positive()).optional(),
  programmeId: z.number().int().positive().nullable().optional(),
  lotissementId: z.number().int().positive().nullable().optional(),
  agentId: z.number().int().positive().nullable().optional(),
  validUntil: z.string().optional(),
  discountAmount: z.number().min(0).default(0),
  // Remise en pourcentage (du sous-total) : si actif, discountAmount est
  // recalculé côté serveur à partir de discountPercent.
  discountIsPercent: z.boolean().default(false),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  taxRate: z.number().min(0).max(100).default(0),
  depositExpected: z.number().min(0).nullable().optional(),
  // Acompte attendu en pourcentage (du total TTC) : si actif, depositExpected
  // est recalculé côté serveur à partir de depositPercent.
  depositIsPercent: z.boolean().default(false),
  depositPercent: z.number().min(0).max(100).nullable().optional(),
  paymentModalites: z.enum(PAYMENT_MODALITES).default('CASH'),
  installmentCount: z.number().int().positive().nullable().optional(),
  notes: z.string().optional(),
  conditions: z.string().optional(),
  templateId: z.number().int().positive().nullable().optional(),
  referenceColumnLabel: z.string().max(50).nullable().optional(),
  items: z.array(itemSchema).default([]),
});

const createSchema = quoteBaseSchema.refine(
  (d) => !!d.prospectId || !!d.clientId,
  { message: 'Un devis doit être adressé à un prospect ou un client' },
);

const INCLUDE = {
  client: { select: { id: true, reference: true, type: true, firstName: true, lastName: true, entreprise: true, email: true, phone: true, mobile: true } },
  prospect: { select: { id: true, reference: true, firstName: true, lastName: true, email: true, phone: true } },
  terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true, surface: true, statut: true, lotissement: { select: { id: true, nom: true, ville: true } } } },
  property: { select: { id: true, reference: true, address: true, city: true, status: true } },
  programme: { select: { id: true, reference: true, nom: true } },
  lotissement: { select: { id: true, reference: true, nom: true, ville: true } },
  agent: { select: { id: true, firstName: true, lastName: true, nomCommercial: true, matricule: true } },
  template: { select: { id: true, name: true } },
  items: { orderBy: { order: 'asc' as const } },
  // Sélection multiple de terrains/biens.
  terrains: {
    orderBy: { order: 'asc' as const },
    include: { terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true, surface: true, statut: true, lotissement: { select: { id: true, nom: true, ville: true } } } } },
  },
  properties: {
    orderBy: { order: 'asc' as const },
    include: { property: { select: { id: true, reference: true, address: true, city: true, status: true, programme: { select: { id: true, nom: true } } } } },
  },
};

/** Déduplique une liste d'identifiants en conservant l'ordre. */
function dedupeIds(ids: number[]): number[] {
  return Array.from(new Set(ids));
}

/** Vérifie que les terrains d'un devis (sélection multiple) proviennent tous du même lotissement. */
async function assertSingleLotissement(db: ReturnType<typeof getDb>, terrainIds: number[] | undefined): Promise<void> {
  if (!terrainIds || terrainIds.length < 2) return;
  const terrains = await db.terrain.findMany({ where: { id: { in: terrainIds } }, select: { id: true, lotissementId: true } });
  const lotIds = new Set(terrains.map((t) => t.lotissementId));
  if (lotIds.size > 1) {
    throw new Error('Tous les terrains d\'un devis doivent provenir du même lotissement.');
  }
}

/**
 * Vérifie que les biens d'un devis (sélection multiple) proviennent du même
 * programme immobilier lorsque celui-ci est déterminable (un bien sans
 * programme n'impose aucune contrainte).
 */
async function assertSingleProgramme(db: ReturnType<typeof getDb>, propertyIds: number[] | undefined): Promise<void> {
  if (!propertyIds || propertyIds.length < 2) return;
  const properties = await db.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, programmeId: true } });
  const programmeIds = new Set(properties.map((p) => p.programmeId).filter((id): id is number => id != null));
  if (programmeIds.size > 1) {
    throw new Error('Tous les biens immobiliers d\'un devis doivent provenir du même programme immobilier.');
  }
}

/** Référence auto DEV-YYYY-NNNN (séquence annuelle). */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.quote.findFirst({
    where: { reference: { startsWith: `DEV-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `DEV-${year}-${String(seq).padStart(4, '0')}`;
}

/** Référence auto CV-YYYY-NNNN (conventions). */
async function nextConventionRef(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.convention.findFirst({
    where: { reference: { startsWith: `CV-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `CV-${year}-${String(seq).padStart(4, '0')}`;
}

/** Référence auto FAC-YYYY-NNNN (factures). */
async function nextInvoiceRef(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.invoice.findFirst({
    where: { reference: { startsWith: `FAC-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `FAC-${year}-${String(seq).padStart(4, '0')}`;
}

/** Calcule les totaux d'un devis à partir des lignes, de la remise et de la TVA. */
function computeTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  discountAmount: number,
  taxRate: number,
): { subtotal: number; taxAmount: number; total: number; lines: Array<{ total: number }> } {
  const lines = items.map((i) => ({ total: Math.round(i.quantity * i.unitPrice * 100) / 100 }));
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const base = Math.max(0, subtotal - (discountAmount || 0));
  const taxAmount = Math.round(base * (taxRate || 0)) / 100;
  const total = Math.round((base + taxAmount) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, taxAmount, total, lines };
}

/**
 * Résout les montants d'un devis en tenant compte des modes « pourcentage » :
 *  - remise en % → discountAmount = pourcentage du sous-total ;
 *  - acompte en % → depositExpected = pourcentage du total TTC.
 * Le montant absolu reste la source de vérité stockée et utilisée par les
 * documents ; le pourcentage n'est qu'un mode de saisie.
 */
function resolveQuoteAmounts(
  items: Array<{ quantity: number; unitPrice: number }>,
  d: {
    discountAmount?: number; discountIsPercent?: boolean; discountPercent?: number | null;
    depositExpected?: number | null; depositIsPercent?: boolean; depositPercent?: number | null;
    taxRate?: number;
  },
): { subtotal: number; taxAmount: number; total: number; lines: Array<{ total: number }>; discountAmount: number; depositExpected: number | null } {
  const rawSubtotal = items.reduce((s, i) => s + Math.round((i.quantity || 0) * (i.unitPrice || 0) * 100) / 100, 0);
  const discountAmount = d.discountIsPercent
    ? Math.round(rawSubtotal * ((d.discountPercent ?? 0) / 100) * 100) / 100
    : (d.discountAmount ?? 0);
  const { subtotal, taxAmount, total, lines } = computeTotals(items, discountAmount, d.taxRate ?? 0);
  const depositExpected = d.depositIsPercent
    ? Math.round(total * ((d.depositPercent ?? 0) / 100) * 100) / 100
    : (d.depositExpected ?? null);
  return { subtotal, taxAmount, total, lines, discountAmount, depositExpected };
}

/** Promeut en EXPIRE les devis ENVOYE/BROUILLON dont la validité est dépassée. */
async function expireOverdue(db: ReturnType<typeof getDb>): Promise<void> {
  await db.quote.updateMany({
    where: {
      deletedAt: null,
      status: { in: ['BROUILLON', 'ENVOYE'] },
      validUntil: { not: null, lt: new Date() },
    },
    data: { status: 'EXPIRE' },
  });
}

export function registerQuotesIPC(): void {
  ipcMain.handle('quotes:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      await expireOverdue(db);
      const where: any = { deletedAt: null, ...scopeWhere(session) };
      if (filters.status) where.status = filters.status;
      if (filters.type) where.type = filters.type;
      if (filters.clientId) where.clientId = Number(filters.clientId);
      if (filters.prospectId) where.prospectId = Number(filters.prospectId);
      if (filters.terrainId) where.terrainId = Number(filters.terrainId);
      if (filters.agentId) where.agentId = Number(filters.agentId);
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { notes: { contains: filters.search } },
          { client: { is: { OR: [
            { firstName: { contains: filters.search } },
            { lastName: { contains: filters.search } },
            { entreprise: { contains: filters.search } },
          ] } } },
          { prospect: { is: { OR: [
            { firstName: { contains: filters.search } },
            { lastName: { contains: filters.search } },
          ] } } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.quote.findMany({ where, include: INCLUDE, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        db.quote.count({ where }),
      ]);
      return { success: true, data: ser(data), total };
    } catch (error: any) {
      logger.error('quotes:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('quotes:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const quote = await db.quote.findUnique({ where: { id: Number(id) }, include: INCLUDE });
      if (!quote || quote.deletedAt) return { success: false, error: 'Devis introuvable' };
      if (!canAccessQuote(session, quote.createdById)) return { success: false, error: 'Devis inaccessible' };
      return { success: true, data: ser(quote) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('quotes:stats', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      await expireOverdue(db);
      const rows = await db.quote.groupBy({
        by: ['status'],
        where: { deletedAt: null, ...scopeWhere(session) },
        _count: { _all: true },
        _sum: { total: true },
      });
      const stats: Record<string, { count: number; total: number }> = {};
      let count = 0;
      for (const r of rows) {
        stats[r.status as string] = { count: r._count?._all ?? 0, total: Number(r._sum?.total ?? 0) };
        count += r._count?._all ?? 0;
      }
      // Taux de transformation : ACCEPTE / (envoyés au total)
      const accepted = stats['ACCEPTE']?.count ?? 0;
      const decided = accepted + (stats['REFUSE']?.count ?? 0) + (stats['EXPIRE']?.count ?? 0);
      const conversionRate = decided > 0 ? Math.round((accepted / decided) * 100) : 0;
      return { success: true, data: { byStatus: stats, count, conversionRate } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('quotes:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = createSchema.safeParse(payload);
      if (!parsed.success) {
        logger.error('quotes validation error', JSON.stringify(parsed.error.issues));
        return { success: false, error: parsed.error.format() };
      }
      const d = { ...parsed.data, items: parsed.data.items.map(normalizeItem) };
      const db = getDb();
      // Sélection multiple de terrains/biens — repli sur le champ singulier
      // terrainId/propertyId pour compatibilité (anciens payloads mono-bien).
      const terrainIds = dedupeIds(d.terrainIds?.length ? d.terrainIds : (d.terrainId ? [d.terrainId] : []));
      const propertyIds = dedupeIds(d.propertyIds?.length ? d.propertyIds : (d.propertyId ? [d.propertyId] : []));
      await assertSingleLotissement(db, terrainIds);
      await assertSingleProgramme(db, propertyIds);
      const { subtotal, taxAmount, total, lines, discountAmount, depositExpected } = resolveQuoteAmounts(d.items, d);
      const reference = await nextReference(db);
      const quote = await db.quote.create({
        data: {
          reference,
          type: d.type,
          status: 'BROUILLON',
          objet: d.objet?.trim() || null,
          prospectId: d.prospectId ?? null,
          clientId: d.clientId ?? null,
          terrainId: terrainIds[0] ?? null,
          propertyId: propertyIds[0] ?? null,
          programmeId: d.programmeId ?? null,
          lotissementId: d.lotissementId ?? null,
          agentId: d.agentId ?? null,
          validUntil: d.validUntil ? new Date(d.validUntil) : null,
          subtotal: String(subtotal) as never,
          discountAmount: String(discountAmount) as never,
          discountIsPercent: d.discountIsPercent ?? false,
          discountPercent: d.discountIsPercent && d.discountPercent != null ? (String(d.discountPercent) as never) : null,
          taxRate: String(d.taxRate ?? 0) as never,
          taxAmount: String(taxAmount) as never,
          total: String(total) as never,
          depositExpected: depositExpected != null ? (String(depositExpected) as never) : null,
          depositIsPercent: d.depositIsPercent ?? false,
          depositPercent: d.depositIsPercent && d.depositPercent != null ? (String(d.depositPercent) as never) : null,
          paymentModalites: d.paymentModalites,
          installmentCount: d.installmentCount ?? null,
          notes: d.notes ?? null,
          conditions: d.conditions ?? null,
          templateId: d.templateId ?? null,
          referenceColumnLabel: d.referenceColumnLabel?.trim() || null,
          createdById: session.userId,
          terrains: terrainIds.length ? { create: terrainIds.map((terrainId, order) => ({ terrainId, order })) } : undefined,
          properties: propertyIds.length ? { create: propertyIds.map((propertyId, order) => ({ propertyId, order })) } : undefined,
          items: {
            create: d.items.map((it, i) => ({
              lineType: it.lineType,
              designation: it.designation,
              reference: it.reference?.trim() || null,
              category: it.category?.trim() || null,
              quantity: String(it.quantity) as never,
              unit: it.unit?.trim() || null,
              unitPrice: String(it.unitPrice) as never,
              total: String(lines[i].total) as never,
              order: i,
              catalogItemId: it.catalogItemId ?? null,
            })),
          },
        },
        include: INCLUDE,
      });
      logger.info(`Quote created: ${reference}`);
      return { success: true, data: ser(quote) };
    } catch (error: any) {
      logger.error('quotes:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('quotes:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = quoteBaseSchema.partial().safeParse(payload);
      if (!parsed.success) {
        logger.error('quotes validation error', JSON.stringify(parsed.error.issues));
        return { success: false, error: parsed.error.format() };
      }
      const d = { ...parsed.data, items: parsed.data.items?.map(normalizeItem) };
      const db = getDb();
      const existing = await db.quote.findUnique({ where: { id: Number(id) }, include: { items: true } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Devis introuvable' };
      if (!canAccessQuote(session, existing.createdById)) return { success: false, error: 'Devis inaccessible' };
      if (existing.status === 'ACCEPTE' || existing.convertedConventionId) {
        return { success: false, error: 'Un devis accepté ou converti ne peut plus être modifié' };
      }
      // Sélection multiple de terrains/biens — repli sur le champ singulier
      // terrainId/propertyId si seul celui-ci est transmis (compatibilité).
      // `undefined` = non transmis (ne touche pas la sélection existante).
      const terrainIds = d.terrainIds !== undefined
        ? dedupeIds(d.terrainIds)
        : (d.terrainId !== undefined ? (d.terrainId ? [d.terrainId] : []) : undefined);
      const propertyIds = d.propertyIds !== undefined
        ? dedupeIds(d.propertyIds)
        : (d.propertyId !== undefined ? (d.propertyId ? [d.propertyId] : []) : undefined);
      await assertSingleLotissement(db, terrainIds);
      await assertSingleProgramme(db, propertyIds);
      // Recalcule les totaux à partir des lignes fournies (ou existantes), en
      // tenant compte des modes pourcentage (remise / acompte) — fusion des
      // valeurs fournies avec celles déjà enregistrées.
      const items = d.items ?? existing.items.map((it) => ({ quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) }));
      const taxRate = d.taxRate ?? Number(existing.taxRate);
      const discountIsPercent = d.discountIsPercent ?? existing.discountIsPercent;
      const discountPercent = d.discountPercent !== undefined
        ? d.discountPercent
        : (existing.discountPercent != null ? Number(existing.discountPercent) : null);
      const depositIsPercent = d.depositIsPercent ?? existing.depositIsPercent;
      const depositPercent = d.depositPercent !== undefined
        ? d.depositPercent
        : (existing.depositPercent != null ? Number(existing.depositPercent) : null);
      const { subtotal, taxAmount, total, lines, discountAmount, depositExpected } = resolveQuoteAmounts(items, {
        discountAmount: d.discountAmount ?? Number(existing.discountAmount),
        discountIsPercent,
        discountPercent,
        depositExpected: d.depositExpected !== undefined
          ? d.depositExpected
          : (existing.depositExpected != null ? Number(existing.depositExpected) : null),
        depositIsPercent,
        depositPercent,
        taxRate,
      });

      const data: any = {
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.objet !== undefined ? { objet: d.objet?.trim() || null } : {}),
        ...(d.prospectId !== undefined ? { prospectId: d.prospectId } : {}),
        ...(d.clientId !== undefined ? { clientId: d.clientId } : {}),
        ...(terrainIds !== undefined ? { terrainId: terrainIds[0] ?? null } : {}),
        ...(propertyIds !== undefined ? { propertyId: propertyIds[0] ?? null } : {}),
        ...(d.programmeId !== undefined ? { programmeId: d.programmeId } : {}),
        ...(d.lotissementId !== undefined ? { lotissementId: d.lotissementId } : {}),
        ...(d.agentId !== undefined ? { agentId: d.agentId } : {}),
        ...(d.validUntil !== undefined ? { validUntil: d.validUntil ? new Date(d.validUntil) : null } : {}),
        ...(d.paymentModalites !== undefined ? { paymentModalites: d.paymentModalites } : {}),
        ...(d.installmentCount !== undefined ? { installmentCount: d.installmentCount } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.conditions !== undefined ? { conditions: d.conditions } : {}),
        ...(d.templateId !== undefined ? { templateId: d.templateId } : {}),
        ...(d.referenceColumnLabel !== undefined ? { referenceColumnLabel: d.referenceColumnLabel?.trim() || null } : {}),
        discountAmount: String(discountAmount) as never,
        discountIsPercent,
        discountPercent: discountIsPercent && discountPercent != null ? (String(discountPercent) as never) : null,
        depositExpected: depositExpected != null ? (String(depositExpected) as never) : null,
        depositIsPercent,
        depositPercent: depositIsPercent && depositPercent != null ? (String(depositPercent) as never) : null,
        taxRate: String(taxRate) as never,
        subtotal: String(subtotal) as never,
        taxAmount: String(taxAmount) as never,
        total: String(total) as never,
      };

      const quote = await db.$transaction(async (tx) => {
        // Remplace les lignes uniquement si elles sont fournies.
        if (d.items) {
          await tx.quoteItem.deleteMany({ where: { quoteId: Number(id) } });
          await tx.quoteItem.createMany({
            data: d.items.map((it, i) => ({
              quoteId: Number(id),
              lineType: it.lineType,
              designation: it.designation,
              reference: it.reference?.trim() || null,
              category: it.category?.trim() || null,
              quantity: String(it.quantity) as never,
              unit: it.unit?.trim() || null,
              unitPrice: String(it.unitPrice) as never,
              total: String(lines[i].total) as never,
              order: i,
              catalogItemId: it.catalogItemId ?? null,
            })),
          });
        }
        if (terrainIds !== undefined) {
          await tx.quoteTerrain.deleteMany({ where: { quoteId: Number(id) } });
          if (terrainIds.length) {
            await tx.quoteTerrain.createMany({ data: terrainIds.map((terrainId, order) => ({ quoteId: Number(id), terrainId, order })) });
          }
        }
        if (propertyIds !== undefined) {
          await tx.quoteProperty.deleteMany({ where: { quoteId: Number(id) } });
          if (propertyIds.length) {
            await tx.quoteProperty.createMany({ data: propertyIds.map((propertyId, order) => ({ quoteId: Number(id), propertyId, order })) });
          }
        }
        return tx.quote.update({ where: { id: Number(id) }, data, include: INCLUDE });
      });
      return { success: true, data: ser(quote) };
    } catch (error: any) {
      logger.error('quotes:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Transition de statut générique (envoi / acceptation / refus / annulation). */
  async function setStatus(
    token: string,
    id: number,
    next: 'ENVOYE' | 'ACCEPTE' | 'REFUSE' | 'ANNULE',
    extra: Record<string, unknown> = {},
  ) {
    const session = getSession(token);
    if (!session) return { success: false, error: 'Session expirée' };
    checkRole(session, WRITE_ROLES);
    const db = getDb();
    const existing = await db.quote.findUnique({ where: { id: Number(id) } });
    if (!existing || existing.deletedAt) return { success: false, error: 'Devis introuvable' };
    if (!canAccessQuote(session, existing.createdById)) return { success: false, error: 'Devis inaccessible' };
    if (existing.convertedConventionId) return { success: false, error: 'Devis déjà converti' };
    const quote = await db.quote.update({
      where: { id: Number(id) },
      data: { status: next, ...extra },
      include: INCLUDE,
    });
    logger.info(`Quote ${existing.reference} → ${next}`);
    return { success: true, data: ser(quote) };
  }

  ipcMain.handle('quotes:send', async (_event, { token, id }: any) =>
    setStatus(token, id, 'ENVOYE', { sentAt: new Date() }));

  ipcMain.handle('quotes:accept', async (_event, { token, id }: any) =>
    setStatus(token, id, 'ACCEPTE', { acceptedAt: new Date() }));

  ipcMain.handle('quotes:refuse', async (_event, { token, id, reason }: any) =>
    setStatus(token, id, 'REFUSE', { refusedAt: new Date(), refusalReason: reason || null }));

  ipcMain.handle('quotes:cancel', async (_event, { token, id }: any) =>
    setStatus(token, id, 'ANNULE', {}));

  ipcMain.handle('quotes:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const existing = await db.quote.findUnique({ where: { id: Number(id) }, select: { createdById: true, deletedAt: true } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Devis introuvable' };
      if (!canAccessQuote(session, existing.createdById)) return { success: false, error: 'Devis inaccessible' };
      await db.quote.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Convertit un devis accepté. Selon les options :
   *   - createConvention : crée une convention de vente BROUILLON pré-remplie
   *     (client, bien/terrain rattaché, montant, modalités) ;
   *   - reserveTerrain   : bascule le terrain/bien concerné en SOUS_OPTION ;
   *   - createInvoice    : génère une facture (BROUILLON) du montant total.
   * La traçabilité (convertedConventionId / convertedInvoiceId / convertedAt)
   * est inscrite sur le devis, qui passe au statut ACCEPTE.
   */
  ipcMain.handle('quotes:convert', async (_event, { token, id, options = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, CONVERT_ROLES);
      const createConvention = options.createConvention !== false; // défaut: oui
      const createInvoice = !!options.createInvoice;
      const reserveTerrain = !!options.reserveTerrain;
      const db = getDb();

      const q = await db.quote.findUnique({ where: { id: Number(id) }, include: { items: true } });
      if (!q || q.deletedAt) return { success: false, error: 'Devis introuvable' };
      if (q.convertedConventionId || q.convertedInvoiceId) {
        return { success: false, error: 'Ce devis a déjà été converti' };
      }
      if (['REFUSE', 'ANNULE', 'EXPIRE'].includes(q.status)) {
        return { success: false, error: 'Un devis refusé, annulé ou expiré ne peut pas être converti' };
      }
      if (createConvention && !q.clientId) {
        return { success: false, error: 'Conversion en convention impossible : convertissez d\'abord le prospect en client' };
      }
      const isSale = q.type === 'VENTE_TERRAIN' || q.type === 'VENTE_BIEN';
      if (createConvention && !isSale) {
        return { success: false, error: 'Seuls les devis de vente peuvent être convertis en convention' };
      }

      const result = await db.$transaction(async (tx) => {
        let conventionId: number | null = null;
        let conventionRef: string | null = null;
        let invoiceId: number | null = null;
        let invoiceRef: string | null = null;

        if (createConvention) {
          conventionRef = await nextConventionRef(tx as any);
          const convention = await tx.convention.create({
            data: {
              reference: conventionRef,
              type: 'SALE',
              status: 'BROUILLON',
              assetType: q.terrainId ? 'TERRAIN' : 'PROPERTY',
              clientId: q.clientId!,
              agentId: q.agentId ?? null,
              startDate: new Date(),
              saleAmount: String(Number(q.total)) as never,
              paymentModalites: q.paymentModalites,
              installmentCount: q.installmentCount ?? null,
              deposit: q.depositExpected != null ? (String(Number(q.depositExpected)) as never) : null,
              notes: `Issu du devis ${q.reference}`,
            },
          });
          conventionId = convention.id;
          if (q.terrainId) {
            await tx.conventionTerrain.create({ data: { conventionId, terrainId: q.terrainId, order: 0 } });
          } else if (q.propertyId) {
            await tx.conventionProperty.create({ data: { conventionId, propertyId: q.propertyId, order: 0 } });
          }
        }

        if (reserveTerrain) {
          if (q.terrainId) {
            await tx.terrain.updateMany({
              where: { id: q.terrainId, statut: 'DISPONIBLE' },
              data: { statut: 'SOUS_OPTION' },
            });
          } else if (q.propertyId) {
            await tx.property.updateMany({
              where: { id: q.propertyId, status: 'DISPONIBLE' },
              data: { status: 'SOUS_OPTION' },
            });
          }
        }

        if (createInvoice) {
          invoiceRef = await nextInvoiceRef(tx as any);
          // Reprend les lignes du devis comme lignes de facture (détail des articles).
          const quoteItems = [...(q.items ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const invoice = await tx.invoice.create({
            data: {
              reference: invoiceRef,
              type: 'VENTE',
              status: 'BROUILLON',
              clientId: q.clientId ?? null,
              conventionId,
              terrainId: q.terrainId ?? null,
              subtotal: String(Number(q.subtotal)) as never,
              taxRate: String(Number(q.taxRate)) as never,
              taxAmount: String(Number(q.taxAmount)) as never,
              total: String(Number(q.total)) as never,
              issueDate: new Date(),
              dueDate: q.validUntil ?? new Date(),
              notes: `Issu du devis ${q.reference}`,
              items: {
                create: quoteItems.map((it) => ({
                  description: it.category ? `${it.category} — ${it.designation}` : it.designation,
                  quantity: String(Number(it.quantity)) as never,
                  unitPrice: String(Number(it.unitPrice)) as never,
                  total: String(Number(it.total)) as never,
                })),
              },
            },
          });
          invoiceId = invoice.id;
        }

        const updated = await tx.quote.update({
          where: { id: Number(id) },
          data: {
            status: 'ACCEPTE',
            acceptedAt: q.acceptedAt ?? new Date(),
            convertedConventionId: conventionId,
            convertedInvoiceId: invoiceId,
            convertedAt: new Date(),
          },
          include: INCLUDE,
        });

        await tx.crmActivity.create({
          data: {
            type: 'DOCUMENT',
            subject: `Devis ${q.reference} converti`,
            description: [
              conventionRef ? `Convention ${conventionRef}` : null,
              invoiceRef ? `Facture ${invoiceRef}` : null,
              reserveTerrain ? 'Bien réservé (SOUS_OPTION)' : null,
            ].filter(Boolean).join(' · ') || 'Conversion du devis',
            status: 'TRAITE',
            quoteId: Number(id),
            clientId: q.clientId ?? null,
            terrainId: q.terrainId ?? null,
            createdById: session.userId,
          },
        });

        return { quote: updated, conventionId, conventionRef, invoiceId, invoiceRef };
      });

      logger.info(`Quote ${q.reference} converted (conv=${result.conventionRef ?? '—'}, fac=${result.invoiceRef ?? '—'})`);
      return { success: true, data: ser(result) };
    } catch (error: any) {
      logger.error('quotes:convert error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Unités de mesure (référentiel partagé `KpiUnit`, lecture seule) ───
   * La gestion (création/modification/suppression) se fait désormais depuis
   * le Catalogue prestations/produits (« Nouvel article » → « Gérer les
   * unités »), sur le même référentiel partagé. */
  ipcMain.handle('quotes:listUnits', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().kpiUnit.findMany({ where, orderBy: { label: 'asc' } });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('quotes:listUnits error', error.message);
      return { success: false, error: error.message };
    }
  });
}
