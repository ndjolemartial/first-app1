import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { computeEstimate, toProjectInputs, type GeneratedEstimate } from '../services/construction-engine.service';
import { nextReference as nextQuoteReference, resolveQuoteAmounts } from './quotes.ipc';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Projets & estimations du moteur de devis de construction (Module 17).
 *
 * Création/génération/conversion réservées à SUPER_ADMIN, ADMIN, MANAGER,
 * ACCOUNTANT (vue complète, `FULL_ACCESS`). Les autres rôles (AGENT,
 * AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, READONLY) sont en **lecture seule**,
 * limitée aux projets rattachés à un client ou un prospect dont ils sont le
 * référent commercial (`Client.assignedToId` / `Prospect.assignedToId`) —
 * périmètre par référent, et non plus par créateur du projet.
 */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const FULL_ACCESS = WRITE_ROLES;
const READ_ROLES = [...FULL_ACCESS, 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'READONLY'];
/** Suppression d'un projet ou d'une estimation : réservée à SUPER_ADMIN/ADMIN/MANAGER (ACCOUNTANT exclu, contrairement à la création/modification). */
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/** Filtre de visibilité (liste) : vue complète pour `FULL_ACCESS`, sinon limité aux projets dont le client OU le prospect rattaché a l'utilisateur pour référent. */
function scopeWhere(session: { role: string; userId: number }): Record<string, unknown> {
  if (FULL_ACCESS.includes(session.role)) return {};
  return {
    OR: [
      { client: { is: { assignedToId: session.userId } } },
      { prospect: { is: { assignedToId: session.userId } } },
    ],
  };
}
/** Contrôle d'accès à un projet précis (fiche, génération, conversion…) — même périmètre par référent que `scopeWhere`. */
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

/**
 * Nombre optionnel tolérant la chaîne vide — le panneau « Estimation rapide »
 * (`QuickEstimatePanel`) envoie l'état brut du formulaire à `quickEstimate`
 * (`characteristics`), où un champ numérique optionnel non renseigné vaut `''`
 * (valeur par défaut d'un `<input type="number">` vide), et non `null`/absent
 * comme le fait le payload normalisé de `create`/`update`. Sans ce
 * préprocesseur, Zod rejette `''` avec « expected number, received string ».
 */
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.nullable().optional());

const BUILDING_TYPES = ['VILLA_BASSE', 'VILLA_DUPLEX', 'VILLA_TRIPLEX', 'MAISON_ECONOMIQUE', 'IMMEUBLE_R_PLUS', 'BUREAU', 'COMMERCE', 'ENTREPOT_HANGAR', 'AUTRE'] as const;
const STANDINGS = ['ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE'] as const;
const KITCHEN_TYPES = ['NUE', 'SIMPLE_PAILLASSE', 'EQUIPEE_STANDARD', 'EQUIPEE_HAUT_DE_GAMME'] as const;
const ROOF_TYPES = ['DALLE_PLEINE', 'CHARPENTE_BOIS_TOLE', 'CHARPENTE_BOIS_TUILE', 'CHARPENTE_METALLIQUE_BAC', 'MIXTE_DALLE_CHARPENTE'] as const;
const JOINERY_TYPES = ['ALUMINIUM_STANDARD', 'ALUMINIUM_VITRAGE_TEINTE', 'PVC', 'BOIS_MASSIF', 'METALLIQUE', 'MIXTE_ALU_BOIS'] as const;
const FLOORING_TYPES = ['CHAPE_LISSEE', 'CARRELAGE_GRES_STANDARD', 'CARRELAGE_GRES_CERAME', 'GRANITO', 'MARBRE', 'PARQUET_BOIS', 'MIXTE'] as const;
const AC_TYPES = ['AUCUNE', 'VENTILATION_SEULE', 'SPLIT_PARTIEL', 'SPLIT_TOUTES_PIECES', 'GAINABLE_CENTRALISE'] as const;
const TERRAIN_TYPES = ['PLAT', 'LEGERE_PENTE', 'FORTE_PENTE', 'MARECAGEUX_REMBLAI', 'ROCHEUX'] as const;
const SANITATION_TYPES = ['FOSSE_SEPTIQUE_PUISARD', 'FOSSE_TOUTES_EAUX_EPANDAGE', 'MICRO_STATION', 'RACCORDEMENT_RESEAU_COLLECTIF', 'AUCUN'] as const;
const FENCE_POST_TYPES = ['POTEAUX_SORTANTS', 'POTEAUX_SIMPLES'] as const;
const MARKUP_MODES = ['CASCADE', 'ADDITIF'] as const;
const PRECISION_LEVELS = ['NIVEAU_1', 'NIVEAU_2', 'NIVEAU_3'] as const;
const PROJECT_SCOPES = ['COMPLET', 'CLOTURE_SEULE', 'PISCINE_SEULE'] as const;

