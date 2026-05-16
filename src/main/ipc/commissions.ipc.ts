import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import {
  nextCommissionRef,
  getDefaultRates,
  setDefaultRates,
  isCommissionEligibleContract,
  computeCommissionAmount,
} from '../services/commission.service';
import logger from '../utils/logger';
import { z } from 'zod';

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const PAYMENT_METHODS = ['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY'] as const;

/* ─── Schémas de validation Zod ────────────────────────────────────── */

const createCommissionSchema = z.object({
  contractId: z.number().int().positive(),
  beneficiaryType: z.enum(['USER', 'REFERRER']),
  userId: z.number().int().positive().optional(),
  referrerId: z.number().int().positive().optional(),
  transactionType: z.enum(['VENTE', 'LOCATION', 'FRAIS_DOSSIER']),
  baseAmount: z.number().positive(),
  rate: z.number().min(0).max(100),
  notes: z.string().optional(),
}).refine(
  (d) => (d.beneficiaryType === 'USER' ? !!d.userId : !!d.referrerId),
  { message: 'Bénéficiaire requis' },
);

const payCommissionSchema = z.object({
  id: z.number().int().positive(),
  method: z.enum(PAYMENT_METHODS),
  paymentRef: z.string().optional(),
  paidAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const cancelCommissionSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().min(1, 'Motif requis'),
});

const referrerSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  companyName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

const settingsSchema = z.object({
  saleRate: z.number().min(0).max(100),
  rentalRate: z.number().min(0).max(100),
  dossierRate: z.number().min(0).max(100),
});

/* ─── Inclusions Prisma réutilisables ──────────────────────────────── */

const commissionInclude = {
  contract: {
    select: {
      id: true,
      reference: true,
      type: true,
      property: { select: { id: true, reference: true, address: true, city: true } },
      client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
    },
  },
  user: { select: { id: true, firstName: true, lastName: true, role: true } },
  referrer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
} as const;

/**
 * Enregistre les handlers IPC du module de gestion des commissions.
 */
