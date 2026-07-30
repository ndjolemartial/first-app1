import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Bibliothèque technique du moteur de devis de construction (Module 17) :
 * lots, bordereau de prix (ressources), ouvrages (recettes), catalogue et
 * profils de coefficients.
 *
 * Lecture : rôles impliqués dans la production de devis de construction.
 * Écriture : réservée à SUPER_ADMIN/ADMIN (même principe que le catalogue KPI
 * du module Performances) — rôle EXACT, sans les équivalences de `checkRole`.
 */
const LIB_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const LIB_READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'AGENT_TECHNIQUE'];
// Lots de travaux, Bordereau des prix (ressources) et Localités : ouverts en
// écriture à MANAGER et ACCOUNTANT au même titre que les admins — contrairement
// à la Bibliothèque d'ouvrages, au Catalogue des coefficients et aux Profils de
// coefficients, qui restent réservés à LIB_ADMIN_ROLES.
const LIB_EXTENDED_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

function checkLibWrite(session: { role: string }): void {
  if (!LIB_ADMIN_ROLES.includes(session.role)) throw new Error('Permission insuffisante');
}
function checkLibExtendedWrite(session: { role: string }): void {
  if (!LIB_EXTENDED_WRITE_ROLES.includes(session.role)) throw new Error('Permission insuffisante');
}

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));
/** Sérialise un nombre en Decimal Prisma (chaîne — contourne le typage Decimal côté IPC). */
const dec = (v: number | null | undefined): unknown => (v == null ? null : (String(v) as never));

const LOT_PHASES = ['GROS_OEUVRE', 'SECOND_OEUVRE', 'ELECTRICITE', 'PLOMBERIE', 'FINITIONS', 'VRD', 'AMENAGEMENTS'] as const;
const RESOURCE_TYPES = ['MATERIAU', 'MAIN_OEUVRE', 'TRANSPORT', 'MATERIEL', 'SOUS_TRAITANCE'] as const;
const BUILDING_TYPES = ['VILLA_BASSE', 'VILLA_DUPLEX', 'VILLA_TRIPLEX', 'MAISON_ECONOMIQUE', 'IMMEUBLE_R_PLUS', 'BUREAU', 'COMMERCE', 'ENTREPOT_HANGAR', 'AUTRE'] as const;
const STANDINGS = ['ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE'] as const;

const labelSchema = z.object({ label: z.string().min(1, 'Libellé requis'), isActive: z.boolean().optional() });

