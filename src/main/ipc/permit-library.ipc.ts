import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Bibliothèque technique du moteur de devis de permis de construire
 * (Module 18) : communes, catalogue de prestations/frais/taxes
 * (`PermitFeeItem`), surcharges de taux, tranches de surface.
 *
 * Mêmes règles d'accès que le module Devis construction (Module 17) :
 * lecture ouverte aux rôles impliqués dans la production de devis, écriture
 * ouverte à **SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT** (rôle EXACT, sans les
 * équivalences de `checkRole`) — le module Permis n'ayant pas d'équivalent
 * de la « Bibliothèque d'ouvrages » du Module 17 (recettes complexes,
 * réservées SUPER_ADMIN/ADMIN uniquement côté Construction), l'ensemble de
 * sa bibliothèque technique (communes, catalogue de prestations, surcharges,
 * tranches) est traité au niveau le plus permissif de la matrice Construction.
 */
const LIB_EXTENDED_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const LIB_READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION', 'READONLY'];

function checkLibExtendedWrite(session: { role: string }): void {
  if (!LIB_EXTENDED_WRITE_ROLES.includes(session.role)) throw new Error('Permission insuffisante');
}

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const dec = (v: number | null | undefined): unknown => (v == null ? null : (String(v) as never));

const ZONE_TYPES = ['URBAINE', 'RURALE'] as const;
const NATURES = ['VILLA', 'IMMEUBLE', 'COMMERCE', 'BUREAU', 'HOTEL', 'USINE', 'ENTREPOT'] as const;
const STANDINGS = ['ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE'] as const;
const CATEGORIES = [
  'ARCHITECTE', 'BET_STRUCTURE', 'BET_FLUIDES', 'BET_ELECTRICITE', 'BET_VRD', 'BET_GEOTECHNIQUE',
  'GEOMETRE', 'ETUDE_SOL', 'ETUDE_HYDROLOGIE', 'ETUDE_ENVIRONNEMENT', 'ETUDE_INCENDIE',
  'FRAIS_ADMINISTRATIF', 'TAXE',
] as const;
const CALC_MODES = ['POURCENTAGE_COUT_TRAVAUX', 'FORFAIT', 'PAR_M2_TERRAIN', 'PAR_M2_BATI', 'BAREME_SURFACE'] as const;
const MISSION_PHASES = ['ESQUISSE', 'APS', 'APD', 'PLANS_EXECUTION', 'SUIVI_CHANTIER', 'RECEPTION'] as const;

const communeSchema = z.object({
  nom: z.string().min(1, 'Nom de la commune requis'),
  district: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  zoneType: z.enum(ZONE_TYPES).default('URBAINE'),
  isActive: z.boolean().optional(),
});

