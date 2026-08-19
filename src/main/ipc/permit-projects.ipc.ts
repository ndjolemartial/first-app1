import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { computePermitEstimate, toPermitProjectInputs, type GeneratedPermitEstimate } from '../services/permit-engine.service';
import { nextReference as nextQuoteReference, resolveQuoteAmounts } from './quotes.ipc';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Projets & estimations du moteur de devis de permis de construire
 * (Module 18). Mêmes conventions de rôle que le Module 17 (Construction) :
 * création/génération/conversion réservées à la vue complète (SUPER_ADMIN,
 * ADMIN, MANAGER, ACCOUNTANT) ; les autres rôles disposant d'un accès au
 * module (AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, READONLY) sont en
 * lecture seule, limitée aux projets rattachés à un client ou un prospect
 * dont ils sont le référent commercial.
 */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const FULL_ACCESS = WRITE_ROLES;
const READ_ROLES = [...FULL_ACCESS, 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY'];
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

function scopeWhere(session: { role: string; userId: number }): Record<string, unknown> {
  if (FULL_ACCESS.includes(session.role)) return {};
  return {
    OR: [
      { client: { is: { assignedToId: session.userId } } },
      { prospect: { is: { assignedToId: session.userId } } },
    ],
  };
}
async function canAccess(db: ReturnType<typeof getDb>, session: { role: string; userId: number }, project: { clientId: number | null; prospectId: number | null }): Promise<boolean> {
  if (FULL_ACCESS.includes(session.role)) return true;
  if (!project.clientId && !project.prospectId) return false;
  const [client, prospect] = await Promise.all([
    project.clientId ? db.client.findUnique({ where: { id: project.clientId }, select: { assignedToId: true } }) : Promise.resolve(null),
    project.prospectId ? db.prospect.findUnique({ where: { id: project.prospectId }, select: { assignedToId: true } }) : Promise.resolve(null),
  ]);
  return client?.assignedToId === session.userId || prospect?.assignedToId === session.userId;
}

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const dec = (v: number | null | undefined): unknown => (v == null ? null : (String(v) as never));

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.nullable().optional());

const NATURES = ['VILLA', 'IMMEUBLE', 'COMMERCE', 'BUREAU', 'HOTEL', 'USINE', 'ENTREPOT'] as const;
const STANDINGS = ['ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE'] as const;
const ZONE_TYPES = ['URBAINE', 'RURALE'] as const;
const MISSION_PHASES = ['ESQUISSE', 'APS', 'APD', 'PLANS_EXECUTION', 'SUIVI_CHANTIER', 'RECEPTION'] as const;

export const PERMIT_CATEGORY_LABELS: Record<string, string> = {
  ARCHITECTE: 'Honoraires Architecte',
  BET_STRUCTURE: 'BET Structure',
  BET_FLUIDES: 'BET Fluides',
  BET_ELECTRICITE: 'BET Électricité',
  BET_VRD: 'BET VRD',
  BET_GEOTECHNIQUE: 'BET Géotechnique',
  GEOMETRE: 'Géomètre',
  ETUDE_SOL: 'Étude de sol',
  ETUDE_HYDROLOGIE: 'Étude hydrologique',
  ETUDE_ENVIRONNEMENT: "Étude d'impact environnemental",
  ETUDE_INCENDIE: 'Étude sécurité incendie',
  FRAIS_ADMINISTRATIF: 'Frais administratifs',
  TAXE: 'Taxes',
};

