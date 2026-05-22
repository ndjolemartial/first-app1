import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { autoGenerateConventionCommission } from '../services/commission.service';
import logger from '../utils/logger';
import { z } from 'zod';

// Module Conventions : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module.
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES  = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const conventionBaseSchema = z.object({
  assetType: z.enum(['PROPERTY', 'TERRAIN']).default('PROPERTY'),
  propertyId: z.number().int().positive().optional(),
  terrainId: z.number().int().positive().optional(),
  clientId: z.number().int().positive(),
  secondaryClientId: z.number().int().positive().optional(),
  parentConventionId: z.number().int().positive().optional(),
  amendmentType: z.enum(['PROLONGATION_DELAI', 'TRANSFERT_PROPRIETE', 'TRANSFERT_SITE']).optional(),
  agentId: z.number().int().optional(),
  type: z.enum(['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION']),
  status: z.enum(['BROUILLON', 'ACTIVE', 'EXPIRE', 'TERMINER', 'ANNULE', 'ATTENTE_SIGNATURE']).default('BROUILLON'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  signedAt: z.string().datetime().optional(),
  rentAmount: z.number().optional(),
  saleAmount: z.number().optional(),
  apportInitial: z.number().optional(),
  deposit: z.number().optional(),
  agencyFees: z.number().optional(),
  charges: z.number().optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
  paymentMethod: z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'NON_DEFINI']).default('ESPECE'),
  paymentModalites: z.enum(['CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS', 'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS']).default('CASH'),
  installmentCount: z.number().int().optional(),
  installmentAmount: z.number().optional(),
  firstInstallmentDate: z.string().datetime().optional(),
  // Échéancier saisi dans le formulaire (dates + montants par échéance)
  installments: z.array(z.object({
    dueDate: z.string(),
    amount: z.number(),
  })).optional(),
  indexType: z.string().optional(),
  notes: z.string().optional(),
});

/** Types de convention autorisés pour un terrain. */
const TERRAIN_CONVENTION_TYPES = ['SOUSCRIPTION', 'SALE', 'AVENANT', 'RESILIATION'];
/** Types de convention autorisés pour un bien immobilier. */
const PROPERTY_CONVENTION_TYPES = ['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE'];
/** Types de convention devant être liés à une convention initiale/précédente. */
const AMENDMENT_TYPES = ['AVENANT', 'RESILIATION'];

/** Vérifie la cohérence rattachement (bien/terrain) ↔ élément sélectionné et type de convention. */
const conventionSchema = conventionBaseSchema
  .refine(
    (d) => (d.assetType === 'TERRAIN' ? !!d.terrainId : !!d.propertyId),
    { message: 'Sélectionnez le bien immobilier ou le terrain rattaché à la convention' },
  )
  .refine(
    (d) => (d.assetType === 'TERRAIN' ? TERRAIN_CONVENTION_TYPES : PROPERTY_CONVENTION_TYPES).includes(d.type),
    { message: 'Le type de convention ne correspond pas au type de rattachement (bien / terrain)' },
  )
  .refine(
    (d) => (AMENDMENT_TYPES.includes(d.type) ? !!d.parentConventionId : true),
    { message: 'Un avenant ou une résiliation doit être lié à une convention initiale/précédente' },
  )
  .refine(
    (d) => (d.type === 'AVENANT' ? !!d.amendmentType : true),
    { message: 'Précisez la nature de l\'avenant' },
  );

const INSTALLMENT_COUNTS: Record<string, number> = {
  CASH: 0, SUR_3_MOIS: 3, SUR_6_MOIS: 6, SUR_9_MOIS: 9, SUR_12_MOIS: 12,
  SUR_24_MOIS: 24, SUR_36_MOIS: 36, SUR_48_MOIS: 48, SUR_60_MOIS: 60,
};