/**
 * Portée du devis → lots pris en compte par le moteur (`computeEstimate`,
 * `lotCodeFilter`). LOT01 (installation de chantier) et LOT22 (nettoyage
 * & réception) restent inclus même en portée restreinte — pratique BTP
 * courante, indépendante du lot principal du devis. `COMPLET` = pas de
 * filtre (undefined), tous les lots actifs.
 */
const SCOPE_LOT_CODES: Record<(typeof PROJECT_SCOPES)[number], string[] | undefined> = {
  COMPLET: undefined,
  CLOTURE_SEULE: ['LOT01', 'LOT19', 'LOT22'],
  PISCINE_SEULE: ['LOT01', 'LOT21', 'LOT22'],
};

const projectSchema = z.object({
  nom: z.string().min(1, 'Nom du projet requis'),
  scope: z.enum(PROJECT_SCOPES).default('COMPLET'),
  clientId: z.number().int().positive().nullable().optional(),
  prospectId: z.number().int().positive().nullable().optional(),
  terrainId: z.number().int().positive().nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  agentId: z.number().int().positive().nullable().optional(),

  buildingType: z.enum(BUILDING_TYPES).default('VILLA_BASSE'),
  standing: z.enum(STANDINGS).default('MOYEN_STANDING'),
  levels: z.number().int().min(1).default(1),
  roomCount: z.number().int().min(1).default(1),
  livingRoomCount: z.number().int().min(0).default(1),
  bedroomCount: z.number().int().min(0).default(0),
  bathroomCount: z.number().int().min(0).default(0),
  showerRoomCount: z.number().int().min(0).default(0),
  wcCount: z.number().int().min(0).default(0),
  surfaceHabitable: z.number().positive(),
  surfaceConstruite: optionalNumber(z.number().positive()),
  kitchenType: z.enum(KITCHEN_TYPES).default('EQUIPEE_STANDARD'),

  roofType: z.enum(ROOF_TYPES).default('DALLE_PLEINE'),
  joineryType: z.enum(JOINERY_TYPES).default('ALUMINIUM_STANDARD'),
  interiorJoineryType: z.enum(JOINERY_TYPES).nullable().optional(),
  flooringType: z.enum(FLOORING_TYPES).default('CARRELAGE_GRES_STANDARD'),
  acType: z.enum(AC_TYPES).default('SPLIT_PARTIEL'),
  acRoomCount: optionalNumber(z.number().int().min(0)),
  hasFalseCeiling: z.boolean().default(false),

  terrainType: z.enum(TERRAIN_TYPES).default('PLAT'),
  terrainSurface: optionalNumber(z.number().positive()),
  localityId: z.number().int().positive().nullable().optional(),
  ville: z.string().nullable().optional(),
  commune: z.string().nullable().optional(),
  quartier: z.string().nullable().optional(),
  sanitationType: z.enum(SANITATION_TYPES).default('FOSSE_SEPTIQUE_PUISARD'),
  hasWaterConnection: z.boolean().default(true),
  hasElectricityConnection: z.boolean().default(true),

  fenceLength: optionalNumber(z.number().min(0)),
  fenceHeight: optionalNumber(z.number().min(0)),
  fenceHasCrepissage: z.boolean().default(false),
  fenceHasChainageHaut: z.boolean().default(false),
  fencePostType: z.enum(FENCE_POST_TYPES).default('POTEAUX_SIMPLES'),
  gateCount: z.number().int().min(0).default(0),
  hasPool: z.boolean().default(false),
  poolSurface: optionalNumber(z.number().min(0)),
  hasExteriorLayout: z.boolean().default(false),
  exteriorPavedSurface: optionalNumber(z.number().min(0)),
  hasLandscaping: z.boolean().default(false),

  fraisChantierPct: optionalNumber(z.number().min(0)),
  fraisGenerauxPct: optionalNumber(z.number().min(0)),
  margePct: optionalNumber(z.number().min(0)),
  tvaPct: optionalNumber(z.number().min(0)),
  markupMode: z.enum(MARKUP_MODES).nullable().optional(),

  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const computeOptionsSchema = z.object({
  ratioProfileId: z.number().int().positive().nullable().optional(),
  localityId: z.number().int().positive().nullable().optional(),
  fraisChantierPct: optionalNumber(z.number().min(0)),
  fraisGenerauxPct: optionalNumber(z.number().min(0)),
  margePct: optionalNumber(z.number().min(0)),
  tvaPct: optionalNumber(z.number().min(0)),
  markupMode: z.enum(MARKUP_MODES).nullable().optional(),
  puRoundingStep: z.number().int().positive().nullable().optional(),
  toleranceRangePct: optionalNumber(z.number().min(0)),
  // Remise globale — pourcentage ou montant fixe (cf. Quote.discountAmount).
  discountAmount: optionalNumber(z.number().min(0)),
  discountIsPercent: z.boolean().nullable().optional(),
  discountPercent: optionalNumber(z.number().min(0).max(100)),
});

const generateSchema = z.object({
  projectId: z.number().int().positive(),
  precisionLevel: z.enum(PRECISION_LEVELS).default('NIVEAU_2'),
  label: z.string().nullable().optional(),
  options: computeOptionsSchema.default({}),
  createQuote: z.boolean().default(false),
  quote: z.object({
    prospectId: z.number().int().positive().nullable().optional(),
    clientId: z.number().int().positive().nullable().optional(),
    agentId: z.number().int().positive().nullable().optional(),
    objet: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    taxRate: z.number().min(0).default(0),
    templateId: z.number().int().positive().nullable().optional(),
    referenceColumnLabel: z.string().nullable().optional(),
    splitLaborByLot: z.boolean().default(false).optional(),
  }).optional(),
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
    splitLaborByLot: z.boolean().default(false).optional(),
  }),
});