const feeItemSchema = z.object({
  code: z.string().min(1),
  category: z.enum(CATEGORIES),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  calcMode: z.enum(CALC_MODES),
  missionPhase: z.enum(MISSION_PHASES).nullable().optional(),
  defaultValue: z.number().min(0),
  unit: z.string().nullable().optional(),
  applicabilityRule: z.any().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const rateOverrideSchema = z.object({
  feeItemId: z.number().int().positive(),
  nature: z.enum(NATURES).nullable().optional(),
  standing: z.enum(STANDINGS).nullable().optional(),
  communeId: z.number().int().positive().nullable().optional(),
  value: z.number().min(0),
});

const surfaceBracketSchema = z.object({
  feeItemId: z.number().int().positive(),
  minSurface: z.number().min(0),
  maxSurface: z.number().min(0).nullable().optional(),
  value: z.number().min(0),
  label: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export function registerPermitLibraryIPC(): void {
  // ── Communes ─────────────────────────────────────────────────────────
  ipcMain.handle('permits:communes:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await getDb().permitCommune.findMany({ where, orderBy: { nom: 'asc' } });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:communes:upsert', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = communeSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const data = id
        ? await db.permitCommune.update({ where: { id: Number(id) }, data: parsed.data })
        : await db.permitCommune.create({ data: parsed.data });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('permits:communes:upsert error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:communes:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      await getDb().permitCommune.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Catalogue de prestations/frais/taxes ────────────────────────────
  ipcMain.handle('permits:feeItems:list', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const where: any = { deletedAt: null };
      if (!filters.includeInactive) where.isActive = true;
      if (filters.category) where.category = filters.category;
      if (filters.search) {
        where.OR = [{ code: { contains: filters.search } }, { label: { contains: filters.search } }];
      }
      const data = await getDb().permitFeeItem.findMany({
        where, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        include: { _count: { select: { rateOverrides: true, surfaceBrackets: true } } },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:feeItems:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const data = await getDb().permitFeeItem.findUnique({
        where: { id: Number(id) },
        include: {
          rateOverrides: { include: { commune: true } },
          surfaceBrackets: { orderBy: { minSurface: 'asc' } },
        },
      });
      if (!data || data.deletedAt) return { success: false, error: 'Prestation introuvable' };
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:feeItems:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = feeItemSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const data = await getDb().permitFeeItem.create({
        data: {
          code: d.code, category: d.category, label: d.label, description: d.description ?? null,
          calcMode: d.calcMode, missionPhase: d.missionPhase ?? null, defaultValue: dec(d.defaultValue) as any,
          unit: d.unit ?? null, applicabilityRule: d.applicabilityRule ?? null,
          sortOrder: d.sortOrder ?? 0, isActive: d.isActive ?? true,
        },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('permits:feeItems:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:feeItems:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = feeItemSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const values: any = { ...d };
      if (d.defaultValue != null) values.defaultValue = dec(d.defaultValue);
      const data = await getDb().permitFeeItem.update({ where: { id: Number(id) }, data: values });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('permits:feeItems:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:feeItems:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      await getDb().permitFeeItem.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Surcharges de taux ──────────────────────────────────────────────
  ipcMain.handle('permits:rateOverrides:list', async (_event, { token, feeItemId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const data = await getDb().permitFeeRateOverride.findMany({
        where: { feeItemId: Number(feeItemId) }, include: { commune: true }, orderBy: { id: 'asc' },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:rateOverrides:upsert', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = rateOverrideSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const values = {
        feeItemId: d.feeItemId, nature: d.nature ?? null, standing: d.standing ?? null,
        communeId: d.communeId ?? null, value: dec(d.value) as any,
      };
      const db = getDb();
      const data = id
        ? await db.permitFeeRateOverride.update({ where: { id: Number(id) }, data: values })
        : await db.permitFeeRateOverride.create({ data: values });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('permits:rateOverrides:upsert error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:rateOverrides:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      await getDb().permitFeeRateOverride.delete({ where: { id: Number(id) } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Tranches de surface (BAREME_SURFACE) ────────────────────────────
  ipcMain.handle('permits:surfaceBrackets:list', async (_event, { token, feeItemId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, LIB_READ_ROLES);
      const data = await getDb().permitFeeSurfaceBracket.findMany({
        where: { feeItemId: Number(feeItemId) }, orderBy: { minSurface: 'asc' },
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:surfaceBrackets:upsert', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      const parsed = surfaceBracketSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const values = {
        feeItemId: d.feeItemId, minSurface: dec(d.minSurface) as any,
        maxSurface: d.maxSurface != null ? (dec(d.maxSurface) as any) : null,
        value: dec(d.value) as any, label: d.label ?? null, sortOrder: d.sortOrder ?? 0,
      };
      const db = getDb();
      const data = id
        ? await db.permitFeeSurfaceBracket.update({ where: { id: Number(id) }, data: values })
        : await db.permitFeeSurfaceBracket.create({ data: values });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('permits:surfaceBrackets:upsert error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:surfaceBrackets:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkLibExtendedWrite(session);
      await getDb().permitFeeSurfaceBracket.delete({ where: { id: Number(id) } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