const lotSchema = z.object({
  code: z.string().min(1),
  numero: z.number().int().positive(),
  label: z.string().min(1),
  phase: z.enum(LOT_PHASES).default('GROS_OEUVRE'),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const localitySchema = z.object({
  label: z.string().min(1),
  region: z.string().nullable().optional(),
  priceCoefficient: z.number().positive().default(1),
  isActive: z.boolean().optional(),
});

const resourceSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(RESOURCE_TYPES).default('MATERIAU'),
  family: z.string().nullable().optional(),
  unit: z.string().min(1),
  quality: z.string().nullable().optional(),
  unitPrice: z.number().min(0).default(0),
  supplierName: z.string().nullable().optional(),
  referenceCity: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const updatePriceSchema = z.object({
  unitPrice: z.number().min(0),
  localityId: z.number().int().positive().nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  quality: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const componentSchema = z.object({
  resourceId: z.number().int().positive(),
  quantityPerUnit: z.number().min(0),
  wastageRate: z.number().min(0).default(0),
  note: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const workItemSchema = z.object({
  code: z.string().min(1),
  lotId: z.number().int().positive(),
  designation: z.string().min(1),
  description: z.string().nullable().optional(),
  unit: z.string().min(1),
  formulaCode: z.string().nullable().optional(),
  fixedQuantity: z.number().nullable().optional(),
  quantityMultiplier: z.number().positive().default(1),
  applicabilityRule: z.any().nullable().optional(),
  percentOfTotalPct: z.number().nullable().optional(),
  deboursSecOverride: z.number().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  components: z.array(componentSchema).default([]),
});

const ratioDefSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  category: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  defaultValue: z.number().default(0),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const ratioValueSchema = z.object({
  ratioDefinitionId: z.number().int().positive(),
  value: z.number(),
  note: z.string().nullable().optional(),
});

const ratioProfileSchema = z.object({
  name: z.string().min(1),
  buildingType: z.enum(BUILDING_TYPES),
  standing: z.enum(STANDINGS),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  values: z.array(ratioValueSchema).default([]),
});

export function registerConstructionLibraryIPC(): void {
  // ── Lots ─────────────────────────────────────────────────────────────
  ipcMain.handle('construction:lots:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().constructionLot.findMany({
        where, orderBy: { numero: 'asc' }, include: { _count: { select: { workItems: true } } },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:lots:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:lots:upsert', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = lotSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const data = id
        ? await db.constructionLot.update({ where: { id: Number(id) }, data: parsed.data })
        : await db.constructionLot.create({ data: parsed.data });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:lots:upsert error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:lots:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      await getDb().constructionLot.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('construction:lots:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Familles de ressources ──────────────────────────────────────────
  ipcMain.handle('construction:resourceFamilies:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().constructionResourceFamily.findMany({ where, orderBy: { label: 'asc' } });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:resourceFamilies:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      const parsed = labelSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const label = parsed.data.label.trim();
      const existing = await db.constructionResourceFamily.findUnique({ where: { label } });
      if (existing) {
        const data = await db.constructionResourceFamily.update({ where: { id: existing.id }, data: { isActive: true, deletedAt: null } });
        return { success: true, data: ser(data) };
      }
      const data = await db.constructionResourceFamily.create({ data: { label, isActive: parsed.data.isActive ?? true } });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:resourceFamilies:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      await getDb().constructionResourceFamily.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Localités ────────────────────────────────────────────────────────
  ipcMain.handle('construction:localities:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().constructionLocality.findMany({ where, orderBy: { label: 'asc' } });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:localities:upsert', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = localitySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const values = { ...parsed.data, priceCoefficient: dec(parsed.data.priceCoefficient) };
      const data = id
        ? await db.constructionLocality.update({ where: { id: Number(id) }, data: values as any })
        : await db.constructionLocality.create({ data: values as any });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:localities:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      await getDb().constructionLocality.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Ressources (bordereau de prix) ──────────────────────────────────
  ipcMain.handle('construction:resources:list', async (_event, { token, filters = {}, page = 1, limit = 100 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!filters.includeInactive) where.isActive = true;
      if (filters.type) where.type = filters.type;
      if (filters.family) where.family = filters.family;
      if (filters.search) {
        where.OR = [
          { code: { contains: filters.search } },
          { label: { contains: filters.search } },
          { family: { contains: filters.search } },
        ];
      }
      const [data, total] = await getDb().$transaction([
        getDb().constructionResource.findMany({ where, orderBy: [{ family: 'asc' }, { label: 'asc' }], skip: (page - 1) * limit, take: limit }),
        getDb().constructionResource.count({ where }),
      ]);
      return { success: true, data: ser(data), total };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:resources:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const db = getDb();
      const [resource, priceHistory, priceVariants] = await Promise.all([
        db.constructionResource.findUnique({ where: { id: Number(id) } }),
        db.constructionResourcePriceHistory.findMany({ where: { resourceId: Number(id) }, orderBy: { effectiveDate: 'desc' }, take: 20 }),
        db.constructionResourcePriceVariant.findMany({ where: { resourceId: Number(id) }, include: { locality: true } }),
      ]);
      if (!resource || resource.deletedAt) return { success: false, error: 'Ressource introuvable' };
      return { success: true, data: ser({ ...resource, priceHistory, priceVariants }) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:resources:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = resourceSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const data = await db.constructionResource.create({
        data: { ...parsed.data, unitPrice: dec(parsed.data.unitPrice) } as any,
      });
      if (Number(parsed.data.unitPrice) > 0) {
        await db.constructionResourcePriceHistory.create({
          data: {
            resourceId: data.id, previousPrice: null, unitPrice: dec(parsed.data.unitPrice) as any,
            source: 'Création', changedById: session.userId,
          },
        });
      }
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:resources:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:resources:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = resourceSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const existing = await db.constructionResource.findUnique({ where: { id: Number(id) } });
      if (!existing) return { success: false, error: 'Ressource introuvable' };
      const values: any = { ...parsed.data };
      const priceChanged = parsed.data.unitPrice != null && Number(parsed.data.unitPrice) !== Number(existing.unitPrice);
      if (parsed.data.unitPrice != null) values.unitPrice = dec(parsed.data.unitPrice);
      if (priceChanged) values.priceIsIndicative = false;
      const data = await db.constructionResource.update({ where: { id: Number(id) }, data: values });
      if (priceChanged) {
        await db.constructionResourcePriceHistory.create({
          data: {
            resourceId: data.id, previousPrice: dec(Number(existing.unitPrice)) as any, unitPrice: dec(parsed.data.unitPrice as number) as any,
            source: 'Modification manuelle', changedById: session.userId,
          },
        });
      }
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:resources:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:resources:updatePrice', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = updatePriceSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const resource = await db.constructionResource.findUnique({ where: { id: Number(id) } });
      if (!resource) return { success: false, error: 'Ressource introuvable' };
      const d = parsed.data;

      if (d.localityId) {
        // Dérogation ponctuelle par ville — n'affecte pas le prix de référence.
        const existingVariant = await db.constructionResourcePriceVariant.findUnique({
          where: { resourceId_localityId: { resourceId: Number(id), localityId: d.localityId } },
        });
        const variant = existingVariant
          ? await db.constructionResourcePriceVariant.update({
            where: { id: existingVariant.id },
            data: { unitPrice: dec(d.unitPrice) as any, supplierName: d.supplierName, quality: d.quality, note: d.note, priceDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date() },
          })
          : await db.constructionResourcePriceVariant.create({
            data: {
              resourceId: Number(id), localityId: d.localityId, unitPrice: dec(d.unitPrice) as any,
              supplierName: d.supplierName, quality: d.quality, note: d.note, priceDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date(),
            },
          });
        await db.constructionResourcePriceHistory.create({
          data: {
            resourceId: Number(id), localityId: d.localityId, previousPrice: existingVariant ? (dec(Number(existingVariant.unitPrice)) as any) : null,
            unitPrice: dec(d.unitPrice) as any, supplierName: d.supplierName, quality: d.quality, source: d.source ?? 'Relevé fournisseur',
            note: d.note, changedById: session.userId, effectiveDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date(),
          },
        });
        return { success: true, data: ser(variant) };
      }

      const previousPrice = Number(resource.unitPrice);
      const updated = await db.constructionResource.update({
        where: { id: Number(id) },
        data: {
          unitPrice: dec(d.unitPrice) as any, priceDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date(),
          supplierName: d.supplierName ?? resource.supplierName, priceIsIndicative: false,
        },
      });
      await db.constructionResourcePriceHistory.create({
        data: {
          resourceId: Number(id), previousPrice: dec(previousPrice) as any, unitPrice: dec(d.unitPrice) as any,
          supplierName: d.supplierName, quality: d.quality, source: d.source ?? 'Relevé fournisseur', note: d.note,
          changedById: session.userId, effectiveDate: d.effectiveDate ? new Date(d.effectiveDate) : new Date(),
        },
      });
      const impactedWorkItems = await db.constructionWorkItemComponent.count({ where: { resourceId: Number(id) } });
      return { success: true, data: ser(updated), impacted: { workItems: impactedWorkItems } };
    } catch (error: any) {
      logger.error('construction:resources:updatePrice error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:resources:priceHistory', async (_event, { token, id, limit = 30 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const data = await getDb().constructionResourcePriceHistory.findMany({
        where: { resourceId: Number(id) }, orderBy: { effectiveDate: 'desc' }, take: limit,
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:resources:whereUsed', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const data = await getDb().constructionWorkItemComponent.findMany({
        where: { resourceId: Number(id) },
        include: { workItem: { include: { lot: true } } },
        orderBy: { workItem: { code: 'asc' } },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:resources:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const db = getDb();
      const usageCount = await db.constructionWorkItemComponent.count({ where: { resourceId: Number(id) } });
      if (usageCount > 0) {
        return { success: false, error: `Cette ressource est utilisée par ${usageCount} ouvrage(s) — retirez-la des recettes avant suppression.` };
      }
      await db.constructionResource.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Ouvrages (bibliothèque) ──────────────────────────────────────────
  ipcMain.handle('construction:workItems:list', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!filters.includeInactive) where.isActive = true;
      if (filters.lotId) where.lotId = Number(filters.lotId);
      if (filters.search) {
        where.OR = [{ code: { contains: filters.search } }, { designation: { contains: filters.search } }];
      }
      const data = await getDb().constructionWorkItem.findMany({
        where, include: { lot: true, _count: { select: { components: true } } },
        orderBy: [{ lot: { numero: 'asc' } }, { sortOrder: 'asc' }],
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:workItems:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const data = await getDb().constructionWorkItem.findUnique({
        where: { id: Number(id) },
        include: { lot: true, components: { include: { resource: true }, orderBy: { sortOrder: 'asc' } } },
      });
      if (!data || data.deletedAt) return { success: false, error: 'Ouvrage introuvable' };
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:workItems:upsert', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      const parsed = workItemSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const db = getDb();
      const header = {
        code: d.code, lotId: d.lotId, designation: d.designation, description: d.description ?? null,
        unit: d.unit, formulaCode: d.formulaCode ?? null,
        fixedQuantity: d.fixedQuantity != null ? dec(d.fixedQuantity) : null,
        quantityMultiplier: dec(d.quantityMultiplier),
        applicabilityRule: d.applicabilityRule ?? null,
        percentOfTotalPct: d.percentOfTotalPct != null ? dec(d.percentOfTotalPct) : null,
        deboursSecOverride: d.deboursSecOverride != null ? dec(d.deboursSecOverride) : null,
        sortOrder: d.sortOrder ?? 0, isActive: d.isActive ?? true,
      };
      const data = await db.$transaction(async (tx) => {
        const workItem = id
          ? await tx.constructionWorkItem.update({ where: { id: Number(id) }, data: header as any })
          : await tx.constructionWorkItem.create({ data: header as any });
        await tx.constructionWorkItemComponent.deleteMany({ where: { workItemId: workItem.id } });
        if (d.components.length) {
          await tx.constructionWorkItemComponent.createMany({
            data: d.components.map((c, i) => ({
              workItemId: workItem.id, resourceId: c.resourceId, quantityPerUnit: dec(c.quantityPerUnit) as any,
              wastageRate: dec(c.wastageRate) as any, note: c.note ?? null, sortOrder: c.sortOrder ?? i,
            })),
          });
        }
        return tx.constructionWorkItem.findUnique({
          where: { id: workItem.id }, include: { lot: true, components: { include: { resource: true } } },
        });
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:workItems:upsert error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:workItems:duplicate', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      const db = getDb();
      const source = await db.constructionWorkItem.findUnique({ where: { id: Number(id) }, include: { components: true } });
      if (!source) return { success: false, error: 'Ouvrage introuvable' };
      const data = await db.constructionWorkItem.create({
        data: {
          code: `${source.code}_COPIE`, lotId: source.lotId, designation: `${source.designation} (copie)`,
          description: source.description, unit: source.unit, formulaCode: source.formulaCode,
          fixedQuantity: source.fixedQuantity, quantityMultiplier: source.quantityMultiplier,
          applicabilityRule: source.applicabilityRule as any, percentOfTotalPct: source.percentOfTotalPct,
          deboursSecOverride: source.deboursSecOverride, sortOrder: source.sortOrder, isActive: true,
          components: {
            create: source.components.map((c) => ({
              resourceId: c.resourceId, quantityPerUnit: c.quantityPerUnit, wastageRate: c.wastageRate, note: c.note, sortOrder: c.sortOrder,
            })),
          },
        },
        include: { lot: true, components: { include: { resource: true } } },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:workItems:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      await getDb().constructionWorkItem.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Catalogue des coefficients/ratios ───────────────────────────────
  ipcMain.handle('construction:ratioDefs:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().constructionRatioDefinition.findMany({ where, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }] });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:ratioDefs:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      const parsed = ratioDefSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const data = await getDb().constructionRatioDefinition.create({
        data: {
          code: d.code, label: d.label, category: d.category ?? null, unit: d.unit ?? null,
          defaultValue: dec(d.defaultValue) as any, minValue: d.minValue != null ? (dec(d.minValue) as any) : null,
          maxValue: d.maxValue != null ? (dec(d.maxValue) as any) : null, description: d.description ?? null,
          sortOrder: d.sortOrder ?? 0, isActive: d.isActive ?? true,
        },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:ratioDefs:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:ratioDefs:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      const parsed = ratioDefSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const values: any = { ...d };
      if (d.defaultValue != null) values.defaultValue = dec(d.defaultValue);
      if (d.minValue !== undefined) values.minValue = d.minValue != null ? dec(d.minValue) : null;
      if (d.maxValue !== undefined) values.maxValue = d.maxValue != null ? dec(d.maxValue) : null;
      const data = await getDb().constructionRatioDefinition.update({ where: { id: Number(id) }, data: values });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:ratioDefs:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:ratioDefs:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      await getDb().constructionRatioDefinition.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Profils de coefficients ──────────────────────────────────────────
  ipcMain.handle('construction:ratioProfiles:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const data = await getDb().constructionRatioProfile.findMany({
        orderBy: [{ buildingType: 'asc' }, { standing: 'asc' }], include: { _count: { select: { values: true } } },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:ratioProfiles:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const data = await getDb().constructionRatioProfile.findUnique({
        where: { id: Number(id) }, include: { values: { include: { ratioDefinition: true } } },
      });
      if (!data) return { success: false, error: 'Profil introuvable' };
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:ratioProfiles:upsert', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      const parsed = ratioProfileSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const db = getDb();
      const header = { name: d.name, buildingType: d.buildingType, standing: d.standing, description: d.description ?? null, isActive: d.isActive ?? true };
      const data = await db.$transaction(async (tx) => {
        const profile = id
          ? await tx.constructionRatioProfile.update({ where: { id: Number(id) }, data: header })
          : await tx.constructionRatioProfile.create({ data: header });
        await tx.constructionRatioValue.deleteMany({ where: { profileId: profile.id } });
        if (d.values.length) {
          await tx.constructionRatioValue.createMany({
            data: d.values.map((v) => ({
              profileId: profile.id, ratioDefinitionId: v.ratioDefinitionId, value: dec(v.value) as any, note: v.note ?? null,
            })),
          });
        }
        return tx.constructionRatioProfile.findUnique({ where: { id: profile.id }, include: { values: { include: { ratioDefinition: true } } } });
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:ratioProfiles:upsert error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:ratioProfiles:duplicate', async (_event, { token, id, target }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      const db = getDb();
      const source = await db.constructionRatioProfile.findUnique({ where: { id: Number(id) }, include: { values: true } });
      if (!source) return { success: false, error: 'Profil introuvable' };
      const buildingType = target?.buildingType ?? source.buildingType;
      const standing = target?.standing ?? source.standing;
      const existing = await db.constructionRatioProfile.findUnique({ where: { buildingType_standing: { buildingType, standing } } });
      if (existing) return { success: false, error: `Un profil existe déjà pour ${buildingType} × ${standing}.` };
      const data = await db.constructionRatioProfile.create({
        data: {
          name: target?.name ?? `${source.name} (copie)`, buildingType, standing, description: source.description, isActive: true,
          values: { create: source.values.map((v) => ({ ratioDefinitionId: v.ratioDefinitionId, value: v.value, note: v.note })) },
        },
        include: { values: { include: { ratioDefinition: true } } },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:ratioProfiles:duplicate error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:ratioProfiles:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibWrite(session);
      // Hard delete : `@@unique([buildingType, standing])` sans soft delete
      // (cf. schema.prisma) — un soft delete empêcherait de recréer le couple.
      // Les estimations passées gardent un ratioSnapshot JSON figé, non affecté.
      await getDb().constructionRatioProfile.delete({ where: { id: Number(id) } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Santé de la bibliothèque ──────────────────────────────────────────
  ipcMain.handle('construction:library:health', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const db = getDb();
      const [lots, resourcesIndicatives, resourcesTotal, profiles] = await Promise.all([
        db.constructionLot.findMany({ where: { isActive: true, deletedAt: null }, include: { _count: { select: { workItems: true } } } }),
        db.constructionResource.count({ where: { isActive: true, deletedAt: null, priceIsIndicative: true } }),
        db.constructionResource.count({ where: { isActive: true, deletedAt: null } }),
        db.constructionRatioProfile.count({ where: { isActive: true } }),
      ]);
      const lotsSansOuvrage = lots.filter((l) => l._count.workItems === 0).map((l) => l.label);
      const couverturePct = lots.length > 0 ? Math.round(((lots.length - lotsSansOuvrage.length) / lots.length) * 100) : 0;
      return {
        success: true,
        data: { lotsSansOuvrage, ressourcesIndicatives: resourcesIndicatives, ressourcesTotal: resourcesTotal, profilsCount: profiles, couverturePct },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
