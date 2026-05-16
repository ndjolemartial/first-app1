import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { autoGenerateContractCommission } from '../services/commission.service';
import logger from '../utils/logger';
import { z } from 'zod';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];

const contractBaseSchema = z.object({
  assetType: z.enum(['PROPERTY', 'TERRAIN']).default('PROPERTY'),
  propertyId: z.number().int().positive().optional(),
  terrainId: z.number().int().positive().optional(),
  clientId: z.number().int().positive(),
  agentId: z.number().int().optional(),
  type: z.enum(['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE']),
  status: z.enum(['BROUILLON', 'ACTIVE', 'EXPIRE', 'TERMINER', 'ANNULE', 'ATTENTE_SIGNATURE']).default('BROUILLON'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  signedAt: z.string().datetime().optional(),
  rentAmount: z.number().optional(),
  saleAmount: z.number().optional(),
  deposit: z.number().optional(),
  agencyFees: z.number().optional(),
  charges: z.number().optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
  paymentMethod: z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY']).default('ESPECE'),
  paymentModalites: z.enum(['CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS', 'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS']).default('CASH'),
  installmentCount: z.number().int().optional(),
  installmentAmount: z.number().optional(),
  firstInstallmentDate: z.string().datetime().optional(),
  indexType: z.string().optional(),
  notes: z.string().optional(),
});

/** Vérifie qu'un bien OU un terrain est rattaché au contrat selon le type choisi. */
const contractSchema = contractBaseSchema.refine(
  (d) => (d.assetType === 'TERRAIN' ? !!d.terrainId : !!d.propertyId),
  { message: 'Sélectionnez le bien immobilier ou le terrain rattaché au contrat' },
);

const INSTALLMENT_COUNTS: Record<string, number> = {
  CASH: 0, SUR_3_MOIS: 3, SUR_6_MOIS: 6, SUR_9_MOIS: 9, SUR_12_MOIS: 12,
  SUR_24_MOIS: 24, SUR_36_MOIS: 36, SUR_48_MOIS: 48, SUR_60_MOIS: 60,
};

/**
 * Génère la prochaine référence de contrat : CT-YYYY-NNNN
 */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.contract.findFirst({
    where: { reference: { startsWith: `CT-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `CT-${year}-${String(seq).padStart(4, '0')}`;
}

function toDecimal(val: number | undefined) {
  return val as any;
}

/**
 * Enregistre les handlers IPC pour la gestion des contrats.
 */
export function registerContractsIPC(): void {
  ipcMain.handle('contracts:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
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
        db.contract.findMany({
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
        db.contract.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('contracts:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('contracts:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const contract = await db.contract.findUnique({
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
          agent: { select: { id: true, firstName: true, lastName: true } },
          installments: { orderBy: { installmentNumber: 'asc' } },
          invoices: { where: { deletedAt: null }, orderBy: { issueDate: 'desc' }, take: 20 },
          documents: { orderBy: { uploadedAt: 'desc' } },
        },
      });
      if (!contract) return { success: false, error: 'Contrat introuvable' };
      return { success: true, data: contract };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('contracts:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = contractSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db);
      const d = parsed.data;
      const isTerrain = d.assetType === 'TERRAIN';
      const contract = await db.contract.create({
        data: {
          reference,
          assetType: d.assetType,
          propertyId: isTerrain ? null : d.propertyId,
          terrainId: isTerrain ? d.terrainId : null,
          clientId: d.clientId,
          agentId: d.agentId,
          type: d.type,
          status: d.status,
          startDate: new Date(d.startDate),
          endDate: d.endDate ? new Date(d.endDate) : undefined,
          signedAt: d.signedAt ? new Date(d.signedAt) : undefined,
          rentAmount: toDecimal(d.rentAmount),
          saleAmount: toDecimal(d.saleAmount),
          deposit: toDecimal(d.deposit),
          agencyFees: toDecimal(d.agencyFees),
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
      // Met à jour le statut du bien/terrain rattaché si le contrat est ACTIVE
      if (d.status === 'ACTIVE') {
        if (isTerrain && d.terrainId) {
          await db.terrain.update({
            where: { id: d.terrainId },
            data: { statut: d.type === 'SALE' ? 'VENDU' : 'RESERVE' },
          });
        } else if (!isTerrain && d.propertyId) {
          await db.property.update({ where: { id: d.propertyId }, data: { status: 'EN_LOCATION' } });
        }
        // Génère automatiquement la commission de l'agent à l'activation
        await autoGenerateContractCommission(db, contract.id);
      }
      logger.info(`Contract created: ${contract.reference}`);
      return { success: true, data: contract };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('contracts:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = contractBaseSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      const data: any = { ...d };
      if (d.startDate) data.startDate = new Date(d.startDate);
      if (d.endDate) data.endDate = new Date(d.endDate);
      if (d.signedAt) data.signedAt = new Date(d.signedAt);
      if (d.firstInstallmentDate) data.firstInstallmentDate = new Date(d.firstInstallmentDate);
      // Si le rattachement change, neutralise l'élément non sélectionné
      if (d.assetType === 'TERRAIN') data.propertyId = null;
      else if (d.assetType === 'PROPERTY') data.terrainId = null;

      // Statut avant mise à jour, pour détecter le passage à ACTIVE
      const before = await db.contract.findUnique({ where: { id }, select: { status: true } });
      const contract = await db.contract.update({ where: { id, deletedAt: null }, data });

      // Génère automatiquement la commission de l'agent lors du passage à ACTIVE
      if (contract.status === 'ACTIVE' && before?.status !== 'ACTIVE') {
        await autoGenerateContractCommission(db, contract.id);
      }
      return { success: true, data: contract };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('contracts:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ['SUPER_ADMIN', 'ADMIN']);
      const db = getDb();
      await db.contract.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Génère les échéances de vente pour un contrat (paymentModalites != CASH).
   */
  ipcMain.handle('contracts:generateInstallments', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const contract = await db.contract.findUnique({
        where: { id, deletedAt: null },
        select: { id: true, saleAmount: true, paymentModalites: true, installmentCount: true, firstInstallmentDate: true },
      });
      if (!contract) return { success: false, error: 'Contrat introuvable' };
      if (!contract.saleAmount) return { success: false, error: 'Montant de vente manquant' };
      if (!contract.firstInstallmentDate) return { success: false, error: 'Date de première échéance manquante' };

      const count = contract.installmentCount
        ?? INSTALLMENT_COUNTS[contract.paymentModalites]
        ?? 0;
      if (count <= 0) return { success: false, error: 'Nombre d\'échéances invalide' };

      const totalAmount = Number(contract.saleAmount);
      const amountPerInstallment = Math.round((totalAmount / count) * 100) / 100;

      // Supprime les anciennes échéances
      await db.saleInstallment.deleteMany({ where: { contractId: id } });

      const installments = [];
      const firstDate = new Date(contract.firstInstallmentDate);
      for (let i = 0; i < count; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        installments.push({
          contractId: id,
          installmentNumber: i + 1,
          dueDate,
          amount: amountPerInstallment as any,
          status: 'EN_ATTENTE' as const,
        });
      }
      await db.saleInstallment.createMany({ data: installments });

      // Met à jour les champs calculés du contrat
      const lastDate = new Date(firstDate);
      lastDate.setMonth(lastDate.getMonth() + count - 1);
      await db.contract.update({
        where: { id },
        data: {
          installmentCount: count,
          installmentAmount: amountPerInstallment as any,
          lastInstallmentDate: lastDate,
        },
      });

      const created = await db.saleInstallment.findMany({
        where: { contractId: id },
        orderBy: { installmentNumber: 'asc' },
      });
      logger.info(`Generated ${count} installments for contract id=${id}`);
      return { success: true, data: created };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('contracts:getInstallments', async (_event, { token, contractId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const installments = await db.saleInstallment.findMany({
        where: { contractId },
        orderBy: { installmentNumber: 'asc' },
      });
      return { success: true, data: installments };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