/** Référence auto PC-YYYY-NNNN (projets de construction). */
async function nextProjectReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.constructionProject.findFirst({
    where: { reference: { startsWith: `PC-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `PC-${year}-${String(seq).padStart(4, '0')}`;
}

/** Référence auto EST-YYYY-NNNN (estimations). */
async function nextEstimateReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.constructionEstimate.findFirst({
    where: { reference: { startsWith: `EST-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `EST-${year}-${String(seq).padStart(4, '0')}`;
}

/** Sérialise les champs Decimal d'un projet en `data` Prisma pour create/update. */
function projectDataFromPayload(d: z.infer<typeof projectSchema>): Record<string, unknown> {
  return {
    ...d,
    surfaceHabitable: dec(d.surfaceHabitable),
    surfaceConstruite: d.surfaceConstruite != null ? dec(d.surfaceConstruite) : null,
    terrainSurface: d.terrainSurface != null ? dec(d.terrainSurface) : null,
    fenceLength: d.fenceLength != null ? dec(d.fenceLength) : null,
    fenceHeight: d.fenceHeight != null ? dec(d.fenceHeight) : null,
    poolSurface: d.poolSurface != null ? dec(d.poolSurface) : null,
    exteriorPavedSurface: d.exteriorPavedSurface != null ? dec(d.exteriorPavedSurface) : null,
    fraisChantierPct: d.fraisChantierPct != null ? dec(d.fraisChantierPct) : null,
    fraisGenerauxPct: d.fraisGenerauxPct != null ? dec(d.fraisGenerauxPct) : null,
    margePct: d.margePct != null ? dec(d.margePct) : null,
    tvaPct: d.tvaPct != null ? dec(d.tvaPct) : null,
  };
}

const PROJECT_INCLUDE = {
  client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
  prospect: { select: { id: true, firstName: true, lastName: true } },
  terrain: { select: { id: true, reference: true } },
  agent: { select: { id: true, firstName: true, lastName: true } },
  locality: true,
  _count: { select: { estimates: true } },
};

type EstimateLineForQuote = {
  lotLabel: string; lotCode: string; designation: string; unit: string | null;
  quantity: unknown; prixUnitaireHT: unknown; montantHT: unknown;
  deboursMainOeuvre: unknown; deboursSecUnitaire: unknown;
};

/**
 * Construit les lignes d'articles à partir des lignes d'une estimation.
 *
 * Par défaut (`splitLaborByLot: false`), reprend chaque ligne telle quelle —
 * la main d'œuvre reste fondue dans le prix unitaire de l'ouvrage (comportement
 * historique, inchangé).
 *
 * Avec `splitLaborByLot: true`, chaque ligne voit sa part main d'œuvre
 * (`deboursMainOeuvre`, déjà connue par ouvrage) retirée de son prix — au
 * même ratio de marquage que le reste (`prixUnitaireHT / deboursSecUnitaire`,
 * un facteur multiplicatif constant quel que soit le déboursé, cf. cascade
 * DS→CR→PR→PV dans `construction-engine.service.ts`) — et une ligne
 * récapitulative « Main d'œuvre — <lot> » est ajoutée en fin de chaque lot.
 * Le sous-total de chaque lot (et le total du devis) reste identique au
 * centime près : la ligne main d'œuvre est calculée par complément
 * (`montant − matériaux`), jamais par un recalcul indépendant.
 */
function buildQuoteItems(
  lines: EstimateLineForQuote[],
  splitLaborByLot: boolean,
): Array<{ lineType: 'ARTICLE'; designation: string; reference: string; category: string; quantity: number; unit: string | null; unitPrice: number; total: number }> {
  const active = lines.filter((l) => Number(l.quantity) > 0);
  if (!splitLaborByLot) {
    return active.map((l) => ({
      lineType: 'ARTICLE' as const, designation: l.designation, reference: l.lotCode, category: l.lotLabel,
      quantity: Number(l.quantity), unit: l.unit, unitPrice: Number(l.prixUnitaireHT), total: Number(l.montantHT),
    }));
  }

  const laborByLot = new Map<string, number>(); // lotCode -> montant main d'œuvre cumulé
  const lotLabelByCode = new Map<string, string>();
  const materialItems = active.map((l) => {
    const qty = Number(l.quantity);
    const montant = Number(l.montantHT);
    const ds = Number(l.deboursSecUnitaire);
    const moDS = Number(l.deboursMainOeuvre);
    lotLabelByCode.set(l.lotCode, l.lotLabel);
    if (ds > 0 && moDS > 0) {
      const ratio = Number(l.prixUnitaireHT) / ds;
      const moUnitPrice = Math.round(moDS * ratio * 100) / 100;
      const materialUnitPrice = Math.round((Number(l.prixUnitaireHT) - moUnitPrice) * 100) / 100;
      const materialMontant = Math.round(materialUnitPrice * qty * 100) / 100;
      const moMontant = Math.round((montant - materialMontant) * 100) / 100; // complément exact, pas de dérive centime
      laborByLot.set(l.lotCode, (laborByLot.get(l.lotCode) ?? 0) + moMontant);
      return {
        lineType: 'ARTICLE' as const, designation: l.designation, reference: l.lotCode, category: l.lotLabel,
        quantity: qty, unit: l.unit, unitPrice: materialUnitPrice, total: materialMontant,
      };
    }
    return {
      lineType: 'ARTICLE' as const, designation: l.designation, reference: l.lotCode, category: l.lotLabel,
      quantity: qty, unit: l.unit, unitPrice: Number(l.prixUnitaireHT), total: montant,
    };
  });

  const laborItems = Array.from(laborByLot.entries())
    .filter(([, montant]) => montant > 0)
    .map(([lotCode, montant]) => ({
      lineType: 'ARTICLE' as const, designation: `Main d'œuvre — ${lotLabelByCode.get(lotCode)}`,
      reference: lotCode, category: lotLabelByCode.get(lotCode)!, quantity: 1, unit: null,
      unitPrice: montant, total: montant,
    }));

  // Les lignes « Main d'œuvre » sont ajoutées en fin de tableau : groupItemsByCategory
  // (quoteTemplate.ts) regroupe par catégorie en préservant l'ordre d'insertion au sein
  // d'un groupe, donc chacune atterrit bien en dernière ligne de son lot.
  return [...materialItems, ...laborItems];
}

/**
 * Construit les lignes `QuoteItem` et les totaux d'un devis à partir des
 * lignes d'une estimation — mapping direct lot → catégorie (déclenche le
 * regroupement/sous-total déjà géré par `groupItemsByCategory`, cf.
 * `quoteTemplate.ts`), sans dupliquer la logique de totaux du module Devis
 * (réutilisation de `resolveQuoteAmounts`/`nextReference` exportées telles
 * quelles par `quotes.ipc.ts`).
 */
async function buildQuoteFromEstimate(
  tx: any,
  session: { userId: number },
  estimate: {
    id: number; reference: string; projectId: number;
    discountAmount: unknown; discountIsPercent: boolean; discountPercent: unknown;
  },
  projectNom: string,
  lines: EstimateLineForQuote[],
  payload: z.infer<typeof toQuoteSchema>['payload'],
): Promise<{ id: number; reference: string }> {
  if (!payload.clientId && !payload.prospectId) {
    throw new Error('Sélectionnez un client ou un prospect destinataire du devis.');
  }
  const quoteItems = buildQuoteItems(lines, payload.splitLaborByLot ?? false);
  // La remise éventuelle de l'estimation (ConstructionEstimate.discount*) doit
  // se répercuter sur le devis généré, sous peine que le TOTAL du devis ne
  // corresponde plus au Total HT de l'estimation dont il est issu.
  const discountIsPercent = estimate.discountIsPercent;
  const discountPercent = estimate.discountPercent != null ? Number(estimate.discountPercent) : null;
  const discountAmount = Number(estimate.discountAmount ?? 0);
  const { subtotal, taxAmount, total, discountAmount: resolvedDiscountAmount } = resolveQuoteAmounts(
    quoteItems.map((it) => ({ quantity: it.quantity, unitPrice: it.unitPrice })),
    { taxRate: payload.taxRate ?? 0, discountAmount, discountIsPercent, discountPercent },
  );
  const reference = await nextQuoteReference(tx as any);
  const quote = await tx.quote.create({
    data: {
      reference,
      type: 'PRESTATION',
      status: 'BROUILLON',
      objet: payload.objet?.trim() || `Construction — ${projectNom}`,
      prospectId: payload.prospectId ?? null,
      clientId: payload.clientId ?? null,
      agentId: payload.agentId ?? null,
      validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
      taxRate: dec(payload.taxRate ?? 0) as never,
      subtotal: dec(subtotal) as never,
      discountAmount: dec(resolvedDiscountAmount) as never,
      discountIsPercent,
      discountPercent: discountPercent != null ? (dec(discountPercent) as never) : null,
      taxAmount: dec(taxAmount) as never,
      total: dec(total) as never,
      templateId: payload.templateId ?? null,
      referenceColumnLabel: payload.referenceColumnLabel ?? null,
      notes: `Généré depuis l'estimation ${estimate.reference} du ${new Date().toLocaleDateString('fr-FR')}.`,
      createdById: session.userId,
      items: {
        create: quoteItems.map((it, i) => ({
          lineType: it.lineType,
          designation: it.designation,
          reference: it.reference,
          category: it.category,
          quantity: dec(it.quantity) as never,
          unit: it.unit,
          unitPrice: dec(it.unitPrice) as never,
          total: dec(it.total) as never,
          order: i,
        })),
      },
    },
  });
  return { id: quote.id, reference: quote.reference };
}

export function registerConstructionProjectsIPC(): void {
  // ── Projets ──────────────────────────────────────────────────────────
  ipcMain.handle('construction:projects:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null, ...scopeWhere(session) };
      if (filters.status) where.status = filters.status;
      if (filters.buildingType) where.buildingType = filters.buildingType;
      if (filters.standing) where.standing = filters.standing;
      if (filters.clientId) where.clientId = Number(filters.clientId);
      if (filters.prospectId) where.prospectId = Number(filters.prospectId);
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { nom: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.constructionProject.findMany({ where, include: PROJECT_INCLUDE, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        db.constructionProject.count({ where }),
      ]);
      return { success: true, data: ser(data), total };
    } catch (error: any) {
      logger.error('construction:projects:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:projects:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const project = await db.constructionProject.findUnique({
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

  ipcMain.handle('construction:projects:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = projectSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const reference = await nextProjectReference(db);
      const data = await db.constructionProject.create({
        data: { ...projectDataFromPayload(parsed.data), reference, createdById: session.userId } as any,
        include: PROJECT_INCLUDE,
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:projects:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:projects:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const existing = await db.constructionProject.findUnique({ where: { id: Number(id) } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, existing))) return { success: false, error: 'Projet inaccessible' };
      const parsed = projectSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const data = await db.constructionProject.update({
        where: { id: Number(id) },
        data: projectDataFromPayload(parsed.data as z.infer<typeof projectSchema>) as any,
        include: PROJECT_INCLUDE,
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      logger.error('construction:projects:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:projects:duplicate', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const source = await db.constructionProject.findUnique({ where: { id: Number(id) } });
      if (!source || source.deletedAt) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, source))) return { success: false, error: 'Projet inaccessible' };
      const reference = await nextProjectReference(db);
      const { id: _id, uuid: _uuid, reference: _ref, createdAt, updatedAt, deletedAt, status, ...rest } = source as any;
      const data = await db.constructionProject.create({
        data: { ...rest, reference, nom: `${source.nom} (copie)`, status: 'BROUILLON', createdById: session.userId },
        include: PROJECT_INCLUDE,
      });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:projects:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, DELETE_ROLES);
      const db = getDb();
      const existing = await db.constructionProject.findUnique({ where: { id: Number(id) }, select: { clientId: true, prospectId: true, deletedAt: true } });
      if (!existing || existing.deletedAt) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, existing))) return { success: false, error: 'Projet inaccessible' };

      // Supprime en cascade les estimations générées pour ce projet et les
      // devis commerciaux (module Devis) qu'elles ont éventuellement créés —
      // ConstructionEstimate.quoteId est un scalaire sans FK (cf. quotes:delete
      // ci-dessus) : sans ce rattrapage, ils resteraient orphelins, rattachés
      // à un projet supprimé et introuvables depuis nulle part dans l'app.
      const now = new Date();
      const estimates = await db.constructionEstimate.findMany({
        where: { projectId: Number(id), deletedAt: null },
        select: { id: true, quoteId: true },
      });
      const quoteIds = [...new Set(estimates.map((e) => e.quoteId).filter((qid): qid is number => qid != null))];
      await db.$transaction([
        db.constructionProject.update({ where: { id: Number(id) }, data: { deletedAt: now } }),
        ...(estimates.length ? [db.constructionEstimate.updateMany({ where: { id: { in: estimates.map((e) => e.id) } }, data: { deletedAt: now } })] : []),
        ...(quoteIds.length ? [db.quote.updateMany({ where: { id: { in: quoteIds }, deletedAt: null }, data: { deletedAt: now } })] : []),
      ]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Niveau 1 — Estimation rapide (non persistée) ────────────────────
  ipcMain.handle('construction:quickEstimate', async (_event, { token, projectId, characteristics }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      let source: Record<string, unknown> | null = null;
      if (projectId) {
        const project = await db.constructionProject.findUnique({ where: { id: Number(projectId) } });
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
      const inputs = toProjectInputs(source!);
      const scope = ((source as any).scope ?? 'COMPLET') as keyof typeof SCOPE_LOT_CODES;
      const result = await computeEstimate(db as any, inputs, {
        localityId: (source as any).localityId ?? undefined,
        fraisChantierPct: (source as any).fraisChantierPct != null ? Number((source as any).fraisChantierPct) : undefined,
        fraisGenerauxPct: (source as any).fraisGenerauxPct != null ? Number((source as any).fraisGenerauxPct) : undefined,
        margePct: (source as any).margePct != null ? Number((source as any).margePct) : undefined,
        tvaPct: (source as any).tvaPct != null ? Number((source as any).tvaPct) : undefined,
        markupMode: (source as any).markupMode ?? undefined,
        lotCodeFilter: SCOPE_LOT_CODES[scope],
      });
      return {
        success: true,
        data: {
          totalHT: result.totalHT, budgetMin: result.budgetMin, budgetMax: result.budgetMax,
          toleranceRangePct: result.toleranceRangePct, prixMoyenM2: result.prixMoyenM2,
          byPhase: result.byPhase, byLot: result.byLot, coveragePct: result.coveragePct,
          totalDeboursSec: result.totalDeboursSec, totalMarge: result.totalMarge,
          warnings: result.warnings,
        },
      };
    } catch (error: any) {
      logger.error('construction:quickEstimate error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Génération d'une estimation (Niveau 1 ou 2, persistée) ──────────
  ipcMain.handle('construction:generateEstimate', async (_event, { token, ...payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = generateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const db = getDb();
      const project = await db.constructionProject.findUnique({ where: { id: d.projectId } });
      if (!project || project.deletedAt) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, project))) return { success: false, error: 'Projet inaccessible' };
      if (d.createQuote && !d.quote) return { success: false, error: 'Informations du devis manquantes (createQuote=true).' };

      const inputs = toProjectInputs(project as any);
      const opts = d.options;
      const result: GeneratedEstimate = await computeEstimate(db as any, inputs, {
        ratioProfileId: opts.ratioProfileId ?? undefined,
        localityId: opts.localityId ?? project.localityId ?? undefined,
        fraisChantierPct: opts.fraisChantierPct ?? (project.fraisChantierPct != null ? Number(project.fraisChantierPct) : undefined),
        fraisGenerauxPct: opts.fraisGenerauxPct ?? (project.fraisGenerauxPct != null ? Number(project.fraisGenerauxPct) : undefined),
        margePct: opts.margePct ?? (project.margePct != null ? Number(project.margePct) : undefined),
        tvaPct: opts.tvaPct ?? (project.tvaPct != null ? Number(project.tvaPct) : undefined),
        markupMode: opts.markupMode ?? (project.markupMode as any) ?? undefined,
        puRoundingStep: opts.puRoundingStep ?? undefined,
        toleranceRangePct: opts.toleranceRangePct ?? undefined,
        discountAmount: opts.discountAmount ?? undefined,
        discountIsPercent: opts.discountIsPercent ?? undefined,
        discountPercent: opts.discountPercent ?? undefined,
        lotCodeFilter: SCOPE_LOT_CODES[project.scope as keyof typeof SCOPE_LOT_CODES],
      });

      const reference = await nextEstimateReference(db);
      const lastVersion = await db.constructionEstimate.findFirst({ where: { projectId: d.projectId }, orderBy: { version: 'desc' }, select: { version: true } });
      const version = (lastVersion?.version ?? 0) + 1;

      const created = await db.$transaction(async (tx) => {
        const estimate = await tx.constructionEstimate.create({
          data: {
            reference, projectId: d.projectId, version, precisionLevel: d.precisionLevel, status: 'BROUILLON', label: d.label ?? null,
            ratioProfileId: result.ratioProfileId, ratioProfileName: result.ratioProfileName, ratioSnapshot: result.ratioSnapshot as any,
            localityId: result.localityId, localityLabel: result.localityLabel,
            markupMode: result.markupMode, fraisChantierPct: dec(result.fraisChantierPct) as any, fraisGenerauxPct: dec(result.fraisGenerauxPct) as any,
            margePct: dec(result.margePct) as any, tvaPct: dec(result.tvaPct) as any, puRoundingStep: result.puRoundingStep,
            discountAmount: dec(result.discountAmount) as any, discountIsPercent: result.discountIsPercent,
            discountPercent: result.discountPercent != null ? (dec(result.discountPercent) as any) : null,
            totalDeboursMateriaux: dec(result.totalDeboursMateriaux) as any, totalDeboursMainOeuvre: dec(result.totalDeboursMainOeuvre) as any,
            totalDeboursTransport: dec(result.totalDeboursTransport) as any, totalDeboursAutres: dec(result.totalDeboursAutres) as any,
            totalDeboursSec: dec(result.totalDeboursSec) as any, totalFraisChantier: dec(result.totalFraisChantier) as any,
            totalFraisGeneraux: dec(result.totalFraisGeneraux) as any, totalMarge: dec(result.totalMarge) as any,
            subtotalHT: dec(result.subtotalHT) as any,
            totalHT: dec(result.totalHT) as any, totalTVA: dec(result.totalTVA) as any, totalTTC: dec(result.totalTTC) as any,
            prixMoyenM2: result.prixMoyenM2 != null ? (dec(result.prixMoyenM2) as any) : null,
            toleranceRangePct: dec(result.toleranceRangePct) as any, budgetMin: dec(result.budgetMin) as any, budgetMax: dec(result.budgetMax) as any,
            coveragePct: dec(result.coveragePct) as any, warnings: result.warnings as any,
            generatedById: session.userId,
          },
        });

        if (result.lines.length) {
          await tx.constructionEstimateLine.createMany({
            data: result.lines.map((l) => ({
              estimateId: estimate.id, lotId: l.lotId, lotCode: l.lotCode, lotLabel: l.lotLabel, lotNumero: l.lotNumero, lotPhase: l.lotPhase as any,
              workItemId: l.workItemId, workItemCode: l.workItemCode, designation: l.designation, unit: l.unit,
              computedQuantity: dec(l.computedQuantity) as any, quantity: dec(l.quantity) as any,
              deboursMateriaux: dec(l.deboursMateriaux) as any, deboursMainOeuvre: dec(l.deboursMainOeuvre) as any,
              deboursTransport: dec(l.deboursTransport) as any, deboursAutres: dec(l.deboursAutres) as any, deboursSecUnitaire: dec(l.deboursSecUnitaire) as any,
              fraisChantierUnit: dec(l.fraisChantierUnit) as any, fraisGenerauxUnit: dec(l.fraisGenerauxUnit) as any, margeUnit: dec(l.margeUnit) as any,
              prixUnitaireHT: dec(l.prixUnitaireHT) as any, montantHT: dec(l.montantHT) as any,
              formulaCode: l.formulaCode, formulaTrace: l.formulaTrace, order: l.order,
            })),
          });
        }
        if (result.resourceLines.length) {
          await tx.constructionEstimateResourceLine.createMany({
            data: result.resourceLines.map((r, i) => ({
              estimateId: estimate.id, resourceId: r.resourceId, resourceCode: r.resourceCode, resourceLabel: r.resourceLabel,
              resourceType: r.resourceType as any, family: r.family, unit: r.unit,
              quantityNette: dec(r.quantityNette) as any, quantity: dec(r.quantity) as any, unitPrice: dec(r.unitPrice) as any, montant: dec(r.montant) as any,
              order: i,
            })),
          });
        }

        let quoteInfo: { id: number; reference: string } | null = null;
        if (d.createQuote && d.quote) {
          quoteInfo = await buildQuoteFromEstimate(tx, session, estimate, project.nom, result.lines, d.quote);
          await tx.constructionEstimate.update({
            where: { id: estimate.id },
            data: { quoteId: quoteInfo.id, quoteReference: quoteInfo.reference, convertedAt: new Date(), status: 'CONVERTI' },
          });
        }
        await tx.constructionProject.update({ where: { id: d.projectId }, data: { status: quoteInfo ? 'DEVIS_EMIS' : 'ESTIME' } });

        return tx.constructionEstimate.findUnique({ where: { id: estimate.id }, include: { lines: { orderBy: { order: 'asc' } }, resourceLines: true } });
      });

      return { success: true, data: ser(created) };
    } catch (error: any) {
      logger.error('construction:generateEstimate error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Estimations ──────────────────────────────────────────────────────
  ipcMain.handle('construction:estimates:list', async (_event, { token, projectId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const project = await db.constructionProject.findUnique({ where: { id: Number(projectId) }, select: { clientId: true, prospectId: true } });
      if (!project) return { success: false, error: 'Projet introuvable' };
      if (!(await canAccess(db, session, project))) return { success: false, error: 'Projet inaccessible' };
      const data = await db.constructionEstimate.findMany({ where: { projectId: Number(projectId), deletedAt: null }, orderBy: { version: 'desc' } });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  async function loadEstimate(db: ReturnType<typeof getDb>, session: { role: string; userId: number }, id: number) {
    const estimate = await db.constructionEstimate.findUnique({
      where: { id }, include: { project: true, lines: { orderBy: { order: 'asc' } }, resourceLines: { orderBy: { montant: 'desc' } } },
    });
    if (!estimate || estimate.deletedAt) return null;
    if (!(await canAccess(db, session, estimate.project))) throw new Error('Estimation inaccessible');
    return estimate;
  }

  ipcMain.handle('construction:estimates:getById', async (_event, { token, id }: any) => {
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

  ipcMain.handle('construction:estimates:summary', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const estimate = await loadEstimate(getDb(), session, Number(id));
      if (!estimate) return { success: false, error: 'Estimation introuvable' };
      const byPhaseMap = new Map<string, number>();
      const byLotMap = new Map<string, { lotLabel: string; montantHT: number }>();
      for (const l of estimate.lines) {
        byPhaseMap.set(l.lotPhase, (byPhaseMap.get(l.lotPhase) ?? 0) + Number(l.montantHT));
        const existing = byLotMap.get(l.lotCode);
        if (existing) existing.montantHT += Number(l.montantHT);
        else byLotMap.set(l.lotCode, { lotLabel: l.lotLabel, montantHT: Number(l.montantHT) });
      }
      const totalHT = Number(estimate.totalHT);
      const tauxMargeSurPV = totalHT > 0 ? Math.round((Number(estimate.totalMarge) / totalHT) * 1000) / 10 : 0;
      return {
        success: true,
        data: {
          project: ser(estimate.project),
          byPhase: [...byPhaseMap.entries()].map(([phase, montantHT]) => ({ phase, montantHT })),
          byLot: [...byLotMap.entries()].map(([lotCode, v]) => ({ lotCode, ...v })),
          totalDeboursSec: Number(estimate.totalDeboursSec), totalFraisChantier: Number(estimate.totalFraisChantier),
          totalFraisGeneraux: Number(estimate.totalFraisGeneraux), totalMarge: Number(estimate.totalMarge),
          subtotalHT: Number(estimate.subtotalHT), discountAmount: Number(estimate.discountAmount),
          discountIsPercent: estimate.discountIsPercent, discountPercent: estimate.discountPercent != null ? Number(estimate.discountPercent) : null,
          totalHT, totalTVA: Number(estimate.totalTVA), totalTTC: Number(estimate.totalTTC), tauxMargeSurPV,
          prixMoyenM2: estimate.prixMoyenM2 != null ? Number(estimate.prixMoyenM2) : null,
          coveragePct: estimate.coveragePct != null ? Number(estimate.coveragePct) : null,
          warnings: estimate.warnings ?? [],
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:estimates:materials', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const estimate = await loadEstimate(getDb(), session, Number(id));
      if (!estimate) return { success: false, error: 'Estimation introuvable' };
      const data = estimate.resourceLines.filter((r) => r.resourceType === 'MATERIAU' || r.resourceType === 'MATERIEL' || r.resourceType === 'SOUS_TRAITANCE');
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:estimates:labor', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const estimate = await loadEstimate(getDb(), session, Number(id));
      if (!estimate) return { success: false, error: 'Estimation introuvable' };
      const HEURES_PAR_JOUR = 8;
      const data = estimate.resourceLines
        .filter((r) => r.resourceType === 'MAIN_OEUVRE')
        .map((r) => ({ ...r, hommeJours: Math.round((Number(r.quantity) / HEURES_PAR_JOUR) * 100) / 100 }));
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:estimates:toQuote', async (_event, { token, ...payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = toQuoteSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const db = getDb();
      const estimate = await db.constructionEstimate.findUnique({
        where: { id: parsed.data.estimateId }, include: { project: true, lines: { orderBy: { order: 'asc' } } },
      });
      if (!estimate || estimate.deletedAt) return { success: false, error: 'Estimation introuvable' };
      if (!(await canAccess(db, session, estimate.project))) return { success: false, error: 'Estimation inaccessible' };
      if (estimate.quoteId) return { success: false, error: 'Cette estimation a déjà été convertie en devis.' };

      const result = await db.$transaction(async (tx) => {
        const quoteInfo = await buildQuoteFromEstimate(tx, session, estimate, estimate.project.nom, estimate.lines, parsed.data.payload);
        await tx.constructionEstimate.update({
          where: { id: estimate.id },
          data: { quoteId: quoteInfo.id, quoteReference: quoteInfo.reference, convertedAt: new Date(), status: 'CONVERTI' },
        });
        await tx.constructionProject.update({ where: { id: estimate.projectId }, data: { status: 'DEVIS_EMIS' } });
        return quoteInfo;
      });
      return { success: true, data: result };
    } catch (error: any) {
      logger.error('construction:estimates:toQuote error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:estimates:setStatus', async (_event, { token, id, status }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const estimate = await db.constructionEstimate.findUnique({ where: { id: Number(id) }, include: { project: true } });
      if (!estimate || estimate.deletedAt) return { success: false, error: 'Estimation introuvable' };
      if (!(await canAccess(db, session, estimate.project))) return { success: false, error: 'Estimation inaccessible' };
      if (!['VALIDE', 'OBSOLETE'].includes(status)) return { success: false, error: 'Statut invalide' };
      const data = await db.constructionEstimate.update({ where: { id: Number(id) }, data: { status } });
      return { success: true, data: ser(data) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('construction:estimates:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, DELETE_ROLES);
      const db = getDb();
      const estimate = await db.constructionEstimate.findUnique({ where: { id: Number(id) }, include: { project: true } });
      if (!estimate || estimate.deletedAt) return { success: false, error: 'Estimation introuvable' };
      if (!(await canAccess(db, session, estimate.project))) return { success: false, error: 'Estimation inaccessible' };
      await db.constructionEstimate.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