/**
 * Génère la prochaine référence de convention : CV-YYYY-NNNN
 */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.convention.findFirst({
    where: { reference: { startsWith: `CV-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `CV-${year}-${String(seq).padStart(4, '0')}`;
}

function toDecimal(val: number | undefined) {
  return val as any;
}

/**
 * Sérialise une valeur pour l'IPC : les objets `Decimal` de Prisma ne sont pas
 * clonables par Electron. Le round-trip JSON les convertit en types simples.
 */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Vérifie qu'une convention ne possède pas déjà une résiliation.
 * Une convention peut avoir plusieurs avenants mais une seule résiliation.
 */
async function assertSingleResiliation(
  db: ReturnType<typeof getDb>,
  type: string | undefined,
  parentConventionId: number | undefined,
  currentId?: number,
): Promise<void> {
  if (type !== 'RESILIATION' || !parentConventionId) return;
  const existing = await db.convention.findFirst({
    where: {
      parentConventionId,
      type: 'RESILIATION',
      deletedAt: null,
      ...(currentId ? { id: { not: currentId } } : {}),
    },
    select: { reference: true },
  });
  if (existing) {
    throw new Error(`Cette convention possède déjà une résiliation (${existing.reference})`);
  }
}

/**
 * Enregistre les handlers IPC pour la gestion des conventions.
 */
export function registerConventionsIPC(): void {
  ipcMain.handle('conventions:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      if (filters.clientId) where.clientId = filters.clientId;
      if (filters.propertyId) where.propertyId = filters.propertyId;
      if (filters.terrainId) where.terrainId = filters.terrainId;
      if (filters.assetType) where.assetType = filters.assetType;
      if (filters.agentId) where.agentId = filters.agentId;
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { notes: { contains: filters.search } },
          { client: { firstName: { contains: filters.search } } },
          { client: { lastName: { contains: filters.search } } },
          { property: { reference: { contains: filters.search } } },
          { terrain: { reference: { contains: filters.search } } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.convention.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            property: { select: { id: true, reference: true, address: true, city: true, type: true } },
            terrain: {
              select: {
                id: true, reference: true, numeroIlot: true, numeroParcelle: true,
                lotissement: { select: { nom: true, ville: true } },
              },
            },
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
            agent: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        db.convention.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('conventions:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('conventions:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const convention = await db.convention.findUnique({
        where: { id, deletedAt: null },
        include: {
          property: { include: { owner: { select: { id: true, firstName: true, lastName: true, companyName: true } } } },
          terrain: {
            include: {
              lotissement: { select: { id: true, reference: true, nom: true, ville: true } },
              owner: { select: { id: true, firstName: true, lastName: true, companyName: true } },
            },
          },
          client: true,
          secondaryClient: true,
          parentConvention: { select: { id: true, reference: true, type: true, status: true } },
          amendments: {
            where: { deletedAt: null },
            select: { id: true, reference: true, type: true, status: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
          agent: { select: { id: true, firstName: true, lastName: true } },
          installments: { orderBy: { installmentNumber: 'asc' } },
          invoices: { where: { deletedAt: null }, orderBy: { issueDate: 'desc' }, take: 20 },
          documents: { orderBy: { uploadedAt: 'desc' } },
        },
      });
      if (!convention) return { success: false, error: 'Convention introuvable' };
      return ser({ success: true, data: convention });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('conventions:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = conventionSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join('.') || 'convention'} : ${i.message}`)
          .join(' ; ');
        logger.error('conventions:create validation', msg);
        return { success: false, error: msg };
      }
      const db = getDb();
      const reference = await nextReference(db);
      const d = parsed.data;
      const isTerrain = d.assetType === 'TERRAIN';
      await assertSingleResiliation(db, d.type, d.parentConventionId);
      const convention = await db.convention.create({
        data: {
          reference,
          assetType: d.assetType,
          propertyId: isTerrain ? null : d.propertyId,
          terrainId: isTerrain ? d.terrainId : null,
          clientId: d.clientId,
          secondaryClientId: isTerrain ? (d.secondaryClientId ?? null) : null,
          parentConventionId: AMENDMENT_TYPES.includes(d.type) ? d.parentConventionId : null,
          amendmentType: d.type === 'AVENANT' ? d.amendmentType : null,
          agentId: d.agentId,
          type: d.type,
          status: d.status,
          startDate: new Date(d.startDate),
          endDate: d.endDate ? new Date(d.endDate) : undefined,
          signedAt: d.signedAt ? new Date(d.signedAt) : undefined,
          rentAmount: toDecimal(d.rentAmount),
          saleAmount: toDecimal(d.saleAmount),
          apportInitial: toDecimal(d.apportInitial),
          // Une convention de terrain ne porte ni caution ni honoraires d'agence
          deposit: isTerrain ? null : toDecimal(d.deposit),
          agencyFees: isTerrain ? null : toDecimal(d.agencyFees),
          charges: toDecimal(d.charges),
          paymentDay: d.paymentDay,
          paymentMethod: d.paymentMethod,
          paymentModalites: d.paymentModalites,
          installmentCount: d.installmentCount,
          installmentAmount: toDecimal(d.installmentAmount),
          firstInstallmentDate: d.firstInstallmentDate ? new Date(d.firstInstallmentDate) : undefined,
          indexType: d.indexType,
          notes: d.notes,
        },
      });
      // Met à jour le statut du bien/terrain rattaché si la convention est ACTIVE
      if (d.status === 'ACTIVE') {
        if (isTerrain && d.terrainId) {
          // SALE → VENDU, SOUSCRIPTION → RESERVE, RESILIATION → DISPONIBLE, AVENANT → inchangé
          const terrainStatut: Record<string, 'VENDU' | 'RESERVE' | 'DISPONIBLE'> = {
            SALE: 'VENDU', SOUSCRIPTION: 'RESERVE', RESILIATION: 'DISPONIBLE',
          };
          const nextStatut = terrainStatut[d.type];
          if (nextStatut) {
            await db.terrain.update({ where: { id: d.terrainId }, data: { statut: nextStatut } });
          }
        } else if (!isTerrain && d.propertyId) {
          await db.property.update({ where: { id: d.propertyId }, data: { status: 'EN_LOCATION' } });
        }
        // Génère automatiquement la commission de l'agent à l'activation
        await autoGenerateConventionCommission(db, convention.id);
      }
      // Crée l'échéancier saisi dans le formulaire
      if (d.installments && d.installments.length > 0) {
        await db.saleInstallment.createMany({
          data: d.installments.map((inst, i) => ({
            conventionId: convention.id,
            installmentNumber: i + 1,
            dueDate: new Date(inst.dueDate),
            amount: inst.amount as any,
            status: 'EN_ATTENTE' as const,
          })),
        });
      }
      logger.info(`Convention created: ${convention.reference}`);
      return ser({ success: true, data: convention });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('conventions:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = conventionBaseSchema.partial().safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join('.') || 'convention'} : ${i.message}`)
          .join(' ; ');
        logger.error('conventions:update validation', msg);
        return { success: false, error: msg };
      }
      const db = getDb();
      const d = parsed.data;
      const data: any = { ...d };
      delete data.installments; // relation gérée séparément, pas un champ scalaire
      if (d.startDate) data.startDate = new Date(d.startDate);
      if (d.endDate) data.endDate = new Date(d.endDate);
      if (d.signedAt) data.signedAt = new Date(d.signedAt);
      if (d.firstInstallmentDate) data.firstInstallmentDate = new Date(d.firstInstallmentDate);
      // Si le rattachement change, neutralise l'élément non sélectionné
      if (d.assetType === 'TERRAIN') {
        data.propertyId = null;
        // Une convention de terrain ne porte ni caution ni honoraires d'agence
        data.deposit = null;
        data.agencyFees = null;
      } else if (d.assetType === 'PROPERTY') {
        data.terrainId = null;
        data.secondaryClientId = null;
      }
      // Le lien vers la convention initiale/précédente est réservé aux avenants et résiliations
      if (d.type && !AMENDMENT_TYPES.includes(d.type)) data.parentConventionId = null;
      // La nature de l'avenant ne s'applique qu'aux avenants
      if (d.type && d.type !== 'AVENANT') data.amendmentType = null;
      if (d.parentConventionId && d.parentConventionId === id) {
        return { success: false, error: 'Une convention ne peut pas être liée à elle-même' };
      }
      await assertSingleResiliation(db, d.type, d.parentConventionId, id);

      // Statut avant mise à jour, pour détecter le passage à ACTIVE
      const before = await db.convention.findUnique({ where: { id }, select: { status: true } });
      const convention = await db.convention.update({ where: { id, deletedAt: null }, data });

      // Remplace l'échéancier si un nouvel échéancier est fourni
      if (d.installments) {
        await db.saleInstallment.deleteMany({ where: { conventionId: id } });
        if (d.installments.length > 0) {
          await db.saleInstallment.createMany({
            data: d.installments.map((inst, i) => ({
              conventionId: id,
              installmentNumber: i + 1,
              dueDate: new Date(inst.dueDate),
              amount: inst.amount as any,
              status: 'EN_ATTENTE' as const,
            })),
          });
        }
      }

      // Génère automatiquement la commission de l'agent lors du passage à ACTIVE
      if (convention.status === 'ACTIVE' && before?.status !== 'ACTIVE') {
        await autoGenerateConventionCommission(db, convention.id);
      }
      return ser({ success: true, data: convention });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('conventions:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const db = getDb();
      await db.convention.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Génère les échéances de vente pour une convention (paymentModalites != CASH).
   */
  ipcMain.handle('conventions:generateInstallments', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const convention = await db.convention.findUnique({
        where: { id, deletedAt: null },
        select: { id: true, saleAmount: true, apportInitial: true, paymentModalites: true, installmentCount: true, firstInstallmentDate: true },
      });
      if (!convention) return { success: false, error: 'Convention introuvable' };
      if (!convention.saleAmount) return { success: false, error: 'Montant de vente manquant' };
      if (!convention.firstInstallmentDate) return { success: false, error: 'Date de première échéance manquante' };

      const count = convention.installmentCount
        ?? INSTALLMENT_COUNTS[convention.paymentModalites]
        ?? 0;
      if (count <= 0) return { success: false, error: 'Nombre d\'échéances invalide' };

      // Montant à financer = prix de vente - apport initial
      const totalAmount = Number(convention.saleAmount) - Number(convention.apportInitial ?? 0);
      const amountPerInstallment = Math.round((totalAmount / count) * 100) / 100;

      // Supprime les anciennes échéances
      await db.saleInstallment.deleteMany({ where: { conventionId: id } });

      const installments = [];
      const firstDate = new Date(convention.firstInstallmentDate);
      for (let i = 0; i < count; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        installments.push({
          conventionId: id,
          installmentNumber: i + 1,
          dueDate,
          amount: amountPerInstallment as any,
          status: 'EN_ATTENTE' as const,
        });
      }
      await db.saleInstallment.createMany({ data: installments });

      // Met à jour les champs calculés de la convention
      const lastDate = new Date(firstDate);
      lastDate.setMonth(lastDate.getMonth() + count - 1);
      await db.convention.update({
        where: { id },
        data: {
          installmentCount: count,
          installmentAmount: amountPerInstallment as any,
          lastInstallmentDate: lastDate,
        },
      });

      const created = await db.saleInstallment.findMany({
        where: { conventionId: id },
        orderBy: { installmentNumber: 'asc' },
      });
      logger.info(`Generated ${count} installments for convention id=${id}`);
      return ser({ success: true, data: created });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('conventions:getInstallments', async (_event, { token, conventionId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const installments = await db.saleInstallment.findMany({
        where: { conventionId },
        orderBy: { installmentNumber: 'asc' },
      });
      return ser({ success: true, data: installments });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