export function registerCommissionsIPC(): void {

  /* ─── Tableau de bord des commissions ────────────────────────────── */

  ipcMain.handle('commissions:getDashboard', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();

      const [aPayer, payee, annuleeCount, grouped, recent, rates] = await Promise.all([
        db.commission.aggregate({
          where: { deletedAt: null, status: 'A_PAYER' },
          _sum: { amount: true },
          _count: true,
        }),
        db.commission.aggregate({
          where: { deletedAt: null, status: 'PAYEE' },
          _sum: { amount: true },
          _count: true,
        }),
        db.commission.count({ where: { deletedAt: null, status: 'ANNULEE' } }),
        db.commission.groupBy({
          by: ['beneficiaryType', 'userId', 'referrerId', 'status'],
          where: { deletedAt: null, status: { in: ['A_PAYER', 'PAYEE'] } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.commission.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: commissionInclude,
        }),
        getDefaultRates(db),
      ]);

      // Récapitulatif par bénéficiaire (utilisateur ou apporteur d'affaire)
      const recap = new Map<string, any>();
      for (const g of grouped) {
        const isUser = g.beneficiaryType === 'USER';
        const benId = isUser ? g.userId : g.referrerId;
        if (benId == null) continue;
        const key = `${g.beneficiaryType}:${benId}`;
        if (!recap.has(key)) {
          recap.set(key, {
            beneficiaryType: g.beneficiaryType,
            beneficiaryId: benId,
            name: '',
            aPayerAmount: 0,
            aPayerCount: 0,
            payeAmount: 0,
            payeCount: 0,
          });
        }
        const entry = recap.get(key);
        const sum = Number(g._sum.amount ?? 0);
        const count = g._count._all;
        if (g.status === 'A_PAYER') {
          entry.aPayerAmount += sum;
          entry.aPayerCount += count;
        } else if (g.status === 'PAYEE') {
          entry.payeAmount += sum;
          entry.payeCount += count;
        }
      }

      // Résolution des noms des bénéficiaires
      const userIds = [...recap.values()].filter((e) => e.beneficiaryType === 'USER').map((e) => e.beneficiaryId);
      const referrerIds = [...recap.values()].filter((e) => e.beneficiaryType === 'REFERRER').map((e) => e.beneficiaryId);
      const [users, referrers] = await Promise.all([
        userIds.length
          ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
          : Promise.resolve([]),
        referrerIds.length
          ? db.businessReferrer.findMany({ where: { id: { in: referrerIds } }, select: { id: true, firstName: true, lastName: true, companyName: true } })
          : Promise.resolve([]),
      ]);
      const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
      const referrerMap = new Map(referrers.map((r) => [r.id, r.companyName || `${r.firstName} ${r.lastName}`.trim()]));
      for (const entry of recap.values()) {
        entry.name = entry.beneficiaryType === 'USER'
          ? (userMap.get(entry.beneficiaryId) ?? `Utilisateur #${entry.beneficiaryId}`)
          : (referrerMap.get(entry.beneficiaryId) ?? `Apporteur #${entry.beneficiaryId}`);
        entry.totalAmount = entry.aPayerAmount + entry.payeAmount;
      }
      const byBeneficiary = [...recap.values()].sort((a, b) => b.totalAmount - a.totalAmount);

      return {
        success: true,
        data: {
          aPayerCount: aPayer._count,
          aPayerAmount: Number(aPayer._sum.amount ?? 0),
          payeeCount: payee._count,
          payeeAmount: Number(payee._sum.amount ?? 0),
          annuleeCount,
          byBeneficiary,
          recent,
          settings: rates,
        },
      };
    } catch (error: any) {
      logger.error('commissions:getDashboard error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Liste des commissions ──────────────────────────────────────── */

  ipcMain.handle('commissions:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();

      const where: any = { deletedAt: null };
      if (filters.status) where.status = filters.status;
      if (filters.beneficiaryType) where.beneficiaryType = filters.beneficiaryType;
      if (filters.transactionType) where.transactionType = filters.transactionType;
      if (filters.userId) where.userId = filters.userId;
      if (filters.referrerId) where.referrerId = filters.referrerId;
      if (filters.contractId) where.contractId = filters.contractId;
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { contract: { reference: { contains: filters.search } } },
          { user: { firstName: { contains: filters.search } } },
          { user: { lastName: { contains: filters.search } } },
          { referrer: { firstName: { contains: filters.search } } },
          { referrer: { lastName: { contains: filters.search } } },
          { referrer: { companyName: { contains: filters.search } } },
        ];
      }

      const [data, total] = await db.$transaction([
        db.commission.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: commissionInclude,
        }),
        db.commission.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('commissions:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('commissions:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const commission = await db.commission.findUnique({
        where: { id },
        include: {
          ...commissionInclude,
          paidBy: { select: { id: true, firstName: true, lastName: true } },
          cancelledBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      if (!commission || commission.deletedAt) return { success: false, error: 'Commission introuvable' };
      return { success: true, data: commission };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /* ─── Création manuelle d'une commission ─────────────────────────── */

  ipcMain.handle('commissions:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = createCommissionSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();

      const contract = await db.contract.findUnique({
        where: { id: d.contractId, deletedAt: null },
        select: { id: true, type: true },
      });
      if (!contract) return { success: false, error: 'Contrat introuvable' };

      if (!isCommissionEligibleContract(contract.type)) {
        return { success: false, error: 'Ce contrat n\'est pas éligible à une commission (vente ou location uniquement)' };
      }

      // Une commission VENTE/LOCATION doit correspondre au type du contrat ;
      // une commission FRAIS_DOSSIER est admise quel que soit le contrat éligible.
      const naturalType = contract.type === 'SALE' ? 'VENTE' : 'LOCATION';
      if (d.transactionType !== 'FRAIS_DOSSIER' && d.transactionType !== naturalType) {
        return { success: false, error: 'Le type de commission ne correspond pas au type du contrat' };
      }

      // Vérifie l'existence du bénéficiaire
      if (d.beneficiaryType === 'USER') {
        const user = await db.user.findUnique({ where: { id: d.userId }, select: { id: true } });
        if (!user) return { success: false, error: 'Utilisateur introuvable' };
      } else {
        const referrer = await db.businessReferrer.findUnique({ where: { id: d.referrerId }, select: { id: true } });
        if (!referrer) return { success: false, error: 'Apporteur d\'affaire introuvable' };
      }

      const amount = computeCommissionAmount(d.baseAmount, d.rate);
      const reference = await nextCommissionRef(db);

      const commission = await db.commission.create({
        data: {
          reference,
          contractId: d.contractId,
          beneficiaryType: d.beneficiaryType,
          userId: d.beneficiaryType === 'USER' ? d.userId : null,
          referrerId: d.beneficiaryType === 'REFERRER' ? d.referrerId : null,
          transactionType: d.transactionType,
          baseAmount: d.baseAmount as never,
          rate: d.rate as never,
          amount: amount as never,
          status: 'A_PAYER',
          source: 'MANUEL',
          notes: d.notes,
        },
        include: commissionInclude,
      });
      logger.info(`Commission créée: ${commission.reference}`);
      return { success: true, data: commission };
    } catch (error: any) {
      logger.error('commissions:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Paiement d'une commission ──────────────────────────────────── */

  ipcMain.handle('commissions:pay', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = payCommissionSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();

      const commission = await db.commission.findUnique({ where: { id: d.id }, select: { id: true, status: true, deletedAt: true } });
      if (!commission || commission.deletedAt) return { success: false, error: 'Commission introuvable' };
      if (commission.status === 'PAYEE') return { success: false, error: 'Commission déjà payée' };
      if (commission.status === 'ANNULEE') return { success: false, error: 'Impossible de payer une commission annulée' };

      const updated = await db.commission.update({
        where: { id: d.id },
        data: {
          status: 'PAYEE',
          paidAt: d.paidAt ? new Date(d.paidAt) : new Date(),
          paymentMethod: d.method,
          paymentRef: d.paymentRef,
          paidById: session.userId,
          notes: d.notes,
        },
        include: commissionInclude,
      });
      logger.info(`Commission payée: id=${d.id} par user=${session.userId}`);
      return { success: true, data: updated };
    } catch (error: any) {
      logger.error('commissions:pay error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Annulation d'une commission ────────────────────────────────── */

  ipcMain.handle('commissions:cancel', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = cancelCommissionSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const d = parsed.data;
      const db = getDb();

      const commission = await db.commission.findUnique({ where: { id: d.id }, select: { id: true, status: true, deletedAt: true } });
      if (!commission || commission.deletedAt) return { success: false, error: 'Commission introuvable' };
      if (commission.status === 'ANNULEE') return { success: false, error: 'Commission déjà annulée' };

      const updated = await db.commission.update({
        where: { id: d.id },
        data: {
          status: 'ANNULEE',
          cancelledAt: new Date(),
          cancelReason: d.reason,
          cancelledById: session.userId,
        },
        include: commissionInclude,
      });
      logger.info(`Commission annulée: id=${d.id} par user=${session.userId}`);
      return { success: true, data: updated };
    } catch (error: any) {
      logger.error('commissions:cancel error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Tableau de commissions d'un bénéficiaire ───────────────────── */

  ipcMain.handle('commissions:getBeneficiarySummary', async (_event, { token, beneficiaryType, beneficiaryId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      if (beneficiaryType !== 'USER' && beneficiaryType !== 'REFERRER') {
        return { success: false, error: 'Type de bénéficiaire invalide' };
      }
      const db = getDb();

      let beneficiary: any = null;
      if (beneficiaryType === 'USER') {
        beneficiary = await db.user.findUnique({
          where: { id: beneficiaryId },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, role: true, matricule: true },
        });
      } else {
        beneficiary = await db.businessReferrer.findUnique({ where: { id: beneficiaryId } });
      }
      if (!beneficiary) return { success: false, error: 'Bénéficiaire introuvable' };

      const where: any = { deletedAt: null, beneficiaryType };
      if (beneficiaryType === 'USER') where.userId = beneficiaryId;
      else where.referrerId = beneficiaryId;

      const commissions = await db.commission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: commissionInclude,
      });

      const totals = { aPayerAmount: 0, aPayerCount: 0, payeAmount: 0, payeCount: 0, annuleeCount: 0 };
      for (const c of commissions) {
        const amt = Number(c.amount);
        if (c.status === 'A_PAYER') { totals.aPayerAmount += amt; totals.aPayerCount += 1; }
        else if (c.status === 'PAYEE') { totals.payeAmount += amt; totals.payeCount += 1; }
        else if (c.status === 'ANNULEE') { totals.annuleeCount += 1; }
      }

      return { success: true, data: { beneficiaryType, beneficiary, commissions, totals } };
    } catch (error: any) {
      logger.error('commissions:getBeneficiarySummary error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Apporteurs d'affaire ───────────────────────────────────────── */

  ipcMain.handle('commissions:listReferrers', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.isActive !== undefined && filters.isActive !== '') where.isActive = filters.isActive === true || filters.isActive === 'true';
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { companyName: { contains: filters.search } },
          { email: { contains: filters.search } },
          { phone: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.businessReferrer.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { commissions: true } } },
        }),
        db.businessReferrer.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('commissions:listReferrers error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('commissions:getReferrerById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const referrer = await db.businessReferrer.findUnique({ where: { id } });
      if (!referrer || referrer.deletedAt) return { success: false, error: 'Apporteur d\'affaire introuvable' };
      return { success: true, data: referrer };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('commissions:createReferrer', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = referrerSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      const referrer = await db.businessReferrer.create({
        data: { ...d, email: d.email || null },
      });
      logger.info(`Apporteur d'affaire créé: id=${referrer.id}`);
      return { success: true, data: referrer };
    } catch (error: any) {
      logger.error('commissions:createReferrer error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('commissions:updateReferrer', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = referrerSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      const data: any = { ...d };
      if (d.email !== undefined) data.email = d.email || null;
      const referrer = await db.businessReferrer.update({ where: { id }, data });
      return { success: true, data: referrer };
    } catch (error: any) {
      logger.error('commissions:updateReferrer error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('commissions:deleteReferrer', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const db = getDb();
      const activeCommissions = await db.commission.count({
        where: { referrerId: id, deletedAt: null, status: { not: 'ANNULEE' } },
      });
      if (activeCommissions > 0) {
        return { success: false, error: 'Impossible de supprimer : cet apporteur a des commissions actives' };
      }
      await db.businessReferrer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('commissions:deleteReferrer error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Données pour les formulaires ───────────────────────────────── */

  ipcMain.handle('commissions:listUsers', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const users = await db.user.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true, matricule: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      });
      return { success: true, data: users };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('commissions:listEligibleContracts', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const contracts = await db.contract.findMany({
        where: {
          deletedAt: null,
          status: { not: 'ANNULE' },
          type: { in: ['SALE', 'RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'COMMERCIAL_LEASE'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          type: true,
          saleAmount: true,
          rentAmount: true,
          client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
          property: { select: { id: true, reference: true } },
        },
      });
      return { success: true, data: contracts };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /* ─── Paramètres : taux de commission par défaut ─────────────────── */

  ipcMain.handle('commissions:getSettings', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const rates = await getDefaultRates(getDb());
      return { success: true, data: rates };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('commissions:updateSettings', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, ADMIN_ROLES);
      const parsed = settingsSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      await setDefaultRates(db, parsed.data);
      logger.info(`Taux de commission par défaut mis à jour par user=${session.userId}`);
      return { success: true, data: parsed.data };
    } catch (error: any) {
      logger.error('commissions:updateSettings error', error.message);
      return { success: false, error: error.message };
    }
  });
}