const projectSchema = z.object({
  nom: z.string().min(1, 'Nom du projet requis'),
  clientId: z.number().int().positive().nullable().optional(),
  prospectId: z.number().int().positive().nullable().optional(),
  agentId: z.number().int().positive().nullable().optional(),
  constructionProjectId: z.number().int().positive().nullable().optional(),

  nature: z.enum(NATURES),
  standing: z.enum(STANDINGS).default('MOYEN_STANDING'),
  communeId: z.number().int().positive().nullable().optional(),
  zoneType: z.enum(ZONE_TYPES).nullable().optional(),
  terrainSurface: optionalNumber(z.number().positive()),
  surfaceBatie: z.number().positive(),
  levels: z.number().int().min(1).default(1),
  hasSousSol: z.boolean().default(false),
  nombreBatiments: z.number().int().min(1).default(1),
  coutPrevisionnelTravaux: optionalNumber(z.number().positive()),

  hasPiscine: z.boolean().default(false),
  hasAscenseur: z.boolean().default(false),
  hasGroupeElectrogene: z.boolean().default(false),
  hasForage: z.boolean().default(false),
  hasCloture: z.boolean().default(false),
  hasVoirieInterieure: z.boolean().default(false),

  missionPhases: z.array(z.enum(MISSION_PHASES)).default(['ESQUISSE', 'APS', 'APD', 'PLANS_EXECUTION']),

  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const toQuoteSchema = z.object({
  estimateId: z.number().int().positive(),
  payload: z.object({
    prospectId: z.number().int().positive().nullable().optional(),
    clientId: z.number().int().positive().nullable().optional(),
    agentId: z.number().int().positive().nullable().optional(),
    objet: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    taxRate: z.number().min(0).default(0),
    templateId: z.number().int().positive().nullable().optional(),
    referenceColumnLabel: z.string().nullable().optional(),
  }),
});

/** Référence auto PRM-YYYY-NNNN (projets de permis). */
async function nextProjectReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.permitProject.findFirst({
    where: { reference: { startsWith: `PRM-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `PRM-${year}-${String(seq).padStart(4, '0')}`;
}

/** Référence auto PRE-YYYY-NNNN (estimations de permis). */
async function nextEstimateReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.permitEstimate.findFirst({
    where: { reference: { startsWith: `PRE-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `PRE-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Coût prévisionnel des travaux par défaut lorsqu'un `ConstructionProject`
 * est rattaché et que l'utilisateur n'a pas renseigné le champ manuellement —
 * lu depuis la dernière estimation de construction (non obsolète), la plus
 * récente en version. Simple valeur de départ copiée dans le projet de
 * permis (pas de lien vivant) : reste modifiable ensuite indépendamment.
 */
async function resolveDefaultCout(db: ReturnType<typeof getDb>, constructionProjectId: number | null | undefined): Promise<number | null> {
  if (!constructionProjectId) return null;
  const estimate = await db.constructionEstimate.findFirst({
    where: { projectId: constructionProjectId, deletedAt: null, status: { not: 'OBSOLETE' } },
    orderBy: { version: 'desc' },
    select: { totalHT: true },
  });
  return estimate ? Number(estimate.totalHT) : null;
}

function projectDataFromPayload(d: z.infer<typeof projectSchema>): Record<string, unknown> {
  return {
    ...d,
    terrainSurface: d.terrainSurface != null ? dec(d.terrainSurface) : null,
    surfaceBatie: dec(d.surfaceBatie),
    coutPrevisionnelTravaux: d.coutPrevisionnelTravaux != null ? dec(d.coutPrevisionnelTravaux) : null,
  };
}

const PROJECT_INCLUDE = {
  client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
  prospect: { select: { id: true, firstName: true, lastName: true } },
  agent: { select: { id: true, firstName: true, lastName: true } },
  commune: true,
  constructionProject: { select: { id: true, reference: true, nom: true } },
  _count: { select: { estimates: true } },
};

export function registerPermitProjectsIPC(): void {
  // ── Projets ──────────────────────────────────────────────────────────
  ipcMain.handle('permits:projects:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null, ...scopeWhere(session) };
      if (filters.status) where.status = filters.status;
      if (filters.nature) where.nature = filters.nature;
      if (filters.standing) where.standing = filters.standing;
      if (filters.clientId) where.clientId = Number(filters.clientId);
      if (filters.prospectId) where.prospectId = Number(filters.prospectId);
      if (filters.search) {
        where.OR = [{ reference: { contains: filters.search } }, { nom: { contains: filters.search } }];
      }
      const [data, total] = await db.$transaction([
        db.permitProject.findMany({ where, include: PROJECT_INCLUDE, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        db.permitProject.count({ where }),
      ]);
      return { success: true, data: ser(data), total };
    } catch (error: any) {
      logger.error('permits:projects:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:projects:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const project = await db.permitProject.findUnique({
        where: { id: Number(id) },
        include: { ...PROJECT_INCLUDE, estimates: { where: { deletedAt: null }, orderBy: { version: 'desc' } } },
      });
      if (!project || project.deletedAt) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, project))) return { success: false, error: 'Projet inaccessible' };
      return { success: true, data: ser(project) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:projects:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = projectSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const reference = await nextProjectReference(db);
      const d = parsed.data;
      if (d.coutPrevisionnelTravaux == null && d.constructionProjectId) {
        d.coutPrevisionnelTravaux = await resolveDefaultCout(db, d.constructionProjectId);
      }
      const data = await db.permitProject.create({
        data: { ...projectDataFromPayload(d), reference, createdById: session.userId } as any,
        include: PROJECT_INCLUDE,
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('permits:projects:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:projects:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const existing = await db.permitProject.findUnique({ where: { id: Number(id) } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, existing))) return { success: false, error: 'Projet inaccessible' };
      const parsed = projectSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const data = await db.permitProject.update({
        where: { id: Number(id) },
        data: projectDataFromPayload(parsed.data as z.infer<typeof projectSchema>) as any,
        include: PROJECT_INCLUDE,
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('permits:projects:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:projects:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, DELETE_ROLES);
      const db = getDb();
      const existing = await db.permitProject.findUnique({ where: { id: Number(id) }, select: { clientId: true, prospectId: true, deletedAt: true } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, existing))) return { success: false, error: 'Projet inaccessible' };

      // Supprime en cascade les estimations générées pour ce projet et les
      // devis commerciaux (module Devis) qu'elles ont éventuellement créés —
      // PermitEstimate.quoteId est un scalaire sans FK (même principe que
      // ConstructionEstimate.quoteId) : sans ce rattrapage, ils resteraient
      // orphelins, rattachés à un projet supprimé et introuvables depuis
      // nulle part dans l'app.
      const now = new Date();
      const estimates = await db.permitEstimate.findMany({
        where: { projectId: Number(id), deletedAt: null },
        select: { id: true, quoteId: true },
      });
      const quoteIds = [...new Set(estimates.map((e) => e.quoteId).filter((qid): qid is number => qid != null))];
      await db.$transaction([
        db.permitProject.update({ where: { id: Number(id) }, data: { deletedAt: now } }),
        ...(estimates.length ? [db.permitEstimate.updateMany({ where: { id: { in: estimates.map((e) => e.id) } }, data: { deletedAt: now } })] : []),
        ...(quoteIds.length ? [db.quote.updateMany({ where: { id: { in: quoteIds }, deletedAt: null }, data: { deletedAt: now } })] : []),
      ]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Estimation rapide (non persistée) ───────────────────────────────
  ipcMain.handle('permits:quickEstimate', async (_event, { token, projectId, characteristics }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      let source: Record<string, unknown> | null = null;
      if (projectId) {
        const project = await db.permitProject.findUnique({ where: { id: Number(projectId) } });
        if (!project || project.deletedAt) return { success: false, error: 'Projet introuvable' };
        if (!(await canAccess(db, session, project))) return { success: false, error: 'Projet inaccessible' };
        source = project as any;
      } else if (characteristics) {
        const parsed = projectSchema.partial({ nom: true } as any).safeParse({ nom: 'x', ...characteristics });
        if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Caractéristiques invalides' };
        source = parsed.data as any;
      } else {
        return { success: false, error: 'projectId ou characteristics requis' };
      }
      const inputs = toPermitProjectInputs(source!);
      const result = await computePermitEstimate(db as any, inputs);
      return { success: true, data: result };
    } catch (error: any) {
      logger.error('permits:quickEstimate error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Génération d'une estimation (persistée) ─────────────────────────
  ipcMain.handle('permits:generateEstimate', async (_event, { token, projectId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const project = await db.permitProject.findUnique({ where: { id: Number(projectId) } });
      if (!project || project.deletedAt) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, project))) return { success: false, error: 'Projet inaccessible' };

      const inputs = toPermitProjectInputs(project as any);
      const result: GeneratedPermitEstimate = await computePermitEstimate(db as any, inputs);

      const reference = await nextEstimateReference(db);
      const lastVersion = await db.permitEstimate.findFirst({ where: { projectId: Number(projectId) }, orderBy: { version: 'desc' }, select: { version: true } });
      const version = (lastVersion?.version ?? 0) + 1;

      const created = await db.$transaction(async (tx) => {
        const estimate = await tx.permitEstimate.create({
          data: {
            reference, projectId: Number(projectId), version, status: 'BROUILLON',
            totalArchitecte: dec(result.totalArchitecte) as any, totalBET: dec(result.totalBET) as any,
            totalGeometre: dec(result.totalGeometre) as any, totalEtudes: dec(result.totalEtudes) as any,
            totalFraisAdministratifs: dec(result.totalFraisAdministratifs) as any, totalTaxes: dec(result.totalTaxes) as any,
            totalHT: dec(result.totalHT) as any, totalTVA: dec(result.totalTVA) as any, totalTTC: dec(result.totalTTC) as any,
            tvaPct: dec(result.tvaPct) as any,
            coutPrevisionnelTravauxSnapshot: result.coutPrevisionnelTravauxSnapshot != null ? (dec(result.coutPrevisionnelTravauxSnapshot) as any) : null,
            warnings: result.warnings as any,
            generatedById: session.userId,
          },
        });
        if (result.lines.length) {
          await tx.permitEstimateLine.createMany({
            data: result.lines.map((l) => ({
              estimateId: estimate.id, feeItemId: l.feeItemId, feeItemCode: l.feeItemCode, category: l.category as any,
              label: l.label, calcMode: l.calcMode as any, baseAmount: l.baseAmount != null ? (dec(l.baseAmount) as any) : null,
              rateValue: dec(l.rateValue) as any, montantHT: dec(l.montantHT) as any, trace: l.trace, order: l.order,
            })),
          });
        }
        await tx.permitProject.update({ where: { id: Number(projectId) }, data: { status: 'ESTIME' } });
        return tx.permitEstimate.findUnique({ where: { id: estimate.id }, include: { lines: { orderBy: { order: 'asc' } } } });
      });

      return { success: true, data: ser(created) };
    } catch (error: any) {
      logger.error('permits:generateEstimate error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Estimations ──────────────────────────────────────────────────────
  ipcMain.handle('permits:estimates:list', async (_event, { token, projectId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const project = await db.permitProject.findUnique({ where: { id: Number(projectId) }, select: { clientId: true, prospectId: true } });
      if (!project) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, project))) return { success: false, error: 'Projet inaccessible' };
      const data = await db.permitEstimate.findMany({ where: { projectId: Number(projectId), deletedAt: null }, orderBy: { version: 'desc' } });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  async function loadEstimate(db: ReturnType<typeof getDb>, session: { role: string; userId: number }, id: number) {
    const estimate = await db.permitEstimate.findUnique({
      where: { id }, include: { project: true, lines: { orderBy: { order: 'asc' } } },
    });
    if (!estimate || estimate.deletedAt) return null;
    if (!(await canAccess(db, session, estimate.project))) throw new Error('Estimation inaccessible');
    return estimate;
  }

  ipcMain.handle('permits:estimates:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const estimate = await loadEstimate(getDb(), session, Number(id));
      if (!estimate) return { success: false, error: 'Estimation introuvable' };
      return { success: true, data: ser(estimate) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:estimates:setStatus', async (_event, { token, id, status }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const estimate = await db.permitEstimate.findUnique({ where: { id: Number(id) }, include: { project: true } });
      if (!estimate || estimate.deletedAt) return { success: false, error: 'Estimation introuvable' };
      if (!(await canAccess(db, session, estimate.project))) return { success: false, error: 'Estimation inaccessible' };
      if (!['VALIDE', 'OBSOLETE'].includes(status)) return { success: false, error: 'Statut invalide' };
      const data = await db.permitEstimate.update({ where: { id: Number(id) }, data: { status } });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('permits:estimates:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, DELETE_ROLES);
      const db = getDb();
      const estimate = await db.permitEstimate.findUnique({ where: { id: Number(id) }, include: { project: true } });
      if (!estimate || estimate.deletedAt) return { success: false, error: 'Estimation introuvable' };
      if (!(await canAccess(db, session, estimate.project))) return { success: false, error: 'Estimation inaccessible' };
      await db.permitEstimate.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Conversion en devis commercial ──────────────────────────────────
  ipcMain.handle('permits:estimates:toQuote', async (_event, { token, ...payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = toQuoteSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const estimate = await db.permitEstimate.findUnique({
        where: { id: parsed.data.estimateId }, include: { project: true, lines: { orderBy: { order: 'asc' } } },
      });
      if (!estimate || estimate.deletedAt) return { success: false, error: 'Estimation introuvable' };
      if (!(await canAccess(db, session, estimate.project))) return { success: false, error: 'Estimation inaccessible' };
      if (estimate.quoteId) return { success: false, error: 'Cette estimation a déjà été convertie en devis.' };
      const p = parsed.data.payload;
      if (!p.clientId && !p.prospectId) return { success: false, error: 'Sélectionnez un client ou un prospect destinataire du devis.' };

      const quoteItems = estimate.lines.map((l) => ({
        lineType: 'ARTICLE' as const,
        designation: l.label,
        reference: l.feeItemCode ?? '',
        category: PERMIT_CATEGORY_LABELS[l.category] ?? l.category,
        quantity: 1,
        unit: null as string | null,
        unitPrice: Number(l.montantHT),
        total: Number(l.montantHT),
      }));
      const { subtotal, taxAmount, total } = resolveQuoteAmounts(
        quoteItems.map((it) => ({ quantity: it.quantity, unitPrice: it.unitPrice })),
        { taxRate: p.taxRate ?? 0 },
      );

      const result = await db.$transaction(async (tx) => {
        const reference = await nextQuoteReference(tx as any);
        const quote = await tx.quote.create({
          data: {
            reference, type: 'PRESTATION', status: 'BROUILLON',
            objet: p.objet?.trim() || `Permis de construire — ${estimate.project.nom}`,
            prospectId: p.prospectId ?? null, clientId: p.clientId ?? null, agentId: p.agentId ?? null,
            validUntil: p.validUntil ? new Date(p.validUntil) : null,
            taxRate: dec(p.taxRate ?? 0) as never, subtotal: dec(subtotal) as never,
            taxAmount: dec(taxAmount) as never, total: dec(total) as never,
            templateId: p.templateId ?? null, referenceColumnLabel: p.referenceColumnLabel ?? null,
            notes: `Généré depuis l'estimation ${estimate.reference} du ${new Date().toLocaleDateString('fr-FR')}.`,
            createdById: session.userId,
            items: {
              create: quoteItems.map((it, i) => ({
                lineType: it.lineType, designation: it.designation, reference: it.reference, category: it.category,
                quantity: dec(it.quantity) as never, unit: it.unit, unitPrice: dec(it.unitPrice) as never,
                total: dec(it.total) as never, order: i,
              })),
            },
          },
        });
        await tx.permitEstimate.update({
          where: { id: estimate.id },
          data: { quoteId: quote.id, quoteReference: quote.reference, convertedAt: new Date(), status: 'CONVERTI' },
        });
        await tx.permitProject.update({ where: { id: estimate.projectId }, data: { status: 'DEVIS_EMIS' } });
        return { id: quote.id, reference: quote.reference };
      });
      return { success: true, data: result };
    } catch (error: any) {
      logger.error('permits:estimates:toQuote error', error.message);
      return { success: false, error: error.message };
    }
  });
}
